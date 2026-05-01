export const VERSION = "0.2.1";

export { createRmClient } from "./client/create-rm-client.js";
export type {
  AuthenticateOptions,
  CheckConsultaSqlOptions,
  CheckDataServerOptions,
  ConsultaSqlClient,
  ConsultaSqlOptions,
  ConsultaSqlWithContextOptions,
  DataServerClient,
  DiagnosticReport,
  DiagnosticStep,
  DiagnosticsClient,
  GetSchemaOptions,
  IsValidDataServerOptions,
  ParseModeArray,
  ParseModeRecord,
  ReadRecordOptions,
  ReadViewOptions,
  RmClient,
  RmClientOptions,
  RmSoapServiceOptions,
} from "./client/types.js";

export type { RmAuth } from "./auth/auth-types.js";
export type { RmContext, RmParameters, RmPrimitive, Separator } from "./rm/types.js";

export type { ResolvedSoapOperation, ResolvedSoapService } from "./wsdl/wsdl-types.js";
export { defaultCacheDir, loadWsdl, resolveWsdlService } from "./wsdl/index.js";
export type { WsdlCacheOptions } from "./wsdl/index.js";

export {
  RmError,
  RmConfigError,
  RmHttpError,
  RmSoapFaultError,
  RmParseError,
  RmTimeoutError,
} from "./errors/index.js";

export {
  NOOP_LOGGER,
  createConsoleLogger,
  redactHeaders,
  redactString,
} from "./logging/index.js";
export type {
  ConsoleLoggerOptions,
  LogLevel,
  LogPayload,
  RmLogger,
} from "./logging/index.js";
