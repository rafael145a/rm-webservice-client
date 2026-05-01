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
