import { describe, expect, it } from 'vitest';

import { slugify } from '../src/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates text', () => {
    expect(slugify('Acme Corporation')).toBe('acme-corporation');
  });

  it('strips special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ---Atlas---  ')).toBe('atlas');
  });

  it('limits length to 64 characters', () => {
    const long = 'a'.repeat(80);
    expect(slugify(long).length).toBe(64);
  });
});