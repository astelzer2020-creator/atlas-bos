import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AuditService } from '../../application/services/audit.service.js';

import {
  auditLogQuerySchema,
  entityAuditParamsSchema,
  organizationAuditParamsSchema,
} from './schemas.js';

export interface AuditRouteContext {
  readonly userId: string;
}

export interface AuditRoutesDeps {
  readonly auditService: AuditService;
  readonly authenticate: (request: FastifyRequest) => Promise<AuditRouteContext | null>;
}

function validationError(reply: FastifyReply, issues: { path: (string | number)[]; message: string }[]) {
  return reply.status(422).send({
    type: 'https://api.atlas.example.com/errors/validation-failed',
    title: 'Validation Failed',
    status: 422,
    detail: 'Request validation failed',
    errors: issues.map((issue) => ({
      field: issue.path.join('.'),
      code: 'validation_failed',
      message: issue.message,
    })),
  });
}

function sendResult<T>(
  reply: FastifyReply,
  result: { ok: true; value: T } | { ok: false; error: unknown },
  successStatus = 200,
): FastifyReply {
  if (!result.ok) {
    const httpError = mapDomainErrorToHttp(result.error);
    return reply.status(httpError.status).send(httpError.toProblemDetails());
  }

  return reply.status(successStatus).send(result.value);
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticate: AuditRoutesDeps['authenticate'],
) {
  const context = await authenticate(request);

  if (context === null) {
    reply.status(401).send({
      type: 'https://api.atlas.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication required',
    });
    return null;
  }

  const userIdResult = parseUserId(context.userId);
  if (!userIdResult.ok) {
    reply.status(401).send({
      type: 'https://api.atlas.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid user context',
    });
    return null;
  }

  return userIdResult.value;
}

export async function registerAuditRoutes(
  fastify: FastifyInstance,
  deps: AuditRoutesDeps,
): Promise<void> {
  fastify.get('/v1/organizations/:organizationId/audit-log', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationAuditParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = auditLogQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: 'Must be a valid UUID' }]);
    }

    let actorId: UserId | undefined;
    if (query.data.actorId !== undefined) {
      const actorIdResult = parseUserId(query.data.actorId);
      if (!actorIdResult.ok) {
        return validationError(reply, [{ path: ['actor_id'], message: 'Must be a valid UUID' }]);
      }
      actorId = actorIdResult.value;
    }

    const result = await deps.auditService.queryAuditLog({
      tenantId: organizationIdResult.value,
      limit: query.data.limit,
      ...(query.data.entityType !== undefined ? { entityType: query.data.entityType } : {}),
      ...(query.data.entityId !== undefined ? { entityId: query.data.entityId } : {}),
      ...(actorId !== undefined ? { actorId } : {}),
      ...(query.data.action !== undefined ? { action: query.data.action } : {}),
      ...(query.data.occurredFrom !== undefined ? { occurredFrom: query.data.occurredFrom } : {}),
      ...(query.data.occurredTo !== undefined ? { occurredTo: query.data.occurredTo } : {}),
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    if (!result.ok) {
      return sendResult(reply, result);
    }

    return reply.status(200).send({
      data: result.value.entries.map((entry) => ({ object: 'audit_log_entry', ...entry })),
      pagination: {
        has_more: result.value.next_cursor !== null,
        next_cursor: result.value.next_cursor,
        prev_cursor: null,
      },
    });
  });

  fastify.get('/v1/organizations/:organizationId/audit-log/:entityType/:entityId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = entityAuditParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = auditLogQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: 'Must be a valid UUID' }]);
    }

    let actorId: UserId | undefined;
    if (query.data.actorId !== undefined) {
      const actorIdResult = parseUserId(query.data.actorId);
      if (!actorIdResult.ok) {
        return validationError(reply, [{ path: ['actor_id'], message: 'Must be a valid UUID' }]);
      }
      actorId = actorIdResult.value;
    }

    const result = await deps.auditService.queryAuditLog({
      tenantId: organizationIdResult.value,
      entityType: params.data.entityType,
      entityId: params.data.entityId,
      limit: query.data.limit,
      ...(actorId !== undefined ? { actorId } : {}),
      ...(query.data.action !== undefined ? { action: query.data.action } : {}),
      ...(query.data.occurredFrom !== undefined ? { occurredFrom: query.data.occurredFrom } : {}),
      ...(query.data.occurredTo !== undefined ? { occurredTo: query.data.occurredTo } : {}),
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    if (!result.ok) {
      return sendResult(reply, result);
    }

    return reply.status(200).send({
      data: result.value.entries.map((entry) => ({ object: 'audit_log_entry', ...entry })),
      pagination: {
        has_more: result.value.next_cursor !== null,
        next_cursor: result.value.next_cursor,
        prev_cursor: null,
      },
    });
  });
}