import {
  ConflictError,
  ForbiddenError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowRuntimeEngine } from '../application/engine/workflow-runtime.engine.js';
import { WorkflowApprovalService } from '../application/services/workflow-approval.service.js';
import { WorkflowInstanceService } from '../application/services/workflow-instance.service.js';
import type {
  WorkflowApprovalRecord,
  WorkflowApprovalRepository,
} from '../domain/repositories/workflow-approval.repository.js';
import type {
  WorkflowDefinitionRecord,
  WorkflowDefinitionRepository,
} from '../domain/repositories/workflow-definition.repository.js';
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
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const OTHER_USER_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as UserId;
const APPROVAL_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const INSTANCE_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const STEP_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const DEFINITION_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

const pendingApproval: WorkflowApprovalRecord = {
  id: APPROVAL_ID,
  organizationId: ORG_ID,
  instanceId: INSTANCE_ID,
  stepId: STEP_ID,
  approvalType: 'single',
  status: 'pending',
  title: 'Manager approval',
  description: null,
  assigneeIds: [USER_ID],
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
};

const waitingStep: WorkflowStepRecord = {
  id: STEP_ID,
  organizationId: ORG_ID,
  instanceId: INSTANCE_ID,
  nodeId: 'review',
  nodeType: 'human_task',
  stepName: 'Manager Review',
  status: 'waiting',
  assigneeId: null,
  assigneeType: null,
  tokenId: 'token-review',
  inputData: {},
  outputData: null,
  agentRunId: null,
  errorMessage: null,
  startedAt: new Date('2026-06-30T08:00:00Z'),
  completedAt: null,
  dueAt: null,
  metadata: {},
  createdAt: new Date('2026-06-30T08:00:00Z'),
  updatedAt: new Date('2026-06-30T08:00:00Z'),
  version: 1,
};

const waitingInstance: WorkflowInstanceRecord = {
  id: INSTANCE_ID,
  organizationId: ORG_ID,
  definitionId: DEFINITION_ID,
  definitionVersion: 1,
  parentInstanceId: null,
  status: 'waiting',
  entityType: null,
  entityId: null,
  correlationId: null,
  initiatorType: 'user',
  initiatorId: USER_ID,
  currentNodeId: 'review',
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
};

const publishedDefinition: WorkflowDefinitionRecord = {
  id: DEFINITION_ID,
  organizationId: ORG_ID,
  name: 'Approval Flow',
  slug: 'approval-flow',
  description: null,
  definitionVersion: 1,
  status: 'published',
  category: 'general',
  graphDefinition: {
    nodes: [
      { id: 'start', type: 'start_event' },
      {
        id: 'review',
        type: 'human_task',
        config: { assigneeIds: [USER_ID] },
      },
      { id: 'end', type: 'end_event' },
    ],
    edges: [
      { from: 'start', to: 'review' },
      { from: 'review', to: 'end', condition: "outcome == 'approved'" },
    ],
  },
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
};

function createApprovalService(
  approvalOverrides: Partial<WorkflowApprovalRepository> = {},
  instanceOverrides: Partial<WorkflowInstanceRepository> = {},
  definitionOverrides: Partial<WorkflowDefinitionRepository> = {},
  stepOverrides: Partial<WorkflowStepRepository> = {},
  runtimeOverrides: Partial<WorkflowRuntimeEngine> = {},
) {
  const approvalRepository: WorkflowApprovalRepository = {
    findById: vi.fn().mockResolvedValue(pendingApproval),
    create: vi.fn(),
    update: vi.fn().mockImplementation(async (_org, id, data) => ({
      ...pendingApproval,
      ...data,
      id,
      status: data.status ?? pendingApproval.status,
      approvedBy: data.approvedBy ?? pendingApproval.approvedBy,
      rejectedBy: data.rejectedBy ?? pendingApproval.rejectedBy,
      resolvedAt: data.resolvedAt ?? pendingApproval.resolvedAt,
      resolutionNote: data.resolutionNote ?? pendingApproval.resolutionNote,
    })),
    cancelPendingByInstance: vi.fn().mockResolvedValue(1),
    list: vi.fn().mockResolvedValue([pendingApproval]),
    ...approvalOverrides,
  };

  const instanceRepository: WorkflowInstanceRepository = {
    findById: vi.fn().mockResolvedValue(waitingInstance),
    create: vi.fn(),
    update: vi.fn().mockImplementation(async (_org, _id, data) => ({
      ...waitingInstance,
      ...data,
      version: waitingInstance.version + 1,
    })),
    list: vi.fn().mockResolvedValue([]),
    ...instanceOverrides,
  };

  const definitionRepository: WorkflowDefinitionRepository = {
    findById: vi.fn().mockResolvedValue(publishedDefinition),
    findBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    list: vi.fn(),
    ...definitionOverrides,
  };

  const stepRepository: WorkflowStepRepository = {
    findById: vi.fn().mockResolvedValue(waitingStep),
    listByInstance: vi.fn().mockResolvedValue([waitingStep]),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...waitingStep, status: 'completed' }),
    ...stepOverrides,
  };

  const runtimeEngine = {
    executeFromNode: vi.fn(),
    advanceFromNode: vi.fn(),
    resumeAfterHumanTask: vi.fn().mockResolvedValue({
      ok: true,
      value: { ...waitingInstance, status: 'completed', currentNodeId: 'end' },
    }),
    ...runtimeOverrides,
  } as unknown as WorkflowRuntimeEngine;

  return {
    service: new WorkflowApprovalService({
      approvalRepository,
      instanceRepository,
      definitionRepository,
      stepRepository,
      runtimeEngine,
    }),
    approvalRepository,
    instanceRepository,
    stepRepository,
    runtimeEngine,
  };
}

