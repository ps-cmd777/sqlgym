/** Modules 4-6: CTEs, window functions I & II. All original. */

import type { Module } from "./types";

export const ctes: Module = {
  id: "ctes",
  title: "Breaking big problems into steps (CTEs)",
  blurb: "WITH lets you name intermediate results and build complex answers step by step — like showing your work in math.",
  theory: `## WITH is a workbench
A CTE names an intermediate result. Chains of small CTEs beat one clever nested query in every interview: they're debuggable step by step, and you can narrate them.

\`\`\`sql
WITH per_order AS (
  SELECT order_id, SUM(quantity * unit_price) AS order_value
  FROM order_items GROUP BY order_id
),
per_customer AS (
  SELECT o.customer_id, SUM(p.order_value) AS spend
  FROM orders o JOIN per_order p USING (order_id)
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT * FROM per_customer WHERE spend > 500;
\`\`\`

## Narrate while you write
In a live screen, say what each CTE does as you type it. It buys thinking time and shows structured reasoning — which is what's actually being graded.`,
  problems: [
    {
      id: "c1", title: "Two-step aggregate", difficulty: 2, schema: "brightmart",
      prompt: "Using a CTE for per-order item value, return `avg_order_value` (average of completed orders' item totals, 2 decimals). One row.",
      hint: "CTE: SUM per order_id; outer: AVG over completed orders only.",
      solution: `WITH per_order AS (
  SELECT order_id, SUM(quantity * unit_price) AS v FROM order_items GROUP BY order_id
)
SELECT ROUND(AVG(v)::numeric, 2) AS avg_order_value
FROM orders o JOIN per_order p ON p.order_id = o.order_id
WHERE o.status = 'completed'`,
      interview: true,
    },
    {
      id: "c2", title: "Filter on a computed step", difficulty: 3, schema: "wavely",
      prompt: "A user's listening time is the sum of `seconds_played`. Return `user_id` and `hours` (listening time in hours, 1 decimal) for users with more than 1 hour total, most hours first; ties by user_id.",
      hint: "CTE sums seconds per user; outer converts and filters. ROUND((s/3600.0)::numeric, 1).",
      solution: `WITH listening AS (
  SELECT user_id, SUM(seconds_played) AS s FROM plays GROUP BY user_id
)
SELECT user_id, ROUND((s / 3600.0)::numeric, 1) AS hours
FROM listening WHERE s > 3600
ORDER BY hours DESC, user_id`,
      orderSensitive: true,
    },
    {
      id: "c3", title: "Compare two aggregates", difficulty: 3, schema: "brightmart",
      prompt: "Return countries where completed-order revenue exceeds the average completed-order revenue across all countries. Columns: `country`, `revenue` (2 decimals).",
      hint: "CTE with per-country revenue, then WHERE revenue > (SELECT AVG(...) FROM cte).",
      solution: `WITH rev AS (
  SELECT c.country, SUM(i.quantity * i.unit_price) AS r
  FROM customers c
  JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
  JOIN order_items i ON i.order_id = o.order_id
  GROUP BY c.country
)
SELECT country, ROUND(r::numeric, 2) AS revenue FROM rev
WHERE r > (SELECT AVG(r) FROM rev)`,
      interview: true,
    },
    {
      id: "c4", title: "Refund rate by category", difficulty: 4, schema: "brightmart",
      prompt: "For each product category: `category`, `orders_with_category` (distinct completed orders containing that category) and `refunded_orders` (of those, how many were refunded), plus `refund_rate` = refunded/orders rounded to 3 decimals. Order by refund_rate descending, then category.",
      hint: "CTE of (category, order_id) pairs from completed orders; LEFT JOIN refunds; conditional count.",
      solution: `WITH cat_orders AS (
  SELECT DISTINCT p.category, o.order_id
  FROM orders o
  JOIN order_items i ON i.order_id = o.order_id
  JOIN products p ON p.product_id = i.product_id
  WHERE o.status = 'completed'
)
SELECT co.category,
       COUNT(*) AS orders_with_category,
       COUNT(r.order_id) AS refunded_orders,
       ROUND(COUNT(r.order_id)::numeric / COUNT(*), 3) AS refund_rate
FROM cat_orders co
LEFT JOIN (SELECT DISTINCT order_id FROM refunds) r ON r.order_id = co.order_id
GROUP BY co.category
ORDER BY refund_rate DESC, co.category`,
      orderSensitive: true, interview: true,
    },
  ],
};

