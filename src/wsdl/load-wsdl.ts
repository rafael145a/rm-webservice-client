import { RmConfigError } from "../errors/index.js";
import { RmTimeoutError } from "../errors/rm-timeout-error.js";
import { NOOP_LOGGER } from "../logging/no-op-logger.js";

import type { RmLogger } from "../logging/types.js";

export interface LoadWsdlOptions {
  wsdlUrl?: string;
  wsdlXml?: string;
  timeoutMs?: number;
  logger?: RmLogger;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function loadWsdl(options: LoadWsdlOptions): Promise<string> {
  const { wsdlUrl, wsdlXml, timeoutMs = DEFAULT_TIMEOUT_MS, logger = NOOP_LOGGER } = options;

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
  const startedAt = Date.now();

  logger.debug("wsdl.request", { url });

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
      const err = new RmConfigError(
        `Falha ao baixar WSDL de ${url}: HTTP ${response.status} ${response.statusText}${hint}`,
      );
      logger.error("wsdl.error", {
        url,
        code: err.code,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      throw err;
    }
    const text = await response.text();
    logger.debug("wsdl.response", {
      url,
      status: response.status,
      bytes: text.length,
      durationMs: Date.now() - startedAt,
    });
    return text;
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      const timeoutErr = new RmTimeoutError(`Timeout ao baixar WSDL de ${url}`, timeoutMs);
      logger.error("wsdl.error", {
        url,
        code: timeoutErr.code,
        durationMs: Date.now() - startedAt,
      });
      throw timeoutErr;
    }
    if (err instanceof RmConfigError) throw err;
    const wrapped = new RmConfigError(`Erro ao baixar WSDL de ${url}: ${(err as Error).message}`);
    logger.error("wsdl.error", {
      url,
      code: wrapped.code,
      message: wrapped.message,
      durationMs: Date.now() - startedAt,
    });
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}
