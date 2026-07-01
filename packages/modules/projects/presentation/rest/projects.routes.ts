import { mapDomainErrorToHttp } from '@atlas/platform';
import { createOrganizationId, parseUserId, type UserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectService } from '../../application/services/project.service.js';
import type { TaskService } from '../../application/services/task.service.js';

import {
  createProjectBodySchema,
  createTaskBodySchema,
  listProjectsQuerySchema,
  listTasksQuerySchema,
  organizationParamsSchema,
  projectParamsSchema,
  taskParamsSchema,
  updateProjectBodySchema,
  updateTaskBodySchema,
} from './schemas.js';

export interface ProjectsRouteContext {
  readonly userId: string;
}

export interface ProjectsRoutesDeps {
  readonly projectService: ProjectService;
  readonly taskService: TaskService;
  readonly authenticate: (request: FastifyRequest) => Promise<ProjectsRouteContext | null>;
}

function validationError(
  reply: FastifyReply,
  issues: { path: (string | number)[]; message: string }[],
) {
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
): FastifyReply {
  if (!result.ok) {
    const httpError = mapDomainErrorToHttp(result.error);
    return reply.status(httpError.status).send(httpError.toProblemDetails());
  }

  return reply.status(successStatus).send(result.value);
}

function sendCursorPage<T extends { id: string }>(
  reply: FastifyReply,
  result: { data: readonly T[]; nextCursor: string | null },
  limit: number,
): FastifyReply {
  return reply.status(200).send({
    data: result.data,
    pagination: {
      hasMore: result.nextCursor !== null,
      nextCursor: result.nextCursor,
      limit,
    },
  });
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticate: ProjectsRoutesDeps['authenticate'],
): Promise<UserId | null> {
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

export async function registerProjectsRoutes(
  fastify: FastifyInstance,
  deps: ProjectsRoutesDeps,
): Promise<void> {
  fastify.get('/v1/organizations/:organizationId/projects', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const query = listProjectsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return validationError(reply, query.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.projectService.listProjects(
      organizationIdResult.value,
      query.data,
    );

    return sendCursorPage(reply, result, query.data.limit);
  });

  fastify.post('/v1/organizations/:organizationId/projects', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createProjectBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.projectService.createProject(
      organizationIdResult.value,
      body.data,
      userId,
    );

    return sendResult(reply, result, 201);
  });

  fastify.get('/v1/organizations/:organizationId/projects/:projectId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.projectService.getProject(
      organizationIdResult.value,
      params.data.projectId,
    );

    return sendResult(reply, result);
  });

  fastify.patch('/v1/organizations/:organizationId/projects/:projectId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = updateProjectBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const organizationIdResult = createOrganizationId(params.data.organizationId);
    if (!organizationIdResult.ok) {
      return validationError(reply, [
        { path: ['organizationId'], message: 'Must be a valid UUID' },
      ]);
    }

    const result = await deps.projectService.updateProject(
      organizationIdResult.value,
      params.data.projectId,
      body.data,
      userId,
    );

    return sendResult(reply, result);
  });

  fastify.get(
    '/v1/organizations/:organizationId/projects/:projectId/tasks',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = projectParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const query = listTasksQuerySchema.safeParse(request.query);
      if (!query.success) {
        return validationError(reply, query.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.taskService.listTasks(
        organizationIdResult.value,
        params.data.projectId,
        query.data,
      );

      if (!result.ok) {
        return sendResult(reply, result);
      }

      return sendCursorPage(reply, result.value, query.data.limit);
    },
  );

  fastify.post(
    '/v1/organizations/:organizationId/projects/:projectId/tasks',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = projectParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = createTaskBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.taskService.createTask(
        organizationIdResult.value,
        params.data.projectId,
        body.data,
        userId,
      );

      return sendResult(reply, result, 201);
    },
  );

  fastify.get(
    '/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = taskParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.taskService.getTask(
        organizationIdResult.value,
        params.data.projectId,
        params.data.taskId,
      );

      return sendResult(reply, result);
    },
  );

  fastify.patch(
    '/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId',
    async (request, reply) => {
      const userId = await requireAuth(request, reply, deps.authenticate);
      if (userId === null) {
        return;
      }

      const params = taskParamsSchema.safeParse(request.params);
      if (!params.success) {
        return validationError(reply, params.error.issues);
      }

      const body = updateTaskBodySchema.safeParse(request.body);
      if (!body.success) {
        return validationError(reply, body.error.issues);
      }

      const organizationIdResult = createOrganizationId(params.data.organizationId);
      if (!organizationIdResult.ok) {
        return validationError(reply, [
          { path: ['organizationId'], message: 'Must be a valid UUID' },
        ]);
      }

      const result = await deps.taskService.updateTask(
        organizationIdResult.value,
        params.data.projectId,
        params.data.taskId,
        body.data,
        userId,
      );

      return sendResult(reply, result);
    },
  );
}