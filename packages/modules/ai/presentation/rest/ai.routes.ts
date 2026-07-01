import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AgentDefinitionService } from '../../application/services/agent-definition.service.js';
import type { UpdateAgentDefinitionInput } from '../../application/services/agent-definition.service.js';
import type { AgentRunService } from '../../application/services/agent-run.service.js';

import {
  agentDefinitionParamsSchema,
  agentRunParamsSchema,
  cancelAgentRunBodySchema,
  createAgentDefinitionBodySchema,
  createAgentRunBodySchema,
  getAgentRunQuerySchema,
  listAgentDefinitionsQuerySchema,
  listAgentRunsQuerySchema,
  organizationParamsSchema,
  parseIfMatchHeader,
  updateAgentDefinitionBodySchema,
} from './schemas.js';

export interface AiRouteContext {
  readonly userId: string;
}

export interface AiRoutesDeps {
  readonly definitionService: AgentDefinitionService;
  readonly runService: AgentRunService;
  readonly authenticate: (request: FastifyRequest) => Promise<AiRouteContext | null>;
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
  authenticate: AiRoutesDeps['authenticate'],
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

export async function registerAiRoutes(
  fastify: FastifyInstance,
  deps: AiRoutesDeps,
): Promise<void> {
  fastify.get(
    '/v1/organizations/:organizationId/agent-definitions',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = listAgentDefinitionsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.definitionService.listDefinitions(
        organizationIdResult.value,
        query.data,
      );

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
    '/v1/organizations/:organizationId/agent-definitions',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = organizationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = createAgentDefinitionBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.definitionService.createDefinition(
        organizationIdResult.value,
        body.data,
        userId,
      );

      return sendResult(reply, result, 201);
    },
  );

  fastify.get(
    '/v1/organizations/:organizationId/agent-definitions/:agentDefinitionId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = agentDefinitionParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.definitionService.getDefinition(
        organizationIdResult.value,
        params.data.agentDefinitionId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/agent-definitions/:agentDefinitionId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = agentDefinitionParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updateAgentDefinitionBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const expectedVersion = parseIfMatchHeader(request.headers['if-match']);
      if (expectedVersion === null) {
        return validationError(reply, [
          {
            path: ['If-Match'],
            message: 'If-Match header with a positive integer version is required',
          },
        ]);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const updateInput: UpdateAgentDefinitionInput = {
        expectedVersion,
        ...body.data,
      };

      const result = await deps.definitionService.updateDefinition(
        organizationIdResult.value,
        params.data.agentDefinitionId,
        updateInput,
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/agent-definitions/:agentDefinitionId/publish',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = agentDefinitionParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.definitionService.publishDefinition(
        organizationIdResult.value,
        params.data.agentDefinitionId,
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.get('/v1/organizations/:organizationId/agent-runs', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listAgentRunsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.runService.listRuns(organizationIdResult.value, query.data);

    return reply.status(200).send({
      data: result.data,
      pagination: {
        has_more: result.next_cursor !== null,
        next_cursor: result.next_cursor,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/organizations/:organizationId/agent-runs', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createAgentRunBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.runService.startRun(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get(
    '/v1/organizations/:organizationId/agent-runs/:agentRunId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = agentRunParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = getAgentRunQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.runService.getRun(
        organizationIdResult.value,
        params.data.agentRunId,
        query.data.includeSteps,
      );

      return sendResult(reply, result);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/agent-runs/:agentRunId/cancel',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = agentRunParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = cancelAgentRunBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.runService.cancelRun(
        organizationIdResult.value,
        params.data.agentRunId,
        body.data.reason,
        userId,
      );

      return sendResult(reply, result);
    },
  );
}