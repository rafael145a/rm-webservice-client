import { RmConfigError } from "../errors/index.js";
import { extractResultXml } from "../rm/extract-result-xml.js";
import { parseRmDataset } from "../rm/parse-rm-dataset.js";
import { serializeContext } from "../rm/serialize-context.js";
import { serializeParameters } from "../rm/serialize-parameters.js";
import { callSoapOperation } from "../soap/call-soap-operation.js";

import type { RmAuth } from "../auth/auth-types.js";
import type { RmContext, Separator } from "../rm/types.js";
import type { ResolvedSoapService } from "../wsdl/wsdl-types.js";
import type {
  ConsultaSqlClient,
  ConsultaSqlOptions,
  ConsultaSqlWithContextOptions,
} from "../client/types.js";

export interface CreateConsultaSqlClientOptions {
  resolveService: () => Promise<ResolvedSoapService>;
  auth: RmAuth;
  timeoutMs?: number;
  defaultContext?: RmContext;
  contextSeparator?: Separator;
  parameterSeparator?: Separator;
}

export function createConsultaSqlClient(
  options: CreateConsultaSqlClientOptions,
): ConsultaSqlClient {
  const {
    resolveService,
    auth,
    timeoutMs,
    defaultContext,
    contextSeparator,
    parameterSeparator,
  } = options;

  async function call(operationName: string, body: Record<string, string | number | undefined>) {
    const svc = await resolveService();
    const op = svc.operations[operationName];
    if (!op) {
      throw new RmConfigError(
        `Operação "${operationName}" não encontrada no port "${svc.portName}".`,
      );
    }
    return callSoapOperation({
      endpointUrl: svc.endpointUrl,
      namespace: svc.targetNamespace,
      operationName,
      soapAction: op.soapAction,
      auth,
      body,
      timeoutMs,
    });
  }

  function parseList<T>(xml: string, resultElement: string, operationName: string): T[] {
    const inner = extractResultXml({
      soapXml: xml,
      resultElementName: resultElement,
      operationName,
    });
    return parseRmDataset<T>({ innerXml: inner, operationName });
  }

  return {
    async query<T = unknown>(opts: ConsultaSqlOptions): Promise<T[] | string> {
      const xml = await call("RealizarConsultaSQL", {
        codSentenca: opts.codSentenca,
        codColigada: opts.codColigada,
        codSistema: opts.codSistema,
        parameters: serializeParameters(opts.parameters, parameterSeparator),
      });

      if (opts.parseMode === "raw") return xml;

      if (opts.parseMode === "dataset") {
        const inner = extractResultXml({
          soapXml: xml,
          resultElementName: "RealizarConsultaSQLResult",
          operationName: "RealizarConsultaSQL",
        });
        return inner as unknown as T[];
      }

      return parseList<T>(xml, "RealizarConsultaSQLResult", "RealizarConsultaSQL");
    },

    async queryWithContext<T = unknown>(
      opts: ConsultaSqlWithContextOptions,
    ): Promise<T[] | string> {
      const xml = await call("RealizarConsultaSQLContexto", {
        codSentenca: opts.codSentenca,
        codColigada: opts.codColigada,
        codSistema: opts.codSistema,
        parameters: serializeParameters(opts.parameters, parameterSeparator),
        contexto: serializeContext(opts.context ?? defaultContext, contextSeparator),
      });

      if (opts.parseMode === "raw") return xml;

      if (opts.parseMode === "dataset") {
        const inner = extractResultXml({
          soapXml: xml,
          resultElementName: "RealizarConsultaSQLContextoResult",
          operationName: "RealizarConsultaSQLContexto",
        });
        return inner as unknown as T[];
      }

      return parseList<T>(
        xml,
        "RealizarConsultaSQLContextoResult",
        "RealizarConsultaSQLContexto",
      );
    },
  } as ConsultaSqlClient;
}
