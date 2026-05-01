import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { NOOP_LOGGER } from "../logging/no-op-logger.js";

import type { RmLogger } from "../logging/types.js";

export interface WsdlCacheOptions {
  enabled: boolean;
  ttlMs?: number;
  dir?: string;
}

export interface ResolvedCacheConfig {
  dir: string;
  ttlMs: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function defaultCacheDir(): string {
  const base = process.env.XDG_CACHE_HOME ?? join(homedir() || tmpdir(), ".cache");
  return join(base, "rm-webservice-client");
}

export function resolveCacheConfig(options: WsdlCacheOptions): ResolvedCacheConfig {
  return {
    dir: options.dir ?? defaultCacheDir(),
    ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
  };
}

export function cacheFilePath(dir: string, url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
  return join(dir, `${hash}.wsdl`);
}

export async function readCachedWsdl(
  url: string,
  config: ResolvedCacheConfig,
  logger: RmLogger = NOOP_LOGGER,
): Promise<string | null> {
  const path = cacheFilePath(config.dir, url);
  try {
    const info = await stat(path);
    const ageMs = Date.now() - info.mtimeMs;
    if (ageMs > config.ttlMs) {
      logger.debug("wsdl.cache.expired", { url, path, ageMs, ttlMs: config.ttlMs });
      return null;
    }
    const xml = await readFile(path, "utf8");
    logger.debug("wsdl.cache.hit", { url, path, ageMs, bytes: xml.length });
    return xml;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      logger.debug("wsdl.cache.miss", { url, path });
      return null;
    }
    logger.warn("wsdl.cache.read-error", {
      url,
      path,
      message: (err as Error).message,
    });
    return null;
  }
}

export async function writeCachedWsdl(
  url: string,
  xml: string,
  config: ResolvedCacheConfig,
  logger: RmLogger = NOOP_LOGGER,
): Promise<void> {
  const path = cacheFilePath(config.dir, url);
  try {
    await mkdir(config.dir, { recursive: true });
    await writeFile(path, xml, "utf8");
    logger.debug("wsdl.cache.write", { url, path, bytes: xml.length });
  } catch (err) {
    logger.warn("wsdl.cache.write-error", {
      url,
      path,
      message: (err as Error).message,
    });
  }
}
