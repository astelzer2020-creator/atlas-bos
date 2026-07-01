import { ValidationError, type OrganizationId } from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowRuntimeEngine } from '../application/engine/workflow-runtime.engine.js';
import type { WorkflowApprovalRepository } from '../domain/repositories/workflow-approval.repository.js';
import type { WorkflowDefinitionRecord } from '../domain/repositories/workflow-definition.repository.js';
import type {
  WorkflowInstanceRecord,
  WorkflowInstanceRepository,
} from '../domain/repositories/workflow-instance.repository.js';
import type {
  WorkflowStepRecord,
  WorkflowStepRepository,
} from '../domain/repositories/workflow-step.repository.js';
import { DEFAULT_WORKFLOW_GRAPH } from '../domain/types/workflow-graph.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const INSTANCE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const DEFINITION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const STEP_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const ASSIGNEE_ID = '550e8400-e29b-41d4-a716-446655440000';

function createInstance(overrides: Partial<WorkflowInstanceRecord> = {}): WorkflowInstanceRecord {
  return {
    id: INSTANCE_ID,
    organizationId: ORG_ID,
    definitionId: DEFINITION_ID,
    definitionVersion: 1,
    parentInstanceId: null,
    status: 'running',
    entityType: null,
    entityId: null,
    correlationId: null,
    initiatorType: 'user',
    initiatorId: ASSIGNEE_ID,
    currentNodeId: null,
    contextVariables: {},
    inputPayload: {},
    outputPayload: null,
    startedAt: new Date('2026-06-30T08:00:00Z'),
    completedAt: null,
    dueAt: null,
    slaBreachAt: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createDefinition(
  graph = DEFAULT_WORKFLOW_GRAPH,
  overrides: Partial<WorkflowDefinitionRecord> = {},
): WorkflowDefinitionRecord {
  return {
    id: DEFINITION_ID,
    organizationId: ORG_ID,
    name: 'Test Workflow',
    slug: 'test-workflow',
    description: null,
    definitionVersion: 1,
    status: 'published',
    category: 'general',
    graphDefinition: graph,
    slaPolicies: {},
    compensationHandlers: {},
    inputSchema: {},
    outputSchema: {},
    estimatedDurationHours: null,
    isTemplate: false,
    publishedAt: new Date('2026-06-30T08:00:00Z'),
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createRuntimeEngine(
  instanceRepository: Partial<WorkflowInstanceRepository> = {},
  stepRepository: Partial<WorkflowStepRepository> = {},
  approvalRepository: Partial<WorkflowApprovalRepository> = {},
) {
  let instanceState = createInstance();

  const instanceRepo: WorkflowInstanceRepository = {
    findById: vi.fn().mockResolvedValue(instanceState),
    create: vi.fn().mockResolvedValue(instanceState),
    update: vi.fn().mockImplementation(async (_org, _id, data) => {
      instanceState = {
        ...instanceState,
        ...data,
        version: instanceState.version + 1,
      } as WorkflowInstanceRecord;
      return instanceState;
    }),
    list: vi.fn().mockResolvedValue([]),
    ...instanceRepository,
  };

  const stepRepo: WorkflowStepRepository = {
    findById: vi.fn().mockResolvedValue(null),
    listByInstance: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({
      id: STEP_ID,
      organizationId: data.organizationId,
      instanceId: data.instanceId,
      nodeId: data.nodeId,
      nodeType: data.nodeType,
      stepName: data.stepName ?? null,
      status: data.status,
      assigneeId: data.assigneeId ?? null,
      assigneeType: data.assigneeType ?? null,
      tokenId: data.tokenId,
      inputData: data.inputData ?? {},
      outputData: data.outputData ?? null,
      agentRunId: null,
      errorMessage: null,
      startedAt: data.startedAt ?? null,
      completedAt: data.completedAt ?? null,
      dueAt: null,
      metadata: {},
      createdAt: new Date('2026-06-30T08:00:00Z'),
      updatedAt: new Date('2026-06-30T08:00:00Z'),
      version: 1,
    })),
    update: vi.fn(),
    ...stepRepository,
  };

  const approvalRepo: WorkflowApprovalRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      organizationId: ORG_ID,
      instanceId: INSTANCE_ID,
      stepId: STEP_ID,
      approvalType: 'single',
      status: 'pending',
      title: 'Approval required',
      description: null,
      assigneeIds: [ASSIGNEE_ID],
      approvedBy: null,
      rejectedBy: null,
      formData: {},
      diffPreview: null,
      requestedAt: new Date('2026-06-30T08:00:00Z'),
      expiresAt: null,
      resolvedAt: null,
      resolutionNote: null,
      escalationLevel: 0,
      metadata: {},
      createdAt: new Date('2026-06-30T08:00:00Z'),
      updatedAt: new Date('2026-06-30T08:00:00Z'),
      version: 1,
    }),
    update: vi.fn(),
    cancelPendingByInstance: vi.fn().mockResolvedValue(0),
    list: vi.fn().mockResolvedValue([]),
    ...approvalRepository,
  };

  return {
    engine: new WorkflowRuntimeEngine({
      instanceRepository: instanceRepo,
      stepRepository: stepRepo,
      approvalRepository: approvalRepo,
    }),
    instanceRepository: instanceRepo,
    stepRepository: stepRepo,
    approvalRepository: approvalRepo,
    getInstanceState: () => instanceState,
  };
}

