import { XMLParser } from "fast-xml-parser";

import { RmConfigError } from "../errors/index.js";
import { ensureArray } from "../utils/ensure-array.js";

import type { ResolvedSoapOperation, ResolvedSoapService } from "./wsdl-types.js";

export interface ResolveWsdlServiceOptions {
  wsdlXml: string;
  expectedPortName: string;
}

const SOAP_HTTP_TRANSPORT = "http://schemas.xmlsoap.org/soap/http";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => {
    return [
      "wsdl:service",
      "wsdl:port",
      "wsdl:binding",
      "wsdl:operation",
      "wsdl:portType",
    ].includes(name);
  },
});

interface WsdlPort {
  name: string;
  binding: string;
  "soap:address"?: { location?: string };
}

interface WsdlSoapOperation {
  soapAction?: string;
  style?: string;
}

interface WsdlBindingOperation {
  name: string;
  "soap:operation"?: WsdlSoapOperation;
}

interface WsdlBinding {
  name: string;
  "soap:binding"?: { transport?: string };
  "wsdl:operation"?: WsdlBindingOperation[];
}

interface WsdlService {
  name: string;
  "wsdl:port"?: WsdlPort[];
}

interface WsdlDefinitions {
  targetNamespace: string;
  "wsdl:service"?: WsdlService[];
  "wsdl:binding"?: WsdlBinding[];
}

interface ParsedWsdl {
  "wsdl:definitions"?: WsdlDefinitions;
}

export function resolveWsdlService(options: ResolveWsdlServiceOptions): ResolvedSoapService {
  const { wsdlXml, expectedPortName } = options;

  let parsed: ParsedWsdl;
  try {
    parsed = parser.parse(wsdlXml) as ParsedWsdl;
  } catch (err) {
    throw new RmConfigError(`WSDL inválido: ${(err as Error).message}`);
  }

  const definitions = parsed["wsdl:definitions"];
  if (!definitions) {
    throw new RmConfigError("WSDL sem elemento <wsdl:definitions>.");
  }

  const targetNamespace = definitions.targetNamespace;
  if (!targetNamespace) {
    throw new RmConfigError("WSDL sem targetNamespace.");
  }

  const services = ensureArray(definitions["wsdl:service"]);
  if (services.length === 0) {
    throw new RmConfigError("WSDL sem elementos <wsdl:service>.");
  }

  let foundService: WsdlService | undefined;
  let foundPort: WsdlPort | undefined;
  for (const svc of services) {
    const ports = ensureArray(svc["wsdl:port"]);
    const port = ports.find((p) => p.name === expectedPortName);
    if (port) {
      foundService = svc;
      foundPort = port;
      break;
    }
  }

  if (!foundService || !foundPort) {
    const available = services
      .flatMap((s) => ensureArray(s["wsdl:port"]).map((p) => p.name))
      .join(", ");
    throw new RmConfigError(
      `Port "${expectedPortName}" não encontrado no WSDL. Ports disponíveis: ${available || "(nenhum)"}.`,
    );
  }

  const endpointUrl = foundPort["soap:address"]?.location;
  if (!endpointUrl) {
    throw new RmConfigError(
      `Port "${expectedPortName}" não possui <soap:address location="...">.`,
    );
  }

  const bindingRef = foundPort.binding;
  if (!bindingRef) {
    throw new RmConfigError(`Port "${expectedPortName}" não possui atributo binding.`);
  }
  const bindingName = stripNamespacePrefix(bindingRef);

  const bindings = ensureArray(definitions["wsdl:binding"]);
  const binding = bindings.find((b) => b.name === bindingName);
  if (!binding) {
    throw new RmConfigError(
      `Binding "${bindingName}" referenciado pelo port "${expectedPortName}" não encontrado.`,
    );
  }

  const transport = binding["soap:binding"]?.transport;
  if (transport !== SOAP_HTTP_TRANSPORT) {
    throw new RmConfigError(
      `Binding "${bindingName}" não usa transporte SOAP HTTP (recebido: ${transport ?? "ausente"}).`,
    );
  }

  const operations: Record<string, ResolvedSoapOperation> = {};
  for (const op of ensureArray(binding["wsdl:operation"])) {
    const soapOp = op["soap:operation"];
    if (!soapOp || !soapOp.soapAction) {
      throw new RmConfigError(
        `Operação "${op.name}" no binding "${bindingName}" não possui soapAction.`,
      );
    }
    operations[op.name] = {
      soapAction: soapOp.soapAction,
      style: "document",
    };
  }

  if (Object.keys(operations).length === 0) {
    throw new RmConfigError(`Binding "${bindingName}" não possui operações.`);
  }

  return {
    serviceName: foundService.name,
    portName: foundPort.name,
    endpointUrl,
    targetNamespace,
    soapVersion: "1.1",
    operations,
  };
}

function stripNamespacePrefix(qname: string): string {
  const idx = qname.indexOf(":");
  return idx >= 0 ? qname.slice(idx + 1) : qname;
}
