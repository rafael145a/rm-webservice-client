import { RmParseError } from "../errors/rm-parse-error.js";

export interface ExtractResultXmlOptions {
  soapXml: string;
  resultElementName: string;
  operationName: string;
}

export function extractResultXml(options: ExtractResultXmlOptions): string {
  const { soapXml, resultElementName, operationName } = options;

  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${escapeRegex(resultElementName)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${escapeRegex(resultElementName)}>`,
  );
  const match = soapXml.match(re);
  if (!match || match[1] === undefined) {
    throw new RmParseError(
      `Elemento <${resultElementName}> não encontrado na resposta de ${operationName}.`,
      operationName,
      resultElementName,
    );
  }

  const raw = match[1].trim();

  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata && cdata[1] !== undefined) {
    return cdata[1];
  }

  return decodeXmlEntities(raw);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
