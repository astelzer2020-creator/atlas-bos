import { type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';
import type { CreateWorkflowInstanceData, ListWorkflowInstancesFilter, UpdateWorkflowInstanceData, WorkflowInstanceRecord, WorkflowInstanceRepository } from '../../domain/repositories/workflow-instance.repository.js';
export declare class PrismaWorkflowInstanceRepository implements WorkflowInstanceRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    findById(organizationId: OrganizationId, id: string): Promise<WorkflowInstanceRecord | null>;
    create(data: CreateWorkflowInstanceData): Promise<WorkflowInstanceRecord>;
    update(organizationId: OrganizationId, id: string, data: UpdateWorkflowInstanceData): Promise<WorkflowInstanceRecord | null>;
    list(filter: ListWorkflowInstancesFilter): Promise<WorkflowInstanceRecord[]>;
    private buildCursorFilter;
    private toRecord;
    private asRecord;
}
//# sourceMappingURL=prisma-workflow-instance.repository.d.ts.map