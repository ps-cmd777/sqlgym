/** Modules: filtering/grouping, joins, subqueries. All original content. */

import type { Module } from "./types";

export const foundations: Module = {
  id: "foundations",
  title: "Aggregation & filtering", track: "core",
  blurb: "WHERE, COUNT, GROUP BY — plus the empty-value (NULL) surprises that trip everyone up.",
  theory: `## From listing rows to summarizing them
So far you've *listed* rows. Now you'll *summarize* — total, count, average. Think of the pivot-table feature in a spreadsheet: it turns many rows into a few summary rows.

## GROUP BY = one summary row per category
"How many users per country?" Group the rows by country, then count each group:

\`\`\`
users                          result
country          ->            country | n
US                             US      | 2
DE                             DE      | 1
US
\`\`\`

\`\`\`sql
SELECT country, COUNT(*) AS n
FROM users
GROUP BY country;
\`\`\`
\`SUM\`, \`AVG\`, \`MIN\`, \`MAX\` work the same way — one number per group.

## WHERE vs HAVING — filter rows, or filter groups?
This trips everyone. A query runs in a fixed order:

1. \`WHERE\` throws away **rows** — before grouping.
2. \`GROUP BY\` collapses what's left into groups.
3. \`HAVING\` throws away whole **groups** — after counting.

So "countries with at least 5 users" is a \`HAVING\` question — you can't know a country's count until after the grouping happens:

\`\`\`sql
SELECT country, COUNT(*) AS n
FROM users
GROUP BY country
HAVING COUNT(*) >= 5;
\`\`\`

## NULL = a blank cell
\`NULL\` means "no value here" — a blank cell. It is not zero, not empty text, and it behaves oddly:

- \`WHERE status != 'cancelled'\` **drops** rows where status is NULL. SQL can't confirm blank ≠ 'cancelled', so it excludes them. Want blanks kept? Say \`status IS DISTINCT FROM 'cancelled'\`.
- \`COUNT(*)\` counts rows; \`COUNT(referred_by)\` counts only rows where that cell is filled in. Two different questions.
- \`AVG(score)\` ignores blanks — it divides by the filled-in count, not all rows.

Rule of thumb: if a result has mysteriously few rows, suspect a NULL meeting \`!=\` or \`NOT IN\`.

## The GROUP BY rule
Every column you SELECT must be either inside an aggregate (\`COUNT\`/\`SUM\`/…) or listed in \`GROUP BY\`. Otherwise the database won't know which row's value to show for the group.`,
  problems: [
    {
      id: "f1", title: "German users by signup date", difficulty: 1, schema: "wavely",
      takeaway:
        "`WHERE` runs before `ORDER BY`, so filtering happens first and sorting only ever touches the rows that survived.",
      prompt: "List the `username` and `signup_date` of users from Germany ('DE'), earliest signup first. Return exactly those two columns in that order.",
      hint: "WHERE on country, ORDER BY signup_date ascending.",
      solution: "SELECT username, signup_date FROM users WHERE country = 'DE' ORDER BY signup_date",
      orderSensitive: true,
    },
    {
      id: "f2", title: "Total users vs referred users", difficulty: 2, schema: "wavely",
      takeaway:
        "Counting rows and counting a column give different answers whenever the column has NULLs, and the gap is the number of missing values.",
      prompt: "Return one row with two columns: `total_users` (all users) and `referred_users` (users whose `referred_by` is not NULL).",
      hint: "COUNT(col) skips NULLs — you don't need a WHERE or a CASE.",
      solution: "SELECT COUNT(*) AS total_users, COUNT(referred_by) AS referred_users FROM users",
    },
    {
      id: "f3", title: "Count non-cancelled orders (NULL-safe)", difficulty: 2, schema: "brightmart",
      takeaway:
        "Filtering on a column that contains NULLs needs `IS NULL` or `IS NOT NULL`; `= NULL` and `<> NULL` both yield unknown and keep nothing.",
      prompt: "Count orders whose status is anything other than 'cancelled'. (Careful: what would happen if status could be NULL? Write it NULL-safely with IS DISTINCT FROM.) Return one column `n`.",
      hint: "status IS DISTINCT FROM 'cancelled' treats NULL as \"different\", unlike !=.",
      solution: "SELECT COUNT(*) AS n FROM orders WHERE status IS DISTINCT FROM 'cancelled'",
    },
    {
      id: "f4", title: "Countries with 5 or more users", difficulty: 2, schema: "wavely",
      takeaway:
        "`HAVING COUNT(*) >= 5` filters the groups, not the rows. You cannot put that condition in `WHERE`, because at that point the groups do not exist yet.",
      prompt: "For each country with at least 5 users, return `country` and `n_users`, most users first; break ties by country alphabetically.",
      hint: "GROUP BY + HAVING COUNT(*) >= 5, then ORDER BY count DESC, country.",
      solution: "SELECT country, COUNT(*) AS n_users FROM users GROUP BY country HAVING COUNT(*) >= 5 ORDER BY n_users DESC, country",
      orderSensitive: true,
    },
    {
      id: "f5", title: "Total units sold and revenue", difficulty: 3, schema: "brightmart",
      takeaway:
        "Multiply before you sum. `SUM(quantity * unit_price)` is per-line revenue totalled; `SUM(quantity) * SUM(unit_price)` is a meaningless number that looks plausible.",
      prompt: "Across all order items, return the total units sold (`units`) and total gross revenue (`revenue`, quantity × unit_price, rounded to 2 decimals). One row.",
      hint: "SUM(quantity) and SUM(quantity * unit_price); ROUND(x::numeric, 2).",
      solution: "SELECT SUM(quantity) AS units, ROUND(SUM(quantity * unit_price)::numeric, 2) AS revenue FROM order_items",
      interview: true,
    },
    {
      id: "f6", title: "Active users in March 2025", difficulty: 3, schema: "wavely",
      takeaway:
        "A date range is safest written as `>= start AND < day_after_end`. It behaves correctly whether the column holds a date or a timestamp.",
      prompt: "How many distinct users played at least one track in March 2025? Return one column `active_users`.",
      hint: "COUNT(DISTINCT user_id) with a date range on played_on.",
      solution: "SELECT COUNT(DISTINCT user_id) AS active_users FROM plays WHERE played_on >= '2025-03-01' AND played_on < '2025-04-01'",
      interview: true,
    },
  ],
};

