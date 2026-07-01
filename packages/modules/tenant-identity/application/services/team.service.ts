import {
  ConflictError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Slug,
  ValidationError,
  type OrganizationId,
  type Result,
  type TeamId,
  type UserId,
} from '@atlas/shared-kernel';

import type { OrganizationRepository } from '../../domain/repositories/organization.repository.js';
import type {
  CreateTeamData,
  TeamMemberRole,
  TeamRecord,
  TeamRepository,
} from '../../domain/repositories/team.repository.js';

export interface CreateTeamRequest {
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly parent_team_id?: string;
}

export interface AddTeamMemberRequest {
  readonly user_id: string;
  readonly role?: TeamMemberRole;
}

export interface TeamDto {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly is_default: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TeamMemberDto {
  readonly id: string;
  readonly team_id: string;
  readonly user_id: string;
  readonly role: TeamMemberRole;
  readonly joined_at: string;
}

export interface TeamServiceDeps {
  readonly teamRepository: TeamRepository;
  readonly organizationRepository: OrganizationRepository;
}

export class TeamService {
  constructor(private readonly deps: TeamServiceDeps) {}

  async createTeam(
    organizationId: OrganizationId,
    request: CreateTeamRequest,
    actorId: UserId,
  ): Promise<Result<TeamDto, ValidationError | ConflictError | ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const slugResult = Slug.create(request.slug);
    if (!slugResult.ok) {
      return slugResult;
    }

    const existing = await this.deps.teamRepository.findBySlug(organizationId, slugResult.value.value);

    if (existing !== null) {
      return err(
        new ConflictError('Team slug already exists in this organization', {
          details: { slug: request.slug },
        }),
      );
    }

    const createData: CreateTeamData = {
      organizationId,
      slug: slugResult.value.value,
      name: request.name.trim(),
      createdById: actorId,
      ...(request.description !== undefined ? { description: request.description } : {}),
      ...(request.parent_team_id !== undefined
        ? { parentTeamId: request.parent_team_id as TeamId }
        : {}),
    };

    const team = await this.deps.teamRepository.create(createData);

    return ok(this.toDto(team));
  }

  async listTeams(
    organizationId: OrganizationId,
    actorId: UserId,
    options: { parentTeamId?: string; limit?: number; cursor?: string } = {},
  ): Promise<Result<TeamDto[], ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const teams = await this.deps.teamRepository.list({
      organizationId,
      limit: options.limit ?? 50,
      ...(options.parentTeamId !== undefined
        ? { parentTeamId: options.parentTeamId as TeamId }
        : {}),
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });

    return ok(teams.map((team) => this.toDto(team)));
  }

  async getTeam(
    organizationId: OrganizationId,
    teamId: TeamId,
    actorId: UserId,
  ): Promise<Result<TeamDto, NotFoundError | ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const team = await this.deps.teamRepository.findById(organizationId, teamId);

    if (team === null) {
      return err(new NotFoundError('Team', teamId));
    }

    return ok(this.toDto(team));
  }

  async addTeamMember(
    organizationId: OrganizationId,
    teamId: TeamId,
    request: AddTeamMemberRequest,
    actorId: UserId,
  ): Promise<Result<TeamMemberDto, ValidationError | ConflictError | NotFoundError | ForbiddenError>> {
    const access = await this.ensureMembership(organizationId, actorId);
    if (!access.ok) {
      return access;
    }

    const team = await this.deps.teamRepository.findById(organizationId, teamId);

    if (team === null) {
      return err(new NotFoundError('Team', teamId));
    }

    const userId = request.user_id as UserId;
    const orgMembership = await this.deps.organizationRepository.findMembership(
      organizationId,
      userId,
    );

    if (orgMembership === null || orgMembership.status !== 'ACTIVE') {
      return err(new ValidationError('User is not an active member of the organization', {
        field: 'user_id',
      }));
    }

    const existingMember = await this.deps.teamRepository.findMember(organizationId, teamId, userId);

    if (existingMember !== null) {
      return err(new ConflictError('User is already a member of this team'));
    }

    const member = await this.deps.teamRepository.addMember(
      organizationId,
      teamId,
      userId,
      request.role ?? 'MEMBER',
      actorId,
    );

    return ok({
      id: member.id,
      team_id: member.teamId,
      user_id: member.userId,
      role: member.role,
      joined_at: member.joinedAt.toISOString(),
    });
  }

  private async ensureMembership(
    organizationId: OrganizationId,
    actorId: UserId,
  ): Promise<Result<void, ForbiddenError>> {
    const membership = await this.deps.organizationRepository.findMembership(
      organizationId,
      actorId,
    );

    if (membership === null || membership.status !== 'ACTIVE') {
      return err(new ForbiddenError('You do not have access to this organization'));
    }

    return ok(undefined);
  }

  private toDto(record: TeamRecord): TeamDto {
    return {
      id: record.id,
      organization_id: record.organizationId,
      slug: record.slug,
      name: record.name,
      description: record.description,
      is_default: record.isDefault,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }
}