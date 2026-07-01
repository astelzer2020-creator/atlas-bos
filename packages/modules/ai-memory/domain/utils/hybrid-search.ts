import { generateLocalEmbedding } from './embedding.js';
import { rankByKeywordMatch } from './keyword-search.js';
import { rankBySemanticSimilarity } from './semantic-search.js';

export interface HybridSearchResult<T> {
  readonly item: T;
  readonly score: number;
  readonly keywordScore: number;
  readonly semanticScore: number;
}

export interface HybridSearchOptions {
  readonly keywordWeight?: number;
  readonly semanticWeight?: number;
  readonly minScore?: number;
}

const DEFAULT_KEYWORD_WEIGHT = 0.4;
const DEFAULT_SEMANTIC_WEIGHT = 0.6;

/**
 * Combines keyword overlap and embedding similarity for retrieval.
 */
export function rankByHybridSearch<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
  getEmbedding: (item: T) => readonly number[] | null | undefined,
  options: HybridSearchOptions = {},
): HybridSearchResult<T>[] {
  const keywordWeight = options.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  const semanticWeight = options.semanticWeight ?? DEFAULT_SEMANTIC_WEIGHT;
  const minScore = options.minScore ?? 0;

  const keywordRanked = rankByKeywordMatch(items, query, getText, 0);
  const queryEmbedding = generateLocalEmbedding(query);
  const semanticRanked = rankBySemanticSimilarity(items, queryEmbedding, getEmbedding, 0);

  const keywordByItem = new Map<T, number>();
  for (const result of keywordRanked) {
    keywordByItem.set(result.item, result.score);
  }

  const semanticByItem = new Map<T, number>();
  for (const result of semanticRanked) {
    semanticByItem.set(result.item, result.score);
  }

  const seen = new Set<T>();
  const results: HybridSearchResult<T>[] = [];

  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);

    const keywordScore = keywordByItem.get(item) ?? 0;
    const semanticScore = semanticByItem.get(item) ?? 0;
    const score = keywordScore * keywordWeight + semanticScore * semanticWeight;

    if (score >= minScore) {
      results.push({ item, score, keywordScore, semanticScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}