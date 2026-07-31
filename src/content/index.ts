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
import type { Module, Problem } from "./types";
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
function tag(p: Problem): Problem {
  return { ...p, topics: deriveTopics(p.solution) };
}

export const MODULES: Module[] = withVariants([
  warmups, foundations, nulls, joins, subqueries, expressions, groupingAdvanced,
  ctes, windows1, windows2, timeseries, patterns, dedup, hierarchy, mutations,
  pivots, textPatterns, stats, analytics, interviewSet,
]).map((m) => ({
  ...m,
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
