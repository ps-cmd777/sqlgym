/** Modules 4-6: CTEs, window functions I & II. All original. */

import type { Module } from "./types";

export const ctes: Module = {
  id: "ctes",
  title: "Common Table Expressions (CTEs)", track: "interview",
  blurb: "WITH lets you name intermediate results and build complex answers step by step — like showing your work in math.",
  theory: `## A CTE is a named step
\`WITH\` lets you compute something, name it, and reuse it — like defining a variable mid-query. Instead of one giant nested query, you build up in readable steps.

Each customer's total spend. Step 1: total each order. Step 2: total each customer.

\`\`\`sql
WITH order_totals AS (            -- step 1: one row per order
  SELECT order_id, SUM(quantity * unit_price) AS order_value
  FROM order_items
  GROUP BY order_id
)
SELECT o.customer_id, SUM(t.order_value) AS spend   -- step 2: roll up
FROM orders o
JOIN order_totals t ON t.order_id = o.order_id
GROUP BY o.customer_id;
\`\`\`

\`order_totals\` acts like a temporary table that exists only for this query. The final SELECT reads from it as if it were real.

## Why interviewers love CTEs
Chained CTEs read top-to-bottom like a story. In a live interview you *narrate* each step as you type — "first I total each order, then I sum per customer." That narration is often what's actually graded, more than the final query.

## Chain as many as you need
\`\`\`sql
WITH a AS (...),
     b AS (SELECT ... FROM a ...),   -- b can use a
     c AS (SELECT ... FROM b ...)    -- c can use b
SELECT * FROM c;
\`\`\`
Each step can use every step above it. Build complexity one debuggable layer at a time.`,
  problems: [
    {
      id: "c1", title: "Average order value", difficulty: 2, schema: "brightmart",
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
      id: "c2", title: "Users with over an hour of listening", difficulty: 3, schema: "wavely",
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
      id: "c3", title: "Countries above average revenue", difficulty: 3, schema: "brightmart",
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
  title: "Window functions: ranking", track: "interview",
  blurb: "\"Top 3 products per category\", \"each user's latest order\" — the two most-asked interview questions, one technique.",
  theory: `## Window functions vs GROUP BY
\`GROUP BY\` **collapses** many rows into one. A window function computes across related rows but **keeps every row**. You get an aggregate *and* the detail, side by side.

Syntax: \`fn() OVER (PARTITION BY … ORDER BY …)\`. PARTITION BY = which group; ORDER BY = order within it.

## The ranking trio — see the difference
Ranking scores 100, 90, 90, 80:

\`\`\`
score | ROW_NUMBER | RANK | DENSE_RANK
100   |     1      |  1   |     1
90    |     2      |  2   |     2
90    |     3      |  2   |     2
80    |     4      |  4   |     3
\`\`\`

- \`ROW_NUMBER()\` — always 1,2,3,4. Ties broken arbitrarily, so **add a tiebreaker** or results wobble.
- \`RANK()\` — ties share a rank, then **skips** (…2,2,4).
- \`DENSE_RANK()\` — ties share a rank, **no skip** (…2,2,3).

"What happens on a tie?" is the #1 window-function interview probe. Pick the right one before you type.

## Top-N per group (drill until automatic)
"Top 2 products per category": rank *within* each category, keep ranks ≤ 2.

\`\`\`sql
SELECT category, product_name, units FROM (
  SELECT category, product_name,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY units DESC, product_id) AS rn
  FROM product_sales
) ranked
WHERE rn <= 2;
\`\`\`

## Latest record per entity (the other must-know)
Same shape, keep \`rn = 1\`: PARTITION BY the entity, ORDER BY date DESC, keep the top row = each entity's most recent row.

## The rule that trips beginners
A window function **cannot go in WHERE** — WHERE runs before the window is computed. Wrap it in a subquery or CTE, then filter on the result.`,
  problems: [
    {
      id: "w1", title: "Rank tracks by length", difficulty: 2, schema: "wavely",
      prompt: "Return `title`, `duration_s`, and `len_rank` where rank 1 is the longest track, using DENSE_RANK over all tracks. Include all tracks.",
      hint: "DENSE_RANK() OVER (ORDER BY duration_s DESC).",
      solution: "SELECT title, duration_s, DENSE_RANK() OVER (ORDER BY duration_s DESC) AS len_rank FROM tracks",
    },
    {
      id: "w2", title: "Each user's latest subscription", difficulty: 3, schema: "wavely",
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
      id: "w4", title: "Rank countries by customer count", difficulty: 3, schema: "brightmart",
      prompt: "Rank countries by number of customers (RANK — ties share a rank and create gaps). Return `country`, `n_customers`, `country_rank`, ordered by rank then country.",
      hint: "Aggregate per country in a CTE, then RANK() OVER (ORDER BY n DESC).",
      solution: `WITH n AS (SELECT country, COUNT(*) AS n_customers FROM customers GROUP BY country)
SELECT country, n_customers, RANK() OVER (ORDER BY n_customers DESC) AS country_rank
FROM n ORDER BY country_rank, country`,
      orderSensitive: true,
    },
    {
      id: "w5", title: "The second-highest spender", difficulty: 4, schema: "brightmart",
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
  title: "Window functions: analytics", track: "interview",
  blurb: "Compare each row to the previous one, build running totals and moving averages — the heart of trend analysis.",
  theory: `## Look at the previous row: LAG
\`LAG(col) OVER (ORDER BY …)\` gives the value from the row before; \`LEAD\` the next. Change-over-time without a self-join.

Daily revenue with each day's change:

\`\`\`
day     | revenue | LAG(revenue) | change
Mar 01  |  1000   |    NULL      |  NULL   (no previous day)
Mar 02  |  1200   |    1000      |  +200
Mar 03  |   900   |    1200      |  -300
\`\`\`

The first row's LAG is NULL — nothing before it. Expected; handle it.

## Running totals: SUM with ORDER BY
\`SUM(x) OVER (ORDER BY day)\` isn't a grand total. With ORDER BY, the window means "start through this row" — a running total:

\`\`\`
day     | revenue | running_total
Mar 01  |  1000   |   1000
Mar 02  |  1200   |   2200
Mar 03  |   900   |   3100
\`\`\`

## Moving average: an explicit frame
"Average of the last 7 days" — spell out the frame:

\`\`\`sql
AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
\`\`\`
This row plus the 6 before it = a 7-row window that slides down.

## Percent of total: an empty OVER()
\`x / SUM(x) OVER ()\` — empty \`OVER ()\` sees every row, giving the grand total as denominator. No self-join.

## The habit that prevents wrong answers
Before any window, say three things: **partition** (which group?), **order** (what sequence?), **frame** (how many rows?). Most wrong answers are a missing PARTITION BY or an unintended default frame.`,
  problems: [
    {
      id: "o1", title: "Days between a user's plays", difficulty: 3, schema: "wavely",
      prompt: "For user 1's distinct play dates, return `played_on` and `days_since_prev` (difference in days from the previous distinct date; NULL for the first). Order by date.",
      hint: "DISTINCT dates in a CTE, then played_on - LAG(played_on) OVER (ORDER BY played_on).",
      solution: `WITH d AS (SELECT DISTINCT played_on FROM plays WHERE user_id = 1)
SELECT played_on, played_on - LAG(played_on) OVER (ORDER BY played_on) AS days_since_prev
FROM d ORDER BY played_on`,
      orderSensitive: true,
    },
    {
      id: "o2", title: "Daily revenue with running total", difficulty: 3, schema: "brightmart",
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
      id: "o3", title: "7-day moving average of revenue", difficulty: 4, schema: "brightmart",
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
      id: "o4", title: "Genre share of total listening", difficulty: 3, schema: "wavely",
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
      id: "o5", title: "Month-over-month revenue growth", difficulty: 4, schema: "brightmart",
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
      id: "o6", title: "Each user's active span", difficulty: 4, schema: "wavely",
      prompt: "For each user with 2+ plays: `user_id`, `active_span_days` (days between first and last play date), `n_plays`. Order by span descending, then user_id.",
      hint: "MIN/MAX of played_on per user; subtracting dates yields integer days.",
      solution: `SELECT user_id, MAX(played_on) - MIN(played_on) AS active_span_days, COUNT(*) AS n_plays
FROM plays GROUP BY user_id HAVING COUNT(*) >= 2
ORDER BY active_span_days DESC, user_id`,
      orderSensitive: true,
    },
  ],
};
