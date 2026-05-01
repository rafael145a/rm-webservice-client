import { RmError } from "./rm-error.js";

/**
 * Erro embutido pelo RM no `<...Result>` de SaveRecord/DeleteRecord.
 *
 * O RM retorna **HTTP 200 + SOAP válido** mesmo quando rejeita a operação
 * por regra de negócio (FK violation, campo obrigatório, validação custom
 * em .NET). A mensagem vai como texto livre dentro do Result, e essa
 * classe encapsula isso pra que o consumidor possa fazer `try/catch`.
 *
 * Disparada por `detectRmResultError(result)` ou pelo `parseMode:
 * "result-strict"` das ops de escrita.
 */
export class RmResultError extends RmError {
  override readonly code = "RM_RESULT_ERROR";

  /** Mensagem principal (primeira linha do Result). */
  readonly summary: string;
  /** Trecho `INSERT/UPDATE/DELETE` que o RM costuma anexar quando há erro de DB. */
  readonly sql?: string;
  /** Stack trace .NET embutido (`at RM.Lib...`). */
  override readonly stack?: string;
  /** O `<...Result>` cru retornado pelo RM, decodificado. */
  readonly raw: string;
  /** Nome da operação que disparou o erro (`SaveRecord`, `DeleteRecord`, …). */
  readonly operationName: string;

  constructor(
    operationName: string,
    raw: string,
    parts: { summary: string; sql?: string; stack?: string },
  ) {
    super(`${operationName} rejeitado pelo RM: ${parts.summary}`);
    this.operationName = operationName;
    this.raw = raw;
    this.summary = parts.summary;
    if (parts.sql !== undefined) this.sql = parts.sql;
    if (parts.stack !== undefined) this.stack = parts.stack;
  }
}
