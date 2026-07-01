import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type KnowledgeDocumentSourceType = 'upload' | 'url' | 'integration' | 'manual';
export type KnowledgeDocumentStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'archived';

export interface KnowledgeDocumentRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly description: string | null;
  readonly sourceType: KnowledgeDocumentSourceType;
  readonly sourceUri: string | null;
  readonly contentType: string;
  readonly rawContent: string | null;
  readonly status: KnowledgeDocumentStatus;
  readonly chunkCount: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface KnowledgeChunkRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly documentId: string;
  readonly chunkIndex: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount: number | null;
  readonly embedding: number[] | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface CreateKnowledgeDocumentData {
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly description?: string;
  readonly sourceType?: KnowledgeDocumentSourceType;
  readonly sourceUri?: string;
  readonly contentType?: string;
  readonly rawContent?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface CreateKnowledgeChunkData {
  readonly organizationId: OrganizationId;
  readonly documentId: string;
  readonly chunkIndex: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount?: number;
  readonly embedding?: number[];
  readonly metadata?: Record<string, unknown>;
}

export interface ListKnowledgeDocumentsFilter {
  readonly status?: KnowledgeDocumentStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListKnowledgeChunksFilter {
  readonly documentId?: string;
  readonly query?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface KnowledgeRepository {
  findDocumentById(
    organizationId: OrganizationId,
    documentId: string,
  ): Promise<KnowledgeDocumentRecord | null>;

  createDocument(data: CreateKnowledgeDocumentData): Promise<KnowledgeDocumentRecord>;

  updateDocumentStatus(
    organizationId: OrganizationId,
    documentId: string,
    status: KnowledgeDocumentStatus,
    chunkCount?: number,
  ): Promise<KnowledgeDocumentRecord | null>;

  listDocuments(
    organizationId: OrganizationId,
    filter: ListKnowledgeDocumentsFilter,
  ): Promise<KnowledgeDocumentRecord[]>;

  replaceChunksForDocument(
    organizationId: OrganizationId,
    documentId: string,
    chunks: CreateKnowledgeChunkData[],
  ): Promise<KnowledgeChunkRecord[]>;

  listChunks(
    organizationId: OrganizationId,
    filter: ListKnowledgeChunksFilter,
  ): Promise<KnowledgeChunkRecord[]>;

  searchChunkCandidates(organizationId: OrganizationId): Promise<KnowledgeChunkRecord[]>;
}