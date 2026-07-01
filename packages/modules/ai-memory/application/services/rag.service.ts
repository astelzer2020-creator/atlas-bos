import {
  err,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
} from '@atlas/shared-kernel';

import type { MemoryChunkRepository, MemorySourceType } from '../../domain/repositories/memory-chunk.repository.js';
import type { KnowledgeRepository } from '../../domain/repositories/knowledge.repository.js';
import { rankByHybridSearch } from '../../domain/utils/hybrid-search.js';

export interface RagRetrievalItem {
  readonly source: 'memory' | 'knowledge';
  readonly id: string;
  readonly textContent: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
}

export interface RagContextResult {
  readonly query: string;
  readonly items: RagRetrievalItem[];
  readonly contextText: string;
}

export interface RetrieveContextInput {
  readonly query: string;
  readonly sourceTypes?: MemorySourceType[];
  readonly includeKnowledge?: boolean;
  readonly limit?: number;
  readonly minScore?: number;
}

export interface RagServiceDeps {
  readonly memoryChunkRepository: MemoryChunkRepository;
  readonly knowledgeRepository: KnowledgeRepository;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export class RagService {
  constructor(private readonly deps: RagServiceDeps) {}

  async retrieveContext(
    organizationId: OrganizationId,
    input: RetrieveContextInput,
  ): Promise<Result<RagContextResult, ValidationError>> {
    const query = input.query.trim();
    if (query.length === 0) {
      return err(new ValidationError('RAG query is required', { field: 'query' }));
    }

    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const minScore = input.minScore ?? 0;
    const includeKnowledge = input.includeKnowledge !== false;

    const items: RagRetrievalItem[] = [];

    const memoryCandidates = await this.deps.memoryChunkRepository.searchCandidates(
      organizationId,
      input.sourceTypes,
    );

    const memoryRanked = rankByHybridSearch(
      memoryCandidates,
      query,
      (chunk) => chunk.textContent,
      (chunk) => chunk.embedding,
      { minScore },
    );

    for (const result of memoryRanked) {
      items.push({
        source: 'memory',
        id: result.item.id,
        textContent: result.item.textContent,
        score: result.score,
        metadata: {
          sourceType: result.item.sourceType,
          sourceId: result.item.sourceId,
          ...result.item.metadata,
        },
      });
    }

    if (includeKnowledge) {
      const knowledgeCandidates = await this.deps.knowledgeRepository.searchChunkCandidates(
        organizationId,
      );

      const knowledgeRanked = rankByHybridSearch(
        knowledgeCandidates,
        query,
        (chunk) => chunk.textContent,
        (chunk) => chunk.embedding,
        { minScore },
      );

      for (const result of knowledgeRanked) {
        items.push({
          source: 'knowledge',
          id: result.item.id,
          textContent: result.item.textContent,
          score: result.score,
          metadata: {
            documentId: result.item.documentId,
            chunkIndex: result.item.chunkIndex,
            ...result.item.metadata,
          },
        });
      }
    }

    const sorted = items.sort((a, b) => b.score - a.score).slice(0, limit);
    const contextText = this.formatContextForAgent(query, sorted);

    return ok({
      query,
      items: sorted,
      contextText,
    });
  }

  formatContextForAgent(query: string, items: readonly RagRetrievalItem[]): string {
    if (items.length === 0) {
      return `No relevant context found for query: "${query}"`;
    }

    const sections = items.map((item, index) => {
      const label = item.source === 'memory' ? 'Memory' : 'Knowledge';
      return `[${index + 1}] (${label}, score=${item.score.toFixed(2)})\n${item.textContent}`;
    });

    return [
      `Retrieved context for: "${query}"`,
      '',
      ...sections,
      '',
      'Use the above context to inform your response. Cite section numbers when referencing facts.',
    ].join('\n');
  }
}