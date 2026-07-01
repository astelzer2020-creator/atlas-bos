import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreatePipelineStageData,
  ListPipelineStagesFilter,
  PipelineStageRecord,
  PipelineStageRepository,
  UpdatePipelineStageData,
} from '../../domain/repositories/pipeline-stage.repository.js';
import { asRecord, buildDescendingCursorFilter, toJsonValue } from './prisma-cursor.js';

export class PrismaPipelineStageRepository implements PipelineStageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<PipelineStageRecord | null> {
    const record = await this.prisma.pipelineStage.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async countByOrganization(organizationId: OrganizationId, pipelineId?: string): Promise<number> {
    return this.prisma.pipelineStage.count({
      where: {
        organizationId,
        deletedAt: null,
        ...(pipelineId !== undefined ? { pipelineId } : {}),
      },
    });
  }

  async create(data: CreatePipelineStageData): Promise<PipelineStageRecord> {
    const record = await this.prisma.pipelineStage.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        sortOrder: data.sortOrder,
        ...(data.pipelineId !== undefined ? { pipelineId: data.pipelineId } : {}),
        ...(data.pipelineName !== undefined ? { pipelineName: data.pipelineName } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.probability !== undefined ? { probability: data.probability } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.isWon !== undefined ? { isWon: data.isWon } : {}),
        ...(data.isLost !== undefined ? { isLost: data.isLost } : {}),
        ...(data.isClosed !== undefined ? { isClosed: data.isClosed } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdatePipelineStageData,
    expectedVersion: number,
  ): Promise<PipelineStageRecord | null> {
    try {
      const record = await this.prisma.pipelineStage.update({
        where: { id, organizationId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.pipelineName !== undefined ? { pipelineName: data.pipelineName } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          ...(data.probability !== undefined ? { probability: data.probability } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
          ...(data.isWon !== undefined ? { isWon: data.isWon } : {}),
          ...(data.isLost !== undefined ? { isLost: data.isLost } : {}),
          ...(data.isClosed !== undefined ? { isClosed: data.isClosed } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
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

  async list(filter: ListPipelineStagesFilter): Promise<PipelineStageRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.pipelineStage.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.pipelineId !== undefined ? { pipelineId: filter.pipelineId } : {}),
        ...cursorFilter,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.PipelineStageWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.pipelineStage.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    pipelineId: string;
    pipelineName: string;
    name: string;
    description: string | null;
    sortOrder: number;
    probability: number;
    isDefault: boolean;
    isWon: boolean;
    isLost: boolean;
    isClosed: boolean;
    color: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): PipelineStageRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      pipelineId: record.pipelineId,
      pipelineName: record.pipelineName,
      name: record.name,
      description: record.description,
      sortOrder: record.sortOrder,
      probability: record.probability,
      isDefault: record.isDefault,
      isWon: record.isWon,
      isLost: record.isLost,
      isClosed: record.isClosed,
      color: record.color,
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