export interface SemanticSearchResult<T> {
  readonly item: T;
  readonly score: number;
}

/**
 * Cosine similarity between two equal-length vectors.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Ranks items by embedding similarity to a query vector.
 */
export function rankBySemanticSimilarity<T>(
  items: readonly T[],
  queryEmbedding: readonly number[],
  getEmbedding: (item: T) => readonly number[] | null | undefined,
  minScore = 0,
): SemanticSearchResult<T>[] {
  const results: SemanticSearchResult<T>[] = [];

  for (const item of items) {
    const embedding = getEmbedding(item);
    if (embedding === null || embedding === undefined || embedding.length === 0) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, embedding);
    if (score >= minScore) {
      results.push({ item, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}