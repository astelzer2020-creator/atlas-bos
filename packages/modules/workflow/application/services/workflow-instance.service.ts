import { randomUUID } from 'node:crypto';

import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type { WorkflowRuntimeEngine } from '../engine/workflow-runtime.engine.js';
import type { WorkflowApprovalRepository } from '../../domain/repositories/workflow-approval.repository.js';
import type {
  WorkflowDefinitionRepository,
} from '../../domain/repositories/workflow-definition.repository.js';
import type {
  WorkflowInstanceRecord,
  WorkflowInstanceRepository,
  WorkflowInstanceStatus,
  WorkflowInitiatorType,
} from '../../domain/repositories/workflow-instance.repository.js';
import type {
  WorkflowStepRecord,
  WorkflowStepRepository,
} from '../../domain/repositories/workflow-step.repository.js';
import { findStartNode } from '../../domain/types/workflow-graph.js';

export interface WorkflowStepDto {
  readonly id: string;
  readonly instance_id: string;
  readonly node_id: string;
  readonly node_type: string;
  readonly step_name: string | null;
  readonly status: string;
  readonly assignee_id: string | null;
  readonly assignee_type: string | null;
  readonly token_id: string;
  readonly input_data: Record<string, unknown>;
  readonly output_data: Record<string, unknown> | null;
  readonly agent_run_id: string | null;
  readonly error_message: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly due_at: string | null;
}

