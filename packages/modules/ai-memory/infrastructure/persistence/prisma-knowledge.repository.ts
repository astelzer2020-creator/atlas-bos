import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateKnowledgeChunkData,
  CreateKnowledgeDocumentData,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeDocumentStatus,
  KnowledgeRepository,
  ListKnowledgeChunksFilter,
  ListKnowledgeDocumentsFilter,
} from '../../domain/repositories/knowledge.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findDocumentById(
    organizationId: OrganizationId,
    documentId: string,
  ): Promise<KnowledgeDocumentRecord | null> {
    const record = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toDocumentRecord(record);
  }

  async createDocument(data: CreateKnowledgeDocumentData): Promise<KnowledgeDocumentRecord> {
    const record = await this.prisma.knowledgeDocument.create({
      data: {
        organizationId: data.organizationId,
        title: data.title,
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.sourceType !== undefined ? { sourceType: data.sourceType } : {}),
        ...(data.sourceUri !== undefined ? { sourceUri: data.sourceUri } : {}),
        ...(data.contentType !== undefined ? { contentType: data.contentType } : {}),
        ...(data.rawContent !== undefined ? { rawContent: data.rawContent } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toDocumentRecord(record);
  }

  async updateDocumentStatus(
    organizationId: OrganizationId,
    documentId: string,
    status: KnowledgeDocumentStatus,
    chunkCount?: number,
  ): Promise<KnowledgeDocumentRecord | null> {
    try {
      const record = await this.prisma.knowledgeDocument.update({
        where: {
          id: documentId,
          organizationId,
          deletedAt: null,
        },
        data: {
          status,
          ...(chunkCount !== undefined ? { chunkCount } : {}),
        },
      });

      return this.toDocumentRecord(record);
    } catch {
      return null;
    }
  }

  async listDocuments(
    organizationId: OrganizationId,
    filter: ListKnowledgeDocumentsFilter,
  ): Promise<KnowledgeDocumentRecord[]> {
    const records = await this.prisma.knowledgeDocument.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.cursor !== undefined ? { createdAt: { lt: new Date(filter.cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
    });

    return records.map((record) => this.toDocumentRecord(record));
  }

  async replaceChunksForDocument(
    organizationId: OrganizationId,
    documentId: string,
    chunks: CreateKnowledgeChunkData[],
  ): Promise<KnowledgeChunkRecord[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.updateMany({
        where: {
          documentId,
          organizationId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      const created: KnowledgeChunkRecord[] = [];

      for (const chunk of chunks) {
        const record = await tx.knowledgeChunk.create({
          data: {
            organizationId: chunk.organizationId,
            documentId: chunk.documentId,
            chunkIndex: chunk.chunkIndex,
            contentHash: chunk.contentHash,
            textContent: chunk.textContent,
            ...(chunk.tokenCount !== undefined ? { tokenCount: chunk.tokenCount } : {}),
            ...(chunk.embedding !== undefined ? { embedding: chunk.embedding } : {}),
            ...(chunk.metadata !== undefined ? { metadata: toJsonValue(chunk.metadata) } : {}),
          },
        });

        created.push(this.toChunkRecord(record));
      }

      return created;
    });
  }

  async listChunks(
    organizationId: OrganizationId,
    filter: ListKnowledgeChunksFilter,
  ): Promise<KnowledgeChunkRecord[]> {
    const records = await this.prisma.knowledgeChunk.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filter.documentId !== undefined ? { documentId: filter.documentId } : {}),
        ...(filter.cursor !== undefined ? { createdAt: { lt: new Date(filter.cursor) } } : {}),
      },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toChunkRecord(record));
  }

  async searchChunkCandidates(organizationId: OrganizationId): Promise<KnowledgeChunkRecord[]> {
    const records = await this.prisma.knowledgeChunk.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return records.map((record) => this.toChunkRecord(record));
  }

  private toDocumentRecord(record: {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    sourceType: KnowledgeDocumentRecord['sourceType'];
    sourceUri: string | null;
    contentType: string;
    rawContent: string | null;
    status: KnowledgeDocumentStatus;
    chunkCount: number;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): KnowledgeDocumentRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      title: record.title,
      description: record.description,
      sourceType: record.sourceType,
      sourceUri: record.sourceUri,
      contentType: record.contentType,
      rawContent: record.rawContent,
      status: record.status,
      chunkCount: record.chunkCount,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  private toChunkRecord(record: {
    id: string;
    organizationId: string;
    documentId: string;
    chunkIndex: number;
    contentHash: string;
    textContent: string;
    tokenCount: number | null;
    embedding?: unknown;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }): KnowledgeChunkRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      documentId: record.documentId,
      chunkIndex: record.chunkIndex,
      contentHash: record.contentHash,
      textContent: record.textContent,
      tokenCount: record.tokenCount,
      embedding: Array.isArray(record.embedding) ? (record.embedding as number[]) : null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
    };
  }
}