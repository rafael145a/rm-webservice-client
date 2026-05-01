import type {
  RmDataServerSchema,
  RmFieldSchema,
  RmRowSchema,
} from "./types.js";

export interface GenerateTypesOptions {
  /** Comentário extra no banner (ex.: nome do arquivo, comando que gerou). */
  banner?: string;
}

/**
 * Gera código TypeScript com `interface` por row + interface agregadora do
 * dataset. Saída é determinística (mesma entrada → mesma saída).
 *
 * **Importante**: tipos gerados são auxiliares, não fonte de verdade. O
 * RM pode validar campos por regras `.NET` que o XSD não expressa
 * (ex.: `RhuPessoaData` exige CEP/DTNASCIMENTO/ESTADONATAL como custom
 * validation, mesmo que o schema diga `minOccurs="0"`). Use as interfaces
 * geradas só como guia de DX; a fonte da verdade continua sendo o
 * `IsValidDataServer` + tentativa real.
 */
export function generateTypes(
  schema: RmDataServerSchema,
  options: GenerateTypesOptions = {},
): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * AUTO-GENERATED — não edite à mão.`);
  lines.push(` * Dataset: ${schema.datasetName}`);
  if (options.banner) lines.push(` * ${options.banner}`);
  lines.push(
    ` * Gerado por rm-webservice-client/schema (rmws generate-types).`,
  );
  lines.push(` */`);
  lines.push("");

  for (const row of schema.rows) {
    lines.push(...renderRowInterface(row));
    lines.push("");
  }

  lines.push(...renderDatasetInterface(schema));
  lines.push("");

  return lines.join("\n");
}

function renderRowInterface(row: RmRowSchema): string[] {
  const out: string[] = [];
  out.push(`/** Row \`${row.name}\` do dataset (${row.fields.length} campos). */`);
  out.push(`export interface ${sanitizeIdentifier(row.name)} {`);
  for (const field of row.fields) {
    out.push(...renderField(field));
  }
  out.push(`}`);
  return out;
}

function renderField(field: RmFieldSchema): string[] {
  const out: string[] = [];
  const docs: string[] = [];
  if (field.caption) docs.push(field.caption);
  const meta: string[] = [];
  if (field.xsdType) meta.push(`@xsdType ${field.xsdType}`);
  if (field.maxLength !== undefined) meta.push(`@maxLength ${field.maxLength}`);
  if (field.default !== undefined && field.default !== "") {
    meta.push(`@default ${field.default}`);
  }
  if (docs.length > 0 || meta.length > 0) {
    out.push(`  /**`);
    for (const d of docs) out.push(`   * ${d}`);
    if (docs.length > 0 && meta.length > 0) out.push(`   *`);
    for (const m of meta) out.push(`   * ${m}`);
    out.push(`   */`);
  }
  const optional = field.optional ? "?" : "";
  out.push(`  ${sanitizeIdentifier(field.name)}${optional}: ${field.tsType};`);
  return out;
}

function renderDatasetInterface(schema: RmDataServerSchema): string[] {
  const out: string[] = [];
  out.push(
    `/** Dataset \`${schema.datasetName}\` agregando todas as rows declaradas. */`,
  );
  out.push(`export interface ${sanitizeIdentifier(schema.datasetName)} {`);
  for (const row of schema.rows) {
    const id = sanitizeIdentifier(row.name);
    out.push(`  ${id}?: ${id}[];`);
  }
  out.push(`}`);
  return out;
}

const RESERVED = new Set([
  "default",
  "delete",
  "function",
  "class",
  "const",
  "let",
  "var",
  "interface",
  "import",
  "export",
  "in",
  "for",
  "while",
  "do",
  "if",
  "else",
  "switch",
  "case",
  "break",
  "return",
  "void",
  "null",
  "undefined",
  "true",
  "false",
  "new",
  "typeof",
  "instanceof",
]);

function sanitizeIdentifier(raw: string): string {
  // Substitui qualquer caractere não-identificador por `_`.
  let id = raw.replace(/[^A-Za-z0-9_]/g, "_");
  // Identificador não pode começar com dígito.
  if (/^[0-9]/.test(id)) id = `_${id}`;
  // Reserved word collision: prefixa.
  if (RESERVED.has(id)) id = `_${id}`;
  return id;
}
