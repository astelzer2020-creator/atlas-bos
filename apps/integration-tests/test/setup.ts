import { beforeAll } from 'vitest';

import { initIntegrationContext } from './helpers/integration-context.js';

beforeAll(async () => {
  const context = await initIntegrationContext();

  console.info('[integration-tests] Service probe results:', {
    docker: context.dockerAvailable,
    redis: context.redisAvailable,
    api: context.apiAvailable,
    worker: context.workerAvailable,
    apiMetrics: context.apiMetricsAvailable,
  });
}, 60_000);