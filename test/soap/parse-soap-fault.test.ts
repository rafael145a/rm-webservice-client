import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { isSoapFault, parseSoapFault } from "../../src/soap/parse-soap-fault.js";

const here = dirname(fileURLToPath(import.meta.url));
const faultXml = readFileSync(
  resolve(here, "../fixtures/responses/soap-fault.xml"),
  "utf8",
);

describe("isSoapFault", () => {
  it("detecta SOAP 1.1 fault com prefixo s:", () => {
    expect(isSoapFault(faultXml)).toBe(true);
  });

  it("detecta fault sem prefixo", () => {
    expect(isSoapFault('<Envelope><Body><Fault></Fault></Body></Envelope>')).toBe(true);
  });

  it("não detecta resposta normal como fault", () => {
    expect(
      isSoapFault('<Envelope><Body><ReadViewResponse/></Body></Envelope>'),
    ).toBe(false);
  });
});

describe("parseSoapFault", () => {
  it("extrai faultcode e faultstring", () => {
    const fault = parseSoapFault(faultXml);
    expect(fault.faultCode).toContain("Client");
    expect(fault.faultString).toContain("Usuário sem permissão");
  });

  it("retorna {} quando não encontra Fault", () => {
    expect(parseSoapFault("<not-soap/>")).toEqual({});
  });

  it("extrai Code/Reason no estilo SOAP 1.2 com .Value e .Text aninhados", () => {
    const xml = `<?xml version="1.0"?>
      <Envelope><Body><Fault>
        <Code><Value>Sender</Value></Code>
        <Reason><Text>algo deu errado</Text></Reason>
      </Fault></Body></Envelope>`;
    const fault = parseSoapFault(xml);
    expect(fault.faultCode).toBe("Sender");
    expect(fault.faultString).toBe("algo deu errado");
  });

  it("retorna {} quando Fault existe mas não tem faultcode/Code/faultstring/Reason/Detail", () => {
    const xml = `<?xml version="1.0"?>
      <Envelope><Body><Fault><outro>x</outro></Fault></Body></Envelope>`;
    expect(parseSoapFault(xml)).toEqual({});
  });
});
