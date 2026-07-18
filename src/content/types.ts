import type { SchemaName } from "../data/datasets";

/** 1 = intro · 2 = easy · 3 = medium · 4 = hard (interview level) */
export type Difficulty = 1 | 2 | 3 | 4;

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  schema: SchemaName;
  /** The task, written like an interviewer would ask it. Be precise about
   *  ties, rounding, filters, and expected columns. */
  prompt: string;
  hint: string;
  /** Canonical solution — executed by the grader and validated in CI
   *  against both dataset variants. Never shown until revealed. */
  solution: string;
  /** Result must match in order (problem demands ORDER BY). */
  orderSensitive?: boolean;
  /** Eligible for timed interview mode. */
  interview?: boolean;
  /** "query" (default): compare SELECT results. "dml": the learner writes
   *  INSERT/UPDATE/DELETE against a fresh database copy; grading compares
   *  the result of `checkSql` after their statements vs after the
   *  canonical solution. */
  kind?: "query" | "dml";
  /** For kind "dml": the verification SELECT run after the mutation. */
  checkSql?: string;
}

export interface Module {
  id: string;
  title: string;
  blurb: string;
  /** Markdown-lite: ## headings, **bold**, `inline`, ```sql blocks, - lists */
  theory: string;
  problems: Problem[];
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "intro",
  2: "easy",
  3: "medium",
  4: "hard",
};
