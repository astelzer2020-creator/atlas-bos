import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { WorkflowGraph } from '../types/workflow-graph.js';

export type WorkflowDefinitionStatus = 'draft' | 'published' | 'deprecated' | 'archived';

export interface WorkflowDefinitionRecord {
  readonly id: string;
  readonly organizationId: OrganizationId | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly definitionVersion: number;
  readonly status: WorkflowDefinitionStatus;
  readonly category: string;
  readonly graphDefinition: WorkflowGraph;
  readonly slaPolicies: Record<string, unknown>;
  readonly compensationHandlers: Record<string, unknown>;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
  readonly estimatedDurationHours: number | null;
  readonly isTemplate: boolean;
  readonly publishedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CreateWorkflowDefinitionData {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly category?: string;
  readonly graphDefinition: WorkflowGraph;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly isTemplate?: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateWorkflowDefinitionData {
  readonly name?: string;
  readonly description?: string | null;
  readonly graphDefinition?: WorkflowGraph;
  readonly slaPolicies?: Record<string, unknown>;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListWorkflowDefinitionsFilter {
  readonly organizationId: OrganizationId;
  readonly status?: WorkflowDefinitionStatus;
  readonly category?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface WorkflowDefinitionRepository {
  findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<WorkflowDefinitionRecord | null>;

  findBySlug(
    organizationId: OrganizationId,
    slug: string,
  ): Promise<WorkflowDefinitionRecord | null>;

  create(data: CreateWorkflowDefinitionData): Promise<WorkflowDefinitionRecord>;

  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateWorkflowDefinitionData,
    expectedVersion: number,
  ): Promise<WorkflowDefinitionRecord | null>;

  publish(
    organizationId: OrganizationId,
    id: string,
    publishedAt: Date,
    updatedBy?: UserId,
  ): Promise<WorkflowDefinitionRecord | null>;

  list(filter: ListWorkflowDefinitionsFilter): Promise<WorkflowDefinitionRecord[]>;
}

export type WorkflowDefinitionRepositoryTx = Prisma.TransactionClient;