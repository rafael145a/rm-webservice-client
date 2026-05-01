import { createConsultaSqlClient } from "../services/consulta-sql-client.js";
import { createDataServerClient } from "../services/data-server-client.js";
import { createDiagnosticsClient } from "../services/diagnostics-client.js";

import { createServiceResolver } from "./resolve-service.js";

import type { RmClient, RmClientOptions } from "./types.js";

const TOTVS_NAMESPACE = "http://www.totvs.com/";

export function createRmClient(options: RmClientOptions): RmClient {
  const { services, auth, timeoutMs, defaults, logger, logBody, wsdlCache } = options;

  const resolveDataServer = createServiceResolver(services.dataServer, {
    serviceLabel: "dataServer",
    expectedPortName: "RM_IwsDataServer",
    defaultNamespace: TOTVS_NAMESPACE,
    ...(logger ? { logger } : {}),
    ...(wsdlCache ? { cache: wsdlCache } : {}),
  });

  const resolveConsultaSql = createServiceResolver(services.consultaSql, {
    serviceLabel: "consultaSql",
    expectedPortName: "RM_IwsConsultaSQL",
    defaultNamespace: TOTVS_NAMESPACE,
    ...(logger ? { logger } : {}),
    ...(wsdlCache ? { cache: wsdlCache } : {}),
  });

  const dataServer = createDataServerClient({
    resolveService: resolveDataServer,
    auth,
    timeoutMs,
    defaultContext: defaults?.context,
    contextSeparator: defaults?.contextSeparator,
    ...(logger ? { logger } : {}),
    ...(logBody !== undefined ? { logBody } : {}),
  });

  const consultaSql = createConsultaSqlClient({
    resolveService: resolveConsultaSql,
    auth,
    timeoutMs,
    defaultContext: defaults?.context,
    contextSeparator: defaults?.contextSeparator,
    parameterSeparator: defaults?.parameterSeparator,
    ...(logger ? { logger } : {}),
    ...(logBody !== undefined ? { logBody } : {}),
  });

  const diagnostics = createDiagnosticsClient({
    dataServer,
    consultaSql,
    resolveDataServer: services.dataServer ? resolveDataServer : undefined,
    resolveConsultaSql: services.consultaSql ? resolveConsultaSql : undefined,
  });

  return {
    dataServer,
    consultaSql,
    diagnostics,
    async resolveServices() {
      const tasks: Array<Promise<unknown>> = [];
      if (services.dataServer) tasks.push(resolveDataServer());
      if (services.consultaSql) tasks.push(resolveConsultaSql());
      await Promise.all(tasks);
    },
  };
}
