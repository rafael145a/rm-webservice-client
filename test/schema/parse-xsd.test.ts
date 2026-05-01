import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { parseXsdSchema } from "../../src/schema/parse-xsd.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(here, `../fixtures/schemas/${name}`), "utf8");

describe("parseXsdSchema — GlbUsuarioData", () => {
  const schema = parseXsdSchema(fixture("glb-usuario.xsd"));

  it("identifica datasetName", () => {
    expect(schema.datasetName).toBe("GlbUsuario");
  });

  it("extrai todas as rows do dataset", () => {
    const rowNames = schema.rows.map((r) => r.name);
    expect(rowNames).toContain("GUSUARIO");
    expect(rowNames).toContain("GPERMIS");
    expect(rowNames).toContain("GUSRPERFIL");
  });

  it("a row GUSUARIO tem CODUSUARIO como obrigatório (string com maxLength)", () => {
    const gusuario = schema.rows.find((r) => r.name === "GUSUARIO");
    const codUsuario = gusuario?.fields.find((f) => f.name === "CODUSUARIO");
    expect(codUsuario).toBeDefined();
    expect(codUsuario?.tsType).toBe("string");
    expect(codUsuario?.xsdType).toBe("xs:string");
    expect(codUsuario?.optional).toBe(false);
    expect(codUsuario?.caption).toBe("Usuário");
    expect(codUsuario?.maxLength).toBe(20);
  });

  it("a row GUSUARIO tem STATUS opcional como number (xs:short)", () => {
    const gusuario = schema.rows.find((r) => r.name === "GUSUARIO");
    const status = gusuario?.fields.find((f) => f.name === "STATUS");
    expect(status).toBeDefined();
    expect(status?.tsType).toBe("number");
    expect(status?.xsdType).toBe("xs:short");
    expect(status?.optional).toBe(true);
    expect(status?.default).toBe("1");
    expect(status?.caption).toBe("Ativo");
  });

  it("DATAINICIO é xs:dateTime mapeado para string", () => {
    const gusuario = schema.rows.find((r) => r.name === "GUSUARIO");
    const dataInicio = gusuario?.fields.find((f) => f.name === "DATAINICIO");
    expect(dataInicio?.xsdType).toBe("xs:dateTime");
    expect(dataInicio?.tsType).toBe("string");
  });

  it("NOME é opcional (minOccurs=0) e string com maxLength=45", () => {
    const gusuario = schema.rows.find((r) => r.name === "GUSUARIO");
    const nome = gusuario?.fields.find((f) => f.name === "NOME");
    expect(nome?.optional).toBe(true);
    expect(nome?.tsType).toBe("string");
    expect(nome?.maxLength).toBe(45);
  });
});

describe("parseXsdSchema — RhuPessoaData", () => {
  const schema = parseXsdSchema(fixture("rhu-pessoa.xsd"));

  it("dataset chama-se RhuPessoa", () => {
    expect(schema.datasetName).toBe("RhuPessoa");
  });

  it("row master é PPessoa", () => {
    expect(schema.rows.map((r) => r.name)).toContain("PPessoa");
  });

  it("PPessoa.CODIGO é xs:int obrigatório", () => {
    const ppessoa = schema.rows.find((r) => r.name === "PPessoa");
    const codigo = ppessoa?.fields.find((f) => f.name === "CODIGO");
    expect(codigo?.xsdType).toBe("xs:int");
    expect(codigo?.tsType).toBe("number");
    expect(codigo?.optional).toBe(false);
    expect(codigo?.caption).toBe("Identificador");
  });

  it("PPessoa.NOME é string obrigatório com maxLength", () => {
    const ppessoa = schema.rows.find((r) => r.name === "PPessoa");
    const nome = ppessoa?.fields.find((f) => f.name === "NOME");
    expect(nome?.tsType).toBe("string");
    expect(nome?.optional).toBe(false);
    expect(nome?.maxLength).toBe(120);
  });
});

