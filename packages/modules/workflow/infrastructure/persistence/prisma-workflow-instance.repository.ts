import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateWorkflowInstanceData,
  ListWorkflowInstancesFilter,
  UpdateWorkflowInstanceData,
  WorkflowInitiatorType,
  WorkflowInstanceRecord,
  WorkflowInstanceRepository,
  WorkflowInstanceStatus,
} from '../../domain/repositories/workflow-instance.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaWorkflowInstanceRepository implements WorkflowInstanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<WorkflowInstanceRecord | null> {
    const record = await this.prisma.workflowInstance.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateWorkflowInstanceData): Promise<WorkflowInstanceRecord> {
    const record = await this.prisma.workflowInstance.create({
      data: {
        organizationId: data.organizationId,
        definitionId: data.definitionId,
        definitionVersion: data.definitionVersion,
        status: 'running',
        ...(data.entityType !== undefined ? { entityType: data.entityType } : {}),
        ...(data.entityId !== undefined ? { entityId: data.entityId } : {}),
        ...(data.correlationId !== undefined ? { correlationId: data.correlationId } : {}),
        ...(data.initiatorType !== undefined ? { initiatorType: data.initiatorType } : {}),
        ...(data.initiatorId !== undefined ? { initiatorId: data.initiatorId } : {}),
        ...(data.inputPayload !== undefined ? { inputPayload: toJsonValue(data.inputPayload) } : {}),
        ...(data.contextVariables !== undefined
          ? { contextVariables: toJsonValue(data.contextVariables) }
          : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateWorkflowInstanceData,
  ): Promise<WorkflowInstanceRecord | null> {
    try {
      const record = await this.prisma.workflowInstance.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.currentNodeId !== undefined ? { currentNodeId: data.currentNodeId } : {}),
          ...(data.outputPayload !== undefined
            ? { outputPayload: data.outputPayload === null ? Prisma.JsonNull : toJsonValue(data.outputPayload) }
            : {}),
          ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
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

  async list(filter: ListWorkflowInstancesFilter): Promise<WorkflowInstanceRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.workflowInstance.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.definitionId !== undefined ? { definitionId: filter.definitionId } : {}),
        ...(filter.entityType !== undefined ? { entityType: filter.entityType } : {}),
        ...(filter.entityId !== undefined ? { entityId: filter.entityId } : {}),
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
  ): Promise<Prisma.WorkflowInstanceWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.workflowInstance.findFirst({
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
    definitionId: string;
    definitionVersion: number;
    parentInstanceId: string | null;
    status: string;
    entityType: string | null;
    entityId: string | null;
    correlationId: string | null;
    initiatorType: string;
    initiatorId: string | null;
    currentNodeId: string | null;
    contextVariables: unknown;
    inputPayload: unknown;
    outputPayload: unknown;
    startedAt: Date;
    completedAt: Date | null;
    dueAt: Date | null;
    slaBreachAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): WorkflowInstanceRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      definitionId: record.definitionId,
      definitionVersion: record.definitionVersion,
      parentInstanceId: record.parentInstanceId,
      status: record.status as WorkflowInstanceStatus,
      entityType: record.entityType,
      entityId: record.entityId,
      correlationId: record.correlationId,
      initiatorType: record.initiatorType as WorkflowInitiatorType,
      initiatorId: record.initiatorId,
      currentNodeId: record.currentNodeId,
      contextVariables: this.asRecord(record.contextVariables) ?? {},
      inputPayload: this.asRecord(record.inputPayload) ?? {},
      outputPayload: this.asRecord(record.outputPayload),
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      dueAt: record.dueAt,
      slaBreachAt: record.slaBreachAt,
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