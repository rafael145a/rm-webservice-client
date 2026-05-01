import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { deleteRecordCommand } from "../../src/cli/commands/delete-record.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

const datasetXml =
  "<NewDataSet><PPessoa><CODIGO>26620</CODIGO></PPessoa></NewDataSet>";

describe("rmws delete-record", () => {
  let tmp: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    tmp = mkdtempSync(join(tmpdir(), "rmws-del-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("retorna o DeleteRecordResult quando passa --xml inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("dataserver-deleterecord.xml"), "utf8")),
        ),
    );
    const out = await deleteRecordCommand(
      "RhuPessoaData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", xml: datasetXml },
      {},
    );
    expect(out).toBe("");
  });

  it("--xml-file lê arquivo do disco", async () => {
    const file = join(tmp, "payload.xml");
    writeFileSync(file, datasetXml, "utf8");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("dataserver-deleterecord.xml"), "utf8")),
        ),
    );
    const out = await deleteRecordCommand(
      "RhuPessoaData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", xmlFile: file },
      {},
    );
    expect(out).toBe("");
  });

  it("--strict lança RmResultError quando RM rejeita", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-deleterecord-fk-error.xml"), "utf8"),
            ),
        ),
    );
    await expect(
      deleteRecordCommand(
        "RhuPessoaData",
        {
          wsdl: dataServerWsdlPath,
          user: "u",
          password: "p",
          xml: datasetXml,
          strict: true,
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_RESULT_ERROR" });
  });

  it("falha com RmConfigError sem --xml e --xml-file", async () => {
    await expect(
      deleteRecordCommand(
        "RhuPessoaData",
        { wsdl: dataServerWsdlPath, user: "u", password: "p" },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("falha com RmConfigError quando --xml e --xml-file juntos", async () => {
    const file = join(tmp, "payload.xml");
    writeFileSync(file, datasetXml, "utf8");
    await expect(
      deleteRecordCommand(
        "RhuPessoaData",
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
