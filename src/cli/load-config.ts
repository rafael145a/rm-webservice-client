import { RmConfigError } from "../errors/rm-config-error.js";

import type { RmAuth } from "../auth/auth-types.js";

export interface CliGlobalFlags {
  wsdl?: string;
  user?: string;
  password?: string;
  bearer?: string;
  timeout?: number | string;
  raw?: boolean;
  quiet?: boolean;
}

export interface ResolvedCliConfig {
  wsdlUrl?: string;
  auth: RmAuth;
  timeoutMs?: number;
  raw: boolean;
  quiet: boolean;
}

export type ServiceLabel = "dataServer" | "consultaSql";

const ENV_WSDL: Record<ServiceLabel, string> = {
  dataServer: "RM_DATASERVER_WSDL",
  consultaSql: "RM_CONSULTASQL_WSDL",
};

export function resolveCliConfig(
  flags: CliGlobalFlags,
  service: ServiceLabel,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedCliConfig {
  const wsdlUrl = flags.wsdl ?? env[ENV_WSDL[service]];
  if (!wsdlUrl) {
    throw new RmConfigError(
      `WSDL não fornecido. Use --wsdl <url> ou defina ${ENV_WSDL[service]}.`,
    );
  }

  const bearer = flags.bearer ?? env.RM_BEARER_TOKEN;
  const user = flags.user ?? env.RM_USER;
  const password = flags.password ?? env.RM_PASSWORD;

  let auth: RmAuth;
  if (bearer) {
    auth = { type: "bearer", token: bearer };
  } else if (user) {
    auth = { type: "basic", username: user, password: password ?? "" };
  } else {
    throw new RmConfigError(
      "Credenciais não fornecidas. Use --user/--password ou --bearer (ou RM_USER/RM_PASSWORD/RM_BEARER_TOKEN).",
    );
  }

  const timeoutMs = parseTimeout(flags.timeout ?? env.RM_TIMEOUT_MS);

  return {
    wsdlUrl,
    auth,
    timeoutMs,
    raw: Boolean(flags.raw),
    quiet: Boolean(flags.quiet),
  };
}

function parseTimeout(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}
