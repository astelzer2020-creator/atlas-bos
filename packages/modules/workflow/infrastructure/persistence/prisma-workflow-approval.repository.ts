import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  CreateWorkflowApprovalData,
  ListWorkflowApprovalsFilter,
  UpdateWorkflowApprovalData,
  WorkflowApprovalRecord,
  WorkflowApprovalRepository,
  WorkflowApprovalStatus,
  WorkflowApprovalType,
} from '../../domain/repositories/workflow-approval.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaWorkflowApprovalRepository implements WorkflowApprovalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<WorkflowApprovalRecord | null> {
    const record = await this.prisma.workflowApproval.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateWorkflowApprovalData): Promise<WorkflowApprovalRecord> {
    const record = await this.prisma.workflowApproval.create({
      data: {
        organizationId: data.organizationId,
        instanceId: data.instanceId,
        stepId: data.stepId,
        title: data.title,
        assigneeIds: data.assigneeIds,
        status: 'pending',
        ...(data.approvalType !== undefined ? { approvalType: data.approvalType } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateWorkflowApprovalData,
  ): Promise<WorkflowApprovalRecord | null> {
    try {
      const record = await this.prisma.workflowApproval.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
        },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.approvedBy !== undefined ? { approvedBy: data.approvedBy } : {}),
          ...(data.rejectedBy !== undefined ? { rejectedBy: data.rejectedBy } : {}),
          ...(data.formData !== undefined ? { formData: toJsonValue(data.formData) } : {}),
          ...(data.resolvedAt !== undefined ? { resolvedAt: data.resolvedAt } : {}),
          ...(data.resolutionNote !== undefined ? { resolutionNote: data.resolutionNote } : {}),
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

  async cancelPendingByInstance(
    organizationId: OrganizationId,
    instanceId: string,
    updatedBy?: UserId,
  ): Promise<number> {
    const result = await this.prisma.workflowApproval.updateMany({
      where: {
        organizationId,
        instanceId,
        status: 'pending',
        deletedAt: null,
      },
      data: {
        status: 'cancelled',
        resolvedAt: new Date(),
        ...(updatedBy !== undefined ? { updatedBy } : {}),
      },
    });

    return result.count;
  }

  async list(filter: ListWorkflowApprovalsFilter): Promise<WorkflowApprovalRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.workflowApproval.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.instanceId !== undefined ? { instanceId: filter.instanceId } : {}),
        ...cursorFilter,
      },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.WorkflowApprovalWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.workflowApproval.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { requestedAt: true, id: true },
    });

    if (anchor === null) {
      return {};
    }

    return {
      OR: [
        { requestedAt: { lt: anchor.requestedAt } },
        { requestedAt: anchor.requestedAt, id: { lt: anchor.id } },
      ],
    };
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    instanceId: string;
    stepId: string;
    approvalType: string;
    status: string;
    title: string;
    description: string | null;
    assigneeIds: string[];
    approvedBy: string | null;
    rejectedBy: string | null;
    formData: unknown;
    diffPreview: unknown;
    requestedAt: Date;
    expiresAt: Date | null;
    resolvedAt: Date | null;
    resolutionNote: string | null;
    escalationLevel: number;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): WorkflowApprovalRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      instanceId: record.instanceId,
      stepId: record.stepId,
      approvalType: record.approvalType as WorkflowApprovalType,
      status: record.status as WorkflowApprovalStatus,
      title: record.title,
      description: record.description,
      assigneeIds: record.assigneeIds,
      approvedBy: record.approvedBy,
      rejectedBy: record.rejectedBy,
      formData: this.asRecord(record.formData) ?? {},
      diffPreview: this.asRecord(record.diffPreview),
      requestedAt: record.requestedAt,
      expiresAt: record.expiresAt,
      resolvedAt: record.resolvedAt,
      resolutionNote: record.resolutionNote,
      escalationLevel: record.escalationLevel,
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