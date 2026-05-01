import { RmConfigError, RmParseError } from "../errors/index.js";
import { assertRmResultOk } from "../rm/detect-result-error.js";
import { extractResultXml } from "../rm/extract-result-xml.js";
import { parseRmDataset } from "../rm/parse-rm-dataset.js";
import { serializeContext } from "../rm/serialize-context.js";
import { buildRecord as buildRecordPure } from "../schema/build-record.js";
import { parseXsdSchema } from "../schema/parse-xsd.js";
import { callSoapOperation } from "../soap/call-soap-operation.js";

import type { BuildRecordOptions, RmRecordsInput } from "../schema/build-types.js";
import type { RmDataServerSchema } from "../schema/types.js";

import type { RmAuth } from "../auth/auth-types.js";
import type { RmLogger } from "../logging/types.js";
import type { RmContext, Separator } from "../rm/types.js";
import type { ResolvedSoapService } from "../wsdl/wsdl-types.js";
import type {
  DataServerClient,
  DataServerNameInput,
  DeleteRecordByKeyOptions,
  DeleteRecordOptions,
  GetSchemaOptions,
  IsValidDataServerOptions,
  ReadLookupViewOptions,
  ReadRecordOptions,
  ReadViewOptions,
  SaveRecordOptions,
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

  // Cache de schema parseado por DataServerName (vida do client).
  const schemaCache = new Map<string, RmDataServerSchema>();
  async function loadSchema(
    dataServerName: DataServerNameInput,
    context: RmContext | undefined,
  ): Promise<RmDataServerSchema> {
    const cached = schemaCache.get(String(dataServerName));
    if (cached) return cached;
    const xml = await call("GetSchema", {
      DataServerName: dataServerName,
      Contexto: effectiveContext(context),
    });
    const inner = extractResultXml({
      soapXml: xml,
      resultElementName: "GetSchemaResult",
      operationName: "GetSchema",
    });
    const parsed = parseXsdSchema(inner);
    schemaCache.set(String(dataServerName), parsed);
    return parsed;
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

    async getSchemaParsed(opts: GetSchemaOptions) {
      const xsd = await this.getSchema(opts);
      return parseXsdSchema(xsd);
    },

    async saveRecord(opts: SaveRecordOptions): Promise<string> {
      if (opts.xml !== undefined && opts.fields !== undefined) {
        throw new RmConfigError(
          "saveRecord aceita 'xml' OU 'fields', não os dois.",
        );
      }
      let payloadXml: string;
      if (opts.fields !== undefined) {
        const schema = await loadSchema(opts.dataServerName, opts.context);
        payloadXml = buildRecordPure(schema, opts.fields, opts.build ?? {});
      } else if (opts.xml !== undefined) {
        payloadXml = opts.xml;
      } else {
        throw new RmConfigError(
          "saveRecord requer 'xml' ou 'fields'.",
        );
      }

      const xml = await call("SaveRecord", {
        DataServerName: opts.dataServerName,
        XML: payloadXml,
        Contexto: effectiveContext(opts.context),
      });

      if (opts.parseMode === "raw") return xml;

      const result = extractResultXml({
        soapXml: xml,
        resultElementName: "SaveRecordResult",
        operationName: "SaveRecord",
      });

      if (opts.parseMode === "result-strict") {
        return assertRmResultOk("SaveRecord", result);
      }
      return result;
    },

    async buildRecord(
      dataServerName: DataServerNameInput,
      fields: RmRecordsInput,
      options: (BuildRecordOptions & { context?: RmContext }) = {},
    ): Promise<string> {
      const { context, ...buildOpts } = options;
      const schema = await loadSchema(dataServerName, context);
      return buildRecordPure(schema, fields, buildOpts);
    },

    async deleteRecord(opts: DeleteRecordOptions): Promise<string> {
      const xml = await call("DeleteRecord", {
        DataServerName: opts.dataServerName,
        XML: opts.xml,
        Contexto: effectiveContext(opts.context),
      });

      if (opts.parseMode === "raw") return xml;

      const result = extractResultXml({
        soapXml: xml,
        resultElementName: "DeleteRecordResult",
        operationName: "DeleteRecord",
      });
      if (opts.parseMode === "result-strict") {
        return assertRmResultOk("DeleteRecord", result);
      }
      return result;
    },

    async deleteRecordByKey(opts: DeleteRecordByKeyOptions): Promise<string> {
      const xml = await call("DeleteRecordByKey", {
        DataServerName: opts.dataServerName,
        PrimaryKey: serializePrimaryKey(opts.primaryKey),
        Contexto: effectiveContext(opts.context),
      });

      if (opts.parseMode === "raw") return xml;

      const result = extractResultXml({
        soapXml: xml,
        resultElementName: "DeleteRecordByKeyResult",
        operationName: "DeleteRecordByKey",
      });
      if (opts.parseMode === "result-strict") {
        return assertRmResultOk("DeleteRecordByKey", result);
      }
      return result;
    },

    async readLookupView<T = unknown>(
      opts: ReadLookupViewOptions,
    ): Promise<T[] | string> {
      const xml = await call("ReadLookupView", {
        DataServerName: opts.dataServerName,
        Filtro: opts.filter,
        Contexto: effectiveContext(opts.context),
        OwnerData: opts.ownerData,
      });

      if (opts.parseMode === "raw") return xml;

      const inner = extractResultXml({
        soapXml: xml,
        resultElementName: "ReadLookupViewResult",
        operationName: "ReadLookupView",
      });

      if (opts.parseMode === "dataset") return inner as unknown as T[];
      return parseRmDataset<T>({ innerXml: inner, operationName: "ReadLookupView" });
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
