import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { generateTypes } from "../../src/schema/generate-types.js";
import { parseXsdSchema } from "../../src/schema/parse-xsd.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(here, `../fixtures/schemas/${name}`), "utf8");

describe("generateTypes — output contents", () => {
  const schema = parseXsdSchema(fixture("glb-usuario.xsd"));
  const code = generateTypes(schema);

  it("inclui banner AUTO-GENERATED", () => {
    expect(code).toMatch(/AUTO-GENERATED/);
  });

  it("emite uma interface por row", () => {
    expect(code).toMatch(/export interface GUSUARIO\b/);
    expect(code).toMatch(/export interface GPERMIS\b/);
    expect(code).toMatch(/export interface GUSRPERFIL\b/);
  });

  it("emite interface agregada do dataset (rows como propriedades)", () => {
    expect(code).toMatch(/export interface GlbUsuario\b/);
    expect(code).toMatch(/GUSUARIO/);
    expect(code).toMatch(/GPERMIS/);
  });

  it("usa ? em campos opcionais", () => {
    // STATUS é opcional (minOccurs=0)
    expect(code).toMatch(/STATUS\?:/);
  });

  it("não usa ? em campos obrigatórios", () => {
    // CODUSUARIO sem minOccurs=0
    expect(code).toMatch(/CODUSUARIO:\s*string/);
  });

  it("inclui Caption e default no JSDoc", () => {
    expect(code).toMatch(/Usuário/); // Caption de CODUSUARIO
    // STATUS tem default="1"
    expect(code).toMatch(/@default 1/);
  });

  it("inclui maxLength no JSDoc quando aplicável", () => {
    expect(code).toMatch(/@maxLength 20/); // CODUSUARIO maxLength=20
  });

  it("mapeia números corretamente", () => {
    // STATUS: xs:short → number
    expect(code).toMatch(/STATUS\?:\s*number/);
    // ULTIMACOLIGADA: xs:int → number
    expect(code).toMatch(/ULTIMACOLIGADA\?:\s*number/);
  });

  it("mapeia datetime como string", () => {
    expect(code).toMatch(/DATAINICIO:\s*string/); // xs:dateTime → string
  });

  it("é determinístico — mesma entrada → mesma saída", () => {
    const a = generateTypes(schema);
    const b = generateTypes(schema);
    expect(a).toBe(b);
  });
});

describe("generateTypes — RhuPessoaData", () => {
  const schema = parseXsdSchema(fixture("rhu-pessoa.xsd"));
  const code = generateTypes(schema);

  it("interface PPessoa tem CODIGO obrigatório como number", () => {
    expect(code).toMatch(/CODIGO:\s*number/);
  });

  it("interface PPessoa tem NOME obrigatório como string", () => {
    expect(code).toMatch(/NOME:\s*string/);
  });

  it("emite interface RhuPessoa agregadora", () => {
    expect(code).toMatch(/export interface RhuPessoa\b/);
  });
});

describe("generateTypes — saída compila com tsc", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "rmws-gentypes-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("código gerado de GlbUsuarioData passa em tsc --noEmit", () => {
    const schema = parseXsdSchema(fixture("glb-usuario.xsd"));
    const code = generateTypes(schema);
    const file = join(tmp, "glb-usuario.types.ts");
    writeFileSync(file, code, "utf8");
    // Use o tsc do node_modules da raiz; --strict pra pegar problemas de tipagem.
    const tsc = resolve(here, "../../node_modules/.bin/tsc");
    expect(() => {
      execSync(
        `${tsc} --noEmit --strict --target es2022 --moduleResolution NodeNext --module NodeNext "${file}"`,
        { stdio: "pipe" },
      );
    }).not.toThrow();
  });

  it("código gerado de RhuPessoaData passa em tsc --noEmit", () => {
    const schema = parseXsdSchema(fixture("rhu-pessoa.xsd"));
    const code = generateTypes(schema);
    const file = join(tmp, "rhu-pessoa.types.ts");
    writeFileSync(file, code, "utf8");
    const tsc = resolve(here, "../../node_modules/.bin/tsc");
    expect(() => {
      execSync(
        `${tsc} --noEmit --strict --target es2022 --moduleResolution NodeNext --module NodeNext "${file}"`,
        { stdio: "pipe" },
      );
    }).not.toThrow();
  });
});
