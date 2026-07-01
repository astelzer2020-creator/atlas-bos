import { buildCloudEvent, type CloudEvent } from '@atlas/event-bus';
import type { OutboxEventDto } from '@atlas/module-audit';
import { ulid } from 'ulid';

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002';

function asUlid(value: string | null | undefined): string {
  if (value !== null && value !== undefined && ULID_PATTERN.test(value)) {
    return value;
  }
  return ulid();
}

function resolveWorkspaceId(metadata: Record<string, unknown>): string {
  const fromMetadata = metadata.workspace_id ?? metadata.workspaceId;
  if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
    return fromMetadata;
  }
  return DEFAULT_WORKSPACE_ID;
}

/** Converts an audit outbox row into a CloudEvents envelope for Kafka publishing. */
export function outboxEventToCloudEvent(event: OutboxEventDto): CloudEvent | null {
  if (event.organization_id === null) {
    return null;
  }

  const correlationId = asUlid(event.correlation_id);
  const causationId = asUlid(event.causation_id ?? event.correlation_id);

  return buildCloudEvent({
    source: `atlas://${event.aggregate_type}`,
    type: event.event_type,
    subject: event.aggregate_id,
    organizationId: event.organization_id,
    workspaceId: resolveWorkspaceId(event.metadata),
    correlationId,
    causationId,
    actor: {
      type: 'system',
      id: SYSTEM_ACTOR_ID,
    },
    aggregate: {
      type: event.aggregate_type,
      id: event.aggregate_id,
      version: event.event_version,
    },
    payload: event.payload,
    eventId: asUlid(event.id),
    occurredAt: event.created_at,
  });
}
