import {
  SignJWT,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
} from 'jose';

export type JwtTokenType = 'access' | 'refresh';

export interface AtlasJwtClaims {
  readonly sub: string;
  readonly org_id: string;
  readonly workspace_id: string;
  readonly session_id: string;
  readonly type: JwtTokenType;
}

export interface SignTokenInput {
  readonly sub: string;
  readonly orgId: string;
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly type: JwtTokenType;
}

export interface JwtServiceOptions {
  readonly secret: string;
  readonly issuer?: string;
  readonly audience?: string | string[];
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
}

export interface VerifiedJwt {
  readonly claims: AtlasJwtClaims;
  readonly payload: JWTPayload;
}

export class JwtVerificationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'JwtVerificationError';
  }
}

export interface JwtService {
  signAccessToken(input: Omit<SignTokenInput, 'type'>): Promise<string>;
  signRefreshToken(input: Omit<SignTokenInput, 'type'>): Promise<string>;
  verifyAccessToken(token: string): Promise<VerifiedJwt>;
  verifyRefreshToken(token: string): Promise<VerifiedJwt>;
}

function toJwtClaims(payload: JWTPayload, expectedType: JwtTokenType): AtlasJwtClaims {
  const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
  const orgId = typeof payload['org_id'] === 'string' ? payload['org_id'] : undefined;
  const workspaceId =
    typeof payload['workspace_id'] === 'string' ? payload['workspace_id'] : undefined;
  const sessionId =
    typeof payload['session_id'] === 'string' ? payload['session_id'] : undefined;
  const type = payload['type'];

  if (
    sub === undefined ||
    orgId === undefined ||
    workspaceId === undefined ||
    sessionId === undefined ||
    (type !== 'access' && type !== 'refresh')
  ) {
    throw new JwtVerificationError('JWT payload is missing required Atlas claims');
  }

  if (type !== expectedType) {
    throw new JwtVerificationError(`Expected ${expectedType} token but received ${type}`);
  }

  return {
    sub,
    org_id: orgId,
    workspace_id: workspaceId,
    session_id: sessionId,
    type,
  };
}

/**
 * HS256 JWT service for access and refresh tokens.
 */
export class JoseJwtService implements JwtService {
  private readonly secretKey: Uint8Array;
  private readonly issuer: string | undefined;
  private readonly audience: string | string[] | undefined;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(options: JwtServiceOptions) {
    this.secretKey = new TextEncoder().encode(options.secret);
    this.issuer = options.issuer;
    this.audience =
      options.audience === undefined
        ? undefined
        : Array.isArray(options.audience)
          ? [...options.audience]
          : options.audience;
    this.accessTtlSeconds = options.accessTtlSeconds;
    this.refreshTtlSeconds = options.refreshTtlSeconds;
  }

  async signAccessToken(input: Omit<SignTokenInput, 'type'>): Promise<string> {
    return this.signToken({ ...input, type: 'access' }, this.accessTtlSeconds);
  }

  async signRefreshToken(input: Omit<SignTokenInput, 'type'>): Promise<string> {
    return this.signToken({ ...input, type: 'refresh' }, this.refreshTtlSeconds);
  }

  async verifyAccessToken(token: string): Promise<VerifiedJwt> {
    return this.verifyToken(token, 'access');
  }

  async verifyRefreshToken(token: string): Promise<VerifiedJwt> {
    return this.verifyToken(token, 'refresh');
  }

  private async signToken(input: SignTokenInput, ttlSeconds: number): Promise<string> {
    const builder = new SignJWT({
      org_id: input.orgId,
      workspace_id: input.workspaceId,
      session_id: input.sessionId,
      type: input.type,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.sub)
      .setIssuedAt()
      .setExpirationTime(`${String(ttlSeconds)}s`);

    if (this.issuer !== undefined) {
      builder.setIssuer(this.issuer);
    }

    if (this.audience !== undefined) {
      builder.setAudience(this.audience);
    }

    return builder.sign(this.secretKey);
  }

  private async verifyToken(token: string, expectedType: JwtTokenType): Promise<VerifiedJwt> {
    try {
      const verifyOptions: Parameters<typeof jwtVerify>[2] = {};
      if (this.issuer !== undefined) {
        verifyOptions.issuer = this.issuer;
      }
      if (this.audience !== undefined) {
        verifyOptions.audience = this.audience;
      }

      const result: JWTVerifyResult = await jwtVerify(token, this.secretKey, verifyOptions);
      const claims = toJwtClaims(result.payload, expectedType);

      return {
        claims,
        payload: result.payload,
      };
    } catch (error) {
      throw new JwtVerificationError('JWT verification failed', { cause: error });
    }
  }
}

export function createJwtService(options: JwtServiceOptions): JwtService {
  return new JoseJwtService(options);
}