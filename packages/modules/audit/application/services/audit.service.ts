import {
  err,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import type {
  AppendAuditLogData,
  AuditAction,
  AuditActorType,
  AuditLogEntryRecord,
  AuditLogRepository,
  QueryAuditLogFilter,
} from '../../domain/repositories/audit-log.repository.js';

export interface RecordAuditEntryInput {
  readonly tenantId: OrganizationId;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly actorId?: UserId;
  readonly actorType?: AuditActorType;
  readonly changes?: Record<string, unknown>;
  readonly previousState?: Record<string, unknown>;
  readonly newState?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface QueryAuditLogInput {
  readonly tenantId: OrganizationId;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: UserId;
  readonly action?: AuditAction;
  readonly occurredFrom?: Date;
  readonly occurredTo?: Date;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AuditLogEntryDto {
  readonly id: string;
  readonly organization_id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly action: AuditAction;
  readonly actor_id: string | null;
  readonly actor_type: AuditActorType;
  readonly changes: Record<string, unknown> | null;
  readonly previous_state: Record<string, unknown> | null;
  readonly new_state: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly correlation_id: string | null;
  readonly request_id: string | null;
  readonly ip_address: string | null;
  readonly user_agent: string | null;
  readonly occurred_at: string;
}

export interface AuditServiceDeps {
  readonly auditLogRepository: AuditLogRepository;
}

const DEFAULT_QUERY_LIMIT = 50;
const MAX_QUERY_LIMIT = 100;

export class AuditService {
  constructor(private readonly deps: AuditServiceDeps) {}

  /**
   * Immutable append — audit entries are never updated or deleted.
   */
  async recordAuditEntry(
    input: RecordAuditEntryInput,
    tx?: Parameters<AuditLogRepository['append']>[1],
  ): Promise<Result<AuditLogEntryDto, ValidationError>> {
    const validation = this.validateRecordInput(input);
    if (!validation.ok) {
      return validation;
    }

    const appendData: AppendAuditLogData = {
      tenantId: input.tenantId,
      entityType: input.entityType.trim(),
      entityId: input.entityId,
      action: input.action,
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      ...(input.actorType !== undefined ? { actorType: input.actorType } : {}),
      ...(input.changes !== undefined ? { changes: input.changes } : {}),
      ...(input.previousState !== undefined ? { previousState: input.previousState } : {}),
      ...(input.newState !== undefined ? { newState: input.newState } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    };

    const record = await this.deps.auditLogRepository.append(appendData, tx);
    return ok(this.toDto(record));
  }

  async queryAuditLog(
    input: QueryAuditLogInput,
  ): Promise<Result<{ entries: AuditLogEntryDto[]; next_cursor: string | null }, ValidationError>> {
    const limit = Math.min(input.limit ?? DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);

    if (input.occurredFrom !== undefined && input.occurredTo !== undefined) {
      if (input.occurredFrom > input.occurredTo) {
        return err(
          new ValidationError('occurredFrom must be before or equal to occurredTo', {
            details: { occurredFrom: input.occurredFrom.toISOString(), occurredTo: input.occurredTo.toISOString() },
          }),
        );
      }
    }

    const filter: QueryAuditLogFilter = {
      tenantId: input.tenantId,
      limit,
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.occurredFrom !== undefined ? { occurredFrom: input.occurredFrom } : {}),
      ...(input.occurredTo !== undefined ? { occurredTo: input.occurredTo } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    };

    const records = await this.deps.auditLogRepository.query(filter);

    return ok({
      entries: records.map((record) => this.toDto(record)),
      next_cursor: records.length === limit ? (records.at(-1)?.id ?? null) : null,
    });
  }

  private validateRecordInput(input: RecordAuditEntryInput): Result<void, ValidationError> {
    if (input.entityType.trim().length === 0) {
      return err(new ValidationError('entityType is required'));
    }

    if (!UUID_REGEX.test(input.entityId)) {
      return err(new ValidationError('entityId must be a valid UUID', { details: { entityId: input.entityId } }));
    }

    return ok(undefined);
  }

  private toDto(record: AuditLogEntryRecord): AuditLogEntryDto {
    return {
      id: record.id,
      organization_id: record.tenantId ?? '',
      entity_type: record.entityType,
      entity_id: record.entityId,
      action: record.action,
      actor_id: record.actorId,
      actor_type: record.actorType,
      changes: record.changes,
      previous_state: record.previousState,
      new_state: record.newState,
      metadata: record.metadata,
      correlation_id: record.correlationId,
      request_id: record.requestId,
      ip_address: record.ipAddress,
      user_agent: record.userAgent,
      occurred_at: record.occurredAt.toISOString(),
    };
  }
}