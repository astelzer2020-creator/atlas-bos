import {
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { MemoryService } from '../application/services/memory.service.js';
import type {
  MemoryChunkRecord,
  MemoryChunkRepository,
} from '../domain/repositories/memory-chunk.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const CHUNK_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SOURCE_ID = '22222222-2222-2222-2222-222222222222';

function createChunkRecord(overrides: Partial<MemoryChunkRecord> = {}): MemoryChunkRecord {
  return {
    id: CHUNK_ID,
    organizationId: ORG_ID,
    sourceType: 'user_explicit',
    sourceId: SOURCE_ID,
    sourceVersion: 1,
    chunkIndex: 0,
    contentHash: 'abc123',
    textContent: 'Atlas BOS is a business operating system.',
    tokenCount: 10,
    language: 'en',
    containsPii: false,
    importanceScore: 0.5,
    embedding: null,
    accessPolicy: {},
    entityRefs: [],
    metadata: {},
    lastAccessedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createMemoryService(repository: Partial<MemoryChunkRepository> = {}) {
  const memoryChunkRepository: MemoryChunkRepository = {
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(createChunkRecord()),
    softDelete: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([createChunkRecord()]),
    searchCandidates: vi.fn().mockResolvedValue([
      createChunkRecord({ textContent: 'Atlas BOS platform features' }),
      createChunkRecord({
        id: '33333333-3333-3333-3333-333333333333',
        textContent: 'Unrelated finance ledger entry',
      }),
    ]),
    ...repository,
  };

  return {
    service: new MemoryService({ memoryChunkRepository }),
    memoryChunkRepository,
  };
}

describe('MemoryService', () => {
  it('storeChunk persists text content with content hash', async () => {
    const { service, memoryChunkRepository } = createMemoryService();

    const result = await service.storeChunk(
      ORG_ID,
      {
        sourceType: 'user_explicit',
        textContent: 'Atlas BOS is a business operating system.',
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    expect(memoryChunkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        sourceType: 'user_explicit',
        textContent: 'Atlas BOS is a business operating system.',
        contentHash: expect.any(String),
      }),
    );
  });

  it('storeChunk rejects empty text content', async () => {
    const { service } = createMemoryService();

    const result = await service.storeChunk(ORG_ID, {
      sourceType: 'chat',
      textContent: '  ',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('searchChunks ranks keyword matches by relevance', async () => {
    const { service } = createMemoryService();

    const result = await service.searchChunks(ORG_ID, {
      query: 'Atlas BOS',
      limit: 5,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.results.length).toBeGreaterThan(0);
      expect(result.value.results[0]?.chunk.textContent).toContain('Atlas');
      expect(result.value.results[0]?.score).toBeGreaterThan(0);
    }
  });

  it('deleteChunk soft-deletes existing chunk', async () => {
    const { service, memoryChunkRepository } = createMemoryService({
      softDelete: vi.fn().mockResolvedValue(true),
    });

    const result = await service.deleteChunk(ORG_ID, CHUNK_ID);

    expect(result.ok).toBe(true);
    expect(memoryChunkRepository.softDelete).toHaveBeenCalledWith(ORG_ID, CHUNK_ID);
  });

  it('getChunk returns not found for missing chunk', async () => {
    const { service } = createMemoryService();

    const result = await service.getChunk(ORG_ID, CHUNK_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});