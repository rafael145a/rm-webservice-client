import { readFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { resolveCliConfig, type CliGlobalFlags } from "../load-config.js";

export interface ReadViewFlags extends CliGlobalFlags {
  filter?: string;
  context?: string;
}

export async function readViewCommand(
  dataServerName: string,
  flags: ReadViewFlags,
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
  });

  if (cfg.raw) {
    const raw = await rm.dataServer.readView({
      dataServerName,
      filter: flags.filter,
      context: flags.context,
      parseMode: "raw",
    });
    return raw as unknown as string;
  }

  const records = await rm.dataServer.readView({
    dataServerName,
    filter: flags.filter,
    context: flags.context,
  });
  return JSON.stringify(records, null, 2);
}

async function loadWsdlConfig(source: string) {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
