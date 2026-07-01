import {
  err,
  NotFoundError,
  ok,
  ValidationError,
  type OrganizationId,
  type Result,
  type UserId,
} from '@atlas/shared-kernel';

import type {
  ConversationContentType,
  ConversationMessageRecord,
  ConversationMessageRole,
  ConversationRepository,
  ConversationSessionRecord,
  ConversationSessionStatus,
  ConversationSessionType,
} from '../../domain/repositories/conversation.repository.js';

export interface ConversationSessionDto {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly agentRunId: string | null;
  readonly sessionType: ConversationSessionType;
  readonly status: ConversationSessionStatus;
  readonly title: string | null;
  readonly contextSummary: string | null;
  readonly tokenEstimate: number;
  readonly turnCount: number;
  readonly metadata: Record<string, unknown>;
  readonly expiresAt: string;
  readonly lastActivityAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface ConversationMessageDto {
  readonly id: string;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly sequenceNumber: number;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly contentType: ConversationContentType;
  readonly toolCalls: Record<string, unknown> | null;
  readonly toolCallId: string | null;
  readonly tokenCount: number | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface ConversationDetailDto extends ConversationSessionDto {
  readonly messages: ConversationMessageDto[];
}

export interface CreateConversationInput {
  readonly sessionType?: ConversationSessionType;
  readonly title?: string;
  readonly agentRunId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateConversationInput {
  readonly title?: string;
  readonly status?: ConversationSessionStatus;
  readonly metadata?: Record<string, unknown>;
  readonly expectedVersion: number;
}

export interface AddMessageInput {
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly contentType?: ConversationContentType;
  readonly toolCalls?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface ListConversationsInput {
  readonly sessionType?: ConversationSessionType;
  readonly status?: ConversationSessionStatus;
  readonly userId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListMessagesInput {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ConversationServiceDeps {
  readonly conversationRepository: ConversationRepository;
}

const DEFAULT_SESSION_TTL_DAYS = 7;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 50;

const VALID_SESSION_TYPES: readonly ConversationSessionType[] = [
  'chat',
  'agent',
  'workflow',
  'support',
];

const VALID_MESSAGE_ROLES: readonly ConversationMessageRole[] = [
  'user',
  'assistant',
  'system',
  'tool',
];

export class ConversationService {
  constructor(private readonly deps: ConversationServiceDeps) {}

  async createSession(
    organizationId: OrganizationId,
    input: CreateConversationInput,
    actorId?: UserId,
  ): Promise<Result<ConversationSessionDto, ValidationError>> {
    if (input.sessionType !== undefined && !VALID_SESSION_TYPES.includes(input.sessionType)) {
      return err(new ValidationError('Invalid session type', { field: 'sessionType' }));
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_SESSION_TTL_DAYS);

    const record = await this.deps.conversationRepository.createSession({
      organizationId,
      expiresAt,
      ...(actorId !== undefined ? { userId: actorId, createdBy: actorId } : {}),
      ...(input.sessionType !== undefined ? { sessionType: input.sessionType } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.agentRunId !== undefined ? { agentRunId: input.agentRunId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });

    return ok(this.toSessionDto(record));
  }

  async listSessions(
    organizationId: OrganizationId,
    input: ListConversationsInput = {},
  ): Promise<{ data: ConversationSessionDto[]; next_cursor: string | null }> {
    const limit = Math.min(input.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

    const records = await this.deps.conversationRepository.listSessions(organizationId, {
      limit: limit + 1,
      ...(input.sessionType !== undefined ? { sessionType: input.sessionType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const nextCursor =
      hasMore && page.length > 0
        ? page[page.length - 1]!.lastActivityAt.toISOString()
        : null;

    return {
      data: page.map((record) => this.toSessionDto(record)),
      next_cursor: nextCursor,
    };
  }

  async getSession(
    organizationId: OrganizationId,
    sessionId: string,
    includeMessages = true,
    messageLimit = DEFAULT_MESSAGE_LIMIT,
  ): Promise<Result<ConversationDetailDto, NotFoundError>> {
    const session = await this.deps.conversationRepository.findSessionById(
      organizationId,
      sessionId,
    );

    if (session === null) {
      return err(new NotFoundError('ConversationSession', sessionId));
    }

    let messages: ConversationMessageRecord[] = [];

    if (includeMessages) {
      messages = await this.deps.conversationRepository.listMessages(
        organizationId,
        sessionId,
        { limit: messageLimit },
      );
    }

    return ok({
      ...this.toSessionDto(session),
      messages: messages.map((message) => this.toMessageDto(message)),
    });
  }

  async updateSession(
    organizationId: OrganizationId,
    sessionId: string,
    input: UpdateConversationInput,
    actorId?: UserId,
  ): Promise<Result<ConversationSessionDto, NotFoundError | ValidationError>> {
    const updated = await this.deps.conversationRepository.updateSession(
      organizationId,
      sessionId,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(actorId !== undefined ? { updatedBy: actorId } : {}),
      },
      input.expectedVersion,
    );

    if (updated === null) {
      return err(new NotFoundError('ConversationSession', sessionId));
    }

    return ok(this.toSessionDto(updated));
  }

  async addMessage(
    organizationId: OrganizationId,
    sessionId: string,
    input: AddMessageInput,
  ): Promise<Result<ConversationMessageDto, NotFoundError | ValidationError>> {
    const session = await this.deps.conversationRepository.findSessionById(
      organizationId,
      sessionId,
    );

    if (session === null) {
      return err(new NotFoundError('ConversationSession', sessionId));
    }

    if (!VALID_MESSAGE_ROLES.includes(input.role)) {
      return err(new ValidationError('Invalid message role', { field: 'role' }));
    }

    const content = input.content.trim();
    if (content.length === 0) {
      return err(new ValidationError('Message content is required', { field: 'content' }));
    }

    const sequenceNumber = await this.deps.conversationRepository.getNextSequenceNumber(sessionId);

    const message = await this.deps.conversationRepository.createMessage({
      organizationId,
      sessionId,
      sequenceNumber,
      role: input.role,
      content,
      ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
      ...(input.toolCalls !== undefined ? { toolCalls: input.toolCalls } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });

    await this.deps.conversationRepository.updateSession(
      organizationId,
      sessionId,
      {
        turnCount: session.turnCount + 1,
        tokenEstimate: session.tokenEstimate + Math.ceil(content.length / 4),
        lastActivityAt: new Date(),
      },
      session.version,
    );

    return ok(this.toMessageDto(message));
  }

  async listMessages(
    organizationId: OrganizationId,
    sessionId: string,
    input: ListMessagesInput = {},
  ): Promise<
    Result<{ data: ConversationMessageDto[]; next_cursor: string | null }, NotFoundError>
  > {
    const session = await this.deps.conversationRepository.findSessionById(
      organizationId,
      sessionId,
    );

    if (session === null) {
      return err(new NotFoundError('ConversationSession', sessionId));
    }

    const limit = Math.min(input.limit ?? DEFAULT_MESSAGE_LIMIT, MAX_LIST_LIMIT);

    const records = await this.deps.conversationRepository.listMessages(organizationId, sessionId, {
      limit: limit + 1,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const nextCursor =
      hasMore && page.length > 0 ? String(page[page.length - 1]!.sequenceNumber) : null;

    return ok({
      data: page.map((record) => this.toMessageDto(record)),
      next_cursor: nextCursor,
    });
  }

  private toSessionDto(record: ConversationSessionRecord): ConversationSessionDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      agentRunId: record.agentRunId,
      sessionType: record.sessionType,
      status: record.status,
      title: record.title,
      contextSummary: record.contextSummary,
      tokenEstimate: record.tokenEstimate,
      turnCount: record.turnCount,
      metadata: record.metadata,
      expiresAt: record.expiresAt.toISOString(),
      lastActivityAt: record.lastActivityAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    };
  }

  private toMessageDto(record: ConversationMessageRecord): ConversationMessageDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      sessionId: record.sessionId,
      sequenceNumber: record.sequenceNumber,
      role: record.role,
      content: record.content,
      contentType: record.contentType,
      toolCalls: record.toolCalls,
      toolCallId: record.toolCallId,
      tokenCount: record.tokenCount,
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
    };
  }
}