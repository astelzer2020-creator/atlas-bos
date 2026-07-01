import { createHash, randomUUID } from 'node:crypto';

import type { PrismaClient } from '@atlas/database';
import {
  generateSecureToken,
  verifyTotp,
  type JwtService,
  type PasswordHasher,
} from '@atlas/platform';
import {
  ConflictError,
  createOrganizationId,
  createSessionId,
  createUserId,
  Email,
  err,
  NotFoundError,
  ok,
  UnauthorizedError,
  ValidationError,
  type OrganizationId,
  type Result,
  type SessionId,
  type UserId,
  type WorkspaceId,
} from '@atlas/shared-kernel';
import type { Clock } from '@atlas/shared-kernel/time';

import { User } from '../../domain/aggregates/user.js';
import type { SessionRepository } from '../../domain/repositories/session.repository.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  RefreshRequest,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
} from '../dto/auth.dto.js';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBERED_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthServiceDeps {
  readonly userRepository: UserRepository;
  readonly sessionRepository: SessionRepository;
  readonly prisma: PrismaClient;
  readonly passwordHasher: PasswordHasher;
  readonly jwtService: JwtService;
  readonly accessTtlSeconds: number;
  readonly clock: Clock;
}

export interface AuthContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async register(
    request: RegisterRequest,
  ): Promise<Result<RegisterResponse, ValidationError | ConflictError>> {
    const emailResult = Email.create(request.email);
    if (!emailResult.ok) {
      return emailResult;
    }

    const email = emailResult.value;

    if (await this.deps.userRepository.existsByEmail(email.value)) {
      return err(new ConflictError('Email address is already registered', { details: { email: email.value } }));
    }

    const passwordHash = await this.deps.passwordHasher.hash(request.password);
    const userIdResult = createUserId(randomUUID());
    if (!userIdResult.ok) {
      return userIdResult;
    }

    const userResult = User.create(
      {
        id: userIdResult.value,
        email,
        passwordHash,
        displayName: request.display_name,
        locale: request.locale,
        timezone: request.timezone,
      },
      this.deps.clock,
    );

    if (!userResult.ok) {
      return userResult;
    }

    await this.deps.userRepository.save(userResult.value);

    return ok({
      user_id: userResult.value.id,
      email: email.value,
      status: userResult.value.status,
      verification_sent: true,
    });
  }

  async login(
    request: LoginRequest,
    context: AuthContext,
  ): Promise<Result<LoginResponse, ValidationError | UnauthorizedError>> {
    const user = await this.deps.userRepository.findByEmail(request.email.toLowerCase());

    if (user === null || user.passwordHash === null) {
      return err(new UnauthorizedError('Invalid email or password'));
    }

    if (user.isLocked(this.deps.clock)) {
      return err(new UnauthorizedError('Account is temporarily locked due to failed login attempts'));
    }

    const passwordValid = await this.deps.passwordHasher.verify(request.password, user.passwordHash);

    if (!passwordValid) {
      user.recordFailedLogin(this.deps.clock);
      await this.deps.userRepository.save(user);
      return err(new UnauthorizedError('Invalid email or password'));
    }

    const loginResult = user.recordLogin(context.ipAddress, this.deps.clock);
    if (!loginResult.ok) {
      return loginResult;
    }

    await this.deps.userRepository.save(user);

    const tokensResult = await this.createSessionTokens(user.id, request.organization_id, {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      isRemembered: request.remember_device,
    });

    if (!tokensResult.ok) {
      return tokensResult;
    }

    return ok({
      mfa_required: false,
      access_token: tokensResult.value.access_token,
      refresh_token: tokensResult.value.refresh_token,
      token_type: 'Bearer',
      expires_in: tokensResult.value.expires_in,
      session_id: tokensResult.value.session_id,
    });
  }

  async refreshToken(
    request: RefreshRequest,
  ): Promise<Result<TokenResponse, ValidationError | UnauthorizedError>> {
    const rawToken = request.refresh_token;

    if (rawToken === undefined || rawToken.length === 0) {
      return err(new ValidationError('Refresh token is required', { field: 'refresh_token' }));
    }

    const tokenHash = hashRefreshToken(rawToken);
    const storedToken = await this.deps.sessionRepository.findRefreshTokenByHash(tokenHash);

    if (storedToken === null) {
      return err(new UnauthorizedError('Invalid refresh token'));
    }

    if (storedToken.revoked) {
      await this.deps.sessionRepository.revokeFamily(storedToken.familyId, 'refresh_token_reuse');
      return err(new UnauthorizedError('Refresh token has been revoked'));
    }

    if (storedToken.usedAt !== null) {
      await this.deps.sessionRepository.revokeFamily(storedToken.familyId, 'refresh_token_reuse');
      return err(new UnauthorizedError('Refresh token has already been used'));
    }

    if (storedToken.expiresAt.getTime() <= this.deps.clock.now().getTime()) {
      return err(new UnauthorizedError('Refresh token has expired'));
    }

    const session = await this.deps.sessionRepository.findById(storedToken.sessionId);

    if (session === null || session.revoked) {
      return err(new UnauthorizedError('Session is no longer active'));
    }

    await this.deps.sessionRepository.markRefreshTokenUsed(storedToken.id);
    await this.deps.sessionRepository.revokeRefreshToken(storedToken.id, 'rotated');
    await this.deps.sessionRepository.touchActivity(session.id);

    const orgId = session.organizationId ?? NIL_UUID;
    const workspaceId = session.workspaceId ?? NIL_UUID;

    const accessToken = await this.deps.jwtService.signAccessToken({
      sub: session.userId,
      orgId,
      workspaceId,
      sessionId: session.id,
    });

    const newRefreshToken = generateSecureToken({ encoding: 'hex' });
    const newRefreshHash = hashRefreshToken(newRefreshToken);
    const refreshExpiresAt = new Date(this.deps.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);

    await this.deps.sessionRepository.createRefreshToken({
      sessionId: session.id,
      userId: session.userId,
      tokenHash: newRefreshHash,
      familyId: storedToken.familyId,
      parentTokenId: storedToken.id,
      expiresAt: refreshExpiresAt,
    });

    return ok({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: this.deps.accessTtlSeconds,
      session_id: session.id,
    });
  }

  async verifyMfa(
    request: MfaVerifyRequest,
  ): Promise<Result<LoginResponse, ValidationError | UnauthorizedError | NotFoundError>> {
    const sessionIdResult = createSessionId(request.session_id);
    if (!sessionIdResult.ok) {
      return sessionIdResult;
    }

    const session = await this.deps.sessionRepository.findById(sessionIdResult.value);

    if (session === null) {
      return err(new NotFoundError('Session', sessionIdResult.value));
    }

    if (session.revoked) {
      return err(new UnauthorizedError('Session has been revoked'));
    }

    if (session.expiresAt.getTime() <= this.deps.clock.now().getTime()) {
      return err(new UnauthorizedError('Session has expired'));
    }

    const mfaDevice = await this.deps.prisma.mfaDevice.findFirst({
      where: {
        userId: session.userId,
        deviceType: 'TOTP',
        isVerified: true,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: 'desc' }, { verifiedAt: 'asc' }],
    });

    if (mfaDevice === null || mfaDevice.secretEncrypted === null) {
      return err(new UnauthorizedError('No verified MFA device found for user'));
    }

    const secret = decryptMfaSecret(mfaDevice.secretEncrypted);

    if (!verifyTotp(secret, request.code, { window: 1 })) {
      return err(new UnauthorizedError('Invalid MFA code'));
    }

    const now = this.deps.clock.now();

    await this.deps.prisma.session.update({
      where: { id: session.id },
      data: {
        mfaVerified: true,
        mfaVerifiedAt: now,
      },
    });

    await this.deps.prisma.mfaDevice.update({
      where: { id: mfaDevice.id },
      data: { lastUsedAt: now },
    });

    const tokensResult = await this.issueTokensForSession(session);
    if (!tokensResult.ok) {
      return tokensResult;
    }

    return ok({
      mfa_required: false,
      access_token: tokensResult.value.access_token,
      refresh_token: tokensResult.value.refresh_token,
      token_type: 'Bearer',
      expires_in: tokensResult.value.expires_in,
      session_id: tokensResult.value.session_id,
    });
  }

  async logout(sessionId: SessionId): Promise<Result<void, NotFoundError>> {
    const session = await this.deps.sessionRepository.findById(sessionId);

    if (session === null) {
      return err(new NotFoundError('Session', sessionId));
    }

    await this.deps.sessionRepository.revoke(sessionId, 'user_logout');

    return ok(undefined);
  }

  async getCurrentUser(userId: UserId): Promise<Result<CurrentUserResponse, NotFoundError>> {
    const user = await this.deps.userRepository.findById(userId);

    if (user === null) {
      return err(new NotFoundError('User', userId));
    }

    return ok({
      id: user.id,
      email: user.email.value,
      email_verified: user.emailVerified,
      display_name: user.displayName,
      status: user.status,
      type: user.type,
      locale: user.locale,
      timezone: user.timezone,
      avatar_url: user.avatarUrl,
      created_at: new Date().toISOString(),
    });
  }

  private async issueTokensForSession(
    session: {
      id: SessionId;
      userId: UserId;
      organizationId: OrganizationId | null;
      workspaceId: WorkspaceId | null;
    },
  ): Promise<Result<TokenResponse, ValidationError | UnauthorizedError>> {
    const refreshToken = generateSecureToken({ encoding: 'hex' });
    const refreshHash = hashRefreshToken(refreshToken);
    const familyId = randomUUID();
    const refreshExpiresAt = new Date(this.deps.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);

    await this.deps.sessionRepository.createRefreshToken({
      sessionId: session.id,
      userId: session.userId,
      tokenHash: refreshHash,
      familyId,
      expiresAt: refreshExpiresAt,
    });

    const orgId = session.organizationId ?? NIL_UUID;
    const workspaceId = session.workspaceId ?? NIL_UUID;

    const accessToken = await this.deps.jwtService.signAccessToken({
      sub: session.userId,
      orgId,
      workspaceId,
      sessionId: session.id,
    });

    return ok({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.deps.accessTtlSeconds,
      session_id: session.id,
    });
  }

  private async createSessionTokens(
    userId: UserId,
    organizationId: string | undefined,
    options: {
      ipAddress: string | null;
      userAgent: string | null;
      isRemembered: boolean;
    },
  ): Promise<Result<TokenResponse, ValidationError | UnauthorizedError>> {
    let orgContext = null as {
      organizationId: OrganizationId;
      workspaceId: WorkspaceId;
    } | null;

    if (organizationId !== undefined) {
      const orgIdResult = createOrganizationId(organizationId);
      if (!orgIdResult.ok) {
        return orgIdResult;
      }
      orgContext = await this.deps.sessionRepository.findActiveMembershipContext(
        userId,
        orgIdResult.value,
      );
      if (orgContext === null) {
        return err(new UnauthorizedError('User is not a member of the specified organization'));
      }
    } else {
      orgContext = await this.deps.sessionRepository.findActiveMembershipContext(userId);
    }

    const sessionTtl = options.isRemembered ? REMEMBERED_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS;
    const expiresAt = new Date(this.deps.clock.now().getTime() + sessionTtl);

    const session = await this.deps.sessionRepository.create({
      userId,
      organizationId: orgContext?.organizationId ?? null,
      workspaceId: orgContext?.workspaceId ?? null,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      isRemembered: options.isRemembered,
      expiresAt,
    });

    const refreshToken = generateSecureToken({ encoding: 'hex' });
    const refreshHash = hashRefreshToken(refreshToken);
    const familyId = randomUUID();
    const refreshExpiresAt = new Date(this.deps.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);

    await this.deps.sessionRepository.createRefreshToken({
      sessionId: session.id,
      userId,
      tokenHash: refreshHash,
      familyId,
      expiresAt: refreshExpiresAt,
    });

    const orgId = orgContext?.organizationId ?? NIL_UUID;
    const workspaceId = orgContext?.workspaceId ?? NIL_UUID;

    const accessToken = await this.deps.jwtService.signAccessToken({
      sub: userId,
      orgId,
      workspaceId,
      sessionId: session.id,
    });

    return ok({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.deps.accessTtlSeconds,
      session_id: session.id,
    });
  }
}

/**
 * Decrypts an MFA device secret from storage.
 *
 * Development stores the Base32 TOTP secret as a Base64-encoded plaintext value.
 * Production must replace this with envelope encryption (e.g. KMS-wrapped ciphertext).
 */
function decryptMfaSecret(secretEncrypted: string): string {
  return Buffer.from(secretEncrypted, 'base64').toString('utf8');
}