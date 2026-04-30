import {
  RmError,
  RmHttpError,
  RmSoapFaultError,
} from "../errors/index.js";

import type { ResolvedSoapService } from "../wsdl/wsdl-types.js";
import type {
  AuthenticateOptions,
  CheckConsultaSqlOptions,
  CheckDataServerOptions,
  ConsultaSqlClient,
  DataServerClient,
  DiagnosticReport,
  DiagnosticStep,
  DiagnosticsClient,
} from "../client/types.js";

const DEFAULT_PROBE_DATASERVER = "RmWsClient.DiagnosticProbe";

export interface CreateDiagnosticsClientOptions {
  dataServer: DataServerClient;
  consultaSql: ConsultaSqlClient;
  resolveDataServer?: () => Promise<ResolvedSoapService>;
  resolveConsultaSql?: () => Promise<ResolvedSoapService>;
}

export function createDiagnosticsClient(
  options: CreateDiagnosticsClientOptions,
): DiagnosticsClient {
  const { dataServer, consultaSql, resolveDataServer, resolveConsultaSql } = options;

  return {
    async checkDataServer(opts: CheckDataServerOptions = {}): Promise<DiagnosticReport> {
      const steps: DiagnosticStep[] = [];

      if (!resolveDataServer) {
        steps.push(missingServiceStep("dataServer"));
        return { service: "dataServer", ok: false, steps };
      }

      const resolveStep = await runStep("resolve-wsdl", async () => {
        const svc = await resolveDataServer();
        return {
          endpointUrl: svc.endpointUrl,
          portName: svc.portName,
          operations: Object.keys(svc.operations),
        };
      });
      steps.push(resolveStep);
      if (!resolveStep.ok) return { service: "dataServer", ok: false, steps };

      const probeName = opts.probeDataServerName ?? DEFAULT_PROBE_DATASERVER;
      const probeStep = await runStep("is-valid-data-server", async () => {
        const isValid = await dataServer.isValidDataServer({
          dataServerName: probeName,
        });
        return { probeDataServerName: probeName, isValid };
      });
      steps.push(probeStep);

      return { service: "dataServer", ok: probeStep.ok, steps };
    },

    async checkConsultaSql(
      opts: CheckConsultaSqlOptions = {},
    ): Promise<DiagnosticReport> {
      const steps: DiagnosticStep[] = [];

      if (!resolveConsultaSql) {
        steps.push(missingServiceStep("consultaSql"));
        return { service: "consultaSql", ok: false, steps };
      }

      const resolveStep = await runStep("resolve-wsdl", async () => {
        const svc = await resolveConsultaSql();
        return {
          endpointUrl: svc.endpointUrl,
          portName: svc.portName,
          operations: Object.keys(svc.operations),
        };
      });
      steps.push(resolveStep);
      if (!resolveStep.ok) return { service: "consultaSql", ok: false, steps };

      if (!opts.probe) {
        return { service: "consultaSql", ok: true, steps };
      }

      const probe = opts.probe;
      const probeStep = await runStep("realizar-consulta-sql", async () => {
        const records = probe.context
          ? await consultaSql.queryWithContext({
              codSentenca: probe.codSentenca,
              codColigada: probe.codColigada,
              codSistema: probe.codSistema,
              parameters: probe.parameters,
              context: probe.context,
            })
          : await consultaSql.query({
              codSentenca: probe.codSentenca,
              codColigada: probe.codColigada,
              codSistema: probe.codSistema,
              parameters: probe.parameters,
            });
        return {
          codSentenca: probe.codSentenca,
          recordCount: Array.isArray(records) ? records.length : 0,
        };
      });
      steps.push(probeStep);

      return { service: "consultaSql", ok: probeStep.ok, steps };
    },

    async authenticate(opts: AuthenticateOptions = {}): Promise<DiagnosticReport> {
      const steps: DiagnosticStep[] = [];

      if (!resolveDataServer) {
        steps.push(missingServiceStep("dataServer"));
        return { service: "auth", ok: false, steps };
      }

      const probeName = opts.probeDataServerName ?? DEFAULT_PROBE_DATASERVER;
      const step = await runStep("auth-probe", async () => {
        const isValid = await dataServer.isValidDataServer({
          dataServerName: probeName,
        });
        return { probeDataServerName: probeName, isValid };
      });

      const ok = step.ok || requestPassedAuthLayer(step);
      steps.push({ ...step, ok });

      return { service: "auth", ok, steps };
    },
  };
}

async function runStep(
  name: string,
  fn: () => Promise<Record<string, unknown> | undefined>,
): Promise<DiagnosticStep> {
  const start = Date.now();
  try {
    const details = await fn();
    return {
      name,
      ok: true,
      durationMs: Date.now() - start,
      ...(details !== undefined && Object.keys(details).length > 0 ? { details } : {}),
    };
  } catch (err) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - start,
      error: toStepError(err),
    };
  }
}

function toStepError(err: unknown): NonNullable<DiagnosticStep["error"]> {
  if (err instanceof RmHttpError) {
    return { code: err.code, message: err.message, status: err.status };
  }
  if (err instanceof RmSoapFaultError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.status !== undefined ? { status: err.status } : {}),
      ...(err.faultCode !== undefined ? { faultCode: err.faultCode } : {}),
      ...(err.faultString !== undefined ? { faultString: err.faultString } : {}),
    };
  }
  if (err instanceof RmError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "UNKNOWN", message: err.message };
  }
  return { code: "UNKNOWN", message: String(err) };
}

function missingServiceStep(serviceLabel: "dataServer" | "consultaSql"): DiagnosticStep {
  return {
    name: "resolve-wsdl",
    ok: false,
    durationMs: 0,
    error: {
      code: "RM_CONFIG_ERROR",
      message: `Serviço "${serviceLabel}" não foi configurado em createRmClient.`,
    },
  };
}

function requestPassedAuthLayer(step: DiagnosticStep): boolean {
  if (step.ok) return true;
  const error = step.error;
  if (!error) return false;
  if (error.code === "RM_HTTP_ERROR") {
    return error.status !== 401 && error.status !== 403;
  }
  return error.code === "RM_PARSE_ERROR" || error.code === "RM_SOAP_FAULT";
}
