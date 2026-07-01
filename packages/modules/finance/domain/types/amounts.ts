import { Prisma } from '@atlas/database';

const AMOUNT_PATTERN = /^\d+(\.\d{1,4})?$/;

export function parseMonetaryAmount(
  value: string,
  field: string,
): { ok: true; amount: Prisma.Decimal } | { ok: false; field: string; message: string } {
  const trimmed = value.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    return {
      ok: false,
      field,
      message: 'Amount must be a non-negative decimal with up to 4 fractional digits',
    };
  }

  return { ok: true, amount: new Prisma.Decimal(trimmed) };
}

export function decimalToAmountString(value: Prisma.Decimal | { toString(): string }): string {
  return value.toString();
}

export function isZeroAmount(value: Prisma.Decimal): boolean {
  return value.equals(0);
}