export const joins: Module = {
  id: "joins",
  title: "Joins", track: "core",
  blurb: "Your data lives in separate tables. JOIN is how you glue them together — and here's how it silently goes wrong.",
  theory: `## Why joins exist
Real databases split information across tables so nothing is stored twice. Customers live in one table, their orders in another:

\`\`\`
customers                    orders
customer_id | name           order_id | customer_id | status
1           | Rosa           101      | 1           | completed
2           | Liam           102      | 1           | completed
3           | Mira           103      | 2           | cancelled
\`\`\`

To answer "which customer placed which order?" you need both tables at once. That's a JOIN: match rows from two tables through a shared column (here, customer_id).

## INNER JOIN: keep only matches
\`\`\`sql
SELECT o.order_id, c.name
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id;
\`\`\`
Result: 3 rows — each order paired with its customer's name. Notice **Mira disappears**: she has no orders, nothing to match. INNER JOIN keeps only rows that find a partner.

## LEFT JOIN: keep everyone on the left
Ask "show ALL customers, with their orders if any" and you need LEFT JOIN — every left-table row survives, and where there's no match the right side becomes NULL:

\`\`\`
name  | order_id
Rosa  | 101
Rosa  | 102
Liam  | 103
Mira  | NULL      <- kept, with an empty right side
\`\`\`

That NULL row is useful: \`WHERE order_id IS NULL\` finds exactly the customers who never ordered. (This "find the ones WITHOUT a match" move is called an anti-join in interviews.)

## The bug that ruins revenue numbers
Look at Rosa above: she appears TWICE — once per order. A join produces one row per match, so joins can *multiply* rows. Now imagine each order has 3 items and you join orders to items: every order row repeats 3 times. If you then SUM the order's shipping fee, **you count it three times**. This multiplication is nicknamed *fan-out*, and it's the #1 way real dashboards end up showing revenue that is too high.

The fix: total up the "many" side FIRST (one row per order), then join. Whenever a number looks too big after a join, suspect fan-out.

## One more trap: WHERE undoes LEFT JOIN
If you LEFT JOIN orders and then write \`WHERE o.status = 'completed'\`, the NULL rows fail that filter and vanish — your LEFT JOIN silently became an INNER JOIN. Conditions about the right-hand table belong in the \`ON\` clause instead.`,
  problems: [
    {
      id: "j1", title: "Orders with customer names", difficulty: 1, schema: "brightmart",
      takeaway:
        "An inner `JOIN` keeps only rows that match on both sides. Any order without a customer, or customer without an order, silently disappears. That silence is the most common source of a wrong number.",
      prompt: "List each completed order's `order_id`, `ordered_on`, and the customer's `name`. Columns in that order.",
      hint: "INNER JOIN customers ON customer_id; filter status = 'completed'.",
      solution: "SELECT o.order_id, o.ordered_on, c.name FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'completed'",
    },
    {
      id: "j2", title: "Customers who never ordered", difficulty: 2, schema: "brightmart",
      takeaway:
        "The anti-join pattern: `LEFT JOIN` then `WHERE right.id IS NULL` keeps exactly the rows that found no match. Read it as 'try to match, then keep the failures'.",
      prompt: "Return the `name` of every customer with no orders at all (any status), alphabetically.",
      hint: "LEFT JOIN orders and keep WHERE order_id IS NULL — or NOT EXISTS.",
      solution: "SELECT c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id) ORDER BY c.name",
      orderSensitive: true, interview: true,
    },
    {
      id: "j3", title: "Who referred whom", difficulty: 2, schema: "wavely",
      takeaway:
        "A self-join is just the same table twice under two aliases. The aliases are what make it work, because otherwise the database cannot tell which copy you mean.",
      prompt: "For every referred user, return `referred` (their username) and `referrer` (the username of who referred them).",
      hint: "Join users to itself: u.referred_by = r.user_id.",
      solution: "SELECT u.username AS referred, r.username AS referrer FROM users u JOIN users r ON r.user_id = u.referred_by",
    },
    {
      id: "j4", title: "Completed orders per customer (including zero)", difficulty: 3, schema: "brightmart",
      takeaway:
        "`COUNT(*)` after a `LEFT JOIN` counts the row the join invented for non-matches, so everyone scores at least 1. `COUNT(other_table.id)` counts real matches and correctly gives 0.",
      prompt: "For EVERY customer, return `name` and `completed_orders` (count of their completed orders — 0 if none). Don't lose customers without orders.",
      hint: "LEFT JOIN with the status condition in ON, not WHERE; COUNT(o.order_id).",
      solution: "SELECT c.name, COUNT(o.order_id) AS completed_orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed' GROUP BY c.name",
      interview: true,
    },
    {
      id: "j5", title: "Order value and refund without double-counting", difficulty: 4, schema: "brightmart",
      takeaway:
        "Joining two child tables to the same parent multiplies their rows together, and your totals inflate. Aggregate each child separately first, then join the summaries.",
      prompt: "For each completed order return `order_id`, `items_value` (sum of quantity × unit_price) and the order's single `refund_amount` (NULL if never refunded; an order has at most one refund). Beware: joining items and refunds together multiplies rows.",
      hint: "Aggregate order_items in a subquery first, then LEFT JOIN refunds to the result.",
      solution: `SELECT o.order_id, iv.items_value, r.amount AS refund_amount
FROM orders o
JOIN (SELECT order_id, SUM(quantity * unit_price) AS items_value FROM order_items GROUP BY order_id) iv
  ON iv.order_id = o.order_id
LEFT JOIN refunds r ON r.order_id = o.order_id
WHERE o.status = 'completed'`,
      interview: true,
    },
    {
      id: "j6", title: "Same-day multi-genre listeners", difficulty: 4, schema: "wavely",
      takeaway:
        "`HAVING` filters groups after aggregation; `WHERE` filters rows before it. If your condition mentions `COUNT` or `SUM`, it belongs in `HAVING`.",
      prompt: "Return `user_id` for users who, on at least one single day, played tracks from 2 or more different genres. Each user once.",
      hint: "Join plays→tracks, GROUP BY user_id, played_on, HAVING COUNT(DISTINCT genre) >= 2, then DISTINCT user_id.",
      solution: `SELECT DISTINCT user_id FROM (
  SELECT p.user_id, p.played_on
  FROM plays p JOIN tracks t ON t.track_id = p.track_id
  GROUP BY p.user_id, p.played_on
  HAVING COUNT(DISTINCT t.genre) >= 2
) d`,
      interview: true,
    },
  ],
};

