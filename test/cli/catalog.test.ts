import { describe, it, expect } from "vitest";

import { catalogCommand } from "../../src/cli/commands/catalog.js";

describe("rmws catalog", () => {
  it("--modules lista os módulos um por linha", () => {
    const out = catalogCommand({ modules: true });
    const lines = out.split("\n");
    expect(lines).toContain("Recursos Humanos");
    expect(lines).toContain("Educacional");
    expect(lines).toContain("Globais");
  });

  it("--modules --json devolve array JSON", () => {
    const out = catalogCommand({ modules: true, json: true });
    const arr = JSON.parse(out);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toContain("Recursos Humanos");
  });

  it("--search filtra por nome ou descrição", () => {
    const out = catalogCommand({ search: "RhuPessoaData", limit: 5 });
    expect(out).toContain("RhuPessoaData");
    expect(out).toContain("[Recursos Humanos]");
  });

  it("--module filtra por módulo", () => {
    const out = catalogCommand({ module: "Recursos Humanos", limit: 3 });
    const lines = out.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.includes("[Recursos Humanos]"))).toBe(true);
  });

  it("--released oculta os não-liberados", () => {
    const out = catalogCommand({ search: "pessoa", released: true, limit: 50 });
    expect(out).not.toContain("✗");
    expect(out.split("\n").every((l) => l.startsWith("✓ "))).toBe(true);
  });

  it("--json devolve estrutura com meta + items", () => {
    const out = catalogCommand({ search: "RhuPessoaData", json: true, limit: 3 });
    const parsed = JSON.parse(out);
    expect(parsed.meta.source).toMatch(/apitotvslegado/);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.items[0].name).toMatch(/Pessoa/);
  });

  it("query sem matches devolve mensagem amigável", () => {
    const out = catalogCommand({ search: "zzznotexistszzz" });
    expect(out).toContain("nenhum DataServer encontrado");
  });
});
