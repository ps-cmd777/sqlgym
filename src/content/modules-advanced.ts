/** Modules 7-9: classic patterns, product analytics, interview set. Original. */

import type { Module } from "./types";

export const patterns: Module = {
  id: "patterns",
  title: "Famous interview patterns",
  blurb: "Streaks, duplicates, pivot tables, missing dates — problems so common in interviews they have names.",
  theory: `## Dedup (keep one row per entity)
\`ROW_NUMBER() OVER (PARTITION BY key ORDER BY tiebreaker)\` then keep \`rn = 1\`. State your tiebreaker out loud.

## Gaps & islands — the streak trick
For consecutive dates: \`date - ROW_NUMBER() * INTERVAL\` is constant within a run. In Postgres, \`date - ROW_NUMBER()::int\` works directly on DATE:
\`\`\`sql
WITH d AS (SELECT DISTINCT user_id, played_on FROM plays),
grp AS (
  SELECT user_id, played_on,
         played_on - ROW_NUMBER() OVER (
           PARTITION BY user_id ORDER BY played_on)::int AS island
  FROM d
)
SELECT user_id, COUNT(*) AS streak_len
FROM grp GROUP BY user_id, island;
\`\`\`
Rows in the same island belong to one unbroken streak. This exact trick is asked constantly.

## Pivot without PIVOT
Conditional aggregation: \`SUM(CASE WHEN genre = 'jazz' THEN 1 ELSE 0 END) AS jazz\` — or Postgres's cleaner \`COUNT(*) FILTER (WHERE genre = 'jazz')\`.

## Date spine
Aggregating only rows that exist silently skips empty days. Generate the calendar and LEFT JOIN data onto it:
\`\`\`sql
SELECT gs::date AS day
FROM generate_series('2025-01-01'::date, '2025-01-31'::date, '1 day') gs;
\`\`\``,
  problems: [
    {
      id: "p1", title: "Dedup: one row per user", difficulty: 3, schema: "wavely",
      prompt: "Some users have multiple subscriptions. Return each subscriber's `user_id` and the `plan` of their EARLIEST subscription (lowest started_on; ties by lower sub_id).",
      hint: "ROW_NUMBER PARTITION BY user_id ORDER BY started_on, sub_id → rn = 1.",
      solution: `SELECT user_id, plan FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY started_on, sub_id) AS rn
  FROM subscriptions s
) t WHERE rn = 1`,
      interview: true,
    },
    {
      id: "p2", title: "Longest listening streak", difficulty: 4, schema: "wavely",
      prompt: "A streak is consecutive calendar days a user played at least one track. Return `user_id` and `longest_streak` (in days) for users whose longest streak is 3+ days, longest first, ties by user_id.",
      hint: "DISTINCT dates → island = played_on - ROW_NUMBER()::int → count per island → MAX per user.",
      solution: `WITH d AS (SELECT DISTINCT user_id, played_on FROM plays),
grp AS (
  SELECT user_id, played_on,
         played_on - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY played_on))::int AS island
  FROM d
),
streaks AS (
  SELECT user_id, COUNT(*) AS len FROM grp GROUP BY user_id, island
)
SELECT user_id, MAX(len) AS longest_streak
FROM streaks GROUP BY user_id HAVING MAX(len) >= 3
ORDER BY longest_streak DESC, user_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "p3", title: "Pivot: plan mix by country", difficulty: 3, schema: "wavely",
      prompt: "One row per country that has subscriptions: `country`, `plus_subs`, `premium_subs` (count of subscriptions by plan, counting every subscription row). Alphabetical by country.",
      hint: "Join users; COUNT(*) FILTER (WHERE plan = 'plus') — or SUM(CASE …).",
      solution: `SELECT u.country,
       COUNT(*) FILTER (WHERE s.plan = 'plus') AS plus_subs,
       COUNT(*) FILTER (WHERE s.plan = 'premium') AS premium_subs
FROM subscriptions s JOIN users u ON u.user_id = s.user_id
GROUP BY u.country ORDER BY u.country`,
      orderSensitive: true, interview: true,
    },
    {
      id: "p4", title: "Date spine: include the zero days", difficulty: 4, schema: "brightmart",
      prompt: "For every calendar day in March 2025 (all 31), return `day` and `n_orders` (orders placed that day, any status — 0 where none). Ordered by day.",
      hint: "generate_series('2025-03-01','2025-03-31','1 day') LEFT JOIN orders; COUNT(order_id).",
      solution: `SELECT gs::date AS day, COUNT(o.order_id) AS n_orders
FROM generate_series('2025-03-01'::date, '2025-03-31'::date, '1 day') gs
LEFT JOIN orders o ON o.ordered_on = gs::date
GROUP BY gs::date ORDER BY day`,
      orderSensitive: true, interview: true,
    },
    {
      id: "p5", title: "Islands of subscription coverage", difficulty: 4, schema: "wavely",
      prompt: "Call a user 'currently covered' if they have any subscription with cancelled_on IS NULL. Return `covered` (count of covered users) and `lapsed` (users who have subscriptions but all cancelled). One row.",
      hint: "Per-user BOOL_OR(cancelled_on IS NULL) in a CTE; count both groups with FILTER.",
      solution: `WITH per_user AS (
  SELECT user_id, BOOL_OR(cancelled_on IS NULL) AS covered
  FROM subscriptions GROUP BY user_id
)
SELECT COUNT(*) FILTER (WHERE covered) AS covered,
       COUNT(*) FILTER (WHERE NOT covered) AS lapsed
FROM per_user`,
      interview: true,
    },
    {
      id: "p6", title: "Top artist per genre, with ties", difficulty: 4, schema: "wavely",
      prompt: "By total plays, find the top artist in each genre. If artists tie for the top, include all. Return `genre`, `artist`, `plays`, ordered by genre then artist.",
      hint: "Aggregate plays per (genre, artist); RANK per genre; keep rank 1.",
      solution: `WITH pa AS (
  SELECT t.genre, t.artist, COUNT(*) AS plays
  FROM plays p JOIN tracks t ON t.track_id = p.track_id
  GROUP BY t.genre, t.artist
)
SELECT genre, artist, plays FROM (
  SELECT pa.*, RANK() OVER (PARTITION BY genre ORDER BY plays DESC) AS rk FROM pa
) t WHERE rk = 1 ORDER BY genre, artist`,
      orderSensitive: true, interview: true,
    },
  ],
};

export const analytics: Module = {
  id: "analytics",
  title: "Business metrics: retention & funnels",
  blurb: "The questions companies actually ask: do users come back? where do they drop off? who are the best customers?",
  theory: `## Retention, defined precisely
"Week-1 retention of the March signup cohort" = of users who signed up in March, what share did the thing again 7–13 days after signup? Interview answers live or die on the precision of the window definition — state yours before writing SQL.

## The cohort shape
1. Anchor each user (signup date, first order…).
2. Join activity; bucket the distance: \`(activity_date - anchor_date)\`.
3. Aggregate: distinct users per cohort per bucket, divide by cohort size.

## Funnels
Stage counts computed from the same population: users → users with X → users with X then Y. Use EXISTS chains or aggregated flags with FILTER. Order events by time when the funnel demands sequence.

## Power users / segmentation
Thresholds over per-entity aggregates: build the per-user CTE first, then classify with CASE. Never try to segment and aggregate in one pass.`,
  problems: [
    {
      id: "a1", title: "Day-7+ return rate", difficulty: 4, schema: "wavely",
      prompt: "Of all users, what share played any track 7 or more days after their signup_date? Return `return_rate` = ROUND(returners::numeric / all_users, 3). One row.",
      hint: "EXISTS with played_on >= signup_date + 7; count with FILTER or AVG of CASE.",
      solution: `SELECT ROUND(
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM plays p WHERE p.user_id = u.user_id AND p.played_on >= u.signup_date + 7
  ))::numeric / COUNT(*), 3) AS return_rate
FROM users u`,
      interview: true,
    },
    {
      id: "a2", title: "Monthly signup cohort sizes", difficulty: 3, schema: "wavely",
      prompt: "Return `cohort_month` (first day of signup month, date) and `n_users`, ordered by month.",
      hint: "date_trunc('month', signup_date)::date.",
      solution: `SELECT date_trunc('month', signup_date)::date AS cohort_month, COUNT(*) AS n_users
FROM users GROUP BY 1 ORDER BY cohort_month`,
      orderSensitive: true,
    },
    {
      id: "a3", title: "Subscription funnel", difficulty: 4, schema: "wavely",
      prompt: "One row, three columns: `all_users`, `ever_played` (users with ≥1 play), `ever_subscribed` (users with ≥1 subscription AND ≥1 play — subscribers who also listened).",
      hint: "COUNT(*) FILTER over EXISTS flags — build the flags in a CTE if it helps.",
      solution: `WITH flags AS (
  SELECT u.user_id,
         EXISTS (SELECT 1 FROM plays p WHERE p.user_id = u.user_id) AS played,
         EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.user_id) AS subbed
  FROM users u
)
SELECT COUNT(*) AS all_users,
       COUNT(*) FILTER (WHERE played) AS ever_played,
       COUNT(*) FILTER (WHERE played AND subbed) AS ever_subscribed
FROM flags`,
      interview: true,
    },
    {
      id: "a4", title: "Repeat-purchase rate by country", difficulty: 4, schema: "brightmart",
      prompt: "Per country: `country`, `customers` (with ≥1 completed order), `repeaters` (with ≥2), and `repeat_rate` (ROUND(repeaters::numeric/customers, 2)). Only countries with at least 3 ordering customers. Order by repeat_rate DESC, country.",
      hint: "Per-customer completed-order counts in a CTE, then aggregate per country.",
      solution: `WITH per_customer AS (
  SELECT c.customer_id, c.country, COUNT(o.order_id) AS n
  FROM customers c JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
  GROUP BY c.customer_id, c.country
)
SELECT country, COUNT(*) AS customers,
       COUNT(*) FILTER (WHERE n >= 2) AS repeaters,
       ROUND(COUNT(*) FILTER (WHERE n >= 2)::numeric / COUNT(*), 2) AS repeat_rate
FROM per_customer GROUP BY country HAVING COUNT(*) >= 3
ORDER BY repeat_rate DESC, country`,
      orderSensitive: true, interview: true,
    },
    {
      id: "a5", title: "MRR snapshot", difficulty: 4, schema: "wavely",
      prompt: "Monthly recurring revenue on 2025-12-31: sum of monthly_price over subscriptions active that day (started_on <= date, and cancelled_on is NULL or > date). Return `mrr` (2 decimals). One row.",
      hint: "Careful with the NULL branch of cancelled_on — that's the whole exercise.",
      solution: `SELECT ROUND(SUM(monthly_price)::numeric, 2) AS mrr
FROM subscriptions
WHERE started_on <= '2025-12-31'
  AND (cancelled_on IS NULL OR cancelled_on > '2025-12-31')`,
      interview: true,
    },
    {
      id: "a6", title: "Power-listener segmentation", difficulty: 4, schema: "wavely",
      prompt: "Classify users with ≥1 play: 'power' (≥30 plays), 'regular' (10–29), 'casual' (<10). Return `segment` and `n_users`, ordered power → regular → casual.",
      hint: "Per-user counts, CASE to segment, then GROUP BY segment; order with a CASE key.",
      solution: `WITH per_user AS (SELECT user_id, COUNT(*) AS n FROM plays GROUP BY user_id),
seg AS (
  SELECT CASE WHEN n >= 30 THEN 'power' WHEN n >= 10 THEN 'regular' ELSE 'casual' END AS segment
  FROM per_user
)
SELECT segment, COUNT(*) AS n_users FROM seg GROUP BY segment
ORDER BY CASE segment WHEN 'power' THEN 1 WHEN 'regular' THEN 2 ELSE 3 END`,
      orderSensitive: true, interview: true,
    },
  ],
};

export const interviewSet: Module = {
  id: "interview",
  title: "The interview gauntlet",
  blurb: "Mixed hard problems with no hand-holding — exactly what a live interview feels like. Use timed mode here.",
  theory: `## How to run a live SQL screen
1. **Restate the question** with your assumptions: statuses included? ties? empty groups? That clarification round is scored.
2. **Name the shape** before typing: "per-entity aggregate, then a window rank, then filter."
3. **Build in steps** — CTE by CTE, sanity-checking row counts as you go.
4. **Say the traps out loud**: fan-out, NULLs, ties, integer division. Interviewers pass people who see traps coming.
5. If stuck 30 seconds, narrate options. Silence reads worse than a considered wrong turn.

Use timed mode on this module: 5 problems, 40 minutes, no hints — the honest rehearsal.`,
  problems: [
    {
      id: "i1", title: "Best customer per country", difficulty: 4, schema: "brightmart",
      prompt: "For each country, the customer with the highest completed-order spend (quantity × unit_price). Return `country`, `name`, `spend` (2 dp). Break spend ties by customer_id ascending. Order by country.",
      hint: "Spend CTE → ROW_NUMBER per country → rn = 1.",
      solution: `WITH spend AS (
  SELECT c.country, c.customer_id, c.name, SUM(i.quantity * i.unit_price) AS s
  FROM customers c
  JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
  JOIN order_items i ON i.order_id = o.order_id
  GROUP BY c.country, c.customer_id, c.name
)
SELECT country, name, ROUND(s::numeric, 2) AS spend FROM (
  SELECT spend.*, ROW_NUMBER() OVER (PARTITION BY country ORDER BY s DESC, customer_id) AS rn
  FROM spend
) t WHERE rn = 1 ORDER BY country`,
      orderSensitive: true, interview: true,
    },
    {
      id: "i2", title: "Net revenue after refunds", difficulty: 4, schema: "brightmart",
      prompt: "Per month: `month` (date), `gross` (completed item revenue), `refunds` (refund amounts by refund month), `net` = gross − refunds. All 2 dp; months that appear in either series; NULL-safe (a month may have refunds but no sales). Order by month.",
      hint: "Two monthly CTEs, FULL OUTER JOIN on month, COALESCE everything.",
      solution: `WITH g AS (
  SELECT date_trunc('month', o.ordered_on)::date AS month, SUM(i.quantity * i.unit_price) AS gross
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed' GROUP BY 1
),
r AS (
  SELECT date_trunc('month', refunded_on)::date AS month, SUM(amount) AS ref
  FROM refunds GROUP BY 1
)
SELECT COALESCE(g.month, r.month) AS month,
       ROUND(COALESCE(g.gross, 0)::numeric, 2) AS gross,
       ROUND(COALESCE(r.ref, 0)::numeric, 2) AS refunds,
       ROUND((COALESCE(g.gross, 0) - COALESCE(r.ref, 0))::numeric, 2) AS net
FROM g FULL OUTER JOIN r ON r.month = g.month
ORDER BY month`,
      orderSensitive: true, interview: true,
    },
    {
      id: "i3", title: "Median track duration by genre", difficulty: 4, schema: "wavely",
      prompt: "Per genre: `genre` and `median_duration_s` (continuous median of duration_s, 1 dp). Alphabetical by genre.",
      hint: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s).",
      solution: `SELECT genre,
       ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s))::numeric, 1) AS median_duration_s
FROM tracks GROUP BY genre ORDER BY genre`,
      orderSensitive: true, interview: true,
    },
    {
      id: "i4", title: "Share of skips", difficulty: 4, schema: "wavely",
      prompt: "Call a play a 'skip' if seconds_played < 30. Per genre with ≥20 plays: `genre`, `plays`, `skip_rate` (ROUND(skips::numeric/plays, 3)), highest skip_rate first, ties by genre.",
      hint: "Join tracks, aggregate with FILTER, HAVING on the count.",
      solution: `SELECT t.genre, COUNT(*) AS plays,
       ROUND(COUNT(*) FILTER (WHERE p.seconds_played < 30)::numeric / COUNT(*), 3) AS skip_rate
FROM plays p JOIN tracks t ON t.track_id = p.track_id
GROUP BY t.genre HAVING COUNT(*) >= 20
ORDER BY skip_rate DESC, t.genre`,
      orderSensitive: true, interview: true,
    },
    {
      id: "i5", title: "Consecutive-month subscribers", difficulty: 4, schema: "wavely",
      prompt: "Which users had a subscription active on BOTH 2025-06-15 and 2025-07-15 (same or different subscription rows)? Active = started_on <= day AND (cancelled_on IS NULL OR cancelled_on > day). Return `user_id`, ascending.",
      hint: "Two EXISTS conditions, or INTERSECT of two active-on-day queries.",
      solution: `SELECT DISTINCT user_id FROM subscriptions
WHERE started_on <= '2025-06-15' AND (cancelled_on IS NULL OR cancelled_on > '2025-06-15')
INTERSECT
SELECT DISTINCT user_id FROM subscriptions
WHERE started_on <= '2025-07-15' AND (cancelled_on IS NULL OR cancelled_on > '2025-07-15')
ORDER BY user_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "i6", title: "The comeback artist", difficulty: 4, schema: "wavely",
      prompt: "Per artist, compare plays in 2025-H1 (Jan–Jun) vs 2025-H2 (Jul–Dec). Return artists with MORE H2 than H1 plays: `artist`, `h1_plays`, `h2_plays`, ordered by (h2 − h1) descending, then artist.",
      hint: "Conditional aggregation with FILTER on date ranges, HAVING h2 > h1.",
      solution: `WITH halves AS (
  SELECT t.artist,
         COUNT(*) FILTER (WHERE p.played_on < '2025-07-01') AS h1_plays,
         COUNT(*) FILTER (WHERE p.played_on >= '2025-07-01' AND p.played_on < '2026-01-01') AS h2_plays
  FROM plays p JOIN tracks t ON t.track_id = p.track_id
  WHERE p.played_on >= '2025-01-01' AND p.played_on < '2026-01-01'
  GROUP BY t.artist
)
SELECT artist, h1_plays, h2_plays FROM halves
WHERE h2_plays > h1_plays
ORDER BY h2_plays - h1_plays DESC, artist`,
      orderSensitive: true, interview: true,
    },
  ],
};
