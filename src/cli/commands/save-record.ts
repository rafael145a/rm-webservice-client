import { readFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { RmConfigError } from "../../errors/rm-config-error.js";
import { resolveCliConfig, type CliGlobalFlags } from "../load-config.js";

export interface SaveRecordFlags extends CliGlobalFlags {
  xml?: string;
  xmlFile?: string;
  context?: string;
}

export async function saveRecordCommand(
  dataServerName: string,
  flags: SaveRecordFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (!flags.xml && !flags.xmlFile) {
    throw new RmConfigError(
      "É obrigatório fornecer --xml <conteúdo> ou --xml-file <path> com o dataset a gravar.",
    );
  }
  if (flags.xml && flags.xmlFile) {
    throw new RmConfigError(
      "Use apenas um entre --xml e --xml-file, não os dois.",
    );
  }

  const xml = flags.xml ?? (await readFile(flags.xmlFile as string, "utf8"));

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

  if (cfg.raw) {
    return rm.dataServer.saveRecord({
      dataServerName,
      xml,
      context: flags.context,
      parseMode: "raw",
    });
  }

  return rm.dataServer.saveRecord({
    dataServerName,
    xml,
    context: flags.context,
  });
}

async function loadWsdlConfig(source: string) {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
