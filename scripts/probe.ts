/**
 * Data probe — what patterns actually exist in the generated datasets?
 *
 * Written after three exercises shipped that were unanswerable: the SQL was
 * correct but the generated data held no examples of what the prompt asked
 * for. One asked learners to find duplicate track titles when no two tracks
 * shared a title. The validator caught them, but only after they were written.
 *
 * This checks the data first. Run it before writing an exercise that depends
 * on a pattern existing (duplicates, ties, gaps, multi-row groups) and you
 * find out in a second rather than after the fact.
 *
 *   npx tsx scripts/probe.ts                 # run the standard checks
 *   npx tsx scripts/probe.ts "SELECT ..."    # run your own query on both seeds
 */

import { buildDataset, SEEDS, type SchemaName } from "../src/data/datasets";
import { PGlite } from "@electric-sql/pglite";

/** Checks worth running before writing an exercise that assumes a shape. */
const CHECKS: { label: string; schema: SchemaName; sql: string }[] = [
  {
    label: "artists with more than one track",
    schema: "wavely",
    sql: "SELECT COUNT(*) FROM (SELECT artist FROM tracks GROUP BY artist HAVING COUNT(*) > 1) t",
  },
  {
    label: "duplicate track titles",
    schema: "wavely",
    sql: "SELECT COUNT(*) FROM (SELECT title FROM tracks GROUP BY title HAVING COUNT(*) > 1) t",
  },
  {
    label: "user+day combinations with more than one play",
    schema: "wavely",
    sql: "SELECT COUNT(*) FROM (SELECT user_id, played_on FROM plays GROUP BY 1,2 HAVING COUNT(*) > 1) t",
  },
  {
    label: "users with a NULL referrer",
    schema: "wavely",
    sql: "SELECT COUNT(*) FROM users WHERE referred_by IS NULL",
  },
  {
    label: "days in March with no plays at all",
    schema: "wavely",
    sql: `SELECT COUNT(*) FROM generate_series('2025-03-01'::date,'2025-03-31'::date,interval '1 day') d
          LEFT JOIN plays p ON p.played_on = d::date WHERE p.play_id IS NULL`,
  },
  {
    label: "customers with more than one order",
    schema: "brightmart",
    sql: "SELECT COUNT(*) FROM (SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*) > 1) t",
  },
  {
    label: "customer+day combinations with more than one order",
    schema: "brightmart",
    sql: "SELECT COUNT(*) FROM (SELECT customer_id, ordered_on FROM orders GROUP BY 1,2 HAVING COUNT(*) > 1) t",
  },
  {
    label: "orders carrying at least one refund",
    schema: "brightmart",
    sql: "SELECT COUNT(DISTINCT order_id) FROM refunds",
  },
];

async function db(schema: SchemaName, variant: keyof typeof SEEDS) {
  const pg = new PGlite();
  const ds = buildDataset(schema, variant);
  await pg.exec(ds.schema);
  await pg.exec(ds.inserts);
  return pg;
}

async function scalar(pg: PGlite, sql: string): Promise<string> {
  const res = await pg.query<Record<string, unknown>>(sql);
  const row = res.rows[0];
  return row ? String(Object.values(row)[0]) : "—";
}

async function main() {
  const custom = process.argv[2];

  if (custom) {
    // Ad-hoc mode: run one query against both seeds of every schema. A pattern
    // that exists in the visible data but not the hidden one is exactly the
    // trap that makes an exercise pass validation and then fail a learner.
    for (const schema of ["wavely", "brightmart", "orbit"] as SchemaName[]) {
      for (const variant of ["visible", "hidden"] as (keyof typeof SEEDS)[]) {
        const pg = await db(schema, variant);
        try {
          const res = await pg.query<Record<string, unknown>>(custom);
          console.log(`${schema}/${variant}: ${res.rows.length} row(s)`,
            res.rows.slice(0, 3));
        } catch {
          // The query almost certainly does not apply to this schema. Skip.
        }
        await pg.close();
      }
    }
    return;
  }

  console.log("pattern".padEnd(52), "visible".padStart(8), "hidden".padStart(8));
  console.log("-".repeat(70));
  for (const check of CHECKS) {
    const counts: string[] = [];
    for (const variant of ["visible", "hidden"] as (keyof typeof SEEDS)[]) {
      const pg = await db(check.schema, variant);
      counts.push(await scalar(pg, check.sql));
      await pg.close();
    }
    const zero = counts.includes("0");
    console.log(
      `${zero ? "!" : " "} ${check.label}`.padEnd(52),
      counts[0].padStart(8),
      counts[1].padStart(8),
    );
  }
  console.log("\n!  = no rows in at least one variant. Any exercise relying on");
  console.log("   this pattern is unanswerable and must not be written.");
}

main();
