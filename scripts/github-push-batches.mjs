#!/usr/bin/env node
/**
 * Emit file batches for GitHub MCP push_files (stdout JSON lines).
 * Usage: node scripts/github-push-batches.mjs [--batch-size=80]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const batchSize = Number(process.argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1] ?? 80);

const git =
  process.platform === 'win32'
    ? join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Git', 'bin', 'git.exe')
    : 'git';

const files = execSync(`"${git}" ls-files`, { cwd: ROOT, encoding: 'utf8', shell: true })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(
    (line) =>
      line.length > 0 &&
      line !== '.env' &&
      !line.startsWith('.github-push-batch-') &&
      !line.endsWith('.log'),
  );
const batches = [];
for (let i = 0; i < files.length; i += batchSize) {
  const slice = files.slice(i, i + batchSize);
  batches.push(
    slice.map((path) => ({
      path,
      content: readFileSync(join(ROOT, path), 'utf8'),
    })),
  );
}

console.log(JSON.stringify({ totalFiles: files.length, batches: batches.length, batchSize }));
for (const [i, batch] of batches.entries()) {
  const outPath = join(ROOT, `.github-push-batch-${i}.json`);
  writeFileSync(outPath, JSON.stringify(batch));
}