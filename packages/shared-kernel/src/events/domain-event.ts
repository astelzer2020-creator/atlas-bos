/** Correlation and causation metadata attached to domain events. */
export interface EventMetadata {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
}

/** Base contract for in-process domain events raised by aggregates. */
export interface DomainEvent<TPayload = unknown> {
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
}