import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { extractResultXml } from "../../src/rm/extract-result-xml.js";
import { RmParseError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
function fixture(name: string) {
  return readFileSync(resolve(here, `../fixtures/responses/${name}`), "utf8");
}

describe("extractResultXml", () => {
  it("extrai conteúdo de <ReadViewResult> com CDATA", () => {
    const inner = extractResultXml({
      soapXml: fixture("dataserver-readview.xml"),
      resultElementName: "ReadViewResult",
      operationName: "ReadView",
    });
    expect(inner).toContain("<NewDataSet>");
    expect(inner).toContain("<CODUSUARIO>mestre</CODUSUARIO>");
    expect(inner).not.toContain("CDATA");
  });

  it("decodifica entidades XML quando não há CDATA", () => {
    const inner = extractResultXml({
      soapXml: fixture("dataserver-readview-with-schema.xml"),
      resultElementName: "ReadViewResult",
      operationName: "ReadView",
    });
    expect(inner).toContain("<NewDataSet>");
    expect(inner).toContain("<GFilial>");
    expect(inner).not.toContain("&lt;");
  });

  it("extrai booleano simples", () => {
    const inner = extractResultXml({
      soapXml: fixture("dataserver-isvalid-true.xml"),
      resultElementName: "IsValidDataServerResult",
      operationName: "IsValidDataServer",
    });
    expect(inner.trim()).toBe("true");
  });

  it("extrai schema XSD em CDATA", () => {
    const inner = extractResultXml({
      soapXml: fixture("dataserver-getschema.xml"),
      resultElementName: "GetSchemaResult",
      operationName: "GetSchema",
    });
    expect(inner).toContain("xs:schema");
    expect(inner).toContain("GlbUsuarioData");
  });

  it("lança RmParseError quando elemento não existe", () => {
    expect(() =>
      extractResultXml({
        soapXml: "<envelope/>",
        resultElementName: "ReadViewResult",
        operationName: "ReadView",
      }),
    ).toThrow(RmParseError);
  });
});
