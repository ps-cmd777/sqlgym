/** Advanced grouping: FILTER, GROUPING SETS, ROLLUP, CUBE. */

import type { Module } from "./types";

export const groupingAdvanced: Module = {
  id: "grouping-advanced",
  title: "Subtotals and conditional counts", track: "interview",
  blurb: "Count different things in one pass with FILTER, and get subtotals and grand totals without UNION-ing queries together.",
  theory: `## The problem: one pass, several questions
You want completed orders **and** cancelled orders **and** the total, side by side. The beginner move is three queries stitched with UNION. There are two better tools.

## FILTER — count a subset inside an aggregate
\`FILTER (WHERE ...)\` applies a condition to one aggregate only.

\`\`\`sql
SELECT COUNT(*) AS all_orders,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders;
\`\`\`

The older way is \`SUM(CASE WHEN ... THEN 1 ELSE 0 END)\`, which does the same job with more noise. Both are worth recognising; FILTER reads better.

## GROUPING SETS — several groupings in one query
Normally \`GROUP BY a, b\` gives you one level of detail. \`GROUPING SETS\` lets you ask for several at once.

\`\`\`sql
SELECT country, plan, COUNT(*)
FROM subscriptions
GROUP BY GROUPING SETS ((country, plan), (country), ());
\`\`\`

That returns per country-and-plan rows, per-country subtotal rows, and one grand-total row, in a single result.

## ROLLUP and CUBE are shorthands
- \`ROLLUP(a, b)\` = \`(a,b), (a), ()\`. A hierarchy: detail, subtotal, grand total.
- \`CUBE(a, b)\` = every combination: \`(a,b), (a), (b), ()\`.

\`\`\`sql
SELECT category, COUNT(*) FROM products GROUP BY ROLLUP(category);
\`\`\`

## Telling a subtotal from a real NULL
In subtotal rows the grouped column comes back NULL, which is ambiguous if the data also contains NULLs. \`GROUPING(col)\` returns 1 when the NULL is there because of the subtotal, 0 when it is real data.

\`\`\`sql
SELECT COALESCE(category, 'ALL') AS category,
       GROUPING(category) AS is_total,
       COUNT(*)
FROM products
GROUP BY ROLLUP(category);
\`\`\``,
  problems: [
    {
      id: "ga1", title: "Completed and cancelled in one row", difficulty: 3, schema: "brightmart",
      prompt:
        "Return one row with `all_orders`, `completed`, and `cancelled` counts from the orders table. Use a single pass over the table.",
      hint: "COUNT(*) FILTER (WHERE ...) for the two subsets.",
      solution: `SELECT COUNT(*) AS all_orders,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders`,
      interview: true,
    },
    {
      id: "ga2", title: "Plan mix per country, one pass", difficulty: 3, schema: "wavely",
      prompt:
        "For each `country`, return `country`, `total` (all subscriptions for users in that country), `free_count`, and `paid_count` (plan is not 'free'). Order by `country`.",
      hint: "Join subscriptions to users, then FILTER each aggregate.",
      solution: `SELECT u.country,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE s.plan = 'free') AS free_count,
       COUNT(*) FILTER (WHERE s.plan <> 'free') AS paid_count
FROM subscriptions s
JOIN users u ON u.user_id = s.user_id
GROUP BY u.country
ORDER BY u.country`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ga3", title: "Category totals with a grand total", difficulty: 4, schema: "brightmart",
      prompt:
        "Return `category` and `product_count` for every product category, plus one final row holding the grand total where `category` shows the text `ALL`. Order so that the real categories come first alphabetically and the total row is last.",
      hint: "GROUP BY ROLLUP(category), COALESCE the NULL to 'ALL', and order by GROUPING(category).",
      solution: `SELECT COALESCE(category, 'ALL') AS category, COUNT(*) AS product_count
FROM products
GROUP BY ROLLUP(category)
ORDER BY GROUPING(category), category`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ga4", title: "Detail, subtotal and total together", difficulty: 4, schema: "wavely",
      prompt:
        "Using GROUPING SETS, return `country`, `plan` and `subs` counting subscriptions at three levels: per country and plan, per country, and overall. Show `ALL` in place of NULL for both label columns. Order by country then plan, with subtotal and total rows after their detail rows.",
      hint: "GROUPING SETS ((country, plan), (country), ()), then order by GROUPING(country), country, GROUPING(plan), plan.",
      solution: `SELECT COALESCE(u.country, 'ALL') AS country,
       COALESCE(s.plan, 'ALL') AS plan,
       COUNT(*) AS subs
FROM subscriptions s
JOIN users u ON u.user_id = s.user_id
GROUP BY GROUPING SETS ((u.country, s.plan), (u.country), ())
ORDER BY GROUPING(u.country), u.country, GROUPING(s.plan), s.plan`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ga5", title: "Label which rows are totals", difficulty: 4, schema: "brightmart",
      prompt:
        "Return `country`, `is_total` (1 when the row is the grand total, otherwise 0) and `customers` counting customers, using ROLLUP over country. Order by `is_total`, then `country`.",
      hint: "GROUPING(country) gives you the flag.",
      solution: `SELECT COALESCE(country, 'ALL') AS country,
       GROUPING(country) AS is_total,
       COUNT(*) AS customers
FROM customers
GROUP BY ROLLUP(country)
ORDER BY GROUPING(country), country`,
      orderSensitive: true,
    },
    {
      id: "ga6", title: "Every combination with CUBE", difficulty: 4, schema: "brightmart",
      prompt:
        "Using CUBE over `category` and order `status`, return `category`, `status` and `items` counting order-item rows, with `ALL` replacing NULL in both labels. Order by category then status, totals last within each level.",
      hint: "Join order_items to products and orders, then GROUP BY CUBE(p.category, o.status).",
      solution: `SELECT COALESCE(p.category, 'ALL') AS category,
       COALESCE(o.status, 'ALL') AS status,
       COUNT(*) AS items
FROM order_items oi
JOIN products p ON p.product_id = oi.product_id
JOIN orders o ON o.order_id = oi.order_id
GROUP BY CUBE(p.category, o.status)
ORDER BY GROUPING(p.category), p.category, GROUPING(o.status), o.status`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ga7", title: "Distinct listeners and plays per genre", difficulty: 3, schema: "wavely",
      prompt:
        "For each track `genre`, return `genre`, `plays` (number of play rows) and `listeners` (number of distinct users). Order by `plays` descending, then `genre`.",
      hint: "COUNT(*) versus COUNT(DISTINCT user_id).",
      solution: `SELECT t.genre, COUNT(*) AS plays, COUNT(DISTINCT p.user_id) AS listeners
FROM plays p
JOIN tracks t ON t.track_id = p.track_id
GROUP BY t.genre
ORDER BY plays DESC, t.genre`,
      orderSensitive: true,
    },
    {
      id: "ga8", title: "Long plays only, per genre", difficulty: 3, schema: "wavely",
      prompt:
        "For each `genre`, return `genre`, `plays` (all plays) and `long_plays` (plays where `seconds_played` is at least 120). Keep only genres with at least one long play. Order by `genre`.",
      hint: "FILTER inside the aggregate, then HAVING on that aggregate.",
      solution: `SELECT t.genre,
       COUNT(*) AS plays,
       COUNT(*) FILTER (WHERE p.seconds_played >= 120) AS long_plays
FROM plays p
JOIN tracks t ON t.track_id = p.track_id
GROUP BY t.genre
HAVING COUNT(*) FILTER (WHERE p.seconds_played >= 120) > 0
ORDER BY t.genre`,
      orderSensitive: true,
    },
  ],
};
