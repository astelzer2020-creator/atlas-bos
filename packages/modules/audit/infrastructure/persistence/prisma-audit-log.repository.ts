import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  AppendAuditLogData,
  AuditLogEntryRecord,
  AuditLogRepository,
  QueryAuditLogFilter,
} from '../../domain/repositories/audit-log.repository.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

function resolveClient(prisma: PrismaClient, tx?: DbClient): DbClient {
  return tx ?? prisma;
}

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(data: AppendAuditLogData, tx?: DbClient): Promise<AuditLogEntryRecord> {
    const client = resolveClient(this.prisma, tx);

    const record = await client.auditLogEntry.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actorId: data.actorId ?? null,
        actorType: data.actorType ?? 'user',
        ...(data.changes !== undefined ? { changes: toJsonValue(data.changes) } : {}),
        ...(data.previousState !== undefined ? { previousState: toJsonValue(data.previousState) } : {}),
        ...(data.newState !== undefined ? { newState: toJsonValue(data.newState) } : {}),
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        correlationId: data.correlationId ?? null,
        requestId: data.requestId ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt } : {}),
      },
    });

    return this.toRecord(record);
  }

  async query(filter: QueryAuditLogFilter): Promise<AuditLogEntryRecord[]> {
    const cursorId = filter.cursor !== undefined ? BigInt(filter.cursor) : undefined;

    const records = await this.prisma.auditLogEntry.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.entityType !== undefined ? { entityType: filter.entityType } : {}),
        ...(filter.entityId !== undefined ? { entityId: filter.entityId } : {}),
        ...(filter.actorId !== undefined ? { actorId: filter.actorId } : {}),
        ...(filter.action !== undefined ? { action: filter.action } : {}),
        ...(filter.occurredFrom !== undefined || filter.occurredTo !== undefined
          ? {
              occurredAt: {
                ...(filter.occurredFrom !== undefined ? { gte: filter.occurredFrom } : {}),
                ...(filter.occurredTo !== undefined ? { lte: filter.occurredTo } : {}),
              },
            }
          : {}),
        ...(cursorId !== undefined ? { id: { lt: cursorId } } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private toRecord(record: {
    id: bigint;
    tenantId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    actorType: string;
    changes: unknown;
    previousState: unknown;
    newState: unknown;
    metadata: unknown;
    correlationId: string | null;
    requestId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    occurredAt: Date;
  }): AuditLogEntryRecord {
    return {
      id: record.id.toString(),
      tenantId: record.tenantId as OrganizationId | null,
      entityType: record.entityType,
      entityId: record.entityId,
      action: record.action as AuditLogEntryRecord['action'],
      actorId: record.actorId as UserId | null,
      actorType: record.actorType as AuditLogEntryRecord['actorType'],
      changes: this.asRecord(record.changes),
      previousState: this.asRecord(record.previousState),
      newState: this.asRecord(record.newState),
      metadata: this.asRecord(record.metadata) ?? {},
      correlationId: record.correlationId,
      requestId: record.requestId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      occurredAt: record.occurredAt,
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