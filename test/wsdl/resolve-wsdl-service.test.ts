import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { resolveWsdlService } from "../../src/wsdl/resolve-wsdl-service.js";
import { RmConfigError } from "../../src/errors/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataServerWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/dataserver.wsdl"),
  "utf8",
);
const consultaSqlWsdl = readFileSync(
  resolve(here, "../fixtures/wsdl/consultasql.wsdl"),
  "utf8",
);

describe("resolveWsdlService — DataServer", () => {
  it("resolve port RM_IwsDataServer com endpoint sanitizado", () => {
    const svc = resolveWsdlService({
      wsdlXml: dataServerWsdl,
      expectedPortName: "RM_IwsDataServer",
    });

    expect(svc.serviceName).toBe("wsDataServer");
    expect(svc.portName).toBe("RM_IwsDataServer");
    expect(svc.endpointUrl).toBe(
      "https://rm.example.com:1251/wsDataServer/IwsDataServer",
    );
    expect(svc.targetNamespace).toBe("http://www.totvs.com/");
    expect(svc.soapVersion).toBe("1.1");
  });

  it("extrai SOAPAction de ReadView, ReadRecord, GetSchema, IsValidDataServer", () => {
    const svc = resolveWsdlService({
      wsdlXml: dataServerWsdl,
      expectedPortName: "RM_IwsDataServer",
    });

    expect(svc.operations.ReadView?.soapAction).toBe(
      "http://www.totvs.com/IwsDataServer/ReadView",
    );
    expect(svc.operations.ReadRecord?.soapAction).toBe(
      "http://www.totvs.com/IwsDataServer/ReadRecord",
    );
    expect(svc.operations.GetSchema?.soapAction).toBe(
      "http://www.totvs.com/IwsDataServer/GetSchema",
    );
    expect(svc.operations.IsValidDataServer?.soapAction).toBe(
      "http://www.totvs.com/IwsDataServer/IsValidDataServer",
    );
  });

  it("lista também as variantes *Email (apenas como metadata, não exposto pelo client)", () => {
    const svc = resolveWsdlService({
      wsdlXml: dataServerWsdl,
      expectedPortName: "RM_IwsDataServer",
    });

    expect(svc.operations.ReadViewEmail).toBeDefined();
    expect(svc.operations.SaveRecordEmail).toBeDefined();
  });

  it("não confunde com port auxiliar RM_IRMSServer", () => {
    const svc = resolveWsdlService({
      wsdlXml: dataServerWsdl,
      expectedPortName: "RM_IRMSServer",
    });

    expect(svc.endpointUrl).toBe(
      "https://rm.example.com:1251/wsDataServer/IRMSServer",
    );
    expect(svc.operations.ReadView).toBeUndefined();
    expect(svc.operations.Implements).toBeDefined();
  });

  it("não confunde com port auxiliar RM_IwsBase", () => {
    const svc = resolveWsdlService({
      wsdlXml: dataServerWsdl,
      expectedPortName: "RM_IwsBase",
    });

    expect(svc.endpointUrl).toBe(
      "https://rm.example.com:1251/wsDataServer/IwsBase",
    );
    expect(svc.operations.AutenticaAcesso).toBeDefined();
    expect(svc.operations.ReadView).toBeUndefined();
  });
});

describe("resolveWsdlService — ConsultaSQL", () => {
  it("resolve port RM_IwsConsultaSQL", () => {
    const svc = resolveWsdlService({
      wsdlXml: consultaSqlWsdl,
      expectedPortName: "RM_IwsConsultaSQL",
    });

    expect(svc.serviceName).toBe("wsConsultaSQL");
    expect(svc.portName).toBe("RM_IwsConsultaSQL");
    expect(svc.endpointUrl).toBe(
      "https://rm.example.com:1251/wsConsultaSQL/IwsConsultaSQL",
    );
  });

  it("extrai SOAPAction de RealizarConsultaSQL e RealizarConsultaSQLContexto", () => {
    const svc = resolveWsdlService({
      wsdlXml: consultaSqlWsdl,
      expectedPortName: "RM_IwsConsultaSQL",
    });

    expect(svc.operations.RealizarConsultaSQL?.soapAction).toBe(
      "http://www.totvs.com/IwsConsultaSQL/RealizarConsultaSQL",
    );
    expect(svc.operations.RealizarConsultaSQLContexto?.soapAction).toBe(
      "http://www.totvs.com/IwsConsultaSQL/RealizarConsultaSQLContexto",
    );
  });
});