describe('WorkflowRuntimeEngine', () => {
  it('executes start_event through to completed end_event', async () => {
    const { engine, stepRepository } = createRuntimeEngine();
    const definition = createDefinition();
    const instance = createInstance();

    const result = await engine.executeFromNode(
      ORG_ID,
      instance,
      definition,
      'start',
      'token-start',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
      expect(result.value.currentNodeId).toBe('end');
    }

    expect(stepRepository.create).toHaveBeenCalledTimes(2);
  });

  it('human_task creates waiting step and pending approval', async () => {
    const humanTaskGraph = {
      nodes: [
        { id: 'start', type: 'start_event' as const },
        {
          id: 'review',
          type: 'human_task' as const,
          name: 'Manager Review',
          config: { assigneeIds: [ASSIGNEE_ID], title: 'Review expense' },
        },
        { id: 'end', type: 'end_event' as const },
      ],
      edges: [
        { from: 'start', to: 'review' },
        { from: 'review', to: 'end', condition: "outcome == 'approved'" },
      ],
    };

    const { engine, approvalRepository, stepRepository } = createRuntimeEngine();
    const definition = createDefinition(humanTaskGraph);
    const instance = createInstance();

    const result = await engine.executeFromNode(
      ORG_ID,
      instance,
      definition,
      'start',
      'token-start',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('waiting');
      expect(result.value.currentNodeId).toBe('review');
    }

    expect(stepRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'review',
        nodeType: 'human_task',
        status: 'waiting',
      }),
    );

    expect(approvalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: INSTANCE_ID,
        title: 'Review expense',
        assigneeIds: [ASSIGNEE_ID],
      }),
    );
  });

  it('service_task creates completed step with service output', async () => {
    const serviceGraph = {
      nodes: [
        { id: 'start', type: 'start_event' as const },
        { id: 'notify', type: 'service_task' as const, name: 'Notify' },
        { id: 'end', type: 'end_event' as const },
      ],
      edges: [
        { from: 'start', to: 'notify' },
        { from: 'notify', to: 'end' },
      ],
    };

    const { engine, stepRepository } = createRuntimeEngine();
    const definition = createDefinition(serviceGraph);
    const instance = createInstance();

    const result = await engine.executeFromNode(
      ORG_ID,
      instance,
      definition,
      'start',
      'token-start',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
    }

    expect(stepRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'notify',
        nodeType: 'service_task',
        status: 'completed',
        outputData: expect.objectContaining({ executed: true, service: 'noop' }),
      }),
    );
  });

  it('exclusive_gateway routes on outcome condition', async () => {
    const gatewayGraph = {
      nodes: [
        { id: 'start', type: 'start_event' as const },
        { id: 'gateway', type: 'exclusive_gateway' as const },
        { id: 'approved_end', type: 'end_event' as const },
        { id: 'rejected_end', type: 'end_event' as const },
      ],
      edges: [
        { from: 'start', to: 'gateway' },
        { from: 'gateway', to: 'approved_end', condition: "outcome == 'approved'" },
        { from: 'gateway', to: 'rejected_end', condition: "outcome == 'rejected'" },
      ],
    };

    const { engine } = createRuntimeEngine();
    const definition = createDefinition(gatewayGraph);
    const instance = createInstance();

    const result = await engine.executeFromNode(
      ORG_ID,
      instance,
      definition,
      'gateway',
      'token-gateway',
      'rejected',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('completed');
      expect(result.value.currentNodeId).toBe('rejected_end');
    }
  });

  it('returns validation error for unknown node', async () => {
    const { engine } = createRuntimeEngine();
    const definition = createDefinition();
    const instance = createInstance();

    const result = await engine.executeFromNode(
      ORG_ID,
      instance,
      definition,
      'missing-node',
      'token-missing',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});