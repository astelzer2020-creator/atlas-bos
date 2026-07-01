import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { Address } from '../types/address.js';

export type CrmContactStatus = 'active' | 'inactive' | 'bounced' | 'unsubscribed';

export interface CrmContactRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly externalId: string | null;
  readonly accountId: string | null;
  readonly salutation: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly jobTitle: string | null;
  readonly department: string | null;
  readonly mailingAddress: Address;
  readonly isPrimary: boolean;
  readonly ownerId: string | null;
  readonly leadSource: string | null;
  readonly status: CrmContactStatus;
  readonly lastContactedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number;
}

export interface CreateCrmContactData {
  readonly organizationId: OrganizationId;
  readonly displayName: string;
  readonly externalId?: string;
  readonly accountId?: string;
  readonly salutation?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly mobile?: string;
  readonly jobTitle?: string;
  readonly department?: string;
  readonly mailingAddress?: Address;
  readonly isPrimary?: boolean;
  readonly ownerId?: string;
  readonly leadSource?: string;
  readonly status?: CrmContactStatus;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateCrmContactData {
  readonly displayName?: string;
  readonly externalId?: string | null;
  readonly accountId?: string | null;
  readonly salutation?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly mobile?: string | null;
  readonly jobTitle?: string | null;
  readonly department?: string | null;
  readonly mailingAddress?: Address;
  readonly isPrimary?: boolean;
  readonly ownerId?: string | null;
  readonly leadSource?: string | null;
  readonly status?: CrmContactStatus;
  readonly lastContactedAt?: Date | null;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListCrmContactsFilter {
  readonly organizationId: OrganizationId;
  readonly limit: number;
  readonly cursor?: string;
  readonly accountId?: string;
  readonly status?: CrmContactStatus;
  readonly ownerId?: string;
}

export interface CrmContactRepository {
  findById(organizationId: OrganizationId, id: string): Promise<CrmContactRecord | null>;
  create(data: CreateCrmContactData): Promise<CrmContactRecord>;
  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateCrmContactData,
    expectedVersion: number,
  ): Promise<CrmContactRecord | null>;
  list(filter: ListCrmContactsFilter): Promise<CrmContactRecord[]>;
}