import { RmConfigError } from "../errors/index.js";
import { RmTimeoutError } from "../errors/rm-timeout-error.js";

export interface LoadWsdlOptions {
  wsdlUrl?: string;
  wsdlXml?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function loadWsdl(options: LoadWsdlOptions): Promise<string> {
  const { wsdlUrl, wsdlXml, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (!wsdlUrl && !wsdlXml) {
    throw new RmConfigError("loadWsdl exige wsdlUrl ou wsdlXml.");
  }
  if (wsdlUrl && wsdlXml) {
    throw new RmConfigError("loadWsdl não aceita wsdlUrl e wsdlXml ao mesmo tempo.");
  }

  if (wsdlXml) {
    return wsdlXml;
  }

  const url = wsdlUrl as string;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/xml, application/xml, */*",
        "User-Agent": "rm-webservice-client",
      },
    });
    if (!response.ok) {
      const server = response.headers.get("server") ?? "";
      const hint =
        response.status === 400 &&
        server.startsWith("Microsoft-HTTPAPI") &&
        !/\/mex\?wsdl/i.test(url)
          ? ' (TOTVS RM expõe o WSDL no MEX — tente trocar o path por "/MEX?wsdl")'
          : "";
      throw new RmConfigError(
        `Falha ao baixar WSDL de ${url}: HTTP ${response.status} ${response.statusText}${hint}`,
      );
    }
    return await response.text();
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new RmTimeoutError(`Timeout ao baixar WSDL de ${url}`, timeoutMs);
    }
    if (err instanceof RmConfigError) throw err;
    throw new RmConfigError(`Erro ao baixar WSDL de ${url}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
