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
function fixture(name: string) {
  return readFileSync(resolve(here, `../fixtures/responses/${name}`), "utf8");
}

const baseConfig = {
  services: {
    dataServer: { wsdlXml: dataServerWsdl },
  },
  auth: { type: "basic" as const, username: "u", password: "p" },
};

interface UsuarioRm {
  CODUSUARIO: string;
  NOME: string;
  STATUS?: string;
  EMAIL?: string;
}

describe("DataServerClient.readView", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna array tipado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const usuarios = await rm.dataServer.readView<UsuarioRm>({
      dataServerName: "GlbUsuarioData",
      filter: "CODUSUARIO='mestre'",
      context: { CODCOLIGADA: 1, CODSISTEMA: "G" },
    });
    expect(usuarios).toHaveLength(2);
    expect(usuarios[0]?.CODUSUARIO).toBe("mestre");
    expect(usuarios[0]?.NOME).toBe("Usuário Mestre");
  });

  it("normaliza 1 registro como array de 1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview-single.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const usuarios = await rm.dataServer.readView<UsuarioRm>({
      dataServerName: "GlbUsuarioData",
    });
    expect(usuarios).toHaveLength(1);
  });

  it("retorna [] em NewDataSet vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const usuarios = await rm.dataServer.readView({ dataServerName: "X" });
    expect(usuarios).toEqual([]);
  });

  it("parseMode raw retorna XML cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.readView({
      dataServerName: "X",
      parseMode: "raw",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("ReadViewResult");
  });

  it("envia DataServerName, Filtro e Contexto no body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.readView({
      dataServerName: "GlbUsuarioData",
      filter: "CODUSUARIO='mestre'",
      context: "CODCOLIGADA=1;CODSISTEMA=G",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
    expect(body).toContain("<tot:Filtro>CODUSUARIO=&apos;mestre&apos;</tot:Filtro>");
    expect(body).toContain("<tot:Contexto>CODCOLIGADA=1;CODSISTEMA=G</tot:Contexto>");
  });

  it("envia SOAPAction correto extraído do WSDL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.readView({ dataServerName: "X" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.SOAPAction).toBe('"http://www.totvs.com/IwsDataServer/ReadView"');
  });

  it("usa endpoint extraído do WSDL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.readView({ dataServerName: "X" });

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe("https://rm.example.com:1251/wsDataServer/IwsDataServer");
  });

  it("parseMode dataset retorna XML interno (sem parsing)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.readView({
      dataServerName: "X",
      parseMode: "dataset",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("<NewDataSet>");
    expect(result as unknown as string).not.toContain("<ReadViewResult>");
  });

  it("aplica defaults.context quando opts.context é omitido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      ...baseConfig,
      defaults: {
        context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
      },
    });
    await rm.dataServer.readView({ dataServerName: "X" });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre");
  });
});

describe("DataServerClient.readRecord", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna primeiro registro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          fixture("dataserver-readview-single.xml").replace(
            /ReadView/g,
            "ReadRecord",
          ),
        ),
      ),
    );
    const rm = createRmClient(baseConfig);
    const usuario = await rm.dataServer.readRecord<UsuarioRm>({
      dataServerName: "GlbUsuarioData",
      primaryKey: "mestre",
    });
    expect(usuario?.CODUSUARIO).toBe("mestre");
  });

  it("parseMode raw retorna XML cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          fixture("dataserver-readview-single.xml").replace(/ReadView/g, "ReadRecord"),
        ),
      ),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.readRecord({
      dataServerName: "X",
      primaryKey: "abc",
      parseMode: "raw",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("ReadRecordResult");
  });

  it("retorna null quando NewDataSet vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          fixture("dataserver-readview-empty.xml").replace(
            /ReadView/g,
            "ReadRecord",
          ),
        ),
      ),
    );
    const rm = createRmClient(baseConfig);
    const usuario = await rm.dataServer.readRecord({
      dataServerName: "X",
      primaryKey: "naoexiste",
    });
    expect(usuario).toBeNull();
  });

  it("parseMode dataset retorna XML interno", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          fixture("dataserver-readview-single.xml").replace(/ReadView/g, "ReadRecord"),
        ),
      ),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.readRecord({
      dataServerName: "X",
      primaryKey: "abc",
      parseMode: "dataset",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("<NewDataSet>");
  });

  it("serializa chave composta com ;", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          fixture("dataserver-readview-empty.xml").replace(
            /ReadView/g,
            "ReadRecord",
          ),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.readRecord({
      dataServerName: "X",
      primaryKey: [1, "abc", 42],
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:PrimaryKey>1;abc;42</tot:PrimaryKey>");
  });
});

