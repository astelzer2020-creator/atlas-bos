import {
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeRepository,
} from '../../domain/repositories/knowledge.repository.js';
import { computeContentHash } from '../../domain/utils/content-hash.js';
import { generateLocalEmbedding } from '../../domain/utils/embedding.js';
import { rankByHybridSearch } from '../../domain/utils/hybrid-search.js';
import { splitByParagraphs } from '../../domain/utils/paragraph-chunker.js';

export interface KnowledgeDocumentDto {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly sourceType: KnowledgeDocumentRecord['sourceType'];
  readonly sourceUri: string | null;
  readonly contentType: string;
  readonly status: KnowledgeDocumentRecord['status'];
  readonly chunkCount: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface KnowledgeChunkDto {
  readonly id: string;
  readonly organizationId: string;
  readonly documentId: string;
  readonly chunkIndex: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount: number | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface UploadKnowledgeDocumentInput {
  readonly title: string;
  readonly description?: string;
  readonly sourceType?: KnowledgeDocumentRecord['sourceType'];
  readonly sourceUri?: string;
  readonly contentType?: string;
  readonly rawContent?: string;
  readonly metadata?: Record<string, unknown>;
  readonly autoChunk?: boolean;
}

export interface ListKnowledgeDocumentsInput {
  readonly status?: KnowledgeDocumentRecord['status'];
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListKnowledgeChunksInput {
  readonly documentId?: string;
  readonly query?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface KnowledgeBaseServiceDeps {
  readonly knowledgeRepository: KnowledgeRepository;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export class KnowledgeBaseService {
  constructor(private readonly deps: KnowledgeBaseServiceDeps) {}

  async uploadDocument(
    organizationId: OrganizationId,
    input: UploadKnowledgeDocumentInput,
    actorId?: UserId,
  ): Promise<Result<KnowledgeDocumentDto, ValidationError>> {
    const title = input.title.trim();
    if (title.length === 0) {
      return err(new ValidationError('Document title is required', { field: 'title' }));
    }

    const record = await this.deps.knowledgeRepository.createDocument({
      organizationId,
      title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
      ...(input.sourceUri !== undefined ? { sourceUri: input.sourceUri } : {}),
      ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
      ...(input.rawContent !== undefined ? { rawContent: input.rawContent } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    });

    if (input.autoChunk !== false && input.rawContent !== undefined && input.rawContent.trim().length > 0) {
      const chunkResult = await this.chunkDocument(organizationId, record.id);
      if (chunkResult.ok) {
        return ok(chunkResult.value.document);
      }
    }

    return ok(this.toDocumentDto(record));
  }

  async getDocument(
    organizationId: OrganizationId,
    documentId: string,
  ): Promise<Result<KnowledgeDocumentDto, NotFoundError>> {
    const record = await this.deps.knowledgeRepository.findDocumentById(organizationId, documentId);

    if (record === null) {
      return err(new NotFoundError('KnowledgeDocument', documentId));
    }

    return ok(this.toDocumentDto(record));
  }

  async listDocuments(
    organizationId: OrganizationId,
    input: ListKnowledgeDocumentsInput = {},
  ): Promise<{ data: KnowledgeDocumentDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const records = await this.deps.knowledgeRepository.listDocuments(organizationId, {
      limit: limit + 1,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1]!.createdAt.toISOString() : null;

    return {
      data: page.map((record) => this.toDocumentDto(record)),
      next_cursor: nextCursor,
    };
  }

  async chunkDocument(
    organizationId: OrganizationId,
    documentId: string,
  ): Promise<
    Result<{ document: KnowledgeDocumentDto; chunks: KnowledgeChunkDto[] }, NotFoundError | ValidationError>
  > {
    const document = await this.deps.knowledgeRepository.findDocumentById(organizationId, documentId);

    if (document === null) {
      return err(new NotFoundError('KnowledgeDocument', documentId));
    }

    const rawContent = document.rawContent?.trim() ?? '';
    if (rawContent.length === 0) {
      return err(new ValidationError('Document has no raw content to chunk', { field: 'rawContent' }));
    }

    await this.deps.knowledgeRepository.updateDocumentStatus(
      organizationId,
      documentId,
      'processing',
    );

    const paragraphs = splitByParagraphs(rawContent);
    const chunkData = paragraphs.map((paragraph, index) => ({
      organizationId,
      documentId,
      chunkIndex: index,
      contentHash: computeContentHash(paragraph),
      textContent: paragraph,
      tokenCount: Math.ceil(paragraph.length / 4),
      embedding: generateLocalEmbedding(paragraph),
    }));

    const chunks = await this.deps.knowledgeRepository.replaceChunksForDocument(
      organizationId,
      documentId,
      chunkData,
    );

    const updated = await this.deps.knowledgeRepository.updateDocumentStatus(
      organizationId,
      documentId,
      'ready',
      chunks.length,
    );

    return ok({
      document: this.toDocumentDto(updated ?? document),
      chunks: chunks.map((chunk) => this.toChunkDto(chunk)),
    });
  }

  async listChunks(
    organizationId: OrganizationId,
    input: ListKnowledgeChunksInput = {},
  ): Promise<{ data: KnowledgeChunkDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    let records = await this.deps.knowledgeRepository.listChunks(organizationId, {
      limit: input.query !== undefined ? MAX_LIST_LIMIT : limit + 1,
      ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    if (input.query !== undefined && input.query.trim().length > 0) {
      const ranked = rankByHybridSearch(
        records,
        input.query,
        (chunk) => chunk.textContent,
        (chunk) => chunk.embedding,
      );
      records = ranked.map((result) => result.item).slice(0, limit);
      return {
        data: records.map((record) => this.toChunkDto(record)),
        next_cursor: null,
      };
    }

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1]!.createdAt.toISOString() : null;

    return {
      data: page.map((record) => this.toChunkDto(record)),
      next_cursor: nextCursor,
    };
  }

  private toDocumentDto(record: KnowledgeDocumentRecord): KnowledgeDocumentDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      title: record.title,
      description: record.description,
      sourceType: record.sourceType,
      sourceUri: record.sourceUri,
      contentType: record.contentType,
      status: record.status,
      chunkCount: record.chunkCount,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    };
  }

  private toChunkDto(record: KnowledgeChunkRecord): KnowledgeChunkDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      documentId: record.documentId,
      chunkIndex: record.chunkIndex,
      contentHash: record.contentHash,
      textContent: record.textContent,
      tokenCount: record.tokenCount,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
    };
  }
}