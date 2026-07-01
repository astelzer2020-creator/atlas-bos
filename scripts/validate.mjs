#!/usr/bin/env node
/**
 * Windows-safe validation runner (bypasses Turbo when unavailable).
 * Runs build, typecheck, tests, integration tests, and e2e sequentially.
 *
 * IMPORTANT: Do not pipe this script in PowerShell (e.g. `| Select-String`).
 * Piping corrupts exit codes. Run directly: `node scripts/validate.mjs`
 * Progress is written to validate-last.log in the repo root.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const logFile = join(rootDir, 'validate-last.log');

const pnpm = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const pnpmArgs = ['pnpm'];

writeFileSync(logFile, `=== validate started ${new Date().toISOString()} ===\n`);

function log(line) {
  appendFileSync(logFile, `${line}\n`);
}

function runStep(label, args) {
  console.log(`\n=== ${label} ===`);
  log(`=== ${label} ===`);

  const result = spawnSync(pnpm, [...pnpmArgs, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
    cwd: rootDir,
  });

  if (result.status !== 0) {
    const message = `FAILED: ${label} (exit ${result.status ?? 'unknown'})`;
    console.error(`\n${message}`);
    log(message);
    process.exit(result.status ?? 1);
  }
}

const filters = [
  '@atlas/shared-kernel',
  '@atlas/platform',
  '@atlas/database',
  '@atlas/event-bus',
  '@atlas/queue',
  '@atlas/module-tenant-identity',
  '@atlas/module-notifications',
  '@atlas/module-storage',
  '@atlas/module-audit',
  '@atlas/module-workflow',
  '@atlas/module-automation',
  '@atlas/module-ai',
  '@atlas/module-ai-memory',
  '@atlas/module-crm',
  '@atlas/module-finance',
  '@atlas/module-projects',
  '@atlas/api',
  '@atlas/worker',
  '@atlas/web',
];

const lintFilters = [
  '@atlas/platform',
  '@atlas/queue',
  '@atlas/event-bus',
  '@atlas/ui',
  '@atlas/web',
];

for (const filter of lintFilters) {
  runStep(`lint ${filter}`, ['--filter', filter, 'lint']);
}

for (const filter of filters) {
  runStep(`build ${filter}`, ['--filter', filter, 'build']);
}

for (const filter of filters) {
  runStep(`typecheck ${filter}`, ['--filter', filter, 'typecheck']);
}

const testFilters = [
  '@atlas/shared-kernel',
  '@atlas/platform',
  '@atlas/database',
  '@atlas/event-bus',
  '@atlas/queue',
  '@atlas/module-automation',
  '@atlas/module-ai',
  '@atlas/module-ai-memory',
  '@atlas/module-workflow',
  '@atlas/module-crm',
  '@atlas/module-finance',
  '@atlas/module-projects',
  '@atlas/module-notifications',
  '@atlas/module-tenant-identity',
  '@atlas/api',
  '@atlas/worker',
  '@atlas/web',
  '@atlas/integration-tests',
  '@atlas/performance-tests',
];

for (const filter of testFilters) {
  runStep(`test ${filter}`, ['--filter', filter, 'test']);
}

runStep('test:e2e', ['test:e2e']);

const done = `All validation steps passed. (${new Date().toISOString()})`;
console.log(`\n${done}`);
log(done);
process.exit(0);