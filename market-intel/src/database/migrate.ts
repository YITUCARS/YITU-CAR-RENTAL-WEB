import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { packageRoot } from '../config/load.js';
import { logger } from '../utils/logger.js';
import type { Db } from './client.js';

const MIGRATIONS_DIR = path.join(packageRoot, 'sql');

const BOOTSTRAP = `
create schema if not exists market_intel;
create table if not exists market_intel._migrations (
  filename   text primary key,
  checksum   text not null,
  applied_at timestamptz not null default now()
);`;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  changed: string[];
}

/**
 * Plain forward-only SQL migrations. Files are applied in filename order and
 * recorded with a checksum, so an already-applied file that has been edited is
 * reported rather than silently ignored.
 */
export async function migrate(db: Db): Promise<MigrationResult> {
  await db.query(BOOTSTRAP);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await db.query<{ filename: string; checksum: string }>(
    'select filename, checksum from market_intel._migrations',
  );
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  const result: MigrationResult = { applied: [], skipped: [], changed: [] };

  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
    const previous = applied.get(file);

    if (previous) {
      if (previous !== checksum) {
        result.changed.push(file);
        logger.warn({ file }, 'migration file changed after being applied; add a new file instead');
      } else {
        result.skipped.push(file);
      }
      continue;
    }

    logger.info({ file }, 'applying migration');
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query(
        'insert into market_intel._migrations (filename, checksum) values ($1, $2)',
        [file, checksum],
      );
      await client.query('commit');
      result.applied.push(file);
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  return result;
}
