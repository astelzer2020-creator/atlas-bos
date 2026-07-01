import {
  err,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type { AuditActorType } from '../../domain/repositories/audit-log.repository.js';
import type {
  AppendDomainEventData,
  AppendOutboxEventData,
  DomainEventArchiveRecord,
  EventOutboxRepository,
} from '../../domain/repositories/event-outbox.repository.js';

export interface PublishDomainEventInput {
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
  readonly priority?: number;
}

export interface PublishedDomainEventDto {
  readonly outbox_id: string;
  readonly archive_id: string;
  readonly organization_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly sequence_number: string;
  readonly occurred_at: string;
}

export interface DomainEventServiceDeps {
  readonly eventOutboxRepository: EventOutboxRepository;
}

export class DomainEventService {
  constructor(private readonly deps: DomainEventServiceDeps) {}

  /**
   * Atomically writes to the transactional outbox and the domain_events archive.
   * Intended to be called within the same transaction as the originating business mutation.
   */
  async publishEvent(
    input: PublishDomainEventInput,
    tx?: Parameters<EventOutboxRepository['append']>[1],
  ): Promise<Result<PublishedDomainEventDto, ValidationError>> {
    const validation = this.validateInput(input);
    if (!validation.ok) {
      return validation;
    }

    const outboxData: AppendOutboxEventData = {
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

    const archiveData: AppendDomainEventData = {
      tenantId: input.tenantId,
      eventType: input.eventType.trim(),
      aggregateType: input.aggregateType.trim(),
      aggregateId: input.aggregateId,
      payload: input.payload,
      ...(input.eventVersion !== undefined ? { eventVersion: input.eventVersion } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      ...(input.actorType !== undefined ? { actorType: input.actorType } : {}),
    };

    const outboxRecord = await this.deps.eventOutboxRepository.append(outboxData, tx);
    const archiveRecord = await this.deps.eventOutboxRepository.appendDomainEvent(archiveData, tx);

    return ok(this.toDto(input.tenantId, outboxRecord.id, archiveRecord));
  }

  private validateInput(input: PublishDomainEventInput): Result<void, ValidationError> {
    if (input.eventType.trim().length === 0) {
      return err(new ValidationError('eventType is required'));
    }

    if (input.aggregateType.trim().length === 0) {
      return err(new ValidationError('aggregateType is required'));
    }

    if (input.priority !== undefined && (input.priority < 1 || input.priority > 5)) {
      return err(new ValidationError('priority must be between 1 and 5', { details: { priority: input.priority } }));
    }

    return ok(undefined);
  }

  private toDto(
    tenantId: OrganizationId,
    outboxId: string,
    archive: DomainEventArchiveRecord,
  ): PublishedDomainEventDto {
    return {
      outbox_id: outboxId,
      archive_id: archive.id,
      organization_id: tenantId,
      event_type: archive.eventType,
      event_version: archive.eventVersion,
      aggregate_type: archive.aggregateType,
      aggregate_id: archive.aggregateId,
      sequence_number: archive.sequenceNumber.toString(),
      occurred_at: archive.occurredAt.toISOString(),
    };
  }
}