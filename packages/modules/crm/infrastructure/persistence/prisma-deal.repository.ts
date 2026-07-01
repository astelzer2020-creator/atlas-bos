import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateDealData,
  DealRecord,
  DealRepository,
  DealStatus,
  ListDealsFilter,
  UpdateDealData,
} from '../../domain/repositories/deal.repository.js';
import { asRecord, buildDescendingCursorFilter, decimalToString, toJsonValue } from './prisma-cursor.js';

export class PrismaDealRepository implements DealRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<DealRecord | null> {
    const record = await this.prisma.deal.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateDealData): Promise<DealRecord> {
    const record = await this.prisma.deal.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        pipelineStageId: data.pipelineStageId,
        ownerId: data.ownerId,
        ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
        ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
        ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
        ...(data.probability !== undefined ? { probability: data.probability } : {}),
        ...(data.expectedCloseDate !== undefined
          ? { expectedCloseDate: data.expectedCloseDate }
          : {}),
        ...(data.leadSource !== undefined ? { leadSource: data.leadSource } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateDealData,
    expectedVersion: number,
  ): Promise<DealRecord | null> {
    try {
      const record = await this.prisma.deal.update({
        where: { id, organizationId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
          ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
          ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
          ...(data.pipelineStageId !== undefined ? { pipelineStageId: data.pipelineStageId } : {}),
          ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
          ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
          ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
          ...(data.probability !== undefined ? { probability: data.probability } : {}),
          ...(data.expectedCloseDate !== undefined
            ? { expectedCloseDate: data.expectedCloseDate }
            : {}),
          ...(data.actualCloseDate !== undefined ? { actualCloseDate: data.actualCloseDate } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.lossReason !== undefined ? { lossReason: data.lossReason } : {}),
          ...(data.leadSource !== undefined ? { leadSource: data.leadSource } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
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

  async list(filter: ListDealsFilter): Promise<DealRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.deal.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.pipelineStageId !== undefined
          ? { pipelineStageId: filter.pipelineStageId }
          : {}),
        ...(filter.ownerId !== undefined ? { ownerId: filter.ownerId } : {}),
        ...(filter.accountId !== undefined ? { accountId: filter.accountId } : {}),
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
  ): Promise<Prisma.DealWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.deal.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    externalId: string | null;
    name: string;
    accountId: string | null;
    contactId: string | null;
    pipelineStageId: string;
    ownerId: string;
    amount: Prisma.Decimal;
    currencyCode: string;
    probability: number;
    expectedCloseDate: Date | null;
    actualCloseDate: Date | null;
    status: string;
    lossReason: string | null;
    leadSource: string | null;
    description: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): DealRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      externalId: record.externalId,
      name: record.name,
      accountId: record.accountId,
      contactId: record.contactId,
      pipelineStageId: record.pipelineStageId,
      ownerId: record.ownerId,
      amount: decimalToString(record.amount) ?? '0',
      currencyCode: record.currencyCode,
      probability: record.probability,
      expectedCloseDate: record.expectedCloseDate,
      actualCloseDate: record.actualCloseDate,
      status: record.status as DealStatus,
      lossReason: record.lossReason,
      leadSource: record.leadSource,
      description: record.description,
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