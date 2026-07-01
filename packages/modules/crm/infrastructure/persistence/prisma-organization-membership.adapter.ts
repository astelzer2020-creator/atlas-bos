import type { PrismaClient } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

import type { OrganizationMembershipPort } from '../../application/ports/organization-membership.port.js';

export class PrismaOrganizationMembershipAdapter implements OrganizationMembershipPort {
  constructor(private readonly prisma: PrismaClient) {}

  async isActiveMember(organizationId: OrganizationId, userId: UserId): Promise<boolean> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });

    return membership !== null;
  }
}