import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { createRmClient } from "../../src/client/create-rm-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const consultaSqlWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/consultasql.wsdl"),
  "utf8",
);
function fixture(name: string) {
  return readFileSync(resolve(here, `../fixtures/responses/${name}`), "utf8");
}

const baseConfig = {
  services: {
    consultaSql: { wsdlXml: consultaSqlWsdl },
  },
  auth: { type: "basic" as const, username: "u", password: "p" },
};

interface AlunoResumo {
  RA: string;
  NOME: string;
  CODCOLIGADA: string;
}

describe("ConsultaSqlClient.query", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna array tipado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Response(fixture("consultasql-result.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const alunos = await rm.consultaSql.query<AlunoResumo>({
      codSentenca: "EDU.ALUNOS.ATIVOS",
      codColigada: 1,
      codSistema: "S",
      parameters: { CODFILIAL: 1 },
    });
    expect(alunos).toHaveLength(2);
    expect(alunos[0]?.RA).toBe("12345");
    expect(alunos[1]?.NOME).toBe("Outro Aluno");
  });

  it("retorna [] em NewDataSet vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Response(fixture("consultasql-empty.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const alunos = await rm.consultaSql.query({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
    });
    expect(alunos).toEqual([]);
  });

  it("envia codSentenca, codColigada, codSistema e parameters serializados", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => new Response(fixture("consultasql-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.consultaSql.query({
      codSentenca: "EDU.ALUNOS.ATIVOS",
      codColigada: 1,
      codSistema: "S",
      parameters: { CODFILIAL: 1, RA: "12345" },
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:codSentenca>EDU.ALUNOS.ATIVOS</tot:codSentenca>");
    expect(body).toContain("<tot:codColigada>1</tot:codColigada>");
    expect(body).toContain("<tot:codSistema>S</tot:codSistema>");
    expect(body).toContain("<tot:parameters>CODFILIAL=1;RA=12345</tot:parameters>");
  });

  it("aceita parameters como string crua", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => new Response(fixture("consultasql-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.consultaSql.query({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
      parameters: "CODFILIAL=1;RA=12345",
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:parameters>CODFILIAL=1;RA=12345</tot:parameters>");
  });

  it("envia SOAPAction RealizarConsultaSQL", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => new Response(fixture("consultasql-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.consultaSql.query({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
    });

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsConsultaSQL/RealizarConsultaSQL"',
    );
  });

  it("parseMode raw retorna XML cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Response(fixture("consultasql-result.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.consultaSql.query({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
      parseMode: "raw",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("RealizarConsultaSQLResult");
  });

  it("repassa logger e logBody para callSoapOperation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Response(fixture("consultasql-empty.xml"))),
    );
    const events: string[] = [];
    const logger = {
      debug: (event: string) => { events.push(event); },
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
    const rm = createRmClient({ ...baseConfig, logger, logBody: true });
    await rm.consultaSql.query({ codSentenca: "X", codColigada: 1, codSistema: "S" });
    expect(events).toContain("soap.request");
    expect(events).toContain("soap.response");
  });

  it("parseMode dataset retorna XML interno (sem registros parseados)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Response(fixture("consultasql-result.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.consultaSql.query({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
      parseMode: "dataset",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("<NewDataSet>");
    expect(result as unknown as string).not.toContain("RealizarConsultaSQLResult");
  });
});

describe("ConsultaSqlClient.queryWithContext", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("envia tag contexto no body", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Response(
            fixture("consultasql-result.xml")
              .replace(/RealizarConsultaSQL/g, "RealizarConsultaSQLContexto"),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.consultaSql.queryWithContext({
      codSentenca: "EDU.ALUNOS.ATIVOS",
      codColigada: 1,
      codSistema: "S",
      parameters: { RA: "12345" },
      context: { CODCOLIGADA: 1, CODFILIAL: 1, CODTIPOCURSO: 1, CODSISTEMA: "S" },
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain(
      "<tot:contexto>CODCOLIGADA=1;CODFILIAL=1;CODTIPOCURSO=1;CODSISTEMA=S</tot:contexto>",
    );
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsConsultaSQL/RealizarConsultaSQLContexto"',
    );
  });

  it("parseMode dataset retorna XML interno", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Response(
            fixture("consultasql-result.xml").replace(
              /RealizarConsultaSQL/g,
              "RealizarConsultaSQLContexto",
            ),
          ),
      ),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.consultaSql.queryWithContext({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
      context: { CODCOLIGADA: 1 },
      parseMode: "dataset",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("<NewDataSet>");
  });

  it("parseMode raw retorna envelope SOAP cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Response(
            fixture("consultasql-result.xml").replace(
              /RealizarConsultaSQL/g,
              "RealizarConsultaSQLContexto",
            ),
          ),
      ),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.consultaSql.queryWithContext({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
      parseMode: "raw",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("RealizarConsultaSQLContextoResult");
  });

  it("aplica defaults.context quando context é omitido", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Response(
            fixture("consultasql-empty.xml")
              .replace(/RealizarConsultaSQL/g, "RealizarConsultaSQLContexto"),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      ...baseConfig,
      defaults: {
        context: { CODCOLIGADA: 1, CODSISTEMA: "S" },
      },
    });
    await rm.consultaSql.queryWithContext({
      codSentenca: "X",
      codColigada: 1,
      codSistema: "S",
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:contexto>CODCOLIGADA=1;CODSISTEMA=S</tot:contexto>");
  });
});

describe("ConsultaSqlClient — operação ausente no service", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("lança RmConfigError quando RealizarConsultaSQL não está no port", async () => {
    const rm = createRmClient({
      services: {
        consultaSql: {
          endpointUrl: "https://rm.example.com/wsConsultaSQL/IwsConsultaSQL",
          soapActions: {},
        },
      },
      auth: { type: "basic", username: "u", password: "p" },
    });
    await expect(
      rm.consultaSql.query({ codSentenca: "X", codColigada: 1, codSistema: "S" }),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });
});
