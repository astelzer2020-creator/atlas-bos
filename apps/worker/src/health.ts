import http, { type Server } from 'node:http';

import { createPrometheusMetrics } from '@atlas/platform';

import type { WorkerContainer } from './di/container.js';

export interface HealthServerOptions {
  readonly container: WorkerContainer;
  readonly skipReadyCheck?: boolean;
}

export interface HealthServer {
  readonly server: Server;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const METRICS_EXCLUDED_PATHS = new Set(['/metrics', '/health', '/ready']);

export function createHealthServer(options: HealthServerOptions): HealthServer {
  const { container, skipReadyCheck = false } = options;
  const prometheusMetrics = createPrometheusMetrics({ serviceName: 'atlas-worker' });

  const server = http.createServer(async (request, response) => {
    const startedAt = process.hrtime.bigint();
    const url = request.url ?? '/';
    const path = url.split('?')[0] ?? url;

    const recordMetrics = (statusCode: number): void => {
      if (!container.config.prometheusEnabled || METRICS_EXCLUDED_PATHS.has(path)) {
        return;
      }

      const durationNs = process.hrtime.bigint() - startedAt;
      const durationSeconds = Number(durationNs) / 1_000_000_000;
      const labels = {
        method: request.method ?? 'GET',
        route: path,
        status_code: String(statusCode),
      } as const;

      prometheusMetrics.httpRequestsTotal.inc(labels);
      prometheusMetrics.httpRequestDurationSeconds.observe(labels, durationSeconds);
    };

    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Method not allowed' }));
      recordMetrics(405);
      return;
    }

    if (path === '/metrics' && container.config.prometheusEnabled) {
      const metricsBody = await prometheusMetrics.registry.metrics();
      response.writeHead(200, { 'Content-Type': prometheusMetrics.registry.contentType });
      response.end(metricsBody);
      return;
    }

    if (path === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          status: 'ok',
          service: 'atlas-worker',
          timestamp: new Date().toISOString(),
        }),
      );
      recordMetrics(200);
      return;
    }

    if (path === '/ready') {
      if (skipReadyCheck) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            status: 'ready',
            checks: { database: 'skipped' },
          }),
        );
        recordMetrics(200);
        return;
      }

      try {
        await container.prisma.$queryRaw`SELECT 1`;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            status: 'ready',
            checks: { database: 'ok' },
          }),
        );
        recordMetrics(200);
      } catch {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            status: 'not_ready',
            checks: { database: 'failed' },
          }),
        );
        recordMetrics(503);
      }
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
    recordMetrics(404);
  });

  return {
    server,
    async start(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(container.config.workerPort, container.config.workerHost, () => {
          server.off('error', reject);
          resolve();
        });
      });

      container.logger.info('Worker health server started', {
        host: container.config.workerHost,
        port: container.config.workerPort,
        prometheusEnabled: container.config.prometheusEnabled,
      });
    },
    async stop(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
