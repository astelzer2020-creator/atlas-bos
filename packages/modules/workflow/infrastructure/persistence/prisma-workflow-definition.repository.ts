import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  CreateWorkflowDefinitionData,
  ListWorkflowDefinitionsFilter,
  UpdateWorkflowDefinitionData,
  WorkflowDefinitionRecord,
  WorkflowDefinitionRepository,
  WorkflowDefinitionStatus,
} from '../../domain/repositories/workflow-definition.repository.js';
import { DEFAULT_WORKFLOW_GRAPH, parseWorkflowGraph } from '../../domain/types/workflow-graph.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaWorkflowDefinitionRepository implements WorkflowDefinitionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<WorkflowDefinitionRecord | null> {
    const record = await this.prisma.workflowDefinition.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findBySlug(
    organizationId: OrganizationId,
    slug: string,
  ): Promise<WorkflowDefinitionRecord | null> {
    const record = await this.prisma.workflowDefinition.findFirst({
      where: {
        organizationId,
        slug,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateWorkflowDefinitionData): Promise<WorkflowDefinitionRecord> {
    const record = await this.prisma.workflowDefinition.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        status: 'draft',
        graphDefinition: toJsonValue(data.graphDefinition as unknown as Record<string, unknown>),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.inputSchema !== undefined ? { inputSchema: toJsonValue(data.inputSchema) } : {}),
        ...(data.outputSchema !== undefined ? { outputSchema: toJsonValue(data.outputSchema) } : {}),
        ...(data.isTemplate !== undefined ? { isTemplate: data.isTemplate } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateWorkflowDefinitionData,
    expectedVersion: number,
  ): Promise<WorkflowDefinitionRecord | null> {
    try {
      const record = await this.prisma.workflowDefinition.update({
        where: {
          id,
          organizationId,
          version: expectedVersion,
          deletedAt: null,
          status: 'draft',
        },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.graphDefinition !== undefined
            ? { graphDefinition: toJsonValue(data.graphDefinition as unknown as Record<string, unknown>) }
            : {}),
          ...(data.slaPolicies !== undefined ? { slaPolicies: toJsonValue(data.slaPolicies) } : {}),
          ...(data.inputSchema !== undefined ? { inputSchema: toJsonValue(data.inputSchema) } : {}),
          ...(data.outputSchema !== undefined ? { outputSchema: toJsonValue(data.outputSchema) } : {}),
          ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
          version: { increment: 1 },
        },
      });

      return this.toRecord(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async publish(
    organizationId: OrganizationId,
    id: string,
    publishedAt: Date,
    updatedBy?: UserId,
  ): Promise<WorkflowDefinitionRecord | null> {
    try {
      const record = await this.prisma.workflowDefinition.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
          status: 'draft',
        },
        data: {
          status: 'published',
          publishedAt,
          ...(updatedBy !== undefined ? { updatedBy } : {}),
          version: { increment: 1 },
        },
      });

      return this.toRecord(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async list(filter: ListWorkflowDefinitionsFilter): Promise<WorkflowDefinitionRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.workflowDefinition.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.category !== undefined ? { category: filter.category } : {}),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.WorkflowDefinitionWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.workflowDefinition.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    if (anchor === null) {
      return {};
    }

    return {
      OR: [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ],
    };
  }

  private toRecord(record: {
    id: string;
    organizationId: string | null;
    name: string;
    slug: string;
    description: string | null;
    definitionVersion: number;
    status: string;
    category: string;
    graphDefinition: unknown;
    slaPolicies: unknown;
    compensationHandlers: unknown;
    inputSchema: unknown;
    outputSchema: unknown;
    estimatedDurationHours: number | null;
    isTemplate: boolean;
    publishedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): WorkflowDefinitionRecord {
    const graph = parseWorkflowGraph(record.graphDefinition) ?? DEFAULT_WORKFLOW_GRAPH;

    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId | null,
      name: record.name,
      slug: record.slug,
      description: record.description,
      definitionVersion: record.definitionVersion,
      status: record.status as WorkflowDefinitionStatus,
      category: record.category,
      graphDefinition: graph,
      slaPolicies: this.asRecord(record.slaPolicies) ?? {},
      compensationHandlers: this.asRecord(record.compensationHandlers) ?? {},
      inputSchema: this.asRecord(record.inputSchema) ?? {},
      outputSchema: this.asRecord(record.outputSchema) ?? {},
      estimatedDurationHours: record.estimatedDurationHours,
      isTemplate: record.isTemplate,
      publishedAt: record.publishedAt,
      metadata: this.asRecord(record.metadata) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}