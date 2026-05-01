/**
 * Catálogo de DataServers do TOTVS RM.
 *
 * Os dados vêm do índice público oficial da TOTVS
 * (https://apitotvslegado.z15.web.core.windows.net/) e são embutidos no
 * pacote como JSON. Use este módulo como subpath import:
 *
 * ```ts
 * import {
 *   KNOWN_DATASERVERS,
 *   findDataServer,
 *   searchDataServers,
 * } from "rm-webservice-client/catalog";
 * ```
 *
 * Importante: este catálogo lista o que **existe oficialmente no produto
 * RM**. Cada instância pode expor um subconjunto diferente — a única
 * verdade definitiva é `rm.dataServer.isValidDataServer(...)`.
 */
import catalogData from "./dataservers.json" with { type: "json" };

import type {
  CatalogMeta,
  KnownDataServer,
  SearchDataServersOptions,
} from "./types.js";

interface RawCatalog {
  source: string;
  fetchedAt: string;
  count: number;
  modules: readonly string[];
  dataServers: readonly KnownDataServer[];
}

const raw = catalogData as RawCatalog;

export const KNOWN_DATASERVERS: readonly KnownDataServer[] = raw.dataServers;

export const KNOWN_MODULES: readonly string[] = raw.modules;

export const CATALOG_META: CatalogMeta = {
  source: raw.source,
  fetchedAt: raw.fetchedAt,
  count: raw.count,
  modules: raw.modules,
};

export function findDataServer(name: string): KnownDataServer | undefined {
  if (!name) return undefined;
  const lc = name.toLowerCase();
  return KNOWN_DATASERVERS.find((d) => d.name.toLowerCase() === lc);
}

export function searchDataServers(
  options: SearchDataServersOptions = {},
): KnownDataServer[] {
  const { query, module, releasedOnly, limit } = options;
  const q = query?.trim().toLowerCase();
  const result: KnownDataServer[] = [];
  for (const ds of KNOWN_DATASERVERS) {
    if (module && ds.module !== module) continue;
    if (releasedOnly && !ds.released) continue;
    if (q && !ds.name.toLowerCase().includes(q) && !ds.description.toLowerCase().includes(q)) {
      continue;
    }
    result.push(ds);
    if (limit !== undefined && result.length >= limit) break;
  }
  return result;
}

export type {
  CatalogMeta,
  KnownDataServer,
  SearchDataServersOptions,
} from "./types.js";
