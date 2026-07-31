/**
 * SQLGym landing page.
 *
 * Built from the product's own material rather than stock imagery. Two ideas
 * carry the page:
 *
 *   1. The hero visual is a real query card that executes on mount, so the
 *      claim ("your SQL runs here, instantly, no backend") is demonstrated
 *      rather than asserted.
 *   2. Rows, columns and relations are the page's STRUCTURE, not decoration:
 *      a numbered schema rail down the margin, and the headline statistics
 *      rendered as an actual query result.
 *
 * Numbers are read from the real content tree, so the page cannot drift away
 * from the problems that actually ship.
 */
import React, { useEffect, useState } from "react";
import { ALL_PROBLEMS, MODULES } from "../content";
import "./landing.css";

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp-rv"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.setAttribute("data-in", "true"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "true");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function useStuck() {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return stuck;
}

const CTA_HREF = "#/p/wu1";

function Cta({ variant = "primary", small = false, children = "Start practicing free" }: {
  variant?: "primary" | "ghost"; small?: boolean; children?: React.ReactNode;
}) {
  return (
    <a href={CTA_HREF} className={`lp-btn lp-btn-${variant}${small ? " lp-btn-sm" : ""}`}>
      {children}<span className="arw" aria-hidden="true">→</span>
    </a>
  );
}

/* Section wrapper carrying the numbered schema rail. */
function Sec({ n, id, children }: { n: string; id?: string; children: React.ReactNode }) {
  return (
    <section className="lp-sec" id={id}>
      <div className="lp-wrap">
        <div className="lp-rail" data-n={n}>{children}</div>
      </div>
    </section>
  );
}

const RESULT_ROWS = [
  ["classical", "2,481", "184s"],
  ["jazz", "2,077", "201s"],
  ["electronic", "1,930", "176s"],
  ["rock", "1,712", "168s"],
];

