import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  AgentInvokerType,
  AgentRunRecord,
  AgentRunRepository,
  AgentRunStatus,
  CreateAgentRunData,
  ListAgentRunsFilter,
  OrchestrationPattern,
  UpdateAgentRunData,
} from '../../domain/repositories/agent-run.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaAgentRunRepository implements AgentRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AgentRunRecord | null> {
    const record = await this.prisma.agentRun.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateAgentRunData): Promise<AgentRunRecord> {
    const record = await this.prisma.agentRun.create({
      data: {
        organizationId: data.organizationId,
        agentDefinitionId: data.agentDefinitionId,
        definitionVersion: data.definitionVersion,
        goal: data.goal,
        status: 'init',
        ...(data.invokerType !== undefined ? { invokerType: data.invokerType } : {}),
        ...(data.invokerId !== undefined ? { invokerId: data.invokerId } : {}),
        ...(data.conversationSessionId !== undefined
          ? { conversationSessionId: data.conversationSessionId }
          : {}),
        ...(data.orchestrationPattern !== undefined
          ? { orchestrationPattern: data.orchestrationPattern }
          : {}),
        ...(data.maxIterations !== undefined ? { maxIterations: data.maxIterations } : {}),
        ...(data.budgetCents !== undefined ? { budgetCents: data.budgetCents } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAgentRunData,
  ): Promise<AgentRunRecord | null> {
    try {
      const record = await this.prisma.agentRun.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.statusReason !== undefined ? { statusReason: data.statusReason } : {}),
          ...(data.iterationCount !== undefined ? { iterationCount: data.iterationCount } : {}),
          ...(data.costCents !== undefined ? { costCents: data.costCents } : {}),
          ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
          ...(data.resultSummary !== undefined ? { resultSummary: data.resultSummary } : {}),
          ...(data.resultPayload !== undefined
            ? {
                resultPayload:
                  data.resultPayload === null
                    ? Prisma.JsonNull
                    : toJsonValue(data.resultPayload),
              }
            : {}),
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

  async list(filter: ListAgentRunsFilter): Promise<AgentRunRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.agentRun.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.agentDefinitionId !== undefined
          ? { agentDefinitionId: filter.agentDefinitionId }
          : {}),
        ...cursorFilter,
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.AgentRunWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.agentRun.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { startedAt: true, id: true },
    });

    if (anchor === null) {
      return {};
    }

    return {
      OR: [
        { startedAt: { lt: anchor.startedAt } },
        { startedAt: anchor.startedAt, id: { lt: anchor.id } },
      ],
    };
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    agentDefinitionId: string;
    definitionVersion: number;
    invokerType: string;
    invokerId: string | null;
    conversationSessionId: string | null;
    goal: string;
    status: string;
    statusReason: string | null;
    orchestrationPattern: string;
    iterationCount: number;
    maxIterations: number;
    budgetCents: number;
    costCents: number;
    llmInputTokens: bigint;
    llmOutputTokens: bigint;
    startedAt: Date;
    completedAt: Date | null;
    resultSummary: string | null;
    resultPayload: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): AgentRunRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      agentDefinitionId: record.agentDefinitionId,
      definitionVersion: record.definitionVersion,
      invokerType: record.invokerType as AgentInvokerType,
      invokerId: record.invokerId,
      conversationSessionId: record.conversationSessionId,
      goal: record.goal,
      status: record.status as AgentRunStatus,
      statusReason: record.statusReason,
      orchestrationPattern: record.orchestrationPattern as OrchestrationPattern,
      iterationCount: record.iterationCount,
      maxIterations: record.maxIterations,
      budgetCents: record.budgetCents,
      costCents: record.costCents,
      llmInputTokens: record.llmInputTokens,
      llmOutputTokens: record.llmOutputTokens,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      resultSummary: record.resultSummary,
      resultPayload: this.asRecord(record.resultPayload),
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