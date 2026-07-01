import { type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';
import type { CreateWorkflowDefinitionData, ListWorkflowDefinitionsFilter, UpdateWorkflowDefinitionData, WorkflowDefinitionRecord, WorkflowDefinitionRepository } from '../../domain/repositories/workflow-definition.repository.js';
export declare class PrismaWorkflowDefinitionRepository implements WorkflowDefinitionRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    findById(organizationId: OrganizationId, id: string): Promise<WorkflowDefinitionRecord | null>;
    findBySlug(organizationId: OrganizationId, slug: string): Promise<WorkflowDefinitionRecord | null>;
    create(data: CreateWorkflowDefinitionData): Promise<WorkflowDefinitionRecord>;
    update(organizationId: OrganizationId, id: string, data: UpdateWorkflowDefinitionData, expectedVersion: number): Promise<WorkflowDefinitionRecord | null>;
    publish(organizationId: OrganizationId, id: string, publishedAt: Date, updatedBy?: UserId): Promise<WorkflowDefinitionRecord | null>;
    list(filter: ListWorkflowDefinitionsFilter): Promise<WorkflowDefinitionRecord[]>;
    private buildCursorFilter;
    private toRecord;
    private asRecord;
}
//# sourceMappingURL=prisma-workflow-definition.repository.d.ts.map