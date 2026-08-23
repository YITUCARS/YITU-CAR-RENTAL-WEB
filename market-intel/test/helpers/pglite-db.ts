import { PGlite } from '@electric-sql/pglite';
import type { Db } from '../../src/database/client.js';

/**
 * Adapts PGlite (Postgres compiled to wasm) to the slice of the node-postgres
 * Pool API this codebase uses.
 *
 * This exists so the schema, the queue's SKIP LOCKED claim, the append-only
 * observation insert and the analysis views are all exercised against a real
 * Postgres in CI, with no database to provision.
 */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const pg = await PGlite.create();

  const query = async (text: string, values?: unknown[]) => {
    if (values === undefined) {
      const results = await pg.exec(text);
      const last = results[results.length - 1];
      return { rows: last?.rows ?? [], rowCount: last?.affectedRows ?? last?.rows?.length ?? 0 };
    }
    const result = await pg.query(text, values as never[]);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };

  const client = { query, release: () => undefined };
  const db = { query, connect: async () => client, end: () => pg.close() } as unknown as Db;

  return { db, close: () => pg.close() };
}
