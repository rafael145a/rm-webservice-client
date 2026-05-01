import { describe, it, expect } from "vitest";

import { VERSION } from "../src/index.js";
import * as authBarrel from "../src/auth/index.js";
import * as clientBarrel from "../src/client/index.js";
import * as rmBarrel from "../src/rm/index.js";
import * as soapBarrel from "../src/soap/index.js";
import * as wsdlBarrel from "../src/wsdl/index.js";
import * as errorsBarrel from "../src/errors/index.js";
import * as loggingBarrel from "../src/logging/index.js";
import { NOOP_LOGGER } from "../src/logging/no-op-logger.js";

describe("smoke", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("0.6.0");
  });

  it("expõe símbolos via barrels", () => {
    expect(authBarrel.createAuthHeader).toBeTypeOf("function");
    expect(clientBarrel.createRmClient).toBeTypeOf("function");
    expect(rmBarrel.parseRmDataset).toBeTypeOf("function");
    expect(rmBarrel.serializeContext).toBeTypeOf("function");
    expect(rmBarrel.serializeParameters).toBeTypeOf("function");
    expect(rmBarrel.extractResultXml).toBeTypeOf("function");
    expect(soapBarrel.callSoapOperation).toBeTypeOf("function");
    expect(soapBarrel.createSoapEnvelope).toBeTypeOf("function");
    expect(soapBarrel.parseSoapFault).toBeTypeOf("function");
    expect(soapBarrel.isSoapFault).toBeTypeOf("function");
    expect(wsdlBarrel.loadWsdl).toBeTypeOf("function");
    expect(wsdlBarrel.resolveWsdlService).toBeTypeOf("function");
    expect(errorsBarrel.RmError).toBeTypeOf("function");
    expect(loggingBarrel.createConsoleLogger).toBeTypeOf("function");
  });

  it("NOOP_LOGGER aceita chamadas em todos os níveis sem efeito", () => {
    expect(() => {
      NOOP_LOGGER.debug("a");
      NOOP_LOGGER.info("b");
      NOOP_LOGGER.warn("c");
      NOOP_LOGGER.error("d");
    }).not.toThrow();
  });
});
