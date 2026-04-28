import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
});

export interface SoapFault {
  faultCode?: string;
  faultString?: string;
}

export function isSoapFault(xml: string): boolean {
  return /<(?:[a-zA-Z0-9]+:)?Fault[\s>]/i.test(xml);
}

export function parseSoapFault(xml: string): SoapFault {
  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const envelope = (parsed.Envelope ?? parsed.envelope) as Record<string, unknown> | undefined;
    const body = envelope?.Body as Record<string, unknown> | undefined;
    const fault = body?.Fault as Record<string, unknown> | undefined;
    if (!fault) return {};

    const faultCode = pickString(fault, "faultcode", "Code");
    const faultString = pickString(fault, "faultstring", "Reason", "Detail");

    return { faultCode, faultString };
  } catch {
    return {};
  }
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
    if (v && typeof v === "object") {
      const nested = (v as Record<string, unknown>).Value;
      if (typeof nested === "string") return nested;
      const text = (v as Record<string, unknown>).Text;
      if (typeof text === "string") return text;
    }
  }
  return undefined;
}
