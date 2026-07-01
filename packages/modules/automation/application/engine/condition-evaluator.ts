function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
}

function resolvePayloadValue(
  payload: Record<string, unknown>,
  key: string,
): unknown {
  if (key in payload) {
    return payload[key];
  }

  const camelKey = toCamelCaseKey(key);
  if (camelKey in payload) {
    return payload[camelKey];
  }

  return undefined;
}

/**
 * Evaluates a shallow key/value condition against an event or entity payload.
 */
export function evaluateCondition(
  condition: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  return Object.entries(condition).every(([key, expected]) => {
    const actual = resolvePayloadValue(payload, key);
    return actual === expected;
  });
}