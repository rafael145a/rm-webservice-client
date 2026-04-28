import { RmConfigError } from "../errors/index.js";
import { loadWsdl } from "../wsdl/load-wsdl.js";
import { resolveWsdlService } from "../wsdl/resolve-wsdl-service.js";

import type { ResolvedSoapService } from "../wsdl/wsdl-types.js";
import type { RmSoapServiceOptions } from "./types.js";

export interface ServiceResolverContext {
  serviceLabel: "dataServer" | "consultaSql";
  expectedPortName: string;
  defaultNamespace: string;
}

export function createServiceResolver(
  options: RmSoapServiceOptions | undefined,
  context: ServiceResolverContext,
): () => Promise<ResolvedSoapService> {
  let cache: ResolvedSoapService | null = null;
  let inflight: Promise<ResolvedSoapService> | null = null;

  return async () => {
    if (cache) return cache;
    if (inflight) return inflight;

    inflight = (async () => {
      const resolved = await resolveOnce(options, context);
      cache = resolved;
      inflight = null;
      return resolved;
    })();

    return inflight;
  };
}

async function resolveOnce(
  options: RmSoapServiceOptions | undefined,
  context: ServiceResolverContext,
): Promise<ResolvedSoapService> {
  if (!options) {
    throw new RmConfigError(
      `Serviço "${context.serviceLabel}" não foi configurado em createRmClient.`,
    );
  }

  if (options.endpointUrl && options.soapActions) {
    const ops: Record<string, { soapAction: string; style: "document" }> = {};
    for (const [name, action] of Object.entries(options.soapActions)) {
      ops[name] = { soapAction: action, style: "document" };
    }
    return {
      serviceName: context.expectedPortName.replace(/^RM_I/, ""),
      portName: context.expectedPortName,
      endpointUrl: options.endpointUrl,
      targetNamespace: options.targetNamespace ?? context.defaultNamespace,
      soapVersion: "1.1",
      operations: ops,
    };
  }

  const wsdlXml = await loadWsdl({
    wsdlUrl: options.wsdlUrl,
    wsdlXml: options.wsdlXml,
  });

  return resolveWsdlService({
    wsdlXml,
    expectedPortName: context.expectedPortName,
  });
}
