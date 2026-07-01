import { createHmac, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_TIME_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

export interface TotpOptions {
  /** Unix timestamp in seconds. Defaults to current time. */
  readonly time?: number;
  /** Number of 30-second steps to check on either side of the reference time. */
  readonly window?: number;
  /** TOTP time step in seconds (RFC 6238 default: 30). */
  readonly step?: number;
  /** Number of digits in the generated code (RFC 6238 default: 6). */
  readonly digits?: number;
}

/**
 * Decodes a Base32-encoded string (RFC 4648) into bytes.
 * Padding characters (=) are ignored; input is case-insensitive.
 */
export function decodeBase32(input: string): Buffer {
  const normalized = input.replace(/=+$/u, '').toUpperCase();
  let bitsLeft = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

    buffer = (buffer << 5) | index;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      output.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
      buffer &= (1 << bitsLeft) - 1;
    }
  }

  return Buffer.from(output);
}

/**
 * Generates a TOTP code per RFC 6238 using HMAC-SHA1.
 */
export function generateTotp(secret: string, options: TotpOptions = {}): string {
  const step = options.step ?? DEFAULT_TIME_STEP_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const time = options.time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(time / step);

  return generateHotp(secret, counter, digits);
}

/**
 * Verifies a TOTP code with an optional time window (RFC 6238).
 * Returns true when the code matches any step within +/- window.
 */
export function verifyTotp(secret: string, code: string, options: TotpOptions = {}): boolean {
  const normalizedCode = code.trim();
  if (!/^\d{6}$/u.test(normalizedCode)) {
    return false;
  }

  const step = options.step ?? DEFAULT_TIME_STEP_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const window = options.window ?? 0;
  const time = options.time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(time / step);

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateHotp(secret, counter + offset, digits);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedCode))) {
      return true;
    }
  }

  return false;
}

function generateHotp(secret: string, counter: number, digits: number): string {
  const key = decodeBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(counterBuffer).digest();
  const lastByte = digest[digest.length - 1] ?? 0;
  const offset = lastByte & 0x0f;
  const b0 = digest[offset] ?? 0;
  const b1 = digest[offset + 1] ?? 0;
  const b2 = digest[offset + 2] ?? 0;
  const b3 = digest[offset + 3] ?? 0;
  const binary = ((b0 & 0x7f) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}