import { mapDomainErrorToHttp } from '@atlas/platform';
import {
  createOrganizationId,
  createTeamId,
  createWorkspaceId,
  parseUserId,
} from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { OrganizationService } from '../../application/services/organization.service.js';
import type { TeamService } from '../../application/services/team.service.js';
import type { UserService } from '../../application/services/user.service.js';
import type { WorkspaceService } from '../../application/services/workspace.service.js';

import {
  addTeamMemberBodySchema,
  createOrganizationBodySchema,
  createTeamBodySchema,
  createWorkspaceBodySchema,
  listQuerySchema,
  organizationParamsSchema,
  teamParamsSchema,
  updateOrganizationBodySchema,
  updateUserBodySchema,
  workspaceParamsSchema,
} from './schemas.js';

export interface PlatformRouteContext {
  readonly userId: string;
}

export interface PlatformRoutesDeps {
  readonly workspaceService: WorkspaceService;
  readonly organizationService: OrganizationService;
  readonly teamService: TeamService;
  readonly userService: UserService;
  readonly authenticate: (request: FastifyRequest) => Promise<PlatformRouteContext | null>;
}

function validationError(reply: FastifyReply, issues: { path: (string | number)[]; message: string }[]) {
  return reply.status(422).send({
    type: 'https://api.atlas.example.com/errors/validation-failed',
    title: 'Validation Failed',
    status: 422,
    detail: 'Request validation failed',
    errors: issues.map((issue) => ({
      field: issue.path.join('.'),
      code: 'validation_failed',
      message: issue.message,
    })),
  });
}

function sendResult<T>(
  reply: FastifyReply,
  result: { ok: true; value: T } | { ok: false; error: unknown },
  successStatus = 200,
  wrap = false,
): FastifyReply {
  if (!result.ok) {
    const httpError = mapDomainErrorToHttp(result.error);
    return reply.status(httpError.status).send(httpError.toProblemDetails());
  }

  const payload = wrap ? { data: result.value } : result.value;
  return reply.status(successStatus).send(payload);
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticate: PlatformRoutesDeps['authenticate'],
) {
  const context = await authenticate(request);

  if (context === null) {
    reply.status(401).send({
      type: 'https://api.atlas.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication required',
    });
    return null;
  }

  const userIdResult = parseUserId(context.userId);
  if (!userIdResult.ok) {
    reply.status(401).send({
      type: 'https://api.atlas.example.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid user context',
    });
    return null;
  }

  return userIdResult.value;
}

