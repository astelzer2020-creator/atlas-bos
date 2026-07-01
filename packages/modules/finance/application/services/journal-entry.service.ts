import { Prisma } from '@atlas/database';
import {
  ConflictError,
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  ChartOfAccountRepository,
} from '../../domain/repositories/chart-of-account.repository.js';
import type {
  CreateJournalEntryData,
  CreateJournalLineData,
  JournalEntryRecord,
  JournalEntryRepository,
  ListJournalEntriesFilter,
} from '../../domain/repositories/journal-entry.repository.js';
import { isZeroAmount, parseMonetaryAmount } from '../../domain/types/amounts.js';
import { resolveListLimit, type CursorPageResult } from '../../domain/types/pagination.js';

export type JournalEntryType = 'standard' | 'adjusting' | 'closing' | 'reversing' | 'system';

export interface JournalLineDto {
  readonly id: string;
  readonly lineNumber: number;
  readonly accountId: string;
  readonly description: string | null;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly currencyCode: string;
  readonly taxRateId: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface JournalEntryDto {
  readonly id: string;
  readonly organizationId: string;
  readonly entryNumber: string;
  readonly entryDate: string;
  readonly postingDate: string | null;
  readonly status: 'draft' | 'posted' | 'reversed';
  readonly entryType: JournalEntryType;
  readonly description: string;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly currencyCode: string;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly reversedEntryId: string | null;
  readonly postedBy: string | null;
  readonly postedAt: string | null;
  readonly lines: readonly JournalLineDto[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateJournalLineInput {
  readonly lineNumber?: number;
  readonly accountId: string;
  readonly description?: string;
  readonly debitAmount?: string;
  readonly creditAmount?: string;
  readonly currencyCode?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateJournalEntryInput {
  readonly entryNumber?: string;
  readonly entryDate?: string;
  readonly entryType?: JournalEntryType;
  readonly description: string;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly currencyCode?: string;
  readonly lines: readonly CreateJournalLineInput[];
  readonly metadata?: Record<string, unknown>;
}

export interface ListJournalEntriesInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: 'draft' | 'posted' | 'reversed';
  readonly entryType?: JournalEntryType;
  readonly fromDate?: string;
  readonly toDate?: string;
}

export interface JournalEntryServiceDeps {
  readonly journalEntryRepository: JournalEntryRepository;
  readonly chartOfAccountRepository: ChartOfAccountRepository;
}

export class JournalEntryService {
  constructor(private readonly deps: JournalEntryServiceDeps) {}

  async createEntry(
    organizationId: OrganizationId,
    input: CreateJournalEntryInput,
    actorId?: UserId,
  ): Promise<Result<JournalEntryDto, ValidationError | ConflictError>> {
    const description = input.description.trim();
    if (description.length === 0) {
      return err(new ValidationError('Journal entry description is required', { field: 'description' }));
    }

    if (input.lines.length < 2) {
      return err(
        new ValidationError('Journal entry must contain at least two lines', { field: 'lines' }),
      );
    }

    const linesResult = await this.normalizeAndValidateLines(organizationId, input.lines);
    if (!linesResult.ok) {
      return linesResult;
    }

    const entryNumber =
      input.entryNumber?.trim() ||
      (await this.generateEntryNumber(organizationId));

    const existing = await this.deps.journalEntryRepository.findByEntryNumber(
      organizationId,
      entryNumber,
    );
    if (existing !== null) {
      return err(
        new ConflictError('Journal entry number already exists', {
          details: { entryNumber },
        }),
      );
    }

    let resolvedEntryDate: Date;
    if (input.entryDate !== undefined) {
      const parsedEntryDate = this.parseDate(input.entryDate, 'entryDate');
      if (!parsedEntryDate.ok) {
        return parsedEntryDate;
      }
      resolvedEntryDate = parsedEntryDate.value;
    } else {
      resolvedEntryDate = new Date();
    }

    const metadata = this.mergeEntryMetadata(input);

    const createData: CreateJournalEntryData = {
      organizationId,
      entryNumber,
      entryDate: resolvedEntryDate,
      description,
      lines: linesResult.value,
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(actorId !== undefined ? { createdBy: actorId } : {}),
    };

    try {
      const entry = await this.deps.journalEntryRepository.create(createData);
      return ok(this.toDto(entry, input.entryType ?? 'standard'));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return err(
          new ConflictError('Journal entry number already exists', {
            details: { entryNumber },
          }),
        );
      }
      throw error;
    }
  }

  async getEntry(
    organizationId: OrganizationId,
    entryId: string,
  ): Promise<Result<JournalEntryDto, NotFoundError>> {
    const entry = await this.deps.journalEntryRepository.findById(organizationId, entryId);
    if (entry === null) {
      return err(new NotFoundError('JournalEntry', entryId));
    }

    return ok(this.toDto(entry, this.readEntryType(entry)));
  }

  async listEntries(
    organizationId: OrganizationId,
    input: ListJournalEntriesInput = {},
  ): Promise<CursorPageResult<JournalEntryDto>> {
    const limit = resolveListLimit(input.limit);

    let fromDate: Date | undefined;
    if (input.fromDate !== undefined) {
      const parsed = this.parseDate(input.fromDate, 'fromDate');
      if (!parsed.ok) {
        return { data: [], nextCursor: null };
      }
      fromDate = parsed.value;
    }

    let toDate: Date | undefined;
    if (input.toDate !== undefined) {
      const parsed = this.parseDate(input.toDate, 'toDate');
      if (!parsed.ok) {
        return { data: [], nextCursor: null };
      }
      toDate = parsed.value;
    }

    const entries = await this.deps.journalEntryRepository.list({
      organizationId,
      limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(fromDate !== undefined ? { fromDate } : {}),
      ...(toDate !== undefined ? { toDate } : {}),
    } satisfies ListJournalEntriesFilter);

    const filtered = input.entryType
      ? entries.filter((entry) => this.readEntryType(entry) === input.entryType)
      : entries;

    return {
      data: filtered.map((entry) => this.toDto(entry, this.readEntryType(entry))),
      nextCursor: entries.length === limit ? (entries.at(-1)?.id ?? null) : null,
    };
  }

  async postEntry(
    organizationId: OrganizationId,
    entryId: string,
    actorId: UserId,
  ): Promise<Result<JournalEntryDto, NotFoundError | ConflictError>> {
    const existing = await this.deps.journalEntryRepository.findById(organizationId, entryId);
    if (existing === null) {
      return err(new NotFoundError('JournalEntry', entryId));
    }

    if (existing.status !== 'draft') {
      return err(
        new ConflictError('Only draft journal entries can be posted', {
          details: { status: existing.status },
        }),
      );
    }

    const posted = await this.deps.journalEntryRepository.post(
      organizationId,
      entryId,
      actorId,
      new Date(),
    );

    if (posted === null) {
      return err(
        new ConflictError('Journal entry could not be posted', {
          details: { id: entryId },
        }),
      );
    }

    return ok(this.toDto(posted, this.readEntryType(posted)));
  }

  toDto(record: JournalEntryRecord, entryType: JournalEntryType): JournalEntryDto {
    const referenceType =
      typeof record.metadata.referenceType === 'string' ? record.metadata.referenceType : null;
    const referenceId =
      typeof record.metadata.referenceId === 'string' ? record.metadata.referenceId : null;
    const reversedEntryId =
      typeof record.metadata.reversedEntryId === 'string'
        ? record.metadata.reversedEntryId
        : null;

    return {
      id: record.id,
      organizationId: record.organizationId,
      entryNumber: record.entryNumber,
      entryDate: this.formatDate(record.entryDate),
      postingDate: record.postedAt ? this.formatDate(record.postedAt) : null,
      status: record.status,
      entryType,
      description: record.description,
      referenceType,
      referenceId,
      currencyCode: record.currencyCode,
      totalDebit: record.totalDebit,
      totalCredit: record.totalCredit,
      reversedEntryId,
      postedBy: record.postedBy,
      postedAt: record.postedAt?.toISOString() ?? null,
      lines: record.lines.map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        description: line.description,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        currencyCode: record.currencyCode,
        taxRateId: null,
        metadata: line.metadata,
      })),
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
    };
  }

  private async normalizeAndValidateLines(
    organizationId: OrganizationId,
    lines: readonly CreateJournalLineInput[],
  ): Promise<Result<readonly CreateJournalLineData[], ValidationError>> {
    const normalized: CreateJournalLineData[] = [];
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const debitRaw = line.debitAmount ?? '0';
      const creditRaw = line.creditAmount ?? '0';

      const debitResult = parseMonetaryAmount(debitRaw, `lines[${index}].debitAmount`);
      if (!debitResult.ok) {
        return err(new ValidationError(debitResult.message, { field: debitResult.field }));
      }

      const creditResult = parseMonetaryAmount(creditRaw, `lines[${index}].creditAmount`);
      if (!creditResult.ok) {
        return err(new ValidationError(creditResult.message, { field: creditResult.field }));
      }

      const hasDebit = !isZeroAmount(debitResult.amount);
      const hasCredit = !isZeroAmount(creditResult.amount);

      if (hasDebit === hasCredit) {
        return err(
          new ValidationError('Each journal line must have either a debit or a credit amount', {
            field: `lines[${index}]`,
          }),
        );
      }

      const account = await this.deps.chartOfAccountRepository.findById(
        organizationId,
        line.accountId,
      );
      if (account === null) {
        return err(
          new ValidationError('Journal line account not found in organization', {
            field: `lines[${index}].accountId`,
          }),
        );
      }

      if (!account.isActive) {
        return err(
          new ValidationError('Journal line account is inactive', {
            field: `lines[${index}].accountId`,
          }),
        );
      }

      totalDebit = totalDebit.plus(debitResult.amount);
      totalCredit = totalCredit.plus(creditResult.amount);

      normalized.push({
        lineNumber: line.lineNumber ?? index + 1,
        accountId: line.accountId,
        debitAmount: debitResult.amount.toString(),
        creditAmount: creditResult.amount.toString(),
        ...(line.description !== undefined ? { description: line.description } : {}),
        ...(line.metadata !== undefined ? { metadata: line.metadata } : {}),
      });
    }

    if (!totalDebit.equals(totalCredit)) {
      return err(
        new ValidationError('Journal entry debits must equal credits', {
          field: 'lines',
          details: {
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
          },
        }),
      );
    }

    if (isZeroAmount(totalDebit)) {
      return err(
        new ValidationError('Journal entry must have non-zero amounts', { field: 'lines' }),
      );
    }

    return ok(normalized);
  }

  private async generateEntryNumber(organizationId: OrganizationId): Promise<string> {
    const count = await this.deps.journalEntryRepository.countByOrganization(organizationId);
    return `JE-${String(count + 1).padStart(6, '0')}`;
  }

  private mergeEntryMetadata(input: CreateJournalEntryInput): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
    };

    if (input.entryType !== undefined) {
      metadata.entryType = input.entryType;
    }

    if (input.referenceType !== undefined) {
      metadata.referenceType = input.referenceType;
    }

    if (input.referenceId !== undefined) {
      metadata.referenceId = input.referenceId;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private readEntryType(record: JournalEntryRecord): JournalEntryType {
    const value = record.metadata.entryType;
    if (
      value === 'standard' ||
      value === 'adjusting' ||
      value === 'closing' ||
      value === 'reversing' ||
      value === 'system'
    ) {
      return value;
    }

    return 'standard';
  }

  private parseDate(
    value: string,
    field: string,
  ): Result<Date, ValidationError> {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return err(new ValidationError('Invalid date format', { field }));
    }

    return ok(parsed);
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}