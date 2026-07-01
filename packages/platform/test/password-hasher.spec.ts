import { describe, expect, it } from 'vitest';

import {
  createPasswordHasher,
  ResilientPasswordHasher,
} from '../src/security/password-hasher.js';

describe('PasswordHasher', () => {
  it('hashes and verifies passwords with Argon2 by default', async () => {
    const hasher = createPasswordHasher();
    const plainText = 'Sup3r-Secure_Password!';

    const hashed = await hasher.hash(plainText);

    expect(hashed.startsWith('$argon2')).toBe(true);
    expect(await hasher.verify(plainText, hashed)).toBe(true);
    expect(await hasher.verify('wrong-password', hashed)).toBe(false);
  });

  it('hashes and verifies passwords with bcrypt fallback', async () => {
    const hasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 10 });
    const plainText = 'Another-Secure_Password!';

    const hashed = await hasher.hash(plainText);

    expect(hashed.startsWith('$2')).toBe(true);
    expect(await hasher.verify(plainText, hashed)).toBe(true);
    expect(await hasher.verify('wrong-password', hashed)).toBe(false);
  });

  it('verifies legacy bcrypt hashes through the resilient hasher', async () => {
    const bcryptHasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 10 });
    const resilientHasher = new ResilientPasswordHasher(10);
    const plainText = 'Legacy-Password!';

    const bcryptHash = await bcryptHasher.hash(plainText);

    expect(await resilientHasher.verify(plainText, bcryptHash)).toBe(true);
  });
});