export async function registerPlatformRoutes(
  fastify: FastifyInstance,
  deps: PlatformRoutesDeps,
): Promise<void> {
  fastify.get('/v1/workspaces', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const workspaces = await deps.workspaceService.listWorkspaces(userId, {
      limit: query.data.limit,
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    return reply.status(200).send({
      data: workspaces.map((workspace) => ({ object: 'workspace', ...workspace })),
      pagination: {
        has_more: workspaces.length === query.data.limit,
        next_cursor: workspaces.at(-1)?.id ?? null,
        prev_cursor: null,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/workspaces', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const body = createWorkspaceBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const result = await deps.workspaceService.createWorkspace(
      {
        slug: body.data.slug,
        name: body.data.name,
        ...(body.data.display_name !== undefined ? { display_name: body.data.display_name } : {}),
      },
      userId,
    );
    return sendResult(reply, result, 201, true);
  });

  fastify.get('/v1/workspaces/:workspace_id', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = workspaceParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const workspaceIdResult = createWorkspaceId(params.data.workspace_id);
    if (!workspaceIdResult.ok) {
      return validationError(reply, workspaceIdResult.error.details?.issues as { path: (string | number)[]; message: string }[] ?? [{ path: ['workspace_id'], message: workspaceIdResult.error.message }]);
    }

    const result = await deps.workspaceService.getWorkspace(workspaceIdResult.value, userId);
    return sendResult(reply, result, 200, true);
  });

  fastify.get('/v1/organizations', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizations = await deps.organizationService.listOrganizations(userId, {
      limit: query.data.limit,
      ...(query.data.workspace_id !== undefined ? { workspaceId: query.data.workspace_id } : {}),
      ...(query.data.status !== undefined ? { status: query.data.status } : {}),
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    return reply.status(200).send({
      data: organizations.map((organization) => ({ object: 'organization', ...organization })),
      pagination: {
        has_more: organizations.length === query.data.limit,
        next_cursor: organizations.at(-1)?.id ?? null,
        prev_cursor: null,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/organizations', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const body = createOrganizationBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const result = await deps.organizationService.createOrganization(
      {
        workspace_id: body.data.workspace_id,
        slug: body.data.slug,
        name: body.data.name,
        ...(body.data.display_name !== undefined ? { display_name: body.data.display_name } : {}),
        ...(body.data.timezone !== undefined ? { timezone: body.data.timezone } : {}),
        ...(body.data.locale !== undefined ? { locale: body.data.locale } : {}),
        ...(body.data.currency_code !== undefined
          ? { currency_code: body.data.currency_code }
          : {}),
        ...(body.data.data_region !== undefined ? { data_region: body.data.data_region } : {}),
      },
      userId,
    );
    return sendResult(reply, result, 201, true);
  });

  fastify.get('/v1/organizations/:organization_id', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }

    const result = await deps.organizationService.getOrganization(orgIdResult.value, userId);
    return sendResult(reply, result, 200, true);
  });

  fastify.get('/v1/organizations/:organization_id/members', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }

    const result = await deps.organizationService.listMembers(orgIdResult.value, userId, {
      limit: query.data.limit,
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(200).send({
      data: result.value.map((member) => ({ object: 'member', ...member })),
      pagination: {
        has_more: result.value.length === query.data.limit,
        next_cursor: result.value.at(-1)?.id ?? null,
        prev_cursor: null,
        limit: query.data.limit,
      },
    });
  });

  fastify.patch('/v1/organizations/:organization_id', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = updateOrganizationBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }

    const result = await deps.organizationService.updateOrganization(
      orgIdResult.value,
      {
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.display_name !== undefined ? { display_name: body.data.display_name } : {}),
        ...(body.data.timezone !== undefined ? { timezone: body.data.timezone } : {}),
        ...(body.data.locale !== undefined ? { locale: body.data.locale } : {}),
        ...(body.data.currency_code !== undefined
          ? { currency_code: body.data.currency_code }
          : {}),
        ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      },
      userId,
    );

    return sendResult(reply, result, 200, true);
  });

  fastify.get('/v1/organizations/:organization_id/teams', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }

    const result = await deps.teamService.listTeams(orgIdResult.value, userId, {
      limit: query.data.limit,
      ...(query.data.parent_team_id !== undefined
        ? { parentTeamId: query.data.parent_team_id }
        : {}),
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(200).send({
      data: result.value.map((team) => ({ object: 'team', ...team })),
      pagination: {
        has_more: result.value.length === query.data.limit,
        next_cursor: result.value.at(-1)?.id ?? null,
        prev_cursor: null,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/organizations/:organization_id/teams', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createTeamBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }

    const result = await deps.teamService.createTeam(
      orgIdResult.value,
      {
        slug: body.data.slug,
        name: body.data.name,
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(body.data.parent_team_id !== undefined
          ? { parent_team_id: body.data.parent_team_id }
          : {}),
      },
      userId,
    );
    return sendResult(reply, result, 201, true);
  });

  fastify.get('/v1/organizations/:organization_id/teams/:team_id', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = teamParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    const teamIdResult = createTeamId(params.data.team_id);

    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }
    if (!teamIdResult.ok) {
      return validationError(reply, [{ path: ['team_id'], message: teamIdResult.error.message }]);
    }

    const result = await deps.teamService.getTeam(
      orgIdResult.value,
      teamIdResult.value,
      userId,
    );

    return sendResult(reply, result, 200, true);
  });

  fastify.post('/v1/organizations/:organization_id/teams/:team_id/members', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = teamParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = addTeamMemberBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organization_id);
    const teamIdResult = createTeamId(params.data.team_id);

    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organization_id'], message: orgIdResult.error.message }]);
    }
    if (!teamIdResult.ok) {
      return validationError(reply, [{ path: ['team_id'], message: teamIdResult.error.message }]);
    }

    const result = await deps.teamService.addTeamMember(
      orgIdResult.value,
      teamIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201, true);
  });

  fastify.get('/v1/users/me', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const result = await deps.userService.getUserById(userId);

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(200).send({
      data: { object: 'user', ...result.value },
    });
  });

  fastify.patch('/v1/users/me', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const body = updateUserBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const result = await deps.userService.updateProfile(userId, {
      ...(body.data.display_name !== undefined ? { display_name: body.data.display_name } : {}),
      ...(body.data.locale !== undefined ? { locale: body.data.locale } : {}),
      ...(body.data.timezone !== undefined ? { timezone: body.data.timezone } : {}),
      ...(body.data.avatar_url !== undefined ? { avatar_url: body.data.avatar_url } : {}),
    });

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(200).send({
      data: { object: 'user', ...result.value },
    });
  });
}