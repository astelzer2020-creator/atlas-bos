#!/usr/bin/env node
/**
 * Applies versioned SQL migrations from packages/database/db/migrations (V001–Vnnn).
 * Tracks applied versions in atlas_core.schema_migrations.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../db/migrations');

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://atlas:atlas_dev_password@localhost:5432/atlas';

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS atlas_core;
    CREATE TABLE IF NOT EXISTS atlas_core.schema_migrations (
      version     TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function listMigrationFiles() {
  const entries = await readdir(migrationsDir);
  return entries
    .filter((name) => /^V\d+__.+\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function checksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationTable(client);
    const files = await listMigrationFiles();

    const appliedResult = await client.query(
      'SELECT version FROM atlas_core.schema_migrations ORDER BY version',
    );
    const applied = new Set(appliedResult.rows.map((row) => row.version));

    let migrationsRun = 0;

    for (const file of files) {
      const version = file.replace(/\.sql$/i, '');
      if (applied.has(version)) {
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = await readFile(fullPath, 'utf8');
      const hash = checksum(sql);

      console.log(`Applying ${version}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO atlas_core.schema_migrations (version, checksum) VALUES ($1, $2)',
          [version, hash],
        );
        await client.query('COMMIT');
        migrationsRun += 1;
        console.log(`Applied ${version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    if (migrationsRun === 0) {
      console.log('Database schema is up to date.');
    } else {
      console.log(`Applied ${migrationsRun} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});