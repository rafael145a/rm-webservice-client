import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { createRmClient } from "../../src/client/create-rm-client.js";
import { RmSoapFaultError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/dataserver.wsdl"),
  "utf8",
);
const consultaSqlWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/consultasql.wsdl"),
  "utf8",
);
function fixture(name: string) {
  return readFileSync(resolve(here, `../fixtures/responses/${name}`), "utf8");
}

const baseAuth = { type: "basic" as const, username: "u", password: "p" };

describe("DiagnosticsClient.checkDataServer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ok=true quando WSDL resolve e probe IsValidDataServer responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml"))),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.checkDataServer();
    expect(report.service).toBe("dataServer");
    expect(report.ok).toBe(true);
    expect(report.steps.map((s) => s.name)).toEqual([
      "resolve-wsdl",
      "is-valid-data-server",
    ]);
    expect(report.steps[0]?.details?.endpointUrl).toBe(
      "https://rm.example.com:1251/wsDataServer/IwsDataServer",
    );
    expect(report.steps[1]?.details?.isValid).toBe(true);
  });

  it("ok=false quando dataServer não foi configurado", async () => {
    const rm = createRmClient({ services: {}, auth: baseAuth });
    const report = await rm.diagnostics.checkDataServer();
    expect(report.ok).toBe(false);
    expect(report.steps[0]?.error?.code).toBe("RM_CONFIG_ERROR");
  });

  it("ok=false quando probe falha com HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("erro", { status: 500, statusText: "Internal Server Error" }),
      ),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.checkDataServer();
    expect(report.ok).toBe(false);
    const probeStep = report.steps[1];
    expect(probeStep?.ok).toBe(false);
    expect(probeStep?.error?.code).toBe("RM_HTTP_ERROR");
    expect(probeStep?.error?.status).toBe(500);
  });

  it("usa probeDataServerName customizado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    await rm.diagnostics.checkDataServer({ probeDataServerName: "GlbUsuarioData" });
    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
  });
});

describe("DiagnosticsClient.checkConsultaSql", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ok=true sem probe (apenas resolve WSDL)", async () => {
    const rm = createRmClient({
      services: { consultaSql: { wsdlXml: consultaSqlWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.checkConsultaSql();
    expect(report.ok).toBe(true);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.name).toBe("resolve-wsdl");
  });

  it("ok=true quando probe.query retorna array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("consultasql-result.xml"))),
    );

    const rm = createRmClient({
      services: { consultaSql: { wsdlXml: consultaSqlWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.checkConsultaSql({
      probe: {
        codSentenca: "EDU.ALUNOS",
        codColigada: 1,
        codSistema: "S",
      },
    });
    expect(report.ok).toBe(true);
    const probeStep = report.steps[1];
    expect(probeStep?.name).toBe("realizar-consulta-sql");
    expect(probeStep?.details?.codSentenca).toBe("EDU.ALUNOS");
    expect(typeof probeStep?.details?.recordCount).toBe("number");
  });

  it("usa queryWithContext quando context é fornecido no probe", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("consultasql-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      services: { consultaSql: { wsdlXml: consultaSqlWsdl } },
      auth: baseAuth,
    });

    await rm.diagnostics.checkConsultaSql({
      probe: {
        codSentenca: "EDU.ALUNOS",
        codColigada: 1,
        codSistema: "S",
        context: { CODFILIAL: 1 },
      },
    });

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.SOAPAction).toContain("RealizarConsultaSQLContexto");
  });

  it("ok=false quando consultaSql não foi configurado", async () => {
    const rm = createRmClient({ services: {}, auth: baseAuth });
    const report = await rm.diagnostics.checkConsultaSql();
    expect(report.ok).toBe(false);
    expect(report.steps[0]?.error?.code).toBe("RM_CONFIG_ERROR");
  });

  it("ok=false e para no resolve-wsdl quando WSDL é inválido", async () => {
    const rm = createRmClient({
      services: { consultaSql: { wsdlXml: "<not-wsdl/>" } },
      auth: baseAuth,
    });
    const report = await rm.diagnostics.checkConsultaSql({
      probe: { codSentenca: "X", codColigada: 1, codSistema: "S" },
    });
    expect(report.ok).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.name).toBe("resolve-wsdl");
    expect(report.steps[0]?.ok).toBe(false);
  });
});

