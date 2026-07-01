import type { PrismaClient } from '@atlas/database';
import type { OrganizationId, TeamId, UserId } from '@atlas/shared-kernel';

import type {
  CreateTeamData,
  ListTeamsFilter,
  TeamMemberRecord,
  TeamMemberRole,
  TeamRecord,
  TeamRepository,
} from '../../domain/repositories/team.repository.js';

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(organizationId: OrganizationId, teamId: TeamId): Promise<TeamRecord | null> {
    const record = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async findBySlug(organizationId: OrganizationId, slug: string): Promise<TeamRecord | null> {
    const record = await this.prisma.team.findFirst({
      where: { organizationId, slug, deletedAt: null },
    });

    return record === null ? null : this.toRecord(record);
  }

  async create(data: CreateTeamData): Promise<TeamRecord> {
    const record = await this.prisma.team.create({
      data: {
        organizationId: data.organizationId,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        parentTeamId: data.parentTeamId ?? null,
        createdById: data.createdById,
      },
    });

    return this.toRecord(record);
  }

  async list(filter: ListTeamsFilter): Promise<TeamRecord[]> {
    const records = await this.prisma.team.findMany({
      where: {
        organizationId: filter.organizationId,
        deletedAt: null,
        ...(filter.parentTeamId !== undefined ? { parentTeamId: filter.parentTeamId } : {}),
        ...(filter.cursor !== undefined ? { id: { gt: filter.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: filter.limit,
    });

    return records.map((record: Parameters<typeof this.toRecord>[0]) => this.toRecord(record));
  }

  async addMember(
    organizationId: OrganizationId,
    teamId: TeamId,
    userId: UserId,
    role: TeamMemberRole,
    createdById: UserId,
  ): Promise<TeamMemberRecord> {
    const record = await this.prisma.teamMember.create({
      data: {
        organizationId,
        teamId,
        userId,
        role,
        createdById,
      },
    });

    return {
      id: record.id,
      teamId: record.teamId as TeamId,
      userId: record.userId as UserId,
      role: record.role as TeamMemberRole,
      joinedAt: record.joinedAt,
    };
  }

  async findMember(
    organizationId: OrganizationId,
    teamId: TeamId,
    userId: UserId,
  ): Promise<TeamMemberRecord | null> {
    const record = await this.prisma.teamMember.findFirst({
      where: {
        organizationId,
        teamId,
        userId,
        deletedAt: null,
      },
    });

    if (record === null) {
      return null;
    }

    return {
      id: record.id,
      teamId: record.teamId as TeamId,
      userId: record.userId as UserId,
      role: record.role as TeamMemberRole,
      joinedAt: record.joinedAt,
    };
  }

  private toRecord(record: {
    id: string;
    organizationId: string;
    parentTeamId: string | null;
    slug: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): TeamRecord {
    return {
      id: record.id as TeamId,
      organizationId: record.organizationId as OrganizationId,
      parentTeamId: record.parentTeamId as TeamId | null,
      slug: record.slug,
      name: record.name,
      description: record.description,
      isDefault: record.isDefault,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}