describe("parseXsdSchema — EduPessoaData", () => {
  const schema = parseXsdSchema(fixture("edu-pessoa.xsd"));

  it("dataset chama-se EduPessoa", () => {
    expect(schema.datasetName).toBe("EduPessoa");
  });

  it("row SPessoa tem CODIGO obrigatório", () => {
    const sPessoa = schema.rows.find((r) => r.name === "SPessoa");
    const codigo = sPessoa?.fields.find((f) => f.name === "CODIGO");
    expect(codigo?.xsdType).toBe("xs:int");
    expect(codigo?.optional).toBe(false);
  });
});

describe("parseXsdSchema — error handling", () => {
  it("lança RmParseError quando não encontra elemento IsDataSet", () => {
    expect(() =>
      parseXsdSchema('<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"></xs:schema>'),
    ).toThrow(/IsDataSet/i);
  });

  it("lança RmParseError quando o XML é inválido / vazio", () => {
    expect(() => parseXsdSchema("")).toThrow();
  });

  it("aceita XSD sem o wrapper externo (apenas <xs:schema>)", () => {
    // A camada `getSchema` no client já retorna sem wrapper às vezes.
    const xsdOnly = `<xs:schema id="X" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
      <xs:element name="X" msdata:IsDataSet="true">
        <xs:complexType>
          <xs:choice minOccurs="0" maxOccurs="unbounded">
            <xs:element name="ROW">
              <xs:complexType>
                <xs:sequence>
                  <xs:element name="CAMPO" type="xs:int" />
                </xs:sequence>
              </xs:complexType>
            </xs:element>
          </xs:choice>
        </xs:complexType>
      </xs:element>
    </xs:schema>`;
    const schema = parseXsdSchema(xsdOnly);
    expect(schema.datasetName).toBe("X");
    expect(schema.rows[0]?.name).toBe("ROW");
    expect(schema.rows[0]?.fields[0]).toMatchObject({
      name: "CAMPO",
      tsType: "number",
      xsdType: "xs:int",
      optional: false,
    });
  });
});

describe("parseXsdSchema — type mapping", () => {
  const xsd = (fields: string) => `<xs:schema id="T" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xs:element name="T" msdata:IsDataSet="true">
      <xs:complexType>
        <xs:choice minOccurs="0" maxOccurs="unbounded">
          <xs:element name="R">
            <xs:complexType>
              <xs:sequence>${fields}</xs:sequence>
            </xs:complexType>
          </xs:element>
        </xs:choice>
      </xs:complexType>
    </xs:element>
  </xs:schema>`;
  const fieldsOf = (raw: string) =>
    parseXsdSchema(xsd(raw)).rows[0]!.fields;

  it.each([
    ["xs:int", "number"],
    ["xs:short", "number"],
    ["xs:long", "number"],
    ["xs:integer", "number"],
    ["xs:byte", "number"],
    ["xs:unsignedShort", "number"],
    ["xs:unsignedInt", "number"],
    ["xs:decimal", "number"],
    ["xs:double", "number"],
    ["xs:float", "number"],
    ["xs:string", "string"],
    ["xs:dateTime", "string"],
    ["xs:date", "string"],
    ["xs:time", "string"],
    ["xs:base64Binary", "string"],
    ["xs:hexBinary", "string"],
    ["xs:boolean", "boolean"],
  ] as const)("xsd %s → ts %s", (xsdType, tsType) => {
    const f = fieldsOf(`<xs:element name="C" type="${xsdType}" />`);
    expect(f[0]?.tsType).toBe(tsType);
    expect(f[0]?.xsdType).toBe(xsdType);
  });

  it("tipo desconhecido cai em string com warning interno", () => {
    const f = fieldsOf(`<xs:element name="C" type="xs:NOTATION" />`);
    expect(f[0]?.tsType).toBe("string");
  });
});
