import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, PostgreSQL } from "@codemirror/lang-sql";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_TOPICS, interviewDraw, MODULES, moduleOf, problemById } from "../content";
import type { Problem, Track } from "../content/types";
import { TRACK_LABELS } from "../content/types";
import { runQuery, warm, type QueryResult } from "../engine/engine";
import { gradeProblem, type GradeOutcome } from "../grader/grader";
import {
  currentStreak, DiffBadge, loadProgress, Markdown, recordSolveDay, ResultTable,
  saveProgress, VerdictBox, type Progress,
} from "./bits";

type Route =
  | { view: "home" }
  | { view: "module"; id: string }
  | { view: "problem"; id: string }
  | { view: "bank" }
  | { view: "interview" };

function parseHash(): Route {
  const h = location.hash;
  if (h.startsWith("#/m/")) return { view: "module", id: h.slice(4) };
  if (h.startsWith("#/p/")) return { view: "problem", id: h.slice(4) };
  if (h === "#/interview") return { view: "interview" };
  if (h === "#/bank") return { view: "bank" };
  return { view: "home" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash());
  const [progress, setProgress] = useState<Progress>(loadProgress());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const mark = useCallback((id: string, status: "solved" | "attempted") => {
    if (status === "solved") recordSolveDay();
    setProgress((prev) => {
      if (prev[id] === "solved") return prev;
      const next = { ...prev, [id]: status };
      saveProgress(next);
      return next;
    });
  }, []);

  const crumb =
    route.view === "module" ? MODULES.find((m) => m.id === route.id)?.title :
    route.view === "problem" ? problemById.get(route.id)?.title :
    route.view === "interview" ? "Timed interview" : "";

  return (
    <>
      <nav className="top">
        <a className="brand" href="#/">sql<em>gym</em></a>
        {crumb && <span className="crumb">/ {crumb}</span>}
        <span className="right">
          real Postgres in your browser · nothing leaves this machine
          <a className="btn" href="#/bank">All problems</a>
          <a className="btn" href="#/interview">⏱ Interview mode</a>
        </span>
      </nav>
      <div className="wrap">
        {route.view === "home" && <Home progress={progress} />}
        {route.view === "module" && <ModuleView id={route.id} progress={progress} />}
        {route.view === "problem" && (
          <ProblemView key={route.id} id={route.id} onResult={mark} />
        )}
        {route.view === "bank" && <BankView progress={progress} />}
        {route.view === "interview" && <InterviewView onResult={mark} />}
      </div>
    </>
  );
}

