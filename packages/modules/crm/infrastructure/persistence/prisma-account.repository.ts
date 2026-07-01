import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  CreateCrmAccountData,
  CrmAccountRecord,
  CrmAccountRepository,
  CrmAccountStatus,
  CrmAccountType,
  ListCrmAccountsFilter,
  UpdateCrmAccountData,
} from '../../domain/repositories/account.repository.js';
import { asAddress } from '../../domain/types/address.js';
import {
  asRecord,
  buildDescendingCursorFilter,
  decimalToString,
  toJsonValue,
} from './prisma-cursor.js';

export class PrismaCrmAccountRepository implements CrmAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, id: string): Promise<CrmAccountRecord | null> {
    const record = await this.prisma.crmAccount.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateCrmAccountData): Promise<CrmAccountRecord> {
    const record = await this.prisma.crmAccount.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
        ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
        ...(data.accountType !== undefined ? { accountType: data.accountType } : {}),
        ...(data.industry !== undefined ? { industry: data.industry } : {}),
        ...(data.website !== undefined ? { website: data.website } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.billingAddress !== undefined
          ? { billingAddress: toJsonValue(data.billingAddress) }
          : {}),
        ...(data.shippingAddress !== undefined
          ? { shippingAddress: toJsonValue(data.shippingAddress) }
          : {}),
        ...(data.annualRevenue !== undefined
          ? { annualRevenue: new Prisma.Decimal(data.annualRevenue) }
          : {}),
        ...(data.employeeCount !== undefined ? { employeeCount: data.employeeCount } : {}),
        ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
        ...(data.parentAccountId !== undefined ? { parentAccountId: data.parentAccountId } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
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
    data: UpdateCrmAccountData,
    expectedVersion: number,
  ): Promise<CrmAccountRecord | null> {
    try {
      const record = await this.prisma.crmAccount.update({
        where: { id, organizationId, version: expectedVersion, deletedAt: null },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
          ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
          ...(data.accountType !== undefined ? { accountType: data.accountType } : {}),
          ...(data.industry !== undefined ? { industry: data.industry } : {}),
          ...(data.website !== undefined ? { website: data.website } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.billingAddress !== undefined
            ? { billingAddress: toJsonValue(data.billingAddress) }
            : {}),
          ...(data.shippingAddress !== undefined
            ? { shippingAddress: toJsonValue(data.shippingAddress) }
            : {}),
          ...(data.annualRevenue !== undefined
            ? {
                annualRevenue:
                  data.annualRevenue === null
                    ? null
                    : new Prisma.Decimal(data.annualRevenue),
              }
            : {}),
          ...(data.employeeCount !== undefined ? { employeeCount: data.employeeCount } : {}),
          ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
          ...(data.parentAccountId !== undefined ? { parentAccountId: data.parentAccountId } : {}),
          ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
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

  async list(filter: ListCrmAccountsFilter): Promise<CrmAccountRecord[]> {
    const cursorFilter = await this.buildCursorFilter(filter.organizationId, filter.cursor);

    const records = await this.prisma.crmAccount.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.accountType !== undefined ? { accountType: filter.accountType } : {}),
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
  ): Promise<Prisma.CrmAccountWhereInput> {
    if (cursor === undefined) {
      return {};
    }

    const anchor = await this.prisma.crmAccount.findFirst({
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
    legalName: string | null;
    accountType: string;
    industry: string | null;
    website: string | null;
    phone: string | null;
    email: string | null;
    billingAddress: unknown;
    shippingAddress: unknown;
    annualRevenue: Prisma.Decimal | null;
    employeeCount: number | null;
    currencyCode: string;
    parentAccountId: string | null;
    ownerId: string | null;
    status: string;
    description: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number;
  }): CrmAccountRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      externalId: record.externalId,
      name: record.name,
      legalName: record.legalName,
      accountType: record.accountType as CrmAccountType,
      industry: record.industry,
      website: record.website,
      phone: record.phone,
      email: record.email,
      billingAddress: asAddress(record.billingAddress),
      shippingAddress: asAddress(record.shippingAddress),
      annualRevenue: decimalToString(record.annualRevenue),
      employeeCount: record.employeeCount,
      currencyCode: record.currencyCode,
      parentAccountId: record.parentAccountId,
      ownerId: record.ownerId,
      status: record.status as CrmAccountStatus,
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