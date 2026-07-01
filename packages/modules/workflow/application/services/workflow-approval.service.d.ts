import { ConflictError, ForbiddenError, NotFoundError, ValidationError, type OrganizationId, type Result, type UserId } from '@atlas/shared-kernel';
import type { WorkflowRuntimeEngine } from '../engine/workflow-runtime.engine.js';
import type { WorkflowApprovalRecord, WorkflowApprovalRepository, WorkflowApprovalStatus } from '../../domain/repositories/workflow-approval.repository.js';
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
export declare class WorkflowApprovalService {
    private readonly deps;
    constructor(deps: WorkflowApprovalServiceDeps);
    listApprovals(organizationId: OrganizationId, input?: ListWorkflowApprovalsInput): Promise<{
        data: WorkflowApprovalDto[];
        next_cursor: string | null;
    }>;
    getApproval(organizationId: OrganizationId, approvalId: string): Promise<Result<WorkflowApprovalDto, NotFoundError>>;
    approveStep(organizationId: OrganizationId, approvalId: string, assigneeId: UserId, input?: ApproveWorkflowStepInput, actorId?: UserId): Promise<Result<WorkflowApprovalDto, ValidationError | NotFoundError | ForbiddenError | ConflictError>>;
    rejectStep(organizationId: OrganizationId, approvalId: string, assigneeId: UserId, input: RejectWorkflowStepInput, actorId?: UserId): Promise<Result<WorkflowApprovalDto, ValidationError | NotFoundError | ForbiddenError | ConflictError>>;
    toDto(record: WorkflowApprovalRecord): WorkflowApprovalDto;
}
//# sourceMappingURL=workflow-approval.service.d.ts.map