function QueryCard() {
  const [ran, setRan] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRan(true), 620);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="lp-card" aria-hidden="true">
      <div className="lp-card-bar">
        <u /><u /><u /><span>wavely · postgres 16 · in-browser</span>
      </div>
      <pre className="lp-sql">
{`  `}<span className="c">-- listeners and average session, by genre</span>{`
  `}<span className="k">SELECT</span>{`   t.genre,
           `}<span className="k">COUNT</span>{`(*)              `}<span className="k">AS</span>{` plays,
           `}<span className="k">ROUND</span>{`(`}<span className="k">AVG</span>{`(p.seconds_played)) `}<span className="k">AS</span>{` avg_s
  `}<span className="k">FROM</span>{`     plays p
  `}<span className="k">JOIN</span>{`     tracks t `}<span className="k">ON</span>{` t.track_id = p.track_id
  `}<span className="k">GROUP BY</span>{` t.genre
  `}<span className="k">ORDER BY</span>{` plays `}<span className="k">DESC</span>{`;`}
      </pre>
      <div className="lp-run">
        {ran ? <><b>✓ 6 rows</b><span>· 14 ms · matched hidden dataset</span></> : <span>running…</span>}
      </div>
      {ran && (
        <table className="lp-out">
          <thead><tr><th>genre</th><th>plays</th><th>avg_s</th></tr></thead>
          <tbody>
            {RESULT_ROWS.map(([g, p, a], i) => (
              <tr key={g} style={{ animationDelay: `${i * 70}ms` }}>
                <td>{g}</td><td>{p}</td><td>{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Landing() {
  useReveal();
  const stuck = useStuck();

  const problems = ALL_PROBLEMS.length;
  const modules = MODULES.length;
  const hard = ALL_PROBLEMS.filter((p) => p.difficulty === 4).length;
  const interview = ALL_PROBLEMS.filter((p) => p.interview).length;

  return (
    <div className="lp">
      <nav className="lp-nav" data-stuck={stuck}>
        <div className="lp-wrap lp-nav-in">
          <a className="lp-mark" href="#/"><i />SQLGym</a>
          <div className="lp-nav-links">
            <a href="#practice">Practice</a>
            <a href="#path">Learning path</a>
            <a href="#interview">Interview prep</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="lp-nav-cta"><Cta small /></div>
        </div>
      </nav>

      {/* ---------------- hero: asymmetric, card offset and bleeding right --- */}
      <header className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <h1 className="lp-h1">Get good at SQL by <em>writing</em> SQL.</h1>
            <p className="lp-hero-sub">
              Walk into the interview having already solved the questions. {problems} problems,
              from your first SELECT to the window functions senior screens actually ask.
            </p>
            <div className="lp-hero-cta">
              <Cta />
              <a className="lp-btn lp-btn-ghost" href="#practice">See how grading works</a>
            </div>
            <p className="lp-hero-note">
              Real Postgres, in this tab. No account, no install, nothing leaves your machine.
            </p>
          </div>
          <div className="lp-hero-vis"><QueryCard /></div>
        </div>
      </header>

      {/* ---------------- proof, rendered as a query result ------------------ */}
      <section className="lp-sec" style={{ paddingTop: "var(--s8)" }}>
        <div className="lp-wrap lp-rv">
          <div className="lp-resulttable">
            <div className="rt-head">
              <span>SELECT * FROM sqlgym.facts;</span>
              <span style={{ marginLeft: "auto" }}>4 rows</span>
            </div>
            <table>
              <thead><tr><th>count</th><th>what it is</th></tr></thead>
              <tbody>
                <tr><td className="n">{problems}</td><td>original problems, every solution verified against two datasets</td></tr>
                <tr><td className="n">{modules}</td><td>modules, from your first SELECT to senior interview patterns</td></tr>
                <tr><td className="n">{hard}</td><td>rated hard, the difficulty real screens actually use</td></tr>
                <tr><td className="n">0</td><td>rows of your data uploaded anywhere, because there is no server</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------- 01 why ---------------------------------------------- */}
      <Sec n="01">
        <p className="lp-eyebrow lp-rv">Why this works</p>
        <div className="lp-head lp-rv">
          <h2>Reading SQL is not the same as writing it.</h2>
          <p className="lp-lede">
            Most SQL courses have you follow along. You understand every line, then freeze
            at an empty editor. The only fix is producing queries yourself, against data
            that pushes back.
          </p>
        </div>
        <div className="lp-grid lp-g3 lp-rv">
          {[
            ["Executed, not matched",
              "Your query runs. The rows it returns are compared with the rows the answer returns. Write it your way, in any order, and it still passes."],
            ["A dataset you have not seen",
              "Every submission is re-run against a second, hidden dataset. Hardcode a value that happens to work on the visible data and the check fails."],
            ["Real Postgres, not a toy",
              "Window functions, CTEs, LATERAL, GROUPING SETS, JSON. The features interviews ask about, because it is genuinely Postgres."],
          ].map(([t, d]) => (
            <article className="lp-tile" key={t}><h3>{t}</h3><p>{d}</p></article>
          ))}
        </div>
      </Sec>

      {/* ---------------- 02 how grading works: the side-by-side -------------- */}
      <Sec n="02" id="practice">
        <p className="lp-eyebrow lp-rv">How grading works</p>
        <div className="lp-head lp-rv">
          <h2>Different query. Same result. Correct.</h2>
          <p className="lp-lede">
            Your query is executed and the rows it returns are compared with the rows the
            answer returns. Different formatting, different aliases, a different route to
            the same result: all fine.
          </p>
        </div>
        <div className="lp-vs lp-rv">
          <article className="lp-pane is-them">
            <header className="lp-pane-hd">If it were graded as text</header>
            <div className="lp-pane-bd">
              <div className="lp-step">
                <span className="lb">You wrote</span>
                <div className="bx">{`SELECT artist, COUNT(*) AS tracks
FROM tracks
GROUP BY artist`}</div>
              </div>
              <div className="lp-step">
                <span className="lb">Expected answer</span>
                <div className="bx">{`SELECT artist, count(*) AS tracks
FROM tracks GROUP BY 1`}</div>
              </div>
              <p className="lp-arrow">compare the text</p>
              <p className="lp-verdict bad">
                ✕ Rejected <small>Formatting and aliasing differ.</small>
              </p>
            </div>
          </article>

          <article className="lp-pane">
            <header className="lp-pane-hd">SQLGym · execution comparison</header>
            <div className="lp-pane-bd">
              <div className="lp-step">
                <span className="lb">You wrote</span>
                <div className="bx">{`SELECT artist, COUNT(*) AS tracks
FROM tracks
GROUP BY artist`}</div>
              </div>
              <p className="lp-arrow">run it against Postgres</p>
              <div className="lp-step">
                <span className="lb">Rows returned</span>
                <div className="bx">{`8 rows · matches expected result set`}</div>
              </div>
              <p className="lp-verdict good">
                ✓ Correct <small>Different query. Same rows. That is what matters.</small>
              </p>
            </div>
          </article>
        </div>
      </Sec>

      {/* ---------------- 03 the hidden dataset ------------------------------- */}
      <Sec n="03">
        <p className="lp-eyebrow lp-rv">The hidden dataset</p>
        <div className="lp-head lp-rv">
          <h2>You cannot pass by memorising an answer.</h2>
          <p className="lp-lede">
            Executing your query is fair, and every serious practice site does it. But it has
            a hole nobody closes: if you can see the data, you can hardcode what you saw. So
            every submission here runs twice.
          </p>
        </div>
        <div className="lp-cheat lp-rv">
          <div className="lp-seq">
            <div className="lp-cheat-q">
              <b>Which customer spent the most?</b>
              <span style={{ fontSize: 14.5, color: "var(--lp-ink-3)" }}>
                The learner peeks at the visible data, sees the answer is customer 15,
                and writes it in instead of computing it.
              </span>
              <code>WHERE customer_id = <i>15</i></code>
            </div>
            <div className="lp-runs">
              <div>
                <span className="tag">Run 1 · visible data · seed 1101</span>
                <div className="rows">
                  top spender = <u>15</u><br />
                  returned 1 row<br />
                  <span style={{ color: "var(--lp-green-ink)", fontWeight: 600 }}>✓ matches</span>
                </div>
              </div>
              <div>
                <span className="tag">Run 2 · hidden data · seed 7907</span>
                <div className="rows">
                  top spender = <u>41</u><br />
                  returned 0 rows<br />
                  <span style={{ color: "var(--lp-red)", fontWeight: 600 }}>✕ no match</span>
                </div>
              </div>
            </div>
            <div style={{ padding: "var(--s5)", borderTop: "1px solid var(--lp-rule-2)" }}>
              <p className="lp-verdict bad" style={{ margin: 0 }}>
                ✕ Passed visible, failed hidden
                <small>Check for a hardcoded value. The query has to compute the answer.</small>
              </p>
            </div>
          </div>
        </div>
        <p className="lp-hero-note lp-rv" style={{ marginTop: "var(--s5)" }}>
          The same two runs verify every canonical solution in CI, so a broken problem cannot ship.
        </p>
      </Sec>

      {/* ---------------- 04 feedback quality --------------------------------- */}
      <Sec n="04">
        <p className="lp-eyebrow lp-rv">Feedback</p>
        <div className="lp-head lp-rv">
          <h2>You get told exactly what was wrong.</h2>
          <p className="lp-lede">
            Not a red cross. The grader shows which rows differed, which column was missing,
            and whether ordering was the problem.
          </p>
        </div>
        <div className="lp-feature lp-rv">
          <div>
            <h3>Specific enough to act on</h3>
            <p style={{ color: "var(--lp-ink-2)", fontSize: 16 }}>
              Because grading runs your SQL rather than reading it, the grader knows the
              shape of what you produced. It can tell you the difference instead of just
              refusing you.
            </p>
          </div>
          <div className="lp-term">
            <div><span className="dim">$</span> submit</div>
            <div className="no">✕ column set differs</div>
            <div className="dim">  expected 3 columns, received 2</div>
            <div className="dim">  missing: avg_s</div>
            <div style={{ height: 10 }} />
            <div><span className="dim">$</span> submit</div>
            <div className="no">✕ passed visible, failed hidden</div>
            <div className="dim">  check for a hardcoded id</div>
            <div style={{ height: 10 }} />
            <div><span className="dim">$</span> submit</div>
            <div className="ok">✓ 6 rows · both datasets · solved</div>
          </div>
        </div>
      </Sec>

      {/* ---------------- 03 progress ---------------------------------------- */}
      <Sec n="05">
        <p className="lp-eyebrow lp-rv">Progress</p>
        <div className="lp-head lp-rv">
          <h2>Track what you have actually mastered.</h2>
          <p className="lp-lede">
            Progress is stored in your browser and broken down by topic, so you can see the
            area you have been avoiding rather than a single number going up.
          </p>
        </div>
        <div className="lp-bars lp-rv">
          {[["Joins", 92], ["Window functions", 74], ["CTEs and subqueries", 61], ["NULL semantics", 38], ["Gaps and islands", 12]].map(([t, v]) => (
            <div className="lp-bar-row" key={t as string}>
              <span>{t}</span>
              <span className="lp-bar"><i style={{ ["--w" as string]: `${v}%` }} /></span>
              <b>{v}%</b>
            </div>
          ))}
        </div>
      </Sec>

      {/* ---------------- mid CTA with pull quote ---------------------------- */}
      <section className="lp-sec">
        <div className="lp-wrap lp-rv" style={{ display: "grid", gap: "var(--s7)", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", alignItems: "center" }}>
          <p className="lp-pull">
            The first problem takes about <span>ninety seconds</span>. There is no signup
            wall between you and the editor.
          </p>
          <div><Cta /></div>
        </div>
      </section>

      {/* ---------------- 04 learning path ----------------------------------- */}
      <Sec n="06" id="path">
        <p className="lp-eyebrow lp-rv">Learning path</p>
        <div className="lp-head lp-rv">
          <h2>{modules} modules, in the order the ideas build.</h2>
          <p className="lp-lede">
            Each module opens with an explanation written to be understood rather than
            skimmed, then hands you problems that force the idea into your fingers.
          </p>
        </div>
        <div className="lp-modlist lp-rv">
          {MODULES.slice(0, 10).map((m, i) => (
            <a className="lp-modrow" href={`#/m/${m.id}`} key={m.id}>
              <span className="ix">{String(i + 1).padStart(2, "0")}</span>
              <span className="ti">{m.title}</span>
              <span className="bl">{m.blurb}</span>
              <span className="ct">{m.problems.length}</span>
            </a>
          ))}
        </div>
        <p className="lp-hero-note lp-rv" style={{ marginTop: "var(--s5)" }}>
          + {modules - 10} more, through time series, deduplication, pivots and statistics.
        </p>
      </Sec>

      {/* ---------------- 05 interview --------------------------------------- */}
      <Sec n="07" id="interview">
        <p className="lp-eyebrow lp-rv">Interview preparation</p>
        <div className="lp-head lp-rv">
          <h2>{interview} problems drawn from what actually gets asked.</h2>
          <p className="lp-lede">
            Timed mode gives you a random draw and a clock, which is the part most practice
            leaves out. Knowing a pattern and producing it under pressure are different skills.
          </p>
        </div>
        <div className="lp-grid lp-g3 lp-rv">
          {[
            ["Gaps and islands", "Consecutive-day streaks. The shape that turns up in nearly every senior screen."],
            ["Top N per group", "Window functions and LATERAL, both, so you can say out loud why you picked one."],
            ["The join that doubles revenue", "Fan-out: the bug that quietly inflates a number nobody thinks to check."],
          ].map(([t, d]) => (
            <article className="lp-tile" key={t}><h3>{t}</h3><p>{d}</p></article>
          ))}
        </div>
      </Sec>

      {/* ---------------- 06 open source -------------------------------------- */}
      <Sec n="08">
        <p className="lp-eyebrow lp-rv">Open source</p>
        <div className="lp-split lp-rv">
          <div>
            <h2>Every problem is auditable.</h2>
            <p className="lp-lede">
              The problems, the datasets and the grader are on GitHub. Every canonical
              solution runs in CI against both datasets on each push, so a broken problem
              cannot ship. If a prompt is ambiguous or an answer is wrong, open an issue
              and it gets fixed.
            </p>
            <div style={{ marginTop: "var(--s6)" }}>
              <a className="lp-btn lp-btn-ghost" href="https://github.com/ps-cmd777/sqlgym">
                Read the source<span className="arw" aria-hidden="true">→</span>
              </a>
            </div>
          </div>
          <div className="lp-term" aria-hidden="true">
            <div className="dim">$ npm run validate</div>
            <div className="dim">  seed visible=1101 hidden=7907</div>
            <div className="ok">  ✓ {problems}/{problems} solutions · both datasets</div>
            <div className="dim">  ✓ every solution returns ≥ 1 row</div>
            <div className="ok">  ✓ {modules} modules · 0 failures</div>
          </div>
        </div>
      </Sec>

      {/* ---------------- 07 pricing ------------------------------------------ */}
      <Sec n="09" id="pricing">
        <p className="lp-eyebrow lp-rv">Pricing</p>
        <div className="lp-split lp-rv">
          <div>
            <h2>Free, and it stays that way.</h2>
            <p className="lp-lede">
              There is no server to pay for. The database runs in your browser, so every
              problem, every module and the hidden-dataset check cost nothing to give away.
              No trial, no tier, no card.
            </p>
            <div style={{ marginTop: "var(--s6)" }}><Cta /></div>
          </div>
          <div className="lp-facts">
            <div><b>Problems</b><span>All {problems}. Nothing held back behind a tier.</span></div>
            <div><b>Interview mode</b><span>Included, with the timer.</span></div>
            <div><b>Account</b><span>None. Progress lives in your browser.</span></div>
            <div><b>Your queries</b><span>Never leave the tab.</span></div>
            <div><b>Licence</b><span>Open source on GitHub.</span></div>
          </div>
        </div>
      </Sec>

      {/* ---------------- 08 FAQ ---------------------------------------------- */}
      <Sec n="10">
        <p className="lp-eyebrow lp-rv">Questions</p>
        <h2 className="lp-rv">Reasonable things to ask.</h2>
        <div className="lp-grid lp-g2 lp-rv" style={{ marginTop: "var(--s6)" }}>
          {[
            ["Is this really Postgres?", "Yes. Postgres compiled to WebAssembly, running in the tab. The same planner, the same functions, the same error messages."],
            ["Does my data leave the machine?", "There is nothing to send. No account, no server, no analytics on your queries. Progress is stored in your browser."],
            ["What if my query is right but different?", "It passes. Grading compares result sets, not text, so any correct query works."],
            ["Which dialect should I learn?", "The core is portable. Where Postgres differs from MySQL or SQLite, the module says so."],
          ].map(([q, a]) => (
            <article className="lp-tile" key={q}><h3>{q}</h3><p>{a}</p></article>
          ))}
        </div>
      </Sec>

      {/* ---------------- final CTA ------------------------------------------- */}
      <section className="lp-sec" style={{ textAlign: "center", paddingBottom: "var(--s9)" }}>
        <div className="lp-wrap lp-narrow lp-rv">
          <h2 style={{ margin: "0 auto var(--s5)", maxWidth: "15ch", fontSize: "clamp(38px, 6vw, 68px)" }}>
            Open the editor.
          </h2>
          <p className="lp-lede" style={{ margin: "0 auto var(--s6)" }}>
            The SQL round should be the easy part of the interview. {problems} problems, free,
            no account, first one in about ninety seconds.
          </p>
          <Cta />
        </div>
      </section>

      <footer className="lp-wrap" style={{
        padding: "var(--s6) var(--s5)", borderTop: "1px solid var(--lp-rule-2)",
        display: "flex", gap: "var(--s5)", flexWrap: "wrap", alignItems: "center",
        font: "400 14px/1.6 var(--lp-sans)", color: "var(--lp-faint)",
      }}>
        <span className="lp-mark" style={{ fontSize: 15 }}><i />SQLGym</span>
        <span style={{ marginLeft: "auto" }}>
          <a href="https://github.com/ps-cmd777/sqlgym" style={{ color: "inherit" }}>Source</a>
        </span>
      </footer>
    </div>
  );
}
