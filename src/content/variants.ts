/**
 * Variant engine: multiplies drill-worthy problems into siblings with
 * different parameters (country, threshold, date window, direction…).
 *
 * Each spec names a base problem and a list of exact text substitutions
 * applied to the prompt, hint, and solution. Variants inherit everything
 * else and get ids like "f1-b". Every variant is executed against both
 * dataset seeds by `npm run validate` — a substitution that breaks the
 * SQL or empties the result cannot ship.
 */

import type { Module, Problem } from "./types";

interface VariantSpec {
  base: string;                 // base problem id
  suffix: string;               // "b", "c", …
  title?: string;               // optional title override
  subs: [from: string, to: string][]; // applied to prompt, hint, solution, checkSql
}

const V: VariantSpec[] = [
  // --- foundations ---
  { base: "f1", suffix: "b", subs: [["Germany ('DE')", "France ('FR')"], ["'DE'", "'FR'"]] },
  { base: "f1", suffix: "c", subs: [["Germany ('DE')", "Poland ('PL')"], ["'DE'", "'PL'"], ["earliest signup first", "most recent signup first"], ["ORDER BY signup_date", "ORDER BY signup_date DESC"]] },
  { base: "f4", suffix: "b", subs: [["at least 5 users", "at least 8 users"], [">= 5", ">= 8"]] },
  { base: "f4", suffix: "c", subs: [["at least 5 users", "at least 3 users"], [">= 5", ">= 3"]] },
  { base: "f6", suffix: "b", subs: [["March 2025", "June 2025"], ["'2025-03-01'", "'2025-06-01'"], ["'2025-04-01'", "'2025-07-01'"]] },
  { base: "f6", suffix: "c", subs: [["March 2025", "September 2025"], ["'2025-03-01'", "'2025-09-01'"], ["'2025-04-01'", "'2025-10-01'"]] },
  // --- joins ---
  { base: "j1", suffix: "b", subs: [["completed order's", "cancelled order's"], ["status = 'completed'", "status = 'cancelled'"]] },
  { base: "j4", suffix: "b", subs: [["`completed_orders` (count of their completed orders — 0 if none)", "`cancelled_orders` (count of their cancelled orders — 0 if none)"], ["status = 'completed'", "status = 'cancelled'"], ["completed_orders", "cancelled_orders"]] },
  // --- subqueries ---
  { base: "s1", suffix: "b", subs: [["strictly above", "strictly below"], ["price >", "price <"]] },
  { base: "s3", suffix: "b", subs: [["track 1", "track 5"], ["track_id = 1", "track_id = 5"]] },
  { base: "s5", suffix: "b", subs: [["'jazz'", "'electronic'"], ["'rock'", "'hiphop'"], ["jazz", "electronic"], ["rock", "hiphop"]] },
  { base: "s6", suffix: "b", subs: [["February 2025", "March 2025"], ["March 2025", "April 2025"], ["'2025-02-01'", "'2025-03-01'"], ["'2025-03-01'", "'2025-04-01'"], ["'2025-04-01'", "'2025-05-01'"]] },
  // --- ctes ---
  { base: "c1", suffix: "b", subs: [["completed orders'", "cancelled orders'"], ["'completed'", "'cancelled'"]] },
  { base: "c2", suffix: "b", subs: [["more than 1 hour", "more than 2 hours"], ["> 3600", "> 7200"]] },
  // --- windows ---
  { base: "w1", suffix: "b", subs: [["longest track", "shortest track"], ["duration_s DESC", "duration_s ASC"]] },
  { base: "w3", suffix: "b", title: "Top 3 products per category", subs: [["top 2 products", "top 3 products"], ["rn <= 2", "rn <= 3"]] },
  { base: "w5", suffix: "b", title: "Third-highest spender", subs: [["SECOND-highest", "THIRD-highest"], ["for second", "for third"], ["rk = 2", "rk = 3"]] },
  { base: "w6", suffix: "b", subs: [["June 2025", "August 2025"], ["'2025-06-01'", "'2025-08-01'"], ["'2025-07-01'", "'2025-09-01'"]] },
  { base: "o1", suffix: "b", subs: [["user 1's", "user 7's"], ["user_id = 1", "user_id = 7"]] },
  // --- patterns ---
  { base: "p2", suffix: "b", subs: [["3+ days", "4+ days"], ["is 3+", "is 4+"], [">= 3", ">= 4"]] },
  { base: "p4", suffix: "b", subs: [["March 2025 (all 31)", "May 2025 (all 31)"], ["'2025-03-01'", "'2025-05-01'"], ["'2025-03-31'", "'2025-05-31'"]] },
  { base: "p4", suffix: "c", subs: [["March 2025 (all 31)", "August 2025 (all 31)"], ["'2025-03-01'", "'2025-08-01'"], ["'2025-03-31'", "'2025-08-31'"]] },
  // --- hierarchy ---
  { base: "h2", suffix: "b", subs: [["employee 2", "employee 3"], ["manager_id = 2", "manager_id = 3"]] },
  { base: "h2", suffix: "c", subs: [["employee 2", "employee 4"], ["manager_id = 2", "manager_id = 4"]] },
  { base: "h4", suffix: "b", subs: [["employee 40", "employee 33"], ["emp_id = 40", "emp_id = 33"]] },
  // --- expressions ---
  { base: "x1", suffix: "b", subs: [["uppercased", "lowercased"], ["UPPER(", "LOWER("], ["'ANA PETROS · Engineering'", "'ana petros · Engineering'"]] },
  { base: "x3", suffix: "b", subs: [["before 2022-01-01", "before 2023-01-01"], ["'2022-01-01'", "'2023-01-01'"], ["(2022-2023)", "(2023)"], ["2024-01-01 or later", "2024-01-01 or later"]] },
  // --- mutations ---
  { base: "m1", suffix: "b", subs: [["product_id 999", "product_id 998"], ["'Gift Card'", "'Desk Mat'"], ["price 25.00", "price 12.50"], ["(999,", "(998,"], ["25.00)", "12.50)"], ["= 999", "= 998"], ["Gift Card", "Desk Mat"]] },
  { base: "m2", suffix: "b", subs: [["'Cables' category by 10% (multiply by 1.10)", "'Audio' category by 15% (multiply by 1.15)"], ["category = 'Cables'", "category = 'Audio'"], ["* 1.10", "* 1.15"]] },
  // --- analytics ---
  { base: "a1", suffix: "b", subs: [["7 or more days", "14 or more days"], ["+ 7", "+ 14"]] },
  { base: "a5", suffix: "b", subs: [["2025-12-31", "2025-09-30"]] },
  { base: "a6", suffix: "b", subs: [["(≥30 plays)", "(≥40 plays)"], ["(10–29)", "(15–39)"], ["(<10)", "(<15)"], [">= 30", ">= 40"], [">= 10", ">= 15"]] },
  // --- interview ---
  { base: "i3", suffix: "b", title: "75th-percentile duration by genre", subs: [["`median_duration_s` (continuous median", "`p75_duration_s` (continuous 75th percentile"], ["PERCENTILE_CONT(0.5)", "PERCENTILE_CONT(0.75)"], ["median_duration_s", "p75_duration_s"]] },
  { base: "i4", suffix: "b", subs: [["seconds_played < 30", "seconds_played < 60"], ["'skip' if seconds_played", "'skip' if seconds_played"], ["< 30", "< 60"]] },
  { base: "i5", suffix: "b", subs: [["2025-06-15", "2025-08-15"], ["2025-07-15", "2025-09-15"]] },
];

