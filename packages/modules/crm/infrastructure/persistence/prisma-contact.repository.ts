import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateCrmContactData,
  CrmContactRecord,
  CrmContactRepository,
  CrmContactStatus,
  ListCrmContactsFilter,
  UpdateCrmContactData,
} from '../../domain/repositories/contact.repository.js';
import { asAddress } from '../../domain/types/address.js';
import { asRecord, buildDescendingCursorFilter, toJsonValue } from './prisma-cursor.js';

export class PrismaCrmContactRepository implements CrmContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<CrmContactRecord | null> {
    const record = await this.prisma.crmContact.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateCrmContactData): Promise<CrmContactRecord> {
    const record = await this.prisma.crmContact.create({
      data: {
        organizationId: data.organizationId,
        displayName: data.displayName,
        ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
        ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
        ...(data.salutation !== undefined ? { salutation: data.salutation } : {}),
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.mobile !== undefined ? { mobile: data.mobile } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
        ...(data.department !== undefined ? { department: data.department } : {}),
        ...(data.mailingAddress !== undefined
          ? { mailingAddress: toJsonValue(data.mailingAddress) }
          : {}),
        ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.leadSource !== undefined ? { leadSource: data.leadSource } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toRecord(record);
  }

  async update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateCrmContactData,
    expectedVersion: number,
  ): Promise<CrmContactRecord | null> {
    try {
      const record = await this.prisma.crmContact.update({
        where: { id, organizationId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
          ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
          ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
          ...(data.salutation !== undefined ? { salutation: data.salutation } : {}),
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.mobile !== undefined ? { mobile: data.mobile } : {}),
          ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
          ...(data.department !== undefined ? { department: data.department } : {}),
          ...(data.mailingAddress !== undefined
            ? { mailingAddress: toJsonValue(data.mailingAddress) }
            : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
          ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
          ...(data.leadSource !== undefined ? { leadSource: data.leadSource } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.lastContactedAt !== undefined
            ? { lastContactedAt: data.lastContactedAt }
            : {}),
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

  async list(filter: ListCrmContactsFilter): Promise<CrmContactRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.crmContact.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.accountId !== undefined ? { accountId: filter.accountId } : {}),
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.ownerId !== undefined ? { ownerId: filter.ownerId } : {}),
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
  ): Promise<Prisma.CrmContactWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.crmContact.findFirst({
      where: { id: cursor, organizationId, deletedAt: null },
      select: { createdAt: true, id: true },
    });

    return buildDescendingCursorFilter(anchor);
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    externalId: string | null;
    accountId: string | null;
    salutation: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    jobTitle: string | null;
    department: string | null;
    mailingAddress: unknown;
    isPrimary: boolean;
    ownerId: string | null;
    leadSource: string | null;
    status: string;
    lastContactedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): CrmContactRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      externalId: record.externalId,
      accountId: record.accountId,
      salutation: record.salutation,
      firstName: record.firstName,
      lastName: record.lastName,
      displayName: record.displayName,
      email: record.email,
      phone: record.phone,
      mobile: record.mobile,
      jobTitle: record.jobTitle,
      department: record.department,
      mailingAddress: asAddress(record.mailingAddress),
      isPrimary: record.isPrimary,
      ownerId: record.ownerId,
      leadSource: record.leadSource,
      status: record.status as CrmContactStatus,
      lastContactedAt: record.lastContactedAt,
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