import type { OrganizationId, UserId } from '@atlas/shared-kernel';

/** Verifies that a user is an active member of an organization (tenant). */
export interface OrganizationMembershipPort {
  isActiveMember(organizationId: OrganizationId, userId: UserId): Promise<boolean>;
}