describe("resolveWsdlService — erros", () => {
  it("lança RmConfigError quando port não existe", () => {
    expect(() =>
      resolveWsdlService({
        wsdlXml: dataServerWsdl,
        expectedPortName: "RM_PortInexistente",
      }),
    ).toThrow(RmConfigError);
  });

  it("lança RmConfigError com WSDL inválido", () => {
    expect(() =>
      resolveWsdlService({ wsdlXml: "<not-wsdl/>", expectedPortName: "X" }),
    ).toThrow(RmConfigError);
  });

  it("lista ports disponíveis na mensagem de erro", () => {
    try {
      resolveWsdlService({
        wsdlXml: dataServerWsdl,
        expectedPortName: "RM_PortInexistente",
      });
      expect.fail("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(RmConfigError);
      const msg = (err as Error).message;
      expect(msg).toContain("RM_IwsDataServer");
      expect(msg).toContain("RM_IRMSServer");
      expect(msg).toContain("RM_IwsBase");
    }
  });

  it("lança RmConfigError quando WSDL não tem <wsdl:definitions>", () => {
    expect(() =>
      resolveWsdlService({
        wsdlXml: '<root xmlns="http://x"/>',
        expectedPortName: "X",
      }),
    ).toThrow(/wsdl:definitions/);
  });

  it("lança RmConfigError quando definitions não tem targetNamespace", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"/>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "X" }),
    ).toThrow(/targetNamespace/);
  });

  it("lança RmConfigError quando WSDL não tem <wsdl:service>", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://t/"/>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "X" }),
    ).toThrow(/wsdl:service/);
  });

  it("lança RmConfigError quando port não tem <soap:address>", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="tns:B"/>
        </wsdl:service>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/soap:address/);
  });

  it("lança RmConfigError quando port não tem atributo binding", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/binding/);
  });

  it("lança RmConfigError quando binding referenciado não existe", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="tns:Bsumido">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/Binding "Bsumido"/);
  });

  it("lança RmConfigError quando transport do binding não é SOAP HTTP", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="tns:B">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
        <wsdl:binding name="B" type="tns:T">
          <soap:binding transport="http://schemas.xmlsoap.org/soap/jms"/>
        </wsdl:binding>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/transporte SOAP HTTP/);
  });

  it("lança RmConfigError quando operação não tem soapAction", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="tns:B">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
        <wsdl:binding name="B" type="tns:T">
          <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
          <wsdl:operation name="OpSemAction"/>
        </wsdl:binding>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/soapAction/);
  });

  it("lança RmConfigError quando binding não tem operações", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="tns:B">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
        <wsdl:binding name="B" type="tns:T">
          <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
        </wsdl:binding>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/não possui operações/);
  });

  it("mensagem de erro mostra '(nenhum)' quando service não tem ports", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://t/">
        <wsdl:service name="S"/>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "X" }),
    ).toThrow(/\(nenhum\)/);
  });

  it("mensagem mostra 'ausente' quando binding não tem soap:binding", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="tns:B">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
        <wsdl:binding name="B" type="tns:T"/>
      </wsdl:definitions>`;
    expect(() =>
      resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" }),
    ).toThrow(/ausente/);
  });

  it("aceita binding ref sem prefixo de namespace (stripNamespacePrefix fallback)", () => {
    const xml = `<?xml version="1.0"?>
      <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="http://t/">
        <wsdl:service name="S">
          <wsdl:port name="P" binding="B">
            <soap:address location="http://x"/>
          </wsdl:port>
        </wsdl:service>
        <wsdl:binding name="B" type="T">
          <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
          <wsdl:operation name="Op">
            <soap:operation soapAction="http://x/Op"/>
          </wsdl:operation>
        </wsdl:binding>
      </wsdl:definitions>`;
    const svc = resolveWsdlService({ wsdlXml: xml, expectedPortName: "P" });
    expect(svc.endpointUrl).toBe("http://x");
    expect(svc.operations.Op?.soapAction).toBe("http://x/Op");
  });
});
