import { RmConfigError } from "../errors/rm-config-error.js";
import { createConsoleLogger } from "../logging/console-logger.js";

import type { RmAuth } from "../auth/auth-types.js";
import type { LogLevel, RmLogger } from "../logging/types.js";
import type { WsdlCacheOptions } from "../wsdl/wsdl-cache.js";

export interface CliGlobalFlags {
  wsdl?: string;
  user?: string;
  password?: string;
  bearer?: string;
  timeout?: number | string;
  raw?: boolean;
  quiet?: boolean;
  logLevel?: string;
  logBody?: boolean;
  wsdlCache?: boolean;
  wsdlCacheTtl?: number | string;
  wsdlCacheDir?: string;
}

export interface ResolvedCliConfig {
  wsdlUrl?: string;
  auth: RmAuth;
  timeoutMs?: number;
  raw: boolean;
  quiet: boolean;
  logger?: RmLogger;
  logBody?: boolean;
  wsdlCache?: WsdlCacheOptions;
}

export type ServiceLabel = "dataServer" | "consultaSql";

const ENV_WSDL: Record<ServiceLabel, string> = {
  dataServer: "RM_DATASERVER_WSDL",
  consultaSql: "RM_CONSULTASQL_WSDL",
};

const VALID_LEVELS: ReadonlyArray<LogLevel> = ["debug", "info", "warn", "error"];

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
  const logger = buildLoggerFromFlags(flags, env);
  const wsdlCache = resolveWsdlCacheFromFlags(flags, env);

  return {
    wsdlUrl,
    auth,
    timeoutMs,
    raw: Boolean(flags.raw),
    quiet: Boolean(flags.quiet),
    ...(logger ? { logger } : {}),
    ...(flags.logBody ? { logBody: true } : {}),
    ...(wsdlCache ? { wsdlCache } : {}),
  };
}

export function resolveWsdlCacheFromFlags(
  flags: CliGlobalFlags,
  env: NodeJS.ProcessEnv = process.env,
): WsdlCacheOptions | undefined {
  const explicitDisable =
    flags.wsdlCache === false || env.RM_WSDL_CACHE === "0" || env.RM_WSDL_CACHE === "false";
  if (explicitDisable) return undefined;

  const ttlMs = parseTimeout(flags.wsdlCacheTtl ?? env.RM_WSDL_CACHE_TTL_MS);
  const dir = flags.wsdlCacheDir ?? env.RM_WSDL_CACHE_DIR;

  return {
    enabled: true,
    ...(ttlMs !== undefined ? { ttlMs } : {}),
    ...(dir ? { dir } : {}),
  };
}

export function buildLoggerFromFlags(
  flags: CliGlobalFlags,
  env: NodeJS.ProcessEnv = process.env,
): RmLogger | undefined {
  const raw = flags.logLevel ?? env.RM_LOG_LEVEL;
  if (!raw) return undefined;
  const level = raw.toLowerCase() as LogLevel;
  if (!VALID_LEVELS.includes(level)) {
    throw new RmConfigError(
      `--log-level inválido: "${raw}". Use ${VALID_LEVELS.join(", ")}.`,
    );
  }
  return createConsoleLogger({ level });
}

function parseTimeout(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}
