import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  createPrometheusMetrics,
  registerMetricsRoute,
  registerPrometheusMiddleware,
} from '../src/metrics/prometheus.js';

describe('Prometheus metrics route', () => {
  it('exposes HTTP metrics in Prometheus text format', async () => {
    const app = Fastify({ logger: false });
    const metrics = createPrometheusMetrics({
      serviceName: 'atlas-api',
      collectProcessMetrics: false,
    });

    registerMetricsRoute(app, metrics, { enabled: true });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('atlas_api_http_requests_total');

    await app.close();
  });
});