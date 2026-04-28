import { createConsultaSqlClient } from "../services/consulta-sql-client.js";
import { createDataServerClient } from "../services/data-server-client.js";

import { createServiceResolver } from "./resolve-service.js";

import type { RmClient, RmClientOptions } from "./types.js";

const TOTVS_NAMESPACE = "http://www.totvs.com/";

export function createRmClient(options: RmClientOptions): RmClient {
  const { services, auth, timeoutMs, defaults } = options;

  const resolveDataServer = createServiceResolver(services.dataServer, {
    serviceLabel: "dataServer",
    expectedPortName: "RM_IwsDataServer",
    defaultNamespace: TOTVS_NAMESPACE,
  });

  const resolveConsultaSql = createServiceResolver(services.consultaSql, {
    serviceLabel: "consultaSql",
    expectedPortName: "RM_IwsConsultaSQL",
    defaultNamespace: TOTVS_NAMESPACE,
  });

  const dataServer = createDataServerClient({
    resolveService: resolveDataServer,
    auth,
    timeoutMs,
    defaultContext: defaults?.context,
    contextSeparator: defaults?.contextSeparator,
  });

  const consultaSql = createConsultaSqlClient({
    resolveService: resolveConsultaSql,
    auth,
    timeoutMs,
    defaultContext: defaults?.context,
    contextSeparator: defaults?.contextSeparator,
    parameterSeparator: defaults?.parameterSeparator,
  });

  return {
    dataServer,
    consultaSql,
    async resolveServices() {
      const tasks: Array<Promise<unknown>> = [];
      if (services.dataServer) tasks.push(resolveDataServer());
      if (services.consultaSql) tasks.push(resolveConsultaSql());
      await Promise.all(tasks);
    },
  };
}
