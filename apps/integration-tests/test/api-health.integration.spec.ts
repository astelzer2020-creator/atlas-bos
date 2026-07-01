import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../api/src/app.js';
import {
  fetchJson,
  getIntegrationContext,
} from './helpers/integration-context.js';
import { createMockApiContainer } from './helpers/mock-containers.js';

describe('API health (in-process mock)', () => {
  let app: Awaited<ReturnType<typeof createApp>> | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /health returns ok status', async () => {
    const container = await createMockApiContainer();
    app = await createApp({ container, skipReadyCheck: true });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-api');
  });

  it('GET /ready returns ready when database check is skipped', async () => {
    const container = await createMockApiContainer();
    app = await createApp({ container, skipReadyCheck: true });

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; checks: { database: string } };
    expect(body.status).toBe('ready');
    expect(body.checks.database).toBe('skipped');
  });

  it(
    'GET /metrics exposes Prometheus text when enabled',
    async () => {
      const container = await createMockApiContainer(true);
      app = await createApp({ container, skipReadyCheck: true });

      const response = await app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('atlas_api_http_requests_total');
    },
    90_000,
  );
});

describe('API health (live service)', () => {
  const ctx = () => getIntegrationContext();

  it.skipIf(() => !ctx().apiAvailable)('GET /health on running API', async () => {
    const { status, body } = await fetchJson(ctx().apiBaseUrl, '/health');

    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-api');
  });

  it.skipIf(() => !ctx().apiAvailable)('GET /ready on running API', async () => {
    const { status, body } = await fetchJson(ctx().apiBaseUrl, '/ready');

    expect(status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.checks).toBeDefined();
  });

  it.skipIf(() => !ctx().apiMetricsAvailable)(
    'GET /metrics on running API when Prometheus is enabled',
    async () => {
      const response = await fetch(`${ctx().apiBaseUrl}/metrics`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(text).toContain('atlas_api_http_requests_total');
    },
  );
});