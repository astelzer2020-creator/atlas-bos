import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type ConversationSessionType = 'chat' | 'agent' | 'workflow' | 'support';
export type ConversationSessionStatus = 'active' | 'summarized' | 'archived' | 'expired';
export type ConversationMessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type ConversationContentType = 'text' | 'markdown' | 'json' | 'tool_result';

export interface ConversationSessionRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly userId: string | null;
  readonly agentRunId: string | null;
  readonly sessionType: ConversationSessionType;
  readonly status: ConversationSessionStatus;
  readonly title: string | null;
  readonly contextSummary: string | null;
  readonly tokenEstimate: number;
  readonly turnCount: number;
  readonly metadata: Record<string, unknown>;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface ConversationMessageRecord {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly sessionId: string;
  readonly sequenceNumber: number;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly contentType: ConversationContentType;
  readonly toolCalls: Record<string, unknown> | null;
  readonly toolCallId: string | null;
  readonly tokenCount: number | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface CreateConversationSessionData {
  readonly organizationId: OrganizationId;
  readonly userId?: UserId;
  readonly agentRunId?: string;
  readonly sessionType?: ConversationSessionType;
  readonly title?: string;
  readonly metadata?: Record<string, unknown>;
  readonly expiresAt: Date;
  readonly createdBy?: UserId;
}

export interface UpdateConversationSessionData {
  readonly title?: string;
  readonly status?: ConversationSessionStatus;
  readonly metadata?: Record<string, unknown>;
  readonly turnCount?: number;
  readonly tokenEstimate?: number;
  readonly lastActivityAt?: Date;
  readonly updatedBy?: UserId;
}

export interface CreateConversationMessageData {
  readonly organizationId: OrganizationId;
  readonly sessionId: string;
  readonly sequenceNumber: number;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly contentType?: ConversationContentType;
  readonly toolCalls?: Record<string, unknown>;
  readonly toolCallId?: string;
  readonly tokenCount?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ListConversationsFilter {
  readonly sessionType?: ConversationSessionType;
  readonly status?: ConversationSessionStatus;
  readonly userId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListConversationMessagesFilter {
  readonly limit: number;
  readonly cursor?: string;
}

export interface ConversationRepository {
  findSessionById(
    organizationId: OrganizationId,
    sessionId: string,
  ): Promise<ConversationSessionRecord | null>;

  createSession(data: CreateConversationSessionData): Promise<ConversationSessionRecord>;

  updateSession(
    organizationId: OrganizationId,
    sessionId: string,
    data: UpdateConversationSessionData,
    expectedVersion: number,
  ): Promise<ConversationSessionRecord | null>;

  listSessions(
    organizationId: OrganizationId,
    filter: ListConversationsFilter,
  ): Promise<ConversationSessionRecord[]>;

  createMessage(data: CreateConversationMessageData): Promise<ConversationMessageRecord>;

  listMessages(
    organizationId: OrganizationId,
    sessionId: string,
    filter: ListConversationMessagesFilter,
  ): Promise<ConversationMessageRecord[]>;

  getNextSequenceNumber(sessionId: string): Promise<number>;
}