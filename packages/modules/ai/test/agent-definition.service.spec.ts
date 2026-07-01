import {
  ConflictError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { AgentDefinitionService } from '../application/services/agent-definition.service.js';
import type {
  AgentDefinitionRecord,
  AgentDefinitionRepository,
} from '../domain/repositories/agent-definition.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const DEFINITION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createDefinitionRecord(
  overrides: Partial<AgentDefinitionRecord> = {},
): AgentDefinitionRecord {
  return {
    id: DEFINITION_ID,
    organizationId: ORG_ID,
    name: 'Research Analyst',
    slug: 'research-analyst',
    description: null,
    role: 'analyst',
    definitionVersion: 1,
    status: 'draft',
    modelId: 'claude-sonnet-4',
    systemPrompt: 'You analyze data and produce insights.',
    allowedTools: [],
    constraints: {},
    memoryConfig: {},
    riskPolicy: {},
    isDefault: false,
    publishedAt: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createDefinitionService(repository: Partial<AgentDefinitionRepository> = {}) {
  const definitionRepository: AgentDefinitionRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createDefinitionRecord()),
    update: vi.fn().mockResolvedValue(createDefinitionRecord({ version: 2 })),
    publish: vi.fn().mockResolvedValue(
      createDefinitionRecord({
        status: 'published',
        publishedAt: new Date('2026-06-30T09:00:00Z'),
      }),
    ),
    list: vi.fn().mockResolvedValue([createDefinitionRecord()]),
    ...repository,
  };

  return {
    service: new AgentDefinitionService({ definitionRepository }),
    definitionRepository,
  };
}

describe('AgentDefinitionService', () => {
  it('createDefinition creates draft with required fields', async () => {
    const { service, definitionRepository } = createDefinitionService();

    const result = await service.createDefinition(ORG_ID, {
      name: 'Research Analyst',
      slug: 'research-analyst',
      role: 'analyst',
      systemPrompt: 'You analyze data and produce insights.',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('draft');
      expect(result.value.role).toBe('analyst');
    }

    expect(definitionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        slug: 'research-analyst',
        role: 'analyst',
      }),
    );
  });

  it('createDefinition rejects invalid slug', async () => {
    const { service } = createDefinitionService();

    const result = await service.createDefinition(ORG_ID, {
      name: 'Bad Slug',
      slug: 'Invalid Slug!',
      role: 'analyst',
      systemPrompt: 'Prompt',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('createDefinition rejects duplicate slug', async () => {
    const { service } = createDefinitionService({
      findBySlug: vi.fn().mockResolvedValue(createDefinitionRecord()),
    });

    const result = await service.createDefinition(ORG_ID, {
      name: 'Duplicate',
      slug: 'research-analyst',
      role: 'analyst',
      systemPrompt: 'Prompt',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('publishDefinition rejects non-draft definitions', async () => {
    const { service } = createDefinitionService({
      findById: vi.fn().mockResolvedValue(createDefinitionRecord({ status: 'published' })),
    });

    const result = await service.publishDefinition(ORG_ID, DEFINITION_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('publishDefinition transitions draft to published', async () => {
    const { service, definitionRepository } = createDefinitionService({
      findById: vi.fn().mockResolvedValue(createDefinitionRecord({ status: 'draft' })),
    });

    const result = await service.publishDefinition(ORG_ID, DEFINITION_ID, USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('published');
      expect(result.value.published_at).not.toBeNull();
    }

    expect(definitionRepository.publish).toHaveBeenCalledWith(
      ORG_ID,
      DEFINITION_ID,
      expect.any(Date),
      USER_ID,
    );
  });

  it('updateDefinition enforces optimistic version check', async () => {
    const { service } = createDefinitionService({
      findById: vi.fn().mockResolvedValue(createDefinitionRecord({ version: 2 })),
    });

    const result = await service.updateDefinition(
      ORG_ID,
      DEFINITION_ID,
      { name: 'Updated Name', expectedVersion: 1 },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });
});