const REDACTED = "[REDACTED]";

const SENSITIVE_HEADER_PATTERN =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/i;

const SENSITIVE_VALUE_KEY_PATTERN =
  /(authorization|password|senha|token|access[_-]?token|refresh[_-]?token|bearer|api[_-]?key)/i;

export function redactHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = SENSITIVE_HEADER_PATTERN.test(key) ? REDACTED : value;
  }
  return out;
}

export function redactString(input: string): string {
  return input.replace(
    /([?&;,\s"'<>]|\b)([a-zA-Z_-]+)=([^;,&\s"'<>]+)/g,
    (match, sep: string, key: string) => {
      if (SENSITIVE_VALUE_KEY_PATTERN.test(key)) {
        return `${sep}${key}=${REDACTED}`;
      }
      return match;
    },
  );
}
