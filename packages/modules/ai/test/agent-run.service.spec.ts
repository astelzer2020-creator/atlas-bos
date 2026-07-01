import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RUN_RESULT_SUMMARY } from '../application/executors/default-agent-executor.js';
import { createDefaultToolRegistry } from '../application/tools/tool-registry.js';
import { AgentRunService } from '../application/services/agent-run.service.js';
import { DefaultAgentExecutor } from '../application/executors/default-agent-executor.js';
import type {
  AgentDefinitionRecord,
  AgentDefinitionRepository,
} from '../domain/repositories/agent-definition.repository.js';
import type { AgentRunRecord, AgentRunRepository } from '../domain/repositories/agent-run.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const DEFINITION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const RUN_ID = '6fa459ea-ee8a-3ca4-894e-db77e160355e';

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
    status: 'published',
    modelId: 'claude-sonnet-4',
    systemPrompt: 'You analyze data and produce insights.',
    allowedTools: [],
    constraints: {},
    memoryConfig: {},
    riskPolicy: {},
    isDefault: false,
    publishedAt: new Date('2026-06-30T09:00:00Z'),
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createRunRecord(overrides: Partial<AgentRunRecord> = {}): AgentRunRecord {
  return {
    id: RUN_ID,
    organizationId: ORG_ID,
    agentDefinitionId: DEFINITION_ID,
    definitionVersion: 1,
    invokerType: 'user',
    invokerId: USER_ID,
    conversationSessionId: null,
    goal: 'Summarize Q2 pipeline',
    status: 'init',
    statusReason: null,
    orchestrationPattern: 'sequential',
    iterationCount: 0,
    maxIterations: 25,
    budgetCents: 50,
    costCents: 0,
    llmInputTokens: 0n,
    llmOutputTokens: 0n,
    startedAt: new Date('2026-06-30T10:00:00Z'),
    completedAt: null,
    resultSummary: null,
    resultPayload: null,
    metadata: {},
    createdAt: new Date('2026-06-30T10:00:00Z'),
    updatedAt: new Date('2026-06-30T10:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createRunService(
  definitionRepository: Partial<AgentDefinitionRepository> = {},
  runRepository: Partial<AgentRunRepository> = {},
) {
  const definitionRepo: AgentDefinitionRepository = {
    findById: vi.fn().mockResolvedValue(createDefinitionRecord()),
    findBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    ...definitionRepository,
  };

  const runRepo: AgentRunRepository = {
    findById: vi.fn().mockResolvedValue(createRunRecord({ status: 'executing' })),
    create: vi.fn().mockResolvedValue(createRunRecord()),
    update: vi
      .fn()
      .mockResolvedValueOnce(createRunRecord({ status: 'executing', version: 2 }))
      .mockResolvedValueOnce(
        createRunRecord({
          status: 'completed',
          resultSummary: DEFAULT_RUN_RESULT_SUMMARY,
          resultPayload: {
            executor: 'tool-orchestration',
            goal: 'Summarize Q2 pipeline',
          },
          completedAt: new Date('2026-06-30T10:00:01Z'),
          version: 3,
        }),
      ),
    list: vi.fn().mockResolvedValue([createRunRecord({ status: 'completed' })]),
    ...runRepository,
  };

  const toolRegistry = createDefaultToolRegistry();
  const agentExecutor = new DefaultAgentExecutor({ toolRegistry });

  return {
    service: new AgentRunService({
      definitionRepository: definitionRepo,
      runRepository: runRepo,
      agentExecutor,
    }),
    definitionRepository: definitionRepo,
    runRepository: runRepo,
  };
}

describe('AgentRunService', () => {
  it('startRun requires published agent definition', async () => {
    const { service } = createRunService({
      findById: vi.fn().mockResolvedValue(createDefinitionRecord({ status: 'draft' })),
    });

    const result = await service.startRun(
      ORG_ID,
      { agentDefinitionId: DEFINITION_ID, goal: 'Summarize Q2 pipeline' },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('startRun rejects empty goal', async () => {
    const { service } = createRunService();

    const result = await service.startRun(
      ORG_ID,
      { agentDefinitionId: DEFINITION_ID, goal: '   ' },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('startRun executes agent and completes immediately', async () => {
    const { service, runRepository } = createRunService();

    const result = await service.startRun(
      ORG_ID,
      { agentDefinitionId: DEFINITION_ID, goal: 'Summarize Q2 pipeline' },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
      expect(result.value.result_summary).toBe(DEFAULT_RUN_RESULT_SUMMARY);
      expect(result.value.result_payload).toEqual(
        expect.objectContaining({
          executor: 'tool-orchestration',
          goal: 'Summarize Q2 pipeline',
        }),
      );
    }

    expect(runRepository.create).toHaveBeenCalledOnce();
    expect(runRepository.update).toHaveBeenCalledTimes(2);
    expect(runRepository.update).toHaveBeenNthCalledWith(
      1,
      ORG_ID,
      RUN_ID,
      expect.objectContaining({ status: 'executing' }),
    );
    expect(runRepository.update).toHaveBeenNthCalledWith(
      2,
      ORG_ID,
      RUN_ID,
      expect.objectContaining({
        status: 'completed',
        resultSummary: DEFAULT_RUN_RESULT_SUMMARY,
        resultPayload: expect.objectContaining({
          executor: 'tool-orchestration',
        }),
      }),
    );
  });

  it('startRun returns not found when definition is missing', async () => {
    const { service } = createRunService({
      findById: vi.fn().mockResolvedValue(null),
    });

    const result = await service.startRun(
      ORG_ID,
      { agentDefinitionId: DEFINITION_ID, goal: 'Summarize Q2 pipeline' },
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('cancelRun rejects completed runs', async () => {
    const { service } = createRunService(
      {},
      {
        findById: vi.fn().mockResolvedValue(createRunRecord({ status: 'completed' })),
      },
    );

    const result = await service.cancelRun(ORG_ID, RUN_ID, 'no longer needed', USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('cancelRun transitions executing run to cancelled', async () => {
    const { service, runRepository } = createRunService(
      {},
      {
        findById: vi.fn().mockResolvedValue(createRunRecord({ status: 'executing' })),
        update: vi.fn().mockResolvedValue(
          createRunRecord({
            status: 'cancelled',
            statusReason: 'no longer needed',
            completedAt: new Date('2026-06-30T10:05:00Z'),
          }),
        ),
      },
    );

    const result = await service.cancelRun(ORG_ID, RUN_ID, 'no longer needed', USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('cancelled');
      expect(result.value.status_reason).toBe('no longer needed');
    }

    expect(runRepository.update).toHaveBeenCalledWith(
      ORG_ID,
      RUN_ID,
      expect.objectContaining({ status: 'cancelled', statusReason: 'no longer needed' }),
    );
  });
});