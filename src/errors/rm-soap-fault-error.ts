import { RmError } from "./rm-error.js";

export class RmSoapFaultError extends RmError {
  override readonly code = "RM_SOAP_FAULT";
  readonly faultCode?: string;
  readonly faultString?: string;
  readonly status?: number;

  constructor(
    message: string,
    options: { faultCode?: string; faultString?: string; status?: number } = {},
  ) {
    super(message);
    this.faultCode = options.faultCode;
    this.faultString = options.faultString;
    this.status = options.status;
  }
}
