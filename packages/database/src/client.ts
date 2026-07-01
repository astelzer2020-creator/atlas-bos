import { PrismaClient } from '@prisma/client';

import { createTenantExtension } from './tenant-extension.js';

type AtlasPrismaClient = PrismaClient;

const globalForPrisma = globalThis as typeof globalThis & {
  __atlasPrisma?: AtlasPrismaClient;
};

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function withLoggingExtension(client: PrismaClient): PrismaClient {
  if (!isDevelopment()) {
    return client;
  }

  const extended = client.$extends({
    name: 'atlas-query-logging',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (operationArgs: unknown) => Promise<unknown>;
        }) {
          const start = performance.now();
          const result = await query(args);
          const durationMs = performance.now() - start;

          console.debug(
            `[prisma] ${model}.${operation} ${durationMs.toFixed(1)}ms`,
          );

          return result;
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

export function createPrismaClient(databaseUrl?: string): AtlasPrismaClient {
  const options: ConstructorParameters<typeof PrismaClient>[0] = {
    log: isDevelopment() ? ['warn', 'error'] : ['error'],
  };

  if (databaseUrl) {
    options.datasources = { db: { url: databaseUrl } };
  }

  const baseClient = new PrismaClient(options);

  const withTenant = baseClient.$extends(createTenantExtension());
  return withLoggingExtension(withTenant as unknown as PrismaClient);
}

export function getPrismaClient(): AtlasPrismaClient {
  if (!globalForPrisma.__atlasPrisma) {
    globalForPrisma.__atlasPrisma = createPrismaClient();
  }

  return globalForPrisma.__atlasPrisma;
}

/**
 * Singleton Prisma client for application use (lazy-initialized on first access).
 */
export const prisma: AtlasPrismaClient = new Proxy({} as AtlasPrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver) as unknown;

    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }

    return value;
  },
});

export async function disconnectPrismaClient(
  client: AtlasPrismaClient = getPrismaClient(),
): Promise<void> {
  await client.$disconnect();

  if (globalForPrisma.__atlasPrisma === client) {
    delete globalForPrisma.__atlasPrisma;
  }
}