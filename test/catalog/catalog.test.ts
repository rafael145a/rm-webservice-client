import { describe, it, expect } from "vitest";

import {
  CATALOG_META,
  KNOWN_DATASERVERS,
  KNOWN_MODULES,
  findDataServer,
  searchDataServers,
} from "../../src/catalog/index.js";

describe("catalog meta", () => {
  it("expõe source e fetchedAt do índice oficial TOTVS", () => {
    expect(CATALOG_META.source).toMatch(/apitotvslegado/);
    expect(CATALOG_META.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CATALOG_META.count).toBe(KNOWN_DATASERVERS.length);
  });

  it("KNOWN_MODULES é não-vazio e contém módulos esperados", () => {
    expect(KNOWN_MODULES.length).toBeGreaterThan(10);
    expect(KNOWN_MODULES).toContain("Recursos Humanos");
    expect(KNOWN_MODULES).toContain("Educacional");
    expect(KNOWN_MODULES).toContain("Globais");
  });

  it("cada item tem name, description, module, released", () => {
    const sample = KNOWN_DATASERVERS[0];
    expect(sample).toBeDefined();
    expect(typeof sample!.name).toBe("string");
    expect(typeof sample!.description).toBe("string");
    expect(typeof sample!.module).toBe("string");
    expect(typeof sample!.released).toBe("boolean");
  });
});

describe("findDataServer", () => {
  it("acha por nome exato", () => {
    const ds = findDataServer("RhuPessoaData");
    expect(ds).toBeDefined();
    expect(ds?.module).toBe("Recursos Humanos");
    expect(ds?.released).toBe(true);
  });

  it("é case-insensitive", () => {
    expect(findDataServer("rhupessoadata")?.name).toBe("RhuPessoaData");
    expect(findDataServer("RHUPESSOADATA")?.name).toBe("RhuPessoaData");
  });

  it("retorna undefined para nome inexistente", () => {
    expect(findDataServer("XPTONaoExisteData")).toBeUndefined();
  });

  it("retorna undefined para string vazia", () => {
    expect(findDataServer("")).toBeUndefined();
  });
});

describe("searchDataServers", () => {
  it("filtra por module exato", () => {
    const rh = searchDataServers({ module: "Recursos Humanos" });
    expect(rh.length).toBeGreaterThan(0);
    expect(rh.every((d) => d.module === "Recursos Humanos")).toBe(true);
  });

  it("filtra por query no nome (case-insensitive)", () => {
    const matches = searchDataServers({ query: "pessoa" });
    expect(matches.length).toBeGreaterThan(3);
    expect(matches.some((d) => d.name === "RhuPessoaData")).toBe(true);
  });

  it("filtra por query na descrição", () => {
    const matches = searchDataServers({ query: "Áreas de conhecimento" });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("releasedOnly remove os não-liberados", () => {
    const all = searchDataServers({ query: "pessoa" });
    const released = searchDataServers({ query: "pessoa", releasedOnly: true });
    expect(released.length).toBeLessThan(all.length);
    expect(released.every((d) => d.released)).toBe(true);
  });

  it("respeita limit", () => {
    const r = searchDataServers({ limit: 5 });
    expect(r).toHaveLength(5);
  });

  it("combina module + query", () => {
    const r = searchDataServers({ module: "Recursos Humanos", query: "pessoa" });
    expect(r.every((d) => d.module === "Recursos Humanos")).toBe(true);
    expect(r.some((d) => d.name === "RhuPessoaData")).toBe(true);
  });

  it("sem opções retorna tudo", () => {
    const r = searchDataServers();
    expect(r).toHaveLength(KNOWN_DATASERVERS.length);
  });

  it("query inexistente retorna []", () => {
    expect(searchDataServers({ query: "zzznotexistzzz" })).toEqual([]);
  });

  it("module inexistente retorna []", () => {
    expect(searchDataServers({ module: "ModuloInexistente" })).toEqual([]);
  });
});
