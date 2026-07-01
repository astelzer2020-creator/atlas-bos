import { createHash } from 'node:crypto';

export const LOCAL_EMBEDDING_DIMENSIONS = 64;

/**
 * Deterministic local embedding for development and tests.
 * Produces unit-normalized vectors without external API keys.
 * Replace with provider-backed embeddings in production.
 */
export function generateLocalEmbedding(text: string, dimensions = LOCAL_EMBEDDING_DIMENSIONS): number[] {
  const normalized = text.trim().toLowerCase();
  const vector = new Array<number>(dimensions).fill(0);

  if (normalized.length === 0) {
    return vector;
  }

  const tokens = normalized.split(/\s+/).filter((token) => token.length > 0);

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest();
    for (let index = 0; index < dimensions; index += 1) {
      const byte = digest[index % digest.length] ?? 0;
      const sign = digest[(index + 7) % digest.length]! % 2 === 0 ? 1 : -1;
      vector[index] = (vector[index] ?? 0) + sign * (byte / 255);
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}