import type { OrganizationId, UserId } from '@atlas/shared-kernel';
export type WorkflowApprovalType = 'single' | 'any_of' | 'all_of' | 'sequential';
export type WorkflowApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'delegated' | 'cancelled';
export interface WorkflowApprovalRecord {
    readonly id: string;
    readonly organizationId: OrganizationId;
    readonly instanceId: string;
    readonly stepId: string;
    readonly approvalType: WorkflowApprovalType;
    readonly status: WorkflowApprovalStatus;
    readonly title: string;
    readonly description: string | null;
    readonly assigneeIds: string[];
    readonly approvedBy: string | null;
    readonly rejectedBy: string | null;
    readonly formData: Record<string, unknown>;
    readonly diffPreview: Record<string, unknown> | null;
    readonly requestedAt: Date;
    readonly expiresAt: Date | null;
    readonly resolvedAt: Date | null;
    readonly resolutionNote: string | null;
    readonly escalationLevel: number;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly version: number;
}
export interface CreateWorkflowApprovalData {
    readonly organizationId: OrganizationId;
    readonly instanceId: string;
    readonly stepId: string;
    readonly approvalType?: WorkflowApprovalType;
    readonly title: string;
    readonly description?: string;
    readonly assigneeIds: string[];
    readonly createdBy?: UserId;
}
export interface UpdateWorkflowApprovalData {
    readonly status?: WorkflowApprovalStatus;
    readonly approvedBy?: UserId;
    readonly rejectedBy?: UserId;
    readonly formData?: Record<string, unknown>;
    readonly resolvedAt?: Date;
    readonly resolutionNote?: string;
    readonly updatedBy?: UserId;
}
export interface ListWorkflowApprovalsFilter {
    readonly organizationId: OrganizationId;
    readonly status?: WorkflowApprovalStatus;
    readonly instanceId?: string;
    readonly limit: number;
    readonly cursor?: string;
}
export interface WorkflowApprovalRepository {
    findById(organizationId: OrganizationId, id: string): Promise<WorkflowApprovalRecord | null>;
    create(data: CreateWorkflowApprovalData): Promise<WorkflowApprovalRecord>;
    update(organizationId: OrganizationId, id: string, data: UpdateWorkflowApprovalData): Promise<WorkflowApprovalRecord | null>;
    cancelPendingByInstance(organizationId: OrganizationId, instanceId: string, updatedBy?: UserId): Promise<number>;
    list(filter: ListWorkflowApprovalsFilter): Promise<WorkflowApprovalRecord[]>;
}
//# sourceMappingURL=workflow-approval.repository.d.ts.map