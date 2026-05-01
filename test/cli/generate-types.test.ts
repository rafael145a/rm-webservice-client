import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { generateTypesCommand } from "../../src/cli/commands/generate-types.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

describe("rmws generate-types", () => {
  let tmp: string;
  beforeEach(() => {
    vi.restoreAllMocks();
    tmp = mkdtempSync(join(tmpdir(), "rmws-gentypes-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("imprime no stdout quando --out omitido", async () => {
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
    const out = await generateTypesCommand(
      "GlbUsuarioData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p" },
      {},
    );
    expect(out).toMatch(/AUTO-GENERATED/);
    expect(out).toMatch(/export interface GUSUARIO\b/);
    expect(out).toMatch(/export interface GlbUsuarioData\b/);
  });

  it("escreve no arquivo quando --out passado", async () => {
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
    const outFile = join(tmp, "glb-usuario.types.ts");
    const result = await generateTypesCommand(
      "GlbUsuarioData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", out: outFile },
      {},
    );
    expect(result).toContain(outFile);
    const written = readFileSync(outFile, "utf8");
    expect(written).toMatch(/export interface GUSUARIO/);
  });

  it("propaga --context para getSchemaParsed", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Response(
            readFileSync(fixturePath("dataserver-getschema-full.xml"), "utf8"),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await generateTypesCommand(
      "GlbUsuarioData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        context: "CODCOLIGADA=1;CODSISTEMA=G",
      },
      {},
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain("CODCOLIGADA=1;CODSISTEMA=G");
  });
});
