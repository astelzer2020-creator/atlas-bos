import {
  ConflictError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type { WorkflowRuntimeEngine } from '../engine/workflow-runtime.engine.js';
import type {
  WorkflowApprovalRecord,
  WorkflowApprovalRepository,
  WorkflowApprovalStatus,
} from '../../domain/repositories/workflow-approval.repository.js';
import type { WorkflowDefinitionRepository } from '../../domain/repositories/workflow-definition.repository.js';
import type { WorkflowInstanceRepository } from '../../domain/repositories/workflow-instance.repository.js';
import type { WorkflowStepRepository } from '../../domain/repositories/workflow-step.repository.js';

export interface WorkflowApprovalDto {
  readonly id: string;
  readonly organization_id: string;
  readonly instance_id: string;
  readonly step_id: string;
  readonly approval_type: string;
  readonly status: WorkflowApprovalStatus;
  readonly title: string;
  readonly description: string | null;
  readonly assignee_ids: string[];
  readonly approved_by: string | null;
  readonly rejected_by: string | null;
  readonly form_data: Record<string, unknown>;
  readonly diff_preview: Record<string, unknown> | null;
  readonly requested_at: string;
  readonly expires_at: string | null;
  readonly resolved_at: string | null;
  readonly resolution_note: string | null;
  readonly escalation_level: number;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface ListWorkflowApprovalsInput {
  readonly status?: WorkflowApprovalStatus;
  readonly instanceId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ApproveWorkflowStepInput {
  readonly resolutionNote?: string;
  readonly formData?: Record<string, unknown>;
}

export interface RejectWorkflowStepInput {
  readonly resolutionNote: string;
}

export interface WorkflowApprovalServiceDeps {
  readonly approvalRepository: WorkflowApprovalRepository;
  readonly instanceRepository: WorkflowInstanceRepository;
  readonly definitionRepository: WorkflowDefinitionRepository;
  readonly stepRepository: WorkflowStepRepository;
  readonly runtimeEngine: WorkflowRuntimeEngine;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export class WorkflowApprovalService {
  constructor(private readonly deps: WorkflowApprovalServiceDeps) {}

  async listApprovals(
    organizationId: OrganizationId,
    input: ListWorkflowApprovalsInput = {},
  ): Promise<{ data: WorkflowApprovalDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const approvals = await this.deps.approvalRepository.list({
      organizationId,
      limit,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.instanceId !== undefined ? { instanceId: input.instanceId } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    return {
      data: approvals.map((approval) => this.toDto(approval)),
      next_cursor: approvals.length === limit ? (approvals.at(-1)?.id ?? null) : null,
    };
  }

  async getApproval(
    organizationId: OrganizationId,
    approvalId: string,
  ): Promise<Result<WorkflowApprovalDto, NotFoundError>> {
    const approval = await this.deps.approvalRepository.findById(organizationId, approvalId);

    if (approval === null) {
      return err(new NotFoundError('WorkflowApproval', approvalId));
    }

    return ok(this.toDto(approval));
  }

  async approveStep(
    organizationId: OrganizationId,
    approvalId: string,
    assigneeId: UserId,
    input: ApproveWorkflowStepInput = {},
    actorId?: UserId,
  ): Promise<
    Result<
      WorkflowApprovalDto,
      ValidationError | NotFoundError | ForbiddenError | ConflictError
    >
  > {
    const approval = await this.deps.approvalRepository.findById(organizationId, approvalId);

    if (approval === null) {
      return err(new NotFoundError('WorkflowApproval', approvalId));
    }

    if (approval.status !== 'pending') {
      return err(
        new ConflictError('Approval is not pending', { details: { status: approval.status } }),
      );
    }

    if (!approval.assigneeIds.includes(assigneeId)) {
      return err(new ForbiddenError('Assignee is not authorized to approve this step'));
    }

    const step = await this.deps.stepRepository.findById(organizationId, approval.stepId);
    if (step === null) {
      return err(new NotFoundError('WorkflowStep', approval.stepId));
    }

    const now = new Date();

    const updatedApproval = await this.deps.approvalRepository.update(organizationId, approvalId, {
      status: 'approved',
      approvedBy: assigneeId,
      resolvedAt: now,
      ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
      ...(input.formData !== undefined ? { formData: input.formData } : {}),
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    if (updatedApproval === null) {
      return err(new NotFoundError('WorkflowApproval', approvalId));
    }

    await this.deps.stepRepository.update(organizationId, step.id, {
      status: 'completed',
      completedAt: now,
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    const instance = await this.deps.instanceRepository.findById(
      organizationId,
      approval.instanceId,
    );

    if (instance === null) {
      return err(new NotFoundError('WorkflowInstance', approval.instanceId));
    }

    const definition = await this.deps.definitionRepository.findById(
      organizationId,
      instance.definitionId,
    );

    if (definition === null) {
      return err(new NotFoundError('WorkflowDefinition', instance.definitionId));
    }

    const resumed = await this.deps.runtimeEngine.resumeAfterHumanTask(
      organizationId,
      instance,
      definition,
      step.nodeId,
      step.tokenId,
      'approved',
    );

    if (!resumed.ok) {
      return resumed;
    }

    return ok(this.toDto(updatedApproval));
  }

  async rejectStep(
    organizationId: OrganizationId,
    approvalId: string,
    assigneeId: UserId,
    input: RejectWorkflowStepInput,
    actorId?: UserId,
  ): Promise<
    Result<
      WorkflowApprovalDto,
      ValidationError | NotFoundError | ForbiddenError | ConflictError
    >
  > {
    const resolutionNote = input.resolutionNote.trim();
    if (resolutionNote.length === 0) {
      return err(
        new ValidationError('resolutionNote is required when rejecting', {
          field: 'resolutionNote',
        }),
      );
    }

    const approval = await this.deps.approvalRepository.findById(organizationId, approvalId);

    if (approval === null) {
      return err(new NotFoundError('WorkflowApproval', approvalId));
    }

    if (approval.status !== 'pending') {
      return err(
        new ConflictError('Approval is not pending', { details: { status: approval.status } }),
      );
    }

    if (!approval.assigneeIds.includes(assigneeId)) {
      return err(new ForbiddenError('Assignee is not authorized to reject this step'));
    }

    const step = await this.deps.stepRepository.findById(organizationId, approval.stepId);
    if (step === null) {
      return err(new NotFoundError('WorkflowStep', approval.stepId));
    }

    const now = new Date();

    const updatedApproval = await this.deps.approvalRepository.update(organizationId, approvalId, {
      status: 'rejected',
      rejectedBy: assigneeId,
      resolvedAt: now,
      resolutionNote,
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    if (updatedApproval === null) {
      return err(new NotFoundError('WorkflowApproval', approvalId));
    }

    await this.deps.stepRepository.update(organizationId, step.id, {
      status: 'completed',
      completedAt: now,
      ...(actorId !== undefined ? { updatedBy: actorId } : {}),
    });

    const instance = await this.deps.instanceRepository.findById(
      organizationId,
      approval.instanceId,
    );

    if (instance === null) {
      return err(new NotFoundError('WorkflowInstance', approval.instanceId));
    }

    const definition = await this.deps.definitionRepository.findById(
      organizationId,
      instance.definitionId,
    );

    if (definition === null) {
      return err(new NotFoundError('WorkflowDefinition', instance.definitionId));
    }

    const resumed = await this.deps.runtimeEngine.resumeAfterHumanTask(
      organizationId,
      instance,
      definition,
      step.nodeId,
      step.tokenId,
      'rejected',
    );

    if (!resumed.ok) {
      return resumed;
    }

    return ok(this.toDto(updatedApproval));
  }

  toDto(record: WorkflowApprovalRecord): WorkflowApprovalDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      instance_id: record.instanceId,
      step_id: record.stepId,
      approval_type: record.approvalType,
      status: record.status,
      title: record.title,
      description: record.description,
      assignee_ids: record.assigneeIds,
      approved_by: record.approvedBy,
      rejected_by: record.rejectedBy,
      form_data: record.formData,
      diff_preview: record.diffPreview,
      requested_at: record.requestedAt.toISOString(),
      expires_at: record.expiresAt?.toISOString() ?? null,
      resolved_at: record.resolvedAt?.toISOString() ?? null,
      resolution_note: record.resolutionNote,
      escalation_level: record.escalationLevel,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      version: record.version,
    };
  }
}