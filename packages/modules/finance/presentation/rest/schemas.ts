import { z } from 'zod';

const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);
const normalBalanceSchema = z.enum(['debit', 'credit']);
const journalEntryStatusSchema = z.enum(['draft', 'posted', 'reversed']);
const journalEntryTypeSchema = z.enum([
  'standard',
  'adjusting',
  'closing',
  'reversing',
  'system',
]);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const chartOfAccountParamsSchema = z.object({
  organizationId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const journalEntryParamsSchema = z.object({
  organizationId: z.string().uuid(),
  entryId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listChartOfAccountsQuerySchema = paginationQueryBase
  .extend({
    accountType: accountTypeSchema.optional(),
    isActive: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        return value === true || value === 'true';
      }),
    parentAccountId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.accountType !== undefined ? { accountType: value.accountType } : {}),
    ...(value.isActive !== undefined ? { isActive: value.isActive } : {}),
    ...(value.parentAccountId !== undefined ? { parentAccountId: value.parentAccountId } : {}),
  }));

export const createChartOfAccountBodySchema = z
  .object({
    parentAccountId: z.string().uuid().optional(),
    code: z.string().min(1).max(64),
    name: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    accountType: accountTypeSchema,
    accountSubtype: z.string().max(128).optional(),
    normalBalance: normalBalanceSchema,
    isActive: z.boolean().optional(),
    isHeader: z.boolean().optional(),
    currencyCode: z.string().length(3).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    code: value.code,
    name: value.name,
    accountType: value.accountType,
    normalBalance: value.normalBalance,
    ...(value.parentAccountId !== undefined ? { parentAccountId: value.parentAccountId } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.isActive !== undefined ? { isActive: value.isActive } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateChartOfAccountBodySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).nullable().optional(),
    accountType: accountTypeSchema.optional(),
    normalBalance: normalBalanceSchema.optional(),
    parentAccountId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    currencyCode: z.string().length(3).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.accountType !== undefined ? { accountType: value.accountType } : {}),
    ...(value.normalBalance !== undefined ? { normalBalance: value.normalBalance } : {}),
    ...(value.parentAccountId !== undefined ? { parentAccountId: value.parentAccountId } : {}),
    ...(value.isActive !== undefined ? { isActive: value.isActive } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

const journalLineCreateSchema = z.object({
  lineNumber: z.number().int().min(1).optional(),
  accountId: z.string().uuid(),
  description: z.string().max(4096).optional(),
  debitAmount: z.string().optional(),
  creditAmount: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createJournalEntryBodySchema = z
  .object({
    entryNumber: z.string().min(1).max(64).optional(),
    entryDate: z.string().optional(),
    entryType: journalEntryTypeSchema.optional(),
    description: z.string().min(1).max(4096),
    referenceType: z.string().max(128).optional(),
    referenceId: z.string().uuid().optional(),
    currencyCode: z.string().length(3).optional(),
    lines: z.array(journalLineCreateSchema).min(2),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    description: value.description,
    lines: value.lines,
    ...(value.entryNumber !== undefined ? { entryNumber: value.entryNumber } : {}),
    ...(value.entryDate !== undefined ? { entryDate: value.entryDate } : {}),
    ...(value.entryType !== undefined ? { entryType: value.entryType } : {}),
    ...(value.referenceType !== undefined ? { referenceType: value.referenceType } : {}),
    ...(value.referenceId !== undefined ? { referenceId: value.referenceId } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listJournalEntriesQuerySchema = paginationQueryBase
  .extend({
    status: journalEntryStatusSchema.optional(),
    entryType: journalEntryTypeSchema.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.entryType !== undefined ? { entryType: value.entryType } : {}),
    ...(value.fromDate !== undefined ? { fromDate: value.fromDate } : {}),
    ...(value.toDate !== undefined ? { toDate: value.toDate } : {}),
  }));

export function parseIfMatchHeader(value: string | string[] | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}