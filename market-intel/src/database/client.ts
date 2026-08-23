import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

/**
 * Postgres returns numeric/int8 as strings by default to avoid precision loss.
 * Prices here are far inside the safe-integer range, and every consumer wants
 * numbers, so parse them once at the driver level.
 */
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v))); // numeric
pg.types.setTypeParser(20, (v) => (v === null ? null : Number.parseInt(v, 10))); // int8

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

let pool: pg.Pool | undefined;

export function getDb(databaseUrl: string): Db {
  if (pool) return pool;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  const needsSsl = /supabase\.(co|com)|neon\.tech|render\.com|amazonaws\.com/.test(databaseUrl);
  pool = new Pool({
    connectionString: databaseUrl,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'market-intel',
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  pool.on('error', (err) => logger.error({ err: err.message }, 'idle postgres client error'));
  return pool;
}

export async function closeDb(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}

/** Run a function inside a transaction, rolling back on any throw. */
export async function withTransaction<T>(db: Db, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
