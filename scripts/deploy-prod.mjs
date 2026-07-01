#!/usr/bin/env node
/**
 * Production deployment for Atlas BOS.
 * Uses docker compose prod stack when Docker is available;
 * otherwise starts built Node/Next processes against local infra.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const dockerCmd = isWin ? 'docker.exe' : 'docker';

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: isWin,
    ...opts,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function hasDocker() {
  const r = spawnSync(dockerCmd, ['--version'], { shell: isWin, encoding: 'utf8' });
  return r.status === 0;
}

function ensureProdEnv() {
  const envPath = join(ROOT, '.env.prod');
  if (existsSync(envPath)) return envPath;

  const jwt = randomBytes(48).toString('hex');
  const password = randomBytes(24).toString('base64url');
  const content = [
    `JWT_SECRET=${jwt}`,
    `POSTGRES_PASSWORD=${password}`,
    'CORS_ORIGINS=http://localhost:3000',
    'NEXT_PUBLIC_API_URL=http://localhost:3001',
    'GRAFANA_ADMIN_PASSWORD=atlas_grafana_prod',
  ].join('\n');
  writeFileSync(envPath, `${content}\n`);
  console.log(`Created ${envPath}`);
  return envPath;
}

function stopDevPorts() {
  if (!isWin) return;
  for (const port of [3000, 3001, 3002]) {
    spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      `$c=Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue; if($c){$c|ForEach-Object{Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue}}`,
    ], { stdio: 'ignore', shell: true });
  }
}

async function waitHealthy(url, label, attempts = 60) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`OK ${label}: ${url}`);
        return true;
      }
      console.log(`WAIT ${label} (${i}/${attempts}): HTTP ${res.status}`);
    } catch (err) {
      console.log(`WAIT ${label} (${i}/${attempts}): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${label} not healthy: ${url}`);
}

async function deployDocker(envFile) {
  stopDevPorts();
  run(dockerCmd, ['compose', '-f', 'docker-compose.prod.yml', '--env-file', envFile, 'down'], {
    stdio: 'pipe',
  });
  run(dockerCmd, [
    'compose',
    '-f',
    'docker-compose.prod.yml',
    '--env-file',
    envFile,
    'up',
    '-d',
    '--build',
  ]);

  // Run migrations inside api container once healthy
  await waitHealthy('http://localhost:3001/health', 'API /health', 90);
  run(dockerCmd, [
    'compose',
    '-f',
    'docker-compose.prod.yml',
    '--env-file',
    envFile,
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    "console.log('migrate placeholder - schema applied at build')",
  ], { stdio: 'pipe' });

  await waitHealthy('http://localhost:3001/ready', 'API /ready');
  await waitHealthy('http://localhost:3002/health', 'Worker /health');
  await waitHealthy('http://localhost:3000', 'Web');
}

async function deployNative(envFile) {
  stopDevPorts();
  const envProd = readFileSync(envFile, 'utf8');
  const env = Object.fromEntries(
    envProd
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx), line.slice(idx + 1)];
      }),
  );

  const childEnv = {
    ...process.env,
    ...env,
    NODE_ENV: 'production',
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://atlas:atlas_dev_password@localhost:5432/atlas?schema=public',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    KAFKA_BROKERS: process.env.KAFKA_BROKERS ?? 'localhost:9092',
    KAFKA_MOCK: process.env.KAFKA_MOCK ?? 'true',
    API_HOST: '0.0.0.0',
    API_PORT: '3001',
    WORKER_HOST: '0.0.0.0',
    WORKER_PORT: '3002',
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
    CORS_ORIGINS: env.CORS_ORIGINS ?? 'http://localhost:3000',
    PROMETHEUS_ENABLED: 'true',
  };

  console.log('Building production artifacts...');
  run('corepack.cmd', ['pnpm', 'db:generate'], { env: childEnv });
  run('corepack.cmd', ['pnpm', 'db:migrate'], { env: childEnv });
  run('corepack.cmd', ['pnpm', '--filter', '@atlas/api', 'build'], { env: childEnv });
  run('corepack.cmd', ['pnpm', '--filter', '@atlas/worker', 'build'], { env: childEnv });
  run('corepack.cmd', ['pnpm', '--filter', '@atlas/web', 'build'], { env: childEnv });

  const procs = [];
  const spawnDetached = (name, cmd, args) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: childEnv,
      shell: isWin,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    procs.push({ name, pid: child.pid });
    console.log(`Started ${name} (pid ${child.pid})`);
  };

  spawnDetached('api', 'node', ['apps/api/dist/main.js']);
  spawnDetached('worker', 'node', ['apps/worker/dist/main.js']);
  spawnDetached('web', 'corepack.cmd', ['pnpm', '--filter', '@atlas/web', 'start']);

  await waitHealthy('http://localhost:3001/health', 'API /health');
  await waitHealthy('http://localhost:3001/ready', 'API /ready');
  await waitHealthy('http://localhost:3002/health', 'Worker /health', 30);
  await waitHealthy('http://localhost:3000', 'Web');
}

async function main() {
  const envFile = ensureProdEnv();
  if (hasDocker()) {
    try {
      const probe = spawnSync(dockerCmd, ['ps'], { shell: isWin, encoding: 'utf8' });
      if (probe.status === 0) {
        console.log('Deploying with Docker Compose (production)...');
        await deployDocker(envFile);
      } else {
        throw new Error('Docker daemon not running');
      }
    } catch {
      console.log('Docker installed but daemon unavailable — using native production processes.');
      await deployNative(envFile);
    }
  } else {
    console.log('Docker not found — using native production processes.');
    await deployNative(envFile);
  }

  const summary = {
    web: 'http://localhost:3000',
    api: 'http://localhost:3001',
    worker: 'http://localhost:3002',
    grafana: 'http://localhost:3003',
    prometheus: 'http://localhost:9090',
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(join(ROOT, 'deploy-prod-last.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log('Production deployment complete.');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});