function Home({ progress }: { progress: Progress }) {
  const solved = Object.values(progress).filter((s) => s === "solved").length;
  const total = MODULES.reduce((n, m) => n + m.problems.length, 0);
  const hard = MODULES.flatMap((m) => m.problems)
    .filter((p) => p.difficulty === 4 && progress[p.id] === "solved").length;
  const streak = currentStreak();
  const firstUnsolved = MODULES.flatMap((m) => m.problems).find((p) => progress[p.id] !== "solved");
  return (
    <>
      <section className="hero-banner">
        <div className="hero-copy">
          <h1>Master SQL, from <em>SELECT</em> to senior interviews.</h1>
          <p>
            {MODULES.length} modules · {total} original problems · graded by executing your SQL
            against <strong>real Postgres in your browser</strong> and comparing results —
            including a hidden dataset your query has never seen. No account. Nothing leaves
            your machine.
          </p>
          <div className="hero-ctas">
            {firstUnsolved && (
              <a className="btn primary" href={`#/p/${firstUnsolved.id}`}>
                {solved ? "Continue where you left off" : "Start learning"}
              </a>
            )}
            <a className="btn" href="#/interview">Timed interview mode</a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat"><b>{solved}<small>/{total}</small></b><span>solved</span></div>
          <div className="stat"><b>{hard}</b><span>hard solved</span></div>
          <div className="stat"><b>{streak}{streak > 0 ? " 🔥" : ""}</b><span>day streak</span></div>
        </div>
      </section>
      {(["core", "interview", "advanced"] as Track[]).map((track) => {
        const mods = MODULES.filter((m) => (m.track ?? "core") === track);
        if (!mods.length) return null;
        const tSolved = mods.reduce((n, m) => n + m.problems.filter((p) => progress[p.id] === "solved").length, 0);
        const tTotal = mods.reduce((n, m) => n + m.problems.length, 0);
        return (
          <section key={track} className="track">
            <h2 className="track-h">{TRACK_LABELS[track]}
              <span className="track-count">{tSolved}/{tTotal} solved · {mods.length} modules</span></h2>
            <div className="mods">
              {mods.map((m) => {
                const done = m.problems.filter((p) => progress[p.id] === "solved").length;
                return (
                  <div className="mod-card" key={m.id} onClick={() => (location.hash = `#/m/${m.id}`)}>
                    <h2>{m.title}</h2>
                    <p>{m.blurb}</p>
                    <div className="progress-bar">
                      <i style={{ width: `${(done / m.problems.length) * 100}%` }} />
                    </div>
                    <div className="pct">{done}/{m.problems.length} solved</div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

function ModuleView({ id, progress }: { id: string; progress: Progress }) {
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) return <p className="loading">Module not found. <a href="#/">Home</a></p>;
  return (
    <>
      <h1>{mod.title}</h1>
      <p className="sub"><a href="#/">← all modules</a></p>
      <div className="theory"><Markdown text={mod.theory} /></div>
      <div className="plist">
        {mod.problems.map((p) => (
          <div className="prow" key={p.id} onClick={() => (location.hash = `#/p/${p.id}`)}>
            <span className="solved-mark">{progress[p.id] === "solved" ? "✓" : ""}</span>
            <span className="t">{p.title}</span>
            <DiffBadge d={p.difficulty} />
          </div>
        ))}
      </div>
    </>
  );
}

interface TablePreview { name: string; sample: QueryResult; }

/** Clean schema browser: each table shown as a card with its columns as the
 *  header and 3 real sample rows — always visible, the way DataLemur /
 *  StrataScratch show the data you're querying. No raw type dumps. */
function SchemaMini({ problem }: { problem: Problem }) {
  const [tables, setTables] = useState<TablePreview[] | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const names = (await runQuery(problem.schema, "visible",
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' ORDER BY table_name`)).rows.map((r) => String(r[0]));
      const previews = await Promise.all(names.map(async (name) => ({
        name, sample: await runQuery(problem.schema, "visible", `SELECT * FROM ${name} LIMIT 3`),
      })));
      if (live) setTables(previews);
    })().catch(() => setTables([]));
    return () => { live = false; };
  }, [problem.schema]);

  if (!tables) return null;
  return (
    <div className="schema-mini">
      <h3>Tables — the data you're querying</h3>
      {tables.map((t) => (
        <div className="tbl-card" key={t.name}>
          <div className="tbl-name">{t.name}</div>
          <ResultTable result={t.sample} />
        </div>
      ))}
    </div>
  );
}

/** "What am I aiming for?" — the canonical solution's output, shown ALWAYS
 *  so the learner writes toward a visible target. Safe: copying these literal
 *  rows still fails the hidden dataset at grading time. */
function ExpectedOutput({ problem }: { problem: Problem }) {
  const [expected, setExpected] = useState<QueryResult | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { execute } = await import("../grader/grader");
      const result = await execute(problem, "visible", problem.solution);
      if (live) setExpected({ ...result, rows: result.rows.slice(0, 10) });
    })().catch(() => setExpected(null));
    return () => { live = false; };
  }, [problem]);
  return (
    <div className="expected">
      <h3>🎯 Target result{problem.kind === "dml" ? " (state after your change)" : ""}
        {expected && expected.rows.length === 10 ? " · first 10 rows" : ""}</h3>
      {expected ? <ResultTable result={expected} /> : <p className="loading">loading target…</p>}
    </div>
  );
}

function Workspace({
  problem, onGraded, hideHelp, draftKey,
}: {
  problem: Problem;
  onGraded: (outcome: GradeOutcome) => void;
  hideHelp?: boolean;
  draftKey: string;
}) {
  const [code, setCode] = useState(() => sessionStorage.getItem(draftKey) ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [outcome, setOutcome] = useState<GradeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => warm(problem.schema), [problem.schema]);
  useEffect(() => sessionStorage.setItem(draftKey, code), [code, draftKey]);

  const run = async () => {
    setRunning(true); setOutcome(null); setError(null);
    try {
      setResult(await runQuery(problem.schema, "visible", code));
    } catch (err) {
      setResult(null); setError(err instanceof Error ? err.message : String(err));
    } finally { setRunning(false); }
  };

  const submit = async () => {
    setRunning(true); setError(null);
    try {
      const graded = await gradeProblem(problem, code);
      setOutcome(graded);
      setResult(graded.error ? null : graded.visible);
      setError(graded.error ?? null);
      onGraded(graded);
    } finally { setRunning(false); }
  };

  return (
    <div className="work">
      <div className="card">
        <h3>Problem <DiffBadge d={problem.difficulty} /></h3>
        <div className="prompt">{promptWithCode(problem.prompt)}</div>
        {problem.kind === "dml" && (
          <p className="dml-note">✎ Your statements run on a fresh copy of the database.
          Grading verifies the resulting state — here and on a hidden copy.</p>
        )}
        {!hideHelp && (
          <div className="reveal">
            {!showHint
              ? <button className="btn ghost" onClick={() => setShowHint(true)}>Show hint</button>
              : <p className="prompt" style={{ marginTop: 8 }}>💡 {problem.hint}</p>}
            {showHint && !showSolution && (
              <button className="btn ghost" onClick={() => setShowSolution(true)}>
                Reveal solution
              </button>
            )}
            {showSolution && <pre>{problem.solution}</pre>}
          </div>
        )}
        {!hideHelp && <ExpectedOutput key={problem.id} problem={problem} />}
        <SchemaMini problem={problem} />
      </div>
      <div>
        <div className="card editor-card">
          <CodeMirror
            value={code}
            height="260px"
            extensions={[sqlLang({ dialect: PostgreSQL })]}
            onChange={setCode}
            placeholder={"-- Write your query here, then Run to explore or Submit to grade"}
            basicSetup={{ autocompletion: true }}
          />
          <div className="editor-bar">
            <button className="btn" onClick={run} disabled={running || !code.trim()}>
              Run
            </button>
            <button className="btn primary" onClick={submit} disabled={running || !code.trim()}>
              {running ? "…" : "Submit"}
            </button>
            <span className="spacer" />
            {result && <span className="ms">{result.rows.length} row(s) · {result.elapsedMs}ms</span>}
          </div>
        </div>
        {error && <div className="sql-error">{error}</div>}
        {outcome && !outcome.error && <VerdictBox verdict={outcome.verdict} />}
        {result && <ResultTable result={result} />}
      </div>
    </div>
  );
}

function promptWithCode(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`")
      ? <code key={i}>{part.slice(1, -1)}</code>
      : <React.Fragment key={i}>{part}</React.Fragment>,
  );
}

function ProblemView({
  id, onResult,
}: { id: string; onResult: (id: string, s: "solved" | "attempted") => void }) {
  const problem = problemById.get(id);
  const mod = moduleOf(id);
  if (!problem || !mod) return <p className="loading">Problem not found. <a href="#/">Home</a></p>;
  const idx = mod.problems.findIndex((p) => p.id === id);
  const next = mod.problems[idx + 1];
  return (
    <>
      <h1>{problem.title} <DiffBadge d={problem.difficulty} /></h1>
      <p className="sub">
        Part of <a href={`#/m/${mod.id}`}>{mod.title}</a> — {mod.blurb}{" "}
        <a href={`#/m/${mod.id}`}>(review the theory)</a>
        {next && <> · <a href={`#/p/${next.id}`}>next problem →</a></>}
      </p>
      <div className="tag-row">
        {problem.company && <span className="pill-co">{problem.company}</span>}
        {(problem.topics ?? []).map((tp) => <span key={tp} className="pill-topic">{tp}</span>)}
      </div>
      <Workspace
        problem={problem}
        draftKey={`draft-${id}`}
        onGraded={(o) => onResult(id, o.verdict.correct ? "solved" : "attempted")}
      />
    </>
  );
}

function BankView({ progress }: { progress: Progress }) {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [difficulty, setDifficulty] = useState(0);
  const [status, setStatus] = useState("all");
  const [topic, setTopic] = useState("all");
  const rows = MODULES.flatMap((m) => m.problems.map((p) => ({ p, m })));
  const filtered = rows.filter(({ p, m }) =>
    (moduleFilter === "all" || m.id === moduleFilter) &&
    (difficulty === 0 || p.difficulty === difficulty) &&
    (topic === "all" || (p.topics ?? []).includes(topic)) &&
    (status === "all" ||
      (status === "solved" ? progress[p.id] === "solved" : progress[p.id] !== "solved")),
  );
  return (
    <>
      <h1>All problems</h1>
      <p className="sub">{filtered.length} of {rows.length} shown — every problem is graded
        against real Postgres plus a hidden dataset.</p>
      <div className="bank-filters">
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="all">All modules</option>
          {MODULES.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
          <option value={0}>Any difficulty</option>
          <option value={1}>intro</option><option value={2}>easy</option>
          <option value={3}>medium</option><option value={4}>hard</option>
        </select>
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">Any topic</option>
          {ALL_TOPICS.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Solved + unsolved</option>
          <option value="unsolved">Unsolved only</option>
          <option value="solved">Solved only</option>
        </select>
      </div>
      <div className="plist">
        {filtered.map(({ p, m }) => (
          <div className="prow" key={p.id} onClick={() => (location.hash = `#/p/${p.id}`)}>
            <span className="solved-mark">{progress[p.id] === "solved" ? "✓" : ""}</span>
            <span className="t">{p.title}</span>
            {p.company && <span className="pill-co">{p.company}</span>}
            <span className="pill-mod">{m.title}</span>
            <DiffBadge d={p.difficulty} />
          </div>
        ))}
      </div>
    </>
  );
}

const INTERVIEW_SECONDS = 40 * 60;

function InterviewView({
  onResult,
}: { onResult: (id: string, s: "solved" | "attempted") => void }) {
  const problems = useMemo(() => interviewDraw(5), []);
  const [started, setStarted] = useState(false);
  const [cur, setCur] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(INTERVIEW_SECONDS);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!started || finished) return;
    const t = setInterval(() => setSecondsLeft((s) => {
      if (s <= 1) { setFinished(true); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [started, finished]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (!started) {
    return (
      <>
        <h1>Timed interview mode</h1>
        <p className="sub">
          5 problems · 40 minutes · no hints, no solutions — the honest rehearsal.
          Today's draw is fixed; come back tomorrow for a new set.
        </p>
        <div className="card" style={{ maxWidth: 640 }}>
          <p className="prompt">
            You'll get a mix of difficulties drawn from the interview-eligible pool.
            Submit grades instantly (including the hidden-dataset check). You can move
            between problems freely. The timer starts when you click begin.
          </p>
          <div style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => setStarted(true)}>Begin</button>
          </div>
        </div>
      </>
    );
  }

  if (finished) {
    return (
      <>
        <h1>Interview summary</h1>
        <p className="sub"><a href="#/">← home</a></p>
        <div className="summary-grid">
          <div className="cell"><b>{solvedIds.size}/5</b><span>solved</span></div>
          <div className="cell"><b>{mm}:{ss}</b><span>time left</span></div>
          <div className="cell">
            <b>{solvedIds.size >= 4 ? "strong" : solvedIds.size >= 3 ? "borderline" : "keep drilling"}</b>
            <span>read</span>
          </div>
        </div>
        <div className="plist">
          {problems.map((p) => (
            <div className="prow" key={p.id} onClick={() => (location.hash = `#/p/${p.id}`)}>
              <span className="solved-mark">{solvedIds.has(p.id) ? "✓" : "✗"}</span>
              <span className="t">{p.title}</span>
              <DiffBadge d={p.difficulty} />
            </div>
          ))}
        </div>
      </>
    );
  }

  const problem = problems[cur];
  return (
    <>
      <h1 style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span>Problem {cur + 1} of {problems.length}: {problem.title}</span>
        <span className={`timer ${secondsLeft < 300 ? "low" : ""}`}>{mm}:{ss}</span>
      </h1>
      <div className="iv-nav">
        {problems.map((p, i) => (
          <button
            key={p.id}
            className={i === cur ? "cur" : solvedIds.has(p.id) ? "done" : ""}
            onClick={() => setCur(i)}
          >{i + 1}</button>
        ))}
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" onClick={() => setFinished(true)}>Finish early</button>
      </div>
      <Workspace
        key={problem.id}
        problem={problem}
        hideHelp
        draftKey={`iv-${problem.id}`}
        onGraded={(o) => {
          onResult(problem.id, o.verdict.correct ? "solved" : "attempted");
          if (o.verdict.correct) setSolvedIds((s) => new Set(s).add(problem.id));
        }}
      />
    </>
  );
}
