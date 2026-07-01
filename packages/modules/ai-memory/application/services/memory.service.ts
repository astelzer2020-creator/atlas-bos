import { randomUUID } from 'node:crypto';

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
  MemoryChunkRecord,
  MemoryChunkRepository,
  MemorySourceType,
} from '../../domain/repositories/memory-chunk.repository.js';
import { computeContentHash } from '../../domain/utils/content-hash.js';
import { generateLocalEmbedding } from '../../domain/utils/embedding.js';
import { rankByHybridSearch } from '../../domain/utils/hybrid-search.js';

export interface MemoryChunkDto {
  readonly id: string;
  readonly organizationId: string;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly chunkIndex: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount: number | null;
  readonly language: string | null;
  readonly containsPii: boolean;
  readonly importanceScore: string;
  readonly accessPolicy: Record<string, unknown>;
  readonly entityRefs: unknown[];
  readonly metadata: Record<string, unknown>;
  readonly lastAccessedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface StoreMemoryChunkInput {
  readonly sourceType: MemorySourceType;
  readonly sourceId?: string;
  readonly textContent: string;
  readonly sourceVersion?: number;
  readonly chunkIndex?: number;
  readonly language?: string;
  readonly containsPii?: boolean;
  readonly importanceScore?: number;
  readonly embedding?: number[];
  readonly metadata?: Record<string, unknown>;
}

export interface SearchMemoryChunksInput {
  readonly query: string;
  readonly sourceTypes?: MemorySourceType[];
  readonly limit?: number;
  readonly minScore?: number;
}

export interface MemoryChunkSearchResultDto {
  readonly chunk: MemoryChunkDto;
  readonly score: number;
}

export interface ListMemoryChunksInput {
  readonly sourceType?: MemorySourceType;
  readonly sourceId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface MemoryServiceDeps {
  readonly memoryChunkRepository: MemoryChunkRepository;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

const VALID_SOURCE_TYPES: readonly MemorySourceType[] = [
  'document',
  'kb_article',
  'email',
  'meeting',
  'crm_note',
  'chat',
  'agent_run',
  'user_explicit',
  'settings',
];

export class MemoryService {
  constructor(private readonly deps: MemoryServiceDeps) {}

  async storeChunk(
    organizationId: OrganizationId,
    input: StoreMemoryChunkInput,
    actorId?: UserId,
  ): Promise<Result<MemoryChunkDto, ValidationError>> {
    if (!VALID_SOURCE_TYPES.includes(input.sourceType)) {
      return err(new ValidationError('Invalid memory source type', { field: 'sourceType' }));
    }

    const textContent = input.textContent.trim();
    if (textContent.length === 0) {
      return err(new ValidationError('Memory chunk text content is required', { field: 'textContent' }));
    }

    const record = await this.deps.memoryChunkRepository.create({
      organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? randomUUID(),
      contentHash: computeContentHash(textContent),
      textContent,
      ...(input.sourceVersion !== undefined ? { sourceVersion: input.sourceVersion } : {}),
      ...(input.chunkIndex !== undefined ? { chunkIndex: input.chunkIndex } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.containsPii !== undefined ? { containsPii: input.containsPii } : {}),
      ...(input.importanceScore !== undefined ? { importanceScore: input.importanceScore } : {}),
      embedding:
        input.embedding !== undefined ? input.embedding : generateLocalEmbedding(textContent),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    });

    return ok(this.toDto(record));
  }

  async getChunk(
    organizationId: OrganizationId,
    chunkId: string,
  ): Promise<Result<MemoryChunkDto, NotFoundError>> {
    const record = await this.deps.memoryChunkRepository.findById(organizationId, chunkId);

    if (record === null) {
      return err(new NotFoundError('MemoryChunk', chunkId));
    }

    return ok(this.toDto(record));
  }

  async deleteChunk(
    organizationId: OrganizationId,
    chunkId: string,
  ): Promise<Result<void, NotFoundError>> {
    const deleted = await this.deps.memoryChunkRepository.softDelete(organizationId, chunkId);

    if (!deleted) {
      return err(new NotFoundError('MemoryChunk', chunkId));
    }

    return ok(undefined);
  }

  async listChunks(
    organizationId: OrganizationId,
    input: ListMemoryChunksInput = {},
  ): Promise<{ data: MemoryChunkDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const records = await this.deps.memoryChunkRepository.list(organizationId, {
      limit: limit + 1,
      ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1]!.createdAt.toISOString() : null;

    return {
      data: page.map((record) => this.toDto(record)),
      next_cursor: nextCursor,
    };
  }

  async searchChunks(
    organizationId: OrganizationId,
    input: SearchMemoryChunksInput,
  ): Promise<Result<{ results: MemoryChunkSearchResultDto[] }, ValidationError>> {
    const query = input.query.trim();
    if (query.length === 0) {
      return err(new ValidationError('Search query is required', { field: 'query' }));
    }

    const limit = Math.min(input.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const minScore = input.minScore ?? 0;

    const candidates = await this.deps.memoryChunkRepository.searchCandidates(
      organizationId,
      input.sourceTypes,
    );

    const ranked = rankByHybridSearch(
      candidates,
      query,
      (chunk) => chunk.textContent,
      (chunk) => chunk.embedding,
      { minScore },
    ).slice(0, limit);

    return ok({
      results: ranked.map((result) => ({
        chunk: this.toDto(result.item),
        score: result.score,
      })),
    });
  }

  private toDto(record: MemoryChunkRecord): MemoryChunkDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      sourceVersion: record.sourceVersion,
      chunkIndex: record.chunkIndex,
      contentHash: record.contentHash,
      textContent: record.textContent,
      tokenCount: record.tokenCount,
      language: record.language,
      containsPii: record.containsPii,
      importanceScore: record.importanceScore.toFixed(4),
      accessPolicy: record.accessPolicy,
      entityRefs: record.entityRefs,
      metadata: record.metadata,
      lastAccessedAt: record.lastAccessedAt?.toISOString() ?? null,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    };
  }
}