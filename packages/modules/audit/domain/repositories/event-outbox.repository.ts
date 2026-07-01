import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { AuditActorType } from './audit-log.repository.js';

export interface EventOutboxRecord {
  readonly id: string;
  readonly tenantId: OrganizationId | null;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly priority: number;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
  readonly publishAttempts: number;
  readonly lastAttemptAt: Date | null;
  readonly lastError: string | null;
  readonly lockedBy: string | null;
  readonly lockedAt: Date | null;
}

export interface AppendOutboxEventData {
  readonly tenantId: OrganizationId;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion?: number;
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly priority?: number;
}

export interface AppendDomainEventData {
  readonly tenantId: OrganizationId;
  readonly eventType: string;
  readonly eventVersion?: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly actorId?: UserId;
  readonly actorType?: AuditActorType;
  readonly occurredAt?: Date;
}

export interface DomainEventArchiveRecord {
  readonly id: string;
  readonly tenantId: OrganizationId | null;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly actorId: UserId | null;
  readonly actorType: AuditActorType;
  readonly occurredAt: Date;
  readonly publishedAt: Date;
  readonly sequenceNumber: bigint;
}

export interface MoveToDeadLetterData {
  readonly tenantId: OrganizationId | null;
  readonly sourceId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly failureReason: string;
  readonly failureCount: number;
  readonly firstFailedAt: Date;
}

export interface PollPendingOptions {
  readonly limit: number;
  readonly lockedBy: string;
  readonly lockStaleAfterMs?: number;
}

export interface EventOutboxRepository {
  append(data: AppendOutboxEventData, tx?: Prisma.TransactionClient): Promise<EventOutboxRecord>;
  appendDomainEvent(data: AppendDomainEventData, tx?: Prisma.TransactionClient): Promise<DomainEventArchiveRecord>;
  getNextSequenceNumber(
    tenantId: OrganizationId,
    aggregateType: string,
    aggregateId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<bigint>;
  pollPending(options: PollPendingOptions): Promise<EventOutboxRecord[]>;
  markPublished(id: string, tx?: Prisma.TransactionClient): Promise<void>;
  moveToDeadLetter(outboxId: string, data: MoveToDeadLetterData, tx?: Prisma.TransactionClient): Promise<void>;
  findById(id: string): Promise<EventOutboxRecord | null>;
}