import type { PrismaClient } from '@atlas/database';
import { createJwtService, createPasswordHasher, generateTotp } from '@atlas/platform';
import {
  ConflictError,
  Email,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type OrganizationId,
  type SessionId,
  type UserId,
  type WorkspaceId,
} from '@atlas/shared-kernel';
import { SystemClock } from '@atlas/shared-kernel/time';
import { describe, expect, it, vi } from 'vitest';

import { User } from '../domain/aggregates/user.js';
import type { SessionRepository } from '../domain/repositories/session.repository.js';
import type { UserRepository } from '../domain/repositories/user.repository.js';
import { AuthService } from '../application/services/auth.service.js';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const SESSION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7' as SessionId;
const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' as OrganizationId;
const WORKSPACE_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' as WorkspaceId;
const MFA_DEVICE_ID = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const TOTP_SECRET_ENCRYPTED = Buffer.from(TOTP_SECRET, 'utf8').toString('base64');

function createTestUser(passwordHash: string): User {
  const email = Email.create('alice@example.com');
  if (!email.ok) {
    throw new Error('Invalid test email');
  }

  const user = User.create(
    {
      id: USER_ID,
      email: email.value,
      passwordHash,
      displayName: 'Alice Chen',
    },
    new SystemClock(),
  );

  if (!user.ok) {
    throw new Error('Failed to create test user');
  }

  return user.value;
}

function createAuthService(overrides: {
  userRepository?: Partial<UserRepository>;
  sessionRepository?: Partial<SessionRepository>;
  prisma?: Partial<PrismaClient>;
} = {}) {
  const passwordHasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 4 });
  const jwtService = createJwtService({
    secret: 'test-secret-key-with-sufficient-length',
    accessTtlSeconds: 900,
    refreshTtlSeconds: 2_592_000,
  });

  const userRepository: UserRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    existsByEmail: vi.fn().mockResolvedValue(false),
    ...overrides.userRepository,
  };

  const sessionRepository: SessionRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    revoke: vi.fn(),
    revokeFamily: vi.fn(),
    touchActivity: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    markRefreshTokenUsed: vi.fn(),
    revokeRefreshToken: vi.fn(),
    findActiveMembershipContext: vi.fn(),
    ...overrides.sessionRepository,
  };

  const prisma = {
    mfaDevice: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      update: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides.prisma,
  } as unknown as PrismaClient;

  const authService = new AuthService({
    userRepository,
    sessionRepository,
    prisma,
    passwordHasher,
    jwtService,
    accessTtlSeconds: 900,
    clock: new SystemClock(),
  });

  return { authService, userRepository, sessionRepository, prisma, passwordHasher };
}

