import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { NotificationService } from '../../application/services/notification.service.js';

import {
  inboxQuerySchema,
  notificationParamsSchema,
  organizationParamsSchema,
  sendNotificationBodySchema,
  updatePreferencesBodySchema,
} from './schemas.js';

export interface NotificationRouteContext {
  readonly userId: string;
}

export interface NotificationRoutesDeps {
  readonly notificationService: NotificationService;
  readonly authenticate: (
    request: FastifyRequest,
  ) => Promise<NotificationRouteContext | null>;
}

function validationError(
  reply: FastifyReply,
  issues: { path: (string | number)[]; message: string }[],
) {
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
  wrap = false,
): FastifyReply {
  if (!result.ok) {
    const httpError = mapDomainErrorToHttp(result.error);
    return reply.status(httpError.status).send(httpError.toProblemDetails());
  }

  const payload = wrap ? { data: result.value } : result.value;
  return reply.status(successStatus).send(payload);
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticate: NotificationRoutesDeps['authenticate'],
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

export async function registerNotificationRoutes(
  fastify: FastifyInstance,
  deps: NotificationRoutesDeps,
): Promise<void> {
  fastify.get(
    '/v1/organizations/:organizationId/notifications',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = inboxQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const orgIdResult = createOrganizationId(params.data.organizationId);
      if (!orgIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: orgIdResult.error.message },
        ]);
      }

      const inbox = await deps.notificationService.listInbox(orgIdResult.value, userId, {
        limit: query.data.limit,
        ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
        ...(query.data.unread_only !== undefined ? { unread_only: query.data.unread_only } : {}),
      });

      return reply.status(200).send({
        data: inbox.data.map((notification) => ({
          object: 'notification',
          ...notification,
        })),
        pagination: {
          has_more: inbox.has_more,
          next_cursor: inbox.next_cursor,
          prev_cursor: null,
          limit: query.data.limit,
        },
      });
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/notifications',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = sendNotificationBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const orgIdResult = createOrganizationId(params.data.organizationId);
      if (!orgIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: orgIdResult.error.message },
        ]);
      }

      const result = await deps.notificationService.sendNotification(
        orgIdResult.value,
        {
          definition_id: body.data.definition_id,
          category: body.data.category,
          recipient_user_id: body.data.recipient_user_id,
          title: body.data.title,
          idempotency_key: body.data.idempotency_key,
          ...(body.data.body !== undefined ? { body: body.data.body } : {}),
          ...(body.data.action_url !== undefined ? { action_url: body.data.action_url } : {}),
          ...(body.data.entity_type !== undefined ? { entity_type: body.data.entity_type } : {}),
          ...(body.data.entity_id !== undefined ? { entity_id: body.data.entity_id } : {}),
          ...(body.data.payload !== undefined ? { payload: body.data.payload } : {}),
          ...(body.data.locale !== undefined ? { locale: body.data.locale } : {}),
          ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
          ...(body.data.actor_user_id !== undefined
            ? { actor_user_id: body.data.actor_user_id }
            : {}),
        },
        userId,
      );

      return sendResult(reply, result, 201, true);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/notifications/:id/read',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = notificationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const orgIdResult = createOrganizationId(params.data.organizationId);
      if (!orgIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: orgIdResult.error.message },
        ]);
      }

      const result = await deps.notificationService.markAsRead(
        orgIdResult.value,
        params.data.id,
        userId,
      );

      return sendResult(reply, result, 200, true);
    },
  );

  fastify.get(
    '/v1/organizations/:organizationId/notification-preferences',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const orgIdResult = createOrganizationId(params.data.organizationId);
      if (!orgIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: orgIdResult.error.message },
        ]);
      }

      const preferences = await deps.notificationService.getPreferences(
        orgIdResult.value,
        userId,
      );

      return reply.status(200).send({
        data: preferences.map((preference) => ({
          object: 'notification_preference',
          ...preference,
        })),
      });
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/notification-preferences',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updatePreferencesBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const orgIdResult = createOrganizationId(params.data.organizationId);
      if (!orgIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: orgIdResult.error.message },
        ]);
      }

      const preferences = await deps.notificationService.updatePreferences(
        orgIdResult.value,
        userId,
        {
          preferences: body.data.preferences.map((preference) => ({
            definition_id: preference.definition_id,
            channel_type: preference.channel_type,
            enabled: preference.enabled,
            ...(preference.digest_mode !== undefined
              ? { digest_mode: preference.digest_mode }
              : {}),
          })),
        },
      );

      return reply.status(200).send({
        data: preferences.map((preference) => ({
          object: 'notification_preference',
          ...preference,
        })),
      });
    },
  );
}