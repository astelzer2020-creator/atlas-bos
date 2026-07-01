import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  AgentDefinitionRecord,
  AgentDefinitionRepository,
  AgentDefinitionStatus,
  AgentRole,
  CreateAgentDefinitionData,
  ListAgentDefinitionsFilter,
  UpdateAgentDefinitionData,
} from '../../domain/repositories/agent-definition.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaAgentDefinitionRepository implements AgentDefinitionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AgentDefinitionRecord | null> {
    const record = await this.prisma.agentDefinition.findFirst({
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
  ): Promise<AgentDefinitionRecord | null> {
    const record = await this.prisma.agentDefinition.findFirst({
      where: {
        organizationId,
        slug,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateAgentDefinitionData): Promise<AgentDefinitionRecord> {
    const record = await this.prisma.agentDefinition.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        role: data.role,
        systemPrompt: data.systemPrompt,
        status: 'draft',
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.modelId !== undefined ? { modelId: data.modelId } : {}),
        ...(data.allowedTools !== undefined ? { allowedTools: data.allowedTools } : {}),
        ...(data.constraints !== undefined ? { constraints: toJsonValue(data.constraints) } : {}),
        ...(data.memoryConfig !== undefined ? { memoryConfig: toJsonValue(data.memoryConfig) } : {}),
        ...(data.riskPolicy !== undefined ? { riskPolicy: toJsonValue(data.riskPolicy) } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAgentDefinitionData,
    expectedVersion: number,
  ): Promise<AgentDefinitionRecord | null> {
    try {
      const record = await this.prisma.agentDefinition.update({
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
          ...(data.systemPrompt !== undefined ? { systemPrompt: data.systemPrompt } : {}),
          ...(data.allowedTools !== undefined ? { allowedTools: data.allowedTools } : {}),
          ...(data.constraints !== undefined ? { constraints: toJsonValue(data.constraints) } : {}),
          ...(data.memoryConfig !== undefined ? { memoryConfig: toJsonValue(data.memoryConfig) } : {}),
          ...(data.riskPolicy !== undefined ? { riskPolicy: toJsonValue(data.riskPolicy) } : {}),
          ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
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
    updatedBy?: string,
  ): Promise<AgentDefinitionRecord | null> {
    try {
      const record = await this.prisma.agentDefinition.update({
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

  async list(filter: ListAgentDefinitionsFilter): Promise<AgentDefinitionRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.agentDefinition.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.role !== undefined ? { role: filter.role } : {}),
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
  ): Promise<Prisma.AgentDefinitionWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.agentDefinition.findFirst({
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
    role: string;
    definitionVersion: number;
    status: string;
    modelId: string;
    systemPrompt: string;
    allowedTools: string[];
    constraints: unknown;
    memoryConfig: unknown;
    riskPolicy: unknown;
    isDefault: boolean;
    publishedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): AgentDefinitionRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId | null,
      name: record.name,
      slug: record.slug,
      description: record.description,
      role: record.role as AgentRole,
      definitionVersion: record.definitionVersion,
      status: record.status as AgentDefinitionStatus,
      modelId: record.modelId,
      systemPrompt: record.systemPrompt,
      allowedTools: record.allowedTools,
      constraints: this.asRecord(record.constraints) ?? {},
      memoryConfig: this.asRecord(record.memoryConfig) ?? {},
      riskPolicy: this.asRecord(record.riskPolicy) ?? {},
      isDefault: record.isDefault,
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