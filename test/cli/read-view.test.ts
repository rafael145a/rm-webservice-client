import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { readViewCommand } from "../../src/cli/commands/read-view.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

describe("rmws read-view", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna JSON pretty-printed dos registros", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("dataserver-readview.xml"), "utf8")),
        ),
    );

    const out = await readViewCommand(
      "GlbUsuarioData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", filter: "X" },
      {},
    );
    const records = JSON.parse(out);
    expect(records).toHaveLength(2);
    expect(records[0].CODUSUARIO).toBe("mestre");
  });

  it("--raw retorna XML cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("dataserver-readview.xml"), "utf8")),
        ),
    );

    const out = await readViewCommand(
      "X",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", raw: true },
      {},
    );
    expect(out).toContain("ReadViewResult");
  });
});
