/**
 * Execution-based grading: run the learner's query and the canonical
 * solution against the same database and compare RESULTS, not strings.
 *
 * Comparison rules (the part interviews actually care about):
 *   - Column COUNT must match; column names are advisory (SELECT aliases
 *     differ legitimately), but a mismatch is surfaced as a hint.
 *   - Rows compare as a MULTISET by default — duplicates matter (a missing
 *     DISTINCT or an accidental fan-out is a real bug) but order doesn't,
 *     unless the problem demands ORDER BY (orderSensitive).
 *   - Cell normalization: numerics compared with 1e-9 relative tolerance
 *     (NUMERIC comes back as strings from Postgres), dates as ISO days,
 *     NULLs as a sentinel distinct from the string "null".
 *   - Feedback on failure: row-count delta plus samples of missing and
 *     unexpected rows — a diff, not a shrug.
 *
 * Anti-hardcoding: `gradeProblem` runs the comparison on the visible AND
 * the hidden dataset variant. Literal-pasted output passes the first and
 * fails the second, and the feedback says so explicitly.
 */

import type { QueryResult } from "../engine/engine";
import { runDml, runQuery, SqlError } from "../engine/engine";
import type { Problem } from "../content/types";

/** Execute a submission per the problem's kind. For "dml" the result is
 *  the check query's output on a fresh, mutated database. */
export async function execute(
  problem: Problem,
  variant: "visible" | "hidden",
  sql: string,
): Promise<QueryResult> {
  if (problem.kind === "dml") {
    return runDml(problem.schema, variant, sql, problem.checkSql!);
  }
  return runQuery(problem.schema, variant, sql);
}

const NULL = "\u0000NULL"; // sentinel: cannot collide with real data

export function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return NULL;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toPrecision(12).replace(/\.?0+$/, "");
  }
  if (typeof value === "string") {
    // NUMERIC/BIGINT arrive as strings; normalize numeric-looking strings
    if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
      const n = Number(value);
      if (Number.isFinite(n)) return normalizeCell(n);
    }
    // timestamps → date-only when time is midnight (DATE columns)
    const m = value.match(/^(\d{4}-\d{2}-\d{2})[T ]00:00:00/);
    if (m) return m[1];
    return value;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

const SEP = "\u001F"; // unit separator keeps cell boundaries in row keys
const rowKey = (row: unknown[]) => row.map(normalizeCell).join(SEP);

export interface Verdict {
  correct: boolean;
  message: string;
  missingSample: string[][];
  extraSample: string[][];
  hiddenFailed?: boolean; // passed visible but failed hidden → hardcoding
  /** What kind of mismatch this is, so the UI can lead with the diagnosis
   *  instead of parsing it back out of `message`. */
  kind?: "columns" | "order" | "rows";
  /** Column headers for the sample tables. Without these the samples are
   *  bare values and the learner has to guess which column is which. */
  columns?: string[];
  expectedCount?: number;
  actualCount?: number;
  /** Totals behind the 5-row samples, so the UI can say "5 of 44" rather than
   *  silently truncating and leaving the learner to wonder. */
  missingTotal?: number;
  extraTotal?: number;
}

export function compareResults(
  actual: QueryResult,
  expected: QueryResult,
  orderSensitive: boolean,
): Verdict {
  const pretty = (key: string) =>
    key.split(SEP).map((c) => (c === NULL ? "NULL" : c));

  if (actual.columns.length !== expected.columns.length) {
    return {
      correct: false,
      message: `Expected ${expected.columns.length} column(s) ` +
        `(${expected.columns.join(", ")}), got ${actual.columns.length} ` +
        `(${actual.columns.join(", ") || "none"}).`,
      missingSample: [], extraSample: [],
      kind: "columns",
      columns: expected.columns,
      expectedCount: expected.columns.length,
      actualCount: actual.columns.length,
    };
  }

  const actualKeys = actual.rows.map(rowKey);
  const expectedKeys = expected.rows.map(rowKey);

  if (orderSensitive) {
    const equal = actualKeys.length === expectedKeys.length &&
      actualKeys.every((k, i) => k === expectedKeys[i]);
    if (equal) return { correct: true, message: "Correct.", missingSample: [], extraSample: [] };
    // fall through to multiset diff for useful feedback, then report ordering
    const multiset = compareMultiset(actualKeys, expectedKeys);
    if (multiset.missing.length === 0 && multiset.extra.length === 0) {
      return {
        correct: false,
        message: "Right rows, wrong order — this problem requires a specific ORDER BY.",
        missingSample: [], extraSample: [],
        kind: "order",
        columns: expected.columns,
        expectedCount: expectedKeys.length,
        actualCount: actualKeys.length,
      };
    }
    return diffVerdict(actualKeys.length, expectedKeys.length, multiset, pretty, expected.columns);
  }

  const multiset = compareMultiset(actualKeys, expectedKeys);
  if (multiset.missing.length === 0 && multiset.extra.length === 0) {
    return { correct: true, message: "Correct.", missingSample: [], extraSample: [] };
  }
  return diffVerdict(actualKeys.length, expectedKeys.length, multiset, pretty, expected.columns);
}

