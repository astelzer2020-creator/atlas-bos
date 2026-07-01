import type { OrganizationId, UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AuditService } from '../../application/services/audit.service.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface AuditRecorderContext {
  readonly tenantId: OrganizationId;
  readonly actorId?: UserId;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface CreateAuditRecorderOptions {
  readonly auditService: AuditService;
  readonly resolveContext: (request: FastifyRequest) => AuditRecorderContext | null;
}

export interface AuditMiddlewareOptions extends CreateAuditRecorderOptions {
  readonly shouldAudit?: (request: FastifyRequest) => boolean;
  readonly resolveEntity?: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => { entityType: string; entityId: string } | null;
}

/**
 * Returns a scoped helper other modules can call to record semantic audit entries.
 */
export function createAuditRecorder(options: CreateAuditRecorderOptions) {
  return {
    record: async (
      request: FastifyRequest,
      entry: {
        readonly entityType: string;
        readonly entityId: string;
        readonly action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'ACCESS' | 'EXPORT' | 'PERMISSION_CHANGE';
        readonly changes?: Record<string, unknown>;
        readonly previousState?: Record<string, unknown>;
        readonly newState?: Record<string, unknown>;
        readonly metadata?: Record<string, unknown>;
      },
    ) => {
      const context = options.resolveContext(request);
      if (context === null) {
        return;
      }

      await options.auditService.recordAuditEntry({
        tenantId: context.tenantId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        ...(context.actorId !== undefined ? { actorId: context.actorId } : {}),
        ...(context.correlationId !== undefined ? { correlationId: context.correlationId } : {}),
        ...(context.requestId !== undefined ? { requestId: context.requestId } : {}),
        ...(context.ipAddress !== undefined ? { ipAddress: context.ipAddress } : {}),
        ...(context.userAgent !== undefined ? { userAgent: context.userAgent } : {}),
        ...(entry.changes !== undefined ? { changes: entry.changes } : {}),
        ...(entry.previousState !== undefined ? { previousState: entry.previousState } : {}),
        ...(entry.newState !== undefined ? { newState: entry.newState } : {}),
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      });
    },
  };
}

/**
 * Registers an onResponse hook that records ACCESS audit entries for successful mutating routes.
 */
export function registerAuditMiddleware(fastify: FastifyInstance, options: AuditMiddlewareOptions): void {
  const recorder = createAuditRecorder(options);

  fastify.addHook('onResponse', async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) {
      return;
    }

    if (options.shouldAudit !== undefined && !options.shouldAudit(request)) {
      return;
    }

    if (reply.statusCode < 200 || reply.statusCode >= 300) {
      return;
    }

    const entity = options.resolveEntity?.(request, reply);
    if (entity === null || entity === undefined) {
      return;
    }

    await recorder.record(request, {
      entityType: entity.entityType,
      entityId: entity.entityId,
      action: 'ACCESS',
      metadata: {
        method: request.method,
        route: request.routeOptions.url ?? request.url,
        status_code: reply.statusCode,
      },
    });
  });
}