describe("DiagnosticsClient.checkDataServer — resolve-wsdl falha", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ok=false e para no resolve-wsdl quando WSDL é inválido", async () => {
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: "<not-wsdl/>" } },
      auth: baseAuth,
    });
    const report = await rm.diagnostics.checkDataServer();
    expect(report.ok).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.name).toBe("resolve-wsdl");
    expect(report.steps[0]?.ok).toBe(false);
  });

  it("toStepError omite campos opcionais ausentes em RmSoapFaultError", async () => {
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });
    rm.dataServer.isValidDataServer = async () => {
      throw new RmSoapFaultError("falha sintética sem campos opcionais");
    };

    const report = await rm.diagnostics.checkDataServer();
    const probeStep = report.steps.find((s) => s.name === "is-valid-data-server");
    expect(probeStep?.error?.code).toBe("RM_SOAP_FAULT");
    expect(probeStep?.error?.message).toContain("falha sintética");
    expect(probeStep?.error?.status).toBeUndefined();
    expect(probeStep?.error?.faultCode).toBeUndefined();
    expect(probeStep?.error?.faultString).toBeUndefined();
  });
});

describe("DiagnosticsClient.authenticate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ok=true quando RM responde IsValidDataServer (auth aceito)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml"))),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.authenticate();
    expect(report.service).toBe("auth");
    expect(report.ok).toBe(true);
  });

  it("ok=false quando HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("denied", { status: 401, statusText: "Unauthorized" })),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.authenticate();
    expect(report.ok).toBe(false);
    expect(report.steps[0]?.error?.code).toBe("RM_HTTP_ERROR");
    expect(report.steps[0]?.error?.status).toBe(401);
  });

  it("ok=true quando HTTP 500 (falha de negócio, mas auth passou)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("boom", { status: 500, statusText: "ISE" })),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.authenticate();
    expect(report.ok).toBe(true);
    expect(report.steps[0]?.error?.status).toBe(500);
  });

  it("ok=true quando RM responde SOAP Fault (auth aceito, negócio falhou)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(fixture("soap-fault.xml"), { status: 500, statusText: "ISE" }),
        ),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.authenticate();
    expect(report.ok).toBe(true);
    expect(report.steps[0]?.error?.code).toBe("RM_SOAP_FAULT");
  });

  it("ok=false quando dataServer não foi configurado", async () => {
    const rm = createRmClient({
      services: { consultaSql: { wsdlXml: consultaSqlWsdl } },
      auth: baseAuth,
    });
    const report = await rm.diagnostics.authenticate();
    expect(report.ok).toBe(false);
    expect(report.steps[0]?.error?.code).toBe("RM_CONFIG_ERROR");
  });

  it("encapsula Error nativo (não-RmError) como UNKNOWN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("falha de rede genérica")),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.checkDataServer();
    const probeStep = report.steps.find((s) => s.name === "is-valid-data-server");
    expect(probeStep?.ok).toBe(false);
    expect(probeStep?.error?.code).toBe("UNKNOWN");
    expect(probeStep?.error?.message).toContain("falha de rede genérica");
  });

  it("encapsula valor não-Error lançado como UNKNOWN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        throw "string crua";
      }),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: baseAuth,
    });

    const report = await rm.diagnostics.checkDataServer();
    const probeStep = report.steps.find((s) => s.name === "is-valid-data-server");
    expect(probeStep?.error?.code).toBe("UNKNOWN");
    expect(probeStep?.error?.message).toBe("string crua");
  });
});
