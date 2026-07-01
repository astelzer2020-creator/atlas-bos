import {
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import type { OrganizationMembershipPort } from '../application/ports/organization-membership.port.js';
import { DealService } from '../application/services/deal.service.js';
import type { CrmAccountRepository } from '../domain/repositories/account.repository.js';
import type { CrmContactRepository } from '../domain/repositories/contact.repository.js';
import type { DealRecord, DealRepository } from '../domain/repositories/deal.repository.js';
import type {
  PipelineStageRecord,
  PipelineStageRepository,
} from '../domain/repositories/pipeline-stage.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const DEAL_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const STAGE_ID = '8d7e6679-7425-40de-944b-e07fc1f90ae8';

function createDealRecord(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: DEAL_ID,
    organizationId: ORG_ID,
    externalId: null,
    name: 'Enterprise License',
    accountId: null,
    contactId: null,
    pipelineStageId: STAGE_ID,
    ownerId: USER_ID,
    amount: '50000',
    currencyCode: 'USD',
    probability: 25,
    expectedCloseDate: null,
    actualCloseDate: null,
    status: 'open',
    lossReason: null,
    leadSource: null,
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

function createPipelineStageRecord(): PipelineStageRecord {
  return {
    id: STAGE_ID,
    organizationId: ORG_ID,
    pipelineId: '9e7e6679-7425-40de-944b-e07fc1f90ae9',
    pipelineName: 'Default Pipeline',
    name: 'Qualification',
    description: null,
    sortOrder: 1,
    probability: 10,
    isDefault: true,
    isWon: false,
    isLost: false,
    isClosed: false,
    color: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    deletedAt: null,
    createdBy: USER_ID,
    updatedBy: null,
    version: 1,
  };
}

function createDealService(options: {
  dealRepository?: Partial<DealRepository>;
  pipelineStageRepository?: Partial<PipelineStageRepository>;
  membershipPort?: Partial<OrganizationMembershipPort>;
} = {}) {
  const dealRepository: DealRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createDealRecord()),
    update: vi.fn().mockResolvedValue(createDealRecord({ version: 2 })),
    list: vi.fn().mockResolvedValue([createDealRecord()]),
    ...options.dealRepository,
  };

  const pipelineStageRepository: PipelineStageRepository = {
    findById: vi.fn().mockResolvedValue(null),
    countByOrganization: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    ...options.pipelineStageRepository,
  };

  const accountRepository: CrmAccountRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
  };

  const contactRepository: CrmContactRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
  };

  const membershipPort: OrganizationMembershipPort = {
    isActiveMember: vi.fn().mockResolvedValue(false),
    ...options.membershipPort,
  };

  return {
    service: new DealService({
      dealRepository,
      pipelineStageRepository,
      accountRepository,
      contactRepository,
      membershipPort,
    }),
    dealRepository,
    pipelineStageRepository,
    membershipPort,
  };
}

describe('DealService', () => {
  it('createDeal rejects invalid pipeline stage', async () => {
    const { service } = createDealService();

    const result = await service.createDeal(ORG_ID, {
      name: 'Enterprise License',
      pipelineStageId: STAGE_ID,
      ownerId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createDeal rejects invalid owner', async () => {
    const { service } = createDealService({
      pipelineStageRepository: {
        findById: vi.fn().mockResolvedValue(createPipelineStageRecord()),
      },
    });

    const result = await service.createDeal(ORG_ID, {
      name: 'Enterprise License',
      pipelineStageId: STAGE_ID,
      ownerId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createDeal succeeds with valid stage and owner', async () => {
    const { service, dealRepository } = createDealService({
      pipelineStageRepository: {
        findById: vi.fn().mockResolvedValue(createPipelineStageRecord()),
      },
      membershipPort: {
        isActiveMember: vi.fn().mockResolvedValue(true),
      },
    });

    const result = await service.createDeal(
      ORG_ID,
      {
        name: 'Enterprise License',
        pipelineStageId: STAGE_ID,
        ownerId: USER_ID,
        amount: '50000',
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Enterprise License');
      expect(result.value.pipelineStageId).toBe(STAGE_ID);
    }

    expect(dealRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        pipelineStageId: STAGE_ID,
        ownerId: USER_ID,
      }),
    );
  });
});