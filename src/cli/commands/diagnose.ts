import { readFile } from "node:fs/promises";

import { createRmClient } from "../../client/create-rm-client.js";
import { RmConfigError } from "../../errors/rm-config-error.js";

import { exitCodeForCode } from "../exit-codes.js";
import {
  buildLoggerFromFlags,
  resolveWsdlCacheFromFlags,
  type CliGlobalFlags,
} from "../load-config.js";

import type { RmAuth } from "../../auth/auth-types.js";
import type {
  DiagnosticReport,
  RmSoapServiceOptions,
} from "../../client/types.js";

export type DiagnoseTarget = "dataserver" | "sql" | "auth" | "all";

export interface DiagnoseFlags extends CliGlobalFlags {
  wsdlDataserver?: string;
  wsdlSql?: string;
  probeDataserver?: string;
  probeCodsentenca?: string;
  probeColigada?: number | string;
  probeSistema?: string;
  probeParams?: string;
  probeContext?: string;
}

export interface DiagnoseResult {
  stdout: string;
  exitCode: number;
}

export async function diagnoseCommand(
  target: string | undefined,
  flags: DiagnoseFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DiagnoseResult> {
  const normalizedTarget = normalizeTarget(target);
  const auth = resolveAuth(flags, env);

  const dataServerWsdl = flags.wsdlDataserver ?? flags.wsdl ?? env.RM_DATASERVER_WSDL;
  const consultaSqlWsdl = flags.wsdlSql ?? flags.wsdl ?? env.RM_CONSULTASQL_WSDL;

  const services: {
    dataServer?: RmSoapServiceOptions;
    consultaSql?: RmSoapServiceOptions;
  } = {};
  if (dataServerWsdl) services.dataServer = await loadWsdlConfig(dataServerWsdl);
  if (consultaSqlWsdl) services.consultaSql = await loadWsdlConfig(consultaSqlWsdl);

  ensureRequiredServicesForTarget(normalizedTarget, services);

  const logger = buildLoggerFromFlags(flags, env);
  const wsdlCache = resolveWsdlCacheFromFlags(flags, env);
  const rm = createRmClient({
    services,
    auth,
    timeoutMs: parseTimeout(flags.timeout ?? env.RM_TIMEOUT_MS),
    ...(logger ? { logger } : {}),
    ...(flags.logBody ? { logBody: true } : {}),
    ...(wsdlCache ? { wsdlCache } : {}),
  });

  const reports: DiagnosticReport[] = [];

  if (normalizedTarget === "dataserver" || normalizedTarget === "all") {
    if (services.dataServer) {
      reports.push(
        await rm.diagnostics.checkDataServer({
          ...(flags.probeDataserver ? { probeDataServerName: flags.probeDataserver } : {}),
        }),
      );
    }
  }

  if (normalizedTarget === "sql" || normalizedTarget === "all") {
    if (services.consultaSql) {
      const probe = buildSqlProbe(flags);
      reports.push(
        await rm.diagnostics.checkConsultaSql(probe ? { probe } : {}),
      );
    }
  }

  if (normalizedTarget === "auth" || normalizedTarget === "all") {
    if (services.dataServer) {
      reports.push(
        await rm.diagnostics.authenticate({
          ...(flags.probeDataserver ? { probeDataServerName: flags.probeDataserver } : {}),
        }),
      );
    }
  }

  const stdout = JSON.stringify(reports, null, 2);
  const exitCode = computeExitCode(reports);
  return { stdout, exitCode };
}

function normalizeTarget(target: string | undefined): DiagnoseTarget {
  const value = (target ?? "all").toLowerCase();
  if (value === "dataserver" || value === "data-server") return "dataserver";
  if (value === "sql" || value === "consultasql") return "sql";
  if (value === "auth") return "auth";
  if (value === "all") return "all";
  throw new RmConfigError(
    `Target "${target}" desconhecido. Use "dataserver", "sql", "auth" ou "all".`,
  );
}

function resolveAuth(flags: DiagnoseFlags, env: NodeJS.ProcessEnv): RmAuth {
  const bearer = flags.bearer ?? env.RM_BEARER_TOKEN;
  if (bearer) return { type: "bearer", token: bearer };

  const user = flags.user ?? env.RM_USER;
  if (user) {
    return {
      type: "basic",
      username: user,
      password: flags.password ?? env.RM_PASSWORD ?? "",
    };
  }

  throw new RmConfigError(
    "Credenciais não fornecidas. Use --user/--password ou --bearer (ou RM_USER/RM_PASSWORD/RM_BEARER_TOKEN).",
  );
}

function ensureRequiredServicesForTarget(
  target: DiagnoseTarget,
  services: { dataServer?: unknown; consultaSql?: unknown },
): void {
  if ((target === "dataserver" || target === "auth") && !services.dataServer) {
    throw new RmConfigError(
      "WSDL do dataServer não fornecido. Use --wsdl-dataserver, --wsdl, ou defina RM_DATASERVER_WSDL.",
    );
  }
  if (target === "sql" && !services.consultaSql) {
    throw new RmConfigError(
      "WSDL do ConsultaSQL não fornecido. Use --wsdl-sql, --wsdl, ou defina RM_CONSULTASQL_WSDL.",
    );
  }
  if (target === "all" && !services.dataServer && !services.consultaSql) {
    throw new RmConfigError(
      "Nenhum WSDL fornecido. Defina RM_DATASERVER_WSDL e/ou RM_CONSULTASQL_WSDL.",
    );
  }
}

function buildSqlProbe(flags: DiagnoseFlags) {
  if (!flags.probeCodsentenca) return undefined;

  const codColigada = parseInt(String(flags.probeColigada ?? ""), 10);
  if (!Number.isFinite(codColigada)) {
    throw new RmConfigError(
      "--probe-coligada é obrigatório quando --probe-codsentenca é informado.",
    );
  }
  if (!flags.probeSistema) {
    throw new RmConfigError(
      "--probe-sistema é obrigatório quando --probe-codsentenca é informado.",
    );
  }

  return {
    codSentenca: flags.probeCodsentenca,
    codColigada,
    codSistema: flags.probeSistema,
    ...(flags.probeParams ? { parameters: flags.probeParams } : {}),
    ...(flags.probeContext ? { context: flags.probeContext } : {}),
  };
}

function computeExitCode(reports: DiagnosticReport[]): number {
  for (const report of reports) {
    if (report.ok) continue;
    for (const step of report.steps) {
      if (step.error?.code) return exitCodeForCode(step.error.code);
    }
    return 99;
  }
  return 0;
}

function parseTimeout(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

async function loadWsdlConfig(source: string): Promise<RmSoapServiceOptions> {
  if (/^https?:\/\//i.test(source)) {
    return { wsdlUrl: source };
  }
  return { wsdlXml: await readFile(source, "utf8") };
}
