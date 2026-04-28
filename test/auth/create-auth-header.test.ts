import { describe, it, expect } from "vitest";

import { createAuthHeader } from "../../src/auth/create-auth-header.js";
import { RmConfigError } from "../../src/errors/index.js";

describe("createAuthHeader", () => {
  it("Basic encoda em base64 (UTF-8)", async () => {
    const header = await createAuthHeader({
      type: "basic",
      username: "mestre",
      password: "senha123",
    });
    expect(header).toBe(
      `Basic ${Buffer.from("mestre:senha123", "utf8").toString("base64")}`,
    );
  });

  it("Basic preserva caracteres não-ASCII em UTF-8", async () => {
    const header = await createAuthHeader({
      type: "basic",
      username: "joão",
      password: "açúcar",
    });
    const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString("utf8");
    expect(decoded).toBe("joão:açúcar");
  });

  it("Bearer com token estático", async () => {
    const header = await createAuthHeader({ type: "bearer", token: "abc" });
    expect(header).toBe("Bearer abc");
  });

  it("Bearer com getToken assíncrono", async () => {
    const header = await createAuthHeader({
      type: "bearer",
      getToken: async () => "xyz",
    });
    expect(header).toBe("Bearer xyz");
  });

  it("Basic vazio lança RmConfigError", async () => {
    await expect(
      createAuthHeader({ type: "basic", username: "", password: "x" }),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("Bearer com token vazio lança RmConfigError", async () => {
    await expect(
      createAuthHeader({ type: "bearer", token: "" }),
    ).rejects.toBeInstanceOf(RmConfigError);
  });
});
