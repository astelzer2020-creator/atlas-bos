import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { AccountService } from '../application/services/account.service.js';
import type {
  CrmAccountRecord,
  CrmAccountRepository,
} from '../domain/repositories/account.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const ACCOUNT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createAccountRecord(overrides: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: ACCOUNT_ID,
    organizationId: ORG_ID,
    externalId: null,
    name: 'Acme Corp',
    legalName: null,
    accountType: 'prospect',
    industry: null,
    website: null,
    phone: null,
    email: null,
    billingAddress: {},
    shippingAddress: {},
    annualRevenue: null,
    employeeCount: null,
    currencyCode: 'USD',
    parentAccountId: null,
    ownerId: null,
    status: 'active',
    description: null,
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

function createAccountService(repository: Partial<CrmAccountRepository> = {}) {
  const accountRepository: CrmAccountRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createAccountRecord()),
    update: vi.fn().mockResolvedValue(createAccountRecord({ version: 2 })),
    list: vi.fn().mockResolvedValue([createAccountRecord()]),
    ...repository,
  };

  return {
    service: new AccountService({ accountRepository }),
    accountRepository,
  };
}

describe('AccountService', () => {
  it('createAccount creates account with trimmed name', async () => {
    const { service, accountRepository } = createAccountService();

    const result = await service.createAccount(ORG_ID, { name: '  Acme Corp  ' }, USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Acme Corp');
      expect(result.value.accountType).toBe('prospect');
    }

    expect(accountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        name: 'Acme Corp',
        createdBy: USER_ID,
      }),
    );
  });

  it('createAccount rejects empty name', async () => {
    const { service } = createAccountService();

    const result = await service.createAccount(ORG_ID, { name: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('getAccount returns not found for missing account', async () => {
    const { service } = createAccountService();

    const result = await service.getAccount(ORG_ID, ACCOUNT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('updateAccount enforces optimistic version check', async () => {
    const { service } = createAccountService({
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
});