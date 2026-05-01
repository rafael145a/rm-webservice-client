import { RmConfigError } from "../errors/rm-config-error.js";
import { RmValidationError } from "../errors/rm-validation-error.js";
import { escapeXml } from "../utils/escape-xml.js";

import { validateRecord } from "./validate-record.js";

import type {
  BuildRecordOptions,
  RmFieldValue,
  RmRecordFields,
  RmRecordsInput,
} from "./build-types.js";
import type { RmDataServerSchema, RmFieldSchema, RmRowSchema } from "./types.js";

/**
 * Constrói o XML `<NewDataSet>...<RowName>...</RowName>...</NewDataSet>` que o RM
 * espera no `SaveRecord` / `DeleteRecord`. É o builder da 0.6.0 — opera **em
 * cima** do schema parseado pela 0.5.0.
 *
 * Validação default-strict: campos desconhecidos, obrigatórios faltando,
 * tipo errado e maxLength excedido viram `RmValidationError`. Use
 * `bypassValidation: true` pra abrir a porta do escape (com cuidado).
 *
 * Coerção de valores:
 * - `Date` → ISO 8601 (`toISOString()`).
 * - `boolean` → `"1"` / `"0"` (convenção TOTVS RM, mesmo em campos string).
 * - `number` → `String(n)`.
 * - `null` → emite `<Campo/>` (vazio explícito).
 * - `undefined` → omite o elemento.
 */
export function buildRecord(
  schema: RmDataServerSchema,
  fields: RmRecordsInput,
  options: BuildRecordOptions = {},
): string {
  const row = pickRow(schema, options.rowName);
  const records = Array.isArray(fields) ? fields : [fields];

  if (!options.bypassValidation) {
    const validateOpts = options.allowUnknownFields ? { allowUnknownFields: true } : {};
    const allIssues = records.flatMap((r) => validateRecord(row, r, validateOpts));
    if (allIssues.length > 0) {
      throw new RmValidationError(allIssues, `${schema.datasetName}/${row.name}`);
    }
  }

  const rowsXml = records.map((r) => renderRow(row, r)).join("");
  return `<NewDataSet>${rowsXml}</NewDataSet>`;
}

function pickRow(schema: RmDataServerSchema, requestedName?: string): RmRowSchema {
  if (!schema.rows.length) {
    throw new RmConfigError(
      `Schema ${schema.datasetName} não possui rows declaradas.`,
    );
  }
  if (!requestedName) return schema.rows[0]!;
  const found = schema.rows.find((r) => r.name === requestedName);
  if (!found) {
    const known = schema.rows.map((r) => r.name).join(", ");
    throw new RmConfigError(
      `Row "${requestedName}" não existe no schema ${schema.datasetName}. Rows disponíveis: ${known}.`,
    );
  }
  return found;
}

function renderRow(row: RmRowSchema, fields: RmRecordFields): string {
  const fieldByName = new Map(row.fields.map((f) => [f.name, f]));
  const parts: string[] = [];
  // Mantém ordem do schema; campos de fields fora do schema (apenas
  // possíveis com bypassValidation/allowUnknown) saem no fim.
  for (const def of row.fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, def.name)) continue;
    const value = fields[def.name];
    parts.push(renderField(def, value));
  }
  for (const key of Object.keys(fields)) {
    if (fieldByName.has(key)) continue;
    parts.push(renderUnknownField(key, fields[key]));
  }
  return `<${row.name}>${parts.join("")}</${row.name}>`;
}

function renderField(def: RmFieldSchema, value: RmFieldValue): string {
  if (value === undefined) return "";
  if (value === null) return `<${def.name}/>`;
  return `<${def.name}>${escapeXml(coerce(def, value))}</${def.name}>`;
}

function renderUnknownField(name: string, value: RmFieldValue): string {
  if (value === undefined) return "";
  if (value === null) return `<${name}/>`;
  return `<${name}>${escapeXml(stringifyAny(value))}</${name}>`;
}

function coerce(def: RmFieldSchema, value: Exclude<RmFieldValue, null | undefined>): string {
  if (def.tsType === "boolean") {
    if (typeof value === "boolean") return value ? "1" : "0";
    if (typeof value === "number") return value === 0 ? "0" : "1";
    if (typeof value === "string") {
      const v = value.toLowerCase();
      if (v === "true" || v === "1" || v === "t") return "1";
      if (v === "false" || v === "0" || v === "f") return "0";
      return value;
    }
  }
  if (def.tsType === "number") {
    if (typeof value === "boolean") return value ? "1" : "0";
    return String(value);
  }
  // string (inclui dateTime, date, time, base64Binary, etc.)
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function stringifyAny(value: Exclude<RmFieldValue, null | undefined>): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}
