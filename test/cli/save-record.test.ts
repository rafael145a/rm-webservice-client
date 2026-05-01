import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { saveRecordCommand } from "../../src/cli/commands/save-record.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

const datasetXml =
  "<NewDataSet><GUsuario><CODUSUARIO>novo</CODUSUARIO><NOME>Fulano</NOME></GUsuario></NewDataSet>";

describe("rmws save-record", () => {
  let tmp: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    tmp = mkdtempSync(join(tmpdir(), "rmws-save-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("retorna o SaveRecordResult quando passa --xml inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("dataserver-saverecord.xml"), "utf8")),
        ),
    );

    const out = await saveRecordCommand(
      "GlbUsuarioData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        xml: datasetXml,
        context: "CODCOLIGADA=1;CODSISTEMA=G",
      },
      {},
    );
    expect(out).toBe("1;mestre");
  });

  it("aceita --xml-file lendo o arquivo do disco", async () => {
    const file = join(tmp, "payload.xml");
    writeFileSync(file, datasetXml, "utf8");

    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Response(readFileSync(fixturePath("dataserver-saverecord.xml"), "utf8")),
      );
    vi.stubGlobal("fetch", fetchMock);

    const out = await saveRecordCommand(
      "GlbUsuarioData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", xmlFile: file },
      {},
    );
    expect(out).toBe("1;mestre");

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
    expect(body).toContain("&lt;CODUSUARIO&gt;novo&lt;/CODUSUARIO&gt;");
  });

  it("--raw retorna SOAP envelope cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("dataserver-saverecord.xml"), "utf8")),
        ),
    );

    const out = await saveRecordCommand(
      "GlbUsuarioData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        xml: datasetXml,
        raw: true,
      },
      {},
    );
    expect(out).toContain("<SaveRecordResponse");
    expect(out).toContain("<SaveRecordResult>1;mestre</SaveRecordResult>");
  });

  it("falha com RmConfigError quando nem --xml nem --xml-file foi passado", async () => {
    await expect(
      saveRecordCommand(
        "GlbUsuarioData",
        { wsdl: dataServerWsdlPath, user: "u", password: "p" },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("falha com RmConfigError quando --xml e --xml-file são passados juntos", async () => {
    const file = join(tmp, "payload.xml");
    writeFileSync(file, datasetXml, "utf8");

    await expect(
      saveRecordCommand(
        "GlbUsuarioData",
        {
          wsdl: dataServerWsdlPath,
          user: "u",
          password: "p",
          xml: datasetXml,
          xmlFile: file,
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });
});
