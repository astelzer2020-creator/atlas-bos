import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  AppendDomainEventData,
  AppendOutboxEventData,
  DomainEventArchiveRecord,
  EventOutboxRecord,
  EventOutboxRepository,
  MoveToDeadLetterData,
  PollPendingOptions,
} from '../../domain/repositories/event-outbox.repository.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

const DEFAULT_LOCK_STALE_MS = 5 * 60 * 1000;

function resolveClient(prisma: PrismaClient, tx?: DbClient): DbClient {
  return tx ?? prisma;
}

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaEventOutboxRepository implements EventOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(data: AppendOutboxEventData, tx?: DbClient): Promise<EventOutboxRecord> {
    const client = resolveClient(this.prisma, tx);

    const record = await client.eventOutbox.create({
      data: {
        tenantId: data.tenantId,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        eventType: data.eventType,
        eventVersion: data.eventVersion ?? 1,
        payload: toJsonValue(data.payload),
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        correlationId: data.correlationId ?? null,
        causationId: data.causationId ?? null,
        priority: data.priority ?? 3,
      },
    });

    return this.toOutboxRecord(record);
  }

  async appendDomainEvent(data: AppendDomainEventData, tx?: DbClient): Promise<DomainEventArchiveRecord> {
    const client = resolveClient(this.prisma, tx);

    const sequenceNumber = await this.getNextSequenceNumber(
      data.tenantId,
      data.aggregateType,
      data.aggregateId,
      client,
    );

    const record = await client.domainEvent.create({
      data: {
        tenantId: data.tenantId,
        eventType: data.eventType,
        eventVersion: data.eventVersion ?? 1,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        payload: toJsonValue(data.payload),
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        correlationId: data.correlationId ?? null,
        causationId: data.causationId ?? null,
        actorId: data.actorId ?? null,
        actorType: data.actorType ?? 'system',
        sequenceNumber,
        ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt } : {}),
      },
    });

    return this.toArchiveRecord(record);
  }

  async getNextSequenceNumber(
    tenantId: OrganizationId,
    aggregateType: string,
    aggregateId: string,
    tx?: DbClient,
  ): Promise<bigint> {
    const client = resolveClient(this.prisma, tx);

    const latest = await client.domainEvent.findFirst({
      where: {
        tenantId,
        aggregateType,
        aggregateId,
      },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    return latest === null ? 1n : latest.sequenceNumber + 1n;
  }

  async pollPending(options: PollPendingOptions): Promise<EventOutboxRecord[]> {
    const lockStaleAfterMs = options.lockStaleAfterMs ?? DEFAULT_LOCK_STALE_MS;
    const staleBefore = new Date(Date.now() - lockStaleAfterMs);

    return this.prisma.$transaction(async (tx) => {
      const lockedIds = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM atlas_audit.event_outbox
        WHERE published_at IS NULL
          AND (
            locked_at IS NULL
            OR locked_at < ${staleBefore}
          )
        ORDER BY priority ASC, created_at ASC
        LIMIT ${options.limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (lockedIds.length === 0) {
        return [];
      }

      const ids = lockedIds.map((row) => row.id);
      const now = new Date();

      await tx.eventOutbox.updateMany({
        where: { id: { in: ids } },
        data: {
          lockedBy: options.lockedBy,
          lockedAt: now,
          lastAttemptAt: now,
          publishAttempts: { increment: 1 },
        },
      });

      const records = await tx.eventOutbox.findMany({
        where: { id: { in: ids } },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });

      return records.map((record) => this.toOutboxRecord(record));
    });
  }

  async markPublished(id: string, tx?: DbClient): Promise<void> {
    const client = resolveClient(this.prisma, tx);

    await client.eventOutbox.update({
      where: { id },
      data: {
        publishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lastError: null,
      },
    });
  }

  async moveToDeadLetter(outboxId: string, data: MoveToDeadLetterData, tx?: DbClient): Promise<void> {
    const client = resolveClient(this.prisma, tx);

    await client.eventDeadLetter.create({
      data: {
        tenantId: data.tenantId,
        sourceTable: 'event_outbox',
        sourceId: data.sourceId,
        eventType: data.eventType,
        payload: toJsonValue(data.payload),
        metadata: data.metadata as Prisma.InputJsonValue,
        failureReason: data.failureReason,
        failureCount: data.failureCount,
        firstFailedAt: data.firstFailedAt,
        lastFailedAt: new Date(),
      },
    });

    await client.eventOutbox.update({
      where: { id: outboxId },
      data: {
        publishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lastError: data.failureReason,
      },
    });
  }

  async findById(id: string): Promise<EventOutboxRecord | null> {
    const record = await this.prisma.eventOutbox.findFirst({
      where: { id },
    });

    return record === null ? null : this.toOutboxRecord(record);
  }

  private toOutboxRecord(record: {
    id: string;
    tenantId: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    eventVersion: number;
    payload: unknown;
    metadata: unknown;
    correlationId: string | null;
    causationId: string | null;
    priority: number;
    createdAt: Date;
    publishedAt: Date | null;
    publishAttempts: number;
    lastAttemptAt: Date | null;
    lastError: string | null;
    lockedBy: string | null;
    lockedAt: Date | null;
  }): EventOutboxRecord {
    return {
      id: record.id,
      tenantId: record.tenantId as OrganizationId | null,
      aggregateType: record.aggregateType,
      aggregateId: record.aggregateId,
      eventType: record.eventType,
      eventVersion: record.eventVersion,
      payload: this.asRecord(record.payload) ?? {},
      metadata: this.asRecord(record.metadata) ?? {},
      correlationId: record.correlationId,
      causationId: record.causationId,
      priority: record.priority,
      createdAt: record.createdAt,
      publishedAt: record.publishedAt,
      publishAttempts: record.publishAttempts,
      lastAttemptAt: record.lastAttemptAt,
      lastError: record.lastError,
      lockedBy: record.lockedBy,
      lockedAt: record.lockedAt,
    };
  }

  private toArchiveRecord(record: {
    id: string;
    tenantId: string | null;
    eventType: string;
    eventVersion: number;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    metadata: unknown;
    correlationId: string | null;
    causationId: string | null;
    actorId: string | null;
    actorType: string;
    occurredAt: Date;
    publishedAt: Date;
    sequenceNumber: bigint;
  }): DomainEventArchiveRecord {
    return {
      id: record.id,
      tenantId: record.tenantId as OrganizationId | null,
      eventType: record.eventType,
      eventVersion: record.eventVersion,
      aggregateType: record.aggregateType,
      aggregateId: record.aggregateId,
      payload: this.asRecord(record.payload) ?? {},
      metadata: this.asRecord(record.metadata) ?? {},
      correlationId: record.correlationId,
      causationId: record.causationId,
      actorId: record.actorId as UserId | null,
      actorType: record.actorType as DomainEventArchiveRecord['actorType'],
      occurredAt: record.occurredAt,
      publishedAt: record.publishedAt,
      sequenceNumber: record.sequenceNumber,
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