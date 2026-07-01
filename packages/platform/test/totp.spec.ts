import { describe, expect, it } from 'vitest';

import { decodeBase32, generateTotp, verifyTotp } from '../src/crypto/totp.js';

const RFC6238_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('decodes Base32 secrets', () => {
    const decoded = decodeBase32(RFC6238_SECRET);

    expect(decoded.toString('ascii')).toBe('12345678901234567890');
  });

  it('generates RFC 6238 test vectors', () => {
    expect(generateTotp(RFC6238_SECRET, { time: 59 })).toBe('287082');
    expect(generateTotp(RFC6238_SECRET, { time: 1_111_111_109 })).toBe('081804');
    expect(generateTotp(RFC6238_SECRET, { time: 1_111_111_111 })).toBe('050471');
    expect(generateTotp(RFC6238_SECRET, { time: 1_234_567_890 })).toBe('005924');
    expect(generateTotp(RFC6238_SECRET, { time: 2_000_000_000 })).toBe('279037');
    expect(generateTotp(RFC6238_SECRET, { time: 20_000_000_000 })).toBe('353130');
  });

  it('verifies a valid code at the current time step', () => {
    const time = 59;
    const code = generateTotp(RFC6238_SECRET, { time });

    expect(verifyTotp(RFC6238_SECRET, code, { time })).toBe(true);
  });

  it('accepts codes within the configured window', () => {
    const time = 89;
    const previousStepCode = generateTotp(RFC6238_SECRET, { time: 59 });

    expect(verifyTotp(RFC6238_SECRET, previousStepCode, { time, window: 1 })).toBe(true);
  });

  it('rejects invalid codes', () => {
    expect(verifyTotp(RFC6238_SECRET, '000000', { time: 59, window: 0 })).toBe(false);
    expect(verifyTotp(RFC6238_SECRET, '12345', { time: 59 })).toBe(false);
    expect(verifyTotp(RFC6238_SECRET, 'abcdef', { time: 59 })).toBe(false);
  });
});