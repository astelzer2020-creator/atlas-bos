import type { OrganizationId, UserId } from '@atlas/shared-kernel';
import type { WorkflowNodeType } from '../types/workflow-graph.js';
export type WorkflowStepStatus = 'pending' | 'active' | 'waiting' | 'completed' | 'failed' | 'skipped' | 'compensated';
export type WorkflowAssigneeType = 'user' | 'role' | 'team' | 'agent';
export interface WorkflowStepRecord {
    readonly id: string;
    readonly organizationId: OrganizationId;
    readonly instanceId: string;
    readonly nodeId: string;
    readonly nodeType: WorkflowNodeType;
    readonly stepName: string | null;
    readonly status: WorkflowStepStatus;
    readonly assigneeId: string | null;
    readonly assigneeType: WorkflowAssigneeType | null;
    readonly tokenId: string;
    readonly inputData: Record<string, unknown>;
    readonly outputData: Record<string, unknown> | null;
    readonly agentRunId: string | null;
    readonly errorMessage: string | null;
    readonly startedAt: Date | null;
    readonly completedAt: Date | null;
    readonly dueAt: Date | null;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly version: number;
}
export interface CreateWorkflowStepData {
    readonly organizationId: OrganizationId;
    readonly instanceId: string;
    readonly nodeId: string;
    readonly nodeType: WorkflowNodeType;
    readonly stepName?: string;
    readonly status: WorkflowStepStatus;
    readonly tokenId: string;
    readonly assigneeId?: string;
    readonly assigneeType?: WorkflowAssigneeType;
    readonly inputData?: Record<string, unknown>;
    readonly outputData?: Record<string, unknown>;
    readonly startedAt?: Date;
    readonly completedAt?: Date;
    readonly createdBy?: UserId;
}
export interface UpdateWorkflowStepData {
    readonly status?: WorkflowStepStatus;
    readonly outputData?: Record<string, unknown>;
    readonly completedAt?: Date;
    readonly errorMessage?: string;
    readonly updatedBy?: UserId;
}
export interface WorkflowStepRepository {
    findById(organizationId: OrganizationId, id: string): Promise<WorkflowStepRecord | null>;
    listByInstance(organizationId: OrganizationId, instanceId: string): Promise<WorkflowStepRecord[]>;
    create(data: CreateWorkflowStepData): Promise<WorkflowStepRecord>;
    update(organizationId: OrganizationId, id: string, data: UpdateWorkflowStepData): Promise<WorkflowStepRecord | null>;
}
//# sourceMappingURL=workflow-step.repository.d.ts.map