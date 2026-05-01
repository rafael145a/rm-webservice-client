import {
  CATALOG_META,
  KNOWN_MODULES,
  searchDataServers,
} from "../../catalog/index.js";

import type { CliGlobalFlags } from "../load-config.js";

export interface CatalogFlags extends CliGlobalFlags {
  module?: string;
  search?: string;
  released?: boolean;
  limit?: number | string;
  json?: boolean;
  modules?: boolean;
}

export function catalogCommand(flags: CatalogFlags): string {
  if (flags.modules) {
    if (flags.json) return JSON.stringify(KNOWN_MODULES, null, 2);
    return KNOWN_MODULES.join("\n");
  }

  const limit = parseLimit(flags.limit);
  const opts = {
    ...(flags.module ? { module: flags.module } : {}),
    ...(flags.search ? { query: flags.search } : {}),
    ...(flags.released ? { releasedOnly: true } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
  const items = searchDataServers(opts);

  if (flags.json) {
    return JSON.stringify(
      { meta: CATALOG_META, count: items.length, items },
      null,
      2,
    );
  }

  if (items.length === 0) {
    return `(nenhum DataServer encontrado — fonte: ${CATALOG_META.source})`;
  }

  const lines = items.map(
    (d) =>
      `${d.released ? "✓" : " "} [${d.module}] ${d.name} — ${d.description}`,
  );
  return lines.join("\n");
}

function parseLimit(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}