export interface WorkflowInstanceDto {
  readonly id: string;
  readonly organization_id: string;
  readonly definition_id: string;
  readonly definition_version: number;
  readonly parent_instance_id: string | null;
  readonly status: WorkflowInstanceStatus;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly correlation_id: string | null;
  readonly initiator_type: WorkflowInitiatorType;
  readonly initiator_id: string | null;
  readonly current_node_id: string | null;
  readonly context_variables: Record<string, unknown>;
  readonly input_payload: Record<string, unknown>;
  readonly output_payload: Record<string, unknown> | null;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly due_at: string | null;
  readonly sla_breach_at: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface WorkflowInstanceDetailDto extends WorkflowInstanceDto {
  readonly steps: WorkflowStepDto[];
}

export interface StartWorkflowInstanceInput {
  readonly definitionId: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly correlationId?: string;
  readonly inputPayload?: Record<string, unknown>;
  readonly contextVariables?: Record<string, unknown>;
}

export interface ListWorkflowInstancesInput {
  readonly status?: WorkflowInstanceStatus;
  readonly definitionId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface WorkflowInstanceServiceDeps {
  readonly definitionRepository: WorkflowDefinitionRepository;
  readonly instanceRepository: WorkflowInstanceRepository;
  readonly stepRepository: WorkflowStepRepository;
  readonly approvalRepository: WorkflowApprovalRepository;
  readonly runtimeEngine: WorkflowRuntimeEngine;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export class WorkflowInstanceService {
  constructor(private readonly deps: WorkflowInstanceServiceDeps) {}

  async startInstance(
    organizationId: OrganizationId,
    input: StartWorkflowInstanceInput,
    actorId?: UserId,
  ): Promise<Result<WorkflowInstanceDto, ValidationError | NotFoundError | ConflictError>> {
    const definition = await this.deps.definitionRepository.findById(
      organizationId,
      input.definitionId,
    );

    if (definition === null) {
      return err(new NotFoundError('WorkflowDefinition', input.definitionId));
    }

    if (definition.status !== 'published') {
      return err(
        new ConflictError('Workflow definition must be published to start an instance', {
          details: { definitionId: input.definitionId, status: definition.status },
        }),
      );
    }

    const startNode = findStartNode(definition.graphDefinition);
    if (startNode === undefined) {
      return err(
        new ValidationError('Workflow definition has no start_event node', {
          field: 'graphDefinition',
        }),
      );
    }

    const instance = await this.deps.instanceRepository.create({
      organizationId,
      definitionId: definition.id,
      definitionVersion: definition.definitionVersion,
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      ...(input.inputPayload !== undefined ? { inputPayload: input.inputPayload } : {}),
      ...(input.contextVariables !== undefined ? { contextVariables: input.contextVariables } : {}),
      initiatorType: actorId !== undefined ? 'user' : 'api',
      ...(actorId !== undefined ? { initiatorId: actorId, createdBy: actorId } : {}),
    });

    const tokenId = randomUUID();
    const execution = await this.deps.runtimeEngine.executeFromNode(
      organizationId,
      instance,
      definition,
      startNode.id,
      tokenId,
    );

    if (!execution.ok) {
      return execution;
    }

    return ok(this.toDto(execution.value));
  }

  async getInstance(
    organizationId: OrganizationId,
    instanceId: string,
    includeSteps = true,
  ): Promise<Result<WorkflowInstanceDetailDto, NotFoundError>> {
    const instance = await this.deps.instanceRepository.findById(organizationId, instanceId);

    if (instance === null) {
      return err(new NotFoundError('WorkflowInstance', instanceId));
    }

    const steps = includeSteps
      ? await this.deps.stepRepository.listByInstance(organizationId, instanceId)
      : [];

    return ok({
      ...this.toDto(instance),
      steps: steps.map((step) => this.toStepDto(step)),
    });
  }

  async listInstances(
    organizationId: OrganizationId,
    input: ListWorkflowInstancesInput = {},
  ): Promise<{ data: WorkflowInstanceDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const instances = await this.deps.instanceRepository.list({
      organizationId,
      limit,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.definitionId !== undefined ? { definitionId: input.definitionId } : {}),
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    return {
      data: instances.map((instance) => this.toDto(instance)),
      next_cursor: instances.length === limit ? (instances.at(-1)?.id ?? null) : null,
    };
  }

  async cancelInstance(
    organizationId: OrganizationId,
    instanceId: string,
    reason?: string,
    actorId?: UserId,
  ): Promise<Result<WorkflowInstanceDto, NotFoundError | ConflictError>> {
    const instance = await this.deps.instanceRepository.findById(organizationId, instanceId);

    if (instance === null) {
      return err(new NotFoundError('WorkflowInstance', instanceId));
    }

    if (instance.status !== 'running' && instance.status !== 'waiting') {
      return err(
        new ConflictError('Only running or waiting workflow instances can be cancelled', {
          details: { status: instance.status },
        }),
      );
    }

    await this.deps.approvalRepository.cancelPendingByInstance(
      organizationId,
      instanceId,
      actorId,
    );

    const cancelled = await this.deps.instanceRepository.update(organizationId, instanceId, {
      status: 'cancelled',
      completedAt: new Date(),
      ...(reason !== undefined && reason.trim().length > 0
        ? { metadata: { ...instance.metadata, cancelReason: reason.trim() } }
        : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    if (cancelled === null) {
      return err(new NotFoundError('WorkflowInstance', instanceId));
    }

    return ok(this.toDto(cancelled));
  }

  toDto(record: WorkflowInstanceRecord): WorkflowInstanceDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      definition_id: record.definitionId,
      definition_version: record.definitionVersion,
      parent_instance_id: record.parentInstanceId,
      status: record.status,
      entity_type: record.entityType,
      entity_id: record.entityId,
      correlation_id: record.correlationId,
      initiator_type: record.initiatorType,
      initiator_id: record.initiatorId,
      current_node_id: record.currentNodeId,
      context_variables: record.contextVariables,
      input_payload: record.inputPayload,
      output_payload: record.outputPayload,
      started_at: record.startedAt.toISOString(),
      completed_at: record.completedAt?.toISOString() ?? null,
      due_at: record.dueAt?.toISOString() ?? null,
      sla_breach_at: record.slaBreachAt?.toISOString() ?? null,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      version: record.version,
    };
  }

  private toStepDto(record: WorkflowStepRecord): WorkflowStepDto {
    return {
      id: record.id,
      instance_id: record.instanceId,
      node_id: record.nodeId,
      node_type: record.nodeType,
      step_name: record.stepName,
      status: record.status,
      assignee_id: record.assigneeId,
      assignee_type: record.assigneeType,
      token_id: record.tokenId,
      input_data: record.inputData,
      output_data: record.outputData,
      agent_run_id: record.agentRunId,
      error_message: record.errorMessage,
      started_at: record.startedAt?.toISOString() ?? null,
      completed_at: record.completedAt?.toISOString() ?? null,
      due_at: record.dueAt?.toISOString() ?? null,
    };
  }
}