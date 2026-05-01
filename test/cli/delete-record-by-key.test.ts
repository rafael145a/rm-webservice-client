import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { deleteRecordByKeyCommand } from "../../src/cli/commands/delete-record-by-key.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

describe("rmws delete-record-by-key", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna string vazia em sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              readFileSync(fixturePath("dataserver-deleterecord-bykey.xml"), "utf8"),
            ),
        ),
    );
    const out = await deleteRecordByKeyCommand(
      "RhuPessoaData",
      "26620",
      { wsdl: dataServerWsdlPath, user: "u", password: "p" },
      {},
    );
    expect(out).toBe("");
  });

  it("envia chave composta separada por vírgula", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Response(
            readFileSync(fixturePath("dataserver-deleterecord-bykey.xml"), "utf8"),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await deleteRecordByKeyCommand(
      "RhuPessoaData",
      "1,abc,42",
      { wsdl: dataServerWsdlPath, user: "u", password: "p" },
      {},
    );
    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:PrimaryKey>1;abc;42</tot:PrimaryKey>");
  });

  it("falha com RmConfigError quando primaryKey vazio", async () => {
    await expect(
      deleteRecordByKeyCommand(
        "RhuPessoaData",
        undefined,
        { wsdl: dataServerWsdlPath, user: "u", password: "p" },
        {},
      ),
    ).rejects.toMatchObject({ code: "RM_CONFIG_ERROR" });
  });
});
