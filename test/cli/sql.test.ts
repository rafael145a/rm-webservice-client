import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { sqlCommand } from "../../src/cli/commands/sql.js";
import { RmConfigError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const consultaSqlWsdlPath = resolve(here, "../fixtures/wsdl/consultasql.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);

describe("rmws sql", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("retorna JSON dos registros", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () => new Response(readFileSync(fixturePath("consultasql-result.xml"), "utf8")),
        ),
    );

    const out = await sqlCommand(
      "EDU.ALUNOS.ATIVOS",
      {
        wsdl: consultaSqlWsdlPath,
        user: "u",
        password: "p",
        coligada: 1,
        sistema: "S",
        params: "CODFILIAL=1",
      },
      {},
    );
    const records = JSON.parse(out);
    expect(records).toHaveLength(2);
    expect(records[0].RA).toBe("12345");
  });

  it("usa queryWithContext quando --context informado", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Response(
            readFileSync(fixturePath("consultasql-result.xml"), "utf8").replace(
              /RealizarConsultaSQL/g,
              "RealizarConsultaSQLContexto",
            ),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await sqlCommand(
      "X",
      {
        wsdl: consultaSqlWsdlPath,
        user: "u",
        password: "p",
        coligada: 1,
        sistema: "S",
        context: "CODCOLIGADA=1;CODSISTEMA=S",
      },
      {},
    );

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.SOAPAction).toBe(
      '"http://www.totvs.com/IwsConsultaSQL/RealizarConsultaSQLContexto"',
    );
  });

  it("erro quando --coligada ausente", async () => {
    await expect(
      sqlCommand(
        "X",
        { wsdl: consultaSqlWsdlPath, user: "u", password: "p", sistema: "S" },
        {},
      ),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("erro quando --sistema ausente", async () => {
    await expect(
      sqlCommand(
        "X",
        { wsdl: consultaSqlWsdlPath, user: "u", password: "p", coligada: 1 },
        {},
      ),
    ).rejects.toBeInstanceOf(RmConfigError);
  });
});
