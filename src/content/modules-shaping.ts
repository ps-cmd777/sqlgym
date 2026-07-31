/** Reshaping results: pivots, arrays, JSON, and pattern matching on text. */

import type { Module } from "./types";

export const pivots: Module = {
  id: "pivots",
  title: "Pivoting and reshaping", track: "advanced",
  blurb: "Turn rows into columns for a report, and columns back into rows. The shape the question needs is rarely the shape the table has.",
  theory: `## Long versus wide
The same numbers can sit two ways.

\`\`\`
LONG (how databases store it)      WIDE (what a report wants)
country | plan    | subs           country | free | plus | premium
US      | free    | 12             US      | 12   | 7    | 3
US      | plus    | 7              DE      | 9    | 4    | 2
US      | premium | 3
\`\`\`

Long is better for storing and querying. Wide is better for reading. Moving between them is a daily task.

## Long to wide: conditional aggregation
There is no PIVOT keyword in standard Postgres. You do it with one aggregate per output column.

\`\`\`sql
SELECT country,
       COUNT(*) FILTER (WHERE plan = 'free')    AS free,
       COUNT(*) FILTER (WHERE plan = 'plus')    AS plus,
       COUNT(*) FILTER (WHERE plan = 'premium') AS premium
FROM subscriptions s JOIN users u USING (user_id)
GROUP BY country;
\`\`\`

The catch: you must know the columns in advance. A pivot cannot invent columns from data at runtime.

## Wide to long: unnest a list of pairs
Going back the other way, you produce one row per column you want to unfold.

\`\`\`sql
SELECT product_id, metric, value
FROM products,
LATERAL (VALUES ('price', price), ('id', product_id::numeric)) AS v(metric, value);
\`\`\`

## Collapsing rows into one cell
Sometimes the report wants a list, not rows.

\`\`\`sql
SELECT genre, STRING_AGG(title, ', ' ORDER BY title) AS titles
FROM tracks GROUP BY genre;
\`\`\`

\`ARRAY_AGG\` does the same into a real array, which keeps the values separate instead of gluing them into text.`,
  problems: [
    {
      id: "pv1", title: "Plan mix as columns", difficulty: 3, schema: "wavely",
      prompt:
        "Return one row per `country` with columns `free`, `plus` and `premium` counting subscriptions on each plan for users in that country. Order by `country`.",
      hint: "COUNT(*) FILTER (WHERE plan = ...) once per column.",
      solution: `SELECT u.country,
       COUNT(*) FILTER (WHERE s.plan = 'free') AS free,
       COUNT(*) FILTER (WHERE s.plan = 'plus') AS plus,
       COUNT(*) FILTER (WHERE s.plan = 'premium') AS premium
FROM subscriptions s
JOIN users u ON u.user_id = s.user_id
GROUP BY u.country
ORDER BY u.country`,
      orderSensitive: true, interview: true,
    },
    {
      id: "pv2", title: "Order status as columns", difficulty: 3, schema: "brightmart",
      prompt:
        "Return one row per `country` (of the customer) with `completed` and `cancelled` counting orders in each status. Order by `country`.",
      hint: "Join orders to customers, then one FILTER per status.",
      solution: `SELECT c.country,
       COUNT(*) FILTER (WHERE o.status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancelled
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
GROUP BY c.country
ORDER BY c.country`,
      orderSensitive: true,
    },
    {
      id: "pv3", title: "Genres as one list per artist", difficulty: 3, schema: "wavely",
      prompt:
        "For each `artist`, return `artist` and `genres`: their distinct genres joined into one comma-and-space separated string, alphabetically. Order by `artist`.",
      hint: "STRING_AGG(DISTINCT genre, ', ' ORDER BY genre).",
      solution: `SELECT artist, STRING_AGG(DISTINCT genre, ', ' ORDER BY genre) AS genres
FROM tracks
GROUP BY artist
ORDER BY artist`,
      orderSensitive: true,
    },
    {
      id: "pv4", title: "Products per category as an array", difficulty: 3, schema: "brightmart",
      prompt:
        "For each `category`, return `category`, `products` (an array of product names sorted alphabetically) and `n` (how many). Order by `category`.",
      hint: "ARRAY_AGG(product_name ORDER BY product_name).",
      solution: `SELECT category,
       ARRAY_AGG(product_name ORDER BY product_name) AS products,
       COUNT(*) AS n
FROM products
GROUP BY category
ORDER BY category`,
      orderSensitive: true,
    },
    {
      id: "pv5", title: "Unfold a wide row into metrics", difficulty: 4, schema: "brightmart",
      prompt:
        "For products priced above 100, return one row per product per metric: `product_id`, `metric` and `value`, where metric is either `price` or `product_id`. Order by `product_id` then `metric`.",
      hint: "LATERAL (VALUES ('price', price), ('product_id', product_id::numeric)) AS v(metric, value).",
      solution: `SELECT p.product_id, v.metric, v.value
FROM products p
CROSS JOIN LATERAL (VALUES ('price', p.price), ('product_id', p.product_id::numeric)) AS v(metric, value)
WHERE p.price > 100
ORDER BY p.product_id, v.metric`,
      orderSensitive: true, interview: true,
    },
    {
      id: "pv6", title: "Monthly revenue across the year", difficulty: 4, schema: "brightmart",
      prompt:
        "Return `month` (the first day of each month) and `revenue` (rounded to 2 decimals) from completed orders, plus `share_pct`: that month's share of total revenue as a percentage rounded to 1 decimal. Order by `month`.",
      hint: "date_trunc for the month, then a window SUM over everything for the denominator.",
      solution: `WITH m AS (
  SELECT date_trunc('month', o.ordered_on)::date AS month,
         SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY 1
)
SELECT month,
       ROUND(revenue, 2) AS revenue,
       ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS share_pct
FROM m
ORDER BY month`,
      orderSensitive: true, interview: true,
    },
  ],
};

