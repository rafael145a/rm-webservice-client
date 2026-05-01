import { XMLParser } from "fast-xml-parser";

import { RmParseError } from "../errors/rm-parse-error.js";
import { ensureArray } from "../utils/ensure-array.js";

import type { RmDataServerSchema, RmFieldSchema, RmFieldTsType, RmRowSchema } from "./types.js";

/**
 * Parser de XSD inline retornado pelo TOTVS RM via `getSchema(...)`.
 *
 * O XSD costuma vir embrulhado num elemento `<{DatasetName}>...</{DatasetName}>`
 * (a "envelope" externa) seguido de `<xs:schema>`. O parser tolera ambos:
 * com ou sem o wrapper.
 *
 * Use junto com `getSchemaParsed(...)` no `DataServerClient`, ou direto
 * pra fluxos offline (geração de tipos a partir de XSDs commitados).
 */
export function parseXsdSchema(xml: string): RmDataServerSchema {
  if (!xml || !xml.trim()) {
    throw new RmParseError(
      "XSD vazio: parseXsdSchema requer um XML não vazio.",
      "GetSchema",
    );
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new RmParseError(
      `XSD inválido: ${(err as Error).message}`,
      "GetSchema",
    );
  }

  const schemaNode = findSchemaNode(parsed);
  if (!schemaNode) {
    throw new RmParseError(
      "Não encontrei <xs:schema> no XSD.",
      "GetSchema",
    );
  }

  const datasetEl = findDatasetElement(schemaNode);
  if (!datasetEl) {
    throw new RmParseError(
      "Não encontrei elemento com msdata:IsDataSet=true no XSD.",
      "GetSchema",
    );
  }

  const datasetName = getAttr(datasetEl, "name");
  if (!datasetName) {
    throw new RmParseError("Dataset sem atributo name no XSD.", "GetSchema");
  }

  const rowElements = ensureArray(
    pickPath(datasetEl, ["complexType", "choice", "element"]),
  );

  const rows: RmRowSchema[] = rowElements
    .map((el) => parseRow(el as Record<string, unknown>))
    .filter((r): r is RmRowSchema => r !== null);

  return { datasetName, rows };
}

function findSchemaNode(parsed: Record<string, unknown>): Record<string, unknown> | null {
  if ("schema" in parsed) {
    return asObjectOrEmpty(parsed.schema);
  }
  // Wrapper externo (`<DatasetName><xs:schema>...`); pega o primeiro filho com `schema`.
  for (const value of Object.values(parsed)) {
    if (
      value &&
      typeof value === "object" &&
      "schema" in (value as Record<string, unknown>)
    ) {
      return asObjectOrEmpty((value as Record<string, unknown>).schema);
    }
  }
  return null;
}

function asObjectOrEmpty(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  // `<xs:schema/>` ou `<xs:schema></xs:schema>` — fast-xml-parser devolve "".
  // Tratamos como objeto vazio pra cair no caminho "sem IsDataSet".
  return {};
}

function findDatasetElement(
  schemaNode: Record<string, unknown>,
): Record<string, unknown> | null {
  const elements = ensureArray(schemaNode.element);
  for (const el of elements) {
    if (typeof el !== "object" || el === null) continue;
    const isDataSet = getAttr(el as Record<string, unknown>, "IsDataSet");
    if (isDataSet === "true") {
      return el as Record<string, unknown>;
    }
  }
  return null;
}

function parseRow(el: Record<string, unknown>): RmRowSchema | null {
  const name = getAttr(el, "name");
  if (!name) return null;

  const fieldEls = ensureArray(
    pickPath(el, ["complexType", "sequence", "element"]),
  );
  const fields: RmFieldSchema[] = [];
  for (const f of fieldEls) {
    if (typeof f !== "object" || f === null) continue;
    const parsedField = parseField(f as Record<string, unknown>);
    if (parsedField) fields.push(parsedField);
  }

  return { name, fields };
}

function parseField(el: Record<string, unknown>): RmFieldSchema | null {
  const name = getAttr(el, "name");
  if (!name) return null;

  const optional = getAttr(el, "minOccurs") === "0";
  const caption = getAttr(el, "Caption");
  const defaultValue = getAttr(el, "default");

  let xsdType = getAttr(el, "type");
  let maxLength: number | undefined;

  // Quando o tipo está inline em <xs:simpleType><xs:restriction base="..."/>
  if (!xsdType) {
    const restriction = pickPath(el, ["simpleType", "restriction"]);
    if (restriction && typeof restriction === "object") {
      const r = restriction as Record<string, unknown>;
      xsdType = getAttr(r, "base") ?? undefined;
      const ml = pickPath(r, ["maxLength"]);
      if (ml && typeof ml === "object") {
        const value = getAttr(ml as Record<string, unknown>, "value");
        if (value) {
          const n = Number.parseInt(value, 10);
          if (Number.isFinite(n)) maxLength = n;
        }
      }
    }
  }

  // Default: xs:string. RM costuma omitir `type=` em campos string com restriction.
  if (!xsdType) xsdType = "xs:string";

  const tsType = mapXsdToTs(xsdType);

  const out: RmFieldSchema = { name, tsType, xsdType, optional };
  if (caption) out.caption = caption;
  if (defaultValue !== undefined) out.default = defaultValue;
  if (maxLength !== undefined) out.maxLength = maxLength;
  return out;
}

const NUMBER_TYPES = new Set([
  "xs:int",
  "xs:integer",
  "xs:short",
  "xs:long",
  "xs:byte",
  "xs:unsignedShort",
  "xs:unsignedInt",
  "xs:unsignedByte",
  "xs:unsignedLong",
  "xs:decimal",
  "xs:double",
  "xs:float",
]);

const BOOLEAN_TYPES = new Set(["xs:boolean"]);

function mapXsdToTs(xsdType: string): RmFieldTsType {
  if (NUMBER_TYPES.has(xsdType)) return "number";
  if (BOOLEAN_TYPES.has(xsdType)) return "boolean";
  // string: xs:string, xs:dateTime, xs:date, xs:time, xs:base64Binary,
  // xs:hexBinary, xs:anyURI, e tipos desconhecidos (fallback seguro).
  return "string";
}

function getAttr(node: Record<string, unknown>, name: string): string | undefined {
  const v = node[`@_${name}`];
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function pickPath(node: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = node;
  for (const segment of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}
