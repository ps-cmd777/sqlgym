/** Deduplication, reshaping and statistics — the everyday analyst toolkit. */

import type { Module } from "./types";

export const dedup: Module = {
  id: "dedup",
  title: "Duplicates and messy data", track: "advanced",
  blurb: "Find duplicates, keep exactly one row per key, and spot the join that quietly doubled your numbers.",
  theory: `## Duplicates are usually made, not found
Most "duplicate" bugs are not bad data. They are a join that matched more than once, so every extra match copies the row on the other side. Revenue doubles and nobody notices.

The habit worth building: after any join, ask **"could the right side match twice?"**

## Finding duplicates
Group by the thing that should be unique and keep groups bigger than one.

\`\`\`sql
SELECT artist, title, COUNT(*) AS copies
FROM tracks
GROUP BY artist, title
HAVING COUNT(*) > 1;
\`\`\`

## Keeping one row per key
Number the rows inside each key, then keep number 1. The \`ORDER BY\` inside the window decides **which** one you keep.

\`\`\`sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY played_on DESC) AS rn
  FROM plays
)
SELECT * FROM ranked WHERE rn = 1;
\`\`\`

Use \`ROW_NUMBER\` when you want exactly one. \`RANK\` keeps ties, which is a different question.

## DISTINCT ON: the Postgres shortcut
Postgres has a shorter way to say the same thing. The \`ORDER BY\` must start with the same columns as the \`DISTINCT ON\`.

\`\`\`sql
SELECT DISTINCT ON (user_id) user_id, played_on, track_id
FROM plays
ORDER BY user_id, played_on DESC;
\`\`\`

## DISTINCT is not free and not always right
\`SELECT DISTINCT\` reaching for a fix usually hides a join problem rather than solving it. If you find yourself adding DISTINCT to make a number look right, go back and check the join.

## Aggregate before you join
The safe pattern when one side has many rows: collapse it to one row per key **first**, then join.

\`\`\`sql
WITH per_order AS (
  SELECT order_id, SUM(quantity * unit_price) AS value
  FROM order_items GROUP BY order_id
)
SELECT o.order_id, po.value FROM orders o JOIN per_order po USING (order_id);
\`\`\``,
  problems: [
    {
      id: "dd1", title: "Artists with more than one track", difficulty: 3, schema: "wavely",
      takeaway:
        "`GROUP BY` then `HAVING COUNT(*) > 1` is how you find anything that repeats. The same shape finds duplicate emails, duplicate orders, or a broken unique constraint.",
      prompt:
        "Find artists that appear on more than one track. Return `artist` and `tracks`, ordered by `tracks` descending then `artist`.",
      hint: "GROUP BY artist, HAVING COUNT(*) > 1.",
      solution: `SELECT artist, COUNT(*) AS tracks
FROM tracks
GROUP BY artist
HAVING COUNT(*) > 1
ORDER BY tracks DESC, artist`,
      orderSensitive: true,
    },
    {
      id: "dd2", title: "Each user's most recent play", difficulty: 3, schema: "wavely",
      takeaway:
        "`ROW_NUMBER` inside a partition, keep number 1. The `ORDER BY` inside the window decides which row survives, so put real thought into it, including the tiebreaker.",
      prompt:
        "Return exactly one row per user who has played something: `user_id`, `played_on` and `track_id` for their most recent play. If a user has several plays on their latest day, keep the one with the smallest `track_id`. Order by `user_id`.",
      hint: "ROW_NUMBER partitioned by user, ordered by played_on DESC then track_id.",
      solution: `WITH ranked AS (
  SELECT user_id, played_on, track_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY played_on DESC, track_id) AS rn
  FROM plays
)
SELECT user_id, played_on, track_id FROM ranked WHERE rn = 1 ORDER BY user_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "dd3", title: "Same answer with DISTINCT ON", difficulty: 3, schema: "wavely",
      takeaway:
        "`DISTINCT ON` is the Postgres shorthand for the same idea. Its `ORDER BY` must start with the same columns as the `DISTINCT ON`, or it will not do what you expect.",
      prompt:
        "Using Postgres DISTINCT ON, return one row per user with `user_id`, `played_on` and `track_id` for their earliest play, breaking ties by the smallest `track_id`. Order by `user_id`.",
      hint: "DISTINCT ON (user_id) with ORDER BY user_id, played_on, track_id.",
      solution: `SELECT DISTINCT ON (user_id) user_id, played_on, track_id
FROM plays
ORDER BY user_id, played_on, track_id`,
      orderSensitive: true,
    },
    {
      id: "dd4", title: "The join that doubles revenue", difficulty: 4, schema: "brightmart",
      takeaway:
        "Aggregate the many-side to one row per key first, then join. Reaching for `SELECT DISTINCT` to fix a doubled total hides the join bug instead of fixing it.",
      prompt:
        "For each completed order, return `order_id` and `order_value` (sum of quantity times unit price, rounded to 2 decimals) without letting the refunds table multiply the total. Include orders that have no refund. Order by `order_id`.",
      hint: "Aggregate order_items per order in a CTE first, then join. Do not join refunds and items in the same breath.",
      solution: `WITH per_order AS (
  SELECT order_id, SUM(quantity * unit_price) AS value
  FROM order_items
  GROUP BY order_id
)
SELECT o.order_id, ROUND(po.value, 2) AS order_value
FROM orders o
JOIN per_order po ON po.order_id = o.order_id
WHERE o.status = 'completed'
ORDER BY o.order_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "dd5", title: "Users who played several times in a day", difficulty: 3, schema: "wavely",
      takeaway:
        "Grouping by two columns finds duplicates on a combination, which is usually the real key rather than any single column.",
      prompt:
        "Find user and date combinations with more than one play. Return `user_id`, `played_on` and `plays_that_day`, ordered by `plays_that_day` descending, then `user_id`, then `played_on`. Limit to the top 20 rows.",
      hint: "Group by both columns, HAVING COUNT(*) > 1.",
      solution: `SELECT user_id, played_on, COUNT(*) AS plays_that_day
FROM plays
GROUP BY user_id, played_on
HAVING COUNT(*) > 1
ORDER BY plays_that_day DESC, user_id, played_on
LIMIT 20`,
      orderSensitive: true,
    },
    {
      id: "dd6", title: "One row per artist and genre", difficulty: 2, schema: "wavely",
      takeaway:
        "`SELECT DISTINCT` deduplicates the whole selected row, not just the first column. Add a column and you may get more rows back, not fewer.",
      prompt:
        "Return the distinct pairs of `artist` and `genre` that exist in the tracks table, ordered by `artist` then `genre`.",
      hint: "SELECT DISTINCT on the two columns.",
      solution: "SELECT DISTINCT artist, genre FROM tracks ORDER BY artist, genre",
      orderSensitive: true,
    },
  ],
};

