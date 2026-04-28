import { createAuthHeader } from "../auth/create-auth-header.js";
import { RmHttpError } from "../errors/rm-http-error.js";
import { RmSoapFaultError } from "../errors/rm-soap-fault-error.js";
import { RmTimeoutError } from "../errors/rm-timeout-error.js";

import { createSoapEnvelope } from "./create-soap-envelope.js";
import { isSoapFault, parseSoapFault } from "./parse-soap-fault.js";

import type { RmAuth } from "../auth/auth-types.js";
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
  } = options;

  const envelope = createSoapEnvelope({ namespace, operationName, body, prefix });
  const authHeader = await createAuthHeader(auth);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${soapAction}"`,
        Authorization: authHeader,
      },
      body: envelope,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new RmTimeoutError(
        `Timeout (${timeoutMs}ms) ao chamar ${operationName} em ${endpointUrl}`,
        timeoutMs,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  if (isSoapFault(text)) {
    const fault = parseSoapFault(text);
    throw new RmSoapFaultError(
      `SOAP Fault em ${operationName}: ${fault.faultString ?? "(sem mensagem)"}`,
      { faultCode: fault.faultCode, faultString: fault.faultString, status: response.status },
    );
  }

  if (!response.ok) {
    const preview = text.slice(0, MAX_RESPONSE_PREVIEW_BYTES);
    throw new RmHttpError(
      `HTTP ${response.status} ao chamar ${operationName} em ${endpointUrl}`,
      response.status,
      preview,
    );
  }

  return text;
}
