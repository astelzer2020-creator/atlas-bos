import type { PrismaClient } from '@atlas/database';
import {
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

export interface AssignRoleRequest {
  readonly role_id: string;
  readonly user_id: string;
  readonly expires_at?: string;
}

export interface AuthorizationServiceDeps {
  readonly prisma: PrismaClient;
}

export class AuthorizationService {
  constructor(private readonly deps: AuthorizationServiceDeps) {}

  async checkPermission(
    userId: UserId,
    orgId: OrganizationId,
    permission: string,
  ): Promise<Result<boolean, ValidationError>> {
    if (!/^[a-z_]+:[a-z_]+:[a-z_]+$/.test(permission)) {
      return err(
        new ValidationError('Invalid permission code format', { field: 'permission' }),
      );
    }

    const permissionRecord = await this.deps.prisma.permission.findUnique({
      where: { code: permission },
      select: { id: true, isDeprecated: true },
    });

    if (permissionRecord === null || permissionRecord.isDeprecated) {
      return ok(false);
    }

    const assignments = await this.deps.prisma.roleAssignment.findMany({
      where: {
        organizationId: orgId,
        principalType: 'USER',
        principalId: userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            permissions: {
              where: { permissionId: permissionRecord.id },
            },
          },
        },
      },
    });

    let allowed = false;
    let denied = false;

    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.permissions) {
        if (rolePermission.effect === 'ALLOW') {
          allowed = true;
        }
        if (rolePermission.effect === 'DENY') {
          denied = true;
        }
      }
    }

    if (denied) {
      return ok(false);
    }

    return ok(allowed);
  }

  async assignRole(
    orgId: OrganizationId,
    request: AssignRoleRequest,
    grantedById: UserId,
  ): Promise<Result<{ assignment_id: string }, NotFoundError | ForbiddenError | ValidationError>> {
    const canManage = await this.checkPermission(grantedById, orgId, 'admin:roles:manage');

    if (!canManage.ok) {
      return canManage;
    }

    if (!canManage.value) {
      return err(new ForbiddenError('You do not have permission to assign roles'));
    }

    const role = await this.deps.prisma.role.findFirst({
      where: {
        id: request.role_id,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (role === null) {
      return err(new NotFoundError('Role', request.role_id));
    }

    const targetUserId = request.user_id as UserId;

    const membership = await this.deps.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: targetUserId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (membership === null) {
      return err(new ValidationError('User is not an active member of the organization', {
        field: 'user_id',
      }));
    }

    const existing = await this.deps.prisma.roleAssignment.findFirst({
      where: {
        organizationId: orgId,
        roleId: request.role_id,
        principalType: 'USER',
        principalId: targetUserId,
        scopeType: 'ORGANIZATION',
        isActive: true,
      },
    });

    if (existing !== null) {
      return ok({ assignment_id: existing.id });
    }

    const assignment = await this.deps.prisma.roleAssignment.create({
      data: {
        organizationId: orgId,
        roleId: request.role_id,
        principalType: 'USER',
        principalId: targetUserId,
        scopeType: 'ORGANIZATION',
        grantedById,
        ...(request.expires_at !== undefined ? { expiresAt: new Date(request.expires_at) } : {}),
      },
    });

    return ok({ assignment_id: assignment.id });
  }
}