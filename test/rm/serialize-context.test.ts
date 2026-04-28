import { describe, it, expect } from "vitest";

import { serializeContext } from "../../src/rm/serialize-context.js";

describe("serializeContext", () => {
  it("string passa direto", () => {
    expect(serializeContext("CODCOLIGADA=1;CODSISTEMA=G")).toBe(
      "CODCOLIGADA=1;CODSISTEMA=G",
    );
  });

  it("objeto vira K=V;K=V", () => {
    expect(
      serializeContext({ CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" }),
    ).toBe("CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre");
  });

  it("ignora undefined", () => {
    expect(serializeContext({ A: 1, B: undefined, C: 3 })).toBe("A=1;C=3");
  });

  it("null vira string vazia", () => {
    expect(serializeContext({ A: 1, B: null })).toBe("A=1;B=");
  });

  it("respeita separador customizado", () => {
    expect(serializeContext({ A: 1, B: 2 }, ",")).toBe("A=1,B=2");
  });

  it("undefined retorna undefined (não serializa)", () => {
    expect(serializeContext(undefined)).toBeUndefined();
  });

  it("objeto vazio vira string vazia", () => {
    expect(serializeContext({})).toBe("");
  });

  it("preserva booleanos", () => {
    expect(serializeContext({ FLAG: true, OFF: false })).toBe("FLAG=true;OFF=false");
  });
});
