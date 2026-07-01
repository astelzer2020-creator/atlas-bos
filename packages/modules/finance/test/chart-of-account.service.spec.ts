import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { ChartOfAccountService } from '../application/services/chart-of-account.service.js';
import type {
  ChartOfAccountRecord,
  ChartOfAccountRepository,
} from '../domain/repositories/chart-of-account.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const ACCOUNT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createAccountRecord(overrides: Partial<ChartOfAccountRecord> = {}): ChartOfAccountRecord {
  return {
    id: ACCOUNT_ID,
    organizationId: ORG_ID,
    parentAccountId: null,
    code: '1000',
    name: 'Cash',
    description: null,
    accountType: 'asset',
    normalBalance: 'debit',
    isActive: true,
    isSystem: false,
    currencyCode: 'USD',
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    deletedAt: null,
    createdBy: USER_ID,
    updatedBy: null,
    version: 1,
    ...overrides,
  };
}

function createChartOfAccountService(repository: Partial<ChartOfAccountRepository> = {}) {
  const chartOfAccountRepository: ChartOfAccountRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createAccountRecord()),
    update: vi.fn().mockResolvedValue(createAccountRecord({ version: 2 })),
    list: vi.fn().mockResolvedValue([createAccountRecord()]),
    ...repository,
  };

  return {
    service: new ChartOfAccountService({ chartOfAccountRepository }),
    chartOfAccountRepository,
  };
}

describe('ChartOfAccountService', () => {
  it('createAccount creates GL account with trimmed fields', async () => {
    const { service, chartOfAccountRepository } = createChartOfAccountService();

    const result = await service.createAccount(
      ORG_ID,
      {
        code: ' 1000 ',
        name: ' Cash ',
        accountType: 'asset',
        normalBalance: 'debit',
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.code).toBe('1000');
      expect(result.value.name).toBe('Cash');
      expect(result.value.isHeader).toBe(false);
    }

    expect(chartOfAccountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        code: '1000',
        name: 'Cash',
      }),
    );
  });

  it('createAccount rejects invalid normal balance for account type', async () => {
    const { service } = createChartOfAccountService();

    const result = await service.createAccount(ORG_ID, {
      code: '4000',
      name: 'Revenue',
      accountType: 'revenue',
      normalBalance: 'debit',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createAccount rejects duplicate account code', async () => {
    const { service } = createChartOfAccountService({
      findByCode: vi.fn().mockResolvedValue(createAccountRecord()),
    });

    const result = await service.createAccount(ORG_ID, {
      code: '1000',
      name: 'Duplicate Cash',
      accountType: 'asset',
      normalBalance: 'debit',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('getAccount returns not found for missing account', async () => {
    const { service } = createChartOfAccountService();

    const result = await service.getAccount(ORG_ID, ACCOUNT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('updateAccount rejects system accounts', async () => {
    const { service } = createChartOfAccountService({
      findById: vi.fn().mockResolvedValue(createAccountRecord({ isSystem: true })),
    });

    const result = await service.updateAccount(
      ORG_ID,
      ACCOUNT_ID,
      { name: 'Updated', version: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('updateAccount enforces optimistic version check', async () => {
    const { service } = createChartOfAccountService({
      findById: vi.fn().mockResolvedValue(createAccountRecord({ version: 2 })),
    });

    const result = await service.updateAccount(
      ORG_ID,
      ACCOUNT_ID,
      { name: 'Updated', version: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('listAccounts returns cursor page with next cursor when full page', async () => {
    const { service } = createChartOfAccountService({
      list: vi.fn().mockResolvedValue([
        createAccountRecord({ id: '11111111-1111-4111-8111-111111111111' }),
        createAccountRecord({ id: '22222222-2222-4222-8222-222222222222' }),
      ]),
    });

    const result = await service.listAccounts(ORG_ID, { limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe('22222222-2222-4222-8222-222222222222');
  });
});