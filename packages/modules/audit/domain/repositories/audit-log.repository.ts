import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'ACCESS'
  | 'EXPORT'
  | 'PERMISSION_CHANGE';

export type AuditActorType = 'user' | 'system' | 'api_key' | 'agent' | 'workflow' | 'platform_admin';

export interface AuditLogEntryRecord {
  readonly id: string;
  readonly tenantId: OrganizationId | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly actorId: UserId | null;
  readonly actorType: AuditActorType;
  readonly changes: Record<string, unknown> | null;
  readonly previousState: Record<string, unknown> | null;
  readonly newState: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly occurredAt: Date;
}

export interface AppendAuditLogData {
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
  readonly occurredAt?: Date;
}

export interface QueryAuditLogFilter {
  readonly tenantId: OrganizationId;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: UserId;
  readonly action?: AuditAction;
  readonly occurredFrom?: Date;
  readonly occurredTo?: Date;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AuditLogRepository {
  append(data: AppendAuditLogData, tx?: Prisma.TransactionClient): Promise<AuditLogEntryRecord>;
  query(filter: QueryAuditLogFilter): Promise<AuditLogEntryRecord[]>;
}