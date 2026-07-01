import { configureTenantContextResolver, disconnectPrismaClient } from '@atlas/database';
import { ConfigValidationError, getTenantContext } from '@atlas/platform';

import { createApp } from './app.js';
import { createContainer } from './di/container.js';

async function bootstrap(): Promise<void> {
  configureTenantContextResolver(() => getTenantContext()?.organizationId);

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

  const app = await createApp({ container });

  const shutdown = async (signal: string): Promise<void> => {
    container.logger.info('Shutting down', { signal });
    await app.close();
    await disconnectPrismaClient(container.prisma);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({
      host: container.config.apiHost,
      port: container.config.apiPort,
    });

    container.logger.info('API server started', {
      host: container.config.apiHost,
      port: container.config.apiPort,
      nodeEnv: container.config.nodeEnv,
    });
  } catch (error) {
    container.logger.fatal('Failed to start API server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void bootstrap();