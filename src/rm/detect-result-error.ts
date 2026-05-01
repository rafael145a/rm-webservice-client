import { RmResultError } from "../errors/rm-result-error.js";

/**
 * Padrões que indicam erro embutido no `<SaveRecordResult>` ou
 * `<DeleteRecordResult>`. Observados empiricamente em produção (TOTVS RM
 * Cloud, escola educacional). Veja
 * `memory/project_rm_savecord_quirks.md` para o histórico.
 */
const ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  /Violação de chave/i,
  /violation/i,
  /====+/, // separador típico do RM (.NET)
  /\bat RM\./, // stack trace .NET
  /obrigatório/i,
  /preenchido\(s\)/i,
  /FOREIGN KEY constraint/i,
  /The (INSERT|UPDATE|DELETE) statement conflict/i,
  /Possíveis causas:/i,
];

/** Quando a string ultrapassa esse tamanho, presume erro com stack. */
const SHORT_RESULT_BYTES = 200;

export interface DetectResultErrorMatch {
  /** Mensagem principal (primeira linha não vazia, sem CRLF/CR). */
  summary: string;
  /** Trecho `INSERT/UPDATE/DELETE` extraído entre os blocos `===`. */
  sql?: string;
  /** Stack trace .NET (`at RM.Lib...`). */
  stack?: string;
}

/**
 * Detecta se um `<...Result>` decodificado é, na verdade, um erro
 * embutido pelo RM. Retorna `null` quando o conteúdo parece um resultado
 * de sucesso (string curta sem padrões de erro).
 *
 * Heurística:
 * - String com algum padrão de erro conhecido → erro.
 * - String curta (< 200 bytes) sem padrões → sucesso (PK gerado, etc.).
 * - String vazia/whitespace → sucesso (DeleteRecord costuma devolver vazio).
 */
export function detectRmResultError(
  result: string,
): DetectResultErrorMatch | null {
  const decoded = decodeRmEntities(result);
  const trimmed = decoded.trim();
  if (!trimmed) return null;

  const matches = ERROR_PATTERNS.some((re) => re.test(trimmed));
  if (!matches && trimmed.length < SHORT_RESULT_BYTES) return null;
  if (!matches) {
    // Longa mas sem padrões — improvável ser erro do RM. Não falha aqui.
    return null;
  }

  // Primeira linha não vazia (excluindo CR/LF do RM).
  const firstLine =
    trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? trimmed;

  const out: DetectResultErrorMatch = { summary: firstLine };

  const sqlMatch = trimmed.match(
    /(INSERT INTO|UPDATE\s+\[?\w+|DELETE FROM)[\s\S]*?(?:======|$)/i,
  );
  if (sqlMatch?.[0]) out.sql = sqlMatch[0].replace(/=+$/, "").trim();

  const stackMatch = trimmed.match(/(?:at RM\.[\s\S]*?)(?======|$)/);
  if (stackMatch?.[0]) out.stack = stackMatch[0].replace(/=+$/, "").trim();

  return out;
}

/**
 * Variação que lança `RmResultError` quando há match. Usada pelo
 * `parseMode: "result-strict"` das ops de escrita.
 */
export function assertRmResultOk(operationName: string, result: string): string {
  const err = detectRmResultError(result);
  if (err) {
    const parts: { summary: string; sql?: string; stack?: string } = {
      summary: err.summary,
    };
    if (err.sql !== undefined) parts.sql = err.sql;
    if (err.stack !== undefined) parts.stack = err.stack;
    throw new RmResultError(operationName, result, parts);
  }
  return result;
}

function decodeRmEntities(s: string): string {
  return s
    .replace(/&#xD;/g, "\r")
    .replace(/&#xA;/g, "\n")
    .replace(/&amp;/g, "&");
}
