import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cacheFilePath,
  defaultCacheDir,
  readCachedWsdl,
  resolveCacheConfig,
  writeCachedWsdl,
} from "../../src/wsdl/wsdl-cache.js";
import { loadWsdl } from "../../src/wsdl/load-wsdl.js";

describe("wsdl-cache helpers", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rmws-cache-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolveCacheConfig aplica defaults", () => {
    const cfg = resolveCacheConfig({ enabled: true });
    expect(cfg.dir).toBe(defaultCacheDir());
    expect(cfg.ttlMs).toBe(24 * 60 * 60 * 1000);
  });

  it("resolveCacheConfig respeita overrides", () => {
    const cfg = resolveCacheConfig({ enabled: true, dir, ttlMs: 1000 });
    expect(cfg.dir).toBe(dir);
    expect(cfg.ttlMs).toBe(1000);
  });

  it("cacheFilePath produz nome estável a partir da URL", () => {
    const a = cacheFilePath(dir, "https://rm.example.com/wsDataServer/MEX?wsdl");
    const b = cacheFilePath(dir, "https://rm.example.com/wsDataServer/MEX?wsdl");
    const c = cacheFilePath(dir, "https://outro.example.com/?wsdl");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith(dir)).toBe(true);
    expect(a.endsWith(".wsdl")).toBe(true);
  });

  it("readCachedWsdl retorna null quando arquivo não existe (miss)", async () => {
    const result = await readCachedWsdl(
      "https://rm.example.com/?wsdl",
      { dir, ttlMs: 1000 },
    );
    expect(result).toBeNull();
  });

  it("writeCachedWsdl + readCachedWsdl: roundtrip (hit)", async () => {
    const url = "https://rm.example.com/?wsdl";
    const xml = "<wsdl:definitions/>";
    await writeCachedWsdl(url, xml, { dir, ttlMs: 60_000 });
    const result = await readCachedWsdl(url, { dir, ttlMs: 60_000 });
    expect(result).toBe(xml);
  });

  it("readCachedWsdl retorna null quando expirado", async () => {
    const url = "https://rm.example.com/?wsdl";
    const xml = "<wsdl:definitions/>";
    await writeCachedWsdl(url, xml, { dir, ttlMs: 60_000 });

    const path = cacheFilePath(dir, url);
    const past = new Date(Date.now() - 10 * 60_000);
    utimesSync(path, past, past);

    const result = await readCachedWsdl(url, { dir, ttlMs: 1000 });
    expect(result).toBeNull();
  });

  it("readCachedWsdl retorna null e loga warn quando readFile falha por não-ENOENT", async () => {
    const url = "https://rm.example.com/?wsdl";
    const path = cacheFilePath(dir, url);
    mkdirSync(path);

    const events: Array<{ level: string; event: string }> = [];
    const logger = {
      debug: (event: string) => events.push({ level: "debug", event }),
      info: (event: string) => events.push({ level: "info", event }),
      warn: (event: string) => events.push({ level: "warn", event }),
      error: (event: string) => events.push({ level: "error", event }),
    };

    const result = await readCachedWsdl(url, { dir, ttlMs: 60_000 }, logger);
    expect(result).toBeNull();
    expect(events.some((e) => e.event === "wsdl.cache.read-error")).toBe(true);
  });

  it("writeCachedWsdl tolera falha de mkdir e loga warn", async () => {
    const conflict = join(dir, "arquivo-bloqueando");
    writeFileSync(conflict, "x");
    const cacheDir = join(conflict, "subdir");

    const events: Array<{ level: string; event: string }> = [];
    const logger = {
      debug: (event: string) => events.push({ level: "debug", event }),
      info: (event: string) => events.push({ level: "info", event }),
      warn: (event: string) => events.push({ level: "warn", event }),
      error: (event: string) => events.push({ level: "error", event }),
    };

    await writeCachedWsdl(
      "https://rm.example.com/?wsdl",
      "<x/>",
      { dir: cacheDir, ttlMs: 60_000 },
      logger,
    );
    expect(events.some((e) => e.event === "wsdl.cache.write-error")).toBe(true);
  });

  it("readCachedWsdl e writeCachedWsdl funcionam sem logger explícito (default NOOP)", async () => {
    const url = "https://rm.example.com/?wsdl";
    await writeCachedWsdl(url, "<x/>", { dir, ttlMs: 60_000 });
    const result = await readCachedWsdl(url, { dir, ttlMs: 60_000 });
    expect(result).toBe("<x/>");
  });

  it("defaultCacheDir respeita XDG_CACHE_HOME quando definido", () => {
    const originalXdg = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = "/tmp/xdg-test-cache";
    try {
      expect(defaultCacheDir()).toBe("/tmp/xdg-test-cache/rm-webservice-client");
    } finally {
      if (originalXdg === undefined) {
        delete process.env.XDG_CACHE_HOME;
      } else {
        process.env.XDG_CACHE_HOME = originalXdg;
      }
    }
  });

  it("readCachedWsdl loga miss/hit/expired via logger", async () => {
    const events: Array<{ level: string; event: string }> = [];
    const logger = {
      debug: (event: string) => events.push({ level: "debug", event }),
      info: (event: string) => events.push({ level: "info", event }),
      warn: (event: string) => events.push({ level: "warn", event }),
      error: (event: string) => events.push({ level: "error", event }),
    };
    const url = "https://rm.example.com/?wsdl";

    await readCachedWsdl(url, { dir, ttlMs: 1000 }, logger);
    expect(events.some((e) => e.event === "wsdl.cache.miss")).toBe(true);

    await writeCachedWsdl(url, "<x/>", { dir, ttlMs: 60_000 }, logger);
    expect(events.some((e) => e.event === "wsdl.cache.write")).toBe(true);

    await readCachedWsdl(url, { dir, ttlMs: 60_000 }, logger);
    expect(events.some((e) => e.event === "wsdl.cache.hit")).toBe(true);
  });
});

