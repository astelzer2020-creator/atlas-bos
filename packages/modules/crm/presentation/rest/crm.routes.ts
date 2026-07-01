import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AccountService } from '../../application/services/account.service.js';
import type { ContactService } from '../../application/services/contact.service.js';
import type { DealService } from '../../application/services/deal.service.js';
import type { PipelineStageService } from '../../application/services/pipeline-stage.service.js';

import {
  accountParamsSchema,
  contactParamsSchema,
  createAccountBodySchema,
  createContactBodySchema,
  createDealBodySchema,
  createPipelineStageBodySchema,
  dealParamsSchema,
  listAccountsQuerySchema,
  listContactsQuerySchema,
  listDealsQuerySchema,
  listPipelineStagesQuerySchema,
  organizationParamsSchema,
  pipelineStageParamsSchema,
  updateAccountBodySchema,
  updateContactBodySchema,
  updateDealBodySchema,
  updatePipelineStageBodySchema,
} from './schemas.js';

export interface CrmRouteContext {
  readonly userId: string;
}

export interface CrmRoutesDeps {
  readonly accountService: AccountService;
  readonly contactService: ContactService;
  readonly dealService: DealService;
  readonly pipelineStageService: PipelineStageService;
  readonly authenticate: (request: FastifyRequest) => Promise<CrmRouteContext | null>;
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

function sendCursorPage<T extends { id: string }>(
  reply: FastifyReply,
  result: { data: readonly T[]; nextCursor: string | null },
  limit: number,
): FastifyReply {
  return reply.status(200).send({
    data: result.data,
    pagination: {
      hasMore: result.nextCursor !== null,
      nextCursor: result.nextCursor,
      limit,
    },
  });
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticate: CrmRoutesDeps['authenticate'],
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

export async function registerCrmRoutes(
  fastify: FastifyInstance,
  deps: CrmRoutesDeps,
): Promise<void> {
  fastify.get('/v1/organizations/:organizationId/accounts', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listAccountsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.accountService.listAccounts(
      organizationIdResult.value,
      query.data,
    );

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/accounts', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createAccountBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.accountService.createAccount(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get('/v1/organizations/:organizationId/accounts/:accountId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = accountParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.accountService.getAccount(
      organizationIdResult.value,
      params.data.accountId,
    );

    return sendResult(reply, result);
  });

  fastify.patch('/v1/organizations/:organizationId/accounts/:accountId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = accountParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = updateAccountBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.accountService.updateAccount(
      organizationIdResult.value,
      params.data.accountId,
      body.data,
      userId,
    );

    return sendResult(reply, result);
  });

  fastify.get('/v1/organizations/:organizationId/contacts', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listContactsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.contactService.listContacts(
      organizationIdResult.value,
      query.data,
    );

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/contacts', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createContactBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.contactService.createContact(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get('/v1/organizations/:organizationId/contacts/:contactId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = contactParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.contactService.getContact(
      organizationIdResult.value,
      params.data.contactId,
    );

    return sendResult(reply, result);
  });

  fastify.patch('/v1/organizations/:organizationId/contacts/:contactId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = contactParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = updateContactBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.contactService.updateContact(
      organizationIdResult.value,
      params.data.contactId,
      body.data,
      userId,
    );

    return sendResult(reply, result);
  });

  fastify.get('/v1/organizations/:organizationId/deals', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listDealsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.dealService.listDeals(organizationIdResult.value, query.data);

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/deals', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createDealBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.dealService.createDeal(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get('/v1/organizations/:organizationId/deals/:dealId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = dealParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.dealService.getDeal(
      organizationIdResult.value,
      params.data.dealId,
    );

    return sendResult(reply, result);
  });

  fastify.patch('/v1/organizations/:organizationId/deals/:dealId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = dealParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = updateDealBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.dealService.updateDeal(
      organizationIdResult.value,
      params.data.dealId,
      body.data,
      userId,
    );

    return sendResult(reply, result);
  });

  fastify.get('/v1/organizations/:organizationId/pipeline-stages', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listPipelineStagesQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.pipelineStageService.listPipelineStages(
      organizationIdResult.value,
      query.data,
    );

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/pipeline-stages', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createPipelineStageBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.pipelineStageService.createPipelineStage(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get(
    '/v1/organizations/:organizationId/pipeline-stages/:stageId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = pipelineStageParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.pipelineStageService.getPipelineStage(
        organizationIdResult.value,
        params.data.stageId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/pipeline-stages/:stageId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = pipelineStageParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updatePipelineStageBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.pipelineStageService.updatePipelineStage(
        organizationIdResult.value,
        params.data.stageId,
        body.data,
        userId,
      );

      return sendResult(reply, result);
    },
  );
}