export const subqueries: Module = {
  id: "subqueries",
  title: "Subqueries & set operations", track: "core",
  blurb: "Use one query's answer inside another: compare to averages, check \"does this exist?\", combine result lists.",
  theory: `## The idea: a query's answer, used inside another query
Sometimes the filter you need isn't a fixed number — it's itself the answer to a question. "Which products cost more than **the average price**?" You can't type the average; it has to be computed. So you put a small query inside the big one:

\`\`\`sql
SELECT product_name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products);
\`\`\`

The inner query runs first and produces one number (say, 94.20); the outer query then behaves as if you'd written \`WHERE price > 94.20\`. That's a subquery. Three ways to use them:

## Use 1 — as a single value
Like the average above. Anywhere a number or a piece of text could go, a one-value subquery can go.

## Use 2 — as a yes/no check per row: EXISTS
"Which users have at least one subscription?" For each user, peek into the subscriptions table and ask: is there anything here for this person?

\`\`\`sql
SELECT username FROM users u
WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.user_id);
\`\`\`

Read it as: *keep this user if the inner search finds anything.* The inner query mentions the current outer row (u.user_id), so it conceptually runs once per user.

## Use 3 — as a list: IN
\`WHERE country IN ('ES', 'IT')\` you know; the list can also come from a query: \`WHERE country IN (SELECT country FROM offices)\`.

**The famous trap:** the negative version, \`NOT IN\`, breaks if the inner list contains even one NULL — SQL can't be *sure* your value differs from "unknown", so it returns **no rows at all**, silently. The safe way to say "has none" is \`NOT EXISTS\`. Interviewers ask this deliberately; knowing it marks you as someone who has met real data.

## Combining whole result lists
Separately, SQL can combine the results of two complete queries:

- \`UNION\` — rows in either result (duplicates removed; \`UNION ALL\` keeps duplicates and is faster)
- \`INTERSECT\` — only rows in BOTH results ("users who played jazz AND rock")
- \`EXCEPT\` — rows in the first result but not the second ("active in February, silent in March" — churn in one line)

Both sides must return the same number and types of columns — you're stacking two lists of the same shape.`,
  problems: [
    {
      id: "s1", title: "Products priced above average", difficulty: 2, schema: "brightmart",
      takeaway:
        "A scalar subquery returns one value, so it can sit anywhere a value can, including the right side of `>`. It is evaluated once, not per row.",
      prompt: "Return `product_name` and `price` of products priced strictly above the overall average price.",
      hint: "Compare to a scalar subquery: (SELECT AVG(price) FROM products).",
      solution: "SELECT product_name, price FROM products WHERE price > (SELECT AVG(price) FROM products)",
    },
    {
      id: "s2", title: "Users with any subscription", difficulty: 2, schema: "wavely",
      takeaway:
        "`EXISTS` stops at the first match it finds, so it does not care how many rows the subquery could return. That makes it the right tool for 'is there at least one'.",
      prompt: "Return the `username` of users who have at least one subscription (any plan, past or present).",
      hint: "WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.user_id).",
      solution: "SELECT u.username FROM users u WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.user_id)",
    },
    {
      id: "s3", title: "Users who never played track 1", difficulty: 3, schema: "wavely",
      takeaway:
        "`NOT EXISTS` is safe when the subquery may produce NULLs, where `NOT IN` would return nothing at all. Prefer it by default and you avoid the trap entirely.",
      prompt: "Return the `username` of users who never played track 1. Note `referred_by` contains NULLs elsewhere in this schema — write the membership test the NULL-safe way.",
      hint: "NOT EXISTS with a correlated subquery on plays filtered to track_id = 1.",
      solution: "SELECT u.username FROM users u WHERE NOT EXISTS (SELECT 1 FROM plays p WHERE p.user_id = u.user_id AND p.track_id = 1)",
      interview: true,
    },
    {
      id: "s4", title: "Customers who outspend their country average", difficulty: 4, schema: "brightmart",
      takeaway:
        "A correlated subquery mentions the outer row, so it runs once per row. It reads well and is the clearest way to express 'compared to their own group'.",
      prompt: "A customer's spend is the total quantity × unit_price across their completed orders. Return `customer_id` and `spend` (2 decimals) for customers whose spend is strictly greater than the average spend of customers in the same country (average computed over customers who have spend).",
      hint: "Build per-customer spend in a CTE with country; then a correlated subquery per country.",
      solution: `WITH spend AS (
  SELECT c.customer_id, c.country, SUM(i.quantity * i.unit_price) AS s
  FROM customers c
  JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
  JOIN order_items i ON i.order_id = o.order_id
  GROUP BY c.customer_id, c.country
)
SELECT customer_id, ROUND(s::numeric, 2) AS spend
FROM spend a
WHERE s > (SELECT AVG(s) FROM spend b WHERE b.country = a.country)`,
      interview: true,
    },
    {
      id: "s5", title: "Users who played both jazz and rock", difficulty: 3, schema: "wavely",
      takeaway:
        "`INTERSECT` keeps rows present in both result sets and removes duplicates as it goes. It is often clearer than joining a table to itself twice.",
      prompt: "Return the `user_id` of users who played at least one 'jazz' track AND at least one 'rock' track (any time).",
      hint: "Two SELECT DISTINCT user_id queries joined with INTERSECT.",
      solution: `SELECT p.user_id FROM plays p JOIN tracks t ON t.track_id = p.track_id WHERE t.genre = 'jazz'
INTERSECT
SELECT p.user_id FROM plays p JOIN tracks t ON t.track_id = p.track_id WHERE t.genre = 'rock'`,
      interview: true,
    },
    {
      id: "s6", title: "Active in February, gone in March", difficulty: 3, schema: "wavely",
      takeaway:
        "`EXCEPT` gives rows in the first result that are not in the second, which is set subtraction. Order matters: swapping the two queries answers a different question.",
      prompt: "Return `user_id` of users who played something in February 2025 but nothing in March 2025.",
      hint: "February players EXCEPT March players.",
      solution: `SELECT DISTINCT user_id FROM plays WHERE played_on >= '2025-02-01' AND played_on < '2025-03-01'
EXCEPT
SELECT DISTINCT user_id FROM plays WHERE played_on >= '2025-03-01' AND played_on < '2025-04-01'`,
      interview: true,
    },
  ],
};
