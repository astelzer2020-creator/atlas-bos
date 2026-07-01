import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  ChartOfAccountRecord,
  ChartOfAccountRepository,
  CreateChartOfAccountData,
  LedgerAccountType,
  ListChartOfAccountsFilter,
  NormalBalance,
  UpdateChartOfAccountData,
} from '../../domain/repositories/chart-of-account.repository.js';
import { asRecord, buildDescendingCursorFilter, toJsonValue } from './prisma-cursor.js';

export class PrismaChartOfAccountRepository implements ChartOfAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<ChartOfAccountRecord | null> {
    const record = await this.prisma.chartOfAccount.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findByCode(
    organizationId: OrganizationId,
    code: string,
  ): Promise<ChartOfAccountRecord | null> {
    const record = await this.prisma.chartOfAccount.findFirst({
      where: { organizationId, code, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateChartOfAccountData): Promise<ChartOfAccountRecord> {
    const record = await this.prisma.chartOfAccount.create({
      data: {
        organizationId: data.organizationId,
        code: data.code,
        name: data.name,
        accountType: data.accountType,
        normalBalance: data.normalBalance,
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.parentAccountId !== undefined ? { parentAccountId: data.parentAccountId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.isSystem !== undefined ? { isSystem: data.isSystem } : {}),
        ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateChartOfAccountData,
    expectedVersion: number,
  ): Promise<ChartOfAccountRecord | null> {
    try {
      const record = await this.prisma.chartOfAccount.update({
        where: { id, organizationId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.accountType !== undefined ? { accountType: data.accountType } : {}),
          ...(data.normalBalance !== undefined ? { normalBalance: data.normalBalance } : {}),
          ...(data.parentAccountId !== undefined ? { parentAccountId: data.parentAccountId } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
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

  async list(filter: ListChartOfAccountsFilter): Promise<ChartOfAccountRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.accountType !== undefined ? { accountType: filter.accountType } : {}),
        ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
        ...(filter.parentAccountId !== undefined
          ? { parentAccountId: filter.parentAccountId }
          : {}),
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
  ): Promise<Prisma.ChartOfAccountWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.chartOfAccount.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    parentAccountId: string | null;
    code: string;
    name: string;
    description: string | null;
    accountType: string;
    normalBalance: string;
    isActive: boolean;
    isSystem: boolean;
    currencyCode: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): ChartOfAccountRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      parentAccountId: record.parentAccountId,
      code: record.code,
      name: record.name,
      description: record.description,
      accountType: record.accountType as LedgerAccountType,
      normalBalance: record.normalBalance as NormalBalance,
      isActive: record.isActive,
      isSystem: record.isSystem,
      currencyCode: record.currencyCode,
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