import type { OrganizationId, SessionId, UserId, WorkspaceId } from '@atlas/shared-kernel';

export interface SessionRecord {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly organizationId: OrganizationId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly isRemembered: boolean;
  readonly expiresAt: Date;
  readonly revoked: boolean;
  readonly createdAt: Date;
}

export interface CreateSessionData {
  readonly userId: UserId;
  readonly organizationId: OrganizationId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly isRemembered: boolean;
  readonly expiresAt: Date;
}

export interface RefreshTokenRecord {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly parentTokenId: string | null;
  readonly expiresAt: Date;
  readonly revoked: boolean;
  readonly usedAt: Date | null;
}

export interface CreateRefreshTokenData {
  readonly sessionId: SessionId;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly parentTokenId?: string;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  create(data: CreateSessionData): Promise<SessionRecord>;
  findById(id: SessionId): Promise<SessionRecord | null>;
  revoke(id: SessionId, reason?: string): Promise<void>;
  revokeFamily(familyId: string, reason: string): Promise<void>;
  touchActivity(id: SessionId): Promise<void>;
  createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  markRefreshTokenUsed(id: string): Promise<void>;
  revokeRefreshToken(id: string, reason: string): Promise<void>;
  findActiveMembershipContext(
    userId: UserId,
    organizationId?: OrganizationId,
  ): Promise<{ organizationId: OrganizationId; workspaceId: WorkspaceId } | null>;
}