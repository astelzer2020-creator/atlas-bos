import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/errors/domain-errors.js';
import { Slug } from '../src/value-objects/slug.js';

describe('Slug', () => {
  it('accepts valid lowercase slugs', () => {
    const result = Slug.create('atlas-bos-v2');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe('atlas-bos-v2');
    }
  });

  it('rejects uppercase characters and leading hyphens', () => {
    const uppercase = Slug.create('Atlas-BOS');
    const leadingHyphen = Slug.create('-invalid');

    expect(uppercase.ok).toBe(false);
    expect(leadingHyphen.ok).toBe(false);

    if (!uppercase.ok) {
      expect(uppercase.error).toBeInstanceOf(ValidationError);
      expect(uppercase.error.field).toBe('slug');
    }
  });

  it('parses unknown values with type checking', () => {
    const valid = Slug.parse('workspace-1');
    const invalid = Slug.parse(['workspace']);

    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
  });

  it('compares slugs by value', () => {
    const left = Slug.create('team-alpha');
    const right = Slug.create('team-alpha');
    const different = Slug.create('team-beta');

    expect(left.ok && right.ok && left.value.equals(right.value)).toBe(true);
    expect(left.ok && different.ok && left.value.equals(different.value)).toBe(false);
  });
});