import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import { decimalToAmountString } from '../../domain/types/amounts.js';
import type {
  CreateJournalEntryData,
  JournalEntryRecord,
  JournalEntryRepository,
  JournalEntryStatus,
  JournalLineRecord,
  ListJournalEntriesFilter,
} from '../../domain/repositories/journal-entry.repository.js';
import { asRecord, buildDescendingCursorFilter, toJsonValue } from './prisma-cursor.js';

export class PrismaJournalEntryRepository implements JournalEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<JournalEntryRecord | null> {
    const record = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        lines: {
          where: { deletedAt: null },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findByEntryNumber(
    organizationId: OrganizationId,
    entryNumber: string,
  ): Promise<JournalEntryRecord | null> {
    const record = await this.prisma.journalEntry.findFirst({
      where: { organizationId, entryNumber, deletedAt: null },
      include: {
        lines: {
          where: { deletedAt: null },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateJournalEntryData): Promise<JournalEntryRecord> {
    const totalDebit = data.lines.reduce(
      (sum, line) => sum.plus(new Prisma.Decimal(line.debitAmount)),
      new Prisma.Decimal(0),
    );
    const totalCredit = data.lines.reduce(
      (sum, line) => sum.plus(new Prisma.Decimal(line.creditAmount)),
      new Prisma.Decimal(0),
    );

    const record = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: data.organizationId,
          entryNumber: data.entryNumber,
          entryDate: data.entryDate,
          description: data.description,
          totalDebit,
          totalCredit,
          ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
          ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
          ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
        },
      });

      await tx.journalLine.createMany({
        data: data.lines.map((line) => ({
          organizationId: data.organizationId,
          journalEntryId: entry.id,
          accountId: line.accountId,
          lineNumber: line.lineNumber,
          debitAmount: new Prisma.Decimal(line.debitAmount),
          creditAmount: new Prisma.Decimal(line.creditAmount),
          ...(line.description !== undefined ? { description: line.description } : {}),
          ...(line.metadata !== undefined ? { metadata: toJsonValue(line.metadata) } : {}),
        })),
      });

      return tx.journalEntry.findFirstOrThrow({
        where: { id: entry.id },
        include: {
          lines: {
            where: { deletedAt: null },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });
    });

    return this.toRecord(record);
  }

  async post(
    organizationId: OrganizationId,
    id: string,
    postedBy: UserId,
    postedAt: Date,
  ): Promise<JournalEntryRecord | null> {
    try {
      const record = await this.prisma.journalEntry.update({
        where: {
          id,
          organizationId,
          deletedAt: null,
          status: 'draft',
        },
        data: {
          status: 'posted',
          postedBy,
          postedAt,
          version: { increment: 1 },
        },
        include: {
          lines: {
            where: { deletedAt: null },
            orderBy: { lineNumber: 'asc' },
          },
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

  async list(filter: ListJournalEntriesFilter): Promise<JournalEntryRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.journalEntry.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.fromDate !== undefined ? { entryDate: { gte: filter.fromDate } } : {}),
        ...(filter.toDate !== undefined ? { entryDate: { lte: filter.toDate } } : {}),
        ...cursorFilter,
      },
      include: {
        lines: {
          where: { deletedAt: null },
          orderBy: { lineNumber: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });

    return records.map((record) => this.toRecord(record));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    return this.prisma.journalEntry.count({
      where: { organizationId, deletedAt: null },
    });
  }

  private async buildCursorFilter(
    organizationId: OrganizationId,
    cursor?: string,
  ): Promise<Prisma.JournalEntryWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.journalEntry.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    entryNumber: string;
    entryDate: Date;
    status: string;
    description: string;
    currencyCode: string;
    totalDebit: Prisma.Decimal;
    totalCredit: Prisma.Decimal;
    postedBy: string | null;
    postedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
    lines: Array<{
      id: string;
      organizationId: string;
      journalEntryId: string;
      accountId: string;
      lineNumber: number;
      description: string | null;
      debitAmount: Prisma.Decimal;
      creditAmount: Prisma.Decimal;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      version: number;
    }>;
  }): JournalEntryRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      entryNumber: record.entryNumber,
      entryDate: record.entryDate,
      status: record.status as JournalEntryStatus,
      description: record.description,
      currencyCode: record.currencyCode,
      totalDebit: decimalToAmountString(record.totalDebit),
      totalCredit: decimalToAmountString(record.totalCredit),
      postedBy: record.postedBy,
      postedAt: record.postedAt,
      metadata: asRecord(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
      lines: record.lines.map((line) => this.toLineRecord(line)),
    };
  }

  private toLineRecord(line: {
    id: string;
    organizationId: string;
    journalEntryId: string;
    accountId: string;
    lineNumber: number;
    description: string | null;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    version: number;
  }): JournalLineRecord {
    return {
      id: line.id,
      organizationId: line.organizationId as OrganizationId,
      journalEntryId: line.journalEntryId,
      accountId: line.accountId,
      lineNumber: line.lineNumber,
      description: line.description,
      debitAmount: decimalToAmountString(line.debitAmount),
      creditAmount: decimalToAmountString(line.creditAmount),
      metadata: asRecord(line.metadata),
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
      deletedAt: line.deletedAt,
      version: line.version,
    };
  }
}