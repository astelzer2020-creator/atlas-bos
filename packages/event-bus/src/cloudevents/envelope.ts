import { err, ok, type Result, ValidationError } from '@atlas/shared-kernel';
import { ulid } from 'ulid';
import { z } from 'zod';

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const CLOUDEVENTS_VERSION = '1.0';

export type EventActorType = 'user' | 'system' | 'api_key' | 'agent' | 'workflow';

export interface EventActor {
  readonly type: EventActorType;
  readonly id: string;
}

export interface EventAggregate {
  readonly type: string;
  readonly id: string;
  readonly version: number;
}

/** Required `data` fields for all Atlas domain events. */
export interface AtlasEventData<TPayload = Record<string, unknown>> {
  readonly eventId: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly occurredAt: string;
  readonly actor: EventActor;
  readonly aggregate: EventAggregate;
  readonly payload: TPayload;
}

/** CloudEvents 1.0 envelope with Atlas extension attributes. */
export interface CloudEvent<TPayload = Record<string, unknown>> {
  readonly specversion: typeof CLOUDEVENTS_VERSION;
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly datacontenttype: 'application/json';
  readonly time: string;
  readonly subject: string;
  readonly atlasorganizationid: string;
  readonly atlasworkspaceid: string;
  readonly atlastraceid: string;
  readonly data: AtlasEventData<TPayload>;
}

const actorSchema = z.object({
  type: z.enum(['user', 'system', 'api_key', 'agent', 'workflow']),
  id: z.string().uuid(),
});

const aggregateSchema = z.object({
  type: z.string().min(1),
  id: z.string().uuid(),
  version: z.number().int().min(1),
});

const atlasEventDataSchema = z.object({
  eventId: z.string().regex(ULID_PATTERN),
  organizationId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  correlationId: z.string().regex(ULID_PATTERN),
  causationId: z.string().regex(ULID_PATTERN),
  occurredAt: z.string().datetime(),
  actor: actorSchema,
  aggregate: aggregateSchema,
  payload: z.record(z.unknown()),
});

const cloudEventSchema = z.object({
  specversion: z.literal(CLOUDEVENTS_VERSION),
  id: z.string().regex(ULID_PATTERN),
  source: z.string().min(1),
  type: z.string().regex(/^[a-z]+\.[a-z_]+\.[a-z_]+\.v\d+$/),
  datacontenttype: z.literal('application/json'),
  time: z.string().datetime(),
  subject: z.string().uuid(),
  atlasorganizationid: z.string().uuid(),
  atlasworkspaceid: z.string().uuid(),
  atlastraceid: z.string().regex(ULID_PATTERN),
  data: atlasEventDataSchema,
});

export interface BuildCloudEventInput<TPayload extends Record<string, unknown>> {
  readonly source: string;
  readonly type: string;
  readonly subject: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly actor: EventActor;
  readonly aggregate: EventAggregate;
  readonly payload: TPayload;
  readonly eventId?: string;
  readonly occurredAt?: string;
}

/** Builds a CloudEvents 1.0 envelope with Atlas extensions. */
export function buildCloudEvent<TPayload extends Record<string, unknown>>(
  input: BuildCloudEventInput<TPayload>,
): CloudEvent<TPayload> {
  const eventId = input.eventId ?? ulid();
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  return {
    specversion: CLOUDEVENTS_VERSION,
    id: eventId,
    source: input.source,
    type: input.type,
    datacontenttype: 'application/json',
    time: occurredAt,
    subject: input.subject,
    atlasorganizationid: input.organizationId,
    atlasworkspaceid: input.workspaceId,
    atlastraceid: input.correlationId,
    data: {
      eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      occurredAt,
      actor: input.actor,
      aggregate: input.aggregate,
      payload: input.payload,
    },
  };
}

/** Parses and validates a CloudEvents envelope. */
export function parseCloudEvent(
  value: unknown,
): Result<CloudEvent, ValidationError> {
  const parsed = cloudEventSchema.safeParse(value);

  if (!parsed.success) {
    return err(
      new ValidationError('Invalid CloudEvent envelope', {
        field: 'cloudEvent',
        details: parsed.error.flatten(),
      }),
    );
  }

  return ok(parsed.data as CloudEvent);
}