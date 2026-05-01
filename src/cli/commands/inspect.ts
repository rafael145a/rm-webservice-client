import { readFile } from "node:fs/promises";

import { RmConfigError } from "../../errors/rm-config-error.js";
import { loadWsdl } from "../../wsdl/load-wsdl.js";
import { resolveWsdlService } from "../../wsdl/resolve-wsdl-service.js";

import { resolveWsdlCacheFromFlags, type CliGlobalFlags } from "../load-config.js";

const PORTS_BY_SERVICE: Record<string, string> = {
  dataserver: "RM_IwsDataServer",
  sql: "RM_IwsConsultaSQL",
  consultasql: "RM_IwsConsultaSQL",
};

export async function inspectCommand(
  service: string,
  flags: CliGlobalFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const portName = PORTS_BY_SERVICE[service.toLowerCase()];
  if (!portName) {
    throw new RmConfigError(
      `Serviço "${service}" desconhecido. Use "dataserver" ou "sql".`,
    );
  }

  const wsdlEnvKey =
    portName === "RM_IwsDataServer" ? "RM_DATASERVER_WSDL" : "RM_CONSULTASQL_WSDL";

  const wsdlSource = flags.wsdl ?? env[wsdlEnvKey];
  if (!wsdlSource) {
    throw new RmConfigError(
      `WSDL não fornecido. Use --wsdl <url|path> ou defina ${wsdlEnvKey}.`,
    );
  }

  const wsdlCache = resolveWsdlCacheFromFlags(flags, env);
  const wsdlXml = await fetchWsdl(wsdlSource, wsdlCache);
  const resolved = resolveWsdlService({ wsdlXml, expectedPortName: portName });

  return JSON.stringify(
    {
      serviceName: resolved.serviceName,
      portName: resolved.portName,
      endpointUrl: resolved.endpointUrl,
      targetNamespace: resolved.targetNamespace,
      soapVersion: resolved.soapVersion,
      operations: resolved.operations,
    },
    null,
    2,
  );
}

async function fetchWsdl(
  source: string,
  cache: ReturnType<typeof resolveWsdlCacheFromFlags>,
): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    return loadWsdl({ wsdlUrl: source, ...(cache ? { cache } : {}) });
  }
  return readFile(source, "utf8");
}