describe('WorkflowApprovalService', () => {
  it('approveStep advances runtime with approved outcome', async () => {
    const { service, approvalRepository, stepRepository, runtimeEngine } = createApprovalService();

    const result = await service.approveStep(ORG_ID, APPROVAL_ID, USER_ID, {
      resolutionNote: 'Looks good',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('approved');
      expect(result.value.approved_by).toBe(USER_ID);
    }

    expect(approvalRepository.update).toHaveBeenCalledWith(
      ORG_ID,
      APPROVAL_ID,
      expect.objectContaining({ status: 'approved', approvedBy: USER_ID }),
    );
    expect(stepRepository.update).toHaveBeenCalledWith(
      ORG_ID,
      STEP_ID,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(runtimeEngine.resumeAfterHumanTask).toHaveBeenCalledWith(
      ORG_ID,
      waitingInstance,
      publishedDefinition,
      'review',
      'token-review',
      'approved',
    );
  });

  it('rejectStep requires resolutionNote', async () => {
    const { service } = createApprovalService();

    const result = await service.rejectStep(ORG_ID, APPROVAL_ID, USER_ID, {
      resolutionNote: '   ',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejectStep advances runtime with rejected outcome', async () => {
    const rejectGraphDefinition: WorkflowDefinitionRecord = {
      ...publishedDefinition,
      graphDefinition: {
        nodes: [
          { id: 'start', type: 'start_event' },
          { id: 'review', type: 'human_task', config: { assigneeIds: [USER_ID] } },
          { id: 'rejected_end', type: 'end_event' },
        ],
        edges: [
          { from: 'start', to: 'review' },
          { from: 'review', to: 'rejected_end', condition: "outcome == 'rejected'" },
        ],
      },
    };

    const { service, runtimeEngine } = createApprovalService(
      {
        update: vi.fn().mockImplementation(async (_org, id, data) => ({
          ...pendingApproval,
          id,
          status: 'rejected',
          rejectedBy: data.rejectedBy ?? null,
          resolvedAt: data.resolvedAt ?? null,
          resolutionNote: data.resolutionNote ?? null,
        })),
      },
      {},
      {
        findById: vi.fn().mockResolvedValue(rejectGraphDefinition),
      },
    );

    const result = await service.rejectStep(ORG_ID, APPROVAL_ID, USER_ID, {
      resolutionNote: 'Insufficient documentation',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('rejected');
      expect(result.value.rejected_by).toBe(USER_ID);
    }

    expect(runtimeEngine.resumeAfterHumanTask).toHaveBeenCalledWith(
      ORG_ID,
      waitingInstance,
      rejectGraphDefinition,
      'review',
      'token-review',
      'rejected',
    );
  });

  it('approveStep rejects unauthorized assignee', async () => {
    const { service } = createApprovalService();

    const result = await service.approveStep(ORG_ID, APPROVAL_ID, OTHER_USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ForbiddenError);
    }
  });

  it('approveStep rejects already resolved approval', async () => {
    const { service } = createApprovalService({
      findById: vi.fn().mockResolvedValue({ ...pendingApproval, status: 'approved' }),
    });

    const result = await service.approveStep(ORG_ID, APPROVAL_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });
});

describe('WorkflowInstanceService', () => {
  it('cancelInstance cancels pending approvals and marks instance cancelled', async () => {
    const approvalRepository: WorkflowApprovalRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      cancelPendingByInstance: vi.fn().mockResolvedValue(1),
      list: vi.fn(),
    };

    const instanceRepository: WorkflowInstanceRepository = {
      findById: vi.fn().mockResolvedValue(waitingInstance),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({
        ...waitingInstance,
        status: 'cancelled',
        completedAt: new Date('2026-06-30T09:00:00Z'),
      }),
      list: vi.fn(),
    };

    const service = new WorkflowInstanceService({
      definitionRepository: {
        findById: vi.fn(),
        findBySlug: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        publish: vi.fn(),
        list: vi.fn(),
      },
      instanceRepository,
      stepRepository: {
        findById: vi.fn(),
        listByInstance: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      approvalRepository,
      runtimeEngine: {
        executeFromNode: vi.fn(),
        advanceFromNode: vi.fn(),
        resumeAfterHumanTask: vi.fn(),
      } as unknown as WorkflowRuntimeEngine,
    });

    const result = await service.cancelInstance(
      ORG_ID,
      INSTANCE_ID,
      'No longer needed',
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('cancelled');
    }

    expect(approvalRepository.cancelPendingByInstance).toHaveBeenCalledWith(
      ORG_ID,
      INSTANCE_ID,
      USER_ID,
    );
  });
});