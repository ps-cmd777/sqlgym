/**
 * Content validation: every canonical solution must execute successfully
 * against BOTH dataset variants and return at least one row (a canonical
 * answer of zero rows almost always means a broken problem). Also checks
 * id uniqueness and that order-sensitive problems contain ORDER BY.
 *
 * Runs in Node with the same PGlite engine the app uses:
 *   npm run validate
 * CI runs this on every push — a broken problem cannot ship.
 */

import { PGlite } from "@electric-sql/pglite";
import { MODULES, ALL_PROBLEMS } from "../src/content/index";
import { buildDataset, SEEDS, type SchemaName } from "../src/data/datasets";

const dbs = new Map<string, PGlite>();

async function db(schema: SchemaName, variant: keyof typeof SEEDS): Promise<PGlite> {
  const key = `${schema}:${variant}`;
  let pg = dbs.get(key);
  if (!pg) {
    pg = new PGlite();
    const ds = buildDataset(schema, variant);
    await pg.exec(ds.schema);
    await pg.exec(ds.inserts);
    dbs.set(key, pg);
  }
  return pg;
}

async function main() {
  let failures = 0;

  const ids = ALL_PROBLEMS.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    console.error("✗ duplicate problem ids");
    failures++;
  }

  for (const module of MODULES) {
    for (const problem of module.problems) {
      if (problem.orderSensitive && !/order\s+by/i.test(problem.solution)) {
        console.error(`✗ ${problem.id} is orderSensitive but the solution has no ORDER BY`);
        failures++;
      }
      if (problem.kind === "dml" && !problem.checkSql) {
        console.error(`✗ ${problem.id}: kind "dml" requires checkSql`);
        failures++;
        continue;
      }
      for (const variant of ["visible", "hidden"] as const) {
        try {
          let rows: number;
          if (problem.kind === "dml") {
            // fresh database: apply the canonical mutation, then verify state
            const pg = new PGlite();
            const ds = buildDataset(problem.schema, variant);
            await pg.exec(ds.schema);
            await pg.exec(ds.inserts);
            await pg.exec(problem.solution);
            const res = await pg.query(problem.checkSql!, [], { rowMode: "array" });
            rows = (res.rows ?? []).length;
            await pg.close();
          } else {
            const pg = await db(problem.schema, variant);
            const res = await pg.query(problem.solution, [], { rowMode: "array" });
            rows = (res.rows ?? []).length;
          }
          if (rows === 0) {
            console.error(`✗ ${problem.id} [${variant}]: canonical solution returns 0 rows`);
            failures++;
          } else {
            console.log(`✓ ${module.id}/${problem.id} [${variant}]: ${rows} row(s)`);
          }
        } catch (err) {
          console.error(`✗ ${problem.id} [${variant}]: ${err instanceof Error ? err.message : err}`);
          failures++;
        }
      }
    }
  }

  console.log(`\n${ALL_PROBLEMS.length} problems across ${MODULES.length} modules.`);
  if (failures) {
    console.error(`${failures} validation failure(s).`);
    process.exit(1);
  }
  console.log("All canonical solutions verified on both dataset variants.");
}

main();
