import { Prisma } from '@atlas/database';
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
  ChartOfAccountRecord,
  ChartOfAccountRepository,
  CreateChartOfAccountData,
  LedgerAccountType,
  ListChartOfAccountsFilter,
  NormalBalance,
  UpdateChartOfAccountData,
} from '../../domain/repositories/chart-of-account.repository.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export interface ChartOfAccountDto {
  readonly id: string;
  readonly organizationId: string;
  readonly parentAccountId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly accountType: LedgerAccountType;
  readonly accountSubtype: string | null;
  readonly normalBalance: NormalBalance;
  readonly isActive: boolean;
  readonly isSystem: boolean;
  readonly isHeader: boolean;
  readonly currencyCode: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateChartOfAccountInput {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly accountType: LedgerAccountType;
  readonly normalBalance: NormalBalance;
  readonly parentAccountId?: string;
  readonly isActive?: boolean;
  readonly isHeader?: boolean;
  readonly currencyCode?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateChartOfAccountInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly accountType?: LedgerAccountType;
  readonly normalBalance?: NormalBalance;
  readonly parentAccountId?: string | null;
  readonly isActive?: boolean;
  readonly currencyCode?: string;
  readonly metadata?: Record<string, unknown>;
  readonly version: number;
}

export interface ListChartOfAccountsInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly accountType?: LedgerAccountType;
  readonly isActive?: boolean;
  readonly parentAccountId?: string;
}

export interface ChartOfAccountServiceDeps {
  readonly chartOfAccountRepository: ChartOfAccountRepository;
}

const EXPECTED_NORMAL_BALANCE: Record<LedgerAccountType, NormalBalance> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
};

export class ChartOfAccountService {
  constructor(private readonly deps: ChartOfAccountServiceDeps) {}

  async createAccount(
    organizationId: OrganizationId,
    input: CreateChartOfAccountInput,
    actorId?: UserId,
  ): Promise<Result<ChartOfAccountDto, ValidationError | ConflictError>> {
    const code = input.code.trim();
    const name = input.name.trim();

    if (code.length === 0) {
      return err(new ValidationError('Account code is required', { field: 'code' }));
    }

    if (name.length === 0) {
      return err(new ValidationError('Account name is required', { field: 'name' }));
    }

    const normalBalanceResult = this.validateNormalBalance(input.accountType, input.normalBalance);
    if (!normalBalanceResult.ok) {
      return normalBalanceResult;
    }

    const existing = await this.deps.chartOfAccountRepository.findByCode(organizationId, code);
    if (existing !== null) {
      return err(
        new ConflictError('Chart of account code already exists', {
          details: { code },
        }),
      );
    }

    if (input.parentAccountId !== undefined) {
      const parent = await this.deps.chartOfAccountRepository.findById(
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

    const createData: CreateChartOfAccountData = {
      organizationId,
      code,
      name,
      accountType: input.accountType,
      normalBalance: input.normalBalance,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.parentAccountId !== undefined ? { parentAccountId: input.parentAccountId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    try {
      const account = await this.deps.chartOfAccountRepository.create(createData);
      return ok(this.toDto(account));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return err(
          new ConflictError('Chart of account code already exists', {
            details: { code },
          }),
        );
      }
      throw error;
    }
  }

  async getAccount(
    organizationId: OrganizationId,
    accountId: string,
  ): Promise<Result<ChartOfAccountDto, NotFoundError>> {
    const account = await this.deps.chartOfAccountRepository.findById(organizationId, accountId);
    if (account === null) {
      return err(new NotFoundError('ChartOfAccount', accountId));
    }
    return ok(this.toDto(account));
  }

  async updateAccount(
    organizationId: OrganizationId,
    accountId: string,
    input: UpdateChartOfAccountInput,
    actorId?: UserId,
  ): Promise<Result<ChartOfAccountDto, ValidationError | NotFoundError | ConflictError>> {
    const existing = await this.deps.chartOfAccountRepository.findById(organizationId, accountId);
    if (existing === null) {
      return err(new NotFoundError('ChartOfAccount', accountId));
    }

    if (existing.isSystem) {
      return err(
        new ConflictError('System accounts cannot be modified', {
          details: { id: accountId },
        }),
      );
    }

    if (input.version !== existing.version) {
      return err(
        new ConflictError('Chart of account version mismatch', {
          details: { expected: input.version, actual: existing.version },
        }),
      );
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      return err(new ValidationError('Account name cannot be empty', { field: 'name' }));
    }

    const accountType = input.accountType ?? existing.accountType;
    const normalBalance = input.normalBalance ?? existing.normalBalance;
    const normalBalanceResult = this.validateNormalBalance(accountType, normalBalance);
    if (!normalBalanceResult.ok) {
      return normalBalanceResult;
    }

    if (input.parentAccountId !== undefined && input.parentAccountId !== null) {
      if (input.parentAccountId === accountId) {
        return err(
          new ValidationError('Account cannot be its own parent', { field: 'parentAccountId' }),
        );
      }

      const parent = await this.deps.chartOfAccountRepository.findById(
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

    const updateData: UpdateChartOfAccountData = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.normalBalance !== undefined ? { normalBalance: input.normalBalance } : {}),
      ...(input.parentAccountId !== undefined ? { parentAccountId: input.parentAccountId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    };

    const updated = await this.deps.chartOfAccountRepository.update(
      organizationId,
      accountId,
      updateData,
      input.version,
    );

    if (updated === null) {
      return err(
        new ConflictError('Chart of account was modified concurrently', {
          details: { id: accountId, expectedVersion: input.version },
        }),
      );
    }

    return ok(this.toDto(updated));
  }

  async listAccounts(
    organizationId: OrganizationId,
    input: ListChartOfAccountsInput = {},
  ): Promise<CursorPageResult<ChartOfAccountDto>> {
    const limit = resolveListLimit(input.limit);

    const accounts = await this.deps.chartOfAccountRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.parentAccountId !== undefined ? { parentAccountId: input.parentAccountId } : {}),
    } satisfies ListChartOfAccountsFilter);

    return {
      data: accounts.map((account) => this.toDto(account)),
      nextCursor: accounts.length === limit ? (accounts.at(-1)?.id ?? null) : null,
    };
  }

  toDto(record: ChartOfAccountRecord): ChartOfAccountDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      parentAccountId: record.parentAccountId,
      code: record.code,
      name: record.name,
      description: record.description,
      accountType: record.accountType,
      accountSubtype: null,
      normalBalance: record.normalBalance,
      isActive: record.isActive,
      isSystem: record.isSystem,
      isHeader: false,
      currencyCode: record.currencyCode,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }

  private validateNormalBalance(
    accountType: LedgerAccountType,
    normalBalance: NormalBalance,
  ): Result<void, ValidationError> {
    if (EXPECTED_NORMAL_BALANCE[accountType] !== normalBalance) {
      return err(
        new ValidationError(
          `Normal balance for ${accountType} accounts must be ${EXPECTED_NORMAL_BALANCE[accountType]}`,
          { field: 'normalBalance' },
        ),
      );
    }

    return ok(undefined);
  }
}