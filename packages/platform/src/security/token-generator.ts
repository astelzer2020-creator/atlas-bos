import { randomBytes, timingSafeEqual } from 'node:crypto';

export type SecureTokenEncoding = 'base64url' | 'hex';

export interface GenerateSecureTokenOptions {
  readonly bytes?: number;
  readonly encoding?: SecureTokenEncoding;
}

const DEFAULT_TOKEN_BYTES = 32;

/**
 * Generates a cryptographically secure random token suitable for invitations,
 * password reset links, and opaque refresh tokens.
 */
export function generateSecureToken(options: GenerateSecureTokenOptions = {}): string {
  const bytes = options.bytes ?? DEFAULT_TOKEN_BYTES;
  const encoding = options.encoding ?? 'base64url';
  const buffer = randomBytes(bytes);

  if (encoding === 'hex') {
    return buffer.toString('hex');
  }

  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Constant-time comparison for secure tokens to mitigate timing attacks.
 */
export function secureTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}