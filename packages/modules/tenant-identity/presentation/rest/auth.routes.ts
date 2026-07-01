import { mapDomainErrorToHttp } from '@atlas/platform';
import { createSessionId, parseUserId } from '@atlas/shared-kernel';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  loginRequestSchema,
  mfaVerifyRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from '../../application/dto/auth.dto.js';
import type { AuthService } from '../../application/services/auth.service.js';

export interface AuthRouteContext {
  readonly userId?: string;
  readonly sessionId?: string;
}

export interface AuthRoutesDeps {
  readonly authService: AuthService;
  readonly authenticate?: (
    request: FastifyRequest,
  ) => Promise<AuthRouteContext | null>;
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

export async function registerAuthRoutes(
  fastify: FastifyInstance,
  deps: AuthRoutesDeps,
): Promise<void> {
  fastify.post('/v1/auth/register', async (request, reply) => {
    const parsed = registerRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({
        type: 'https://api.atlas.example.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request validation failed',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          code: 'validation_failed',
          message: issue.message,
        })),
      });
    }

    const result = await deps.authService.register(parsed.data);
    return sendResult(reply, result, 201);
  });

  fastify.post('/v1/auth/login', async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({
        type: 'https://api.atlas.example.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request validation failed',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          code: 'validation_failed',
          message: issue.message,
        })),
      });
    }

    const result = await deps.authService.login(parsed.data, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    return sendResult(reply, result, 200);
  });

  fastify.post('/v1/auth/mfa/verify', async (request, reply) => {
    const parsed = mfaVerifyRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({
        type: 'https://api.atlas.example.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request validation failed',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          code: 'validation_failed',
          message: issue.message,
        })),
      });
    }

    const result = await deps.authService.verifyMfa(parsed.data);
    return sendResult(reply, result, 200);
  });

  fastify.post('/v1/auth/refresh', async (request, reply) => {
    const body = refreshRequestSchema.safeParse(request.body);
    const cookieToken = (
      request as FastifyRequest & { cookies?: Record<string, string | undefined> }
    ).cookies?.['atlas_refresh'];

    const refreshToken = body.success ? body.data.refresh_token ?? cookieToken : cookieToken;

    const result = await deps.authService.refreshToken({ refresh_token: refreshToken });
    return sendResult(reply, result, 200);
  });

  fastify.post('/v1/auth/logout', async (request, reply) => {
    if (deps.authenticate === undefined) {
      return reply.status(401).send({
        type: 'https://api.atlas.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      });
    }

    const authContext = await deps.authenticate(request);

    if (authContext?.sessionId === undefined) {
      return reply.status(401).send({
        type: 'https://api.atlas.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid session required',
      });
    }

    const sessionIdResult = createSessionId(authContext.sessionId);
    if (!sessionIdResult.ok) {
      return reply.status(401).send({
        type: 'https://api.atlas.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid session',
      });
    }

    const result = await deps.authService.logout(sessionIdResult.value);

    if (!result.ok) {
      const httpError = mapDomainErrorToHttp(result.error);
      return reply.status(httpError.status).send(httpError.toProblemDetails());
    }

    return reply.status(204).send();
  });

  fastify.get('/v1/auth/me', async (request, reply) => {
    if (deps.authenticate === undefined) {
      return reply.status(401).send({
        type: 'https://api.atlas.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      });
    }

    const authContext = await deps.authenticate(request);

    if (authContext?.userId === undefined) {
      return reply.status(401).send({
        type: 'https://api.atlas.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      });
    }

    const userIdResult = parseUserId(authContext.userId);
    if (!userIdResult.ok) {
      return reply.status(401).send({
        type: 'https://api.atlas.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid user context',
      });
    }

    const result = await deps.authService.getCurrentUser(userIdResult.value);
    return sendResult(reply, result, 200);
  });
}