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
  if (para.startsWith("## ")) return <h2 key={key}>{para.slice(3)}</h2>;
  const lines = para.split("\n");
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul key={key}>
        {lines.map((l, i) => <li key={i}>{inline(l.slice(2))}</li>)}
      </ul>
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

export function VerdictBox({ verdict }: { verdict: Verdict }) {
  if (verdict.correct) {
    return <div className="verdict ok">✓ {verdict.message}</div>;
  }
  return (
    <div className="verdict no">
      <b>✗ Not yet.</b> {verdict.message}
      {verdict.missingSample.length > 0 && (
        <div className="samples">
          Missing rows (sample):
          <table><tbody>
            {verdict.missingSample.map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody></table>
        </div>
      )}
      {verdict.extraSample.length > 0 && (
        <div className="samples">
          Unexpected rows (sample):
          <table><tbody>
            {verdict.extraSample.map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody></table>
        </div>
      )}
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
