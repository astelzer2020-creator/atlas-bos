import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/errors/domain-errors.js';
import { Email } from '../src/value-objects/email.js';

describe('Email', () => {
  it('creates and normalizes valid email addresses', () => {
    const result = Email.create('  User@Example.COM  ');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe('user@example.com');
      expect(result.value.toString()).toBe('user@example.com');
    }
  });

  it('rejects invalid email formats', () => {
    const result = Email.create('not-an-email');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.field).toBe('email');
    }
  });

  it('parses unknown values with type checking', () => {
    const valid = Email.parse('ops@atlas.dev');
    const invalid = Email.parse(123);

    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
  });

  it('compares emails by normalized value', () => {
    const left = Email.create('a@b.com');
    const right = Email.create('A@B.COM');

    expect(left.ok && right.ok && left.value.equals(right.value)).toBe(true);
  });
});