import { describe, it, expect } from "vitest";

import {
  resolveCliConfig,
  resolveWsdlCacheFromFlags,
} from "../../src/cli/load-config.js";
import { RmConfigError } from "../../src/errors/index.js";

describe("resolveCliConfig", () => {
  it("monta Basic auth a partir de env", () => {
    const cfg = resolveCliConfig({}, "dataServer", {
      RM_DATASERVER_WSDL: "/path/to.wsdl",
      RM_USER: "u",
      RM_PASSWORD: "p",
    });
    expect(cfg.wsdlUrl).toBe("/path/to.wsdl");
    expect(cfg.auth).toEqual({ type: "basic", username: "u", password: "p" });
  });

  it("flags têm precedência sobre env", () => {
    const cfg = resolveCliConfig(
      { wsdl: "flag.wsdl", user: "fu", password: "fp" },
      "dataServer",
      { RM_DATASERVER_WSDL: "env.wsdl", RM_USER: "envu", RM_PASSWORD: "envp" },
    );
    expect(cfg.wsdlUrl).toBe("flag.wsdl");
    expect(cfg.auth).toEqual({ type: "basic", username: "fu", password: "fp" });
  });

  it("monta Bearer auth quando bearer presente", () => {
    const cfg = resolveCliConfig({ bearer: "abc" }, "dataServer", {
      RM_DATASERVER_WSDL: "x",
    });
    expect(cfg.auth).toEqual({ type: "bearer", token: "abc" });
  });

  it("erro quando WSDL ausente", () => {
    expect(() => resolveCliConfig({}, "dataServer", {})).toThrow(RmConfigError);
  });

  it("erro quando credenciais ausentes", () => {
    expect(() =>
      resolveCliConfig({}, "dataServer", { RM_DATASERVER_WSDL: "x" }),
    ).toThrow(RmConfigError);
  });

  it("usa RM_CONSULTASQL_WSDL para serviço consultaSql", () => {
    const cfg = resolveCliConfig({}, "consultaSql", {
      RM_CONSULTASQL_WSDL: "sql.wsdl",
      RM_USER: "u",
      RM_PASSWORD: "p",
    });
    expect(cfg.wsdlUrl).toBe("sql.wsdl");
  });

  it("parseia timeout numérico", () => {
    const cfg = resolveCliConfig(
      { timeout: "5000" },
      "dataServer",
      { RM_DATASERVER_WSDL: "x", RM_USER: "u", RM_PASSWORD: "p" },
    );
    expect(cfg.timeoutMs).toBe(5000);
  });

  it("ignora timeout inválido", () => {
    const cfg = resolveCliConfig(
      { timeout: "abc" },
      "dataServer",
      { RM_DATASERVER_WSDL: "x", RM_USER: "u", RM_PASSWORD: "p" },
    );
    expect(cfg.timeoutMs).toBeUndefined();
  });

  it("liga wsdlCache por padrão na CLI", () => {
    const cfg = resolveCliConfig({}, "dataServer", {
      RM_DATASERVER_WSDL: "x",
      RM_USER: "u",
      RM_PASSWORD: "p",
    });
    expect(cfg.wsdlCache).toEqual({ enabled: true });
  });

  it("--no-wsdl-cache desliga (flag wsdlCache=false)", () => {
    const cfg = resolveCliConfig(
      { wsdlCache: false },
      "dataServer",
      { RM_DATASERVER_WSDL: "x", RM_USER: "u", RM_PASSWORD: "p" },
    );
    expect(cfg.wsdlCache).toBeUndefined();
  });

  it("RM_WSDL_CACHE=0 desliga via env", () => {
    const cfg = resolveCliConfig({}, "dataServer", {
      RM_DATASERVER_WSDL: "x",
      RM_USER: "u",
      RM_PASSWORD: "p",
      RM_WSDL_CACHE: "0",
    });
    expect(cfg.wsdlCache).toBeUndefined();
  });
});

describe("resolveWsdlCacheFromFlags", () => {
  it("retorna { enabled: true } sem overrides quando nada é passado", () => {
    expect(resolveWsdlCacheFromFlags({}, {})).toEqual({ enabled: true });
  });

  it("aplica TTL e dir vindos das flags", () => {
    const cache = resolveWsdlCacheFromFlags(
      { wsdlCacheTtl: "5000", wsdlCacheDir: "/tmp/c" },
      {},
    );
    expect(cache).toEqual({ enabled: true, ttlMs: 5000, dir: "/tmp/c" });
  });

  it("aplica TTL e dir vindos do env", () => {
    const cache = resolveWsdlCacheFromFlags(
      {},
      { RM_WSDL_CACHE_TTL_MS: "1000", RM_WSDL_CACHE_DIR: "/var/c" },
    );
    expect(cache).toEqual({ enabled: true, ttlMs: 1000, dir: "/var/c" });
  });

  it("flag tem precedência sobre env", () => {
    const cache = resolveWsdlCacheFromFlags(
      { wsdlCacheTtl: "9000" },
      { RM_WSDL_CACHE_TTL_MS: "1000" },
    );
    expect(cache).toEqual({ enabled: true, ttlMs: 9000 });
  });
});
