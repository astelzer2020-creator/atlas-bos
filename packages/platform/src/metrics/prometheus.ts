import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

export interface PrometheusMetricsOptions {
  readonly serviceName: string;
  readonly registry?: Registry;
  readonly enabled?: boolean;
  readonly excludePaths?: readonly string[];
  /** When false, skips process-level default metrics (recommended in tests). */
  readonly collectProcessMetrics?: boolean;
}

export interface PrometheusMetrics {
  readonly registry: Registry;
  readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  readonly httpRequestDurationSeconds: Histogram<'method' | 'route' | 'status_code'>;
}

const DEFAULT_EXCLUDE_PATHS = ['/metrics', '/health', '/ready'] as const;

function normalizeRoute(request: FastifyRequest): string {
  const routePath = request.routeOptions.url;
  if (typeof routePath === 'string' && routePath.length > 0) {
    return routePath;
  }

  const urlPath = request.url.split('?')[0] ?? request.url;
  return urlPath;
}

function shouldExcludePath(path: string, excludePaths: readonly string[]): boolean {
  return excludePaths.some((excluded) => path === excluded || path.startsWith(`${excluded}/`));
}

/**
 * Creates Prometheus HTTP metrics collectors for Atlas services.
 */
export function createPrometheusMetrics(options: PrometheusMetricsOptions): PrometheusMetrics {
  const registry = options.registry ?? new Registry();
  const serviceName = options.serviceName;

  registry.setDefaultLabels({ service: serviceName });

  if (options.collectProcessMetrics !== false) {
    collectDefaultMetrics({ register: registry });
  }

  const metricPrefix = serviceName.replace(/-/g, '_');

  const httpRequestsTotal = new Counter({
    name: `${metricPrefix}_http_requests_total`,
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: `${metricPrefix}_http_request_duration_seconds`,
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  return {
    registry,
    httpRequestsTotal,
    httpRequestDurationSeconds,
  };
}

/**
 * Registers Fastify hooks that record request counters and latency histograms.
 */
export function registerPrometheusMiddleware(
  app: FastifyInstance,
  metrics: PrometheusMetrics,
  options: Pick<PrometheusMetricsOptions, 'enabled' | 'excludePaths'> = {},
): void {
  if (options.enabled === false) {
    return;
  }

  const excludePaths = options.excludePaths ?? DEFAULT_EXCLUDE_PATHS;

  app.addHook('onRequest', (request) => {
    request.prometheusStartTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', (request, reply) => {
    const route = normalizeRoute(request);
    if (shouldExcludePath(route, excludePaths)) {
      return;
    }

    const startedAt = request.prometheusStartTime;
    if (startedAt === undefined) {
      return;
    }

    const durationNs = process.hrtime.bigint() - startedAt;
    const durationSeconds = Number(durationNs) / 1_000_000_000;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    } as const;

    metrics.httpRequestsTotal.inc(labels);
    metrics.httpRequestDurationSeconds.observe(labels, durationSeconds);
  });
}

/**
 * Registers a GET /metrics endpoint that exposes Prometheus text format.
 */
export function registerMetricsRoute(
  app: FastifyInstance,
  metrics: PrometheusMetrics,
  options: Pick<PrometheusMetricsOptions, 'enabled'> = {},
): void {
  if (options.enabled === false) {
    return;
  }

  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const body = await metrics.registry.metrics();
    return reply.type(metrics.registry.contentType).send(body);
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    prometheusStartTime?: bigint;
  }
}