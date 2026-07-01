#!/usr/bin/env node
/**
 * Windows-safe dev launcher (bypasses Turbo when its native binary fails).
 * Starts API, worker, and web in parallel.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const pnpmArgs = ['pnpm'];

const services = [
  { name: 'api', filter: '@atlas/api' },
  { name: 'worker', filter: '@atlas/worker' },
  { name: 'web', filter: '@atlas/web' },
];

const children = [];

function prefixLines(name, chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 0) {
      process.stdout.write(`[${name}] ${line}\n`);
    }
  }
}

function startService({ name, filter }) {
  const child = spawn(pnpm, [...pnpmArgs, '--filter', filter, 'dev'], {
    cwd: rootDir,
    shell: process.platform === 'win32',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => { prefixLines(name, chunk); });
  child.stderr.on('data', (chunk) => { prefixLines(name, chunk); });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[${name}] stopped (${signal})`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code ?? 1);
    }
  });

  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    process.exit(code);
  }, 500);
}

process.on('SIGINT', () => { shutdown(0); });
process.on('SIGTERM', () => { shutdown(0); });

console.log('Starting Atlas dev stack (api + worker + web)...\n');
console.log('  Web:    http://localhost:3000');
console.log('  API:    http://localhost:3001');
console.log('  Worker: http://localhost:3002\n');

for (const service of services) {
  startService(service);
}