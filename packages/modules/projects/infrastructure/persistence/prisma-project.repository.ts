import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateProjectData,
  ListProjectsFilter,
  ProjectPriority,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
  UpdateProjectData,
} from '../../domain/repositories/project.repository.js';
import {
  asRecord,
  buildDescendingCursorFilter,
  decimalToString,
  toJsonValue,
} from './prisma-cursor.js';

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<ProjectRecord | null> {
    const record = await this.prisma.project.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findByCode(organizationId: OrganizationId, code: string): Promise<ProjectRecord | null> {
    const record = await this.prisma.project.findFirst({
      where: { organizationId, code, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateProjectData): Promise<ProjectRecord> {
    const record = await this.prisma.project.create({
      data: {
        organizationId: data.organizationId,
        code: data.code,
        name: data.name,
        ...(data.workspaceId !== undefined ? { workspaceId: data.workspaceId } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.targetEndDate !== undefined ? { targetEndDate: data.targetEndDate } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateProjectData,
    expectedVersion: number,
  ): Promise<ProjectRecord | null> {
    try {
      const record = await this.prisma.project.update({
        where: { id, organizationId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.workspaceId !== undefined ? { workspaceId: data.workspaceId } : {}),
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
          ...(data.targetEndDate !== undefined ? { targetEndDate: data.targetEndDate } : {}),
          ...(data.progressPercent !== undefined
            ? { progressPercent: new Prisma.Decimal(data.progressPercent) }
            : {}),
          ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
          ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
          version: { increment: 1 },
        },
      });

      return this.toRecord(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async list(filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.project.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.priority !== undefined ? { priority: filter.priority } : {}),
        ...(filter.workspaceId !== undefined ? { workspaceId: filter.workspaceId } : {}),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.ProjectWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.project.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    workspaceId: string | null;
    code: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    targetEndDate: Date | null;
    progressPercent: Prisma.Decimal;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): ProjectRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      workspaceId: record.workspaceId,
      code: record.code,
      name: record.name,
      description: record.description,
      status: record.status as ProjectStatus,
      priority: record.priority as ProjectPriority,
      startDate: record.startDate,
      targetEndDate: record.targetEndDate,
      progressPercent: decimalToString(record.progressPercent),
      metadata: asRecord(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }
}