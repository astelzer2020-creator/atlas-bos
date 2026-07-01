import type { PrismaClient } from '@atlas/database';
import type { UserId, WorkspaceId } from '@atlas/shared-kernel';

import type {
  CreateWorkspaceData,
  ListWorkspacesFilter,
  WorkspaceRecord,
  WorkspaceRepository,
} from '../../domain/repositories/workspace.repository.js';

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: WorkspaceId): Promise<WorkspaceRecord | null> {
    const record = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
    const record = await this.prisma.workspace.findFirst({
      where: { slug, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateWorkspaceData): Promise<WorkspaceRecord> {
    const record = await this.prisma.workspace.create({
      data: {
        slug: data.slug,
        name: data.name,
        displayName: data.displayName ?? null,
        ownerUserId: data.ownerUserId,
        createdById: data.createdById,
      },
    });

    return this.toRecord(record);
  }

  async list(filter: ListWorkspacesFilter): Promise<WorkspaceRecord[]> {
    const records = await this.prisma.workspace.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: filter.userId },
          {
            members: {
              some: {
                userId: filter.userId,
                status: 'ACTIVE',
                deletedAt: null,
              },
            },
          },
        ],
        ...(filter.cursor !== undefined ? { id: { gt: filter.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: filter.limit,
    });

    return records.map((record: Parameters<typeof this.toRecord>[0]) => this.toRecord(record));
  }

  async addMember(workspaceId: WorkspaceId, userId: UserId, isAdmin = false): Promise<void> {
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        status: 'ACTIVE',
        isAdmin,
      },
    });
  }

  private toRecord(record: {
    id: string;
    slug: string;
    name: string;
    displayName: string | null;
    ownerUserId: string;
    isActive: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceRecord {
    return {
      id: record.id as WorkspaceId,
      slug: record.slug,
      name: record.name,
      displayName: record.displayName,
      ownerUserId: record.ownerUserId as UserId,
      isActive: record.isActive,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}