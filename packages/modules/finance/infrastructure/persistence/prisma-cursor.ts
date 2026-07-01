import type { Prisma } from '@atlas/database';

export interface CursorAnchor {
  readonly createdAt: Date;
  readonly id: string;
}

export function buildDescendingCursorFilter(
  anchor: CursorAnchor | null,
): { OR: Array<Record<string, unknown>> } | Record<string, never> {
  if (anchor === null) {
    return {};
  }

  return {
    OR: [
      { createdAt: { lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, id: { lt: anchor.id } },
    ],
  };
}

export function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}