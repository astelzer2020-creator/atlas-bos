import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';

export interface JournalLineRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly journalEntryId: string;
  readonly accountId: string;
  readonly lineNumber: number;
  readonly description: string | null;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly version: number;
}

export interface JournalEntryRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly entryNumber: string;
  readonly entryDate: Date;
  readonly status: JournalEntryStatus;
  readonly description: string;
  readonly currencyCode: string;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly postedBy: string | null;
  readonly postedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
  readonly lines: readonly JournalLineRecord[];
}

export interface CreateJournalLineData {
  readonly lineNumber: number;
  readonly accountId: string;
  readonly description?: string;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateJournalEntryData {
  readonly organizationId: OrganizationId;
  readonly entryNumber: string;
  readonly entryDate: Date;
  readonly description: string;
  readonly currencyCode?: string;
  readonly metadata?: Record<string, unknown>;
  readonly lines: readonly CreateJournalLineData[];
  readonly createdBy?: UserId;
}

export interface ListJournalEntriesFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: JournalEntryStatus;
  readonly fromDate?: Date;
  readonly toDate?: Date;
}

export interface JournalEntryRepository {
  findById(organizationId: OrganizationId, id: string): Promise<JournalEntryRecord | null>;
  findByEntryNumber(
    organizationId: OrganizationId,
    entryNumber: string,
  ): Promise<JournalEntryRecord | null>;
  create(data: CreateJournalEntryData): Promise<JournalEntryRecord>;
  post(
    organizationId: OrganizationId,
    id: string,
    postedBy: UserId,
    postedAt: Date,
  ): Promise<JournalEntryRecord | null>;
  list(filter: ListJournalEntriesFilter): Promise<JournalEntryRecord[]>;
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}