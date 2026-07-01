import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidSchema = z.string().regex(UUID_REGEX, 'Must be a valid UUID');

export const uuidParam = z.object({
  id: uuidSchema,
});

export type UuidParam = z.infer<typeof uuidParam>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export const paginationQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    cursor: z.string().min(1).optional(),
  })
  .transform((value) => ({
    page: value.page,
    pageSize: value.pageSize,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
  }));

export type PaginationQuery = z.infer<typeof paginationQuery>;

export function parseUuidParam(input: unknown): UuidParam {
  return uuidParam.parse(input);
}

export function parsePaginationQuery(input: unknown): PaginationQuery {
  return paginationQuery.parse(input);
}