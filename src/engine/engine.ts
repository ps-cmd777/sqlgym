/**
 * SQL engine abstraction over PGlite (real Postgres compiled to WASM).
 *
 * One PGlite instance per (schema, variant), created lazily and cached —
 * switching problems within a schema is instant, and the hidden-variant
 * database only spins up at grading time. The interface is deliberately
 * tiny so a DuckDB-WASM (or Phase-2 Pyodide) backend can slot in later.
 */

import { PGlite } from "@electric-sql/pglite";
import { buildDataset, type SchemaName, type SEEDS } from "../data/datasets";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  elapsedMs: number;
}

export class SqlError extends Error {}

const cache = new Map<string, Promise<PGlite>>();

async function instance(schema: SchemaName, variant: keyof typeof SEEDS): Promise<PGlite> {
  const key = `${schema}:${variant}`;
  let db = cache.get(key);
  if (!db) {
    db = (async () => {
      const pg = new PGlite(); // in-memory
      const dataset = buildDataset(schema, variant);
      await pg.exec(dataset.schema);
      await pg.exec(dataset.inserts);
      return pg;
    })();
    cache.set(key, db);
  }
  return db;
}

/** Pre-warm the visible database for a schema (called on problem open). */
export function warm(schema: SchemaName): void {
  void instance(schema, "visible");
}

export async function runQuery(
  schema: SchemaName,
  variant: keyof typeof SEEDS,
  sql: string,
  rowLimit = 500,
): Promise<QueryResult> {
  const pg = await instance(schema, variant);
  const started = performance.now();
  let result;
  // Shared instances must stay pristine: run inside a rolled-back
  // transaction so a stray UPDATE can't poison other problems.
  await pg.exec("BEGIN");
  try {
    result = await pg.query(sql, [], { rowMode: "array" });
  } catch (err) {
    throw new SqlError(err instanceof Error ? err.message : String(err));
  } finally {
    await pg.exec("ROLLBACK").catch(() => {});
  }
  const elapsedMs = Math.round(performance.now() - started);
  const columns = (result.fields ?? []).map((f: { name: string }) => f.name);
  const rows = ((result.rows ?? []) as unknown[][]).slice(0, rowLimit);
  return { columns, rows, elapsedMs };
}

/** DML problems get a FRESH database per run: execute the learner's
 *  statements (multi-statement allowed), then evaluate `checkSql` on the
 *  mutated state. The instance is discarded afterwards. */
export async function runDml(
  schema: SchemaName,
  variant: keyof typeof SEEDS,
  userSql: string,
  checkSql: string,
  rowLimit = 500,
): Promise<QueryResult> {
  const pg = new PGlite();
  try {
    const dataset = buildDataset(schema, variant);
    await pg.exec(dataset.schema);
    await pg.exec(dataset.inserts);
    const started = performance.now();
    try {
      await pg.exec(userSql);
    } catch (err) {
      throw new SqlError(err instanceof Error ? err.message : String(err));
    }
    const result = await pg.query(checkSql, [], { rowMode: "array" });
    const elapsedMs = Math.round(performance.now() - started);
    return {
      columns: (result.fields ?? []).map((f: { name: string }) => f.name),
      rows: ((result.rows ?? []) as unknown[][]).slice(0, rowLimit),
      elapsedMs,
    };
  } finally {
    await pg.close().catch(() => {});
  }
}