describe('AuthService', () => {
  it('registers a new user with hashed password', async () => {
    const { authService, userRepository } = createAuthService();

    const result = await authService.register({
      email: 'alice@example.com',
      password: 'Sup3r-Secure!1',
      display_name: 'Alice Chen',
      locale: 'en-US',
      timezone: 'UTC',
      accept_terms: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('alice@example.com');
      expect(result.value.status).toBe('PENDING_VERIFICATION');
      expect(result.value.verification_sent).toBe(true);
    }

    expect(userRepository.save).toHaveBeenCalledOnce();
    const savedUser = vi.mocked(userRepository.save).mock.calls[0]?.[0];
    expect(savedUser?.passwordHash).toBeDefined();
    expect(savedUser?.passwordHash).not.toBe('Sup3r-Secure!1');
  });

  it('returns conflict when email already exists', async () => {
    const { authService } = createAuthService({
      userRepository: {
        existsByEmail: vi.fn().mockResolvedValue(true),
      },
    });

    const result = await authService.register({
      email: 'alice@example.com',
      password: 'Sup3r-Secure!1',
      display_name: 'Alice Chen',
      locale: 'en-US',
      timezone: 'UTC',
      accept_terms: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
    }
  });

  it('logs in with valid credentials and issues tokens', async () => {
    const { authService, passwordHasher } = createAuthService();
    const passwordHash = await passwordHasher.hash('Sup3r-Secure!1');
    const user = createTestUser(passwordHash);

    const { authService: service, sessionRepository } = createAuthService({
      userRepository: {
        findByEmail: vi.fn().mockResolvedValue(user),
        save: vi.fn().mockResolvedValue(undefined),
      },
      sessionRepository: {
        findActiveMembershipContext: vi.fn().mockResolvedValue({
          organizationId: ORG_ID,
          workspaceId: WORKSPACE_ID,
        }),
        create: vi.fn().mockResolvedValue({
          id: SESSION_ID,
          userId: USER_ID,
          organizationId: ORG_ID,
          workspaceId: WORKSPACE_ID,
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          isRemembered: false,
          expiresAt: new Date(Date.now() + 86_400_000),
          revoked: false,
          createdAt: new Date(),
        }),
        createRefreshToken: vi.fn().mockResolvedValue({
          id: 'refresh-token-id',
          sessionId: SESSION_ID,
          userId: USER_ID,
          tokenHash: 'hash',
          familyId: 'family-id',
          parentTokenId: null,
          expiresAt: new Date(Date.now() + 86_400_000),
          revoked: false,
          usedAt: null,
        }),
      },
    });

    const result = await service.login(
      {
        email: 'alice@example.com',
        password: 'Sup3r-Secure!1',
        remember_device: false,
      },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mfa_required).toBe(false);
      expect(result.value.access_token).toBeDefined();
      expect(result.value.refresh_token).toBeDefined();
      expect(result.value.session_id).toBe(SESSION_ID);
    }

    expect(sessionRepository.create).toHaveBeenCalledOnce();
    expect(sessionRepository.createRefreshToken).toHaveBeenCalledOnce();
  });

  it('rejects login with invalid password and records failed attempt', async () => {
    const { passwordHasher } = createAuthService();
    const passwordHash = await passwordHasher.hash('Sup3r-Secure!1');
    const user = createTestUser(passwordHash);

    const save = vi.fn().mockResolvedValue(undefined);
    const { authService } = createAuthService({
      userRepository: {
        findByEmail: vi.fn().mockResolvedValue(user),
        save,
      },
    });

    const result = await authService.login(
      {
        email: 'alice@example.com',
        password: 'Wrong-Password!1',
        remember_device: false,
      },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }

    expect(save).toHaveBeenCalledOnce();
    const savedUser = save.mock.calls[0]?.[0] as User;
    expect(savedUser.failedLoginAttempts).toBe(1);
  });

  it('rejects refresh when token is missing', async () => {
    const { authService } = createAuthService();

    const result = await authService.refreshToken({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('verifies MFA and issues tokens for a pending session', async () => {
    const code = generateTotp(TOTP_SECRET);
    const expiresAt = new Date(Date.now() + 86_400_000);

    const { authService, sessionRepository, prisma } = createAuthService({
      sessionRepository: {
        findById: vi.fn().mockResolvedValue({
          id: SESSION_ID,
          userId: USER_ID,
          organizationId: ORG_ID,
          workspaceId: WORKSPACE_ID,
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          isRemembered: false,
          expiresAt,
          revoked: false,
          createdAt: new Date(),
        }),
        createRefreshToken: vi.fn().mockResolvedValue({
          id: 'refresh-token-id',
          sessionId: SESSION_ID,
          userId: USER_ID,
          tokenHash: 'hash',
          familyId: 'family-id',
          parentTokenId: null,
          expiresAt: new Date(Date.now() + 86_400_000),
          revoked: false,
          usedAt: null,
        }),
      },
      prisma: {
        mfaDevice: {
          findFirst: vi.fn().mockResolvedValue({
            id: MFA_DEVICE_ID,
            userId: USER_ID,
            deviceType: 'TOTP',
            secretEncrypted: TOTP_SECRET_ENCRYPTED,
            isVerified: true,
          }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        session: {
          update: vi.fn().mockResolvedValue(undefined),
        },
      },
    });

    const result = await authService.verifyMfa({
      session_id: SESSION_ID,
      code,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mfa_required).toBe(false);
      expect(result.value.access_token).toBeDefined();
      expect(result.value.refresh_token).toBeDefined();
      expect(result.value.session_id).toBe(SESSION_ID);
    }

    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: expect.objectContaining({
        mfaVerified: true,
        mfaVerifiedAt: expect.any(Date),
      }),
    });
    expect(prisma.mfaDevice.update).toHaveBeenCalledWith({
      where: { id: MFA_DEVICE_ID },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(sessionRepository.createRefreshToken).toHaveBeenCalledOnce();
  });

  it('rejects MFA verification for revoked sessions', async () => {
    const { authService } = createAuthService({
      sessionRepository: {
        findById: vi.fn().mockResolvedValue({
          id: SESSION_ID,
          userId: USER_ID,
          organizationId: ORG_ID,
          workspaceId: WORKSPACE_ID,
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          isRemembered: false,
          expiresAt: new Date(Date.now() + 86_400_000),
          revoked: true,
          createdAt: new Date(),
        }),
      },
    });

    const result = await authService.verifyMfa({
      session_id: SESSION_ID,
      code: '287082',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
  });

  it('rejects MFA verification with an invalid code', async () => {
    const { authService } = createAuthService({
      sessionRepository: {
        findById: vi.fn().mockResolvedValue({
          id: SESSION_ID,
          userId: USER_ID,
          organizationId: ORG_ID,
          workspaceId: WORKSPACE_ID,
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          isRemembered: false,
          expiresAt: new Date(Date.now() + 86_400_000),
          revoked: false,
          createdAt: new Date(),
        }),
      },
      prisma: {
        mfaDevice: {
          findFirst: vi.fn().mockResolvedValue({
            id: MFA_DEVICE_ID,
            userId: USER_ID,
            deviceType: 'TOTP',
            secretEncrypted: TOTP_SECRET_ENCRYPTED,
            isVerified: true,
          }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        session: {
          update: vi.fn().mockResolvedValue(undefined),
        },
      },
    });

    const result = await authService.verifyMfa({
      session_id: SESSION_ID,
      code: '000000',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
  });

  it('returns not found when MFA session does not exist', async () => {
    const { authService } = createAuthService({
      sessionRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await authService.verifyMfa({
      session_id: SESSION_ID,
      code: '287082',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it('returns current user profile', async () => {
    const { passwordHasher } = createAuthService();
    const passwordHash = await passwordHasher.hash('Sup3r-Secure!1');
    const user = createTestUser(passwordHash);

    const { authService } = createAuthService({
      userRepository: {
        findById: vi.fn().mockResolvedValue(user),
      },
    });

    const result = await authService.getCurrentUser(USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('alice@example.com');
      expect(result.value.display_name).toBe('Alice Chen');
    }
  });
});