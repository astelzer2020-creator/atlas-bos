export interface KeywordSearchResult<T> {
  readonly item: T;
  readonly score: number;
}

/**
 * Keyword matcher — ranks items by simple text overlap (used by hybrid search).
 */
export function rankByKeywordMatch<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
  minScore = 0,
): KeywordSearchResult<T>[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [];
  }

  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 0);

  const results: KeywordSearchResult<T>[] = [];

  for (const item of items) {
    const text = getText(item).toLowerCase();
    let score = 0;

    if (text.includes(normalizedQuery)) {
      score = 1;
    } else {
      const matchedTerms = terms.filter((term) => text.includes(term)).length;
      if (matchedTerms > 0) {
        score = matchedTerms / terms.length;
      }
    }

    if (score >= minScore) {
      results.push({ item, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}