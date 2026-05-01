import { describe, it, expect, vi } from "vitest";

import type * as OsModule from "node:os";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof OsModule>();
  return {
    ...actual,
    homedir: () => "",
  };
});

const { defaultCacheDir } = await import("../../src/wsdl/wsdl-cache.js");

describe("defaultCacheDir — fallback para tmpdir quando homedir vazio", () => {
  it("usa tmpdir() quando homedir() retorna string vazia (e XDG_CACHE_HOME não está setado)", () => {
    const originalXdg = process.env.XDG_CACHE_HOME;
    delete process.env.XDG_CACHE_HOME;
    try {
      const dir = defaultCacheDir();
      expect(dir).toMatch(/rm-webservice-client$/);
      expect(dir).not.toMatch(/^\/?$/);
    } finally {
      if (originalXdg !== undefined) process.env.XDG_CACHE_HOME = originalXdg;
    }
  });
});
