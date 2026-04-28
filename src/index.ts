export const VERSION = "0.1.0";

export { createRmClient } from "./client/create-rm-client.js";
export type {
  ConsultaSqlClient,
  ConsultaSqlOptions,
  ConsultaSqlWithContextOptions,
  DataServerClient,
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
export { loadWsdl, resolveWsdlService } from "./wsdl/index.js";

export {
  RmError,
  RmConfigError,
  RmHttpError,
  RmSoapFaultError,
  RmParseError,
  RmTimeoutError,
} from "./errors/index.js";