describe("DataServerClient.getSchema", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna XML cru do schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-getschema.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const schema = await rm.dataServer.getSchema({ dataServerName: "GlbUsuarioData" });
    expect(schema).toContain("<xs:schema");
    expect(schema).toContain("GlbUsuarioData");
  });
});

describe("DataServerClient.getSchemaParsed", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna RmDataServerSchema parseado a partir do XSD do RM", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(fixture("dataserver-getschema-full.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const schema = await rm.dataServer.getSchemaParsed({
      dataServerName: "GlbUsuarioData",
    });
    expect(schema.datasetName).toBe("GlbUsuarioData");
    expect(schema.rows).toHaveLength(1);
    expect(schema.rows[0]?.name).toBe("GUSUARIO");
    expect(schema.rows[0]?.fields).toHaveLength(2);

    const cod = schema.rows[0]?.fields.find((f) => f.name === "CODUSUARIO");
    expect(cod?.tsType).toBe("string");
    expect(cod?.optional).toBe(false);

    const status = schema.rows[0]?.fields.find((f) => f.name === "STATUS");
    expect(status?.tsType).toBe("number");
    expect(status?.optional).toBe(true);
    expect(status?.default).toBe("1");
  });

  it("propaga RmParseError se o XSD vier inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-getschema.xml"))),
    );
    const rm = createRmClient(baseConfig);
    await expect(
      rm.dataServer.getSchemaParsed({ dataServerName: "X" }),
    ).rejects.toMatchObject({ code: "RM_PARSE_ERROR" });
  });
});

describe("DataServerClient.isValidDataServer", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml"))),
    );
    const rm = createRmClient(baseConfig);
    expect(
      await rm.dataServer.isValidDataServer({ dataServerName: "X" }),
    ).toBe(true);
  });

  it("retorna false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          fixture("dataserver-isvalid-true.xml").replace(">true<", ">false<"),
        ),
      ),
    );
    const rm = createRmClient(baseConfig);
    expect(
      await rm.dataServer.isValidDataServer({ dataServerName: "X" }),
    ).toBe(false);
  });

  it("lança RmParseError quando IsValidDataServerResult é diferente de true/false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          fixture("dataserver-isvalid-true.xml").replace(">true<", ">talvez<"),
        ),
      ),
    );
    const rm = createRmClient(baseConfig);
    await expect(
      rm.dataServer.isValidDataServer({ dataServerName: "X" }),
    ).rejects.toMatchObject({ code: "RM_PARSE_ERROR" });
  });
});

describe("DataServerClient.saveRecord", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const datasetXml =
    "<NewDataSet><GUsuario><CODUSUARIO>novo</CODUSUARIO><NOME>Fulano</NOME></GUsuario></NewDataSet>";

  it("retorna string do SaveRecordResult (chave gerada)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-saverecord.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
      context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
    });
    expect(result).toBe("1;mestre");
  });

  it("retorna string vazia quando SaveRecordResult está vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-saverecord-empty.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
    });
    expect(result).toBe("");
  });

  it("parseMode raw retorna SOAP envelope cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-saverecord.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
      parseMode: "raw",
    });
    expect(result).toContain("<SaveRecordResponse");
    expect(result).toContain("<SaveRecordResult>1;mestre</SaveRecordResult>");
  });

  it("envia DataServerName, XML e Contexto no body com XML escapado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-saverecord.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
      context: "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
    expect(body).toContain(
      "<tot:XML>&lt;NewDataSet&gt;&lt;GUsuario&gt;&lt;CODUSUARIO&gt;novo&lt;/CODUSUARIO&gt;",
    );
    expect(body).toContain(
      "<tot:Contexto>CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre</tot:Contexto>",
    );
    expect(body).not.toContain("<NewDataSet>");
  });

  it("envia SOAPAction de SaveRecord", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-saverecord.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsDataServer/SaveRecord"',
    );
  });

  it("aplica defaults.context quando opts.context é omitido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-saverecord.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      ...baseConfig,
      defaults: {
        context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
      },
    });
    await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain(
      "<tot:Contexto>CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre</tot:Contexto>",
    );
  });

  it("propaga RmSoapFaultError quando o RM retorna fault", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("soap-fault.xml"))),
    );
    const rm = createRmClient(baseConfig);
    await expect(
      rm.dataServer.saveRecord({
        dataServerName: "GlbUsuarioData",
        xml: datasetXml,
      }),
    ).rejects.toMatchObject({ code: "RM_SOAP_FAULT" });
  });

  it("parseMode result-strict: PK válido passa intocado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-saverecord.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
      parseMode: "result-strict",
    });
    expect(result).toBe("1;mestre");
  });

  it("parseMode result-strict: erro embutido vira RmResultError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(fixture("dataserver-saverecord-fk-error.xml"))),
    );
    const rm = createRmClient(baseConfig);
    await expect(
      rm.dataServer.saveRecord({
        dataServerName: "EduPessoaData",
        xml: datasetXml,
        parseMode: "result-strict",
      }),
    ).rejects.toMatchObject({
      code: "RM_RESULT_ERROR",
      operationName: "SaveRecord",
      summary: expect.stringMatching(/Violação de chave/),
      sql: expect.stringMatching(/INSERT INTO \[SPESSOA\]/),
    });
  });

  it("parseMode result (default) devolve erro embutido cru sem lançar", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(fixture("dataserver-saverecord-fk-error.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.saveRecord({
      dataServerName: "EduPessoaData",
      xml: datasetXml,
    });
    expect(typeof result).toBe("string");
    expect(result).toContain("Violação de chave");
  });

  it("não loga o XML do payload por padrão (logBody=false implícito)", async () => {
    const debug = vi.fn();
    const logger = {
      debug,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-saverecord.xml"))),
    );

    const rm = createRmClient({ ...baseConfig, logger });
    await rm.dataServer.saveRecord({
      dataServerName: "GlbUsuarioData",
      xml: datasetXml,
    });

    const calls = debug.mock.calls.map((c) => JSON.stringify(c));
    expect(calls.join("\n")).not.toContain(datasetXml);
    expect(calls.join("\n")).not.toContain("&lt;NewDataSet&gt;");
  });
});

