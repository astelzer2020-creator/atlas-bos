import {
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeBaseService } from '../application/services/knowledge-base.service.js';
import type {
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeRepository,
} from '../domain/repositories/knowledge.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const DOCUMENT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createDocumentRecord(
  overrides: Partial<KnowledgeDocumentRecord> = {},
): KnowledgeDocumentRecord {
  return {
    id: DOCUMENT_ID,
    organizationId: ORG_ID,
    title: 'Product Guide',
    description: null,
    sourceType: 'upload',
    sourceUri: null,
    contentType: 'text/plain',
    rawContent: 'Paragraph one.\n\nParagraph two about Atlas.',
    status: 'pending',
    chunkCount: 0,
    metadata: {},
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createChunkRecord(overrides: Partial<KnowledgeChunkRecord> = {}): KnowledgeChunkRecord {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: ORG_ID,
    documentId: DOCUMENT_ID,
    chunkIndex: 0,
    contentHash: 'hash1',
    textContent: 'Paragraph one.',
    tokenCount: 3,
    embedding: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:01:00Z'),
    ...overrides,
  };
}

function createKnowledgeService(repository: Partial<KnowledgeRepository> = {}) {
  const knowledgeRepository: KnowledgeRepository = {
    findDocumentById: vi.fn().mockResolvedValue(null),
    createDocument: vi.fn().mockResolvedValue(createDocumentRecord()),
    updateDocumentStatus: vi
      .fn()
      .mockResolvedValue(createDocumentRecord({ status: 'ready', chunkCount: 2 })),
    listDocuments: vi.fn().mockResolvedValue([createDocumentRecord()]),
    replaceChunksForDocument: vi.fn().mockResolvedValue([
      createChunkRecord(),
      createChunkRecord({
        id: '22222222-2222-2222-2222-222222222222',
        chunkIndex: 1,
        textContent: 'Paragraph two about Atlas.',
      }),
    ]),
    listChunks: vi.fn().mockResolvedValue([createChunkRecord()]),
    searchChunkCandidates: vi.fn().mockResolvedValue([createChunkRecord()]),
    ...repository,
  };

  return {
    service: new KnowledgeBaseService({ knowledgeRepository }),
    knowledgeRepository,
  };
}

describe('KnowledgeBaseService', () => {
  it('uploadDocument creates document metadata', async () => {
    const { service, knowledgeRepository } = createKnowledgeService();

    const result = await service.uploadDocument(
      ORG_ID,
      {
        title: 'Product Guide',
        rawContent: 'Paragraph one.\n\nParagraph two.',
        autoChunk: false,
      },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    expect(knowledgeRepository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        title: 'Product Guide',
      }),
    );
  });

  it('uploadDocument rejects empty title', async () => {
    const { service } = createKnowledgeService();

    const result = await service.uploadDocument(ORG_ID, { title: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('chunkDocument splits content by paragraphs', async () => {
    const { service, knowledgeRepository } = createKnowledgeService({
      findDocumentById: vi.fn().mockResolvedValue(createDocumentRecord()),
    });

    const result = await service.chunkDocument(ORG_ID, DOCUMENT_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks).toHaveLength(2);
      expect(result.value.document.status).toBe('ready');
      expect(result.value.document.chunkCount).toBe(2);
    }

    expect(knowledgeRepository.replaceChunksForDocument).toHaveBeenCalledWith(
      ORG_ID,
      DOCUMENT_ID,
      expect.arrayContaining([
        expect.objectContaining({ chunkIndex: 0, textContent: 'Paragraph one.' }),
        expect.objectContaining({ chunkIndex: 1, textContent: 'Paragraph two about Atlas.' }),
      ]),
    );
  });

  it('chunkDocument returns not found for missing document', async () => {
    const { service } = createKnowledgeService();

    const result = await service.chunkDocument(ORG_ID, DOCUMENT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('listChunks filters by keyword query', async () => {
    const { service } = createKnowledgeService({
      listChunks: vi.fn().mockResolvedValue([
        createChunkRecord({ textContent: 'Atlas platform overview' }),
        createChunkRecord({
          id: '33333333-3333-3333-3333-333333333333',
          textContent: 'Billing policy details',
        }),
      ]),
    });

    const result = await service.listChunks(ORG_ID, { query: 'Atlas' });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.textContent).toContain('Atlas');
  });
});