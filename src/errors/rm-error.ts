export class RmError extends Error {
  readonly code: string = "RM_ERROR";

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
