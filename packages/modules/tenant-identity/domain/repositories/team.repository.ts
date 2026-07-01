import type { OrganizationId, TeamId, UserId } from '@atlas/shared-kernel';

export type TeamMemberRole = 'LEAD' | 'MEMBER';

export interface TeamRecord {
  readonly id: TeamId;
  readonly organizationId: OrganizationId;
  readonly parentTeamId: TeamId | null;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly isDefault: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTeamData {
  readonly organizationId: OrganizationId;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly parentTeamId?: TeamId;
  readonly createdById: UserId;
}

export interface ListTeamsFilter {
  readonly organizationId: OrganizationId;
  readonly parentTeamId?: TeamId;
  readonly limit: number;
  readonly cursor?: string;
}

export interface TeamMemberRecord {
  readonly id: string;
  readonly teamId: TeamId;
  readonly userId: UserId;
  readonly role: TeamMemberRole;
  readonly joinedAt: Date;
}

export interface TeamRepository {
  findById(organizationId: OrganizationId, teamId: TeamId): Promise<TeamRecord | null>;
  findBySlug(organizationId: OrganizationId, slug: string): Promise<TeamRecord | null>;
  create(data: CreateTeamData): Promise<TeamRecord>;
  list(filter: ListTeamsFilter): Promise<TeamRecord[]>;
  addMember(
    organizationId: OrganizationId,
    teamId: TeamId,
    userId: UserId,
    role: TeamMemberRole,
    createdById: UserId,
  ): Promise<TeamMemberRecord>;
  findMember(
    organizationId: OrganizationId,
    teamId: TeamId,
    userId: UserId,
  ): Promise<TeamMemberRecord | null>;
}