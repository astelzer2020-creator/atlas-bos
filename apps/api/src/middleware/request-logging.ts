import type { FastifyInstance } from 'fastify';

export function registerRequestLogging(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    app.container.logger.info('Request completed', {
      correlationId: request.correlationId,
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: reply.elapsedTime,
    });
  });
}