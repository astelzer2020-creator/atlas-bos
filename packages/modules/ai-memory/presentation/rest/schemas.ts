import { z } from 'zod';

const conversationSessionTypeSchema = z.enum(['chat', 'agent', 'workflow', 'support']);
const conversationSessionStatusSchema = z.enum(['active', 'summarized', 'archived', 'expired']);
const conversationMessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
const conversationContentTypeSchema = z.enum(['text', 'markdown', 'json', 'tool_result']);
const memorySourceTypeSchema = z.enum([
  'document',
  'kb_article',
  'email',
  'meeting',
  'crm_note',
  'chat',
  'agent_run',
  'user_explicit',
  'settings',
]);
const knowledgeDocumentSourceTypeSchema = z.enum(['upload', 'url', 'integration', 'manual']);
const knowledgeDocumentStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'failed',
  'archived',
]);

export const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const conversationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid(),
});

export const memoryChunkParamsSchema = z.object({
  organizationId: z.string().uuid(),
  memoryChunkId: z.string().uuid(),
});

export const knowledgeDocumentParamsSchema = z.object({
  organizationId: z.string().uuid(),
  documentId: z.string().uuid(),
});

const paginationQueryBase = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listConversationsQuerySchema = paginationQueryBase
  .extend({
    sessionType: conversationSessionTypeSchema.optional(),
    status: conversationSessionStatusSchema.optional(),
    userId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.sessionType !== undefined ? { sessionType: value.sessionType } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.userId !== undefined ? { userId: value.userId } : {}),
  }));

export const createConversationBodySchema = z
  .object({
    sessionType: conversationSessionTypeSchema.optional(),
    title: z.string().max(512).optional(),
    agentRunId: z.string().uuid().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    ...(value.sessionType !== undefined ? { sessionType: value.sessionType } : {}),
    ...(value.title !== undefined ? { title: value.title } : {}),
    ...(value.agentRunId !== undefined ? { agentRunId: value.agentRunId } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const updateConversationBodySchema = z
  .object({
    title: z.string().max(512).optional(),
    status: conversationSessionStatusSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    ...(value.title !== undefined ? { title: value.title } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const getConversationQuerySchema = z
  .object({
    includeMessages: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .optional()
      .transform((value) => value === true || value === 'true'),
  })
  .transform((value) => ({
    includeMessages: value.includeMessages ?? true,
  }));

export const createConversationMessageBodySchema = z
  .object({
    role: conversationMessageRoleSchema,
    content: z.string().min(1).max(65536),
    contentType: conversationContentTypeSchema.optional(),
    toolCalls: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    role: value.role,
    content: value.content,
    ...(value.contentType !== undefined ? { contentType: value.contentType } : {}),
    ...(value.toolCalls !== undefined ? { toolCalls: value.toolCalls } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const listMemoryChunksQuerySchema = paginationQueryBase
  .extend({
    sourceType: memorySourceTypeSchema.optional(),
    sourceId: z.string().uuid().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.sourceType !== undefined ? { sourceType: value.sourceType } : {}),
    ...(value.sourceId !== undefined ? { sourceId: value.sourceId } : {}),
  }));

export const storeMemoryChunkBodySchema = z
  .object({
    sourceType: memorySourceTypeSchema,
    sourceId: z.string().uuid().optional(),
    textContent: z.string().min(1).max(65536),
    sourceVersion: z.number().int().min(1).optional(),
    chunkIndex: z.number().int().min(0).optional(),
    language: z.string().max(16).optional(),
    containsPii: z.boolean().optional(),
    importanceScore: z.number().min(0).max(1).optional(),
    embedding: z.array(z.number()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .transform((value) => ({
    sourceType: value.sourceType,
    textContent: value.textContent,
    ...(value.sourceId !== undefined ? { sourceId: value.sourceId } : {}),
    ...(value.sourceVersion !== undefined ? { sourceVersion: value.sourceVersion } : {}),
    ...(value.chunkIndex !== undefined ? { chunkIndex: value.chunkIndex } : {}),
    ...(value.language !== undefined ? { language: value.language } : {}),
    ...(value.containsPii !== undefined ? { containsPii: value.containsPii } : {}),
    ...(value.importanceScore !== undefined ? { importanceScore: value.importanceScore } : {}),
    ...(value.embedding !== undefined ? { embedding: value.embedding } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
  }));

export const searchMemoryChunksBodySchema = z
  .object({
    query: z.string().min(1).max(4096),
    sourceTypes: z.array(memorySourceTypeSchema).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    minScore: z.number().min(0).max(1).optional(),
  })
  .transform((value) => ({
    query: value.query,
    ...(value.sourceTypes !== undefined ? { sourceTypes: value.sourceTypes } : {}),
    ...(value.limit !== undefined ? { limit: value.limit } : {}),
    ...(value.minScore !== undefined ? { minScore: value.minScore } : {}),
  }));

export const createKnowledgeDocumentBodySchema = z
  .object({
    title: z.string().min(1).max(512),
    description: z.string().max(4096).optional(),
    sourceType: knowledgeDocumentSourceTypeSchema.optional(),
    sourceUri: z.string().url().optional(),
    contentType: z.string().max(128).optional(),
    rawContent: z.string().max(1_048_576).optional(),
    metadata: z.record(z.unknown()).optional(),
    autoChunk: z.boolean().optional(),
  })
  .transform((value) => ({
    title: value.title,
    ...(value.description !== undefined ? { description: value.description } : {}),
    ...(value.sourceType !== undefined ? { sourceType: value.sourceType } : {}),
    ...(value.sourceUri !== undefined ? { sourceUri: value.sourceUri } : {}),
    ...(value.contentType !== undefined ? { contentType: value.contentType } : {}),
    ...(value.rawContent !== undefined ? { rawContent: value.rawContent } : {}),
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
    ...(value.autoChunk !== undefined ? { autoChunk: value.autoChunk } : {}),
  }));

export const listKnowledgeDocumentsQuerySchema = paginationQueryBase
  .extend({
    status: knowledgeDocumentStatusSchema.optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.status !== undefined ? { status: value.status } : {}),
  }));

export const listKnowledgeChunksQuerySchema = paginationQueryBase
  .extend({
    documentId: z.string().uuid().optional(),
    query: z.string().max(4096).optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    ...(value.cursor !== undefined ? { cursor: value.cursor } : {}),
    ...(value.documentId !== undefined ? { documentId: value.documentId } : {}),
    ...(value.query !== undefined ? { query: value.query } : {}),
  }));

export function parseIfMatchHeader(header: string | string[] | undefined): number | null {
  if (header === undefined) {
    return null;
  }

  const value = Array.isArray(header) ? header[0] : header;
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) ? parsed : null;
}