/**
 * Valor aceito por campo na entrada do `buildRecord`. A coerção pra
 * string XML acontece no builder:
 * - `Date` → ISO 8601 (`toISOString()`).
 * - `boolean` → `"1"` (true) / `"0"` (false), padrão TOTVS RM.
 * - `number` → `String(n)`.
 * - `string` → mantém.
 * - `null` → emite `<Campo/>` (vazio explícito) — usar pra resetar campo.
 * - `undefined` → omite o elemento (campo não enviado).
 */
export type RmFieldValue = string | number | boolean | Date | null | undefined;

/** Conjunto de campos pra uma row (chave = nome XSD do campo, ex.: `CODIGO`). */
export type RmRecordFields = Record<string, RmFieldValue>;

/** Entrada do builder: 1 row ou várias rows do mesmo tipo. */
export type RmRecordsInput = RmRecordFields | ReadonlyArray<RmRecordFields>;

export interface BuildRecordOptions {
  /**
   * Nome da row do schema a usar como wrapper (ex.: `PPessoa`,
   * `GUSUARIO`). Default: primeira row do schema (master).
   */
  rowName?: string;
  /**
   * Pula validação de tipos / obrigatórios / maxLength. Use só pra
   * inspeção/debug — o RM vai validar do lado dele igual.
   */
  bypassValidation?: boolean;
  /**
   * Permite passar campos não declarados no schema. RM costuma aceitar
   * (e ignorar), mas `false` ajuda a pegar typos cedo.
   */
  allowUnknownFields?: boolean;
}
