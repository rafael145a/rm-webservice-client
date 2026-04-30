import type { LogLevel, LogPayload, RmLogger } from "./types.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface ConsoleLoggerOptions {
  level?: LogLevel;
  stream?: NodeJS.WritableStream;
  now?: () => Date;
}

export function createConsoleLogger(options: ConsoleLoggerOptions = {}): RmLogger {
  const minRank = LEVEL_RANK[options.level ?? "info"];
  const stream = options.stream ?? process.stderr;
  const now = options.now ?? (() => new Date());

  function emit(level: LogLevel, event: string, data?: LogPayload) {
    if (LEVEL_RANK[level] < minRank) return;
    const line = JSON.stringify({
      ts: now().toISOString(),
      level,
      event,
      ...(data ?? {}),
    });
    stream.write(line + "\n");
  }

  return {
    debug: (event, data) => emit("debug", event, data),
    info: (event, data) => emit("info", event, data),
    warn: (event, data) => emit("warn", event, data),
    error: (event, data) => emit("error", event, data),
  };
}