export const windows1: Module = {
  id: "windows1",
  title: "Ranking rows (window functions I)",
  blurb: "\"Top 3 products per category\", \"each user's latest order\" — the two most-asked interview questions, one technique.",
  theory: `## Aggregate vs window
\`GROUP BY\` collapses rows; a window function computes across related rows **without collapsing**. Syntax: \`fn() OVER (PARTITION BY … ORDER BY …)\`.

## The ranking trio
On values 100, 90, 90, 80:
- \`ROW_NUMBER()\` → 1,2,3,4 (arbitrary tie order — add a tiebreaker!)
- \`RANK()\` → 1,2,2,4 (gaps)
- \`DENSE_RANK()\` → 1,2,2,3 (no gaps)
Ties are the interview probe: "what if two rows have the same value?" Have an answer before they ask.

## The two patterns to drill until automatic
**Top-N per group** and **latest record per entity**:
\`\`\`sql
SELECT * FROM (
  SELECT s.*, ROW_NUMBER() OVER (
    PARTITION BY user_id ORDER BY started_on DESC, sub_id DESC
  ) AS rn
  FROM subscriptions s
) t WHERE rn = 1;
\`\`\`
Window functions can't go in WHERE — wrap in a subquery/CTE and filter outside.`,
  problems: [
    {
      id: "w1", title: "Rank tracks by length", difficulty: 2, schema: "wavely",
      prompt: "Return `title`, `duration_s`, and `len_rank` where rank 1 is the longest track, using DENSE_RANK over all tracks. Include all tracks.",
      hint: "DENSE_RANK() OVER (ORDER BY duration_s DESC).",
      solution: "SELECT title, duration_s, DENSE_RANK() OVER (ORDER BY duration_s DESC) AS len_rank FROM tracks",
    },
    {
      id: "w2", title: "Latest subscription per user", difficulty: 3, schema: "wavely",
      prompt: "For each user with any subscription, return `user_id`, `plan`, `started_on` of their most recent subscription (latest started_on; break ties by higher sub_id).",
      hint: "ROW_NUMBER PARTITION BY user_id ORDER BY started_on DESC, sub_id DESC; keep rn = 1.",
      solution: `SELECT user_id, plan, started_on FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY started_on DESC, sub_id DESC) AS rn
  FROM subscriptions s
) t WHERE rn = 1`,
      interview: true,
    },
    {
      id: "w3", title: "Top 2 products per category", difficulty: 3, schema: "brightmart",
      prompt: "By units sold (sum of quantity, any order status), return the top 2 products per category: `category`, `product_name`, `units`. Break ties by product_id ascending.",
      hint: "Aggregate first, then ROW_NUMBER PARTITION BY category ORDER BY units DESC, product_id.",
      solution: `WITH units AS (
  SELECT p.category, p.product_name, p.product_id, SUM(i.quantity) AS u
  FROM products p JOIN order_items i ON i.product_id = p.product_id
  GROUP BY p.category, p.product_name, p.product_id
)
SELECT category, product_name, u AS units FROM (
  SELECT units.*, ROW_NUMBER() OVER (PARTITION BY category ORDER BY u DESC, product_id) AS rn
  FROM units
) t WHERE rn <= 2`,
      interview: true,
    },
    {
      id: "w4", title: "RANK with gaps, on purpose", difficulty: 3, schema: "brightmart",
      prompt: "Rank countries by number of customers (RANK — ties share a rank and create gaps). Return `country`, `n_customers`, `country_rank`, ordered by rank then country.",
      hint: "Aggregate per country in a CTE, then RANK() OVER (ORDER BY n DESC).",
      solution: `WITH n AS (SELECT country, COUNT(*) AS n_customers FROM customers GROUP BY country)
SELECT country, n_customers, RANK() OVER (ORDER BY n_customers DESC) AS country_rank
FROM n ORDER BY country_rank, country`,
      orderSensitive: true,
    },
    {
      id: "w5", title: "Second-highest spender", difficulty: 4, schema: "brightmart",
      prompt: "Find the customer(s) with the SECOND-highest completed-order spend (quantity × unit_price). Return `customer_id` and `spend` (2 decimals). If several tie for second, return all of them. Use DENSE_RANK.",
      hint: "Per-customer spend CTE → DENSE_RANK ORDER BY spend DESC → keep rank 2.",
      solution: `WITH spend AS (
  SELECT o.customer_id, SUM(i.quantity * i.unit_price) AS s
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT customer_id, ROUND(s::numeric, 2) AS spend FROM (
  SELECT spend.*, DENSE_RANK() OVER (ORDER BY s DESC) AS rk FROM spend
) t WHERE rk = 2`,
      interview: true,
    },
    {
      id: "w6", title: "Each play vs the user's average", difficulty: 4, schema: "wavely",
      prompt: "For plays in June 2025, return `play_id`, `user_id`, `seconds_played`, and `user_avg` (that user's average seconds_played across their June 2025 plays, 1 decimal). No collapsing — one row per play.",
      hint: "AVG(...) OVER (PARTITION BY user_id) on the filtered rows; round the window result.",
      solution: `SELECT play_id, user_id, seconds_played,
       ROUND(AVG(seconds_played) OVER (PARTITION BY user_id)::numeric, 1) AS user_avg
FROM plays
WHERE played_on >= '2025-06-01' AND played_on < '2025-07-01'`,
      interview: true,
    },
  ],
};

