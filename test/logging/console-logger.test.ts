import { Writable } from "node:stream";

import { describe, it, expect, vi } from "vitest";

import { createConsoleLogger } from "../../src/logging/console-logger.js";

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString("utf8"));
      cb();
    },
  });
  return { stream, lines: () => chunks.join("").split("\n").filter(Boolean) };
}

describe("createConsoleLogger", () => {
  it("emite JSON com timestamp, level e event", () => {
    const { stream, lines } = captureStream();
    const logger = createConsoleLogger({
      level: "debug",
      stream,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    logger.info("evento.teste", { a: 1 });
    const parsed = JSON.parse(lines()[0] as string);
    expect(parsed).toEqual({
      ts: "2026-01-01T00:00:00.000Z",
      level: "info",
      event: "evento.teste",
      a: 1,
    });
  });

  it("filtra eventos abaixo do level mínimo", () => {
    const { stream, lines } = captureStream();
    const logger = createConsoleLogger({ level: "warn", stream });

    logger.debug("debug.evt");
    logger.info("info.evt");
    logger.warn("warn.evt");
    logger.error("error.evt");

    const events = lines().map((l) => JSON.parse(l).event);
    expect(events).toEqual(["warn.evt", "error.evt"]);
  });

  it("level default é info", () => {
    const { stream, lines } = captureStream();
    const logger = createConsoleLogger({ stream });

    logger.debug("d");
    logger.info("i");

    expect(lines()).toHaveLength(1);
    expect(JSON.parse(lines()[0] as string).event).toBe("i");
  });

  it("usa process.stderr quando stream não é fornecido", () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    try {
      const logger = createConsoleLogger();
      logger.error("evt");
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const written = stderrSpy.mock.calls[0]?.[0] as string;
      expect(JSON.parse(written.trim()).event).toBe("evt");
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("usa Date() quando 'now' não é fornecido", () => {
    const { stream, lines } = captureStream();
    const logger = createConsoleLogger({ stream, level: "debug" });
    logger.debug("evt");
    const ts = JSON.parse(lines()[0] as string).ts as string;
    expect(() => new Date(ts).toISOString()).not.toThrow();
  });
});
