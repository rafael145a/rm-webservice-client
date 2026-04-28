import { describe, it, expect } from "vitest";

import { parseRmDataset } from "../../src/rm/parse-rm-dataset.js";

describe("parseRmDataset", () => {
  it("retorna array com vários registros", () => {
    const records = parseRmDataset({
      innerXml: `<NewDataSet>
        <GUsuario><CODUSUARIO>mestre</CODUSUARIO></GUsuario>
        <GUsuario><CODUSUARIO>aluno1</CODUSUARIO></GUsuario>
      </NewDataSet>`,
      operationName: "ReadView",
    });
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ CODUSUARIO: "mestre" });
  });

  it("normaliza 1 registro como array", () => {
    const records = parseRmDataset({
      innerXml: `<NewDataSet><GUsuario><CODUSUARIO>mestre</CODUSUARIO></GUsuario></NewDataSet>`,
      operationName: "ReadView",
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ CODUSUARIO: "mestre" });
  });

  it("retorna [] quando NewDataSet vazio", () => {
    expect(
      parseRmDataset({ innerXml: "<NewDataSet/>", operationName: "ReadView" }),
    ).toEqual([]);
  });

  it("retorna [] quando string vazia", () => {
    expect(parseRmDataset({ innerXml: "", operationName: "ReadView" })).toEqual([]);
  });

  it("ignora xs:schema dentro de NewDataSet", () => {
    const records = parseRmDataset({
      innerXml: `<NewDataSet>
        <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" id="X"/>
        <GFilial><CODFILIAL>1</CODFILIAL></GFilial>
        <GFilial><CODFILIAL>2</CODFILIAL></GFilial>
      </NewDataSet>`,
      operationName: "ReadView",
    });
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ CODFILIAL: "1" });
  });

  it("preserva valores como string (sem coerção numérica)", () => {
    const records = parseRmDataset<{ CODFILIAL: string }>({
      innerXml: `<NewDataSet><GFilial><CODFILIAL>1</CODFILIAL></GFilial></NewDataSet>`,
      operationName: "ReadView",
    });
    expect(records[0]?.CODFILIAL).toBe("1");
    expect(typeof records[0]?.CODFILIAL).toBe("string");
  });

  it("aceita NewDataSet dentro de diffgr:diffgram", () => {
    const records = parseRmDataset({
      innerXml: `<diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
        <NewDataSet>
          <Resultado><RA>123</RA></Resultado>
        </NewDataSet>
      </diffgr:diffgram>`,
      operationName: "RealizarConsultaSQL",
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ RA: "123" });
  });
});
