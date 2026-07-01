import { ValidationError, type OrganizationId } from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { RagService } from '../application/services/rag.service.js';
import type { MemoryChunkRepository } from '../domain/repositories/memory-chunk.repository.js';
import type { KnowledgeRepository } from '../domain/repositories/knowledge.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;

function createRagService(
  memoryRepository: Partial<MemoryChunkRepository> = {},
  knowledgeRepository: Partial<KnowledgeRepository> = {},
) {
  const memoryChunkRepository: MemoryChunkRepository = {
    findById: vi.fn(),
    create: vi.fn(),
    softDelete: vi.fn(),
    list: vi.fn(),
    searchCandidates: vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        organizationId: ORG_ID,
        sourceType: 'chat',
        sourceId: '22222222-2222-2222-2222-222222222222',
        sourceVersion: 1,
        chunkIndex: 0,
        contentHash: 'hash1',
        textContent: 'Customer prefers email contact on Tuesdays.',
        tokenCount: 8,
        language: 'en',
        containsPii: false,
        importanceScore: 0.7,
        embedding: null,
        accessPolicy: {},
        entityRefs: [],
        metadata: {},
        lastAccessedAt: null,
        expiresAt: null,
        createdAt: new Date('2026-06-30T08:00:00Z'),
        updatedAt: new Date('2026-06-30T08:00:00Z'),
        version: 1,
      },
    ]),
    ...memoryRepository,
  };

  const knowledgeRepo: KnowledgeRepository = {
    findDocumentById: vi.fn(),
    createDocument: vi.fn(),
    updateDocumentStatus: vi.fn(),
    listDocuments: vi.fn(),
    replaceChunksForDocument: vi.fn(),
    listChunks: vi.fn(),
    searchChunkCandidates: vi.fn().mockResolvedValue([
      {
        id: '33333333-3333-3333-3333-333333333333',
        organizationId: ORG_ID,
        documentId: '44444444-4444-4444-4444-444444444444',
        chunkIndex: 0,
        contentHash: 'hash2',
        textContent: 'Atlas refund policy allows 30-day returns.',
        tokenCount: 9,
        embedding: null,
        metadata: {},
        createdAt: new Date('2026-06-30T08:00:00Z'),
      },
    ]),
    ...knowledgeRepository,
  };

  return new RagService({
    memoryChunkRepository,
    knowledgeRepository: knowledgeRepo,
  });
}

describe('RagService', () => {
  it('retrieveContext merges memory and knowledge keyword matches', async () => {
    const service = createRagService();

    const result = await service.retrieveContext(ORG_ID, {
      query: 'refund policy',
      limit: 5,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items.length).toBeGreaterThan(0);
      const sources = result.value.items.map((item) => item.source);
      expect(sources).toContain('knowledge');
    }
  });

  it('retrieveContext rejects empty query', async () => {
    const service = createRagService();

    const result = await service.retrieveContext(ORG_ID, { query: '  ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('formatContextForAgent produces numbered context sections', () => {
    const service = createRagService();

    const formatted = service.formatContextForAgent('customer contact', [
      {
        source: 'memory',
        id: '11111111-1111-1111-1111-111111111111',
        textContent: 'Customer prefers email.',
        score: 0.9,
        metadata: {},
      },
    ]);

    expect(formatted).toContain('Retrieved context for: "customer contact"');
    expect(formatted).toContain('[1] (Memory, score=0.90)');
    expect(formatted).toContain('Customer prefers email.');
  });

  it('retrieveContext returns empty message when no matches', async () => {
    const service = createRagService({
      searchCandidates: vi.fn().mockResolvedValue([]),
    });

    const result = await service.retrieveContext(ORG_ID, {
      query: 'nonexistent topic xyz',
      includeKnowledge: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(0);
      expect(result.value.contextText).toContain('No relevant context found');
    }
  });
});