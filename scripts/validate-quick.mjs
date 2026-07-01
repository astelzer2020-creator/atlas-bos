#!/usr/bin/env node
/**
 * Fast validation smoke check (~15s). Use for harness/CI pre-checks.
 * Full release gate: node scripts/validate.mjs
 */
import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const pnpmArgs = ['pnpm'];

function runStep(label, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(pnpm, [...pnpmArgs, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\nFAILED: ${label} (exit ${result.status ?? 'unknown'})`);
    process.exit(result.status ?? 1);
  }
}

const quickLint = ['@atlas/platform', '@atlas/ui', '@atlas/web'];
for (const filter of quickLint) {
  runStep(`lint ${filter}`, ['--filter', filter, 'lint']);
}

runStep('typecheck @atlas/web', ['--filter', '@atlas/web', 'typecheck']);
runStep('test @atlas/web', ['--filter', '@atlas/web', 'test']);
runStep('test @atlas/platform', ['--filter', '@atlas/platform', 'test']);

console.log('\nQuick validation passed. Run `node scripts/validate.mjs` for full release gate.');