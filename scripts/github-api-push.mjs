#!/usr/bin/env node
/**
 * Push repository batches to GitHub via Contents API.
 * Requires GITHUB_TOKEN env var (repo scope).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = process.env.GITHUB_OWNER ?? 'astelzer2020-creator';
const REPO = process.env.GITHUB_REPO ?? 'atlas-bos';
const BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

const api = (path, opts = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers ?? {}),
    },
  });

async function getRefSha() {
  const res = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getRef: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.object.sha;
}

async function createBlob(content) {
  const res = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  if (!res.ok) throw new Error(`blob: ${res.status} ${await res.text()}`);
  return (await res.json()).sha;
}

async function createTree(files, baseSha) {
  const tree = await Promise.all(
    files.map(async ({ path, content }) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha: await createBlob(content),
    })),
  );
  const body = baseSha ? { base_tree: baseSha, tree } : { tree };
  const res = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`tree: ${res.status} ${await res.text()}`);
  return (await res.json()).sha;
}

async function createCommit(message, treeSha, parentSha) {
  const body = parentSha
    ? { message, tree: treeSha, parents: [parentSha] }
    : { message, tree: treeSha, parents: [] };
  const res = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`commit: ${res.status} ${await res.text()}`);
  return (await res.json()).sha;
}

async function updateRef(sha) {
  const existing = await getRefSha();
  if (existing) {
    const res = await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha, force: false }),
    });
    if (!res.ok) throw new Error(`updateRef: ${res.status} ${await res.text()}`);
  } else {
    const res = await api(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }),
    });
    if (!res.ok) throw new Error(`createRef: ${res.status} ${await res.text()}`);
  }
}

const batchFiles = readdirSync(ROOT)
  .filter((f) => f.startsWith('.github-push-batch-') && f.endsWith('.json'))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

let parentSha = await getRefSha();
let baseTreeSha = parentSha
  ? (await (await api(`/repos/${OWNER}/${REPO}/git/commits/${parentSha}`)).json()).tree.sha
  : null;

for (const [i, batchFile] of batchFiles.entries()) {
  const files = JSON.parse(readFileSync(join(ROOT, batchFile), 'utf8'));
  console.log(`Pushing batch ${i + 1}/${batchFiles.length} (${files.length} files)...`);
  const treeSha = await createTree(files, baseTreeSha);
  const commitSha = await createCommit(
    i === 0
      ? 'release: Atlas BOS v1.0.0 production-ready'
      : `release: Atlas BOS v1.0.0 (batch ${i + 1}/${batchFiles.length})`,
    treeSha,
    parentSha,
  );
  await updateRef(commitSha);
  parentSha = commitSha;
  baseTreeSha = treeSha;
  console.log(`  commit ${commitSha}`);
}

console.log(`Done. HEAD=${parentSha}`);