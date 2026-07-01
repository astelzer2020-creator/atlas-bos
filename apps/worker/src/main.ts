import { disconnectPrismaClient } from '@atlas/database';
import { ConfigValidationError } from '@atlas/platform';

import { createContainer } from './di/container.js';
import { createHealthServer } from './health.js';
import { registerAllWorkers } from './workers/index.js';

async function bootstrap(): Promise<void> {
  let container;

  try {
    container = await createContainer();
  } catch (error: unknown) {
    if (error instanceof ConfigValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const healthServer = createHealthServer({ container });
  const workers = registerAllWorkers(container);

  const shutdown = async (signal: string): Promise<void> => {
    container.logger.info('Shutting down worker', { signal });

    await Promise.all(workers.map(async (worker) => worker.stop()));
    await healthServer.stop();
    await container.eventBus.disconnect();
    await container.queueManager.close();
    await disconnectPrismaClient(container.prisma);

    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await container.eventBus.connect();
    await healthServer.start();

    for (const worker of workers) {
      await worker.start();
      container.logger.info('Worker processor started', { worker: worker.name });
    }

    container.logger.info('Atlas worker started', {
      host: container.config.workerHost,
      port: container.config.workerPort,
      nodeEnv: container.config.nodeEnv,
      kafkaMock: container.config.kafkaMock,
      workers: workers.map((worker) => worker.name),
    });
  } catch (error) {
    container.logger.fatal('Failed to start Atlas worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void bootstrap();
