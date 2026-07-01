import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type DealStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface DealRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly externalId: string | null;
  readonly name: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly pipelineStageId: string;
  readonly ownerId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly probability: number;
  readonly expectedCloseDate: Date | null;
  readonly actualCloseDate: Date | null;
  readonly status: DealStatus;
  readonly lossReason: string | null;
  readonly leadSource: string | null;
  readonly description: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateDealData {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly pipelineStageId: string;
  readonly ownerId: string;
  readonly externalId?: string;
  readonly accountId?: string;
  readonly contactId?: string;
  readonly amount?: string;
  readonly currencyCode?: string;
  readonly probability?: number;
  readonly expectedCloseDate?: Date;
  readonly leadSource?: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateDealData {
  readonly name?: string;
  readonly externalId?: string | null;
  readonly accountId?: string | null;
  readonly contactId?: string | null;
  readonly pipelineStageId?: string;
  readonly ownerId?: string;
  readonly amount?: string;
  readonly currencyCode?: string;
  readonly probability?: number;
  readonly expectedCloseDate?: Date | null;
  readonly actualCloseDate?: Date | null;
  readonly status?: DealStatus;
  readonly lossReason?: string | null;
  readonly leadSource?: string | null;
  readonly description?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListDealsFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: DealStatus;
  readonly pipelineStageId?: string;
  readonly ownerId?: string;
  readonly accountId?: string;
}

export interface DealRepository {
  findById(organizationId: OrganizationId, id: string): Promise<DealRecord | null>;
  create(data: CreateDealData): Promise<DealRecord>;
  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateDealData,
    expectedVersion: number,
  ): Promise<DealRecord | null>;
  list(filter: ListDealsFilter): Promise<DealRecord[]>;
}