function compareMultiset(actual: string[], expected: string[]) {
  const counts = new Map<string, number>();
  for (const k of expected) counts.set(k, (counts.get(k) ?? 0) + 1);
  const extra: string[] = [];
  for (const k of actual) {
    const c = counts.get(k) ?? 0;
    if (c <= 0) extra.push(k);
    else counts.set(k, c - 1);
  }
  const missing: string[] = [];
  for (const [k, c] of counts) for (let i = 0; i < c; i++) missing.push(k);
  return { missing, extra };
}

function diffVerdict(
  actualCount: number, expectedCount: number,
  { missing, extra }: { missing: string[]; extra: string[] },
  pretty: (k: string) => string[],
  columns?: string[],
): Verdict {
  const parts = [`Expected ${expectedCount} row(s), got ${actualCount}.`];
  if (missing.length) parts.push(`${missing.length} expected row(s) missing.`);
  if (extra.length) parts.push(`${extra.length} unexpected row(s).`);
  return {
    correct: false,
    message: parts.join(" "),
    missingSample: missing.slice(0, 5).map(pretty),
    extraSample: extra.slice(0, 5).map(pretty),
    kind: "rows",
    columns,
    expectedCount,
    actualCount,
    missingTotal: missing.length,
    extraTotal: extra.length,
  };
}

export interface GradeOutcome {
  verdict: Verdict;
  visible: QueryResult; // learner's result on the visible DB (for display)
  error?: string;       // SQL error text, if the query failed to run
}

export async function gradeProblem(problem: Problem, sql: string): Promise<GradeOutcome> {
  let visible: QueryResult;
  try {
    visible = await execute(problem, "visible", sql);
  } catch (err) {
    return {
      verdict: { correct: false, message: "", missingSample: [], extraSample: [] },
      visible: { columns: [], rows: [], elapsedMs: 0 },
      error: err instanceof SqlError ? err.message : String(err),
    };
  }

  const expectedVisible = await execute(problem, "visible", problem.solution);
  const verdict = compareResults(visible, expectedVisible, problem.orderSensitive ?? false);
  if (!verdict.correct) return { verdict, visible };

  // Passed on visible data — re-grade on the hidden variant.
  try {
    const [actualHidden, expectedHidden] = await Promise.all([
      execute(problem, "hidden", sql),
      execute(problem, "hidden", problem.solution),
    ]);
    const hiddenVerdict = compareResults(
      actualHidden, expectedHidden, problem.orderSensitive ?? false,
    );
    if (!hiddenVerdict.correct) {
      return {
        verdict: {
          ...hiddenVerdict,
          hiddenFailed: true,
          message: "Passes on the visible data but fails on a hidden dataset — " +
            "the query likely depends on specific values instead of logic. " + hiddenVerdict.message,
        },
        visible,
      };
    }
  } catch (err) {
    return {
      verdict: { correct: false, message: "", missingSample: [], extraSample: [] },
      visible,
      error: "Hidden-dataset run failed: " +
        (err instanceof SqlError ? err.message : String(err)),
    };
  }

  return { verdict: { correct: true, message: "Correct on visible and hidden datasets.", missingSample: [], extraSample: [] }, visible };
}
