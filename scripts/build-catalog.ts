/**
 * Regenera src/catalog/dataservers.json a partir do índice oficial da TOTVS.
 *
 * Uso: `npx tsx scripts/build-catalog.ts`
 *
 * Fonte: https://apitotvslegado.z15.web.core.windows.net/ (catálogo público
 * de DataServers do RM, mantido pela TOTVS). O script faz scraping HTML —
 * se o layout mudar, a regex precisa ser atualizada.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://apitotvslegado.z15.web.core.windows.net/";
const HERE = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(HERE, "../src/catalog/dataservers.json");
const NAMES_DEST = resolve(HERE, "../src/catalog/known-names.ts");

interface KnownDataServer {
  name: string;
  description: string;
  module: string;
  released: boolean;
}

interface CatalogJson {
  source: string;
  fetchedAt: string;
  count: number;
  modules: string[];
  dataServers: KnownDataServer[];
}

async function main() {
  process.stderr.write(`Baixando ${SOURCE}…\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao baixar índice TOTVS`);
  }
  const html = await res.text();

  const dataServers: KnownDataServer[] = [];
  const blocks = html.split(/<h3>\s*<b>/);
  for (const block of blocks.slice(1)) {
    const mNome = block.match(/^([^<]+)<\/b>\s*<\/h3>/);
    if (!mNome?.[1]) continue;
    const modulo = mNome[1].trim();
    const re =
      /<tr>\s*<td>([^<]+)<\/td>\s*<td>\s*<a[^>]+Objeto=([A-Za-z0-9_]+)"[^>]*>[^<]+<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      const description = (m[1] ?? "").trim().replace(/\s+/g, " ");
      const name = m[2] ?? "";
      const tdLib = m[3] ?? "";
      const released = tdLib.includes("Sim<") || /^\s*Sim\s*</.test(tdLib);
      if (!name) continue;
      dataServers.push({ name, description, module: modulo, released });
    }
  }

  dataServers.sort(
    (a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name),
  );

  const out: CatalogJson = {
    source: SOURCE,
    fetchedAt: new Date().toISOString().slice(0, 10),
    count: dataServers.length,
    modules: [...new Set(dataServers.map((d) => d.module))].sort(),
    dataServers,
  };

  writeFileSync(DEST, JSON.stringify(out, null, 0));
  process.stderr.write(
    `Escrevi ${DEST} (${dataServers.length} DataServers, ${out.modules.length} módulos)\n`,
  );

  const sortedNames = [...new Set(dataServers.map((d) => d.name))].sort();
  const namesTs =
    `/** AUTO-GENERATED por scripts/build-catalog.ts — não edite à mão. */\n` +
    `/** Roda \`npm run build:catalog\` pra regenerar a partir do catálogo TOTVS. */\n\n` +
    `export type KnownDataServerName =\n` +
    sortedNames.map((n) => `  | "${n}"`).join("\n") +
    `;\n`;
  writeFileSync(NAMES_DEST, namesTs);
  process.stderr.write(
    `Escrevi ${NAMES_DEST} (${sortedNames.length} nomes únicos)\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`ERRO: ${(err as Error).message}\n`);
  process.exit(1);
});
