import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface ChartOfAccountRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly parentAccountId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly accountType: LedgerAccountType;
  readonly normalBalance: NormalBalance;
  readonly isActive: boolean;
  readonly isSystem: boolean;
  readonly currencyCode: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateChartOfAccountData {
  readonly organizationId: OrganizationId;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly accountType: LedgerAccountType;
  readonly normalBalance: NormalBalance;
  readonly parentAccountId?: string;
  readonly isActive?: boolean;
  readonly isSystem?: boolean;
  readonly currencyCode?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateChartOfAccountData {
  readonly name?: string;
  readonly description?: string | null;
  readonly accountType?: LedgerAccountType;
  readonly normalBalance?: NormalBalance;
  readonly parentAccountId?: string | null;
  readonly isActive?: boolean;
  readonly currencyCode?: string;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListChartOfAccountsFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly accountType?: LedgerAccountType;
  readonly isActive?: boolean;
  readonly parentAccountId?: string;
}

export interface ChartOfAccountRepository {
  findById(organizationId: OrganizationId, id: string): Promise<ChartOfAccountRecord | null>;
  findByCode(organizationId: OrganizationId, code: string): Promise<ChartOfAccountRecord | null>;
  create(data: CreateChartOfAccountData): Promise<ChartOfAccountRecord>;
  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateChartOfAccountData,
    expectedVersion: number,
  ): Promise<ChartOfAccountRecord | null>;
  list(filter: ListChartOfAccountsFilter): Promise<ChartOfAccountRecord[]>;
}