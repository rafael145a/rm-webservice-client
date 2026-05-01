export const VERSION = "1.0.0";

export { createRmClient } from "./client/create-rm-client.js";
export type {
  AuthenticateOptions,
  CheckConsultaSqlOptions,
  CheckDataServerOptions,
  ConsultaSqlClient,
  ConsultaSqlOptions,
  ConsultaSqlWithContextOptions,
  DataServerClient,
  DataServerNameInput,
  DeleteRecordByKeyOptions,
  DeleteRecordOptions,
  DiagnosticReport,
  DiagnosticStep,
  DiagnosticsClient,
  GetSchemaOptions,
  IsValidDataServerOptions,
  KnownDataServerName,
  ParseModeArray,
  ParseModeRecord,
  ParseModeSaveRecord,
  ReadLookupViewOptions,
  ReadRecordOptions,
  ReadViewOptions,
  RmClient,
  RmClientOptions,
  RmSoapServiceOptions,
  SaveRecordOptions,
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
  RmResultError,
  RmTimeoutError,
  RmValidationError,
} from "./errors/index.js";
export type {
  RmValidationIssue,
  RmValidationIssueKind,
} from "./errors/index.js";

export {
  assertRmResultOk,
  detectRmResultError,
} from "./rm/detect-result-error.js";
export type { DetectResultErrorMatch } from "./rm/detect-result-error.js";

export { parseXsdSchema } from "./schema/parse-xsd.js";
export { generateTypes } from "./schema/generate-types.js";
export type { GenerateTypesOptions } from "./schema/generate-types.js";
export { buildRecord } from "./schema/build-record.js";
export { validateRecord } from "./schema/validate-record.js";
export type { ValidateRecordOptions } from "./schema/validate-record.js";
export type {
  BuildRecordOptions,
  RmFieldValue,
  RmRecordFields,
  RmRecordsInput,
} from "./schema/build-types.js";
export type {
  RmDataServerSchema,
  RmFieldSchema,
  RmFieldTsType,
  RmRowSchema,
} from "./schema/types.js";

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
