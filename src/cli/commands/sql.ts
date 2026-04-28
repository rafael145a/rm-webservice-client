import { readFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { RmConfigError } from "../../errors/rm-config-error.js";
import { resolveCliConfig, type CliGlobalFlags } from "../load-config.js";

export interface SqlFlags extends CliGlobalFlags {
  coligada?: number | string;
  sistema?: string;
  params?: string;
  context?: string;
}

export async function sqlCommand(
  codSentenca: string,
  flags: SqlFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const cfg = resolveCliConfig(flags, "consultaSql", env);

  const codColigada = parseColigada(flags.coligada);
  const codSistema = flags.sistema;
  if (!codSistema) {
    throw new RmConfigError("Flag --sistema é obrigatória.");
  }

  const wsdlConfig = await loadWsdlConfig(cfg.wsdlUrl as string);
  const rm = createRmClient({
    services: { consultaSql: wsdlConfig },
    auth: cfg.auth,
    timeoutMs: cfg.timeoutMs,
  });

  const baseOpts = {
    codSentenca,
    codColigada,
    codSistema,
    parameters: flags.params,
  } as const;

  if (cfg.raw) {
    const raw = flags.context
      ? await rm.consultaSql.queryWithContext({
          ...baseOpts,
          context: flags.context,
          parseMode: "raw",
        })
      : await rm.consultaSql.query({ ...baseOpts, parseMode: "raw" });
    return raw as unknown as string;
  }

  const records = flags.context
    ? await rm.consultaSql.queryWithContext({ ...baseOpts, context: flags.context })
    : await rm.consultaSql.query(baseOpts);
  return JSON.stringify(records, null, 2);
}

function parseColigada(value: number | string | undefined): number {
  if (value === undefined || value === "") {
    throw new RmConfigError("Flag --coligada é obrigatória.");
  }
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    throw new RmConfigError(`--coligada inválido: ${value}`);
  }
  return n;
}

async function loadWsdlConfig(source: string) {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