describe("DataServerClient.deleteRecordByKey", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna string vazia em sucesso (Result vazio do RM)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(fixture("dataserver-deleterecord-bykey.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.deleteRecordByKey({
      dataServerName: "RhuPessoaData",
      primaryKey: 26620,
    });
    expect(result).toBe("");
  });

  it("envia DataServerName, PrimaryKey e Contexto + SOAPAction correto", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-deleterecord-bykey.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.deleteRecordByKey({
      dataServerName: "RhuPessoaData",
      primaryKey: [1, "abc"],
      context: "CODCOLIGADA=1;CODSISTEMA=G",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain("<tot:DataServerName>RhuPessoaData</tot:DataServerName>");
    expect(body).toContain("<tot:PrimaryKey>1;abc</tot:PrimaryKey>");
    expect(body).toContain("<tot:Contexto>CODCOLIGADA=1;CODSISTEMA=G</tot:Contexto>");

    const headers = init.headers as Record<string, string>;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsDataServer/DeleteRecordByKey"',
    );
  });

  it("parseMode raw devolve SOAP envelope cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(fixture("dataserver-deleterecord-bykey.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.deleteRecordByKey({
      dataServerName: "RhuPessoaData",
      primaryKey: "26620",
      parseMode: "raw",
    });
    expect(result).toContain("<DeleteRecordByKeyResponse");
  });

  it("parseMode result-strict: vazio passa, erro vira RmResultError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(fixture("dataserver-deleterecord-bykey.xml")))
        .mockResolvedValueOnce(new Response(fixture("dataserver-deleterecord-fk-error.xml").replace(/DeleteRecordResponse/g, "DeleteRecordByKeyResponse").replace(/DeleteRecordResult/g, "DeleteRecordByKeyResult"))),
    );
    const rm = createRmClient(baseConfig);

    // 1ª: vazio passa
    const ok = await rm.dataServer.deleteRecordByKey({
      dataServerName: "RhuPessoaData",
      primaryKey: "26620",
      parseMode: "result-strict",
    });
    expect(ok).toBe("");

    // 2ª: FK erro lança
    await expect(
      rm.dataServer.deleteRecordByKey({
        dataServerName: "RhuPessoaData",
        primaryKey: "26620",
        parseMode: "result-strict",
      }),
    ).rejects.toMatchObject({
      code: "RM_RESULT_ERROR",
      operationName: "DeleteRecordByKey",
    });
  });

  it("aplica defaults.context quando opts.context é omitido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-deleterecord-bykey.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      ...baseConfig,
      defaults: {
        context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
      },
    });
    await rm.dataServer.deleteRecordByKey({
      dataServerName: "RhuPessoaData",
      primaryKey: 26620,
    });
    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre");
  });
});

