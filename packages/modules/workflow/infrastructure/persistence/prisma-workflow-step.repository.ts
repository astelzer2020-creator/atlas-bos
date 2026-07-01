import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateWorkflowStepData,
  UpdateWorkflowStepData,
  WorkflowAssigneeType,
  WorkflowStepRecord,
  WorkflowStepRepository,
  WorkflowStepStatus,
} from '../../domain/repositories/workflow-step.repository.js';
import type { WorkflowNodeType } from '../../domain/types/workflow-graph.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaWorkflowStepRepository implements WorkflowStepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<WorkflowStepRecord | null> {
    const record = await this.prisma.workflowStep.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async listByInstance(
    organizationId: OrganizationId,
    instanceId: string,
  ): Promise<WorkflowStepRecord[]> {
    const records = await this.prisma.workflowStep.findMany({
      where: {
        organizationId,
        instanceId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return records.map((record) => this.toRecord(record));
  }

  async create(data: CreateWorkflowStepData): Promise<WorkflowStepRecord> {
    const record = await this.prisma.workflowStep.create({
      data: {
        organizationId: data.organizationId,
        instanceId: data.instanceId,
        nodeId: data.nodeId,
        nodeType: data.nodeType,
        status: data.status,
        tokenId: data.tokenId,
        ...(data.stepName !== undefined ? { stepName: data.stepName } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.assigneeType !== undefined ? { assigneeType: data.assigneeType } : {}),
        ...(data.inputData !== undefined ? { inputData: toJsonValue(data.inputData) } : {}),
        ...(data.outputData !== undefined ? { outputData: toJsonValue(data.outputData) } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateWorkflowStepData,
  ): Promise<WorkflowStepRecord | null> {
    try {
      const record = await this.prisma.workflowStep.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.outputData !== undefined ? { outputData: toJsonValue(data.outputData) } : {}),
          ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
          ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
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

  private toRecord(record: {
    id: string;
    organizationId: string;
    instanceId: string;
    nodeId: string;
    nodeType: string;
    stepName: string | null;
    status: string;
    assigneeId: string | null;
    assigneeType: string | null;
    tokenId: string;
    inputData: unknown;
    outputData: unknown;
    agentRunId: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    dueAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): WorkflowStepRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      instanceId: record.instanceId,
      nodeId: record.nodeId,
      nodeType: record.nodeType as WorkflowNodeType,
      stepName: record.stepName,
      status: record.status as WorkflowStepStatus,
      assigneeId: record.assigneeId,
      assigneeType: record.assigneeType as WorkflowAssigneeType | null,
      tokenId: record.tokenId,
      inputData: this.asRecord(record.inputData) ?? {},
      outputData: this.asRecord(record.outputData),
      agentRunId: record.agentRunId,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      dueAt: record.dueAt,
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