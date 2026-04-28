import { RmError } from "./rm-error.js";

export class RmHttpError extends RmError {
  override readonly code = "RM_HTTP_ERROR";
  readonly status: number;
  readonly responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);
    this.status = status;
    this.responseText = responseText;
  }
}
