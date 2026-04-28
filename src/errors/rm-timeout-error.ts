import { RmError } from "./rm-error.js";

export class RmTimeoutError extends RmError {
  override readonly code = "RM_TIMEOUT";
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.timeoutMs = timeoutMs;
  }
}
