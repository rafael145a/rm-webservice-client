import { createAuthHeader } from "../auth/create-auth-header.js";
import { RmHttpError } from "../errors/rm-http-error.js";
import { RmSoapFaultError } from "../errors/rm-soap-fault-error.js";
import { RmTimeoutError } from "../errors/rm-timeout-error.js";
import { NOOP_LOGGER } from "../logging/no-op-logger.js";
import { redactHeaders, redactString } from "../logging/redact.js";

import { createSoapEnvelope } from "./create-soap-envelope.js";
import { isSoapFault, parseSoapFault } from "./parse-soap-fault.js";

import type { RmAuth } from "../auth/auth-types.js";
import type { RmLogger } from "../logging/types.js";
import type { SoapBody } from "./create-soap-envelope.js";

export interface CallSoapOperationOptions {
  endpointUrl: string;
  namespace: string;
  operationName: string;
  soapAction: string;
  auth: RmAuth;
  body: SoapBody;
  timeoutMs?: number;
  prefix?: string;
  logger?: RmLogger;
  logBody?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_PREVIEW_BYTES = 4096;

export async function callSoapOperation(options: CallSoapOperationOptions): Promise<string> {
  const {
    endpointUrl,
    namespace,
    operationName,
    soapAction,
    auth,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    prefix,
    logger = NOOP_LOGGER,
    logBody = false,
  } = options;

  const envelope = createSoapEnvelope({ namespace, operationName, body, prefix });
  const authHeader = await createAuthHeader(auth);

  const headers = {
    "Content-Type": "text/xml; charset=utf-8",
    SOAPAction: `"${soapAction}"`,
    Authorization: authHeader,
  };

  const startedAt = Date.now();
  logger.debug("soap.request", {
    url: endpointUrl,
    operationName,
    soapAction,
    headers: redactHeaders(headers),
    bodyBytes: envelope.length,
    ...(logBody ? { body: redactString(envelope) } : {}),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: envelope,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as { name?: string }).name === "AbortError") {
      const timeoutErr = new RmTimeoutError(
        `Timeout (${timeoutMs}ms) ao chamar ${operationName} em ${endpointUrl}`,
        timeoutMs,
      );
      logger.error("soap.error", {
        url: endpointUrl,
        operationName,
        code: timeoutErr.code,
        message: timeoutErr.message,
        durationMs: Date.now() - startedAt,
      });
      throw timeoutErr;
    }
    logger.error("soap.error", {
      url: endpointUrl,
      operationName,
      code: "FETCH_ERROR",
      message: (err as Error).message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
  clearTimeout(timer);

  const text = await response.text();
  const durationMs = Date.now() - startedAt;

  logger.debug("soap.response", {
    url: endpointUrl,
    operationName,
    status: response.status,
    durationMs,
    bodyBytes: text.length,
    ...(logBody ? { body: redactString(text) } : {}),
  });

  if (isSoapFault(text)) {
    const fault = parseSoapFault(text);
    const faultErr = new RmSoapFaultError(
      `SOAP Fault em ${operationName}: ${fault.faultString ?? "(sem mensagem)"}`,
      { faultCode: fault.faultCode, faultString: fault.faultString, status: response.status },
    );
    logger.error("soap.error", {
      url: endpointUrl,
      operationName,
      code: faultErr.code,
      status: response.status,
      faultCode: fault.faultCode,
      faultString: fault.faultString,
      durationMs,
    });
    throw faultErr;
  }

  if (!response.ok) {
    const preview = text.slice(0, MAX_RESPONSE_PREVIEW_BYTES);
    const httpErr = new RmHttpError(
      `HTTP ${response.status} ao chamar ${operationName} em ${endpointUrl}`,
      response.status,
      preview,
    );
    logger.error("soap.error", {
      url: endpointUrl,
      operationName,
      code: httpErr.code,
      status: response.status,
      durationMs,
    });
    throw httpErr;
  }

  return text;
}
