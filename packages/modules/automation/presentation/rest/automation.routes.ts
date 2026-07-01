import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AutomationExecutorService } from '../../application/services/automation-executor.service.js';
import type { AutomationRuleService } from '../../application/services/automation-rule.service.js';
import type { UpdateAutomationRuleInput } from '../../application/services/automation-rule.service.js';

import {
  automationRuleParamsSchema,
  createAutomationRuleBodySchema,
  dryRunAutomationRuleBodySchema,
  listAutomationRulesQuerySchema,
  organizationParamsSchema,
  parseIfMatchHeader,
  updateAutomationRuleBodySchema,
} from './schemas.js';

export interface AutomationRouteContext {
  readonly userId: string;
}

export interface AutomationRoutesDeps {
  readonly ruleService: AutomationRuleService;
  readonly executorService: AutomationExecutorService;
  readonly authenticate: (request: FastifyRequest) => Promise<AutomationRouteContext | null>;
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
  authenticate: AutomationRoutesDeps['authenticate'],
): Promise<UserId | null> {
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

export async function registerAutomationRoutes(
  fastify: FastifyInstance,
  deps: AutomationRoutesDeps,
): Promise<void> {
  fastify.get(
    '/v1/organizations/:organizationId/automation-rules',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = listAutomationRulesQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.ruleService.list(organizationIdResult.value, query.data);

      return reply.status(200).send({
        data: result.data,
        pagination: {
          has_more: result.next_cursor !== null,
          next_cursor: result.next_cursor,
          limit: query.data.limit,
        },
      });
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/automation-rules',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = createAutomationRuleBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.ruleService.create(
        organizationIdResult.value,
        body.data,
        userId,
      );

      return sendResult(reply, result, 201);
    },
  );

  fastify.get(
    '/v1/organizations/:organizationId/automation-rules/:automationRuleId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = automationRuleParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.ruleService.get(
        organizationIdResult.value,
        params.data.automationRuleId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/automation-rules/:automationRuleId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = automationRuleParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updateAutomationRuleBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const expectedVersion = parseIfMatchHeader(request.headers['if-match']);
      if (expectedVersion === null) {
        return validationError(reply, [
          { path: ['If-Match'], message: 'If-Match header with a positive integer version is required' },
        ]);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const updateInput: UpdateAutomationRuleInput = {
        expectedVersion,
        ...body.data,
      };

      const result = await deps.ruleService.update(
        organizationIdResult.value,
        params.data.automationRuleId,
        updateInput,
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.delete(
    '/v1/organizations/:organizationId/automation-rules/:automationRuleId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = automationRuleParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.ruleService.softDelete(
        organizationIdResult.value,
        params.data.automationRuleId,
        userId,
      );

      if (!result.ok) {
        const httpError = mapDomainErrorToHttp(result.error);
        return reply.status(httpError.status).send(httpError.toProblemDetails());
      }

      return reply.status(204).send();
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/automation-rules/:automationRuleId/enable',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = automationRuleParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.ruleService.enable(
        organizationIdResult.value,
        params.data.automationRuleId,
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/automation-rules/:automationRuleId/disable',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = automationRuleParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.ruleService.disable(
        organizationIdResult.value,
        params.data.automationRuleId,
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/automation-rules/:automationRuleId/dry-run',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = automationRuleParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = dryRunAutomationRuleBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.executorService.dryRun(
        organizationIdResult.value,
        params.data.automationRuleId,
        body.data.eventPayload,
      );

      if (!result.ok) {
        return sendResult(reply, result);
      }

      return reply.status(200).send({
        matched: result.value.matched,
        actionsPlanned: result.value.actions_planned,
        warnings: result.value.warnings,
      });
    },
  );
}