import { type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';
import type { CreateWorkflowStepData, UpdateWorkflowStepData, WorkflowStepRecord, WorkflowStepRepository } from '../../domain/repositories/workflow-step.repository.js';
export declare class PrismaWorkflowStepRepository implements WorkflowStepRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    findById(organizationId: OrganizationId, id: string): Promise<WorkflowStepRecord | null>;
    listByInstance(organizationId: OrganizationId, instanceId: string): Promise<WorkflowStepRecord[]>;
    create(data: CreateWorkflowStepData): Promise<WorkflowStepRecord>;
    update(organizationId: OrganizationId, id: string, data: UpdateWorkflowStepData): Promise<WorkflowStepRecord | null>;
    private toRecord;
    private asRecord;
}
//# sourceMappingURL=prisma-workflow-step.repository.d.ts.map