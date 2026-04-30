import type { RmLogger } from "./types.js";

export const NOOP_LOGGER: RmLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
