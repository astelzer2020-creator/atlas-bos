import { type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';
import type { CreateWorkflowApprovalData, ListWorkflowApprovalsFilter, UpdateWorkflowApprovalData, WorkflowApprovalRecord, WorkflowApprovalRepository } from '../../domain/repositories/workflow-approval.repository.js';
export declare class PrismaWorkflowApprovalRepository implements WorkflowApprovalRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    findById(organizationId: OrganizationId, id: string): Promise<WorkflowApprovalRecord | null>;
    create(data: CreateWorkflowApprovalData): Promise<WorkflowApprovalRecord>;
    update(organizationId: OrganizationId, id: string, data: UpdateWorkflowApprovalData): Promise<WorkflowApprovalRecord | null>;
    cancelPendingByInstance(organizationId: OrganizationId, instanceId: string, updatedBy?: UserId): Promise<number>;
    list(filter: ListWorkflowApprovalsFilter): Promise<WorkflowApprovalRecord[]>;
    private buildCursorFilter;
    private toRecord;
    private asRecord;
}
//# sourceMappingURL=prisma-workflow-approval.repository.d.ts.map