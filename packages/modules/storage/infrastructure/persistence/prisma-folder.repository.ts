import type { Prisma, PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type {
  CreateFolderData,
  FolderId,
  FolderRecord,
  FolderRepository,
  ListFoldersFilter,
} from '../../domain/repositories/folder.repository.js';

export class PrismaFolderRepository implements FolderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, folderId: FolderId): Promise<FolderRecord | null> {
    const record = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        tenantId: organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findBySlug(
    organizationId: OrganizationId,
    parentFolderId: FolderId | null,
    slug: string,
  ): Promise<FolderRecord | null> {
    const record = await this.prisma.folder.findFirst({
      where: {
        tenantId: organizationId,
        parentFolderId,
        slug,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateFolderData): Promise<FolderRecord> {
    const record = await this.prisma.folder.create({
      data: {
        tenantId: data.organizationId,
        name: data.name,
        slug: data.slug,
        path: data.path,
        depth: data.depth,
        createdBy: data.createdById,
        parentFolderId: data.parentFolderId ?? null,
        workspaceId: data.workspaceId ?? null,
        description: data.description ?? null,
        color: data.color ?? null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return this.toRecord(record);
  }

  async list(filter: ListFoldersFilter): Promise<FolderRecord[]> {
    const records = await this.prisma.folder.findMany({
      where: {
        tenantId: filter.organizationId,
        deletedAt: null,
        ...(filter.workspaceId !== undefined ? { workspaceId: filter.workspaceId } : {}),
        ...(filter.parentFolderId !== undefined ? { parentFolderId: filter.parentFolderId } : {}),
        ...(filter.cursor !== undefined ? { id: { gt: filter.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private toRecord(record: {
    id: string;
    tenantId: string;
    workspaceId: string | null;
    parentFolderId: string | null;
    name: string;
    slug: string;
    path: string;
    depth: number;
    description: string | null;
    color: string | null;
    isSystem: boolean;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
  }): FolderRecord {
    return {
      id: record.id as FolderId,
      organizationId: record.tenantId as OrganizationId,
      workspaceId: record.workspaceId,
      parentFolderId: record.parentFolderId as FolderId | null,
      name: record.name,
      slug: record.slug,
      path: record.path,
      depth: record.depth,
      description: record.description,
      color: record.color,
      isSystem: record.isSystem,
      metadata: this.asMetadata(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy as UserId,
      version: record.version,
    };
  }

  private asMetadata(value: unknown): Readonly<Record<string, unknown>> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Readonly<Record<string, unknown>>;
    }

    return {};
  }
}