import { mapDomainErrorToHttp } from '@atlas/platform';
import {
  createOrganizationId,
  parseUserId,
} from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { FileService } from '../../application/services/file.service.js';
import type { FolderService } from '../../application/services/folder.service.js';
import type { FileId } from '../../domain/repositories/file.repository.js';

const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

const fileParamsSchema = organizationParamsSchema.extend({
  fileId: z.string().uuid(),
});

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  parent_folder_id: z.string().uuid().optional(),
  workspace_id: z.string().uuid().optional(),
  folder_id: z.string().uuid().optional(),
  status: z
    .enum([
      'pending',
      'uploading',
      'scanning',
      'clean',
      'infected',
      'quarantined',
      'rejected',
      'deleted',
    ])
    .optional(),
  is_starred: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .optional(),
});

const createFolderBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64),
  parent_folder_id: z.string().uuid().optional(),
  workspace_id: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const initiateUploadBodySchema = z.object({
  original_name: z.string().min(1).max(512),
  mime_type: z.string().min(1).max(255),
  size_bytes: z.string().regex(/^\d+$/),
  folder_id: z.string().uuid().optional(),
  sensitivity_class: z.enum(['public', 'standard', 'restricted', 'confidential']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const completeUploadBodySchema = z.object({
  upload_id: z.string().uuid(),
  file_id: z.string().uuid(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  change_summary: z.string().max(2000).optional(),
});

const createShareLinkBodySchema = z.object({
  grantee_type: z.enum(['user', 'team', 'role', 'workspace']),
  grantee_id: z.string().uuid(),
  permission: z.enum(['read', 'write', 'delete', 'share', 'admin']),
  expires_at: z.string().datetime().optional(),
  link_ttl_seconds: z.coerce.number().int().min(1).max(604_800).optional(),
});

export interface StorageRouteContext {
  readonly userId: string;
}

export interface StorageRoutesDeps {
  readonly folderService: FolderService;
  readonly fileService: FileService;
  readonly authenticate: (request: FastifyRequest) => Promise<StorageRouteContext | null>;
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
  authenticate: StorageRoutesDeps['authenticate'],
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

export async function registerStorageRoutes(
  fastify: FastifyInstance,
  deps: StorageRoutesDeps,
): Promise<void> {
  fastify.get('/v1/organizations/:organizationId/folders', async (request, reply) => {
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

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.folderService.listFolders(orgIdResult.value, userId, {
      limit: query.data.limit,
      ...(query.data.workspace_id !== undefined ? { workspaceId: query.data.workspace_id } : {}),
      ...(query.data.parent_folder_id !== undefined
        ? { parentFolderId: query.data.parent_folder_id }
        : {}),
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(200).send({
      data: result.value.map((folder) => ({ object: 'folder', ...folder })),
      pagination: {
        has_more: result.value.length === query.data.limit,
        next_cursor: result.value.at(-1)?.id ?? null,
        prev_cursor: null,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/organizations/:organizationId/folders', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createFolderBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.folderService.createFolder(
      orgIdResult.value,
      {
        name: body.data.name,
        slug: body.data.slug,
        ...(body.data.parent_folder_id !== undefined
          ? { parent_folder_id: body.data.parent_folder_id }
          : {}),
        ...(body.data.workspace_id !== undefined ? { workspace_id: body.data.workspace_id } : {}),
        ...(body.data.description !== undefined ? { description: body.data.description } : {}),
        ...(body.data.color !== undefined ? { color: body.data.color } : {}),
        ...(body.data.metadata !== undefined ? { metadata: body.data.metadata } : {}),
      },
      userId,
    );

    return sendResult(reply, result, 201, true);
  });

  fastify.get('/v1/organizations/:organizationId/files', async (request, reply) => {
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

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.listFiles(orgIdResult.value, userId, {
      limit: query.data.limit,
      ...(query.data.folder_id !== undefined ? { folderId: query.data.folder_id } : {}),
      ...(query.data.status !== undefined ? { status: query.data.status } : {}),
      ...(query.data.is_starred !== undefined ? { isStarred: query.data.is_starred } : {}),
      ...(query.data.cursor !== undefined ? { cursor: query.data.cursor } : {}),
    });

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(200).send({
      data: result.value.map((file) => ({ object: 'file', ...file })),
      pagination: {
        has_more: result.value.length === query.data.limit,
        next_cursor: result.value.at(-1)?.id ?? null,
        prev_cursor: null,
        limit: query.data.limit,
      },
    });
  });

  fastify.post('/v1/organizations/:organizationId/files', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = initiateUploadBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.initiateUpload(
      orgIdResult.value,
      {
        original_name: body.data.original_name,
        mime_type: body.data.mime_type,
        size_bytes: body.data.size_bytes,
        ...(body.data.folder_id !== undefined ? { folder_id: body.data.folder_id } : {}),
        ...(body.data.sensitivity_class !== undefined
          ? { sensitivity_class: body.data.sensitivity_class }
          : {}),
        ...(body.data.metadata !== undefined ? { metadata: body.data.metadata } : {}),
      },
      userId,
    );

    return sendResult(reply, result, 201, true);
  });

  fastify.post('/v1/organizations/:organizationId/files/upload/initiate', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = initiateUploadBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.initiateUpload(
      orgIdResult.value,
      {
        original_name: body.data.original_name,
        mime_type: body.data.mime_type,
        size_bytes: body.data.size_bytes,
        ...(body.data.folder_id !== undefined ? { folder_id: body.data.folder_id } : {}),
        ...(body.data.sensitivity_class !== undefined
          ? { sensitivity_class: body.data.sensitivity_class }
          : {}),
        ...(body.data.metadata !== undefined ? { metadata: body.data.metadata } : {}),
      },
      userId,
    );

    return sendResult(reply, result, 201, true);
  });

  fastify.post('/v1/organizations/:organizationId/files/upload/complete', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = organizationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = completeUploadBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.completeUpload(
      orgIdResult.value,
      {
        upload_id: body.data.upload_id,
        file_id: body.data.file_id,
        content_hash: body.data.content_hash,
        ...(body.data.change_summary !== undefined
          ? { change_summary: body.data.change_summary }
          : {}),
      },
      userId,
    );

    return sendResult(reply, result, 200, true);
  });

  fastify.get('/v1/organizations/:organizationId/files/:fileId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = fileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.getFile(
      orgIdResult.value,
      params.data.fileId as FileId,
      userId,
    );

    return sendResult(reply, result, 200, true);
  });

  fastify.delete('/v1/organizations/:organizationId/files/:fileId', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = fileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.deleteFile(
      orgIdResult.value,
      params.data.fileId as FileId,
      userId,
    );

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(204).send();
  });

  fastify.post('/v1/organizations/:organizationId/files/:fileId/share', async (request, reply) => {
    const userId = await requireAuth(request, reply, deps.authenticate);
    if (userId === null) {
      return;
    }

    const params = fileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return validationError(reply, params.error.issues);
    }

    const body = createShareLinkBodySchema.safeParse(request.body);
    if (!body.success) {
      return validationError(reply, body.error.issues);
    }

    const orgIdResult = createOrganizationId(params.data.organizationId);
    if (!orgIdResult.ok) {
      return validationError(reply, [{ path: ['organizationId'], message: orgIdResult.error.message }]);
    }

    const result = await deps.fileService.createShareLink(
      orgIdResult.value,
      params.data.fileId as FileId,
      {
        grantee_type: body.data.grantee_type,
        grantee_id: body.data.grantee_id,
        permission: body.data.permission,
        ...(body.data.expires_at !== undefined ? { expires_at: body.data.expires_at } : {}),
        ...(body.data.link_ttl_seconds !== undefined
          ? { link_ttl_seconds: body.data.link_ttl_seconds }
          : {}),
      },
      userId,
    );

    return sendResult(reply, result, 201, true);
  });
}