export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogPayload = Record<string, unknown>;

export interface RmLogger {
  debug(event: string, data?: LogPayload): void;
  info(event: string, data?: LogPayload): void;
  warn(event: string, data?: LogPayload): void;
  error(event: string, data?: LogPayload): void;
}
