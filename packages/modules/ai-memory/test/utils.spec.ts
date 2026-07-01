import { describe, expect, it } from 'vitest';

import { computeContentHash } from '../domain/utils/content-hash.js';
import { rankByKeywordMatch } from '../domain/utils/keyword-search.js';
import { splitByParagraphs } from '../domain/utils/paragraph-chunker.js';

describe('AI memory utilities', () => {
  it('computeContentHash is deterministic', () => {
    const hash1 = computeContentHash('hello world');
    const hash2 = computeContentHash('hello world');

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('splitByParagraphs splits on blank lines', () => {
    const chunks = splitByParagraphs('First paragraph.\n\nSecond paragraph.');

    expect(chunks).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it('rankByKeywordMatch scores exact phrase highest', () => {
    const items = [
      { id: '1', text: 'Atlas BOS platform' },
      { id: '2', text: 'Unrelated ledger entry' },
    ];

    const ranked = rankByKeywordMatch(items, 'Atlas BOS', (item) => item.text);

    expect(ranked[0]?.item.id).toBe('1');
    expect(ranked[0]?.score).toBe(1);
  });
});