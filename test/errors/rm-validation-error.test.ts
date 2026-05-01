import { describe, it, expect } from "vitest";

import { RmValidationError } from "../../src/errors/rm-validation-error.js";

describe("RmValidationError", () => {
  it("expõe code RM_VALIDATION_ERROR", () => {
    const err = new RmValidationError([
      { field: "CODIGO", kind: "required" },
    ]);
    expect(err.code).toBe("RM_VALIDATION_ERROR");
  });

  it("guarda issues como readonly", () => {
    const issues = [
      { field: "CODIGO", kind: "required" as const },
      { field: "X", kind: "unknown" as const },
    ];
    const err = new RmValidationError(issues, "GlbUsuarioData");
    expect(err.issues).toEqual(issues);
    expect(err.target).toBe("GlbUsuarioData");
  });

  it("mensagem singular para 1 issue", () => {
    const err = new RmValidationError(
      [{ field: "NOME", kind: "required" }],
      "RhuPessoaData",
    );
    expect(err.message).toContain("RhuPessoaData");
    expect(err.message).toContain("NOME");
    expect(err.message).toContain("obrigatório");
  });

  it("mensagem agregada quando há vários issues", () => {
    const err = new RmValidationError([
      { field: "X", kind: "unknown" },
      { field: "Y", kind: "type", expected: "number", got: "string" },
      { field: "Z", kind: "maxLength", expected: "10", got: "20" },
    ]);
    expect(err.message).toContain("3 problemas");
    expect(err.message).toContain("X");
    expect(err.message).toContain("Y");
    expect(err.message).toContain("Z");
  });

  it("formata issue type com expected/got", () => {
    const err = new RmValidationError([
      { field: "STATUS", kind: "type", expected: "number", got: "string" },
    ]);
    expect(err.message).toMatch(/STATUS.*number.*string/);
  });
});
