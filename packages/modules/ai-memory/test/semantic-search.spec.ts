import { describe, expect, it } from 'vitest';

import { generateLocalEmbedding } from '../domain/utils/embedding.js';
import { rankByHybridSearch } from '../domain/utils/hybrid-search.js';
import {
  cosineSimilarity,
  rankBySemanticSimilarity,
} from '../domain/utils/semantic-search.js';

describe('semantic search utilities', () => {
  it('generateLocalEmbedding is deterministic and normalized', () => {
    const first = generateLocalEmbedding('Atlas business operating system');
    const second = generateLocalEmbedding('Atlas business operating system');

    expect(first).toEqual(second);

    const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('cosineSimilarity ranks identical vectors highest', () => {
    const vector = generateLocalEmbedding('customer onboarding workflow');
    const score = cosineSimilarity(vector, vector);

    expect(score).toBeCloseTo(1, 5);
  });

  it('rankBySemanticSimilarity prefers semantically similar chunks', () => {
    const queryEmbedding = generateLocalEmbedding('customer onboarding workflow');
    const items = [
      { id: '1', text: 'customer onboarding workflow steps', embedding: generateLocalEmbedding('customer onboarding workflow steps') },
      { id: '2', text: 'quarterly tax filing deadline', embedding: generateLocalEmbedding('quarterly tax filing deadline') },
    ];

    const ranked = rankBySemanticSimilarity(
      items,
      queryEmbedding,
      (item) => item.embedding,
      0,
    );

    expect(ranked.length).toBeGreaterThanOrEqual(1);
    expect(ranked[0]?.item.id).toBe('1');
    if (ranked.length > 1) {
      expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
    }
  });

  it('rankByHybridSearch combines keyword and semantic signals', () => {
    const items = [
      {
        id: '1',
        text: 'Atlas BOS workflow automation',
        embedding: generateLocalEmbedding('Atlas BOS workflow automation'),
      },
      {
        id: '2',
        text: 'Unrelated ledger reconciliation',
        embedding: generateLocalEmbedding('Unrelated ledger reconciliation'),
      },
    ];

    const ranked = rankByHybridSearch(
      items,
      'Atlas BOS',
      (item) => item.text,
      (item) => item.embedding,
    );

    expect(ranked[0]?.item.id).toBe('1');
    expect(ranked[0]!.keywordScore).toBeGreaterThan(0);
    expect(ranked[0]!.semanticScore).toBeGreaterThan(ranked[1]!.semanticScore);
  });
});