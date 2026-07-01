import { z } from 'zod';

import { ValidationError } from '../errors/domain-errors.js';
import { err, ok, type Result } from '../result/result.js';

const currencySchema = z
  .string()
  .trim()
  .length(3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  .regex(/^[A-Z]{3}$/, { message: 'Currency must be uppercase ISO 4217' })
  .transform((value) => value as CurrencyCode);

const integerCentsSchema = z
  .union([z.bigint(), z.number().int()])
  .refine(
    (value) => {
      if (typeof value === 'bigint') {
        return true;
      }
      return Number.isSafeInteger(value);
    },
    { message: 'Amount in cents must be a safe integer' },
  )
  .transform((value) => (typeof value === 'bigint' ? value : BigInt(value)));

/** ISO 4217 currency code (e.g. USD, EUR). */
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };

/** Immutable monetary amount stored as integer cents with an ISO currency code. */
export class Money {
  readonly amountInCents: bigint;
  readonly currency: CurrencyCode;

  private constructor(amountInCents: bigint, currency: CurrencyCode) {
    this.amountInCents = amountInCents;
    this.currency = currency;
  }

  /** Creates a {@link Money} value from cents and a currency code. */
  static create(
    amountInCents: bigint | number,
    currency: string,
  ): Result<Money, ValidationError> {
    const parsedCurrency = currencySchema.safeParse(currency);
    if (!parsedCurrency.success) {
      return err(
        new ValidationError('Invalid currency code', {
          field: 'currency',
          details: { currency, issues: parsedCurrency.error.issues },
        }),
      );
    }

    const parsedAmount = integerCentsSchema.safeParse(amountInCents);
    if (!parsedAmount.success) {
      return err(
        new ValidationError('Invalid amount in cents', {
          field: 'amountInCents',
          details: { amountInCents, issues: parsedAmount.error.issues },
        }),
      );
    }

    return ok(new Money(parsedAmount.data, parsedCurrency.data));
  }

  /** Creates a zero-valued {@link Money} instance for the given currency. */
  static zero(currency: string): Result<Money, ValidationError> {
    return Money.create(0n, currency);
  }

  /** Adds two monetary amounts of the same currency. */
  add(other: Money): Result<Money, ValidationError> {
    if (this.currency !== other.currency) {
      return err(
        new ValidationError('Cannot add money with different currencies', {
          details: { left: this.currency, right: other.currency },
        }),
      );
    }
    return ok(new Money(this.amountInCents + other.amountInCents, this.currency));
  }

  /** Subtracts another monetary amount of the same currency. */
  subtract(other: Money): Result<Money, ValidationError> {
    if (this.currency !== other.currency) {
      return err(
        new ValidationError('Cannot subtract money with different currencies', {
          details: { left: this.currency, right: other.currency },
        }),
      );
    }
    return ok(new Money(this.amountInCents - other.amountInCents, this.currency));
  }

  /** Returns true when the amount is exactly zero. */
  isZero(): boolean {
    return this.amountInCents === 0n;
  }

  /** Returns true when the amount is negative. */
  isNegative(): boolean {
    return this.amountInCents < 0n;
  }

  /** Value-based equality check (amount and currency). */
  equals(other: Money): boolean {
    return this.amountInCents === other.amountInCents && this.currency === other.currency;
  }
}