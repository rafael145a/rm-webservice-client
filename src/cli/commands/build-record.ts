import { readFile, writeFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { RmConfigError } from "../../errors/rm-config-error.js";
import { resolveCliConfig, type CliGlobalFlags } from "../load-config.js";

import type { RmRecordsInput } from "../../schema/build-types.js";

export interface BuildRecordFlags extends CliGlobalFlags {
  fieldsJson?: string;
  fieldsFile?: string;
  context?: string;
  row?: string;
  out?: string;
  bypassValidation?: boolean;
  allowUnknown?: boolean;
}

/**
 * Comando `rmws build-record <DataServerName>`. Constrói o XML a ser
 * usado em `rmws save-record --xml-file ...` aproveitando o schema do
 * DataServer pra validar campos antes de chamar o RM.
 */
export async function buildRecordCommand(
  dataServerName: string,
  flags: BuildRecordFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (!flags.fieldsJson && !flags.fieldsFile) {
    throw new RmConfigError(
      "É obrigatório fornecer --fields-json '<json>' ou --fields-file <path> com os campos.",
    );
  }
  if (flags.fieldsJson && flags.fieldsFile) {
    throw new RmConfigError(
      "Use apenas um entre --fields-json e --fields-file, não os dois.",
    );
  }

  const raw = flags.fieldsJson
    ?? (await readFile(flags.fieldsFile as string, "utf8"));
  let fields: RmRecordsInput;
  try {
    fields = JSON.parse(raw) as RmRecordsInput;
  } catch (err) {
    throw new RmConfigError(
      `JSON inválido em fields: ${(err as Error).message}`,
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

  const xml = await rm.dataServer.buildRecord(dataServerName, fields, {
    ...(flags.row ? { rowName: flags.row } : {}),
    ...(flags.bypassValidation ? { bypassValidation: true } : {}),
    ...(flags.allowUnknown ? { allowUnknownFields: true } : {}),
    ...(flags.context ? { context: flags.context } : {}),
  });

  if (flags.out) {
    await writeFile(flags.out, xml, "utf8");
    return `XML escrito em ${flags.out}`;
  }
  return xml;
}

async function loadWsdlConfig(source: string) {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
