/** NULL semantics — the single most common source of silently wrong answers. */

import type { Module } from "./types";

export const nulls: Module = {
  id: "nulls",
  title: "NULL and the three-valued trap", track: "core",
  blurb: "NULL is not zero and not empty — it means unknown. That one idea quietly breaks counts, joins, and NOT IN.",
  theory: `## NULL means "we don't know"
Most people read NULL as "empty" or "zero". SQL reads it as **unknown**, and that changes the arithmetic of truth.

Think of a form where someone left a box blank. You cannot say the box equals zero. You cannot say it equals anything. You genuinely do not know.

\`\`\`
users
user_id | username | referred_by
1       | ana      | NULL        <- nobody referred her? or we lost the record?
2       | boris    | 1
\`\`\`

## Comparisons with NULL are never true
This is the rule everything else follows from.

\`\`\`sql
SELECT NULL = NULL;   -- NULL, not true
SELECT NULL <> 5;     -- NULL, not true
\`\`\`

Unknown compared to anything is still unknown. So you cannot use \`=\` to find NULLs. You need \`IS NULL\`.

\`\`\`sql
SELECT * FROM users WHERE referred_by IS NULL;      -- correct
SELECT * FROM users WHERE referred_by = NULL;       -- returns nothing, ever
\`\`\`

## WHERE keeps only true rows
A row survives \`WHERE\` only when the condition is **true**. Unknown is not true, so the row is dropped. That is why a filter can silently lose rows you expected to keep.

## COUNT(*) and COUNT(col) are different questions
- \`COUNT(*)\` counts rows.
- \`COUNT(referred_by)\` counts rows where that column **is not NULL**.

That difference is a free way to count "how many have a value".

\`\`\`sql
SELECT COUNT(*) AS everyone,
       COUNT(referred_by) AS were_referred
FROM users;
\`\`\`

Other aggregates skip NULLs too. \`AVG(x)\` divides by the number of non-NULL values, not by the row count.

## The NOT IN trap
This one costs people interviews.

\`\`\`sql
-- if ANY value in the list is NULL, this returns NOTHING
SELECT * FROM users WHERE user_id NOT IN (SELECT referred_by FROM users);
\`\`\`

Because \`user_id NOT IN (1, 2, NULL)\` asks "is it different from 1, and from 2, and from unknown?" The last part is unknown, so the whole thing is unknown, so no row survives.

Use \`NOT EXISTS\`, or filter the NULLs out of the subquery.

## Tools for handling it
- \`COALESCE(a, b)\` — first value that is not NULL. Good for defaults.
- \`NULLIF(a, b)\` — NULL when a equals b. The standard way to dodge divide-by-zero.
- \`x IS DISTINCT FROM y\` — like \`<>\` but treats NULL as a comparable value.
- \`ORDER BY col NULLS LAST\` — Postgres sorts NULLs first on DESC by default, which is rarely what you want.`,
  problems: [
    {
      id: "n1", title: "Users nobody referred", difficulty: 1, schema: "wavely",
      prompt: "Return the `username` of every user whose `referred_by` is empty, ordered by `username`.",
      hint: "IS NULL, not = NULL.",
      solution: "SELECT username FROM users WHERE referred_by IS NULL ORDER BY username",
      orderSensitive: true,
    },
    {
      id: "n2", title: "How many were referred", difficulty: 2, schema: "wavely",
      prompt: "Return one row with `total_users` (every user) and `referred_users` (users that have a `referred_by` value). Use the difference between counting rows and counting a column.",
      hint: "COUNT(*) counts rows; COUNT(col) skips NULLs.",
      solution: "SELECT COUNT(*) AS total_users, COUNT(referred_by) AS referred_users FROM users",
    },
    {
      id: "n3", title: "The NOT IN trap", difficulty: 4, schema: "wavely",
      prompt: "Return the `username` of users who have never referred anyone, ordered by `username`. Careful: the referrer column contains NULLs, so a naive NOT IN returns nothing.",
      hint: "NOT EXISTS, or filter NULLs out of the subquery first.",
      solution:
        "SELECT u.username FROM users u WHERE NOT EXISTS (SELECT 1 FROM users r WHERE r.referred_by = u.user_id) ORDER BY u.username",
      orderSensitive: true, interview: true,
    },
    {
      id: "n4", title: "Show a referrer or 'organic'", difficulty: 2, schema: "wavely",
      prompt: "Return `username` and a column `source` that shows the `referred_by` id as text, or the word `organic` when there is no referrer. Order by `username`.",
      hint: "COALESCE with a cast to text.",
      solution:
        "SELECT username, COALESCE(referred_by::text, 'organic') AS source FROM users ORDER BY username",
      orderSensitive: true,
    },
    {
      id: "n5", title: "Refund rate without dividing by zero", difficulty: 3, schema: "brightmart",
      prompt:
        "For each product `category`, return `category` and `refund_rate`: total refunded amount divided by total order-item revenue, rounded to 3 decimals. Categories with zero revenue must show NULL rather than causing an error. Order by `category`.",
      hint: "NULLIF(denominator, 0) turns 0 into NULL, and dividing by NULL gives NULL.",
      solution: `SELECT p.category,
       ROUND(COALESCE(SUM(r.amount), 0) / NULLIF(SUM(oi.quantity * oi.unit_price), 0), 3) AS refund_rate
FROM products p
JOIN order_items oi ON oi.product_id = p.product_id
LEFT JOIN refunds r ON r.order_id = oi.order_id
GROUP BY p.category
ORDER BY p.category`,
      orderSensitive: true, interview: true,
    },
    {
      id: "n6", title: "Compare values where NULL counts as a value", difficulty: 3, schema: "wavely",
      prompt:
        "Return `user_id` and `username` for users whose `referred_by` is different from user 1, treating a missing referrer as genuinely different rather than unknown. Order by `user_id`.",
      hint: "IS DISTINCT FROM handles NULL the way you would expect <> to.",
      solution:
        "SELECT user_id, username FROM users WHERE referred_by IS DISTINCT FROM 1 ORDER BY user_id",
      orderSensitive: true,
    },
    {
      id: "n7", title: "Sort with the unknowns at the bottom", difficulty: 2, schema: "wavely",
      prompt:
        "Return `username` and `referred_by` for all users, ordered by `referred_by` descending, with users who have no referrer listed last. Break ties by `username` ascending.",
      hint: "ORDER BY col DESC NULLS LAST.",
      solution:
        "SELECT username, referred_by FROM users ORDER BY referred_by DESC NULLS LAST, username",
      orderSensitive: true,
    },
    {
      id: "n8", title: "Average that ignores the blanks", difficulty: 3, schema: "wavely",
      prompt:
        "Return one row with `rows_total` (all subscription rows), `avg_price_all` (average of `monthly_price` rounded to 2 decimals) and `cancelled_count` (subscriptions that have a `cancelled_on` date). Show that the average is computed over non-NULL values only.",
      hint: "AVG skips NULLs; COUNT(cancelled_on) counts only the ones that are set.",
      solution: `SELECT COUNT(*) AS rows_total,
       ROUND(AVG(monthly_price), 2) AS avg_price_all,
       COUNT(cancelled_on) AS cancelled_count
FROM subscriptions`,
    },
  ],
};
