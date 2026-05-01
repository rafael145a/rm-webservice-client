import { describe, it, expect } from "vitest";

import { RmResultError } from "../../src/errors/rm-result-error.js";
import {
  assertRmResultOk,
  detectRmResultError,
} from "../../src/rm/detect-result-error.js";

const FK_REAL =
  "Violação de chave estrangeira&#xD;\n&#xD;\nPossíveis causas:&#xD;\n  - exclusão de registro que possui outros registros associados&#xD;\n  - inclusão de registro detalhe sem um registro mestre associado&#xD;\n=======================================&#xD;\n   at RM.Lib.Data.DbServices.QueryUpdate(DataSet dataSet, String tableName)&#xD;\n   at RM.Edu.Cadastros.EduPessoaData.DoSaveRecord(DataSet dataSet, Int32& rowsAffected, Object ownerData)&#xD;\n=======================================&#xD;\nThe INSERT statement conflicted with the FOREIGN KEY constraint \"FKSPESSOA_PPESSOA\". The conflict occurred in database \"CTF45V_135936_RM_DV\", table \"dbo.PPESSOA\", column 'CODIGO'.&#xD;\n=======================================&#xD;\nINSERT INTO [SPESSOA] ([CODIGO]) VALUES (-1)&#xD;\n=======================================&#xD;";

const REQUIRED_FIELDS_REAL =
  "O(s) campo(s) abaixo deve(m) estar preenchido(s):&#xD;\n&#xD;\nData de Nascimento\nEstado\nNaturalidade\n &#xD;\n=======================================&#xD;\n   at RM.Rhu.Pessoa.RhuPessoaData.ValidateRow(DataRow row)&#xD;\n   at RM.Lib.Server.RMSDataServer.ValidateTableRows(DataTable masterTable)";

describe("detectRmResultError", () => {
  it("retorna null para PK simples (sucesso de SaveRecord)", () => {
    expect(detectRmResultError("26620")).toBeNull();
  });

  it("retorna null para chave composta tipo '1;CHAVE'", () => {
    expect(detectRmResultError("1;mestre")).toBeNull();
  });

  it("retorna null para string vazia (DeleteRecord ok)", () => {
    expect(detectRmResultError("")).toBeNull();
    expect(detectRmResultError("   ")).toBeNull();
  });

  it("detecta FK violation real do RM educacional", () => {
    const err = detectRmResultError(FK_REAL);
    expect(err).not.toBeNull();
    expect(err?.summary).toMatch(/Violação de chave/);
    expect(err?.sql).toMatch(/INSERT INTO \[SPESSOA\]/);
    expect(err?.stack).toMatch(/at RM\.Lib\.Data\.DbServices/);
  });

  it("detecta erro de campo obrigatório do RhuPessoaData", () => {
    const err = detectRmResultError(REQUIRED_FIELDS_REAL);
    expect(err).not.toBeNull();
    expect(err?.summary).toMatch(/preenchido\(s\)/);
    expect(err?.stack).toMatch(/RhuPessoaData\.ValidateRow/);
  });

  it("detecta variantes em inglês (FOREIGN KEY constraint)", () => {
    const err = detectRmResultError(
      "The INSERT statement conflicted with the FOREIGN KEY constraint 'FK_X'.",
    );
    expect(err).not.toBeNull();
  });

  it("usa primeira linha não-vazia como summary mesmo com CR/LF", () => {
    const err = detectRmResultError("\r\n\r\nViolação X\r\n=====\nat RM.Foo");
    expect(err?.summary).toBe("Violação X");
  });

  it("decodifica &#xD; e &amp; antes de matar padrões", () => {
    const raw = "Violação de chave&amp;teste&#xD;\n=====";
    const err = detectRmResultError(raw);
    expect(err?.summary).toContain("Violação");
  });
});

describe("assertRmResultOk", () => {
  it("retorna o resultado intocado quando ok", () => {
    expect(assertRmResultOk("SaveRecord", "26620")).toBe("26620");
    expect(assertRmResultOk("DeleteRecord", "")).toBe("");
  });

  it("lança RmResultError quando há erro embutido", () => {
    expect(() => assertRmResultOk("SaveRecord", FK_REAL)).toThrow(RmResultError);
  });

  it("RmResultError preserva operação, summary, sql, stack e raw", () => {
    try {
      assertRmResultOk("SaveRecord", FK_REAL);
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(RmResultError);
      const err = e as RmResultError;
      expect(err.code).toBe("RM_RESULT_ERROR");
      expect(err.operationName).toBe("SaveRecord");
      expect(err.summary).toMatch(/Violação/);
      expect(err.sql).toMatch(/INSERT INTO/);
      expect(err.stack).toMatch(/at RM\./);
      expect(err.raw).toBe(FK_REAL);
      expect(err.message).toContain("SaveRecord");
      expect(err.message).toContain("Violação");
    }
  });
});
