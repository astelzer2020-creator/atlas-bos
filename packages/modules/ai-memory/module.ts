import type { PrismaClient } from '@atlas/database';
import type { Logger } from '@atlas/platform';

import { ConversationService } from './application/services/conversation.service.js';
import { KnowledgeBaseService } from './application/services/knowledge-base.service.js';
import { MemoryService } from './application/services/memory.service.js';
import { RagService } from './application/services/rag.service.js';
import { PrismaConversationRepository } from './infrastructure/persistence/prisma-conversation.repository.js';
import { PrismaKnowledgeRepository } from './infrastructure/persistence/prisma-knowledge.repository.js';
import { PrismaMemoryChunkRepository } from './infrastructure/persistence/prisma-memory-chunk.repository.js';

export { ConversationService } from './application/services/conversation.service.js';
export { KnowledgeBaseService } from './application/services/knowledge-base.service.js';
export { MemoryService } from './application/services/memory.service.js';
export { RagService } from './application/services/rag.service.js';
export { registerAiMemoryRoutes } from './presentation/rest/ai-memory.routes.js';
export { generateLocalEmbedding } from './domain/utils/embedding.js';
export { rankByHybridSearch } from './domain/utils/hybrid-search.js';
export { cosineSimilarity, rankBySemanticSimilarity } from './domain/utils/semantic-search.js';

export type { AiMemoryRoutesDeps } from './presentation/rest/ai-memory.routes.js';
export type {
  ConversationSessionDto,
  ConversationDetailDto,
  ConversationMessageDto,
  CreateConversationInput,
} from './application/services/conversation.service.js';
export type {
  MemoryChunkDto,
  StoreMemoryChunkInput,
  SearchMemoryChunksInput,
} from './application/services/memory.service.js';
export type {
  KnowledgeDocumentDto,
  KnowledgeChunkDto,
  UploadKnowledgeDocumentInput,
} from './application/services/knowledge-base.service.js';
export type { RagContextResult, RetrieveContextInput } from './application/services/rag.service.js';

export interface AiMemoryModuleOptions {
  readonly prisma: PrismaClient;
  readonly logger?: Logger;
}

export interface AiMemoryModule {
  readonly conversationService: ConversationService;
  readonly memoryService: MemoryService;
  readonly knowledgeBaseService: KnowledgeBaseService;
  readonly ragService: RagService;
}

/**
 * Wires AI memory bounded context services with Prisma repositories.
 */
export function createAiMemoryModule(options: AiMemoryModuleOptions): AiMemoryModule {
  const conversationRepository = new PrismaConversationRepository(options.prisma);
  const memoryChunkRepository = new PrismaMemoryChunkRepository(options.prisma);
  const knowledgeRepository = new PrismaKnowledgeRepository(options.prisma);

  const conversationService = new ConversationService({ conversationRepository });
  const memoryService = new MemoryService({ memoryChunkRepository });
  const knowledgeBaseService = new KnowledgeBaseService({ knowledgeRepository });
  const ragService = new RagService({ memoryChunkRepository, knowledgeRepository });

  return {
    conversationService,
    memoryService,
    knowledgeBaseService,
    ragService,
  };
}