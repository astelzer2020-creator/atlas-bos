import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { Address } from '../types/address.js';

export type CrmAccountType =
  | 'prospect'
  | 'customer'
  | 'partner'
  | 'vendor'
  | 'competitor'
  | 'other';

export type CrmAccountStatus = 'active' | 'inactive' | 'archived';

export interface CrmAccountRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly externalId: string | null;
  readonly name: string;
  readonly legalName: string | null;
  readonly accountType: CrmAccountType;
  readonly industry: string | null;
  readonly website: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly billingAddress: Address;
  readonly shippingAddress: Address;
  readonly annualRevenue: string | null;
  readonly employeeCount: number | null;
  readonly currencyCode: string;
  readonly parentAccountId: string | null;
  readonly ownerId: string | null;
  readonly status: CrmAccountStatus;
  readonly description: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateCrmAccountData {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly externalId?: string;
  readonly legalName?: string;
  readonly accountType?: CrmAccountType;
  readonly industry?: string;
  readonly website?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly billingAddress?: Address;
  readonly shippingAddress?: Address;
  readonly annualRevenue?: string;
  readonly employeeCount?: number;
  readonly currencyCode?: string;
  readonly parentAccountId?: string;
  readonly ownerId?: string;
  readonly status?: CrmAccountStatus;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateCrmAccountData {
  readonly name?: string;
  readonly externalId?: string | null;
  readonly legalName?: string | null;
  readonly accountType?: CrmAccountType;
  readonly industry?: string | null;
  readonly website?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly billingAddress?: Address;
  readonly shippingAddress?: Address;
  readonly annualRevenue?: string | null;
  readonly employeeCount?: number | null;
  readonly currencyCode?: string;
  readonly parentAccountId?: string | null;
  readonly ownerId?: string | null;
  readonly status?: CrmAccountStatus;
  readonly description?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListCrmAccountsFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly accountType?: CrmAccountType;
  readonly status?: CrmAccountStatus;
  readonly ownerId?: string;
}

export interface CrmAccountRepository {
  findById(organizationId: OrganizationId, id: string): Promise<CrmAccountRecord | null>;
  create(data: CreateCrmAccountData): Promise<CrmAccountRecord>;
  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateCrmAccountData,
    expectedVersion: number,
  ): Promise<CrmAccountRecord | null>;
  list(filter: ListCrmAccountsFilter): Promise<CrmAccountRecord[]>;
}