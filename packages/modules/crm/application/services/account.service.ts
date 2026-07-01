import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  CreateCrmAccountData,
  CrmAccountRecord,
  CrmAccountRepository,
  CrmAccountStatus,
  CrmAccountType,
  UpdateCrmAccountData,
} from '../../domain/repositories/account.repository.js';
import type { Address } from '../../domain/types/address.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export interface AccountDto {
  readonly id: string;
  readonly organizationId: string;
  readonly externalId: string | null;
  readonly name: string;
  readonly legalName: string | null;
  readonly accountType: CrmAccountType;
  readonly industry: string | null;
  readonly website: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly billingAddress: Address;
  readonly shippingAddress: Address;
  readonly annualRevenue: string | null;
  readonly employeeCount: number | null;
  readonly currencyCode: string;
  readonly parentAccountId: string | null;
  readonly ownerId: string | null;
  readonly status: CrmAccountStatus;
  readonly description: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateAccountInput {
  readonly name: string;
  readonly externalId?: string;
  readonly legalName?: string;
  readonly accountType?: CrmAccountType;
  readonly industry?: string;
  readonly website?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly billingAddress?: Address;
  readonly shippingAddress?: Address;
  readonly annualRevenue?: string;
  readonly employeeCount?: number;
  readonly currencyCode?: string;
  readonly parentAccountId?: string;
  readonly ownerId?: string;
  readonly status?: CrmAccountStatus;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateAccountInput {
  readonly name?: string;
  readonly externalId?: string | null;
  readonly legalName?: string | null;
  readonly accountType?: CrmAccountType;
  readonly industry?: string | null;
  readonly website?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly billingAddress?: Address;
  readonly shippingAddress?: Address;
  readonly annualRevenue?: string | null;
  readonly employeeCount?: number | null;
  readonly currencyCode?: string;
  readonly parentAccountId?: string | null;
  readonly ownerId?: string | null;
  readonly status?: CrmAccountStatus;
  readonly description?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
}

export interface ListAccountsInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly accountType?: CrmAccountType;
  readonly status?: CrmAccountStatus;
  readonly ownerId?: string;
}

export interface AccountServiceDeps {
  readonly accountRepository: CrmAccountRepository;
}

export class AccountService {
  constructor(private readonly deps: AccountServiceDeps) {}

  async createAccount(
    organizationId: OrganizationId,
    input: CreateAccountInput,
    actorId?: UserId,
  ): Promise<Result<AccountDto, ValidationError>> {
    const name = input.name.trim();
    if (name.length === 0) {
      return err(new ValidationError('Account name is required', { field: 'name' }));
    }

    if (input.parentAccountId !== undefined) {
      const parent = await this.deps.accountRepository.findById(
        organizationId,
        input.parentAccountId,
      );
      if (parent === null) {
        return err(
          new ValidationError('Parent account not found in organization', {
            field: 'parentAccountId',
          }),
        );
      }
    }

    const createData: CreateCrmAccountData = {
      organizationId,
      name,
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.industry !== undefined ? { industry: input.industry } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
      ...(input.shippingAddress !== undefined ? { shippingAddress: input.shippingAddress } : {}),
      ...(input.annualRevenue !== undefined ? { annualRevenue: input.annualRevenue } : {}),
      ...(input.employeeCount !== undefined ? { employeeCount: input.employeeCount } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.parentAccountId !== undefined ? { parentAccountId: input.parentAccountId } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    const account = await this.deps.accountRepository.create(createData);
    return ok(this.toDto(account));
  }

  async getAccount(
    organizationId: OrganizationId,
    accountId: string,
  ): Promise<Result<AccountDto, NotFoundError>> {
    const account = await this.deps.accountRepository.findById(organizationId, accountId);
    if (account === null) {
      return err(new NotFoundError('Account', accountId));
    }
    return ok(this.toDto(account));
  }

  async updateAccount(
    organizationId: OrganizationId,
    accountId: string,
    input: UpdateAccountInput,
    actorId?: UserId,
  ): Promise<Result<AccountDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.accountRepository.findById(organizationId, accountId);
    if (existing === null) {
      return err(new NotFoundError('Account', accountId));
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Account version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Account name cannot be empty', { field: 'name' }));
    }

    if (input.parentAccountId !== undefined && input.parentAccountId !== null) {
      if (input.parentAccountId === accountId) {
        return err(
          new ValidationError('Account cannot be its own parent', { field: 'parentAccountId' }),
        );
      }

      const parent = await this.deps.accountRepository.findById(
        organizationId,
        input.parentAccountId,
      );
      if (parent === null) {
        return err(
          new ValidationError('Parent account not found in organization', {
            field: 'parentAccountId',
          }),
        );
      }
    }

    const updateData: UpdateCrmAccountData = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.industry !== undefined ? { industry: input.industry } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
      ...(input.shippingAddress !== undefined ? { shippingAddress: input.shippingAddress } : {}),
      ...(input.annualRevenue !== undefined ? { annualRevenue: input.annualRevenue } : {}),
      ...(input.employeeCount !== undefined ? { employeeCount: input.employeeCount } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.parentAccountId !== undefined ? { parentAccountId: input.parentAccountId } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.accountRepository.update(
      organizationId,
      accountId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Account was modified concurrently', {
          details: { id: accountId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listAccounts(
    organizationId: OrganizationId,
    input: ListAccountsInput = {},
  ): Promise<CursorPageResult<AccountDto>> {
    const limit = resolveListLimit(input.limit);

    const accounts = await this.deps.accountRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    });

    return {
      data: accounts.map((account) => this.toDto(account)),
      nextCursor: accounts.length === limit ? (accounts.at(-1)?.id ?? null) : null,
    };
  }

  toDto(record: CrmAccountRecord): AccountDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      externalId: record.externalId,
      name: record.name,
      legalName: record.legalName,
      accountType: record.accountType,
      industry: record.industry,
      website: record.website,
      phone: record.phone,
      email: record.email,
      billingAddress: record.billingAddress,
      shippingAddress: record.shippingAddress,
      annualRevenue: record.annualRevenue,
      employeeCount: record.employeeCount,
      currencyCode: record.currencyCode,
      parentAccountId: record.parentAccountId,
      ownerId: record.ownerId,
      status: record.status,
      description: record.description,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }
}