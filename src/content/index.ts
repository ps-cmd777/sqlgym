import { warmups } from "./module-warmups";
import { analytics, interviewSet, patterns } from "./modules-advanced";
import { foundations, joins, subqueries } from "./modules-core";
import { expressions, hierarchy, mutations } from "./modules-extended";
import { ctes, windows1, windows2 } from "./modules-windows";
import type { Module, Problem } from "./types";
import { withVariants } from "./variants";

export const MODULES: Module[] = withVariants([
  warmups, foundations, joins, subqueries, expressions, ctes, windows1, windows2,
  patterns, hierarchy, mutations, analytics, interviewSet,
]);

export const ALL_PROBLEMS: Problem[] = MODULES.flatMap((m) => m.problems);

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