export const windows2: Module = {
  id: "windows2",
  title: "Trends & running totals (window functions II)",
  blurb: "Compare each row to the previous one, build running totals and moving averages — the heart of trend analysis.",
  theory: `## Offset functions
\`LAG(col) OVER (PARTITION BY … ORDER BY …)\` reads the previous row; \`LEAD\` the next. Day-over-day deltas, time-between-events, churn gaps — all LAG.

## Frames: what \`SUM(...) OVER (ORDER BY …)\` really means
With ORDER BY, the default frame is *start through current row* — that's why it produces a running total. A moving window is explicit:
\`\`\`sql
AVG(v) OVER (ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
\`\`\`

## Percent of total
\`v / SUM(v) OVER ()\` — an unpartitioned window sees everything. No self-join needed.

## A habit that prevents wrong answers
Always state the frame in your head: *partition, order, frame*. Most wrong window answers are a missing PARTITION BY or an unintended default frame.`,
  problems: [
    {
      id: "o1", title: "Days between plays", difficulty: 3, schema: "wavely",
      prompt: "For user 1's distinct play dates, return `played_on` and `days_since_prev` (difference in days from the previous distinct date; NULL for the first). Order by date.",
      hint: "DISTINCT dates in a CTE, then played_on - LAG(played_on) OVER (ORDER BY played_on).",
      solution: `WITH d AS (SELECT DISTINCT played_on FROM plays WHERE user_id = 1)
SELECT played_on, played_on - LAG(played_on) OVER (ORDER BY played_on) AS days_since_prev
FROM d ORDER BY played_on`,
      orderSensitive: true,
    },
    {
      id: "o2", title: "Running revenue", difficulty: 3, schema: "brightmart",
      prompt: "Daily completed-order item revenue, with a running total: `ordered_on`, `day_revenue` (2 decimals), `cumulative_revenue` (2 decimals), ordered by date.",
      hint: "Aggregate per day in a CTE; SUM(day) OVER (ORDER BY day) for the cumulative.",
      solution: `WITH daily AS (
  SELECT o.ordered_on, SUM(i.quantity * i.unit_price) AS r
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.ordered_on
)
SELECT ordered_on, ROUND(r::numeric, 2) AS day_revenue,
       ROUND(SUM(r) OVER (ORDER BY ordered_on)::numeric, 2) AS cumulative_revenue
FROM daily ORDER BY ordered_on`,
      orderSensitive: true, interview: true,
    },
    {
      id: "o3", title: "7-row moving average", difficulty: 4, schema: "brightmart",
      prompt: "Over the daily revenue series from the previous problem, add `ma7`: the average of the current and previous 6 revenue days (ROWS frame), 2 decimals. Return `ordered_on`, `ma7`, ordered by date.",
      hint: "AVG(r) OVER (ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW).",
      solution: `WITH daily AS (
  SELECT o.ordered_on, SUM(i.quantity * i.unit_price) AS r
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.ordered_on
)
SELECT ordered_on,
       ROUND(AVG(r) OVER (ORDER BY ordered_on ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)::numeric, 2) AS ma7
FROM daily ORDER BY ordered_on`,
      orderSensitive: true, interview: true,
    },
    {
      id: "o4", title: "Genre share of listening", difficulty: 3, schema: "wavely",
      prompt: "Share of total seconds_played by genre: `genre`, `pct` (percent of all listening seconds, 1 decimal), largest first; ties by genre.",
      hint: "Aggregate per genre, then 100 * s / SUM(s) OVER ().",
      solution: `WITH g AS (
  SELECT t.genre, SUM(p.seconds_played) AS s
  FROM plays p JOIN tracks t ON t.track_id = p.track_id
  GROUP BY t.genre
)
SELECT genre, ROUND((100.0 * s / SUM(s) OVER ())::numeric, 1) AS pct
FROM g ORDER BY pct DESC, genre`,
      orderSensitive: true, interview: true,
    },
    {
      id: "o5", title: "Month-over-month growth", difficulty: 4, schema: "brightmart",
      prompt: "Monthly completed revenue with growth vs the previous month: `month` (first day of month, date), `revenue` (2 dp), `growth_pct` (percent change vs previous month, 1 dp; NULL for the first month). Ordered by month.",
      hint: "date_trunc('month', ordered_on)::date; LAG(revenue) for the denominator.",
      solution: `WITH m AS (
  SELECT date_trunc('month', o.ordered_on)::date AS month, SUM(i.quantity * i.unit_price) AS r
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY 1
)
SELECT month, ROUND(r::numeric, 2) AS revenue,
       ROUND((100.0 * (r - LAG(r) OVER (ORDER BY month)) / LAG(r) OVER (ORDER BY month))::numeric, 1) AS growth_pct
FROM m ORDER BY month`,
      orderSensitive: true, interview: true,
    },
    {
      id: "o6", title: "First and most recent play gap", difficulty: 4, schema: "wavely",
      prompt: "For each user with 2+ plays: `user_id`, `active_span_days` (days between first and last play date), `n_plays`. Order by span descending, then user_id.",
      hint: "MIN/MAX of played_on per user; subtracting dates yields integer days.",
      solution: `SELECT user_id, MAX(played_on) - MIN(played_on) AS active_span_days, COUNT(*) AS n_plays
FROM plays GROUP BY user_id HAVING COUNT(*) >= 2
ORDER BY active_span_days DESC, user_id`,
      orderSensitive: true,
    },
  ],
};
