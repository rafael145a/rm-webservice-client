import { describe, it, expect, vi } from "vitest";

vi.mock("fast-xml-parser", () => ({
  XMLParser: class {
    parse(input: string): unknown {
      if (input === "ATTR_FIXTURE") {
        return { NewDataSet: { "@_id": "x", schema: "" } };
      }
      throw new Error("forced parser failure");
    }
  },
}));

const { parseSoapFault } = await import("../src/soap/parse-soap-fault.js");
const { parseRmDataset } = await import("../src/rm/parse-rm-dataset.js");
const { resolveWsdlService } = await import("../src/wsdl/resolve-wsdl-service.js");
const { RmConfigError, RmParseError } = await import("../src/errors/index.js");

describe("parse error paths (parser throws)", () => {
  it("parseSoapFault retorna {} quando parser lança", () => {
    expect(parseSoapFault("<qualquer/>")).toEqual({});
  });

  it("parseRmDataset converte erro do parser em RmParseError", () => {
    expect(() =>
      parseRmDataset({ innerXml: "<NewDataSet/>", operationName: "ReadView" }),
    ).toThrow(RmParseError);
  });

  it("resolveWsdlService converte erro do parser em RmConfigError", () => {
    expect(() =>
      resolveWsdlService({ wsdlXml: "<x/>", expectedPortName: "P" }),
    ).toThrow(RmConfigError);
  });

  it("parseRmDataset ignora chaves @-prefixadas dentro de NewDataSet", () => {
    expect(
      parseRmDataset({ innerXml: "ATTR_FIXTURE", operationName: "ReadView" }),
    ).toEqual([]);
  });
});
