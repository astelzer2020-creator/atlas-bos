import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type { ProjectPriority } from '../../domain/repositories/project.repository.js';
import type {
  CreateProjectTaskData,
  ListProjectTasksFilter,
  ProjectTaskRecord,
  ProjectTaskRepository,
  TaskStatus,
  UpdateProjectTaskData,
} from '../../domain/repositories/task.repository.js';
import { asRecord, buildDescendingCursorFilter, toJsonValue } from './prisma-cursor.js';

export class PrismaProjectTaskRepository implements ProjectTaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    organizationId: OrganizationId,
    projectId: string,
    id: string,
  ): Promise<ProjectTaskRecord | null> {
    const record = await this.prisma.projectTask.findFirst({
      where: { id, organizationId, projectId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateProjectTaskData): Promise<ProjectTaskRecord> {
    const record = await this.prisma.projectTask.create({
      data: {
        organizationId: data.organizationId,
        projectId: data.projectId,
        title: data.title,
        ...(data.parentTaskId !== undefined ? { parentTaskId: data.parentTaskId } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    projectId: string,
    id: string,
    data: UpdateProjectTaskData,
    expectedVersion: number,
  ): Promise<ProjectTaskRecord | null> {
    try {
      const record = await this.prisma.projectTask.update({
        where: { id, organizationId, projectId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.parentTaskId !== undefined ? { parentTaskId: data.parentTaskId } : {}),
          ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
          ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
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

  async list(filter: ListProjectTasksFilter): Promise<ProjectTaskRecord[]> {
    const cursorFilter = await this.buildCursorFilter(
      filter.organizationId,
      filter.projectId,
      filter.cursor,
    );

    const records = await this.prisma.projectTask.findMany({
      where: {
        organizationId: filter.organizationId,
        projectId: filter.projectId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.assigneeId !== undefined ? { assigneeId: filter.assigneeId } : {}),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    projectId: string,
    cursor?: string,
  ): Promise<Prisma.ProjectTaskWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.projectTask.findFirst({
      where: { id: cursor, organizationId, projectId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    projectId: string;
    parentTaskId: string | null;
    assigneeId: string | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: Date | null;
    completedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): ProjectTaskRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      projectId: record.projectId,
      parentTaskId: record.parentTaskId,
      assigneeId: record.assigneeId,
      title: record.title,
      description: record.description,
      status: record.status as TaskStatus,
      priority: record.priority as ProjectPriority,
      dueDate: record.dueDate,
      completedAt: record.completedAt,
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