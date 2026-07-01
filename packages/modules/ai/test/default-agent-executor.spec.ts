import { type OrganizationId } from '@atlas/shared-kernel';
import { describe, expect, it } from 'vitest';

import {
  DefaultAgentExecutor,
  DEFAULT_RUN_RESULT_SUMMARY,
} from '../application/executors/default-agent-executor.js';
import { createDefaultToolRegistry } from '../application/tools/tool-registry.js';
import type { AgentRunRecord } from '../domain/repositories/agent-run.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;

function createRun(goal: string): AgentRunRecord {
  return {
    id: '6fa459ea-ee8a-3ca4-894e-db77e160355e',
    organizationId: ORG_ID,
    agentDefinitionId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    definitionVersion: 1,
    invokerType: 'user',
    invokerId: '550e8400-e29b-41d4-a716-446655440000',
    conversationSessionId: null,
    goal,
    status: 'executing',
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
  };
}

describe('DefaultAgentExecutor', () => {
  it('executes registered tools and completes the run', async () => {
    const registry = createDefaultToolRegistry();
    const executor = new DefaultAgentExecutor({ toolRegistry: registry });

    const result = await executor.execute({
      organizationId: ORG_ID,
      run: createRun('Summarize Q2 pipeline'),
    });

    expect(result.status).toBe('completed');
    expect(result.resultSummary).toBe(DEFAULT_RUN_RESULT_SUMMARY);
    expect(result.resultPayload.goal).toBe('Summarize Q2 pipeline');
    expect(result.resultPayload.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'get_current_time', output: expect.any(String) }),
        expect.objectContaining({ name: 'echo', output: 'Summarize Q2 pipeline' }),
      ]),
    );
  });
});