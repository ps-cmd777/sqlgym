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
  /** On the Core Path: the ~40 problems that take someone from nothing to
   *  interview-capable. Assigned in content/index.ts. Everything else is
   *  optional depth, reachable per stage or through Explore. */
  core?: boolean;
  /** One sentence shown after a correct answer: the idea worth keeping, or the
   *  mistake most people make here. Optional — written where the concept
   *  genuinely trips people up, omitted where it would be filler. Supports
   *  `backticks` for inline code. */
  takeaway?: string;
  /** "query" (default): compare SELECT results. "dml": the learner writes
   *  INSERT/UPDATE/DELETE against a fresh database copy; grading compares
   *  the result of `checkSql` after their statements vs after the
   *  canonical solution. */
  kind?: "query" | "dml";
  /** For kind "dml": the verification SELECT run after the mutation. */
  checkSql?: string;
  /** Auto-derived at load time from the solution SQL — do not hand-set. */
  topics?: string[];
}

export type Track = "core" | "interview" | "advanced";

/**
 * Curriculum stage. Tracks are a taxonomy ("what kind of thing is this");
 * stages are a sequence ("where am I on the path"). The dashboard used to
 * group by track, which shattered the authoring order — finishing module 10
 * sent you to a module displayed four rows lower under a different heading.
 * Stages are contiguous in MODULES order, so what the roadmap shows and what
 * "Continue" walks are guaranteed to be the same path.
 */
export type Stage = "foundations" | "core" | "intermediate" | "advanced" | "interview";

export const STAGE_ORDER: Stage[] = [
  "foundations", "core", "intermediate", "advanced", "interview",
];

export const STAGES: Record<Stage, { label: string; blurb: string }> = {
  foundations: {
    label: "Foundations",
    blurb: "Reading data out of one table, and counting it.",
  },
  core: {
    label: "Core SQL",
    blurb: "Missing values, more than one table, and queries inside queries.",
  },
  intermediate: {
    label: "Intermediate",
    blurb: "Naming intermediate results, and looking across rows without collapsing them.",
  },
  advanced: {
    label: "Advanced",
    blurb: "Time, hierarchy, reshaping and statistics — the work analysts actually ship.",
  },
  interview: {
    label: "Interview ready",
    blurb: "Mixed, hard, and under a clock.",
  },
};

export interface Module {
  id: string;
  title: string;
  blurb: string;
  /** Learning track this module belongs to. Kept for filtering. */
  track?: Track;
  /** Position on the curriculum path. Assigned in content/index.ts so the
   *  sequence lives in one place and cannot drift from the array order. */
  stage?: Stage;
  /** Markdown-lite: ## headings, **bold**, `inline`, ```sql blocks, - lists */
  theory: string;
  problems: Problem[];
}

export const TRACK_LABELS: Record<Track, string> = {
  core: "Core SQL",
  interview: "Interview essentials",
  advanced: "Advanced",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "intro",
  2: "easy",
  3: "medium",
  4: "hard",
};
