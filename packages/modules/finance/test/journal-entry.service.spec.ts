import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { JournalEntryService } from '../application/services/journal-entry.service.js';
import type {
  ChartOfAccountRecord,
  ChartOfAccountRepository,
} from '../domain/repositories/chart-of-account.repository.js';
import type {
  JournalEntryRecord,
  JournalEntryRepository,
} from '../domain/repositories/journal-entry.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const ENTRY_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const CASH_ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const REVENUE_ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';

function createAccountRecord(
  id: string,
  overrides: Partial<ChartOfAccountRecord> = {},
): ChartOfAccountRecord {
  return {
    id,
    organizationId: ORG_ID,
    parentAccountId: null,
    code: id === CASH_ACCOUNT_ID ? '1000' : '4000',
    name: id === CASH_ACCOUNT_ID ? 'Cash' : 'Revenue',
    description: null,
    accountType: id === CASH_ACCOUNT_ID ? 'asset' : 'revenue',
    normalBalance: id === CASH_ACCOUNT_ID ? 'debit' : 'credit',
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

function createJournalEntryRecord(
  overrides: Partial<JournalEntryRecord> = {},
): JournalEntryRecord {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    entryNumber: 'JE-000001',
    entryDate: new Date('2026-06-30T00:00:00.000Z'),
    status: 'draft',
    description: 'Test entry',
    currencyCode: 'USD',
    totalDebit: '100.0000',
    totalCredit: '100.0000',
    postedBy: null,
    postedAt: null,
    metadata: { entryType: 'standard' },
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    deletedAt: null,
    createdBy: USER_ID,
    updatedBy: null,
    version: 1,
    lines: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        organizationId: ORG_ID,
        journalEntryId: ENTRY_ID,
        accountId: CASH_ACCOUNT_ID,
        lineNumber: 1,
        description: null,
        debitAmount: '100.0000',
        creditAmount: '0',
        metadata: {},
        createdAt: new Date('2026-06-30T08:00:00Z'),
        updatedAt: new Date('2026-06-30T08:00:00Z'),
        deletedAt: null,
        version: 1,
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        organizationId: ORG_ID,
        journalEntryId: ENTRY_ID,
        accountId: REVENUE_ACCOUNT_ID,
        lineNumber: 2,
        description: null,
        debitAmount: '0',
        creditAmount: '100.0000',
        metadata: {},
        createdAt: new Date('2026-06-30T08:00:00Z'),
        updatedAt: new Date('2026-06-30T08:00:00Z'),
        deletedAt: null,
        version: 1,
      },
    ],
    ...overrides,
  };
}

function createJournalEntryService(
  journalRepository: Partial<JournalEntryRepository> = {},
  chartRepository: Partial<ChartOfAccountRepository> = {},
) {
  const chartOfAccountRepository: ChartOfAccountRepository = {
    findById: vi.fn(async (_orgId, id: string) => createAccountRecord(id)),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    ...chartRepository,
  };

  const journalEntryRepository: JournalEntryRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByEntryNumber: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createJournalEntryRecord()),
    post: vi.fn().mockResolvedValue(createJournalEntryRecord({ status: 'posted', postedBy: USER_ID })),
    list: vi.fn().mockResolvedValue([createJournalEntryRecord()]),
    countByOrganization: vi.fn().mockResolvedValue(0),
    ...journalRepository,
  };

  return {
    service: new JournalEntryService({ journalEntryRepository, chartOfAccountRepository }),
    journalEntryRepository,
    chartOfAccountRepository,
  };
}

describe('JournalEntryService', () => {
  it('createEntry creates balanced journal entry with lines', async () => {
    const { service, journalEntryRepository } = createJournalEntryService();

    const result = await service.createEntry(
      ORG_ID,
      {
        description: 'Cash sale',
        lines: [
          { accountId: CASH_ACCOUNT_ID, debitAmount: '100' },
          { accountId: REVENUE_ACCOUNT_ID, creditAmount: '100' },
        ],
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('draft');
      expect(result.value.totalDebit).toBe('100.0000');
      expect(result.value.totalCredit).toBe('100.0000');
      expect(result.value.lines).toHaveLength(2);
    }

    expect(journalEntryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        description: 'Cash sale',
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: CASH_ACCOUNT_ID, debitAmount: '100' }),
          expect.objectContaining({ accountId: REVENUE_ACCOUNT_ID, creditAmount: '100' }),
        ]),
      }),
    );
  });

  it('createEntry rejects unbalanced debits and credits', async () => {
    const { service } = createJournalEntryService();

    const result = await service.createEntry(ORG_ID, {
      description: 'Unbalanced',
      lines: [
        { accountId: CASH_ACCOUNT_ID, debitAmount: '100' },
        { accountId: REVENUE_ACCOUNT_ID, creditAmount: '50' },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createEntry rejects lines with both debit and credit amounts', async () => {
    const { service } = createJournalEntryService();

    const result = await service.createEntry(ORG_ID, {
      description: 'Invalid line',
      lines: [
        { accountId: CASH_ACCOUNT_ID, debitAmount: '100', creditAmount: '100' },
        { accountId: REVENUE_ACCOUNT_ID, creditAmount: '100' },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createEntry rejects fewer than two lines', async () => {
    const { service } = createJournalEntryService();

    const result = await service.createEntry(ORG_ID, {
      description: 'Single line',
      lines: [{ accountId: CASH_ACCOUNT_ID, debitAmount: '100' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createEntry rejects inactive GL accounts', async () => {
    const { service } = createJournalEntryService(
      {},
      {
        findById: vi.fn(async (_orgId, id: string) =>
          createAccountRecord(id, { isActive: false }),
        ),
      },
    );

    const result = await service.createEntry(ORG_ID, {
      description: 'Inactive account',
      lines: [
        { accountId: CASH_ACCOUNT_ID, debitAmount: '100' },
        { accountId: REVENUE_ACCOUNT_ID, creditAmount: '100' },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('postEntry transitions draft entry to posted', async () => {
    const { service, journalEntryRepository } = createJournalEntryService({
      findById: vi.fn().mockResolvedValue(createJournalEntryRecord()),
      post: vi.fn().mockResolvedValue(
        createJournalEntryRecord({
          status: 'posted',
          postedBy: USER_ID,
          postedAt: new Date('2026-06-30T10:00:00Z'),
        }),
      ),
    });

    const result = await service.postEntry(ORG_ID, ENTRY_ID, USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('posted');
      expect(result.value.postedBy).toBe(USER_ID);
    }

    expect(journalEntryRepository.post).toHaveBeenCalledWith(
      ORG_ID,
      ENTRY_ID,
      USER_ID,
      expect.any(Date),
    );
  });

  it('postEntry rejects already posted entries', async () => {
    const { service } = createJournalEntryService({
      findById: vi.fn().mockResolvedValue(createJournalEntryRecord({ status: 'posted' })),
    });

    const result = await service.postEntry(ORG_ID, ENTRY_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('getEntry returns not found for missing entry', async () => {
    const { service } = createJournalEntryService();

    const result = await service.getEntry(ORG_ID, ENTRY_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});