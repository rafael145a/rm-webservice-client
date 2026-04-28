import { XMLParser } from "fast-xml-parser";

import { RmParseError } from "../errors/rm-parse-error.js";
import { ensureArray } from "../utils/ensure-array.js";

export interface ParseRmDatasetOptions {
  innerXml: string;
  operationName: string;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

const SCHEMA_KEY = "schema";

export function parseRmDataset<T = unknown>(options: ParseRmDatasetOptions): T[] {
  const { innerXml, operationName } = options;

  const trimmed = innerXml.trim();
  if (!trimmed) return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(trimmed) as Record<string, unknown>;
  } catch (err) {
    throw new RmParseError(
      `XML interno inválido: ${(err as Error).message}`,
      operationName,
    );
  }

  const newDataSet = findNewDataSet(parsed);
  if (!newDataSet || typeof newDataSet !== "object") {
    return [];
  }

  const recordKey = pickRecordKey(newDataSet as Record<string, unknown>);
  if (!recordKey) return [];

  const records = (newDataSet as Record<string, unknown>)[recordKey];
  return ensureArray(records) as T[];
}

function findNewDataSet(parsed: Record<string, unknown>): unknown {
  if ("NewDataSet" in parsed) return parsed.NewDataSet;
  const diffgram = parsed["diffgram"];
  if (diffgram && typeof diffgram === "object" && "NewDataSet" in diffgram) {
    return (diffgram as Record<string, unknown>).NewDataSet;
  }
  return null;
}

function pickRecordKey(node: Record<string, unknown>): string | null {
  for (const key of Object.keys(node)) {
    if (key === SCHEMA_KEY) continue;
    if (key.startsWith("@")) continue;
    return key;
  }
  return null;
}
