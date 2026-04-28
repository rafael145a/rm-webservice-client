import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { inspectCommand } from "../../src/cli/commands/inspect.js";
import { RmConfigError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdlPath = resolve(here, "../fixtures/wsdl/dataserver.wsdl");
const consultaSqlWsdlPath = resolve(here, "../fixtures/wsdl/consultasql.wsdl");

describe("rmws inspect", () => {
  it("inspect dataserver retorna JSON com endpoint e operações", async () => {
    const out = await inspectCommand(
      "dataserver",
      { wsdl: dataServerWsdlPath },
      {},
    );
    const parsed = JSON.parse(out);
    expect(parsed.serviceName).toBe("wsDataServer");
    expect(parsed.portName).toBe("RM_IwsDataServer");
    expect(parsed.endpointUrl).toBe(
      "https://rm.example.com:1251/wsDataServer/IwsDataServer",
    );
    expect(parsed.operations.ReadView.soapAction).toBe(
      "http://www.totvs.com/IwsDataServer/ReadView",
    );
  });

  it("inspect sql retorna JSON com operações da ConsultaSQL", async () => {
    const out = await inspectCommand(
      "sql",
      { wsdl: consultaSqlWsdlPath },
      {},
    );
    const parsed = JSON.parse(out);
    expect(parsed.serviceName).toBe("wsConsultaSQL");
    expect(parsed.portName).toBe("RM_IwsConsultaSQL");
    expect(parsed.operations.RealizarConsultaSQL).toBeDefined();
    expect(parsed.operations.RealizarConsultaSQLContexto).toBeDefined();
  });

  it("erro quando service desconhecido", async () => {
    await expect(inspectCommand("foo", {}, {})).rejects.toBeInstanceOf(RmConfigError);
  });

  it("erro quando WSDL ausente", async () => {
    await expect(inspectCommand("dataserver", {}, {})).rejects.toBeInstanceOf(
      RmConfigError,
    );
  });

  it("lê WSDL via env var", async () => {
    const out = await inspectCommand(
      "dataserver",
      {},
      { RM_DATASERVER_WSDL: dataServerWsdlPath },
    );
    const parsed = JSON.parse(out);
    expect(parsed.portName).toBe("RM_IwsDataServer");
  });
});
