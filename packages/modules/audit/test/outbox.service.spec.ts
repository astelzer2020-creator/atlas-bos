import { ValidationError, type OrganizationId } from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { OutboxService } from '../application/services/outbox.service.js';
import type { EventOutboxRecord, EventOutboxRepository } from '../domain/repositories/event-outbox.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const OUTBOX_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const AGGREGATE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createOutboxRecord(overrides: Partial<EventOutboxRecord> = {}): EventOutboxRecord {
  return {
    id: OUTBOX_ID,
    tenantId: ORG_ID,
    aggregateType: 'contact',
    aggregateId: AGGREGATE_ID,
    eventType: 'customer.contact.created.v1',
    eventVersion: 1,
    payload: { id: AGGREGATE_ID },
    metadata: {},
    correlationId: 'corr-1',
    causationId: null,
    priority: 3,
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
    publishedAt: null,
    publishAttempts: 2,
    lastAttemptAt: new Date('2026-06-30T12:05:00.000Z'),
    lastError: 'broker unavailable',
    lockedBy: 'worker-1',
    lockedAt: new Date('2026-06-30T12:05:00.000Z'),
    ...overrides,
  };
}

function createOutboxService(repository: Partial<EventOutboxRepository> = {}) {
  const eventOutboxRepository: EventOutboxRepository = {
    append: vi.fn().mockResolvedValue(createOutboxRecord()),
    appendDomainEvent: vi.fn(),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1n),
    pollPending: vi.fn().mockResolvedValue([createOutboxRecord()]),
    markPublished: vi.fn().mockResolvedValue(undefined),
    moveToDeadLetter: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(createOutboxRecord()),
    ...repository,
  };

  return {
    service: new OutboxService({ eventOutboxRepository }),
    eventOutboxRepository,
  };
}

describe('OutboxService', () => {
  it('appendToOutbox validates and delegates to repository', async () => {
    const { service, eventOutboxRepository } = createOutboxService();

    const result = await service.appendToOutbox({
      tenantId: ORG_ID,
      aggregateType: 'contact',
      aggregateId: AGGREGATE_ID,
      eventType: 'customer.contact.created.v1',
      payload: { id: AGGREGATE_ID },
      priority: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event_type).toBe('customer.contact.created.v1');
      expect(result.value.priority).toBe(3);
    }

    expect(eventOutboxRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ORG_ID,
        aggregateType: 'contact',
        aggregateId: AGGREGATE_ID,
        eventType: 'customer.contact.created.v1',
        priority: 2,
      }),
      undefined,
    );
  });

  it('appendToOutbox rejects invalid priority', async () => {
    const { service } = createOutboxService();

    const result = await service.appendToOutbox({
      tenantId: ORG_ID,
      aggregateType: 'contact',
      aggregateId: AGGREGATE_ID,
      eventType: 'customer.contact.created.v1',
      payload: {},
      priority: 9,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('pollPendingEvents requires lockedBy', async () => {
    const { service } = createOutboxService();

    const result = await service.pollPendingEvents({ lockedBy: '   ' });

    expect(result.ok).toBe(false);
  });

  it('pollPendingEvents returns pending events', async () => {
    const { service, eventOutboxRepository } = createOutboxService();

    const result = await service.pollPendingEvents({
      lockedBy: 'relay-worker-1',
      limit: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.id).toBe(OUTBOX_ID);
    }

    expect(eventOutboxRepository.pollPending).toHaveBeenCalledWith({
      limit: 10,
      lockedBy: 'relay-worker-1',
    });
  });

  it('markPublished delegates to repository', async () => {
    const { service, eventOutboxRepository } = createOutboxService();

    const result = await service.markPublished(OUTBOX_ID);

    expect(result.ok).toBe(true);
    expect(eventOutboxRepository.markPublished).toHaveBeenCalledWith(OUTBOX_ID, undefined);
  });

  it('moveToDeadLetter builds dead-letter payload from outbox record', async () => {
    const { service, eventOutboxRepository } = createOutboxService();

    const result = await service.moveToDeadLetter(OUTBOX_ID, 'exhausted retries');

    expect(result.ok).toBe(true);
    expect(eventOutboxRepository.moveToDeadLetter).toHaveBeenCalledWith(
      OUTBOX_ID,
      expect.objectContaining({
        sourceId: OUTBOX_ID,
        eventType: 'customer.contact.created.v1',
        failureReason: 'exhausted retries',
        failureCount: 3,
      }),
      undefined,
    );
  });
});