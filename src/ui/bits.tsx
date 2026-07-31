/** Small shared UI pieces: markdown-lite renderer, result table, verdict. */

import React from "react";
import type { QueryResult } from "../engine/engine";
import type { Verdict } from "../grader/grader";
import { DIFFICULTY_LABELS, type Difficulty } from "../content/types";

/** Renders the theory markdown-lite dialect: ## h2, ```blocks, **bold**,
 *  `inline`, - lists, paragraphs. No HTML passthrough. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```(?:sql)?\n?/);
  return (
    <>
      {blocks.map((block, i) =>
        i % 2 === 1 ? (
          <pre key={i}><code>{block.trimEnd()}</code></pre>
        ) : (
          block.split(/\n{2,}/).map((para, j) => renderPara(para.trim(), `${i}-${j}`))
        ),
      )}
    </>
  );
}

function renderPara(para: string, key: string): React.ReactNode {
  if (!para) return null;
  if (para.startsWith("## ")) {
    const newline = para.indexOf("\n");
    if (newline === -1) return <h2 key={key}>{para.slice(3)}</h2>;
    // heading followed directly by text: split them
    return (
      <React.Fragment key={key}>
        <h2>{para.slice(3, newline)}</h2>
        {renderPara(para.slice(newline + 1).trim(), key + "-body")}
      </React.Fragment>
    );
  }
  const lines = para.split("\n");
  if (lines.every((l) => l.startsWith("- "))) {
    return <ul key={key}>{lines.map((l, i) => <li key={i}>{inline(l.slice(2))}</li>)}</ul>;
  }
  if (lines.every((l) => /^\d+\.\s/.test(l))) {
    return (
      <ol key={key}>
        {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+\.\s/, ""))}</li>)}
      </ol>
    );
  }
  return <p key={key}>{inline(para)}</p>;
}

export function inline(text: string): React.ReactNode[] {
  // split on `code` and **bold**
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function DiffBadge({ d }: { d: Difficulty }) {
  return <span className={`diff d${d}`}>{DIFFICULTY_LABELS[d]}</span>;
}

function displayCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "NULL";
  if (cell instanceof Date) {
    // DATE columns come back as JS Dates at UTC midnight — show the day.
    const iso = cell.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace(".000Z", "Z");
  }
  return String(cell);
}

export function ResultTable({ result }: { result: QueryResult }) {
  if (!result.columns.length) return null;
  return (
    <div className="rtable">
      <table>
        <thead>
          <tr>{result.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{displayCell(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The failure state, which is where the learning actually happens. This used
 * to be an unstyled dump of sample rows with no column headers, so a learner
 * had to guess which value belonged to which column.
 *
 * Now it leads with the diagnosis, states the two counts side by side, and
 * labels the sample tables. Ordering and column-count mismatches get their own
 * treatment because they are different mistakes with different fixes.
 */
export function VerdictBox({ verdict }: { verdict: Verdict }) {
  if (verdict.correct) {
    return <div className="verdict ok">✓ {verdict.message}</div>;
  }

  const headline =
    verdict.hiddenFailed ? "Passed the visible data, failed the hidden data"
    : verdict.kind === "columns" ? "The columns do not match"
    : verdict.kind === "order"   ? "Right rows, wrong order"
    : "The rows do not match";

  const fix =
    verdict.hiddenFailed ? "Something in the query is hardcoded to the data you can see. It has to compute the answer instead."
    : verdict.kind === "columns" ? "Select exactly the columns the problem asks for, in that order, with those names."
    : verdict.kind === "order"   ? "The values are all correct. Add or correct the ORDER BY."
    : null;

  return (
    <div className="verdict no">
      <b>{headline}</b>
      {fix && <p className="verdict-fix">{fix}</p>}

      {verdict.kind === "rows" &&
        verdict.expectedCount !== undefined && verdict.actualCount !== undefined && (
        <div className="verdict-counts">
          <span><i>{verdict.actualCount}</i> returned</span>
          <span><i>{verdict.expectedCount}</i> expected</span>
        </div>
      )}

      {verdict.kind === "columns" && <p className="verdict-detail">{verdict.message}</p>}

      <SampleTable
        label="Expected, but missing from your result"
        rows={verdict.missingSample}
        total={verdict.missingTotal}
        columns={verdict.columns}
      />
      <SampleTable
        label="In your result, but not expected"
        rows={verdict.extraSample}
        total={verdict.extraTotal}
        columns={verdict.columns}
      />
    </div>
  );
}

function SampleTable({ label, rows, columns, total }: {
  label: string; rows: string[][]; columns?: string[]; total?: number;
}) {
  if (!rows.length) return null;
  const truncated = total !== undefined && total > rows.length;
  return (
    <div className="samples">
      <span className="samples-label">
        {label}
        {truncated && <em> · showing {rows.length} of {total}</em>}
      </span>
      <div className="rtable">
        <table>
          {columns && (
            <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          )}
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** localStorage progress */
const KEY = "sqlgym-progress-v1";
const DAYS_KEY = "sqlgym-solve-days-v1";
export type Progress = Record<string, "solved" | "attempted">;
export const loadProgress = (): Progress => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
};
export const saveProgress = (p: Progress) => localStorage.setItem(KEY, JSON.stringify(p));

/** Solve days, for the streak and for export. */
export const loadDays = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DAYS_KEY) ?? "[]"); } catch { return []; }
};

/**
 * Merge restored progress into what is already here rather than replacing it.
 * Someone restoring on a machine where they have also been practising should
 * never lose the newer work, so solved wins over unsolved and days union.
 */
export function mergeProgress(solved: string[], days: string[]): Progress {
  const current = loadProgress();
  const merged: Progress = { ...current };
  for (const id of solved) merged[id] = "solved";
  saveProgress(merged);

  const allDays = [...new Set([...loadDays(), ...days])].sort();
  localStorage.setItem(DAYS_KEY, JSON.stringify(allDays.slice(-365)));
  return merged;
}

/** Solve-day tracking for the streak indicator. Dates only, local time. */
export function recordSolveDay(): void {
  const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD
  const days: string[] = JSON.parse(localStorage.getItem(DAYS_KEY) ?? "[]");
  if (!days.includes(today)) {
    days.push(today);
    localStorage.setItem(DAYS_KEY, JSON.stringify(days.slice(-365)));
  }
}

/** Consecutive practice days ending today or yesterday. */
export function currentStreak(): number {
  const days = new Set<string>(JSON.parse(localStorage.getItem(DAYS_KEY) ?? "[]"));
  const cursor = new Date();
  const dayStr = (d: Date) => d.toLocaleDateString("sv");
  if (!days.has(dayStr(cursor))) cursor.setDate(cursor.getDate() - 1); // yesterday keeps a streak alive
  let streak = 0;
  while (days.has(dayStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
