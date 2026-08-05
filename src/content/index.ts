import { warmups } from "./module-warmups";
import { analytics, interviewSet, patterns } from "./modules-advanced";
import { foundations, joins, subqueries } from "./modules-core";
import { expressions, hierarchy, mutations } from "./modules-extended";
import { ctes, windows1, windows2 } from "./modules-windows";
import { nulls } from "./modules-nulls";
import { groupingAdvanced } from "./modules-grouping";
import { timeseries } from "./modules-timeseries";
import { dedup, stats } from "./modules-cleaning";
import { pivots, textPatterns } from "./modules-shaping";
import type { Module, Problem, Stage } from "./types";
import { EXTRA } from "./extra-problems";
import { withVariants } from "./variants";

// Topic tags derived from the solution SQL — one source of truth, no manual
// per-problem tagging to drift out of sync. Order = display priority.
const TOPIC_RULES: [tag: string, test: RegExp][] = [
  ["window functions", /\bOVER\s*\(/i],
  ["recursion", /\bRECURSIVE\b/i],
  ["CTEs", /\bWITH\b/i],
  ["joins", /\bJOIN\b/i],
  ["subqueries", /\b(EXISTS|IN\s*\(SELECT|\(\s*SELECT)/i],
  ["set operations", /\b(UNION|INTERSECT|EXCEPT)\b/i],
  ["aggregation", /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i],
  ["grouping", /\bGROUP BY\b/i],
  ["conditional logic", /\b(CASE|FILTER\s*\()/i],
  ["date/time", /\b(date_trunc|generate_series|EXTRACT|TO_CHAR|INTERVAL|::date)\b/i],
  ["string functions", /\b(UPPER|LOWER|STRING_AGG|SUBSTRING|LIKE|\|\|)\b/i],
  ["null handling", /\b(IS DISTINCT FROM|COALESCE|NULLIF|IS NULL)\b/i],
  ["data modification", /\b(INSERT|UPDATE|DELETE|ON CONFLICT|BEGIN)\b/i],
  ["ranking", /\b(ROW_NUMBER|RANK|DENSE_RANK)\s*\(/i],
];

function deriveTopics(sql: string): string[] {
  // Priority-ordered; cap at 4 so the most specific topics show, not noise.
  return TOPIC_RULES.filter(([, re]) => re.test(sql)).map(([tag]) => tag).slice(0, 4);
}

// Previously each interview problem also got a "Meta-style" / "Google-style"
// badge chosen by hashing its id. That is not information — the label and the
// problem were unrelated — and an invented claim has no place in a product
// whose pitch is that every claim is checkable. Topics below are derived from
// the actual solution SQL, so they cannot drift or be made up.
/**
 * The Core Path.
 *
 * 185 problems is a library, not a curriculum. Nobody finishes 185, and
 * showing that number first makes the mountain the first thing a learner
 * sees. These 40 are the shortest honest route from nothing to being able to
 * hold your own in a SQL interview: one problem per distinct idea, chosen for
 * how well it teaches rather than how hard it is.
 *
 * Everything not on this list stays available as optional depth. A learner
 * who wants more joins practice can have thirteen; a learner who wants to be
 * done can be done in forty.
 */
const CORE_PATH = new Set([
  // Foundations — reading one table, and counting it
  "wu1",  // SELECT specific columns
  "wu3",  // WHERE on text
  "wu8",  // ORDER BY DESC
  "wu9",  // LIMIT, and why it needs ORDER BY
  "wu11", // COUNT with a filter
  "f5",   // SUM of an expression: multiply before you sum
  "f4",   // GROUP BY with HAVING

  // Core — missing values, more than one table, queries inside queries
  "n1",   // IS NULL, not = NULL
  "n2",   // COUNT(*) vs COUNT(col)
  "n3",   // the NOT IN trap
  "n5",   // NULLIF, safe division
  "j1",   // inner join
  "j2",   // anti-join: LEFT JOIN then IS NULL
  "j4",   // LEFT JOIN counted correctly
  "j5",   // fan-out: the join that doubles revenue
  "s1",   // scalar subquery
  "s3",   // NOT EXISTS
  "x5",   // CASE

  // Intermediate — naming results, looking across rows
  "ga1",  // FILTER
  "c1",   // a CTE
  "w1",   // a first window function
  "w2",   // ROW_NUMBER: latest row per group
  "w3",   // top N per group
  "w5",   // RANK vs DENSE_RANK, and ties
  "w6",   // compare a row to its own group
  "o2",   // running total
  "o3",   // moving average and the frame clause
  "o5",   // LAG and period-over-period growth

  // Advanced — the shapes analysts actually ship
  "ts1",  // date spine, so quiet days exist
  "ts3",  // gaps and islands
  "ts4",  // LATERAL, top N per group the other way
  "dd2",  // deduplicate to one row per key
  "h2",   // recursive CTE
  "pv1",  // pivot
  "st1",  // median via PERCENTILE_CONT

  // Interview — mixed, and the questions companies actually ask
  "a1",   // retention
  "a3",   // funnel
  "i1",   // top per group, under pressure
  "i2",   // net revenue without double counting
  "i5",   // consecutive periods
]);

function tag(p: Problem): Problem {
  return { ...p, topics: deriveTopics(p.solution), core: CORE_PATH.has(p.id) };
}

/**
 * The curriculum, in the order the ideas build. Each entry carries its stage,
 * so the sequence is data rather than a side effect of array position — and
 * because stages are contiguous here, the roadmap the dashboard renders and
 * the path "Continue" walks are provably the same list.
 */
const CURRICULUM: [Module, Stage][] = [
  [warmups,          "foundations"],
  [foundations,      "foundations"],

  [nulls,            "core"],
  [joins,            "core"],
  [subqueries,       "core"],
  [expressions,      "core"],

  [groupingAdvanced, "intermediate"],
  [ctes,             "intermediate"],
  [windows1,         "intermediate"],
  [windows2,         "intermediate"],

  [timeseries,       "advanced"],
  [patterns,         "advanced"],
  [dedup,            "advanced"],
  [hierarchy,        "advanced"],
  [mutations,        "advanced"],
  [pivots,           "advanced"],
  [textPatterns,     "advanced"],
  [stats,            "advanced"],

  [analytics,        "interview"],
  [interviewSet,     "interview"],
];

// Guard: stages must stay contiguous, or the roadmap and the path diverge
// again. Cheap to check, and it fails loudly at import time rather than
// quietly misleading a learner.
{
  const seen = new Set<Stage>();
  let prev: Stage | null = null;
  for (const [, stage] of CURRICULUM) {
    if (stage !== prev) {
      if (seen.has(stage)) {
        throw new Error(`Curriculum stage "${stage}" is not contiguous.`);
      }
      seen.add(stage);
      prev = stage;
    }
  }
}

export const MODULES: Module[] = withVariants(CURRICULUM.map(([m]) => m))
  .map((m, i) => ({
    ...m,
    stage: CURRICULUM[i][1],
    problems: [...m.problems, ...(EXTRA[m.id] ?? [])].map(tag),
  }));

export const ALL_PROBLEMS: Problem[] = MODULES.flatMap((m) => m.problems);

export const ALL_TOPICS: string[] = [...new Set(ALL_PROBLEMS.flatMap((p) => p.topics ?? []))].sort();

export const problemById = new Map(ALL_PROBLEMS.map((p) => [p.id, p]));

export function moduleOf(problemId: string): Module | undefined {
  return MODULES.find((m) => m.problems.some((p) => p.id === problemId));
}

/** Timed interview mode: pick n interview-eligible problems, deterministic per day. */
export function interviewDraw(n = 5, seedStr = new Date().toISOString().slice(0, 10)): Problem[] {
  const pool = ALL_PROBLEMS.filter((p) => p.interview);
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    const j = (h >>> 0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // spread difficulty: prefer a mix, hard-weighted
  shuffled.sort((a, b) => a.difficulty - b.difficulty);
  const picks = [
    ...shuffled.filter((p) => p.difficulty <= 3).slice(0, 2),
    ...shuffled.filter((p) => p.difficulty === 4).slice(0, n - 2),
  ];
  return picks.slice(0, n);
}
