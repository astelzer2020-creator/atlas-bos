import type { Redis } from 'ioredis';

export interface RedisCacheOptions {
  readonly keyPrefix?: string;
  readonly defaultTtlSeconds?: number;
}

/** Redis-backed cache with TTL support for event dedup and read models. */
export class RedisCache {
  private readonly client: Redis;
  private readonly keyPrefix: string;
  private readonly defaultTtlSeconds: number;

  constructor(client: Redis, options: RedisCacheOptions = {}) {
    this.client = client;
    this.keyPrefix = options.keyPrefix ?? 'atlas:cache:';
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 300;
  }

  private resolveKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.resolveKey(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const resolvedKey = this.resolveKey(key);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;

    if (ttl > 0) {
      await this.client.set(resolvedKey, value, 'EX', ttl);
      return;
    }

    await this.client.set(resolvedKey, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(this.resolveKey(key));
  }
}