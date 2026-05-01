import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { buildRecordCommand } from "../../src/cli/commands/build-record.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

describe("rmws build-record", () => {
  let tmp: string;
  beforeEach(() => {
    vi.restoreAllMocks();
    tmp = mkdtempSync(join(tmpdir(), "rmws-build-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("imprime XML no stdout quando --out omitido", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-getschema-full.xml"), "utf8"),
            ),
        ),
    );

    const out = await buildRecordCommand(
      "GlbUsuarioData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        fieldsJson: '{"CODUSUARIO": "TEST"}',
      },
      {},
    );
    expect(out).toContain("<NewDataSet>");
    expect(out).toContain("<GUSUARIO>");
    expect(out).toContain("<CODUSUARIO>TEST</CODUSUARIO>");
  });

  it("--out grava no arquivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-getschema-full.xml"), "utf8"),
            ),
        ),
    );
    const outFile = join(tmp, "payload.xml");
    const result = await buildRecordCommand(
      "GlbUsuarioData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        fieldsJson: '{"CODUSUARIO": "TEST"}',
        out: outFile,
      },
      {},
    );
    expect(result).toContain(outFile);
    expect(readFileSync(outFile, "utf8")).toContain("<CODUSUARIO>TEST</CODUSUARIO>");
  });

  it("--fields-file lê JSON do disco", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-getschema-full.xml"), "utf8"),
            ),
        ),
    );
    const fieldsFile = join(tmp, "fields.json");
    writeFileSync(fieldsFile, '{"CODUSUARIO": "FROMFILE"}', "utf8");
    const out = await buildRecordCommand(
      "GlbUsuarioData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        fieldsFile,
      },
      {},
    );
    expect(out).toContain("<CODUSUARIO>FROMFILE</CODUSUARIO>");
  });

  it("falha com RmConfigError sem fields", async () => {
    await expect(
      buildRecordCommand(
        "X",
        { wsdl: dataServerWsdlPath, user: "u", password: "p" },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("falha com RmConfigError quando ambos fields-json e fields-file", async () => {
    const fieldsFile = join(tmp, "fields.json");
    writeFileSync(fieldsFile, '{}', "utf8");
    await expect(
      buildRecordCommand(
        "X",
        {
          wsdl: dataServerWsdlPath,
          user: "u",
          password: "p",
          fieldsJson: '{}',
          fieldsFile,
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("falha com RmConfigError quando JSON inválido", async () => {
    await expect(
      buildRecordCommand(
        "X",
        {
          wsdl: dataServerWsdlPath,
          user: "u",
          password: "p",
          fieldsJson: "{invalido",
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });

  it("propaga RmValidationError quando fields inválidos", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-getschema-full.xml"), "utf8"),
            ),
        ),
    );
    await expect(
      buildRecordCommand(
        "GlbUsuarioData",
        {
          wsdl: dataServerWsdlPath,
          user: "u",
          password: "p",
          fieldsJson: '{"CAMPO_INEXISTENTE": "x"}',
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_VALIDATION_ERROR" });
  });
});
