#!/usr/bin/env node
/**
 * Validates required environment variables defined in .env.example.
 * Loads .env from the project root if present, then checks process.env.
 *
 * Usage:
 *   node scripts/env-validate.mjs
 *   pnpm env:validate
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_EXAMPLE_PATH = resolve(ROOT, '.env.example');
const ENV_PATH = resolve(ROOT, '.env');

/** Variables that may be empty or unset (optional per .env.example). */
const OPTIONAL_KEYS = new Set([
  'WORKER_ID',
  'PROMETHEUS_ENABLED',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'SMTP_SECURE',
  'SMTP_HTTP_RELAY_URL',
]);

/** Placeholder values that must be replaced in production. */
const INSECURE_PLACEHOLDERS = new Set([
  'change-me-in-production-use-64-char-random-string-minimum-length-required',
  'change-me',
]);

/**
 * Parse a .env file into key-value pairs (no variable expansion).
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseEnvFile(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Extract variable keys from .env.example (KEY=VALUE lines only).
 * @param {string} content
 * @returns {string[]}
 */
function extractKeysFromExample(content) {
  const keys = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    keys.push(trimmed.slice(0, eqIndex).trim());
  }
  return keys;
}

/**
 * Merge .env file values into process.env for validation (does not mutate global env permanently).
 * @returns {Record<string, string | undefined>}
 */
function loadEnv() {
  const merged = { ...process.env };

  if (existsSync(ENV_PATH)) {
    const dotEnv = parseEnvFile(readFileSync(ENV_PATH, 'utf8'));
    for (const [key, value] of Object.entries(dotEnv)) {
      if (merged[key] === undefined || merged[key] === '') {
        merged[key] = value;
      }
    }
  }

  return merged;
}

function isUnset(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function main() {
  if (!existsSync(ENV_EXAMPLE_PATH)) {
    console.error(`ERROR: .env.example not found at ${ENV_EXAMPLE_PATH}`);
    process.exit(1);
  }

  const exampleContent = readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  const allKeys = extractKeysFromExample(exampleContent);
  const requiredKeys = allKeys.filter((key) => !OPTIONAL_KEYS.has(key));
  const env = loadEnv();

  const missing = [];
  const insecure = [];
  const warnings = [];

  for (const key of requiredKeys) {
    const value = env[key];
    if (isUnset(value)) {
      missing.push(key);
    } else if (key === 'JWT_SECRET' && INSECURE_PLACEHOLDERS.has(String(value).trim())) {
      insecure.push(key);
    } else if (key === 'JWT_SECRET' && String(value).length < 32) {
      warnings.push(`${key}: shorter than recommended 64 characters (got ${String(value).length})`);
    }
  }

  const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    for (const key of ['JWT_SECRET', 'DATABASE_URL']) {
      const value = env[key];
      if (!isUnset(value) && INSECURE_PLACEHOLDERS.has(String(value).trim())) {
        if (!insecure.includes(key)) {
          insecure.push(key);
        }
      }
    }
    if (isUnset(env.SMTP_HOST)) {
      warnings.push('SMTP_HOST is unset — email notifications will use log transport only');
    }
  }

  console.log('Atlas BOS — Environment Validation');
  console.log('===================================');
  console.log(`Source: ${ENV_EXAMPLE_PATH}`);
  console.log(`Loaded: ${existsSync(ENV_PATH) ? ENV_PATH : '(no .env file — using process.env only)'}`);
  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`Required variables: ${requiredKeys.length}`);
  console.log(`Optional variables: ${OPTIONAL_KEYS.size}`);
  console.log('');

  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of warnings) {
      console.log(`  ⚠ ${warning}`);
    }
    console.log('');
  }

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const key of missing) {
      console.error(`  ✗ ${key}`);
    }
    console.error('');
    console.error(`Fix: set missing variables in .env or export them, then re-run pnpm env:validate`);
    process.exit(1);
  }

  if (insecure.length > 0) {
    console.error('Insecure placeholder values detected (must be changed for production):');
    for (const key of insecure) {
      console.error(`  ✗ ${key}`);
    }
    process.exit(1);
  }

  console.log('All required environment variables are set.');
  if (warnings.length === 0) {
    console.log('No warnings.');
  }
  process.exit(0);
}

main();