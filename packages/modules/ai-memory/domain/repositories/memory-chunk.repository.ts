import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type MemorySourceType =
  | 'document'
  | 'kb_article'
  | 'email'
  | 'meeting'
  | 'crm_note'
  | 'chat'
  | 'agent_run'
  | 'user_explicit'
  | 'settings';

export interface MemoryChunkRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly chunkIndex: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount: number | null;
  readonly language: string | null;
  readonly containsPii: boolean;
  readonly importanceScore: number;
  readonly embedding: number[] | null;
  readonly accessPolicy: Record<string, unknown>;
  readonly entityRefs: unknown[];
  readonly metadata: Record<string, unknown>;
  readonly lastAccessedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CreateMemoryChunkData {
  readonly organizationId: OrganizationId;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly sourceVersion?: number;
  readonly chunkIndex?: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount?: number;
  readonly language?: string;
  readonly containsPii?: boolean;
  readonly importanceScore?: number;
  readonly embedding?: number[];
  readonly accessPolicy?: Record<string, unknown>;
  readonly entityRefs?: unknown[];
  readonly metadata?: Record<string, unknown>;
  readonly expiresAt?: Date;
  readonly createdBy?: UserId;
}

export interface ListMemoryChunksFilter {
  readonly sourceType?: MemorySourceType;
  readonly sourceId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface MemoryChunkRepository {
  findById(organizationId: OrganizationId, id: string): Promise<MemoryChunkRecord | null>;

  create(data: CreateMemoryChunkData): Promise<MemoryChunkRecord>;

  softDelete(organizationId: OrganizationId, id: string): Promise<boolean>;

  list(
    organizationId: OrganizationId,
    filter: ListMemoryChunksFilter,
  ): Promise<MemoryChunkRecord[]>;

  searchCandidates(
    organizationId: OrganizationId,
    sourceTypes?: MemorySourceType[],
  ): Promise<MemoryChunkRecord[]>;
}