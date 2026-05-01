import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { RmValidationError } from "../../src/errors/rm-validation-error.js";
import { buildRecord } from "../../src/schema/build-record.js";
import { parseXsdSchema } from "../../src/schema/parse-xsd.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(here, `../fixtures/schemas/${name}`), "utf8");

const rhuPessoa = parseXsdSchema(fixture("rhu-pessoa.xsd"));
const glbUsuario = parseXsdSchema(fixture("glb-usuario.xsd"));

describe("buildRecord — geração de XML válido", () => {
  it("monta NewDataSet > PPessoa com campos básicos", () => {
    const xml = buildRecord(rhuPessoa, {
      CODIGO: -1,
      NOME: "Fulano de Tal",
    });
    expect(xml).toBe(
      "<NewDataSet><PPessoa><CODIGO>-1</CODIGO><NOME>Fulano de Tal</NOME></PPessoa></NewDataSet>",
    );
  });

  it("escapa caracteres especiais XML", () => {
    const xml = buildRecord(rhuPessoa, {
      CODIGO: -1,
      NOME: "<script>&'\"alert</script>",
    });
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&apos;");
    expect(xml).toContain("&quot;");
    expect(xml).not.toContain("<script>");
  });

  it("converte Date pra ISO 8601 em campo dateTime", () => {
    const xml = buildRecord(rhuPessoa, {
      CODIGO: -1,
      NOME: "X",
      DTNASCIMENTO: new Date(Date.UTC(2000, 0, 15, 12, 0, 0)),
    });
    expect(xml).toContain("<DTNASCIMENTO>2000-01-15T12:00:00.000Z</DTNASCIMENTO>");
  });

  it("converte boolean pra 1/0 (convenção RM)", () => {
    // Campo boolean explícito no schema é raro — usamos um xs:short de
    // GUSUARIO (STATUS) pra teste de coerção bool→1/0 via tsType=number.
    // Mas STATUS é number, então dá pra passar boolean → vira 1/0.
    const xml = buildRecord(glbUsuario, {
      CODUSUARIO: "TEST",
      DATAINICIO: "2026-05-01T00:00:00",
      CODACESSO: "abc",
      IGNORARAUTENTICACAOLDAP: "T",
      STATUS: true,
    });
    expect(xml).toContain("<STATUS>1</STATUS>");
  });

  it("emite <Campo/> quando valor é null (reset explícito)", () => {
    const xml = buildRecord(rhuPessoa, {
      CODIGO: -1,
      NOME: "X",
      DTNASCIMENTO: null,
    });
    expect(xml).toContain("<DTNASCIMENTO/>");
  });

  it("omite campo quando valor é undefined", () => {
    const xml = buildRecord(rhuPessoa, {
      CODIGO: -1,
      NOME: "X",
      DTNASCIMENTO: undefined,
    });
    expect(xml).not.toContain("DTNASCIMENTO");
  });
});

describe("buildRecord — múltiplas rows", () => {
  it("aceita array de fields → várias <PPessoa> dentro do mesmo NewDataSet", () => {
    const xml = buildRecord(rhuPessoa, [
      { CODIGO: -1, NOME: "A" },
      { CODIGO: -1, NOME: "B" },
    ]);
    const matches = xml.match(/<PPessoa>/g);
    expect(matches?.length).toBe(2);
    expect(xml).toContain("<NOME>A</NOME>");
    expect(xml).toContain("<NOME>B</NOME>");
  });
});

describe("buildRecord — rowName explícito", () => {
  it("permite escolher row diferente da master", () => {
    // GlbUsuario tem GUSUARIO (master) + GPERMIS + GUSRPERFIL
    const xml = buildRecord(
      glbUsuario,
      { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "x" },
      { rowName: "GPERMIS", allowUnknownFields: true },
    );
    expect(xml).toContain("<GPERMIS>");
    expect(xml).not.toContain("<GUSUARIO>");
  });

  it("lança RmConfigError em rowName inexistente", () => {
    expect(() =>
      buildRecord(
        rhuPessoa,
        { CODIGO: -1, NOME: "X" },
        { rowName: "NaoExiste" },
      ),
    ).toThrow(/RM_CONFIG_ERROR|não existe/);
  });
});

describe("buildRecord — validação", () => {
  it("lança RmValidationError quando campo obrigatório falta", () => {
    expect(() => buildRecord(rhuPessoa, { CODIGO: -1 })).toThrow(RmValidationError);
  });

  it("lança RmValidationError com lista completa de issues (não para no 1º)", () => {
    try {
      buildRecord(rhuPessoa, {
        // CODIGO ausente (required)
        NOME: "X".repeat(200), // maxLength 120
        DTNASCIMENTO: "abc" as unknown as Date, // type errado
        CAMPO_INEXISTENTE: 1, // unknown
      });
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(RmValidationError);
      const err = e as RmValidationError;
      const kinds = err.issues.map((i) => i.kind);
      expect(kinds).toContain("required");
      expect(kinds).toContain("maxLength");
      expect(kinds).toContain("unknown");
    }
  });

  it("bypassValidation=true pula tudo e gera XML mesmo com problemas", () => {
    const xml = buildRecord(
      rhuPessoa,
      { CAMPO_QUALQUER: "x" },
      { bypassValidation: true },
    );
    expect(xml).toContain("<PPessoa>");
    expect(xml).toContain("CAMPO_QUALQUER");
  });

  it("allowUnknownFields=true permite campos extras sem lançar", () => {
    const xml = buildRecord(
      rhuPessoa,
      { CODIGO: -1, NOME: "X", CAMPO_X: "y" },
      { allowUnknownFields: true },
    );
    expect(xml).toContain("CAMPO_X");
  });
});

describe("buildRecord — edge cases", () => {
  it("lança RmConfigError quando schema não tem rows", () => {
    expect(() =>
      buildRecord({ datasetName: "X", rows: [] }, { CODIGO: 1 }),
    ).toThrow(/RM_CONFIG_ERROR|não possui rows/);
  });

  it("array vazio gera NewDataSet sem rows", () => {
    const xml = buildRecord(rhuPessoa, []);
    expect(xml).toBe("<NewDataSet></NewDataSet>");
  });
});
