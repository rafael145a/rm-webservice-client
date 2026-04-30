import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeEach, vi } from "vitest";

import { diagnoseCommand } from "../../src/cli/commands/diagnose.js";
import { RmConfigError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const consultaSqlWsdlPath = resolve(here, "../fixtures/wsdl/consultasql.wsdl");
const fixturePath = (name: string) =>
  resolve(here, `../fixtures/responses/${name}`);
const fixture = (name: string) => readFileSync(fixturePath(name), "utf8");

const baseCreds = { user: "u", password: "p" };

describe("rmws diagnose", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("target=all roda dataServer + consultaSql + auth quando ambos WSDLs configurados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () => new Response(fixture("dataserver-isvalid-true.xml")),
      ),
    );

    const { stdout, exitCode } = await diagnoseCommand(
      undefined,
      { ...baseCreds, wsdlDataserver: dataServerWsdlPath, wsdlSql: consultaSqlWsdlPath },
      {},
    );
    const reports = JSON.parse(stdout);
    expect(reports.map((r: { service: string }) => r.service)).toEqual([
      "dataServer",
      "consultaSql",
      "auth",
    ]);
    expect(reports.every((r: { ok: boolean }) => r.ok)).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("target=dataserver roda apenas checkDataServer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml"))),
    );

    const { stdout, exitCode } = await diagnoseCommand(
      "dataserver",
      { ...baseCreds, wsdlDataserver: dataServerWsdlPath },
      {},
    );
    const reports = JSON.parse(stdout);
    expect(reports).toHaveLength(1);
    expect(reports[0].service).toBe("dataServer");
    expect(exitCode).toBe(0);
  });

  it("target=sql sem probe roda apenas resolução de WSDL", async () => {
    const { stdout, exitCode } = await diagnoseCommand(
      "sql",
      { ...baseCreds, wsdlSql: consultaSqlWsdlPath },
      {},
    );
    const reports = JSON.parse(stdout);
    expect(reports).toHaveLength(1);
    expect(reports[0].steps).toHaveLength(1);
    expect(reports[0].steps[0].name).toBe("resolve-wsdl");
    expect(exitCode).toBe(0);
  });

  it("target=sql com probe completo executa query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("consultasql-result.xml")));
    vi.stubGlobal("fetch", fetchMock);

    const { stdout } = await diagnoseCommand(
      "sql",
      {
        ...baseCreds,
        wsdlSql: consultaSqlWsdlPath,
        probeCodsentenca: "EDU.ALUNOS",
        probeColigada: 1,
        probeSistema: "S",
      },
      {},
    );
    const reports = JSON.parse(stdout);
    expect(reports[0].steps).toHaveLength(2);
    expect(reports[0].steps[1].name).toBe("realizar-consulta-sql");
  });

  it("target=auth com HTTP 401 retorna exit code 2", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("denied", { status: 401, statusText: "Unauthorized" })),
    );

    const { stdout, exitCode } = await diagnoseCommand(
      "auth",
      { ...baseCreds, wsdlDataserver: dataServerWsdlPath },
      {},
    );
    const reports = JSON.parse(stdout);
    expect(reports[0].ok).toBe(false);
    expect(exitCode).toBe(2);
  });

  it("erro quando target=auth sem WSDL do dataServer", async () => {
    await expect(
      diagnoseCommand("auth", { ...baseCreds }, {}),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("erro quando credenciais ausentes", async () => {
    await expect(
      diagnoseCommand(
        "dataserver",
        { wsdlDataserver: dataServerWsdlPath },
        {},
      ),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("erro quando target inválido", async () => {
    await expect(
      diagnoseCommand("foo", { ...baseCreds, wsdlDataserver: dataServerWsdlPath }, {}),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("erro quando --probe-codsentenca informado sem coligada", async () => {
    await expect(
      diagnoseCommand(
        "sql",
        {
          ...baseCreds,
          wsdlSql: consultaSqlWsdlPath,
          probeCodsentenca: "X",
          probeSistema: "S",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(RmConfigError);
  });

  it("usa env vars quando flags não fornecidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml"))),
    );

    const { exitCode } = await diagnoseCommand(
      "dataserver",
      {},
      {
        RM_DATASERVER_WSDL: dataServerWsdlPath,
        RM_USER: "u",
        RM_PASSWORD: "p",
      },
    );
    expect(exitCode).toBe(0);
  });

  it("usa --probe-dataserver no body de IsValidDataServer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(fixture("dataserver-isvalid-true.xml")));
    vi.stubGlobal("fetch", fetchMock);

    await diagnoseCommand(
      "dataserver",
      {
        ...baseCreds,
        wsdlDataserver: dataServerWsdlPath,
        probeDataserver: "GlbUsuarioData",
      },
      {},
    );

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(body).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
  });
});