function applySubs(text: string, subs: [string, string][]): string {
  // Simultaneous single-pass replacement: each source position is replaced
  // at most once, so chains like Feb→Mar + Mar→Apr can't cascade.
  const map = new Map(subs);
  const escaped = subs
    .map(([from]) => from)
    .sort((a, b) => b.length - a.length) // longest match wins
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(escaped.join("|"), "g");
  return text.replace(pattern, (match) => map.get(match) ?? match);
}

/** Expand modules in place: insert each variant right after its base. */
export function withVariants(modules: Module[]): Module[] {
  const byBase = new Map<string, VariantSpec[]>();
  for (const spec of V) {
    byBase.set(spec.base, [...(byBase.get(spec.base) ?? []), spec]);
  }
  return modules.map((mod) => {
    const problems: Problem[] = [];
    for (const p of mod.problems) {
      problems.push(p);
      for (const spec of byBase.get(p.id) ?? []) {
        problems.push({
          ...p,
          id: `${p.id}-${spec.suffix}`,
          title: spec.title ?? `${p.title} (variation ${spec.suffix.toUpperCase()})`,
          prompt: applySubs(p.prompt, spec.subs),
          hint: applySubs(p.hint, spec.subs),
          solution: applySubs(p.solution, spec.subs),
          checkSql: p.checkSql ? applySubs(p.checkSql, spec.subs) : undefined,
          interview: false, // variants drill; originals represent in timed mode
        });
      }
    }
    return { ...mod, problems };
  });
}
