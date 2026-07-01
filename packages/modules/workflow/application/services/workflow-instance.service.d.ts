import { ConflictError, NotFoundError, ValidationError, type OrganizationId, type Result, type UserId } from '@atlas/shared-kernel';
import type { WorkflowRuntimeEngine } from '../engine/workflow-runtime.engine.js';
import type { WorkflowApprovalRepository } from '../../domain/repositories/workflow-approval.repository.js';
import type { WorkflowDefinitionRepository } from '../../domain/repositories/workflow-definition.repository.js';
import type { WorkflowInstanceRecord, WorkflowInstanceRepository, WorkflowInstanceStatus, WorkflowInitiatorType } from '../../domain/repositories/workflow-instance.repository.js';
import type { WorkflowStepRepository } from '../../domain/repositories/workflow-step.repository.js';
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
export declare class WorkflowInstanceService {
    private readonly deps;
    constructor(deps: WorkflowInstanceServiceDeps);
    startInstance(organizationId: OrganizationId, input: StartWorkflowInstanceInput, actorId?: UserId): Promise<Result<WorkflowInstanceDto, ValidationError | NotFoundError | ConflictError>>;
    getInstance(organizationId: OrganizationId, instanceId: string, includeSteps?: boolean): Promise<Result<WorkflowInstanceDetailDto, NotFoundError>>;
    listInstances(organizationId: OrganizationId, input?: ListWorkflowInstancesInput): Promise<{
        data: WorkflowInstanceDto[];
        next_cursor: string | null;
    }>;
    cancelInstance(organizationId: OrganizationId, instanceId: string, reason?: string, actorId?: UserId): Promise<Result<WorkflowInstanceDto, NotFoundError | ConflictError>>;
    toDto(record: WorkflowInstanceRecord): WorkflowInstanceDto;
    private toStepDto;
}
//# sourceMappingURL=workflow-instance.service.d.ts.map