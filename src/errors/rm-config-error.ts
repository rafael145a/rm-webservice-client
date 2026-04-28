import { RmError } from "./rm-error.js";

export class RmConfigError extends RmError {
  override readonly code = "RM_CONFIG_ERROR";
}
