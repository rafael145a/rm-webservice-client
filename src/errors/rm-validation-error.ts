import { RmError } from "./rm-error.js";

/** Tipo de problema detectado pelo validador. */
export type RmValidationIssueKind =
  | "unknown" // campo não existe no schema
  | "required" // campo obrigatório ausente
  | "type" // valor não bate com o tipo declarado
  | "maxLength"; // string excedeu maxLength

/** Detalhe granular de uma violação de validação. */
export interface RmValidationIssue {
  field: string;
  kind: RmValidationIssueKind;
  expected?: string;
  got?: string;
}

/**
 * Lançado pelo `buildRecord` (e callers como `saveRecord({ fields })`)
 * quando o conjunto de campos viola o schema XSD do DataServer.
 *
 * Propósito: falhar **cedo, no cliente**, antes de chamar o RM. Os
 * `issues` permitem mostrar todos os problemas de uma vez (não para no
 * primeiro), útil pra UIs e logs.
 */
export class RmValidationError extends RmError {
  override readonly code = "RM_VALIDATION_ERROR";

  /** Lista detalhada de problemas — pelo menos um. */
  readonly issues: ReadonlyArray<RmValidationIssue>;
  /** Nome do DataServer / row contra o qual o validador rodou (debug). */
  readonly target?: string;

  constructor(issues: RmValidationIssue[], target?: string) {
    const summary =
      issues.length === 1
        ? formatIssue(issues[0]!)
        : `${issues.length} problemas: ${issues.map(formatIssue).join("; ")}`;
    super(
      target
        ? `Validação falhou em ${target}: ${summary}`
        : `Validação falhou: ${summary}`,
    );
    this.issues = issues;
    if (target !== undefined) this.target = target;
  }
}

function formatIssue(issue: RmValidationIssue): string {
  switch (issue.kind) {
    case "unknown":
      return `${issue.field} (campo desconhecido)`;
    case "required":
      return `${issue.field} (obrigatório)`;
    case "type":
      return `${issue.field} (esperado ${issue.expected ?? "?"}, recebeu ${issue.got ?? "?"})`;
    case "maxLength":
      return `${issue.field} (maxLength ${issue.expected ?? "?"} excedido — ${issue.got ?? "?"} caracteres)`;
    default:
      return issue.field;
  }
}