describe("loadWsdl + cache integration", () => {
  let dir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rmws-cache-int-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it("primeira chamada faz fetch e grava cache; segunda lê do disco", async () => {
    const xml = "<wsdl:definitions/>";
    const fetchSpy = vi.fn(async () => new Response(xml, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const url = "https://rm.example.com/wsDataServer/MEX?wsdl";
    const cache = { enabled: true, dir, ttlMs: 60_000 };

    const first = await loadWsdl({ wsdlUrl: url, cache });
    const second = await loadWsdl({ wsdlUrl: url, cache });

    expect(first).toBe(xml);
    expect(second).toBe(xml);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("cache desligado não toca em disco", async () => {
    const xml = "<wsdl:definitions/>";
    const fetchSpy = vi.fn(async () => new Response(xml, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const url = "https://rm.example.com/?wsdl";

    await loadWsdl({ wsdlUrl: url, cache: { enabled: false, dir } });
    await loadWsdl({ wsdlUrl: url, cache: { enabled: false, dir } });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const path = cacheFilePath(dir, url);
    const cached = await readCachedWsdl(url, { dir, ttlMs: 60_000 });
    expect(cached).toBeNull();
    expect(path.startsWith(dir)).toBe(true);
  });

  it("cache expirado refaz fetch e regrava", async () => {
    const xml1 = "<wsdl:v1/>";
    const xml2 = "<wsdl:v2/>";
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(xml1, { status: 200 }))
      .mockResolvedValueOnce(new Response(xml2, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const url = "https://rm.example.com/?wsdl";
    const cache = { enabled: true, dir, ttlMs: 60_000 };

    const first = await loadWsdl({ wsdlUrl: url, cache });
    expect(first).toBe(xml1);

    const path = cacheFilePath(dir, url);
    const past = new Date(Date.now() - 10 * 60_000);
    utimesSync(path, past, past);

    const second = await loadWsdl({
      wsdlUrl: url,
      cache: { enabled: true, dir, ttlMs: 1000 },
    });
    expect(second).toBe(xml2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
