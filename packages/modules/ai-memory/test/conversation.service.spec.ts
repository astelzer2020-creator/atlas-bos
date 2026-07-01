import {
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import { ConversationService } from '../application/services/conversation.service.js';
import type {
  ConversationMessageRecord,
  ConversationRepository,
  ConversationSessionRecord,
} from '../domain/repositories/conversation.repository.js';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const SESSION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function createSessionRecord(
  overrides: Partial<ConversationSessionRecord> = {},
): ConversationSessionRecord {
  return {
    id: SESSION_ID,
    organizationId: ORG_ID,
    userId: USER_ID,
    agentRunId: null,
    sessionType: 'chat',
    status: 'active',
    title: 'Support chat',
    contextSummary: null,
    tokenEstimate: 0,
    turnCount: 0,
    metadata: {},
    expiresAt: new Date('2026-07-07T08:00:00Z'),
    lastActivityAt: new Date('2026-06-30T08:00:00Z'),
    createdAt: new Date('2026-06-30T08:00:00Z'),
    updatedAt: new Date('2026-06-30T08:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function createMessageRecord(
  overrides: Partial<ConversationMessageRecord> = {},
): ConversationMessageRecord {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: ORG_ID,
    sessionId: SESSION_ID,
    sequenceNumber: 1,
    role: 'user',
    content: 'Hello',
    contentType: 'text',
    toolCalls: null,
    toolCallId: null,
    tokenCount: null,
    metadata: {},
    createdAt: new Date('2026-06-30T08:01:00Z'),
    ...overrides,
  };
}

function createConversationService(repository: Partial<ConversationRepository> = {}) {
  const conversationRepository: ConversationRepository = {
    findSessionById: vi.fn().mockResolvedValue(null),
    createSession: vi.fn().mockResolvedValue(createSessionRecord()),
    updateSession: vi.fn().mockResolvedValue(createSessionRecord({ version: 2, turnCount: 1 })),
    listSessions: vi.fn().mockResolvedValue([createSessionRecord()]),
    createMessage: vi.fn().mockResolvedValue(createMessageRecord()),
    listMessages: vi.fn().mockResolvedValue([createMessageRecord()]),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    ...repository,
  };

  return {
    service: new ConversationService({ conversationRepository }),
    conversationRepository,
  };
}

describe('ConversationService', () => {
  it('createSession creates active chat session with expiry', async () => {
    const { service, conversationRepository } = createConversationService();

    const result = await service.createSession(
      ORG_ID,
      { sessionType: 'chat', title: 'Support chat' },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('active');
      expect(result.value.sessionType).toBe('chat');
    }

    expect(conversationRepository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        sessionType: 'chat',
        title: 'Support chat',
      }),
    );
  });

  it('createSession rejects invalid session type', async () => {
    const { service } = createConversationService();

    const result = await service.createSession(ORG_ID, {
      sessionType: 'invalid' as 'chat',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('getSession returns session with messages', async () => {
    const { service } = createConversationService({
      findSessionById: vi.fn().mockResolvedValue(createSessionRecord()),
      listMessages: vi.fn().mockResolvedValue([createMessageRecord()]),
    });

    const result = await service.getSession(ORG_ID, SESSION_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.messages).toHaveLength(1);
      expect(result.value.messages[0]?.content).toBe('Hello');
    }
  });

  it('getSession returns not found for missing session', async () => {
    const { service } = createConversationService();

    const result = await service.getSession(ORG_ID, SESSION_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('addMessage increments turn count and stores message', async () => {
    const { service, conversationRepository } = createConversationService({
      findSessionById: vi.fn().mockResolvedValue(createSessionRecord()),
    });

    const result = await service.addMessage(ORG_ID, SESSION_ID, {
      role: 'user',
      content: 'What is Atlas?',
    });

    expect(result.ok).toBe(true);
    expect(conversationRepository.createMessage).toHaveBeenCalled();
    expect(conversationRepository.updateSession).toHaveBeenCalledWith(
      ORG_ID,
      SESSION_ID,
      expect.objectContaining({ turnCount: 1 }),
      1,
    );
  });

  it('addMessage rejects empty content', async () => {
    const { service } = createConversationService({
      findSessionById: vi.fn().mockResolvedValue(createSessionRecord()),
    });

    const result = await service.addMessage(ORG_ID, SESSION_ID, {
      role: 'user',
      content: '   ',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});