import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { readLookupViewCommand } from "../../src/cli/commands/read-lookup-view.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

describe("rmws read-lookup-view", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna JSON pretty-printed dos registros", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-readlookupview.xml"), "utf8"),
            ),
        ),
    );
    const out = await readLookupViewCommand(
      "AlgumLookupData",
      { wsdl: dataServerWsdlPath, user: "u", password: "p" },
      {},
    );
    const arr = JSON.parse(out);
    expect(arr).toHaveLength(2);
    expect(arr[0].DESCRICAO).toBe("Opção A");
  });

  it("--owner-data é enviado no body", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Response(
            readFileSync(fixturePath("dataserver-readlookupview.xml"), "utf8"),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await readLookupViewCommand(
      "AlgumLookupData",
      {
        wsdl: dataServerWsdlPath,
        user: "u",
        password: "p",
        ownerData: "<X/>",
      },
      {},
    );
    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:OwnerData>&lt;X/&gt;</tot:OwnerData>");
  });

  it("--raw devolve XML cru", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-readlookupview.xml"), "utf8"),
            ),
        ),
    );
    const out = await readLookupViewCommand(
      "X",
      { wsdl: dataServerWsdlPath, user: "u", password: "p", raw: true },
      {},
    );
    expect(out).toContain("ReadLookupViewResult");
  });
});