export const textPatterns: Module = {
  id: "text-patterns",
  title: "Text, patterns and JSON", track: "advanced",
  blurb: "Match text properly with LIKE and regular expressions, split it apart, and build JSON straight out of a query.",
  theory: `## LIKE is the simple one
\`%\` means any run of characters, \`_\` means exactly one.

\`\`\`sql
WHERE product_name LIKE 'Cable%'   -- starts with Cable
WHERE product_name ILIKE '%pro%'   -- contains pro, ignoring case
\`\`\`

\`ILIKE\` is the case-insensitive version, and it is Postgres-specific.

## Regular expressions when LIKE is not enough
\`~\` matches a regular expression, \`~*\` ignores case, \`!~\` negates.

\`\`\`sql
WHERE product_name ~ '[0-9]$'      -- ends with a digit
WHERE username ~* '^user_[0-9]+$'  -- whole string matches the shape
\`\`\`

Useful pieces: \`^\` start, \`$\` end, \`[0-9]\` any digit, \`+\` one or more, \`|\` or.

## Pulling text apart
- \`SPLIT_PART(text, delimiter, n)\` — take the nth piece.
- \`SUBSTRING(text FROM 'pattern')\` — extract the matching part.
- \`LEFT\`, \`RIGHT\`, \`LENGTH\`, \`TRIM\`, \`UPPER\`, \`LOWER\` — the usual set.
- \`||\` glues strings together. Careful: NULL glued to anything is NULL, so use \`CONCAT\` when a value might be missing.

## JSON straight from a query
Postgres builds JSON natively, which is how an API endpoint gets its shape without a backend loop.

\`\`\`sql
SELECT JSON_BUILD_OBJECT('id', track_id, 'title', title) FROM tracks;

SELECT genre, JSON_AGG(JSON_BUILD_OBJECT('title', title)) AS items
FROM tracks GROUP BY genre;
\`\`\`

\`jsonb\` is the binary, indexable form. Reach for it when you store JSON; \`json\` is fine when you are only producing it.`,
  problems: [
    {
      id: "tx1", title: "Products whose name ends in a digit", difficulty: 3, schema: "brightmart",
      prompt: "Return `product_name` for products whose name ends with a digit, ordered by `product_name`.",
      hint: "The regex operator ~ with [0-9]$.",
      solution: "SELECT product_name FROM products WHERE product_name ~ '[0-9]$' ORDER BY product_name",
      orderSensitive: true,
    },
    {
      id: "tx2", title: "Case-insensitive search", difficulty: 2, schema: "wavely",
      prompt: "Return `title` and `artist` for tracks whose artist name contains the letters `the`, ignoring case. Order by `artist` then `title`.",
      hint: "ILIKE with % on both sides.",
      solution:
        "SELECT title, artist FROM tracks WHERE artist ILIKE '%the%' ORDER BY artist, title",
      orderSensitive: true,
    },
    {
      id: "tx3", title: "Take the number out of a username", difficulty: 3, schema: "wavely",
      prompt:
        "Usernames look like `user_12`. Return `username` and `user_number` (the digits after the underscore, as an integer) for the first 10 users by `user_id`. Order by `user_id`.",
      hint: "SPLIT_PART(username, '_', 2) then cast to int.",
      solution: `SELECT username, SPLIT_PART(username, '_', 2)::int AS user_number
FROM users
ORDER BY user_id
LIMIT 10`,
      orderSensitive: true,
    },
    {
      id: "tx4", title: "Group artists by first letter", difficulty: 3, schema: "wavely",
      prompt:
        "Return `initial` (the uppercase first letter of the artist name) and `artists` (how many distinct artists start with it). Order by `initial`.",
      hint: "UPPER(LEFT(artist, 1)) and COUNT(DISTINCT artist).",
      solution: `SELECT UPPER(LEFT(artist, 1)) AS initial, COUNT(DISTINCT artist) AS artists
FROM tracks
GROUP BY 1
ORDER BY initial`,
      orderSensitive: true,
    },
    {
      id: "tx5", title: "Build a JSON object per track", difficulty: 3, schema: "wavely",
      prompt:
        "Return `track_id` and `payload`, a JSON object with keys `title` and `genre` for that track, for the first 5 tracks by `track_id`. Order by `track_id`.",
      hint: "JSON_BUILD_OBJECT('title', title, 'genre', genre).",
      solution: `SELECT track_id, JSON_BUILD_OBJECT('title', title, 'genre', genre) AS payload
FROM tracks
ORDER BY track_id
LIMIT 5`,
      orderSensitive: true,
    },
    {
      id: "tx6", title: "One JSON array per genre", difficulty: 4, schema: "wavely",
      prompt:
        "For each `genre`, return `genre` and `tracks`, a JSON array of objects each holding `title` and `duration_s`, ordered by title inside the array. Order the result by `genre`.",
      hint: "JSON_AGG(JSON_BUILD_OBJECT(...) ORDER BY title).",
      solution: `SELECT genre,
       JSON_AGG(JSON_BUILD_OBJECT('title', title, 'duration_s', duration_s) ORDER BY title) AS tracks
FROM tracks
GROUP BY genre
ORDER BY genre`,
      orderSensitive: true, interview: true,
    },
    {
      id: "tx7", title: "Label products by name shape", difficulty: 3, schema: "brightmart",
      prompt:
        "Return `product_name` and `name_kind`: `numbered` when the name ends in a digit, `plain` otherwise. Order by `name_kind` then `product_name`.",
      hint: "CASE WHEN product_name ~ '[0-9]$'.",
      solution: `SELECT product_name,
       CASE WHEN product_name ~ '[0-9]$' THEN 'numbered' ELSE 'plain' END AS name_kind
FROM products
ORDER BY name_kind, product_name`,
      orderSensitive: true,
    },
    {
      id: "tx8", title: "Safe concatenation with missing values", difficulty: 3, schema: "wavely",
      prompt:
        "Return `username` and `label`: the username, then a space, then the referrer id in brackets when there is one, or just the username when there is not. Order by `username`. Do not let a missing referrer blank out the whole label.",
      hint: "CONCAT ignores NULL, unlike ||. Or use COALESCE around the bracketed part.",
      solution: `SELECT username,
       CONCAT(username, CASE WHEN referred_by IS NOT NULL THEN ' [' || referred_by || ']' END) AS label
FROM users
ORDER BY username`,
      orderSensitive: true, interview: true,
    },
  ],
};
