import { describe, expect, it } from 'vitest';

import { RedisCache } from '../src/redis/redis-cache.js';

class InMemoryRedis {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, mode?: string, ttl?: number): Promise<'OK'> {
    const expiresAt = mode === 'EX' && ttl !== undefined ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

describe('RedisCache', () => {
  it('stores and retrieves values with TTL prefix', async () => {
    const cache = new RedisCache(new InMemoryRedis() as never, {
      keyPrefix: 'atlas:test:',
      defaultTtlSeconds: 60,
    });

    await cache.set('event:01ARZ3NDEKTSV4RRFFQ69G5FAV', 'processed');
    expect(await cache.get('event:01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe('processed');
    expect(await cache.del('event:01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(1);
    expect(await cache.get('event:01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBeNull();
  });
});