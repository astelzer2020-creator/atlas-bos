import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ConversationService } from '../../application/services/conversation.service.js';
import type { KnowledgeBaseService } from '../../application/services/knowledge-base.service.js';
import type { MemoryService } from '../../application/services/memory.service.js';

import {
  conversationParamsSchema,
  createConversationBodySchema,
  createConversationMessageBodySchema,
  createKnowledgeDocumentBodySchema,
  getConversationQuerySchema,
  knowledgeDocumentParamsSchema,
  listConversationsQuerySchema,
  listKnowledgeChunksQuerySchema,
  listKnowledgeDocumentsQuerySchema,
  listMemoryChunksQuerySchema,
  memoryChunkParamsSchema,
  organizationParamsSchema,
  parseIfMatchHeader,
  searchMemoryChunksBodySchema,
  storeMemoryChunkBodySchema,
  updateConversationBodySchema,
} from './schemas.js';

export interface AiMemoryRouteContext {
  readonly userId: string;
}

export interface AiMemoryRoutesDeps {
  readonly conversationService: ConversationService;
  readonly memoryService: MemoryService;
  readonly knowledgeBaseService: KnowledgeBaseService;
  readonly authenticate: (request: FastifyRequest) => Promise<AiMemoryRouteContext | null>;
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
  authenticate: AiMemoryRoutesDeps['authenticate'],
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

export async function registerAiMemoryRoutes(
  fastify: FastifyInstance,
  deps: AiMemoryRoutesDeps,
): Promise<void> {
  fastify.get('/v1/organizations/:organizationId/conversations', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listConversationsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.conversationService.listSessions(
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
  });

  fastify.post('/v1/organizations/:organizationId/conversations', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createConversationBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.conversationService.createSession(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get(
    '/v1/organizations/:organizationId/conversations/:conversationId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = conversationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = getConversationQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.conversationService.getSession(
        organizationIdResult.value,
        params.data.conversationId,
        query.data.includeMessages,
      );

      return sendResult(reply, result);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/conversations/:conversationId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = conversationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updateConversationBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const expectedVersion = parseIfMatchHeader(request.headers['if-match']);
      if (expectedVersion === null) {
        return validationError(reply, [
          { path: ['If-Match'], message: 'If-Match header with version is required' },
        ]);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.conversationService.updateSession(
        organizationIdResult.value,
        params.data.conversationId,
        { ...body.data, expectedVersion },
        userId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.get(
    '/v1/organizations/:organizationId/conversations/:conversationId/messages',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = conversationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = listConversationsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.conversationService.listMessages(
        organizationIdResult.value,
        params.data.conversationId,
        { limit: query.data.limit, ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}) },
      );

      if (!result.ok) {
        return sendResult(reply, result);
      }

      return reply.status(200).send({
        data: result.value.data,
        pagination: {
          has_more: result.value.next_cursor !== null,
          next_cursor: result.value.next_cursor,
          limit: query.data.limit,
        },
      });
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/conversations/:conversationId/messages',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = conversationParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = createConversationMessageBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.conversationService.addMessage(
        organizationIdResult.value,
        params.data.conversationId,
        body.data,
      );

      return sendResult(reply, result, 201);
    },
  );

  fastify.get('/v1/organizations/:organizationId/memory-chunks', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listMemoryChunksQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.memoryService.listChunks(organizationIdResult.value, query.data);

    return reply.status(200).send({
      data: result.data,
      pagination: {
        has_more: result.next_cursor !== null,
        next_cursor: result.next_cursor,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/organizations/:organizationId/memory-chunks', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = storeMemoryChunkBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.memoryService.storeChunk(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.post('/v1/organizations/:organizationId/memory-chunks/search', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = searchMemoryChunksBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.memoryService.searchChunks(organizationIdResult.value, body.data);

    return sendResult(reply, result);
  });

  fastify.get(
    '/v1/organizations/:organizationId/memory-chunks/:memoryChunkId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = memoryChunkParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.memoryService.getChunk(
        organizationIdResult.value,
        params.data.memoryChunkId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.delete(
    '/v1/organizations/:organizationId/memory-chunks/:memoryChunkId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = memoryChunkParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.memoryService.deleteChunk(
        organizationIdResult.value,
        params.data.memoryChunkId,
      );

      if (!result.ok) {
        return sendResult(reply, result);
      }

      return reply.status(204).send();
    },
  );

  fastify.get('/v1/organizations/:organizationId/knowledge-documents', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listKnowledgeDocumentsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.knowledgeBaseService.listDocuments(
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
  });

  fastify.post('/v1/organizations/:organizationId/knowledge-documents', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createKnowledgeDocumentBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.knowledgeBaseService.uploadDocument(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get(
    '/v1/organizations/:organizationId/knowledge-documents/:documentId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = knowledgeDocumentParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.knowledgeBaseService.getDocument(
        organizationIdResult.value,
        params.data.documentId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/knowledge-documents/:documentId/chunk',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = knowledgeDocumentParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.knowledgeBaseService.chunkDocument(
        organizationIdResult.value,
        params.data.documentId,
      );

      return sendResult(reply, result, 200);
    },
  );

  fastify.get('/v1/organizations/:organizationId/knowledge-chunks', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listKnowledgeChunksQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.knowledgeBaseService.listChunks(
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
  });
}