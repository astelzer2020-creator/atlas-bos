import { describe, expect, it } from 'vitest';

import {
  createJwtService,
  JwtVerificationError,
} from '../src/security/jwt-service.js';

const JWT_SECRET = 'test-secret-with-minimum-thirty-two-characters';

describe('JoseJwtService', () => {
  const jwtService = createJwtService({
    secret: JWT_SECRET,
    issuer: 'https://auth.atlas.example.com',
    audience: 'https://api.atlas.example.com',
    accessTtlSeconds: 900,
    refreshTtlSeconds: 604_800,
  });

  const tokenInput = {
    sub: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    orgId: '550e8400-e29b-41d4-a716-446655440000',
    workspaceId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    sessionId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  } as const;

  it('signs and verifies access tokens with Atlas claims', async () => {
    const token = await jwtService.signAccessToken(tokenInput);
    const verified = await jwtService.verifyAccessToken(token);

    expect(verified.claims).toEqual({
      sub: tokenInput.sub,
      org_id: tokenInput.orgId,
      workspace_id: tokenInput.workspaceId,
      session_id: tokenInput.sessionId,
      type: 'access',
    });
  });

  it('signs and verifies refresh tokens with Atlas claims', async () => {
    const token = await jwtService.signRefreshToken(tokenInput);
    const verified = await jwtService.verifyRefreshToken(token);

    expect(verified.claims.type).toBe('refresh');
    expect(verified.claims.sub).toBe(tokenInput.sub);
  });

  it('rejects access token verification for refresh tokens', async () => {
    const refreshToken = await jwtService.signRefreshToken(tokenInput);

    await expect(jwtService.verifyAccessToken(refreshToken)).rejects.toBeInstanceOf(
      JwtVerificationError,
    );
  });

  it('rejects tampered tokens', async () => {
    const token = await jwtService.signAccessToken(tokenInput);
    const [header, payload, signature] = token.split('.');
    expect(header).toBeTruthy();
    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();

    const tamperedPayload = `${payload!.slice(0, -2)}xx`;
    const tampered = `${header}.${tamperedPayload}.${signature}`;

    await expect(jwtService.verifyAccessToken(tampered)).rejects.toBeInstanceOf(
      JwtVerificationError,
    );
  });
});