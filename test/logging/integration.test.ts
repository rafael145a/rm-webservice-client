import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { createRmClient } from "../../src/client/create-rm-client.js";

import type { LogPayload, RmLogger } from "../../src/logging/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/dataserver.wsdl"),
  "utf8",
);
const fixture = (name: string) =>
  readFileSync(resolve(here, `../fixtures/responses/${name}`), "utf8");

interface RecordedEvent {
  level: "debug" | "info" | "warn" | "error";
  event: string;
  data?: LogPayload;
}

function createRecordingLogger(): { logger: RmLogger; events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  const push = (level: RecordedEvent["level"]) =>
    (event: string, data?: LogPayload) => {
      events.push({ level, event, ...(data ? { data } : {}) });
    };
  return {
    events,
    logger: {
      debug: push("debug"),
      info: push("info"),
      warn: push("warn"),
      error: push("error"),
    },
  };
}

describe("logger integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emite soap.request e soap.response com Authorization redigido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml"))),
    );

    const { logger, events } = createRecordingLogger();
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: { type: "basic", username: "u", password: "p" },
      logger,
    });

    await rm.dataServer.readView({ dataServerName: "X" });

    const req = events.find((e) => e.event === "soap.request");
    const res = events.find((e) => e.event === "soap.response");
    expect(req?.level).toBe("debug");
    expect(req?.data?.operationName).toBe("ReadView");
    expect((req?.data?.headers as Record<string, string>).Authorization).toBe(
      "[REDACTED]",
    );
    expect(req?.data?.body).toBeUndefined();
    expect(res?.data?.status).toBe(200);
    expect(typeof res?.data?.durationMs).toBe("number");
  });

  it("inclui body redigido quando logBody=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml"))),
    );

    const { logger, events } = createRecordingLogger();
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: { type: "basic", username: "u", password: "p" },
      logger,
      logBody: true,
    });

    await rm.dataServer.readView({
      dataServerName: "X",
      filter: "password=secret;CODUSUARIO=mestre",
    });

    const req = events.find((e) => e.event === "soap.request");
    const body = req?.data?.body as string;
    expect(body).toContain("ReadView");
    expect(body).toContain("password=[REDACTED]");
    expect(body).not.toContain("password=secret");
  });

  it("emite soap.error com code RM_HTTP_ERROR em HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500, statusText: "ISE" })),
    );

    const { logger, events } = createRecordingLogger();
    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: { type: "basic", username: "u", password: "p" },
      logger,
    });

    await expect(rm.dataServer.readView({ dataServerName: "X" })).rejects.toThrow();

    const err = events.find((e) => e.event === "soap.error");
    expect(err?.level).toBe("error");
    expect(err?.data?.code).toBe("RM_HTTP_ERROR");
    expect(err?.data?.status).toBe(500);
  });

  it("não emite eventos quando logger é omitido (NOOP_LOGGER default)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-readview-empty.xml"))),
    );

    const rm = createRmClient({
      services: { dataServer: { wsdlXml: dataServerWsdl } },
      auth: { type: "basic", username: "u", password: "p" },
    });

    await expect(
      rm.dataServer.readView({ dataServerName: "X" }),
    ).resolves.toEqual([]);
  });
});
