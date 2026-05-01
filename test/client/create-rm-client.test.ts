import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { createRmClient } from "../../src/client/create-rm-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/dataserver.wsdl"),
  "utf8",
);
const consultaSqlWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/consultasql.wsdl"),
  "utf8",
);

const baseAuth = { type: "basic" as const, username: "u", password: "p" };

describe("createRmClient.resolveServices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolve ambos os serviços antecipadamente quando configurados", async () => {
    const rm = createRmClient({
      services: {
        dataServer: { wsdlXml: dataServerWsdl },
        consultaSql: { wsdlXml: consultaSqlWsdl },
      },
      auth: baseAuth,
    });
    await expect(rm.resolveServices()).resolves.toBeUndefined();
  });

  it("é noop quando nenhum serviço foi configurado", async () => {
    const rm = createRmClient({ services: {}, auth: baseAuth });
    await expect(rm.resolveServices()).resolves.toBeUndefined();
  });

  it("resolve apenas dataServer quando consultaSql está ausente", async () => {
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });
    await expect(rm.resolveServices()).resolves.toBeUndefined();
  });

  it("propaga RmConfigError quando WSDL inválido", async () => {
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: "<not-wsdl/>" } },
      auth: baseAuth,
    });
    await expect(rm.resolveServices()).rejects.toThrow();
  });

  it("dataServer.readView lança RmConfigError quando service não foi configurado", async () => {
    const rm = createRmClient({ services: {}, auth: baseAuth });
    await expect(
      rm.dataServer.readView({ dataServerName: "X" }),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("consultaSql.query lança RmConfigError quando service não foi configurado", async () => {
    const rm = createRmClient({ services: {}, auth: baseAuth });
    await expect(
      rm.consultaSql.query({ codSentenca: "X", codColigada: 1, codSistema: "S" }),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("resolveServices em paralelo dedupica via inflight (não chama fetch duplicado)", async () => {
    const fetchMock = vi.fn(async () => new Response(dataServerWsdl, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      services: { dataServer: { wsdlUrl: "https://rm.example.com/wsDataServer/MEX?wsdl" } },
      auth: baseAuth,
    });
    await Promise.all([rm.resolveServices(), rm.resolveServices()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aceita services.dataServer com wsdlUrl (baixa via fetch)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("?wsdl")) return new Response(dataServerWsdl, { status: 200 });
      return new Response(
        `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ReadViewResponse xmlns="http://www.totvs.com/"><ReadViewResult>&lt;NewDataSet/&gt;</ReadViewResult></ReadViewResponse></s:Body></s:Envelope>`,
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      services: { dataServer: { wsdlUrl: "https://rm.example.com/wsDataServer/MEX?wsdl" } },
      auth: baseAuth,
    });
    const records = await rm.dataServer.readView({ dataServerName: "X" });
    expect(records).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repassa logger e logBody para os clients downstream", async () => {
    const events: string[] = [];
    const logger = {
      debug: (event: string) => { events.push(event); },
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body><ReadViewResponse xmlns="http://www.totvs.com/">
    <ReadViewResult>&lt;NewDataSet/&gt;</ReadViewResult>
  </ReadViewResponse></s:Body>
</s:Envelope>`,
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
      logger,
      logBody: true,
    });
    await rm.dataServer.readView({ dataServerName: "X" });

    expect(events).toContain("soap.request");
    expect(events).toContain("soap.response");
  });
});
