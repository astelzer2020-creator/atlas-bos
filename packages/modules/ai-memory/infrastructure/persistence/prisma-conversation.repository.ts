import { Prisma, type PrismaClient } from '@atlas/database';
import type { OrganizationId } from '@atlas/shared-kernel';

import type {
  ConversationContentType,
  ConversationMessageRecord,
  ConversationMessageRole,
  ConversationRepository,
  ConversationSessionRecord,
  ConversationSessionStatus,
  ConversationSessionType,
  CreateConversationMessageData,
  CreateConversationSessionData,
  ListConversationMessagesFilter,
  ListConversationsFilter,
  UpdateConversationSessionData,
} from '../../domain/repositories/conversation.repository.js';

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSessionById(
    organizationId: OrganizationId,
    sessionId: string,
  ): Promise<ConversationSessionRecord | null> {
    const record = await this.prisma.conversationSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
        deletedAt: null,
      },
    });

    return record === null ? null : this.toSessionRecord(record);
  }

  async createSession(data: CreateConversationSessionData): Promise<ConversationSessionRecord> {
    const record = await this.prisma.conversationSession.create({
      data: {
        organizationId: data.organizationId,
        expiresAt: data.expiresAt,
        ...(data.userId !== undefined ? { userId: data.userId } : {}),
        ...(data.agentRunId !== undefined ? { agentRunId: data.agentRunId } : {}),
        ...(data.sessionType !== undefined ? { sessionType: data.sessionType } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
        ...(data.createdBy !== undefined ? { createdBy: data.createdBy } : {}),
      },
    });

    return this.toSessionRecord(record);
  }

  async updateSession(
    organizationId: OrganizationId,
    sessionId: string,
    data: UpdateConversationSessionData,
    expectedVersion: number,
  ): Promise<ConversationSessionRecord | null> {
    try {
      const record = await this.prisma.conversationSession.update({
        where: {
          id: sessionId,
          organizationId,
          version: expectedVersion,
          deletedAt: null,
        },
        data: {
          version: { increment: 1 },
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
          ...(data.turnCount !== undefined ? { turnCount: data.turnCount } : {}),
          ...(data.tokenEstimate !== undefined ? { tokenEstimate: data.tokenEstimate } : {}),
          ...(data.lastActivityAt !== undefined ? { lastActivityAt: data.lastActivityAt } : {}),
          ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
        },
      });

      return this.toSessionRecord(record);
    } catch {
      return null;
    }
  }

  async listSessions(
    organizationId: OrganizationId,
    filter: ListConversationsFilter,
  ): Promise<ConversationSessionRecord[]> {
    const records = await this.prisma.conversationSession.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filter.sessionType !== undefined ? { sessionType: filter.sessionType } : {}),
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.userId !== undefined ? { userId: filter.userId } : {}),
        ...(filter.cursor !== undefined
          ? { lastActivityAt: { lt: new Date(filter.cursor) } }
          : {}),
      },
      orderBy: { lastActivityAt: 'desc' },
      take: filter.limit,
    });

    return records.map((record) => this.toSessionRecord(record));
  }

  async createMessage(data: CreateConversationMessageData): Promise<ConversationMessageRecord> {
    const record = await this.prisma.conversationMessage.create({
      data: {
        organizationId: data.organizationId,
        sessionId: data.sessionId,
        sequenceNumber: data.sequenceNumber,
        role: data.role,
        content: data.content,
        ...(data.contentType !== undefined ? { contentType: data.contentType } : {}),
        ...(data.toolCalls !== undefined ? { toolCalls: toJsonValue(data.toolCalls) } : {}),
        ...(data.toolCallId !== undefined ? { toolCallId: data.toolCallId } : {}),
        ...(data.tokenCount !== undefined ? { tokenCount: data.tokenCount } : {}),
        ...(data.metadata !== undefined ? { metadata: toJsonValue(data.metadata) } : {}),
      },
    });

    return this.toMessageRecord(record);
  }

  async listMessages(
    organizationId: OrganizationId,
    sessionId: string,
    filter: ListConversationMessagesFilter,
  ): Promise<ConversationMessageRecord[]> {
    const records = await this.prisma.conversationMessage.findMany({
      where: {
        organizationId,
        sessionId,
        deletedAt: null,
        ...(filter.cursor !== undefined
          ? { sequenceNumber: { gt: Number.parseInt(filter.cursor, 10) } }
          : {}),
      },
      orderBy: { sequenceNumber: 'asc' },
      take: filter.limit,
    });

    return records.map((record) => this.toMessageRecord(record));
  }

  async getNextSequenceNumber(sessionId: string): Promise<number> {
    const latest = await this.prisma.conversationMessage.findFirst({
      where: { sessionId, deletedAt: null },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    return (latest?.sequenceNumber ?? 0) + 1;
  }

  private toSessionRecord(record: {
    id: string;
    organizationId: string;
    userId: string | null;
    agentRunId: string | null;
    sessionType: ConversationSessionType;
    status: ConversationSessionStatus;
    title: string | null;
    contextSummary: string | null;
    tokenEstimate: number;
    turnCount: number;
    metadata: Prisma.JsonValue;
    expiresAt: Date;
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): ConversationSessionRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      userId: record.userId,
      agentRunId: record.agentRunId,
      sessionType: record.sessionType,
      status: record.status,
      title: record.title,
      contextSummary: record.contextSummary,
      tokenEstimate: record.tokenEstimate,
      turnCount: record.turnCount,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      expiresAt: record.expiresAt,
      lastActivityAt: record.lastActivityAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  private toMessageRecord(record: {
    id: string;
    organizationId: string;
    sessionId: string;
    sequenceNumber: number;
    role: ConversationMessageRole;
    content: string;
    contentType: ConversationContentType;
    toolCalls: Prisma.JsonValue;
    toolCallId: string | null;
    tokenCount: number | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }): ConversationMessageRecord {
    return {
      id: record.id,
      organizationId: record.organizationId as OrganizationId,
      sessionId: record.sessionId,
      sequenceNumber: record.sequenceNumber,
      role: record.role,
      content: record.content,
      contentType: record.contentType,
      toolCalls: (record.toolCalls as Record<string, unknown> | null) ?? null,
      toolCallId: record.toolCallId,
      tokenCount: record.tokenCount,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
    };
  }
}