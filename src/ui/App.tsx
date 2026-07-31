import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, PostgreSQL } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_TOPICS, interviewDraw, MODULES, moduleOf, problemById } from "../content";
import Landing from "./Landing";
import type { Module, Problem } from "../content/types";
import { STAGE_ORDER, STAGES } from "../content/types";
import { runQuery, warm, type QueryResult } from "../engine/engine";
import { explainError } from "../grader/explain";
import { gradeProblem, type GradeOutcome } from "../grader/grader";
import {
  currentStreak, DiffBadge, loadProgress, Markdown, recordSolveDay, ResultTable,
  saveProgress, VerdictBox, type Progress,
} from "./bits";

type Route =
  | { view: "landing" }
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
  if (h === "#/app" || h.startsWith("#/m/")) return { view: "home" };
  return { view: "landing" };
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

  // The landing page owns the full viewport: no app chrome above it.
  if (route.view === "landing") return <Landing />;

  return (
    <>
      <nav className="top">
        <a className="brand" href="#/app">sql<em>gym</em></a>
        {crumb && <span className="crumb">/ {crumb}</span>}
        <span className="right">
          <span className="tagline">real Postgres in your browser · nothing leaves this machine</span>
          <a className="btn" href="#/">Home</a>
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

  // The one thing the dashboard should answer: what do I do next? Find the
  // first unsolved problem and the module it sits in, so the focal card can
  // say where you are rather than just linking somewhere.
  const next = (() => {
    for (const m of MODULES) {
      const i = m.problems.findIndex((p) => progress[p.id] !== "solved");
      if (i !== -1) return { mod: m, problem: m.problems[i], index: i };
    }
    return null;
  })();

  return (
    <>
      {next ? (
        <section className="resume" onClick={() => (location.hash = `#/p/${next.problem.id}`)}>
          <div className="resume-main">
            <span className="resume-kicker">
              {solved ? "Continue" : "Start here"} · {next.mod.title}
            </span>
            <h1>{next.problem.title}</h1>
            <div className="resume-meta">
              <DiffBadge d={next.problem.difficulty} />
              <span>Problem {next.index + 1} of {next.mod.problems.length}</span>
              <span>~{estMinutes(next.problem.difficulty)} min (estimate)</span>
              {next.problem.interview && <span className="tag-int">Appears in interview mode</span>}
            </div>
          </div>
          <div className="resume-go">
            <span className="btn primary">{solved ? "Continue" : "Start"} →</span>
            <a className="resume-alt" href="#/interview" onClick={(e) => e.stopPropagation()}>
              or run a timed interview
            </a>
          </div>
        </section>
      ) : (
        <section className="resume is-done">
          <div className="resume-main">
            <span className="resume-kicker">All clear</span>
            <h1>You have solved all {total} problems.</h1>
            <div className="resume-meta"><span>Timed interview mode is the next challenge.</span></div>
          </div>
          <div className="resume-go"><a className="btn primary" href="#/interview">Interview mode →</a></div>
        </section>
      )}

      <div className="statline">
        <span><b>{solved}</b>/{total} solved</span>
        <span><b>{hard}</b> hard solved</span>
        <span><b>{streak}</b> day streak{streak > 0 ? " 🔥" : ""}</span>
        <a href="#/bank">All problems →</a>
      </div>

      {STAGE_ORDER.map((stage, si) => {
        const mods = MODULES.filter((m) => m.stage === stage);
        if (!mods.length) return null;
        const sSolved = mods.reduce((n, m) => n + m.problems.filter((p) => progress[p.id] === "solved").length, 0);
        const sTotal = mods.reduce((n, m) => n + m.problems.length, 0);
        const complete = sSolved === sTotal;
        const current = mods.some((m) => m.id === next?.mod.id);
        return (
          <section key={stage} className="stage" data-state={complete ? "done" : current ? "current" : "ahead"}>
            <div className="stage-head">
              <span className="stage-n">{String(si + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="stage-t">
                  {STAGES[stage].label}
                  {complete && <span className="stage-badge">mastered</span>}
                  {current && !complete && <span className="stage-badge is-current">you are here</span>}
                </h2>
                <p className="stage-b">{STAGES[stage].blurb}</p>
              </div>
              <div className="stage-p">
                <span className="progress-bar"><i style={{ width: `${(sSolved / sTotal) * 100}%` }} /></span>
                <span className="stage-c">{sSolved}/{sTotal}</span>
              </div>
            </div>
            <div className="modlist">
              {mods.map((m) => {
                const done = m.problems.filter((p) => progress[p.id] === "solved").length;
                const mastered = done === m.problems.length;
                const isNext = m.id === next?.mod.id;
                return (
                  <a className="modrow" data-done={mastered} data-next={isNext}
                     href={`#/m/${m.id}`} key={m.id}>
                    <span className="modrow-mark">{mastered ? "✓" : isNext ? "▸" : ""}</span>
                    <span className="modrow-t">{m.title}</span>
                    <span className="modrow-b">{m.blurb}</span>
                    <span className="modrow-p">
                      <span className="progress-bar"><i style={{ width: `${(done / m.problems.length) * 100}%` }} /></span>
                      <span className="modrow-n">{mastered ? "mastered" : `${done}/${m.problems.length}`}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

/** Rough time-to-solve by difficulty. Always rendered with the word
 *  "estimate" — it is a design guess, not measured from real solves. */
function estMinutes(d: 1 | 2 | 3 | 4) {
  return { 1: 3, 2: 5, 3: 8, 4: 12 }[d];
}

function ModuleView({ id, progress }: { id: string; progress: Progress }) {
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) return <p className="loading">Module not found. <a href="#/app">Home</a></p>;
  const done = mod.problems.filter((p) => progress[p.id] === "solved").length;
  const total = mod.problems.length;
  const next = mod.problems.find((p) => progress[p.id] !== "solved");
  const minutes = mod.problems
    .filter((p) => progress[p.id] !== "solved")
    .reduce((n, p) => n + estMinutes(p.difficulty), 0);
  return (
    <>
      <p className="sub"><a href="#/app">← all modules</a></p>
      <div className="modhead">
        <div>
          <h1>{mod.title}</h1>
          <p className="modhead-blurb">{mod.blurb}</p>
          <div className="modhead-meta">
            <span><b>{done}</b>/{total} solved</span>
            {next && <span>~{minutes} min left (estimate)</span>}
            <span>{mod.problems.filter((p) => p.interview).length} in interview mode</span>
          </div>
          <div className="progress-bar" style={{ maxWidth: 320, marginTop: 10 }}>
            <i style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
        <div className="modhead-go">
          {next
            ? <a className="btn primary" href={`#/p/${next.id}`}>
                {done ? "Continue" : "Start"} →
              </a>
            : <span className="modhead-done">✓ Module mastered</span>}
        </div>
      </div>
      <div className="theory"><Markdown text={mod.theory} /></div>
      <div className="plist">
        {mod.problems.map((p, i) => (
          <div className="prow" data-done={progress[p.id] === "solved"}
               key={p.id} onClick={() => (location.hash = `#/p/${p.id}`)}>
            <span className="solved-mark">{progress[p.id] === "solved" ? "✓" : i + 1}</span>
            <span className="t">{p.title}</span>
            {p.interview && <span className="tag-int">interview</span>}
            <span className="prow-min">~{estMinutes(p.difficulty)} min</span>
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
  problem, onGraded, hideHelp, draftKey, mod,
}: {
  problem: Problem;
  onGraded: (outcome: GradeOutcome) => void;
  hideHelp?: boolean;
  draftKey: string;
  /** Module this problem belongs to, so a correct answer can show where you
   *  are in it and what comes next. Absent in interview mode. */
  mod?: Module;
}) {
  const [code, setCode] = useState(() => sessionStorage.getItem(draftKey) ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [outcome, setOutcome] = useState<GradeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const codeRef = React.useRef(code);
  const runningRef = React.useRef(running);
  const runRef = React.useRef(() => {});
  const submitRef = React.useRef(() => {});
  codeRef.current = code;
  runningRef.current = running;

  useEffect(() => warm(problem.schema), [problem.schema]);
  useEffect(() => sessionStorage.setItem(draftKey, code), [code, draftKey]);

  // Cmd/Ctrl+Enter submits, Cmd/Ctrl+Shift+Enter runs. Same binding as psql
  // clients and every SQL IDE, so it is already in the muscle memory of the
  // people this is for.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      e.preventDefault();
      if (!codeRef.current.trim() || runningRef.current) return;
      (e.shiftKey ? runRef : submitRef).current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

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

  runRef.current = run;
  submitRef.current = submit;

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
            {/* The answer itself now lives next to Submit, so this is just the
                nudge that comes before it. */}
            {!showHint
              ? <button className="btn ghost" onClick={() => setShowHint(true)}>Show hint</button>
              : <p className="prompt" style={{ marginTop: 8 }}>💡 {problem.hint}</p>}
          </div>
        )}
        {!hideHelp && (
          <details className="disc">
            <summary>Target result <span className="disc-note">what a correct query returns</span></summary>
            <ExpectedOutput key={problem.id} problem={problem} />
          </details>
        )}
        <details className="disc">
          <summary>Tables <span className="disc-note">the data you are querying</span></summary>
          <SchemaMini problem={problem} />
        </details>
      </div>
      <div>
        <div className="card editor-card">
          <CodeMirror
            value={code}
            height="380px"
            // Wrap long queries instead of scrolling sideways: SQL is read
            // top-to-bottom and a hidden right-hand edge loses the clause
            // that is usually wrong.
            extensions={[sqlLang({ dialect: PostgreSQL }), EditorView.lineWrapping]}
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
            {/* Learning mode only. Interview mode passes hideHelp and never
                offers the answer — that is the whole point of the rehearsal. */}
            {!hideHelp && !showSolution && (
              <button className="btn ghost" onClick={() => setShowSolution(true)}>
                Show answer
              </button>
            )}
            <span className="spacer" />
            {result && <span className="ms">{result.rows.length} row(s) · {result.elapsedMs}ms</span>}
            <span className="kbd" title="Submit">⌘↵</span>
          </div>
          {!hideHelp && showSolution && (
            <div className="answer">
              <div className="answer-hd">
                <span>Worked answer</span>
                <button className="btn ghost" onClick={() => setShowSolution(false)}>Hide</button>
              </div>
              <pre>{problem.solution}</pre>
              <p className="answer-note">
                Reading it is not the same as writing it. Close this, clear the editor and
                type it out yourself before moving on.
              </p>
            </div>
          )}
        </div>
        {error && <SqlError raw={error} />}
        {outcome && !outcome.error && <VerdictBox verdict={outcome.verdict} />}
        {outcome?.verdict.correct && mod && <SolvedPanel problem={problem} mod={mod} />}
        {result && (
          <div className="yours">
            <span className="yours-label">
              Your result <em>{result.rows.length} row{result.rows.length === 1 ? "" : "s"}</em>
            </span>
            <ResultTable result={result} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Database errors, translated. The raw text stays available because it is what
 * a learner will meet in a real console — this teaches how to read it rather
 * than replacing it.
 */
function SqlError({ raw }: { raw: string }) {
  const ex = explainError(raw);
  if (!ex) return <div className="sql-error"><pre>{raw}</pre></div>;
  return (
    <div className="sql-error">
      <b>{ex.title}</b>
      {ex.hint && <p className="sql-error-hint">{ex.hint}</p>}
      <details className="sql-error-raw">
        <summary>What Postgres said</summary>
        <pre>{raw}</pre>
      </details>
    </div>
  );
}

/**
 * Shown after a correct answer. Solving something used to produce a verdict
 * box and nothing else, so there was no sense of progress and no push onward.
 * This closes the loop: what you just learned, where you are, what is next.
 *
 * Progress is read at render time rather than passed down, because the parent
 * has already persisted this solve by the time the panel mounts.
 */
function SolvedPanel({ problem, mod }: { problem: Problem; mod: Module }) {
  const progress = loadProgress();
  const done = mod.problems.filter((p) => progress[p.id] === "solved").length;
  const total = mod.problems.length;
  const complete = done >= total;
  const next = mod.problems.find((p) => progress[p.id] !== "solved" && p.id !== problem.id);
  const nextModule = MODULES[MODULES.findIndex((m) => m.id === mod.id) + 1];

  return (
    <div className={`solved${complete ? " is-complete" : ""}`}>
      <div className="solved-hd">
        <span className="solved-tick">✓</span>
        <b>{complete ? `${mod.title} mastered` : "Solved"}</b>
        <span className="solved-count">{done}/{total} in this module</span>
      </div>
      <div className="solved-bar"><i style={{ width: `${(done / total) * 100}%` }} /></div>

      {problem.takeaway && (
        <p className="solved-take"><b>Takeaway.</b> {promptWithCode(problem.takeaway)}</p>
      )}

      <div className="solved-next">
        {complete ? (
          <>
            <span>You have solved every problem in this module.</span>
            {nextModule
              ? <a className="btn primary" href={`#/m/${nextModule.id}`}>Next: {nextModule.title} →</a>
              : <a className="btn primary" href="#/interview">Try timed interview mode →</a>}
          </>
        ) : next ? (
          <a className="btn primary" href={`#/p/${next.id}`}>Next problem →</a>
        ) : (
          <a className="btn primary" href={`#/m/${mod.id}`}>Back to {mod.title} →</a>
        )}
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
  if (!problem || !mod) return <p className="loading">Problem not found. <a href="#/app">Home</a></p>;
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
        {problem.interview && <span className="tag-int">interview mode</span>}
        <span className="prow-min">~{estMinutes(problem.difficulty)} min (estimate)</span>
        {(problem.topics ?? []).map((tp) => <span key={tp} className="pill-topic">{tp}</span>)}
      </div>
      <Workspace
        problem={problem}
        mod={mod}
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
            {p.interview && <span className="tag-int">interview</span>}
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
        <p className="sub"><a href="#/app">← home</a></p>
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
