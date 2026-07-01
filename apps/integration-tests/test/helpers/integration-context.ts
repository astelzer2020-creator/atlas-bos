import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import Redis from 'ioredis';

const execFileAsync = promisify(execFile);

export interface IntegrationContext {
  readonly dockerAvailable: boolean;
  readonly redisAvailable: boolean;
  readonly apiAvailable: boolean;
  readonly workerAvailable: boolean;
  readonly apiMetricsAvailable: boolean;
  readonly redisUrl: string;
  readonly apiBaseUrl: string;
  readonly workerBaseUrl: string;
}

let cachedContext: IntegrationContext | undefined;

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export async function detectDocker(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['info'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function probeRedis(url: string): Promise<boolean> {
  const client = new Redis(url, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  client.on('error', () => {
    // Suppress connection errors during availability probes.
  });

  try {
    await client.connect();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

async function probeHttp(
  baseUrl: string,
  path: string,
): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      signal: controller.signal,
    });

    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes REDIS_URL (default localhost:6379 from docker compose).
 * When Docker is unavailable, live Redis tests are skipped and mock fallbacks run.
 * Optional Testcontainers support: set INTEGRATION_USE_TESTCONTAINERS=true and
 * install @testcontainers/redis to spin an ephemeral broker (see phase-7 docs).
 */
async function resolveRedisUrl(): Promise<{ url: string; available: boolean }> {
  const configuredUrl = readEnv('REDIS_URL', 'redis://localhost:6379');
  const available = await probeRedis(configuredUrl);
  return { url: configuredUrl, available };
}

export async function initIntegrationContext(): Promise<IntegrationContext> {
  if (cachedContext !== undefined) {
    return cachedContext;
  }

  const dockerAvailable = await detectDocker();
  const apiBaseUrl = readEnv('API_BASE_URL', 'http://localhost:3001');
  const workerBaseUrl = readEnv(
    'WORKER_BASE_URL',
    `http://${readEnv('WORKER_HOST', '127.0.0.1')}:${readEnv('WORKER_PORT', '3002')}`,
  );

  const redisProbe = await resolveRedisUrl();
  const apiHealth = await probeHttp(apiBaseUrl, '/health');
  const workerHealth = await probeHttp(workerBaseUrl, '/health');
  const apiMetrics = await probeHttp(apiBaseUrl, '/metrics');

  cachedContext = {
    dockerAvailable,
    redisAvailable: redisProbe.available,
    apiAvailable: apiHealth.ok,
    workerAvailable: workerHealth.ok,
    apiMetricsAvailable: apiMetrics.ok && apiMetrics.status === 200,
    redisUrl: redisProbe.url,
    apiBaseUrl,
    workerBaseUrl,
  };

  return cachedContext;
}

export function getIntegrationContext(): IntegrationContext {
  if (cachedContext === undefined) {
    throw new Error('Integration context not initialized. Ensure test/setup.ts ran.');
  }

  return cachedContext;
}

export async function fetchJson(
  baseUrl: string,
  path: string,
): Promise<{ status: number; body: Record<string, unknown>; text: string }> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }

  return { status: response.status, body, text };
}