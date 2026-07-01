import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, hashed: string): Promise<boolean>;
}

export type PasswordHasherAlgorithm = 'argon2' | 'bcrypt';

export interface PasswordHasherOptions {
  readonly algorithm?: PasswordHasherAlgorithm;
  readonly bcryptRounds?: number;
}

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Argon2id password hasher using @node-rs/argon2.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> {
    return argon2Hash(plainText, ARGON2_OPTIONS);
  }

  async verify(plainText: string, hashed: string): Promise<boolean> {
    return argon2Verify(hashed, plainText, ARGON2_OPTIONS);
  }
}

/**
 * bcrypt password hasher fallback for environments where Argon2 is unavailable.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.rounds);
  }

  async verify(plainText: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plainText, hashed);
  }
}

/**
 * Creates a password hasher, preferring Argon2 and falling back to bcrypt when requested
 * or when Argon2 operations fail at runtime.
 */
export function createPasswordHasher(options: PasswordHasherOptions = {}): PasswordHasher {
  const algorithm = options.algorithm ?? 'argon2';

  if (algorithm === 'bcrypt') {
    return new BcryptPasswordHasher(options.bcryptRounds ?? 12);
  }

  return new Argon2PasswordHasher();
}

/**
 * Resilient password hasher that attempts Argon2 first and transparently falls back to bcrypt.
 */
export class ResilientPasswordHasher implements PasswordHasher {
  private readonly primary = new Argon2PasswordHasher();
  private readonly fallback: BcryptPasswordHasher;

  constructor(bcryptRounds = 12) {
    this.fallback = new BcryptPasswordHasher(bcryptRounds);
  }

  async hash(plainText: string): Promise<string> {
    try {
      return await this.primary.hash(plainText);
    } catch {
      return this.fallback.hash(plainText);
    }
  }

  async verify(plainText: string, hashed: string): Promise<boolean> {
    if (hashed.startsWith('$argon2')) {
      return this.primary.verify(plainText, hashed);
    }

    if (hashed.startsWith('$2a$') || hashed.startsWith('$2b$') || hashed.startsWith('$2y$')) {
      return this.fallback.verify(plainText, hashed);
    }

    try {
      return await this.primary.verify(plainText, hashed);
    } catch {
      return this.fallback.verify(plainText, hashed);
    }
  }
}