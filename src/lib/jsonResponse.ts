/**
 * Parse a fetch response body as JSON, recovering from a common corruption pattern
 * where two JSON values were concatenated (e.g. `{"a":1}{"b":2}`), which triggers
 * "Unexpected non-whitespace character after JSON" in strict JSON.parse.
 */
export function parseJsonResponseBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new SyntaxError("Unexpected end of JSON input");
  }

  try {
    return JSON.parse(trimmed);
  } catch (firstErr) {
    const dupObject = trimmed.indexOf("}{");
    if (dupObject !== -1) {
      try {
        return JSON.parse(trimmed.slice(0, dupObject + 1));
      } catch {
        /* fall through */
      }
    }
    const dupArray = trimmed.indexOf("][");
    if (dupArray !== -1) {
      try {
        return JSON.parse(trimmed.slice(0, dupArray + 1));
      } catch {
        /* fall through */
      }
    }
    throw firstErr;
  }
}

export async function readResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return parseJsonResponseBody(text) as T;
}
