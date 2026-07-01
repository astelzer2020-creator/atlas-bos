import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateMemoryChunkData,
  ListMemoryChunksFilter,
  MemoryChunkRecord,
  MemoryChunkRepository,
  MemorySourceType,
} from '../../domain/repositories/memory-chunk.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaMemoryChunkRepository implements MemoryChunkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<MemoryChunkRecord | null> {
    const record = await this.prisma.memoryChunk.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateMemoryChunkData): Promise<MemoryChunkRecord> {
    const record = await this.prisma.memoryChunk.create({
      data: {
        organizationId: data.organizationId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        contentHash: data.contentHash,
        textContent: data.textContent,
        ...(data.sourceVersion !== undefined ? { sourceVersion: data.sourceVersion } : {}),
        ...(data.chunkIndex !== undefined ? { chunkIndex: data.chunkIndex } : {}),
        ...(data.tokenCount !== undefined ? { tokenCount: data.tokenCount } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.containsPii !== undefined ? { containsPii: data.containsPii } : {}),
        ...(data.importanceScore !== undefined
          ? { importanceScore: data.importanceScore }
          : {}),

        ...(data.accessPolicy !== undefined ? { accessPolicy: toJsonValue(data.accessPolicy) } : {}),
        ...(data.entityRefs !== undefined
          ? { entityRefs: data.entityRefs as Prisma.InputJsonValue }
          : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async softDelete(organizationId: OrganizationId, id: string): Promise<boolean> {
    const result = await this.prisma.memoryChunk.updateMany({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  async list(
    organizationId: OrganizationId,
    filter: ListMemoryChunksFilter,
  ): Promise<MemoryChunkRecord[]> {
    const records = await this.prisma.memoryChunk.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filter.sourceType !== undefined ? { sourceType: filter.sourceType } : {}),
        ...(filter.sourceId !== undefined ? { sourceId: filter.sourceId } : {}),
        ...(filter.cursor !== undefined ? { createdAt: { lt: new Date(filter.cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  async searchCandidates(
    organizationId: OrganizationId,
    sourceTypes?: MemorySourceType[],
  ): Promise<MemoryChunkRecord[]> {
    const records = await this.prisma.memoryChunk.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(sourceTypes !== undefined && sourceTypes.length > 0
          ? { sourceType: { in: sourceTypes } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    return records.map((record) => this.toRecord(record));
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    sourceType: MemorySourceType;
    sourceId: string;
    sourceVersion: number;
    chunkIndex: number;
    contentHash: string;
    textContent: string;
    tokenCount: number | null;
    language: string | null;
    containsPii: boolean;
    importanceScore: Prisma.Decimal;
    embedding?: unknown;
    accessPolicy: Prisma.JsonValue;
    entityRefs: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    lastAccessedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): MemoryChunkRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      sourceVersion: record.sourceVersion,
      chunkIndex: record.chunkIndex,
      contentHash: record.contentHash,
      textContent: record.textContent,
      tokenCount: record.tokenCount,
      language: record.language,
      containsPii: record.containsPii,
      importanceScore: Number(record.importanceScore),
      embedding: Array.isArray(record.embedding) ? (record.embedding as number[]) : null,
      accessPolicy: (record.accessPolicy as Record<string, unknown>) ?? {},
      entityRefs: (record.entityRefs as unknown[]) ?? [],
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      lastAccessedAt: record.lastAccessedAt,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }
}