import { describe, it, expect } from "vitest";

import { redactHeaders, redactString } from "../../src/logging/redact.js";

describe("redactHeaders", () => {
  it("redige Authorization", () => {
    const out = redactHeaders({ Authorization: "Basic abc==", Accept: "*/*" });
    expect(out.Authorization).toBe("[REDACTED]");
    expect(out.Accept).toBe("*/*");
  });

  it("é case-insensitive", () => {
    const out = redactHeaders({ authorization: "Bearer xyz" });
    expect(out.authorization).toBe("[REDACTED]");
  });

  it("redige Cookie e Set-Cookie", () => {
    const out = redactHeaders({ Cookie: "sid=abc", "Set-Cookie": "x=1" });
    expect(out.Cookie).toBe("[REDACTED]");
    expect(out["Set-Cookie"]).toBe("[REDACTED]");
  });

  it("ignora valores undefined", () => {
    const out = redactHeaders({ Authorization: undefined, Accept: "json" });
    expect(out.Authorization).toBeUndefined();
    expect(out.Accept).toBe("json");
  });
});

describe("redactString", () => {
  it("redige password=valor", () => {
    expect(redactString("user=joe;password=secret;x=1")).toBe(
      "user=joe;password=[REDACTED];x=1",
    );
  });

  it("redige senha em querystring", () => {
    expect(redactString("?user=joe&senha=123")).toBe("?user=joe&senha=[REDACTED]");
  });

  it("redige token e access_token", () => {
    expect(redactString("token=abc;access_token=xyz")).toBe(
      "token=[REDACTED];access_token=[REDACTED]",
    );
  });

  it("não toca chaves não sensíveis", () => {
    expect(redactString("CODCOLIGADA=1;CODSISTEMA=G")).toBe(
      "CODCOLIGADA=1;CODSISTEMA=G",
    );
  });

  it("redige bearer=...", () => {
    expect(redactString("bearer=eyJabc")).toBe("bearer=[REDACTED]");
  });
});
