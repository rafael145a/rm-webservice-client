import {
  RmConfigError,
  RmHttpError,
  RmParseError,
  RmResultError,
  RmSoapFaultError,
  RmTimeoutError,
  RmValidationError,
} from "../errors/index.js";

export const EXIT_CODES = {
  CONFIG: 1,
  HTTP: 2,
  SOAP_FAULT: 3,
  PARSE: 4,
  TIMEOUT: 5,
  RESULT: 6,
  VALIDATION: 7,
  UNKNOWN: 99,
} as const;

export function exitCodeFor(err: unknown): number {
  if (err instanceof RmConfigError) return EXIT_CODES.CONFIG;
  if (err instanceof RmHttpError) return EXIT_CODES.HTTP;
  if (err instanceof RmSoapFaultError) return EXIT_CODES.SOAP_FAULT;
  if (err instanceof RmParseError) return EXIT_CODES.PARSE;
  if (err instanceof RmTimeoutError) return EXIT_CODES.TIMEOUT;
  if (err instanceof RmResultError) return EXIT_CODES.RESULT;
  if (err instanceof RmValidationError) return EXIT_CODES.VALIDATION;
  return EXIT_CODES.UNKNOWN;
}

export function exitCodeForCode(code: string): number {
  switch (code) {
    case "RM_CONFIG_ERROR":
      return EXIT_CODES.CONFIG;
    case "RM_HTTP_ERROR":
      return EXIT_CODES.HTTP;
    case "RM_SOAP_FAULT":
      return EXIT_CODES.SOAP_FAULT;
    case "RM_PARSE_ERROR":
      return EXIT_CODES.PARSE;
    case "RM_TIMEOUT":
      return EXIT_CODES.TIMEOUT;
    case "RM_RESULT_ERROR":
      return EXIT_CODES.RESULT;
    case "RM_VALIDATION_ERROR":
      return EXIT_CODES.VALIDATION;
    default:
      return EXIT_CODES.UNKNOWN;
  }
}
