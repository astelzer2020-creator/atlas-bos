import { z } from 'zod';

import { ValidationError } from '../errors/domain-errors.js';
import { err, ok, type Result } from '../result/result.js';

const slugSchema = z
  .string()
  .trim()
  .min(1, { message: 'Slug must not be empty' })
  .max(64, { message: 'Slug must not exceed 64 characters' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain lowercase letters, numbers, and single hyphens only',
  });

/** Immutable URL-safe slug value object. */
export class Slug {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Creates a {@link Slug} from a raw string after validation. */
  static create(raw: string): Result<Slug, ValidationError> {
    const parsed = slugSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new ValidationError('Invalid slug', {
          field: 'slug',
          details: { value: raw, issues: parsed.error.issues },
        }),
      );
    }
    return ok(new Slug(parsed.data));
  }

  /** Parses an unknown value into a {@link Slug}. */
  static parse(value: unknown): Result<Slug, ValidationError> {
    if (typeof value !== 'string') {
      return err(
        new ValidationError('Invalid slug: expected a string', {
          field: 'slug',
          details: { receivedType: typeof value },
        }),
      );
    }
    return Slug.create(value);
  }

  /** Returns the slug string. */
  toString(): string {
    return this.value;
  }

  /** Value-based equality check. */
  equals(other: Slug): boolean {
    return this.value === other.value;
  }
}