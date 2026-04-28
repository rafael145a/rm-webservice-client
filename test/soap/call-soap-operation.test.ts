import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { callSoapOperation } from "../../src/soap/call-soap-operation.js";
import { RmSoapFaultError, RmTimeoutError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const faultXml = readFileSync(
  resolve(here, "../fixtures/responses/soap-fault.xml"),
  "utf8",
);

const baseOptions = {
  endpointUrl: "https://rm.example.com:1251/wsDataServer/IwsDataServer",
  namespace: "http://www.totvs.com/",
  operationName: "ReadView",
  soapAction: "http://www.totvs.com/IwsDataServer/ReadView",
  auth: { type: "basic" as const, username: "u", password: "p" },
  body: { DataServerName: "GlbUsuarioData" },
};

describe("callSoapOperation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("envia POST com Content-Type, SOAPAction e Authorization corretos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<ok/>", { status: 200, headers: { "Content-Type": "text/xml" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callSoapOperation(baseOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(baseOptions.endpointUrl);
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/xml; charset=utf-8");
    expect(headers["SOAPAction"]).toBe(`"${baseOptions.soapAction}"`);
    expect(headers["Authorization"]).toMatch(/^Basic /);

    const body = init.body as string;
    expect(body).toContain("<tot:ReadView>");
    expect(body).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
  });

  it("retorna corpo XML em sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<resposta/>", { status: 200 })),
    );
    const result = await callSoapOperation(baseOptions);
    expect(result).toBe("<resposta/>");
  });

  it("HTTP 401 lança RmHttpError com status e body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        }),
      ),
    );
    await expect(callSoapOperation(baseOptions)).rejects.toMatchObject({
      code: "RM_HTTP_ERROR",
      status: 401,
      responseText: "Unauthorized",
    });
  });

  it("HTTP 500 com SOAP Fault lança RmSoapFaultError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(faultXml, { status: 500 })),
    );
    try {
      await callSoapOperation(baseOptions);
      expect.fail("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(RmSoapFaultError);
      const e = err as RmSoapFaultError;
      expect(e.faultString).toContain("Usuário sem permissão");
      expect(e.status).toBe(500);
    }
  });

  it("HTTP 200 com SOAP Fault também lança RmSoapFaultError (servidor inconsistente)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(faultXml, { status: 200 })),
    );
    await expect(callSoapOperation(baseOptions)).rejects.toBeInstanceOf(RmSoapFaultError);
  });

  it("timeout lança RmTimeoutError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            const signal = init.signal as AbortSignal;
            signal.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    );
    await expect(
      callSoapOperation({ ...baseOptions, timeoutMs: 30 }),
    ).rejects.toBeInstanceOf(RmTimeoutError);
  });

  it("propaga erro de rede genérico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(callSoapOperation(baseOptions)).rejects.toThrow("ECONNRESET");
  });
});
