import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  ActionExecutedRecord,
  AutomationExecutionLogRecord,
  AutomationExecutionLogRepository,
  AutomationExecutionStatus,
  CreateAutomationExecutionLogData,
  UpdateAutomationExecutionLogData,
} from '../../domain/repositories/automation-execution-log.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toJsonArray(value: ActionExecutedRecord[]): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export class PrismaAutomationExecutionLogRepository implements AutomationExecutionLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateAutomationExecutionLogData): Promise<AutomationExecutionLogRecord> {
    const record = await this.prisma.automationExecutionLog.create({
      data: {
        organizationId: data.organizationId,
        ruleId: data.ruleId,
        status: data.status,
        ...(data.triggerType !== undefined ? { triggerType: data.triggerType } : {}),
        ...(data.triggerPayload !== undefined
          ? { triggerPayload: toJsonValue(data.triggerPayload) }
          : {}),
        ...(data.actionsExecuted !== undefined
          ? { actionsExecuted: toJsonArray(data.actionsExecuted) }
          : {}),
        ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
        ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
        ...(data.idempotencyKey !== undefined ? { idempotencyKey: data.idempotencyKey } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAutomationExecutionLogData,
  ): Promise<AutomationExecutionLogRecord | null> {
    try {
      const record = await this.prisma.automationExecutionLog.update({
        where: { id, organizationId },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.actionsExecuted !== undefined
            ? { actionsExecuted: toJsonArray(data.actionsExecuted) }
            : {}),
          ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
          ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
          ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
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

  async findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AutomationExecutionLogRecord | null> {
    const record = await this.prisma.automationExecutionLog.findFirst({
      where: { id, organizationId },
    });

    return record === null ? null : this.toRecord(record);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    ruleId: string;
    status: string;
    triggerType: string | null;
    triggerPayload: unknown;
    actionsExecuted: unknown;
    errorMessage: string | null;
    durationMs: number | null;
    idempotencyKey: string | null;
    startedAt: Date;
    completedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
  }): AutomationExecutionLogRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      ruleId: record.ruleId,
      status: record.status as AutomationExecutionStatus,
      triggerType: record.triggerType,
      triggerPayload: this.asRecord(record.triggerPayload) ?? {},
      actionsExecuted: this.asActionArray(record.actionsExecuted),
      errorMessage: record.errorMessage,
      durationMs: record.durationMs,
      idempotencyKey: record.idempotencyKey,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      metadata: this.asRecord(record.metadata) ?? {},
      createdAt: record.createdAt,
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

  private asActionArray(value: unknown): ActionExecutedRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value as ActionExecutedRecord[];
  }
}