import type { RmAuth } from "../auth/auth-types.js";
import type { RmLogger } from "../logging/types.js";
import type { RmContext, RmParameters, Separator } from "../rm/types.js";

export interface RmSoapServiceOptions {
  wsdlUrl?: string;
  wsdlXml?: string;
  endpointUrl?: string;
  targetNamespace?: string;
  soapActions?: Record<string, string>;
}

export interface RmClientOptions {
  services: {
    dataServer?: RmSoapServiceOptions;
    consultaSql?: RmSoapServiceOptions;
  };
  auth: RmAuth;
  timeoutMs?: number;
  defaults?: {
    context?: RmContext;
    contextSeparator?: Separator;
    parameterSeparator?: Separator;
  };
  logger?: RmLogger;
  logBody?: boolean;
}

export type ParseModeArray = "raw" | "records" | "dataset";
export type ParseModeRecord = "raw" | "record" | "dataset";

export interface ReadViewOptions {
  dataServerName: string;
  filter?: string;
  context?: RmContext;
  parseMode?: ParseModeArray;
}

export interface ReadRecordOptions {
  dataServerName: string;
  primaryKey: string | number | Array<string | number>;
  context?: RmContext;
  parseMode?: ParseModeRecord;
}

export interface GetSchemaOptions {
  dataServerName: string;
  context?: RmContext;
}

export interface IsValidDataServerOptions {
  dataServerName: string;
  context?: RmContext;
}

export interface DataServerClient {
  readView<T = unknown>(options: ReadViewOptions): Promise<T[]>;
  readView(options: ReadViewOptions & { parseMode: "raw" }): Promise<string>;

  readRecord<T = unknown>(options: ReadRecordOptions): Promise<T | null>;
  readRecord(options: ReadRecordOptions & { parseMode: "raw" }): Promise<string>;

  getSchema(options: GetSchemaOptions): Promise<string>;

  isValidDataServer(options: IsValidDataServerOptions): Promise<boolean>;
}

export interface ConsultaSqlOptions {
  codSentenca: string;
  codColigada: number;
  codSistema: string;
  parameters?: RmParameters;
  parseMode?: ParseModeArray;
}

export interface ConsultaSqlWithContextOptions extends ConsultaSqlOptions {
  context?: RmContext;
}

export interface ConsultaSqlClient {
  query<T = unknown>(options: ConsultaSqlOptions): Promise<T[]>;
  query(options: ConsultaSqlOptions & { parseMode: "raw" }): Promise<string>;

  queryWithContext<T = unknown>(options: ConsultaSqlWithContextOptions): Promise<T[]>;
  queryWithContext(
    options: ConsultaSqlWithContextOptions & { parseMode: "raw" },
  ): Promise<string>;
}

export interface DiagnosticStep {
  name: string;
  ok: boolean;
  durationMs: number;
  details?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    status?: number;
    faultCode?: string;
    faultString?: string;
  };
}

export interface DiagnosticReport {
  service: "dataServer" | "consultaSql" | "auth";
  ok: boolean;
  steps: DiagnosticStep[];
}

export interface CheckDataServerOptions {
  probeDataServerName?: string;
}

export interface CheckConsultaSqlOptions {
  probe?: {
    codSentenca: string;
    codColigada: number;
    codSistema: string;
    parameters?: RmParameters;
    context?: RmContext;
  };
}

export interface AuthenticateOptions {
  probeDataServerName?: string;
}

export interface DiagnosticsClient {
  checkDataServer(options?: CheckDataServerOptions): Promise<DiagnosticReport>;
  checkConsultaSql(options?: CheckConsultaSqlOptions): Promise<DiagnosticReport>;
  authenticate(options?: AuthenticateOptions): Promise<DiagnosticReport>;
}

export interface RmClient {
  dataServer: DataServerClient;
  consultaSql: ConsultaSqlClient;
  diagnostics: DiagnosticsClient;
  resolveServices(): Promise<void>;
}
