import type { PrismaClient } from '@atlas/database';
import type { OrganizationId, SessionId, UserId, WorkspaceId } from '@atlas/shared-kernel';

import type {
  CreateRefreshTokenData,
  CreateSessionData,
  RefreshTokenRecord,
  SessionRecord,
  SessionRepository,
} from '../../domain/repositories/session.repository.js';

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSessionData): Promise<SessionRecord> {
    const record = await this.prisma.session.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        workspaceId: data.workspaceId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        isRemembered: data.isRemembered,
        expiresAt: data.expiresAt,
      },
    });

    return this.toSessionRecord(record);
  }

  async findById(id: SessionId): Promise<SessionRecord | null> {
    const record = await this.prisma.session.findUnique({ where: { id } });

    return record === null ? null : this.toSessionRecord(record);
  }

  async revoke(id: SessionId, reason = 'revoked'): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId: id, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { familyId },
      select: { sessionId: true },
    });

    const sessionIds = [...new Set(tokens.map((token: { sessionId: string }) => token.sessionId))];

    await this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    if (sessionIds.length > 0) {
      await this.prisma.session.updateMany({
        where: { id: { in: sessionIds } },
        data: {
          revoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });
    }
  }

  async touchActivity(id: SessionId): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    });
  }

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenRecord> {
    const record = await this.prisma.refreshToken.create({
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        parentTokenId: data.parentTokenId ?? null,
        expiresAt: data.expiresAt,
      },
    });

    return this.toRefreshTokenRecord(record);
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    return record === null ? null : this.toRefreshTokenRecord(record);
  }

  async markRefreshTokenUsed(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async revokeRefreshToken(id: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async findActiveMembershipContext(
    userId: UserId,
    organizationId?: OrganizationId,
  ): Promise<{ organizationId: OrganizationId; workspaceId: WorkspaceId } | null> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
      include: {
        organization: {
          select: { id: true, workspaceId: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    if (membership === null) {
      return null;
    }

    return {
      organizationId: membership.organization.id as OrganizationId,
      workspaceId: membership.organization.workspaceId as WorkspaceId,
    };
  }

  private toSessionRecord(record: {
    id: string;
    userId: string;
    organizationId: string | null;
    workspaceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    isRemembered: boolean;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
  }): SessionRecord {
    return {
      id: record.id as SessionId,
      userId: record.userId as UserId,
      organizationId: record.organizationId as OrganizationId | null,
      workspaceId: record.workspaceId as WorkspaceId | null,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      isRemembered: record.isRemembered,
      expiresAt: record.expiresAt,
      revoked: record.revoked,
      createdAt: record.createdAt,
    };
  }

  private toRefreshTokenRecord(record: {
    id: string;
    sessionId: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    parentTokenId: string | null;
    expiresAt: Date;
    revoked: boolean;
    usedAt: Date | null;
  }): RefreshTokenRecord {
    return {
      id: record.id,
      sessionId: record.sessionId as SessionId,
      userId: record.userId as UserId,
      tokenHash: record.tokenHash,
      familyId: record.familyId,
      parentTokenId: record.parentTokenId,
      expiresAt: record.expiresAt,
      revoked: record.revoked,
      usedAt: record.usedAt,
    };
  }
}