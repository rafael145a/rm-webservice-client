import type {
  RmValidationIssue,
  RmValidationIssueKind,
} from "../errors/rm-validation-error.js";
import type { RmFieldValue, RmRecordFields } from "./build-types.js";
import type { RmFieldSchema, RmRowSchema } from "./types.js";

export interface ValidateRecordOptions {
  /** Quando false (default), campo desconhecido vira issue. */
  allowUnknownFields?: boolean;
}

/**
 * Valida um conjunto de campos contra o schema de uma row do RM.
 * Retorna lista de issues — vazia quando OK.
 *
 * Cobertura:
 * - `required`: campo `minOccurs!="0"` ausente (ou `undefined`).
 * - `unknown`: campo presente em fields mas não no schema (configurável).
 * - `type`: valor não bate com `xsdType` declarado.
 * - `maxLength`: string excedeu `xs:maxLength` da restriction.
 *
 * O builder usa essa função pra falhar **antes** de mandar o XML pro RM.
 */
export function validateRecord(
  row: RmRowSchema,
  fields: RmRecordFields,
  options: ValidateRecordOptions = {},
): RmValidationIssue[] {
  const issues: RmValidationIssue[] = [];
  const fieldByName = new Map(row.fields.map((f) => [f.name, f]));

  // 1) Campos desconhecidos
  if (!options.allowUnknownFields) {
    for (const key of Object.keys(fields)) {
      if (!fieldByName.has(key)) {
        issues.push({ field: key, kind: "unknown" });
      }
    }
  }

  // 2) Required ausentes
  for (const def of row.fields) {
    if (def.optional) continue;
    const present = Object.prototype.hasOwnProperty.call(fields, def.name);
    if (!present || fields[def.name] === undefined) {
      issues.push({ field: def.name, kind: "required" });
    }
  }

  // 3) Tipos + maxLength
  for (const def of row.fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, def.name)) continue;
    const value = fields[def.name];
    if (value === null || value === undefined) continue;
    const typeIssue = checkType(def, value);
    if (typeIssue) {
      issues.push(typeIssue);
      continue;
    }
    if (def.tsType === "string" && def.maxLength !== undefined) {
      const len = stringLength(value);
      if (len > def.maxLength) {
        issues.push({
          field: def.name,
          kind: "maxLength",
          expected: String(def.maxLength),
          got: String(len),
        });
      }
    }
  }

  return issues;
}

function checkType(
  def: RmFieldSchema,
  value: Exclude<RmFieldValue, null | undefined>,
): RmValidationIssue | null {
  switch (def.tsType) {
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) return null;
      if (typeof value === "boolean") return null; // RM usa xs:short como flag boolean
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return null;
      return makeTypeIssue(def, "number", value);
    }
    case "boolean": {
      if (typeof value === "boolean") return null;
      if (typeof value === "number" && (value === 0 || value === 1)) return null;
      if (
        typeof value === "string" &&
        ["true", "false", "0", "1", "T", "F"].includes(value)
      ) {
        return null;
      }
      return makeTypeIssue(def, "boolean", value);
    }
    case "string": {
      if (typeof value === "string") return null;
      if (typeof value === "number" || typeof value === "boolean") return null; // serão coercidos
      if (value instanceof Date) return null;
      return makeTypeIssue(def, "string", value);
    }
    default: {
      const _exhaustive: never = def.tsType;
      return _exhaustive;
    }
  }
}

function makeTypeIssue(
  def: RmFieldSchema,
  expected: string,
  value: unknown,
): RmValidationIssue {
  const out: RmValidationIssue = {
    field: def.name,
    kind: "type" as RmValidationIssueKind,
    expected,
    got: describeValue(value),
  };
  return out;
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value instanceof Date) return "Date";
  return typeof value;
}

function stringLength(value: Exclude<RmFieldValue, null | undefined>): number {
  if (typeof value === "string") return value.length;
  if (value instanceof Date) return value.toISOString().length;
  return String(value).length;
}
