import { afterEach, describe, expect, it, vi } from "vitest";

import { loadWsdl } from "../../src/wsdl/load-wsdl.js";
import { RmConfigError, RmTimeoutError } from "../../src/errors/index.js";

import type { RmLogger } from "../../src/logging/types.js";

function makeLogger(): RmLogger & { events: Array<{ level: string; event: string; data: unknown }> } {
  const events: Array<{ level: string; event: string; data: unknown }> = [];
  return {
    events,
    debug: (event, data) => events.push({ level: "debug", event, data }),
    info: (event, data) => events.push({ level: "info", event, data }),
    warn: (event, data) => events.push({ level: "warn", event, data }),
    error: (event, data) => events.push({ level: "error", event, data }),
  };
}

describe("loadWsdl", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("retorna wsdlXml quando passado inline (sem fetch)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const xml = "<wsdl:definitions/>";
    const result = await loadWsdl({ wsdlXml: xml });

    expect(result).toBe(xml);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lança RmConfigError quando nem wsdlUrl nem wsdlXml são passados", async () => {
    await expect(loadWsdl({})).rejects.toBeInstanceOf(RmConfigError);
  });

  it("lança RmConfigError quando wsdlUrl e wsdlXml são passados juntos", async () => {
    await expect(
      loadWsdl({ wsdlUrl: "https://rm.example.com/?wsdl", wsdlXml: "<x/>" }),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("baixa via fetch e emite eventos wsdl.request + wsdl.response", async () => {
    const xml = "<wsdl:definitions/>";
    globalThis.fetch = vi.fn(async () =>
      new Response(xml, {
        status: 200,
        headers: { "content-type": "text/xml" },
      }),
    ) as unknown as typeof fetch;

    const logger = makeLogger();
    const result = await loadWsdl({
      wsdlUrl: "https://rm.example.com:1251/wsDataServer/MEX?wsdl",
      logger,
    });

    expect(result).toBe(xml);
    expect(logger.events.map((e) => e.event)).toEqual([
      "wsdl.request",
      "wsdl.response",
    ]);
    const response = logger.events[1]!.data as { bytes: number; status: number };
    expect(response.status).toBe(200);
    expect(response.bytes).toBe(xml.length);
  });

  it("HTTP non-ok vira RmConfigError com hint MEX quando 400 + Microsoft-HTTPAPI", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Bad Request", {
        status: 400,
        statusText: "Bad Request",
        headers: { server: "Microsoft-HTTPAPI/2.0" },
      }),
    ) as unknown as typeof fetch;

    const logger = makeLogger();
    const promise = loadWsdl({
      wsdlUrl: "https://rm.example.com:1251/wsDataServer/IwsDataServer?wsdl",
      logger,
    });

    await expect(promise).rejects.toBeInstanceOf(RmConfigError);
    await expect(promise).rejects.toThrow(/MEX\?wsdl/);
    expect(logger.events.some((e) => e.event === "wsdl.error")).toBe(true);
  });

  it("HTTP non-ok sem hint quando URL já é MEX", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Bad Request", {
        status: 400,
        statusText: "Bad Request",
        headers: { server: "Microsoft-HTTPAPI/2.0" },
      }),
    ) as unknown as typeof fetch;

    const promise = loadWsdl({
      wsdlUrl: "https://rm.example.com:1251/wsDataServer/MEX?wsdl",
    });

    await expect(promise).rejects.toBeInstanceOf(RmConfigError);
    await expect(promise).rejects.not.toThrow(/tente trocar o path/);
  });

  it("HTTP 500 vira RmConfigError sem hint TOTVS", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Server error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    ) as unknown as typeof fetch;

    await expect(
      loadWsdl({ wsdlUrl: "https://rm.example.com/wsDataServer?wsdl" }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it("AbortError vira RmTimeoutError com timeoutMs", async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;

    const logger = makeLogger();
    try {
      await loadWsdl({
        wsdlUrl: "https://rm.example.com/?wsdl",
        timeoutMs: 1234,
        logger,
      });
      throw new Error("não deveria chegar aqui");
    } catch (err) {
      expect(err).toBeInstanceOf(RmTimeoutError);
      expect((err as RmTimeoutError).timeoutMs).toBe(1234);
    }
    expect(logger.events.some((e) => e.event === "wsdl.error")).toBe(true);
  });

  it("erro de rede genérico vira RmConfigError com a mensagem original", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    await expect(
      loadWsdl({ wsdlUrl: "https://rm.example.com/?wsdl" }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
