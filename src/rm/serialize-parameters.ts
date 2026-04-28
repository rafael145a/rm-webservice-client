import { serializeContext } from "./serialize-context.js";

import type { RmParameters, Separator } from "./types.js";

export function serializeParameters(
  parameters: RmParameters | undefined,
  separator: Separator = ";",
): string | undefined {
  return serializeContext(parameters, separator);
}
