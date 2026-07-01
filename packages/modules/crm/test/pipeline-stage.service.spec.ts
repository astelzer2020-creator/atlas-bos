import {
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { PipelineStageService } from '../application/services/pipeline-stage.service.js';
import type {
  PipelineStageRecord,
  PipelineStageRepository,
} from '../domain/repositories/pipeline-stage.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const STAGE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createPipelineStageRecord(
  overrides: Partial<PipelineStageRecord> = {},
): PipelineStageRecord {
  return {
    id: STAGE_ID,
    organizationId: ORG_ID,
    pipelineId: '8d7e6679-7425-40de-944b-e07fc1f90ae8',
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
    ...overrides,
  };
}

function createPipelineStageService(repository: Partial<PipelineStageRepository> = {}) {
  const pipelineStageRepository: PipelineStageRepository = {
    findById: vi.fn().mockResolvedValue(null),
    countByOrganization: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(createPipelineStageRecord()),
    update: vi.fn().mockResolvedValue(createPipelineStageRecord({ version: 2 })),
    list: vi.fn().mockResolvedValue([createPipelineStageRecord()]),
    ...repository,
  };

  return {
    service: new PipelineStageService({ pipelineStageRepository }),
    pipelineStageRepository,
  };
}

describe('PipelineStageService', () => {
  it('createPipelineStage uses sort_order 1 for first stage in org', async () => {
    const { service, pipelineStageRepository } = createPipelineStageService({
      countByOrganization: vi.fn().mockResolvedValue(0),
    });

    const result = await service.createPipelineStage(
      ORG_ID,
      { name: 'Qualification' },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sortOrder).toBe(1);
    }

    expect(pipelineStageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        name: 'Qualification',
        sortOrder: 1,
      }),
    );
  });

  it('createPipelineStage rejects empty name', async () => {
    const { service } = createPipelineStageService();

    const result = await service.createPipelineStage(ORG_ID, { name: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('listPipelineStages returns paginated data', async () => {
    const { service } = createPipelineStageService({
      list: vi.fn().mockResolvedValue([
        createPipelineStageRecord(),
        createPipelineStageRecord({ id: '9e7e6679-7425-40de-944b-e07fc1f90ae9' }),
      ]),
    });

    const result = await service.listPipelineStages(ORG_ID, { limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe('9e7e6679-7425-40de-944b-e07fc1f90ae9');
  });
});