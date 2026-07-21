import { warmups } from "./module-warmups";
import { analytics, interviewSet, patterns } from "./modules-advanced";
import { foundations, joins, subqueries } from "./modules-core";
import { expressions, hierarchy, mutations } from "./modules-extended";
import { ctes, windows1, windows2 } from "./modules-windows";
import type { Module, Problem } from "./types";
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

// Pattern-flavored interview tag. NOT a real leaked question — a nod to the
// company style each pattern shows up in. Deterministic by problem id.
const COMPANY_STYLES = ["FAANG-style", "Amazon-style", "Meta-style", "Google-style", "Startup-style"];
function companyFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COMPANY_STYLES[h % COMPANY_STYLES.length];
}

function tag(p: Problem): Problem {
  return {
    ...p,
    topics: deriveTopics(p.solution),
    company: p.interview ? companyFor(p.id) : undefined,
  };
}

export const MODULES: Module[] = withVariants([
  warmups, foundations, joins, subqueries, expressions, ctes, windows1, windows2,
  patterns, hierarchy, mutations, analytics, interviewSet,
]).map((m) => ({ ...m, problems: m.problems.map(tag) }));

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
