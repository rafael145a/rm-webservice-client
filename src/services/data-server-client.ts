import { RmConfigError, RmParseError } from "../errors/index.js";
import { extractResultXml } from "../rm/extract-result-xml.js";
import { parseRmDataset } from "../rm/parse-rm-dataset.js";
import { serializeContext } from "../rm/serialize-context.js";
import { callSoapOperation } from "../soap/call-soap-operation.js";

import type { RmAuth } from "../auth/auth-types.js";
import type { RmLogger } from "../logging/types.js";
import type { RmContext, Separator } from "../rm/types.js";
import type { ResolvedSoapService } from "../wsdl/wsdl-types.js";
import type {
  DataServerClient,
  GetSchemaOptions,
  IsValidDataServerOptions,
  ReadRecordOptions,
  ReadViewOptions,
} from "../client/types.js";

export interface CreateDataServerClientOptions {
  resolveService: () => Promise<ResolvedSoapService>;
  auth: RmAuth;
  timeoutMs?: number;
  defaultContext?: RmContext;
  contextSeparator?: Separator;
  logger?: RmLogger;
  logBody?: boolean;
}

export function createDataServerClient(
  options: CreateDataServerClientOptions,
): DataServerClient {
  const {
    resolveService,
    auth,
    timeoutMs,
    defaultContext,
    contextSeparator,
    logger,
    logBody,
  } = options;

  async function call(operationName: string, body: Record<string, string | undefined>) {
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
      ...(logger ? { logger } : {}),
      ...(logBody !== undefined ? { logBody } : {}),
    });
  }

  function effectiveContext(ctx: RmContext | undefined): string | undefined {
    return serializeContext(ctx ?? defaultContext, contextSeparator);
  }

  function serializePrimaryKey(pk: ReadRecordOptions["primaryKey"]): string {
    if (Array.isArray(pk)) return pk.map((v) => String(v)).join(";");
    return String(pk);
  }

  return {
    async readView<T = unknown>(opts: ReadViewOptions): Promise<T[] | string> {
      const xml = await call("ReadView", {
        DataServerName: opts.dataServerName,
        Filtro: opts.filter,
        Contexto: effectiveContext(opts.context),
      });

      if (opts.parseMode === "raw") return xml;

      const inner = extractResultXml({
        soapXml: xml,
        resultElementName: "ReadViewResult",
        operationName: "ReadView",
      });

      if (opts.parseMode === "dataset") return inner as unknown as T[];
      return parseRmDataset<T>({ innerXml: inner, operationName: "ReadView" });
    },

    async readRecord<T = unknown>(opts: ReadRecordOptions): Promise<T | null | string> {
      const xml = await call("ReadRecord", {
        DataServerName: opts.dataServerName,
        PrimaryKey: serializePrimaryKey(opts.primaryKey),
        Contexto: effectiveContext(opts.context),
      });

      if (opts.parseMode === "raw") return xml;

      const inner = extractResultXml({
        soapXml: xml,
        resultElementName: "ReadRecordResult",
        operationName: "ReadRecord",
      });

      if (opts.parseMode === "dataset") return inner as unknown as T;

      const records = parseRmDataset<T>({
        innerXml: inner,
        operationName: "ReadRecord",
      });
      return records.length > 0 ? (records[0] as T) : null;
    },

    async getSchema(opts: GetSchemaOptions): Promise<string> {
      const xml = await call("GetSchema", {
        DataServerName: opts.dataServerName,
        Contexto: effectiveContext(opts.context),
      });
      return extractResultXml({
        soapXml: xml,
        resultElementName: "GetSchemaResult",
        operationName: "GetSchema",
      });
    },

    async isValidDataServer(opts: IsValidDataServerOptions): Promise<boolean> {
      const xml = await call("IsValidDataServer", {
        DataServerName: opts.dataServerName,
        Contexto: effectiveContext(opts.context),
      });
      const inner = extractResultXml({
        soapXml: xml,
        resultElementName: "IsValidDataServerResult",
        operationName: "IsValidDataServer",
      }).trim().toLowerCase();
      if (inner === "true") return true;
      if (inner === "false") return false;
      throw new RmParseError(
        `IsValidDataServerResult inesperado: "${inner}" (esperado "true" ou "false").`,
        "IsValidDataServer",
        "IsValidDataServerResult",
      );
    },
  } as DataServerClient;
}