describe("DataServerClient.deleteRecord", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const datasetXml =
    "<NewDataSet><PPessoa><CODIGO>26620</CODIGO></PPessoa></NewDataSet>";

  it("retorna string vazia em sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-deleterecord.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.deleteRecord({
      dataServerName: "RhuPessoaData",
      xml: datasetXml,
    });
    expect(result).toBe("");
  });

  it("envia XML escapado + SOAPAction de DeleteRecord", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-deleterecord.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.deleteRecord({
      dataServerName: "RhuPessoaData",
      xml: datasetXml,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain(
      "<tot:XML>&lt;NewDataSet&gt;&lt;PPessoa&gt;",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsDataServer/DeleteRecord"',
    );
  });

  it("parseMode result-strict lança em FK violation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(fixture("dataserver-deleterecord-fk-error.xml"))),
    );
    const rm = createRmClient(baseConfig);
    await expect(
      rm.dataServer.deleteRecord({
        dataServerName: "RhuPessoaData",
        xml: datasetXml,
        parseMode: "result-strict",
      }),
    ).rejects.toMatchObject({
      code: "RM_RESULT_ERROR",
      operationName: "DeleteRecord",
      summary: expect.stringMatching(/Violação/),
    });
  });

  it("parseMode raw devolve SOAP cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-deleterecord.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.deleteRecord({
      dataServerName: "RhuPessoaData",
      xml: datasetXml,
      parseMode: "raw",
    });
    expect(result).toContain("<DeleteRecordResponse");
  });

  it("não loga o XML do payload por padrão", async () => {
    const debug = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-deleterecord.xml"))),
    );
    const rm = createRmClient({
      ...baseConfig,
      logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    await rm.dataServer.deleteRecord({
      dataServerName: "RhuPessoaData",
      xml: datasetXml,
    });
    const calls = JSON.stringify(debug.mock.calls);
    expect(calls).not.toContain(datasetXml);
    expect(calls).not.toContain("&lt;NewDataSet&gt;");
  });
});

describe("DataServerClient.readLookupView", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna array tipado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readlookupview.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const items = await rm.dataServer.readLookupView<{
      CHAVE: string;
      DESCRICAO: string;
    }>({ dataServerName: "AlgumLookupData" });
    expect(items).toHaveLength(2);
    expect(items[0]?.CHAVE).toBe("1");
    expect(items[0]?.DESCRICAO).toBe("Opção A");
  });

  it("envia DataServerName, Filtro, Contexto, OwnerData + SOAPAction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readlookupview.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.readLookupView({
      dataServerName: "AlgumLookupData",
      filter: "X=1",
      context: "CODCOLIGADA=1",
      ownerData: "<Owner><X>1</X></Owner>",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain("<tot:DataServerName>AlgumLookupData</tot:DataServerName>");
    expect(body).toContain("<tot:Filtro>X=1</tot:Filtro>");
    expect(body).toContain("<tot:Contexto>CODCOLIGADA=1</tot:Contexto>");
    expect(body).toContain(
      "<tot:OwnerData>&lt;Owner&gt;&lt;X&gt;1&lt;/X&gt;&lt;/Owner&gt;</tot:OwnerData>",
    );

    const headers = init.headers as Record<string, string>;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsDataServer/ReadLookupView"',
    );
  });

  it("ownerData omitido NÃO emite o elemento", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readlookupview.xml")));
    vi.stubGlobal("fetch", fetchMock);
    const rm = createRmClient(baseConfig);
    await rm.dataServer.readLookupView({ dataServerName: "X" });
    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).not.toContain("<tot:OwnerData");
  });

  it("parseMode raw retorna SOAP envelope cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readlookupview.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.readLookupView({
      dataServerName: "X",
      parseMode: "raw",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("ReadLookupViewResult");
  });

  it("parseMode dataset retorna XML interno (sem parsing)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readlookupview.xml"))),
    );
    const rm = createRmClient(baseConfig);
    const result = await rm.dataServer.readLookupView({
      dataServerName: "X",
      parseMode: "dataset",
    });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("<NewDataSet>");
  });
});

describe("DataServerClient — operação ausente no service", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("lança RmConfigError quando a operação não está no port", async () => {
    const rm = createRmClient({
      services: {
        dataServer: {
          endpointUrl: "https://rm.example.com/wsDataServer/IwsDataServer",
          soapActions: {},
        },
      },
      auth: { type: "basic", username: "u", password: "p" },
    });
    await expect(
      rm.dataServer.readView({ dataServerName: "X" }),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });
});

describe("createRmClient — overrides manuais", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("aceita endpointUrl + soapActions sem WSDL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient({
      services: {
        dataServer: {
          endpointUrl: "https://rm.custom.local/wsDataServer/IwsDataServer",
          soapActions: {
            ReadView: "http://www.totvs.com/IwsDataServer/ReadView",
          },
        },
      },
      auth: { type: "basic", username: "u", password: "p" },
    });

    await rm.dataServer.readView({ dataServerName: "X" });

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe("https://rm.custom.local/wsDataServer/IwsDataServer");
  });

  it("cacheia resolução do WSDL (não chama fetch para WSDL duas vezes)", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Response(fixture("dataserver-readview-empty.xml")),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rm = createRmClient(baseConfig);
    await rm.dataServer.readView({ dataServerName: "X" });
    await rm.dataServer.readView({ dataServerName: "Y" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
