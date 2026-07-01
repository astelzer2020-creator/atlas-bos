import { err, ok, ValidationError, type OrganizationId, type Result } from '@atlas/shared-kernel';

import type {
  AppendOutboxEventData,
  EventOutboxRecord,
  EventOutboxRepository,
  MoveToDeadLetterData,
} from '../../domain/repositories/event-outbox.repository.js';

export interface AppendToOutboxInput {
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

export interface PollPendingEventsOptions {
  readonly limit?: number;
  readonly lockedBy: string;
  readonly lockStaleAfterMs?: number;
}

export interface OutboxEventDto {
  readonly id: string;
  readonly organization_id: string | null;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly correlation_id: string | null;
  readonly causation_id: string | null;
  readonly priority: number;
  readonly created_at: string;
  readonly publish_attempts: number;
}

export interface OutboxServiceDeps {
  readonly eventOutboxRepository: EventOutboxRepository;
}

const DEFAULT_POLL_LIMIT = 100;
const MAX_POLL_LIMIT = 1000;

export class OutboxService {
  constructor(private readonly deps: OutboxServiceDeps) {}

  /**
   * Appends an outbox event. Call within the same database transaction as the business mutation.
   */
  async appendToOutbox(
    input: AppendToOutboxInput,
    tx?: Parameters<EventOutboxRepository['append']>[1],
  ): Promise<Result<OutboxEventDto, ValidationError>> {
    const validation = this.validateAppendInput(input);
    if (!validation.ok) {
      return validation;
    }

    const appendData: AppendOutboxEventData = {
      tenantId: input.tenantId,
      aggregateType: input.aggregateType.trim(),
      aggregateId: input.aggregateId,
      eventType: input.eventType.trim(),
      payload: input.payload,
      ...(input.eventVersion !== undefined ? { eventVersion: input.eventVersion } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    };

    const record = await this.deps.eventOutboxRepository.append(appendData, tx);
    return ok(this.toDto(record));
  }

  async pollPendingEvents(
    options: PollPendingEventsOptions,
  ): Promise<Result<OutboxEventDto[], ValidationError>> {
    if (options.lockedBy.trim().length === 0) {
      return err(new ValidationError('lockedBy is required for outbox polling'));
    }

    const limit = Math.min(options.limit ?? DEFAULT_POLL_LIMIT, MAX_POLL_LIMIT);

    const records = await this.deps.eventOutboxRepository.pollPending({
      limit,
      lockedBy: options.lockedBy,
      ...(options.lockStaleAfterMs !== undefined ? { lockStaleAfterMs: options.lockStaleAfterMs } : {}),
    });

    return ok(records.map((record) => this.toDto(record)));
  }

  async markPublished(
    outboxId: string,
    tx?: Parameters<EventOutboxRepository['markPublished']>[1],
  ): Promise<Result<void, ValidationError>> {
    if (outboxId.trim().length === 0) {
      return err(new ValidationError('outboxId is required'));
    }

    await this.deps.eventOutboxRepository.markPublished(outboxId, tx);
    return ok(undefined);
  }

  async moveToDeadLetter(
    outboxId: string,
    failureReason: string,
    tx?: Parameters<EventOutboxRepository['moveToDeadLetter']>[2],
  ): Promise<Result<void, ValidationError>> {
    if (outboxId.trim().length === 0) {
      return err(new ValidationError('outboxId is required'));
    }

    if (failureReason.trim().length === 0) {
      return err(new ValidationError('failureReason is required'));
    }

    const record = await this.deps.eventOutboxRepository.findById(outboxId);
    if (record === null) {
      return err(new ValidationError('Outbox event not found', { details: { outboxId } }));
    }

    const deadLetterData: MoveToDeadLetterData = {
      tenantId: record.tenantId,
      sourceId: record.id,
      eventType: record.eventType,
      payload: record.payload,
      metadata: record.metadata,
      failureReason,
      failureCount: record.publishAttempts + 1,
      firstFailedAt: record.lastAttemptAt ?? record.createdAt,
    };

    await this.deps.eventOutboxRepository.moveToDeadLetter(outboxId, deadLetterData, tx);
    return ok(undefined);
  }

  private validateAppendInput(input: AppendToOutboxInput): Result<void, ValidationError> {
    if (input.aggregateType.trim().length === 0) {
      return err(new ValidationError('aggregateType is required'));
    }

    if (input.eventType.trim().length === 0) {
      return err(new ValidationError('eventType is required'));
    }

    if (input.priority !== undefined && (input.priority < 1 || input.priority > 5)) {
      return err(new ValidationError('priority must be between 1 and 5', { details: { priority: input.priority } }));
    }

    return ok(undefined);
  }

  private toDto(record: EventOutboxRecord): OutboxEventDto {
    return {
      id: record.id,
      organization_id: record.tenantId,
      aggregate_type: record.aggregateType,
      aggregate_id: record.aggregateId,
      event_type: record.eventType,
      event_version: record.eventVersion,
      payload: record.payload,
      metadata: record.metadata,
      correlation_id: record.correlationId,
      causation_id: record.causationId,
      priority: record.priority,
      created_at: record.createdAt.toISOString(),
      publish_attempts: record.publishAttempts,
    };
  }
}