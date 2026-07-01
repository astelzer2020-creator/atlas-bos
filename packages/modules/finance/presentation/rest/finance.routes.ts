import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ChartOfAccountService } from '../../application/services/chart-of-account.service.js';
import type { JournalEntryService } from '../../application/services/journal-entry.service.js';

import {
  chartOfAccountParamsSchema,
  createChartOfAccountBodySchema,
  createJournalEntryBodySchema,
  journalEntryParamsSchema,
  listChartOfAccountsQuerySchema,
  listJournalEntriesQuerySchema,
  organizationParamsSchema,
  parseIfMatchHeader,
  updateChartOfAccountBodySchema,
} from './schemas.js';

export interface FinanceRouteContext {
  readonly userId: string;
}

export interface FinanceRoutesDeps {
  readonly chartOfAccountService: ChartOfAccountService;
  readonly journalEntryService: JournalEntryService;
  readonly authenticate: (request: FastifyRequest) => Promise<FinanceRouteContext | null>;
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
  authenticate: FinanceRoutesDeps['authenticate'],
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

export async function registerFinanceRoutes(
  fastify: FastifyInstance,
  deps: FinanceRoutesDeps,
): Promise<void> {
  fastify.get('/v1/organizations/:organizationId/chart-of-accounts', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listChartOfAccountsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.chartOfAccountService.listAccounts(
      organizationIdResult.value,
      query.data,
    );

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/chart-of-accounts', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createChartOfAccountBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.chartOfAccountService.createAccount(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get(
    '/v1/organizations/:organizationId/chart-of-accounts/:accountId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = chartOfAccountParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.chartOfAccountService.getAccount(
        organizationIdResult.value,
        params.data.accountId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/chart-of-accounts/:accountId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = chartOfAccountParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updateChartOfAccountBodySchema.safeParse(request.body);
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

      const result = await deps.chartOfAccountService.updateAccount(
        organizationIdResult.value,
        params.data.accountId,
        { ...body.data, version: expectedVersion },
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.get('/v1/organizations/:organizationId/journal-entries', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listJournalEntriesQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.journalEntryService.listEntries(
      organizationIdResult.value,
      query.data,
    );

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/journal-entries', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createJournalEntryBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const createInput = {
      description: body.data.description,
      lines: body.data.lines.map((line) => ({
        accountId: line.accountId,
        ...(line.lineNumber !== undefined ? { lineNumber: line.lineNumber } : {}),
        ...(line.description !== undefined ? { description: line.description } : {}),
        ...(line.debitAmount !== undefined ? { debitAmount: line.debitAmount } : {}),
        ...(line.creditAmount !== undefined ? { creditAmount: line.creditAmount } : {}),
        ...(line.metadata !== undefined ? { metadata: line.metadata } : {}),
      })),
      ...(body.data.entryNumber !== undefined ? { entryNumber: body.data.entryNumber } : {}),
      ...(body.data.entryDate !== undefined ? { entryDate: body.data.entryDate } : {}),
      ...(body.data.entryType !== undefined ? { entryType: body.data.entryType } : {}),
      ...(body.data.referenceType !== undefined ? { referenceType: body.data.referenceType } : {}),
      ...(body.data.referenceId !== undefined ? { referenceId: body.data.referenceId } : {}),
      ...(body.data.currencyCode !== undefined ? { currencyCode: body.data.currencyCode } : {}),
      ...(body.data.metadata !== undefined ? { metadata: body.data.metadata } : {}),
    };

    const result = await deps.journalEntryService.createEntry(
      organizationIdResult.value,
      createInput,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get(
    '/v1/organizations/:organizationId/journal-entries/:entryId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = journalEntryParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.journalEntryService.getEntry(
        organizationIdResult.value,
        params.data.entryId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/journal-entries/:entryId/post',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = journalEntryParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.journalEntryService.postEntry(
        organizationIdResult.value,
        params.data.entryId,
        userId,
      );

      return sendResult(reply, result);
    },
  );
}