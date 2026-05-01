import { readFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { RmConfigError } from "../../errors/rm-config-error.js";
import { resolveCliConfig, type CliGlobalFlags } from "../load-config.js";

export interface DeleteRecordByKeyFlags extends CliGlobalFlags {
  context?: string;
  strict?: boolean;
}

export async function deleteRecordByKeyCommand(
  dataServerName: string,
  primaryKey: string | undefined,
  flags: DeleteRecordByKeyFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (!primaryKey) {
    throw new RmConfigError(
      "É obrigatório fornecer a chave primária. Use chave composta separada por vírgula: '1,abc'.",
    );
  }

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

  const pk = primaryKey.includes(",")
    ? primaryKey.split(",").map((p) => p.trim())
    : primaryKey;

  if (cfg.raw) {
    return rm.dataServer.deleteRecordByKey({
      dataServerName,
      primaryKey: pk,
      context: flags.context,
      parseMode: "raw",
    });
  }

  return rm.dataServer.deleteRecordByKey({
    dataServerName,
    primaryKey: pk,
    context: flags.context,
    parseMode: flags.strict ? "result-strict" : "result",
  });
}

async function loadWsdlConfig(source: string) {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
