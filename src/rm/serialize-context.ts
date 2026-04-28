import type { RmContext, Separator } from "./types.js";

export function serializeContext(
  context: RmContext | undefined,
  separator: Separator = ";",
): string | undefined {
  if (context === undefined) return undefined;
  if (typeof context === "string") return context;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    parts.push(`${key}=${value === null ? "" : String(value)}`);
  }
  return parts.join(separator);
}
