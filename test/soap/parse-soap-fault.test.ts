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
});
