import { describe, it, expect } from "vitest";

import { createSoapEnvelope } from "../../src/soap/create-soap-envelope.js";

describe("createSoapEnvelope", () => {
  it("monta envelope SOAP 1.1 com namespace tot", () => {
    const xml = createSoapEnvelope({
      namespace: "http://www.totvs.com/",
      operationName: "ReadView",
      body: {
        DataServerName: "GlbUsuarioData",
        Filtro: "CODUSUARIO='mestre'",
        Contexto: "CODCOLIGADA=1",
      },
    });
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"');
    expect(xml).toContain('xmlns:tot="http://www.totvs.com/"');
    expect(xml).toContain("<tot:ReadView>");
    expect(xml).toContain("<tot:DataServerName>GlbUsuarioData</tot:DataServerName>");
    expect(xml).toContain("</tot:ReadView>");
  });

  it("escapa caracteres XML em valores", () => {
    const xml = createSoapEnvelope({
      namespace: "http://www.totvs.com/",
      operationName: "ReadView",
      body: { Filtro: "NOME = 'A&B' AND X<2" },
    });
    expect(xml).toContain("NOME = &apos;A&amp;B&apos; AND X&lt;2");
    expect(xml).not.toContain("'A&B'");
  });

  it("ignora valores undefined (omite a tag)", () => {
    const xml = createSoapEnvelope({
      namespace: "http://www.totvs.com/",
      operationName: "ReadView",
      body: {
        DataServerName: "X",
        Filtro: undefined,
      },
    });
    expect(xml).not.toContain("Filtro");
    expect(xml).toContain("<tot:DataServerName>X</tot:DataServerName>");
  });

  it("renderiza null como tag vazia", () => {
    const xml = createSoapEnvelope({
      namespace: "http://www.totvs.com/",
      operationName: "ReadView",
      body: { Filtro: null },
    });
    expect(xml).toContain("<tot:Filtro/>");
  });

  it("renderiza booleanos como true/false", () => {
    const xml = createSoapEnvelope({
      namespace: "http://x/",
      operationName: "Op",
      body: { Ativo: true, Inativo: false },
    });
    expect(xml).toContain("<tot:Ativo>true</tot:Ativo>");
    expect(xml).toContain("<tot:Inativo>false</tot:Inativo>");
  });

  it("preserva ordem das chaves do body", () => {
    const xml = createSoapEnvelope({
      namespace: "http://www.totvs.com/",
      operationName: "Op",
      body: { A: 1, B: 2, C: 3 },
    });
    expect(xml.indexOf("<tot:A>")).toBeLessThan(xml.indexOf("<tot:B>"));
    expect(xml.indexOf("<tot:B>")).toBeLessThan(xml.indexOf("<tot:C>"));
  });
});
