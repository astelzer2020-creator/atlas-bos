import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createHealthServer } from '../../worker/src/health.js';
import {
  fetchJson,
  getIntegrationContext,
} from './helpers/integration-context.js';
import { createMockWorkerContainer } from './helpers/mock-containers.js';

function resolveListeningPort(
  healthServer: ReturnType<typeof createHealthServer>,
  fallbackPort: number,
): number {
  const address = healthServer.server.address();
  if (typeof address === 'object' && address !== null) {
    return (address as AddressInfo).port;
  }

  return fallbackPort;
}

describe('Worker health (in-process mock)', () => {
  let healthServer: ReturnType<typeof createHealthServer> | undefined;
  let container: Awaited<ReturnType<typeof createMockWorkerContainer>> | undefined;

  afterEach(async () => {
    if (healthServer !== undefined) {
      await healthServer.stop();
      healthServer = undefined;
    }

    if (container !== undefined) {
      await container.eventBus.disconnect();
      await container.queueManager.close();
      container = undefined;
    }
  });

  it('GET /health returns ok status', async () => {
    container = await createMockWorkerContainer(0);
    healthServer = createHealthServer({ container, skipReadyCheck: true });
    await healthServer.start();

    const port = resolveListeningPort(healthServer, container.config.workerPort);
    const { status, body } = await fetchJson(`http://127.0.0.1:${port}`, '/health');

    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-worker');
  });

  it('GET /ready returns ready when database check is skipped', async () => {
    container = await createMockWorkerContainer(0);
    healthServer = createHealthServer({ container, skipReadyCheck: true });
    await healthServer.start();

    const port = resolveListeningPort(healthServer, container.config.workerPort);
    const { status, body } = await fetchJson(`http://127.0.0.1:${port}`, '/ready');

    expect(status).toBe(200);
    expect(body.status).toBe('ready');
    expect((body.checks as { database: string }).database).toBe('skipped');
  });
});

describe('Worker health (live service)', () => {
  const ctx = () => getIntegrationContext();

  it.skipIf(() => !ctx().workerAvailable)('GET /health on running worker', async () => {
    const { status, body } = await fetchJson(ctx().workerBaseUrl, '/health');

    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-worker');
  });

  it.skipIf(() => !ctx().workerAvailable)('GET /ready on running worker', async () => {
    const { status, body } = await fetchJson(ctx().workerBaseUrl, '/ready');

    expect(status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.checks).toBeDefined();
  });
});