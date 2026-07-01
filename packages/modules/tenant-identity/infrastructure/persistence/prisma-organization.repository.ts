import type { PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId, WorkspaceId } from '@atlas/shared-kernel';

import type {
  CreateOrganizationData,
  ListOrganizationsFilter,
  OrganizationMemberRecord,
  OrganizationMemberStatus,
  OrganizationRecord,
  OrganizationRepository,
  OrganizationStatus,
  UpdateOrganizationData,
} from '../../domain/repositories/organization.repository.js';

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: OrganizationId): Promise<OrganizationRecord | null> {
    const record = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findByWorkspaceAndSlug(
    workspaceId: WorkspaceId,
    slug: string,
  ): Promise<OrganizationRecord | null> {
    const record = await this.prisma.organization.findFirst({
      where: { workspaceId, slug, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateOrganizationData): Promise<OrganizationRecord> {
    const record = await this.prisma.organization.create({
      data: {
        workspaceId: data.workspaceId,
        slug: data.slug,
        name: data.name,
        displayName: data.displayName ?? null,
        status: 'ACTIVE',
        timezone: data.timezone ?? 'UTC',
        locale: data.locale ?? 'en-US',
        currencyCode: data.currencyCode ?? 'USD',
        dataRegion: data.dataRegion ?? 'us-east-1',
        createdById: data.createdById,
        provisionedAt: new Date(),
      },
    });

    return this.toRecord(record);
  }

  async update(id: OrganizationId, data: UpdateOrganizationData): Promise<OrganizationRecord> {
    const record = await this.prisma.organization.update({
      where: { id },
      data: {
        updatedById: data.updatedById,
        version: { increment: 1 },
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    return this.toRecord(record);
  }

  async list(filter: ListOrganizationsFilter): Promise<OrganizationRecord[]> {
    const records = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId: filter.userId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
        ...(filter.workspaceId !== undefined ? { workspaceId: filter.workspaceId } : {}),
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.cursor !== undefined ? { id: { gt: filter.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: filter.limit,
    });

    return records.map((record: Parameters<typeof this.toRecord>[0]) => this.toRecord(record));
  }

  async seedSystemRoles(organizationId: OrganizationId): Promise<void> {
    await this.prisma.$executeRaw`SELECT atlas_core.seed_system_roles(${organizationId}::uuid)`;
  }

  async addOwnerMember(organizationId: OrganizationId, userId: UserId): Promise<void> {
    await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        status: 'ACTIVE',
        isOwner: true,
      },
    });

    const ownerRole = await this.prisma.role.findFirst({
      where: { organizationId, slug: 'owner', deletedAt: null },
    });

    if (ownerRole !== null) {
      await this.prisma.roleAssignment.create({
        data: {
          organizationId,
          roleId: ownerRole.id,
          principalType: 'USER',
          principalId: userId,
          scopeType: 'ORGANIZATION',
          grantedById: userId,
        },
      });
    }
  }

  async findMembership(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<{ isOwner: boolean; status: string } | null> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        deletedAt: null,
      },
      select: { isOwner: true, status: true },
    });

    return membership;
  }

  async listMembers(
    organizationId: OrganizationId,
    options: { limit: number; cursor?: string },
  ): Promise<OrganizationMemberRecord[]> {
    const records = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(options.cursor !== undefined ? { id: { gt: options.cursor } } : {}),
      },
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: options.limit,
    });

    return records.map((record) => this.toMemberRecord(record));
  }

  private toMemberRecord(record: {
    id: string;
    userId: string;
    status: string;
    isOwner: boolean;
    title: string | null;
    department: string | null;
    joinedAt: Date;
    user: {
      email: string;
      displayName: string | null;
    };
  }): OrganizationMemberRecord {
    return {
      id: record.id,
      userId: record.userId as UserId,
      status: record.status as OrganizationMemberStatus,
      isOwner: record.isOwner,
      title: record.title,
      department: record.department,
      joinedAt: record.joinedAt,
      userEmail: record.user.email,
      userDisplayName: record.user.displayName,
    };
  }

  private toRecord(record: {
    id: string;
    workspaceId: string;
    slug: string;
    name: string;
    displayName: string | null;
    status: string;
    timezone: string;
    locale: string;
    currencyCode: string;
    dataRegion: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): OrganizationRecord {
    return {
      id: record.id as OrganizationId,
      workspaceId: record.workspaceId as WorkspaceId,
      slug: record.slug,
      name: record.name,
      displayName: record.displayName,
      status: record.status as OrganizationStatus,
      timezone: record.timezone,
      locale: record.locale,
      currencyCode: record.currencyCode,
      dataRegion: record.dataRegion,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}