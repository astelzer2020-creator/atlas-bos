import type { OrganizationId, UserId, WorkspaceId } from '@atlas/shared-kernel';

export type OrganizationStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface OrganizationRecord {
  readonly id: OrganizationId;
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly name: string;
  readonly displayName: string | null;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly locale: string;
  readonly currencyCode: string;
  readonly dataRegion: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateOrganizationData {
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly name: string;
  readonly displayName?: string;
  readonly timezone?: string;
  readonly locale?: string;
  readonly currencyCode?: string;
  readonly dataRegion?: string;
  readonly createdById: UserId;
}

export interface UpdateOrganizationData {
  readonly name?: string;
  readonly displayName?: string | null;
  readonly timezone?: string;
  readonly locale?: string;
  readonly currencyCode?: string;
  readonly status?: OrganizationStatus;
  readonly updatedById: UserId;
}

export interface ListOrganizationsFilter {
  readonly userId: UserId;
  readonly workspaceId?: WorkspaceId;
  readonly status?: OrganizationStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export type OrganizationMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface OrganizationMemberRecord {
  readonly id: string;
  readonly userId: UserId;
  readonly status: OrganizationMemberStatus;
  readonly isOwner: boolean;
  readonly title: string | null;
  readonly department: string | null;
  readonly joinedAt: Date;
  readonly userEmail: string;
  readonly userDisplayName: string | null;
}

export interface OrganizationRepository {
  findById(id: OrganizationId): Promise<OrganizationRecord | null>;
  findByWorkspaceAndSlug(workspaceId: WorkspaceId, slug: string): Promise<OrganizationRecord | null>;
  create(data: CreateOrganizationData): Promise<OrganizationRecord>;
  update(id: OrganizationId, data: UpdateOrganizationData): Promise<OrganizationRecord>;
  list(filter: ListOrganizationsFilter): Promise<OrganizationRecord[]>;
  seedSystemRoles(organizationId: OrganizationId): Promise<void>;
  addOwnerMember(organizationId: OrganizationId, userId: UserId): Promise<void>;
  findMembership(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<{ isOwner: boolean; status: string } | null>;
  listMembers(
    organizationId: OrganizationId,
    options: { limit: number; cursor?: string },
  ): Promise<OrganizationMemberRecord[]>;
}