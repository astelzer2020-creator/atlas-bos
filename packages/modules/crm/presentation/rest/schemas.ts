import { z } from 'zod';

const addressSchema = z.record(z.unknown()).optional();

const accountTypeSchema = z.enum([
  'prospect',
  'customer',
  'partner',
  'vendor',
  'competitor',
  'other',
]);

const accountStatusSchema = z.enum(['active', 'inactive', 'archived']);
const contactStatusSchema = z.enum(['active', 'inactive', 'bounced', 'unsubscribed']);
const dealStatusSchema = z.enum(['open', 'won', 'lost', 'abandoned']);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const accountParamsSchema = z.object({
  organizationId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const contactParamsSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const dealParamsSchema = z.object({
  organizationId: z.string().uuid(),
  dealId: z.string().uuid(),
});

export const pipelineStageParamsSchema = z.object({
  organizationId: z.string().uuid(),
  stageId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listAccountsQuerySchema = paginationQueryBase
  .extend({
    accountType: accountTypeSchema.optional(),
    status: accountStatusSchema.optional(),
    ownerId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.accountType !== undefined ? { accountType: value.accountType } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
  }));

export const createAccountBodySchema = z
  .object({
    name: z.string().min(1).max(256),
    externalId: z.string().max(128).optional(),
    legalName: z.string().max(256).optional(),
    accountType: accountTypeSchema.optional(),
    industry: z.string().max(128).optional(),
    website: z.string().max(512).optional(),
    phone: z.string().max(64).optional(),
    email: z.string().email().optional(),
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    annualRevenue: z.string().optional(),
    employeeCount: z.coerce.number().int().min(0).optional(),
    currencyCode: z.string().length(3).optional(),
    parentAccountId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional(),
    status: accountStatusSchema.optional(),
    description: z.string().max(4096).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    name: value.name,
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
    ...(value.legalName !== undefined ? { legalName: value.legalName } : {}),
    ...(value.accountType !== undefined ? { accountType: value.accountType } : {}),
    ...(value.industry !== undefined ? { industry: value.industry } : {}),
    ...(value.website !== undefined ? { website: value.website } : {}),
    ...(value.phone !== undefined ? { phone: value.phone } : {}),
    ...(value.email !== undefined ? { email: value.email } : {}),
    ...(value.billingAddress !== undefined ? { billingAddress: value.billingAddress } : {}),
    ...(value.shippingAddress !== undefined ? { shippingAddress: value.shippingAddress } : {}),
    ...(value.annualRevenue !== undefined ? { annualRevenue: value.annualRevenue } : {}),
    ...(value.employeeCount !== undefined ? { employeeCount: value.employeeCount } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.parentAccountId !== undefined ? { parentAccountId: value.parentAccountId } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateAccountBodySchema = z
  .object({
    version: z.number().int().min(1),
    name: z.string().min(1).max(256).optional(),
    externalId: z.string().max(128).nullable().optional(),
    legalName: z.string().max(256).nullable().optional(),
    accountType: accountTypeSchema.optional(),
    industry: z.string().max(128).nullable().optional(),
    website: z.string().max(512).nullable().optional(),
    phone: z.string().max(64).nullable().optional(),
    email: z.string().email().nullable().optional(),
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    annualRevenue: z.string().nullable().optional(),
    employeeCount: z.coerce.number().int().min(0).nullable().optional(),
    currencyCode: z.string().length(3).optional(),
    parentAccountId: z.string().uuid().nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    status: accountStatusSchema.optional(),
    description: z.string().max(4096).nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    version: value.version,
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
    ...(value.legalName !== undefined ? { legalName: value.legalName } : {}),
    ...(value.accountType !== undefined ? { accountType: value.accountType } : {}),
    ...(value.industry !== undefined ? { industry: value.industry } : {}),
    ...(value.website !== undefined ? { website: value.website } : {}),
    ...(value.phone !== undefined ? { phone: value.phone } : {}),
    ...(value.email !== undefined ? { email: value.email } : {}),
    ...(value.billingAddress !== undefined ? { billingAddress: value.billingAddress } : {}),
    ...(value.shippingAddress !== undefined ? { shippingAddress: value.shippingAddress } : {}),
    ...(value.annualRevenue !== undefined ? { annualRevenue: value.annualRevenue } : {}),
    ...(value.employeeCount !== undefined ? { employeeCount: value.employeeCount } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.parentAccountId !== undefined ? { parentAccountId: value.parentAccountId } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listContactsQuerySchema = paginationQueryBase
  .extend({
    accountId: z.string().uuid().optional(),
    status: contactStatusSchema.optional(),
    ownerId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.accountId !== undefined ? { accountId: value.accountId } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
  }));

export const createContactBodySchema = z
  .object({
    displayName: z.string().min(1).max(256),
    externalId: z.string().max(128).optional(),
    accountId: z.string().uuid().optional(),
    salutation: z.string().max(32).optional(),
    firstName: z.string().max(128).optional(),
    lastName: z.string().max(128).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(64).optional(),
    mobile: z.string().max(64).optional(),
    jobTitle: z.string().max(128).optional(),
    department: z.string().max(128).optional(),
    mailingAddress: addressSchema,
    isPrimary: z.boolean().optional(),
    ownerId: z.string().uuid().optional(),
    leadSource: z.string().max(128).optional(),
    status: contactStatusSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    displayName: value.displayName,
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
    ...(value.accountId !== undefined ? { accountId: value.accountId } : {}),
    ...(value.salutation !== undefined ? { salutation: value.salutation } : {}),
    ...(value.firstName !== undefined ? { firstName: value.firstName } : {}),
    ...(value.lastName !== undefined ? { lastName: value.lastName } : {}),
    ...(value.email !== undefined ? { email: value.email } : {}),
    ...(value.phone !== undefined ? { phone: value.phone } : {}),
    ...(value.mobile !== undefined ? { mobile: value.mobile } : {}),
    ...(value.jobTitle !== undefined ? { jobTitle: value.jobTitle } : {}),
    ...(value.department !== undefined ? { department: value.department } : {}),
    ...(value.mailingAddress !== undefined ? { mailingAddress: value.mailingAddress } : {}),
    ...(value.isPrimary !== undefined ? { isPrimary: value.isPrimary } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.leadSource !== undefined ? { leadSource: value.leadSource } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateContactBodySchema = z
  .object({
    version: z.number().int().min(1),
    displayName: z.string().min(1).max(256).optional(),
    externalId: z.string().max(128).nullable().optional(),
    accountId: z.string().uuid().nullable().optional(),
    salutation: z.string().max(32).nullable().optional(),
    firstName: z.string().max(128).nullable().optional(),
    lastName: z.string().max(128).nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(64).nullable().optional(),
    mobile: z.string().max(64).nullable().optional(),
    jobTitle: z.string().max(128).nullable().optional(),
    department: z.string().max(128).nullable().optional(),
    mailingAddress: addressSchema,
    isPrimary: z.boolean().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    leadSource: z.string().max(128).nullable().optional(),
    status: contactStatusSchema.optional(),
    lastContactedAt: z.string().datetime().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    version: value.version,
    ...(value.displayName !== undefined ? { displayName: value.displayName } : {}),
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
    ...(value.accountId !== undefined ? { accountId: value.accountId } : {}),
    ...(value.salutation !== undefined ? { salutation: value.salutation } : {}),
    ...(value.firstName !== undefined ? { firstName: value.firstName } : {}),
    ...(value.lastName !== undefined ? { lastName: value.lastName } : {}),
    ...(value.email !== undefined ? { email: value.email } : {}),
    ...(value.phone !== undefined ? { phone: value.phone } : {}),
    ...(value.mobile !== undefined ? { mobile: value.mobile } : {}),
    ...(value.jobTitle !== undefined ? { jobTitle: value.jobTitle } : {}),
    ...(value.department !== undefined ? { department: value.department } : {}),
    ...(value.mailingAddress !== undefined ? { mailingAddress: value.mailingAddress } : {}),
    ...(value.isPrimary !== undefined ? { isPrimary: value.isPrimary } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.leadSource !== undefined ? { leadSource: value.leadSource } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.lastContactedAt !== undefined ? { lastContactedAt: value.lastContactedAt } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listDealsQuerySchema = paginationQueryBase
  .extend({
    status: dealStatusSchema.optional(),
    pipelineStageId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.pipelineStageId !== undefined ? { pipelineStageId: value.pipelineStageId } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.accountId !== undefined ? { accountId: value.accountId } : {}),
  }));

export const createDealBodySchema = z
  .object({
    name: z.string().min(1).max(256),
    pipelineStageId: z.string().uuid(),
    ownerId: z.string().uuid(),
    externalId: z.string().max(128).optional(),
    accountId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    amount: z.string().optional(),
    currencyCode: z.string().length(3).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    expectedCloseDate: z.string().date().optional(),
    leadSource: z.string().max(128).optional(),
    description: z.string().max(4096).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    name: value.name,
    pipelineStageId: value.pipelineStageId,
    ownerId: value.ownerId,
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
    ...(value.accountId !== undefined ? { accountId: value.accountId } : {}),
    ...(value.contactId !== undefined ? { contactId: value.contactId } : {}),
    ...(value.amount !== undefined ? { amount: value.amount } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.probability !== undefined ? { probability: value.probability } : {}),
    ...(value.expectedCloseDate !== undefined
      ? { expectedCloseDate: value.expectedCloseDate }
      : {}),
    ...(value.leadSource !== undefined ? { leadSource: value.leadSource } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateDealBodySchema = z
  .object({
    version: z.number().int().min(1),
    name: z.string().min(1).max(256).optional(),
    externalId: z.string().max(128).nullable().optional(),
    accountId: z.string().uuid().nullable().optional(),
    contactId: z.string().uuid().nullable().optional(),
    pipelineStageId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional(),
    amount: z.string().optional(),
    currencyCode: z.string().length(3).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    expectedCloseDate: z.string().date().nullable().optional(),
    actualCloseDate: z.string().date().nullable().optional(),
    status: dealStatusSchema.optional(),
    lossReason: z.string().max(1024).nullable().optional(),
    leadSource: z.string().max(128).nullable().optional(),
    description: z.string().max(4096).nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    version: value.version,
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.externalId !== undefined ? { externalId: value.externalId } : {}),
    ...(value.accountId !== undefined ? { accountId: value.accountId } : {}),
    ...(value.contactId !== undefined ? { contactId: value.contactId } : {}),
    ...(value.pipelineStageId !== undefined ? { pipelineStageId: value.pipelineStageId } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.amount !== undefined ? { amount: value.amount } : {}),
    ...(value.currencyCode !== undefined ? { currencyCode: value.currencyCode } : {}),
    ...(value.probability !== undefined ? { probability: value.probability } : {}),
    ...(value.expectedCloseDate !== undefined
      ? { expectedCloseDate: value.expectedCloseDate }
      : {}),
    ...(value.actualCloseDate !== undefined ? { actualCloseDate: value.actualCloseDate } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.lossReason !== undefined ? { lossReason: value.lossReason } : {}),
    ...(value.leadSource !== undefined ? { leadSource: value.leadSource } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listPipelineStagesQuerySchema = paginationQueryBase
  .extend({
    pipelineId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.pipelineId !== undefined ? { pipelineId: value.pipelineId } : {}),
  }));

export const createPipelineStageBodySchema = z
  .object({
    name: z.string().min(1).max(128),
    pipelineId: z.string().uuid().optional(),
    pipelineName: z.string().max(128).optional(),
    description: z.string().max(4096).optional(),
    sortOrder: z.coerce.number().int().min(1).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    isDefault: z.boolean().optional(),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
    isClosed: z.boolean().optional(),
    color: z.string().max(32).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    name: value.name,
    ...(value.pipelineId !== undefined ? { pipelineId: value.pipelineId } : {}),
    ...(value.pipelineName !== undefined ? { pipelineName: value.pipelineName } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.sortOrder !== undefined ? { sortOrder: value.sortOrder } : {}),
    ...(value.probability !== undefined ? { probability: value.probability } : {}),
    ...(value.isDefault !== undefined ? { isDefault: value.isDefault } : {}),
    ...(value.isWon !== undefined ? { isWon: value.isWon } : {}),
    ...(value.isLost !== undefined ? { isLost: value.isLost } : {}),
    ...(value.isClosed !== undefined ? { isClosed: value.isClosed } : {}),
    ...(value.color !== undefined ? { color: value.color } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updatePipelineStageBodySchema = z
  .object({
    version: z.number().int().min(1),
    name: z.string().min(1).max(128).optional(),
    pipelineName: z.string().max(128).optional(),
    description: z.string().max(4096).nullable().optional(),
    sortOrder: z.coerce.number().int().min(1).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    isDefault: z.boolean().optional(),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
    isClosed: z.boolean().optional(),
    color: z.string().max(32).nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    version: value.version,
    ...(value.name !== undefined ? { name: value.name } : {}),
    ...(value.pipelineName !== undefined ? { pipelineName: value.pipelineName } : {}),
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.sortOrder !== undefined ? { sortOrder: value.sortOrder } : {}),
    ...(value.probability !== undefined ? { probability: value.probability } : {}),
    ...(value.isDefault !== undefined ? { isDefault: value.isDefault } : {}),
    ...(value.isWon !== undefined ? { isWon: value.isWon } : {}),
    ...(value.isLost !== undefined ? { isLost: value.isLost } : {}),
    ...(value.isClosed !== undefined ? { isClosed: value.isClosed } : {}),
    ...(value.color !== undefined ? { color: value.color } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
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
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}