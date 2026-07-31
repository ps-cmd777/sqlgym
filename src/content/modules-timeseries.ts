/** Time series work: date spines, gaps and islands, LATERAL. */

import type { Module } from "./types";

export const timeseries: Module = {
  id: "timeseries",
  title: "Dates, gaps and streaks", track: "advanced",
  blurb: "Days with no rows, consecutive-day streaks, and top-N-per-group with LATERAL. The analytics questions that come up constantly.",
  theory: `## Missing days are invisible
Group plays by day and you get one row per day **that had a play**. Quiet days simply are not there. A chart built on that lies: it draws a line straight over the gap.

The fix is to generate the days yourself and join your data onto them.

## generate_series builds a calendar
\`\`\`sql
SELECT d::date AS day
FROM generate_series('2025-03-01'::date, '2025-03-31'::date, interval '1 day') AS d;
\`\`\`

That is a **date spine**. LEFT JOIN your real data onto it and use \`COALESCE\` so empty days show 0 rather than vanishing.

\`\`\`sql
SELECT d::date AS day, COUNT(p.play_id) AS plays
FROM generate_series('2025-03-01'::date, '2025-03-07'::date, interval '1 day') AS d
LEFT JOIN plays p ON p.played_on = d::date
GROUP BY d
ORDER BY day;
\`\`\`

## Gaps and islands
Classic interview shape: find runs of consecutive days.

The trick is beautiful once you see it. Number the rows in order, then subtract that number from the date. Inside a consecutive run, the difference is **constant** — so you can group by it.

\`\`\`
day         rn   day - rn
2025-03-01  1    2025-02-28   <- run A
2025-03-02  2    2025-02-28   <- run A
2025-03-05  3    2025-03-02   <- run B  (gap broke it)
\`\`\`

\`\`\`sql
WITH d AS (
  SELECT DISTINCT played_on FROM plays WHERE user_id = 1
), g AS (
  SELECT played_on,
         played_on - (ROW_NUMBER() OVER (ORDER BY played_on))::int AS grp
  FROM d
)
SELECT MIN(played_on) AS run_start, COUNT(*) AS length
FROM g GROUP BY grp;
\`\`\`

## LATERAL: a subquery that sees the current row
A normal subquery in FROM cannot reference the row beside it. \`LATERAL\` can. It is the clean way to do "top N per group".

\`\`\`sql
SELECT t.genre, x.title
FROM (SELECT DISTINCT genre FROM tracks) t
CROSS JOIN LATERAL (
  SELECT title FROM tracks
  WHERE genre = t.genre
  ORDER BY duration_s DESC
  LIMIT 2
) x;
\`\`\`

Read it as a for-each loop: for every genre, run this little query.

## LEAD and LAG for "time since last"
\`LAG(col) OVER (PARTITION BY ... ORDER BY ...)\` gives you the previous row's value, so gaps between events are simple subtraction.`,
  problems: [
    {
      id: "ts1", title: "A row for every day in March", difficulty: 3, schema: "wavely",
      takeaway:
        "A date spine from `generate_series` plus a `LEFT JOIN` is how days with no activity still appear. Group your data alone and quiet days vanish, and any chart drawn from it lies.",
      prompt:
        "Return `day` and `plays` for every calendar day from 2025-03-01 to 2025-03-31, including days with no plays at all (those must show 0). Order by `day`.",
      hint: "generate_series for the spine, LEFT JOIN plays onto it, COUNT the play id.",
      solution: `SELECT d::date AS day, COUNT(p.play_id) AS plays
FROM generate_series('2025-03-01'::date, '2025-03-31'::date, interval '1 day') AS d
LEFT JOIN plays p ON p.played_on = d::date
GROUP BY d
ORDER BY day`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ts2", title: "Days a user went quiet", difficulty: 4, schema: "wavely",
      takeaway:
        "Put the extra condition in the `ON` clause, not `WHERE`. In `WHERE` it runs after the join and throws away the very non-matching rows you were trying to find.",
      prompt:
        "For user 1, return `day` for every date between 2025-03-01 and 2025-03-31 on which they played nothing. Order by `day`.",
      hint: "Build the spine, LEFT JOIN that user's plays onto it, keep rows where the join found nothing.",
      solution: `SELECT d::date AS day
FROM generate_series('2025-03-01'::date, '2025-03-31'::date, interval '1 day') AS d
LEFT JOIN plays p ON p.played_on = d::date AND p.user_id = 1
WHERE p.play_id IS NULL
GROUP BY d
ORDER BY day`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ts3", title: "Longest run of consecutive active days", difficulty: 4, schema: "wavely",
      takeaway:
        "Gaps and islands: subtract a row number from the date and the result is constant inside a run of consecutive days. Group by that constant and each group is one streak.",
      prompt:
        "Across all users combined, find the longest run of consecutive calendar days that had at least one play. Return `run_start`, `run_end` and `days` for that single longest run. If several tie, return the earliest.",
      hint: "Distinct days, then date minus row_number is constant inside a run.",
      solution: `WITH d AS (
  SELECT DISTINCT played_on FROM plays
), g AS (
  SELECT played_on,
         played_on - (ROW_NUMBER() OVER (ORDER BY played_on))::int AS grp
  FROM d
)
SELECT MIN(played_on) AS run_start, MAX(played_on) AS run_end, COUNT(*) AS days
FROM g
GROUP BY grp
ORDER BY days DESC, run_start
LIMIT 1`,
      interview: true,
    },
    {
      id: "ts4", title: "Two longest tracks per genre", difficulty: 4, schema: "wavely",
      takeaway:
        "`LATERAL` lets a subquery in `FROM` see the current row, so it behaves like a for-each loop. It is the clean way to do top-N per group.",
      prompt:
        "For each `genre`, return the two longest tracks as `genre`, `title` and `duration_s`. Order by `genre`, then `duration_s` descending, then `title`.",
      hint: "CROSS JOIN LATERAL a small ordered subquery with LIMIT 2.",
      solution: `SELECT g.genre, x.title, x.duration_s
FROM (SELECT DISTINCT genre FROM tracks) g
CROSS JOIN LATERAL (
  SELECT title, duration_s FROM tracks t
  WHERE t.genre = g.genre
  ORDER BY t.duration_s DESC, t.title
  LIMIT 2
) x
ORDER BY g.genre, x.duration_s DESC, x.title`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ts5", title: "Days between a user's plays", difficulty: 3, schema: "wavely",
      takeaway:
        "`LAG` reads the previous row in the window, so 'time since last event' becomes plain subtraction. The first row has no previous row, so it is NULL by design.",
      prompt:
        "For user 1, return each `played_on` date they listened (distinct days) and `days_since_previous`, the number of days since their previous listening day. The first row must show NULL. Order by `played_on`.",
      hint: "LAG over the ordered distinct days, then subtract.",
      solution: `WITH d AS (SELECT DISTINCT played_on FROM plays WHERE user_id = 1)
SELECT played_on,
       (played_on - LAG(played_on) OVER (ORDER BY played_on))::int AS days_since_previous
FROM d
ORDER BY played_on`,
      orderSensitive: true,
    },
    {
      id: "ts6", title: "Weekly play counts", difficulty: 3, schema: "wavely",
      takeaway:
        "`date_trunc('week', d)` snaps every date back to its Monday, which is what makes weekly grouping work without a calendar table.",
      prompt:
        "Return `week_start` (the Monday of each week, as a date) and `plays` counting plays in that week. Include only weeks that had plays. Order by `week_start`.",
      hint: "date_trunc('week', played_on) gives the Monday.",
      solution: `SELECT date_trunc('week', played_on)::date AS week_start, COUNT(*) AS plays
FROM plays
GROUP BY 1
ORDER BY week_start`,
      orderSensitive: true,
    },
    {
      id: "ts7", title: "Revenue with a running total by day", difficulty: 4, schema: "brightmart",
      takeaway:
        "`SUM(x) OVER (ORDER BY day)` accumulates as it goes, giving a running total. Adding `ORDER BY` to a window is what turns it from a total into a progression.",
      prompt:
        "For completed orders, return `day` (the order date), `revenue` (sum of quantity times unit price that day, rounded to 2 decimals) and `running_total` (cumulative revenue up to and including that day, rounded to 2 decimals). Order by `day`.",
      hint: "Aggregate per day in a CTE, then SUM(...) OVER (ORDER BY day).",
      solution: `WITH daily AS (
  SELECT o.ordered_on AS day, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.ordered_on
)
SELECT day,
       ROUND(revenue, 2) AS revenue,
       ROUND(SUM(revenue) OVER (ORDER BY day), 2) AS running_total
FROM daily
ORDER BY day`,
      orderSensitive: true, interview: true,
    },
    {
      id: "ts8", title: "Each user's first and most recent listen", difficulty: 3, schema: "wavely",
      takeaway:
        "`COUNT(DISTINCT played_on)` counts active days, not plays. Someone with fifty plays on one day was active once.",
      prompt:
        "Return `user_id`, `first_play`, `last_play` and `active_days` (distinct days with a play) for every user who has listened at least once. Order by `user_id`.",
      hint: "MIN, MAX and COUNT(DISTINCT played_on) grouped by user.",
      solution: `SELECT user_id,
       MIN(played_on) AS first_play,
       MAX(played_on) AS last_play,
       COUNT(DISTINCT played_on) AS active_days
FROM plays
GROUP BY user_id
ORDER BY user_id`,
      orderSensitive: true,
    },
  ],
};
