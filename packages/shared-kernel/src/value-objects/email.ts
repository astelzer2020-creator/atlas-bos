import { z } from 'zod';

import { ValidationError } from '../errors/domain-errors.js';
import { err, ok, type Result } from '../result/result.js';

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: 'Email must not be empty' })
  .email({ message: 'Invalid email format' })
  .transform((value) => value.toLowerCase());

/** Immutable, validated email address value object. */
export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Creates an {@link Email} from a raw string after validation and normalization. */
  static create(raw: string): Result<Email, ValidationError> {
    const parsed = emailSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new ValidationError('Invalid email address', {
          field: 'email',
          details: { value: raw, issues: parsed.error.issues },
        }),
      );
    }
    return ok(new Email(parsed.data));
  }

  /** Parses an unknown value into an {@link Email}. */
  static parse(value: unknown): Result<Email, ValidationError> {
    if (typeof value !== 'string') {
      return err(
        new ValidationError('Invalid email address: expected a string', {
          field: 'email',
          details: { receivedType: typeof value },
        }),
      );
    }
    return Email.create(value);
  }

  /** Returns the normalized email string. */
  toString(): string {
    return this.value;
  }

  /** Value-based equality check. */
  equals(other: Email): boolean {
    return this.value === other.value;
  }
}