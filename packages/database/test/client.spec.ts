import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => {
  class PrismaClient {
    $disconnect = vi.fn().mockResolvedValue(undefined);
    $extends = vi.fn().mockReturnThis();
    $executeRaw = vi.fn().mockResolvedValue(1);
    $transaction = vi.fn();
  }

  return {
    Prisma: {
      raw: (value: string) => value,
      defineExtension: (extension: unknown) => extension,
    },
    PrismaClient,
  };
});

import { createPrismaClient, disconnectPrismaClient } from '../src/client.js';
import { setOrganizationContext } from '../src/tenant-extension.js';

describe('@atlas/database client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createPrismaClient returns a Prisma client instance', () => {
    const client = createPrismaClient('postgresql://user:pass@localhost:5432/atlas_test');

    expect(client).toBeDefined();
    expect(typeof client.$disconnect).toBe('function');
    expect(typeof client.$extends).toBe('function');
  });

  it('disconnectPrismaClient calls $disconnect on the provided client', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const mockClient = { $disconnect: disconnect } as never;

    await disconnectPrismaClient(mockClient);

    expect(disconnect).toHaveBeenCalledOnce();
  });
});

describe('setOrganizationContext', () => {
  it('sets app.organization_id via set_config for the current transaction', async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(1);
    const mockClient = { $executeRawUnsafe: executeRawUnsafe } as never;
    const organizationId = '550e8400-e29b-41d4-a716-446655440000';

    await setOrganizationContext(mockClient, organizationId);

    expect(executeRawUnsafe).toHaveBeenCalledOnce();
    expect(executeRawUnsafe.mock.calls[0]?.[0]).toContain(organizationId);
    expect(executeRawUnsafe.mock.calls[0]?.[0]).toContain('app.organization_id');
  });

  it('clears organization context when organizationId is null', async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(1);
    const mockClient = { $executeRawUnsafe: executeRawUnsafe } as never;

    await setOrganizationContext(mockClient, null);

    expect(executeRawUnsafe).toHaveBeenCalledOnce();
    expect(executeRawUnsafe.mock.calls[0]?.[0]).toContain(
      "set_config('app.organization_id', '', true)",
    );
  });

  it('rejects invalid organization IDs', async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(1);
    const mockClient = { $executeRawUnsafe: executeRawUnsafe } as never;

    await expect(
      setOrganizationContext(mockClient, 'not-a-uuid'),
    ).rejects.toThrow('Invalid organization ID format');
  });
});