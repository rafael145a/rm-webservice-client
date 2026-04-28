import { escapeXml } from "../utils/escape-xml.js";

export type SoapBodyValue = string | number | boolean | null | undefined;
export type SoapBody = Record<string, SoapBodyValue>;

export interface CreateSoapEnvelopeOptions {
  namespace: string;
  operationName: string;
  body: SoapBody;
  prefix?: string;
}

export function createSoapEnvelope(options: CreateSoapEnvelopeOptions): string {
  const { namespace, operationName, body, prefix = "tot" } = options;

  const bodyXml = Object.entries(body)
    .map(([key, value]) => renderField(prefix, key, value))
    .filter((s): s is string => s !== null)
    .join("");

  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:${prefix}="${namespace}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<${prefix}:${operationName}>` +
    bodyXml +
    `</${prefix}:${operationName}>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

function renderField(prefix: string, key: string, value: SoapBodyValue): string | null {
  if (value === undefined) return null;
  if (value === null) return `<${prefix}:${key}/>`;
  const stringValue = typeof value === "boolean" ? String(value) : String(value);
  return `<${prefix}:${key}>${escapeXml(stringValue)}</${prefix}:${key}>`;
}
