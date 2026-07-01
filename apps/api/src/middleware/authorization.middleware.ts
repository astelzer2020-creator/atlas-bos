import { AtlasHttpError } from '@atlas/platform';
import { createOrganizationId, parseUserId } from '@atlas/shared-kernel';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppContainer } from '../di/container.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveOrganizationId(request: FastifyRequest): string | null {
  const params = request.params as Record<string, unknown> | undefined;
  const paramOrgId = params?.organizationId;
  if (typeof paramOrgId === 'string' && UUID_PATTERN.test(paramOrgId)) {
    return paramOrgId;
  }

  const body = request.body as Record<string, unknown> | undefined;
  const bodyOrgId = body?.organization_id ?? body?.organizationId;
  if (typeof bodyOrgId === 'string' && UUID_PATTERN.test(bodyOrgId)) {
    return bodyOrgId;
  }

  return request.auth?.organizationId ?? null;
}

/**
 * Returns a Fastify preHandler that enforces RBAC permission checks.
 */
export function createRequirePermission(container: AppContainer, permission: string) {
  return async function requirePermission(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.auth === undefined) {
      throw new AtlasHttpError('Authentication required', {
        status: 401,
        code: 'unauthorized',
      });
    }

    const organizationId = resolveOrganizationId(request);

    if (organizationId === null) {
      throw new AtlasHttpError('Organization context is required', {
        status: 400,
        code: 'organization_required',
      });
    }

    if (request.auth.organizationId !== organizationId) {
      throw new AtlasHttpError('Organization access denied', {
        status: 403,
        code: 'forbidden',
      });
    }

    const userIdResult = parseUserId(request.auth.userId);
    if (!userIdResult.ok) {
      throw new AtlasHttpError('Invalid user context', {
        status: 401,
        code: 'unauthorized',
      });
    }

    const orgIdResult = createOrganizationId(organizationId);
    if (!orgIdResult.ok) {
      throw new AtlasHttpError('Invalid organization context', {
        status: 400,
        code: 'organization_required',
      });
    }

    const result = await container.tenantIdentity.authorizationService.checkPermission(
      userIdResult.value,
      orgIdResult.value,
      permission,
    );

    if (!result.ok) {
      reply.status(422).send({
        type: 'https://api.atlas.example.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: result.error.message,
      });
      return;
    }

    if (!result.value) {
      throw new AtlasHttpError('Insufficient permissions', {
        status: 403,
        code: 'forbidden',
        details: { permission },
      });
    }
  };
}

/**
 * Organization owners bypass granular permission checks until full RBAC seeding is guaranteed.
 */
export async function assertOrganizationMembership(
  container: AppContainer,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.auth === undefined) {
    throw new AtlasHttpError('Authentication required', {
      status: 401,
      code: 'unauthorized',
    });
  }

  const organizationId = resolveOrganizationId(request);

  if (organizationId === null) {
    throw new AtlasHttpError('Organization context is required', {
      status: 400,
      code: 'organization_required',
    });
  }

  if (request.auth.organizationId !== organizationId) {
    throw new AtlasHttpError('Organization access denied', {
      status: 403,
      code: 'forbidden',
    });
  }

  const membership = await container.prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: request.auth.userId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (membership === null) {
    throw new AtlasHttpError('Organization membership required', {
      status: 403,
      code: 'forbidden',
    });
  }

  void reply;
}