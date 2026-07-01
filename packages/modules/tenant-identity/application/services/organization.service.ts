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
  type UserId,
  type WorkspaceId,
} from '@atlas/shared-kernel';

import type {
  CreateOrganizationData,
  OrganizationMemberRecord,
  OrganizationRecord,
  OrganizationRepository,
  UpdateOrganizationData,
} from '../../domain/repositories/organization.repository.js';

export interface CreateOrganizationRequest {
  readonly workspace_id: string;
  readonly slug: string;
  readonly name: string;
  readonly display_name?: string;
  readonly timezone?: string;
  readonly locale?: string;
  readonly currency_code?: string;
  readonly data_region?: string;
}

export interface UpdateOrganizationRequest {
  readonly name?: string;
  readonly display_name?: string | null;
  readonly timezone?: string;
  readonly locale?: string;
  readonly currency_code?: string;
  readonly status?: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}

export interface OrganizationDto {
  readonly id: string;
  readonly workspace_id: string;
  readonly slug: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly status: string;
  readonly timezone: string;
  readonly locale: string;
  readonly currency_code: string;
  readonly data_region: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface OrganizationMemberDto {
  readonly id: string;
  readonly user_id: string;
  readonly status: string;
  readonly is_owner: boolean;
  readonly title: string | null;
  readonly department: string | null;
  readonly joined_at: string;
  readonly user: {
    readonly email: string;
    readonly display_name: string | null;
  };
}

export interface OrganizationServiceDeps {
  readonly organizationRepository: OrganizationRepository;
}

export class OrganizationService {
  constructor(private readonly deps: OrganizationServiceDeps) {}

  async createOrganization(
    request: CreateOrganizationRequest,
    actorId: UserId,
  ): Promise<Result<OrganizationDto, ValidationError | ConflictError>> {
    const slugResult = Slug.create(request.slug);
    if (!slugResult.ok) {
      return slugResult;
    }

    const workspaceId = request.workspace_id as WorkspaceId;

    const existing = await this.deps.organizationRepository.findByWorkspaceAndSlug(
      workspaceId,
      slugResult.value.value,
    );

    if (existing !== null) {
      return err(
        new ConflictError('Organization slug already exists in this workspace', {
          details: { slug: request.slug },
        }),
      );
    }

    const createData: CreateOrganizationData = {
      workspaceId,
      slug: slugResult.value.value,
      name: request.name.trim(),
      createdById: actorId,
      ...(request.display_name !== undefined ? { displayName: request.display_name } : {}),
      ...(request.timezone !== undefined ? { timezone: request.timezone } : {}),
      ...(request.locale !== undefined ? { locale: request.locale } : {}),
      ...(request.currency_code !== undefined ? { currencyCode: request.currency_code } : {}),
      ...(request.data_region !== undefined ? { dataRegion: request.data_region } : {}),
    };

    const organization = await this.deps.organizationRepository.create(createData);

    await this.deps.organizationRepository.seedSystemRoles(organization.id);
    await this.deps.organizationRepository.addOwnerMember(organization.id, actorId);

    return ok(this.toDto(organization));
  }

  async getOrganization(
    organizationId: OrganizationId,
    actorId: UserId,
  ): Promise<Result<OrganizationDto, NotFoundError | ForbiddenError>> {
    const organization = await this.deps.organizationRepository.findById(organizationId);

    if (organization === null) {
      return err(new NotFoundError('Organization', organizationId));
    }

    const membership = await this.deps.organizationRepository.findMembership(
      organizationId,
      actorId,
    );

    if (membership === null || membership.status !== 'ACTIVE') {
      return err(new ForbiddenError('You do not have access to this organization'));
    }

    return ok(this.toDto(organization));
  }

  async listOrganizations(
    actorId: UserId,
    options: {
      workspaceId?: string;
      status?: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<OrganizationDto[]> {
    const organizations = await this.deps.organizationRepository.list({
      userId: actorId,
      limit: options.limit ?? 50,
      ...(options.workspaceId !== undefined
        ? { workspaceId: options.workspaceId as WorkspaceId }
        : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });

    return organizations.map((org) => this.toDto(org));
  }

  async listMembers(
    organizationId: OrganizationId,
    actorId: UserId,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<Result<OrganizationMemberDto[], ForbiddenError>> {
    const membership = await this.deps.organizationRepository.findMembership(
      organizationId,
      actorId,
    );

    if (membership === null || membership.status !== 'ACTIVE') {
      return err(new ForbiddenError('You do not have access to this organization'));
    }

    const members = await this.deps.organizationRepository.listMembers(organizationId, {
      limit: options.limit ?? 50,
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });

    return ok(members.map((member) => this.toMemberDto(member)));
  }

  async updateOrganization(
    organizationId: OrganizationId,
    request: UpdateOrganizationRequest,
    actorId: UserId,
  ): Promise<Result<OrganizationDto, NotFoundError | ForbiddenError>> {
    const existing = await this.deps.organizationRepository.findById(organizationId);

    if (existing === null) {
      return err(new NotFoundError('Organization', organizationId));
    }

    const membership = await this.deps.organizationRepository.findMembership(
      organizationId,
      actorId,
    );

    if (membership === null || !membership.isOwner) {
      return err(new ForbiddenError('Only organization owners can update organization settings'));
    }

    const updateData: UpdateOrganizationData = {
      updatedById: actorId,
      ...(request.name !== undefined ? { name: request.name.trim() } : {}),
      ...(request.display_name !== undefined ? { displayName: request.display_name } : {}),
      ...(request.timezone !== undefined ? { timezone: request.timezone } : {}),
      ...(request.locale !== undefined ? { locale: request.locale } : {}),
      ...(request.currency_code !== undefined ? { currencyCode: request.currency_code } : {}),
      ...(request.status !== undefined ? { status: request.status } : {}),
    };

    const updated = await this.deps.organizationRepository.update(organizationId, updateData);

    return ok(this.toDto(updated));
  }

  private toDto(record: OrganizationRecord): OrganizationDto {
    return {
      id: record.id,
      workspace_id: record.workspaceId,
      slug: record.slug,
      name: record.name,
      display_name: record.displayName,
      status: record.status,
      timezone: record.timezone,
      locale: record.locale,
      currency_code: record.currencyCode,
      data_region: record.dataRegion,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }

  private toMemberDto(record: OrganizationMemberRecord): OrganizationMemberDto {
    return {
      id: record.id,
      user_id: record.userId,
      status: record.status,
      is_owner: record.isOwner,
      title: record.title,
      department: record.department,
      joined_at: record.joinedAt.toISOString(),
      user: {
        email: record.userEmail,
        display_name: record.userDisplayName,
      },
    };
  }
}