export const stats: Module = {
  id: "stats",
  title: "Statistics inside SQL", track: "advanced",
  blurb: "Medians, percentiles, spread and buckets — computed in the database instead of exported to a spreadsheet.",
  theory: `## The average lies more often than you think
One enormous order drags the mean up and nobody's experience looks like it. The **median** is the middle value, and it survives outliers.

SQL has no \`MEDIAN()\`. It has something better and stranger looking.

## percentile_cont: ordered-set aggregates
\`\`\`sql
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s) AS median
FROM tracks;
\`\`\`

Read \`WITHIN GROUP (ORDER BY x)\` as "line the values up by x, then reach into the list". 0.5 is the middle, 0.9 the ninetieth percentile.

- \`PERCENTILE_CONT\` interpolates between the two nearest values. Good for continuous numbers.
- \`PERCENTILE_DISC\` returns an actual value from the data. Good when the value must be real.

## Spread, not just centre
\`STDDEV(x)\` tells you how spread out values are. Two categories with the same average can behave completely differently, and the standard deviation is what shows it.

## NTILE: cut rows into equal buckets
\`NTILE(4)\` splits ordered rows into four groups of roughly equal size, which is how you build quartiles or "top 10% of customers".

\`\`\`sql
SELECT customer_id, total,
       NTILE(4) OVER (ORDER BY total DESC) AS quartile
FROM spend;
\`\`\`

## Histograms with width_bucket
\`width_bucket(value, low, high, count)\` tells you which bucket a value falls in, which turns any numeric column into a distribution.

\`\`\`sql
SELECT width_bucket(duration_s, 0, 400, 4) AS bucket, COUNT(*)
FROM tracks GROUP BY 1 ORDER BY 1;
\`\`\``,
  problems: [
    {
      id: "st1", title: "Median track length", difficulty: 3, schema: "wavely",
      takeaway:
        "SQL has no `MEDIAN()`. `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)` is it. Read `WITHIN GROUP` as 'line the values up, then reach into the list'.",
      prompt: "Return one row with `median_seconds`, the median of `duration_s` across all tracks, rounded to 1 decimal.",
      hint: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s).",
      solution:
        "SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS median_seconds FROM tracks",
      interview: true,
    },
    {
      id: "st2", title: "Median and mean side by side", difficulty: 3, schema: "wavely",
      takeaway:
        "When the mean sits far from the median, the distribution is skewed and the average is describing nobody. Reporting both is what stops that going unnoticed.",
      prompt:
        "For each `genre`, return `genre`, `mean_seconds` and `median_seconds`, both rounded to 1 decimal, so the two can be compared. Order by `genre`.",
      hint: "AVG and PERCENTILE_CONT in the same GROUP BY.",
      solution: `SELECT genre,
       ROUND(AVG(duration_s), 1) AS mean_seconds,
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS median_seconds
FROM tracks
GROUP BY genre
ORDER BY genre`,
      orderSensitive: true, interview: true,
    },
    {
      id: "st3", title: "The ninetieth percentile order", difficulty: 4, schema: "brightmart",
      takeaway:
        "Percentiles answer 'how bad is a bad case', which is usually the question behind a latency or order-value target. The average hides exactly that.",
      prompt:
        "Across completed orders, return one row with `p90_value`: the ninetieth percentile of order value (quantity times unit price summed per order), rounded to 2 decimals.",
      hint: "Compute order values in a CTE, then PERCENTILE_CONT(0.9) over them.",
      solution: `WITH vals AS (
  SELECT o.order_id, SUM(oi.quantity * oi.unit_price) AS value
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.order_id
)
SELECT ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY value)::numeric, 2) AS p90_value FROM vals`,
      interview: true,
    },
    {
      id: "st4", title: "Which genre is most consistent", difficulty: 3, schema: "wavely",
      takeaway:
        "`STDDEV` measures spread. Two groups can share an average and behave completely differently, and the standard deviation is what reveals it.",
      prompt:
        "For each `genre`, return `genre`, `avg_seconds` and `spread` (standard deviation of `duration_s`), both rounded to 1 decimal. Order by `spread` ascending so the most consistent genre is first, then by `genre`.",
      hint: "STDDEV alongside AVG.",
      solution: `SELECT genre,
       ROUND(AVG(duration_s), 1) AS avg_seconds,
       ROUND(STDDEV(duration_s), 1) AS spread
FROM tracks
GROUP BY genre
ORDER BY spread, genre`,
      orderSensitive: true,
    },
    {
      id: "st5", title: "Split customers into spend quartiles", difficulty: 4, schema: "brightmart",
      takeaway:
        "`NTILE(4)` splits ordered rows into four roughly equal buckets. Equal in count, not in value, which is the difference between a quartile and a range.",
      prompt:
        "For customers with at least one completed order, return `customer_id`, `total_spend` (rounded to 2 decimals) and `quartile` where 1 is the highest-spending quarter. Order by `quartile`, then `total_spend` descending, then `customer_id`.",
      hint: "Total per customer in a CTE, then NTILE(4) OVER (ORDER BY total DESC).",
      solution: `WITH spend AS (
  SELECT o.customer_id, SUM(oi.quantity * oi.unit_price) AS total
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT customer_id,
       ROUND(total, 2) AS total_spend,
       NTILE(4) OVER (ORDER BY total DESC) AS quartile
FROM spend
ORDER BY quartile, total_spend DESC, customer_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "st6", title: "Track length distribution", difficulty: 4, schema: "wavely",
      takeaway:
        "`width_bucket(v, low, high, n)` turns a numeric column into a histogram. Values outside the range land in bucket 0 or n+1 rather than being dropped.",
      prompt:
        "Bucket tracks by `duration_s` into 4 buckets spanning 0 to 400 seconds. Return `bucket` and `tracks`, ordered by `bucket`.",
      hint: "width_bucket(duration_s, 0, 400, 4).",
      solution: `SELECT width_bucket(duration_s, 0, 400, 4) AS bucket, COUNT(*) AS tracks
FROM tracks
GROUP BY 1
ORDER BY bucket`,
      orderSensitive: true,
    },
  ],
};
