import { describe, expect, it } from 'vitest';

import { generateLocalEmbedding, rankByHybridSearch } from '@atlas/module-ai-memory';

const ITEM_COUNT = 2_000;
const QUERY = 'customer onboarding workflow automation';

function buildDataset() {
  return Array.from({ length: ITEM_COUNT }, (_, index) => ({
    id: `chunk-${index}`,
    text: index % 17 === 0
      ? 'customer onboarding workflow automation guide'
      : `generic business record ${index} with ledger and finance metadata`,
    embedding: generateLocalEmbedding(
      index % 17 === 0
        ? 'customer onboarding workflow automation guide'
        : `generic business record ${index}`,
    ),
  }));
}

describe('hybrid search performance', () => {
  it('ranks 2000 chunks under 500ms', () => {
    const items = buildDataset();
    const started = performance.now();

    const ranked = rankByHybridSearch(
      items,
      QUERY,
      (item) => item.text,
      (item) => item.embedding,
      { minScore: 0.1 },
    );

    const elapsed = performance.now() - started;

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.item.id).toMatch(/^chunk-/);
    expect(elapsed).toBeLessThan(500);
  });
});