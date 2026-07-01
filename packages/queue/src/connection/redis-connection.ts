import { Redis } from 'ioredis';

export type RedisConnection = Redis;

/**
 * Creates an ioredis connection configured for BullMQ workers and queues.
 * `maxRetriesPerRequest` must be null for BullMQ blocking commands.
 */
export function createRedisConnection(redisUrl: string): RedisConnection {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}