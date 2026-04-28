import { RmError } from "./rm-error.js";

export class RmParseError extends RmError {
  override readonly code = "RM_PARSE_ERROR";
  readonly operationName: string;
  readonly resultElement?: string;

  constructor(message: string, operationName: string, resultElement?: string) {
    super(message);
    this.operationName = operationName;
    this.resultElement = resultElement;
  }
}
