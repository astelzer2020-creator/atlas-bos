export interface CursorPageResult<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export function resolveListLimit(limit?: number): number {
  return Math.min(limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
}