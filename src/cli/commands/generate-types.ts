import { readFile, writeFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { generateTypes } from "../../schema/generate-types.js";
import { resolveCliConfig, type CliGlobalFlags } from "../load-config.js";

export interface GenerateTypesFlags extends CliGlobalFlags {
  out?: string;
  context?: string;
}

/**
 * Comando `rmws generate-types <DataServerName>`. Busca o schema do
 * DataServer no RM, parseia, e gera código TS com `interface` por row
 * + agregadora. Sem `--out`, imprime no stdout.
 */
export async function generateTypesCommand(
  dataServerName: string,
  flags: GenerateTypesFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const cfg = resolveCliConfig(flags, "dataServer", env);
  const wsdlConfig = await loadWsdlConfig(cfg.wsdlUrl as string);

  const rm = createRmClient({
    services: { dataServer: wsdlConfig },
    auth: cfg.auth,
    timeoutMs: cfg.timeoutMs,
    ...(cfg.logger ? { logger: cfg.logger } : {}),
    ...(cfg.logBody !== undefined ? { logBody: cfg.logBody } : {}),
    ...(cfg.wsdlCache ? { wsdlCache: cfg.wsdlCache } : {}),
  });

  const schema = await rm.dataServer.getSchemaParsed({
    dataServerName,
    context: flags.context,
  });

  const banner = `Source: ${dataServerName} (rmws generate-types)`;
  const code = generateTypes(schema, { banner });

  if (flags.out) {
    await writeFile(flags.out, code, "utf8");
    return `Tipos escritos em ${flags.out}`;
  }
  return code;
}

async function loadWsdlConfig(source: string) {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
