import {
  RmConfigError,
  RmHttpError,
  RmParseError,
  RmSoapFaultError,
  RmTimeoutError,
} from "../errors/index.js";

export const EXIT_CODES = {
  CONFIG: 1,
  HTTP: 2,
  SOAP_FAULT: 3,
  PARSE: 4,
  TIMEOUT: 5,
  UNKNOWN: 99,
} as const;

export function exitCodeFor(err: unknown): number {
  if (err instanceof RmConfigError) return EXIT_CODES.CONFIG;
  if (err instanceof RmHttpError) return EXIT_CODES.HTTP;
  if (err instanceof RmSoapFaultError) return EXIT_CODES.SOAP_FAULT;
  if (err instanceof RmParseError) return EXIT_CODES.PARSE;
  if (err instanceof RmTimeoutError) return EXIT_CODES.TIMEOUT;
  return EXIT_CODES.UNKNOWN;
}
