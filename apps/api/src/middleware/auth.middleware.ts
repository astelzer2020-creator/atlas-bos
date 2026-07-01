import { AtlasHttpError, JwtVerificationError, runWithTenant } from '@atlas/platform';
import { createOrganizationId, parseUserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { resolveRoutePermission } from './route-permissions.js';

const ORGANIZATION_PATH_PATTERN =
  /^\/v1\/organizations\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;

const PUBLIC_PATHS = new Set([
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/refresh',
  '/v1/auth/forgot-password',
  '/v1/auth/reset-password',
  '/health',
  '/ready',
  '/metrics',
]);

function extractBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim();
}

function isPublicPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return PUBLIC_PATHS.has(path);
}

async function assertOrganizationRouteAccess(
  app: FastifyInstance,
  request: FastifyRequest,
  path: string,
): Promise<void> {
  const match = ORGANIZATION_PATH_PATTERN.exec(path);
  if (match === null || request.auth === undefined) {
    return;
  }

  const routeOrganizationId = match[1]!;

  if (request.auth.organizationId !== routeOrganizationId) {
    throw new AtlasHttpError('Organization access denied', {
      status: 403,
      code: 'forbidden',
    });
  }

  const membership = await app.container.prisma.organizationMember.findFirst({
    where: {
      organizationId: routeOrganizationId,
      userId: request.auth.userId,
      deletedAt: null,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (membership === null) {
    throw new AtlasHttpError('Organization membership required', {
      status: 403,
      code: 'forbidden',
    });
  }
}

async function assertRoutePermission(
  app: FastifyInstance,
  request: FastifyRequest,
  path: string,
): Promise<void> {
  if (request.auth === undefined) {
    return;
  }

  const permission = resolveRoutePermission(request.method, path);

  if (permission === null) {
    return;
  }

  const organizationId = request.auth.organizationId;
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

  const result = await app.container.tenantIdentity.authorizationService.checkPermission(
    userIdResult.value,
    orgIdResult.value,
    permission,
  );

  if (!result.ok) {
    throw new AtlasHttpError(result.error.message, {
      status: 422,
      code: 'validation_failed',
    });
  }

  if (!result.value) {
    throw new AtlasHttpError('Insufficient permissions', {
      status: 403,
      code: 'forbidden',
      details: { permission },
    });
  }
}

export function createAuthenticate(app: FastifyInstance) {
  return async function authenticate(
    request: FastifyRequest,
  ): Promise<{ userId: string; sessionId: string } | null> {
    const cookieToken = request.cookies['atlas_access'];
    const bearerToken = extractBearerToken(request);
    const token = bearerToken ?? cookieToken;

    if (!token) {
      return null;
    }

    try {
      const verified = await app.container.jwtService.verifyAccessToken(token);

      request.auth = {
        userId: verified.claims.sub,
        organizationId: verified.claims.org_id,
        workspaceId: verified.claims.workspace_id,
        sessionId: verified.claims.session_id,
      };

      request.tenantContext = {
        organizationId: verified.claims.org_id,
        workspaceId: verified.claims.workspace_id,
        userId: verified.claims.sub,
      };

      return {
        userId: verified.claims.sub,
        sessionId: verified.claims.session_id,
      };
    } catch (error) {
      if (error instanceof JwtVerificationError) {
        return null;
      }
      throw error;
    }
  };
}

export function registerAuthMiddleware(app: FastifyInstance): void {
  app.decorateRequest('auth', undefined);
  app.decorateRequest('tenantContext', undefined);

  app.addHook('onRoute', (routeOptions) => {
    const originalHandler = routeOptions.handler;
    if (typeof originalHandler !== 'function') {
      return;
    }

    routeOptions.handler = async function wrappedHandler(request, reply) {
      const path = request.url.split('?')[0] ?? request.url;

      if (!isPublicPath(path)) {
        const cookieToken = request.cookies['atlas_access'];
        const bearerToken = extractBearerToken(request);
        const token = bearerToken ?? cookieToken;

        if (!token) {
          throw new AtlasHttpError('Authentication required', {
            status: 401,
            code: 'unauthorized',
          });
        }

        try {
          const verified = await app.container.jwtService.verifyAccessToken(token);

          request.auth = {
            userId: verified.claims.sub,
            organizationId: verified.claims.org_id,
            workspaceId: verified.claims.workspace_id,
            sessionId: verified.claims.session_id,
          };

          request.tenantContext = {
            organizationId: verified.claims.org_id,
            workspaceId: verified.claims.workspace_id,
            userId: verified.claims.sub,
          };
        } catch (error) {
          if (error instanceof JwtVerificationError) {
            throw new AtlasHttpError('Invalid or expired access token', {
              status: 401,
              code: 'unauthorized',
            });
          }
          throw error;
        }

        await assertOrganizationRouteAccess(app, request, path);
        await assertRoutePermission(app, request, path);

        return await runWithTenant(request.tenantContext, async () =>
          originalHandler.call(this, request, reply),
        );
      }

      return await originalHandler.call(this, request, reply);
    };
  });
}