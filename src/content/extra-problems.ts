/** Extra hard problems, merged into existing modules by id in index.ts.
 *  Concentrated in the topics interviews hammer (windows, CTEs, patterns,
 *  analytics). Every one is CI-validated against both dataset variants. */

import type { Problem } from "./types";

export const EXTRA: Record<string, Problem[]> = {
  windows1: [
    {
      id: "w7", title: "Top 3 longest tracks per genre", difficulty: 3, schema: "wavely",
      prompt: "For each genre, return the 3 longest tracks: `genre`, `title`, `duration_s`. Break ties by title. Order by genre, then longest first.",
      hint: "ROW_NUMBER() OVER (PARTITION BY genre ORDER BY duration_s DESC, title), keep rn <= 3.",
      solution: `SELECT genre, title, duration_s FROM (
  SELECT genre, title, duration_s,
         ROW_NUMBER() OVER (PARTITION BY genre ORDER BY duration_s DESC, title) AS rn
  FROM tracks
) t WHERE rn <= 3 ORDER BY genre, rn`,
      orderSensitive: true, interview: true,
    },
    {
      id: "w8", title: "Price percentile of each product", difficulty: 4, schema: "brightmart",
      prompt: "Return `product_name`, `price`, and `pct_rank` — each product's PERCENT_RANK by price (0 = cheapest), rounded to 3 decimals.",
      hint: "PERCENT_RANK() OVER (ORDER BY price).",
      solution: `SELECT product_name, price,
       ROUND((PERCENT_RANK() OVER (ORDER BY price))::numeric, 3) AS pct_rank
FROM products`,
      interview: true,
    },
    {
      id: "w9", title: "Cumulative users over time", difficulty: 3, schema: "wavely",
      prompt: "Return `signup_date`, `new_users` (signups that day), and `cumulative` (running total of users up to and including that day). Ordered by date.",
      hint: "Aggregate per day, then SUM(new_users) OVER (ORDER BY signup_date).",
      solution: `WITH daily AS (SELECT signup_date, COUNT(*) AS new_users FROM users GROUP BY signup_date)
SELECT signup_date, new_users,
       SUM(new_users) OVER (ORDER BY signup_date) AS cumulative
FROM daily ORDER BY signup_date`,
      orderSensitive: true, interview: true,
    },
  ],
  windows2: [
    {
      id: "o7", title: "First and last play date per user", difficulty: 3, schema: "wavely",
      prompt: "For each user who played anything, return `user_id`, `first_play`, `last_play` — using window functions (not GROUP BY). One row per user.",
      hint: "DISTINCT user_id with MIN(played_on) OVER (PARTITION BY user_id) and MAX(...) OVER (...).",
      solution: `SELECT DISTINCT user_id,
       MIN(played_on) OVER (PARTITION BY user_id) AS first_play,
       MAX(played_on) OVER (PARTITION BY user_id) AS last_play
FROM plays`,
      interview: true,
    },
    {
      id: "o8", title: "Days until each customer's next order", difficulty: 4, schema: "brightmart",
      prompt: "For customers with 2+ orders, return `customer_id`, `ordered_on`, and `days_to_next` (days until their following order). Skip the last order (no next). Order by customer_id, then date.",
      hint: "LEAD(ordered_on) OVER (PARTITION BY customer_id ORDER BY ordered_on); keep rows where next is not null.",
      solution: `WITH o AS (
  SELECT customer_id, ordered_on,
         LEAD(ordered_on) OVER (PARTITION BY customer_id ORDER BY ordered_on) AS next_on
  FROM orders
)
SELECT customer_id, ordered_on, next_on - ordered_on AS days_to_next
FROM o WHERE next_on IS NOT NULL ORDER BY customer_id, ordered_on`,
      orderSensitive: true, interview: true,
    },
    {
      id: "o9", title: "Customer spend quartiles", difficulty: 4, schema: "brightmart",
      prompt: "Split customers into 4 equal-size groups by completed-order spend (quantity × unit_price). Return `customer_id`, `spend` (2 dp), `quartile` (1 = lowest spenders).",
      hint: "Per-customer spend CTE, then NTILE(4) OVER (ORDER BY spend).",
      solution: `WITH spend AS (
  SELECT o.customer_id, SUM(i.quantity * i.unit_price) AS s
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT customer_id, ROUND(s::numeric, 2) AS spend, NTILE(4) OVER (ORDER BY s) AS quartile
FROM spend`,
      interview: true,
    },
  ],
  ctes: [
    {
      id: "c5", title: "Average order value per country", difficulty: 4, schema: "brightmart",
      prompt: "Per country: `country` and `avg_order_value` (average value of a completed order, 2 dp), ordered by country. Build per-order totals in a CTE first.",
      hint: "CTE: order_id, customer_id, SUM(items). Outer: join customers, AVG per country.",
      solution: `WITH per_order AS (
  SELECT o.order_id, o.customer_id, SUM(i.quantity * i.unit_price) AS v
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.order_id, o.customer_id
)
SELECT c.country, ROUND(AVG(po.v)::numeric, 2) AS avg_order_value
FROM per_order po JOIN customers c ON c.customer_id = po.customer_id
GROUP BY c.country ORDER BY c.country`,
      orderSensitive: true, interview: true,
    },
    {
      id: "c6", title: "Best-selling product per category", difficulty: 4, schema: "brightmart",
      prompt: "The single highest-revenue product in each category: `category`, `product_name`, `revenue` (2 dp, quantity × unit_price, any status). Ties by product_name. Order by category.",
      hint: "Revenue per product CTE, ROW_NUMBER per category, keep rn = 1.",
      solution: `WITH rev AS (
  SELECT p.category, p.product_name, SUM(i.quantity * i.unit_price) AS r
  FROM products p JOIN order_items i ON i.product_id = p.product_id
  GROUP BY p.category, p.product_name
)
SELECT category, product_name, ROUND(r::numeric, 2) AS revenue FROM (
  SELECT rev.*, ROW_NUMBER() OVER (PARTITION BY category ORDER BY r DESC, product_name) AS rn
  FROM rev
) t WHERE rn = 1 ORDER BY category`,
      orderSensitive: true, interview: true,
    },
  ],
  patterns: [
    {
      id: "p7", title: "Each customer's second order date", difficulty: 3, schema: "brightmart",
      prompt: "For customers with 2+ orders, return `customer_id` and `second_order` (the date of their 2nd order by date, ties by order_id). Order by customer_id.",
      hint: "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_on, order_id), keep rn = 2.",
      solution: `SELECT customer_id, ordered_on AS second_order FROM (
  SELECT customer_id, ordered_on,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_on, order_id) AS rn
  FROM orders
) t WHERE rn = 2 ORDER BY customer_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "p8", title: "Users active in 2+ months of Q1 2025", difficulty: 4, schema: "wavely",
      prompt: "Return `user_id` of users who played tracks in at least 2 different months of Q1 2025 (Jan–Mar). Ascending.",
      hint: "COUNT(DISTINCT date_trunc('month', played_on)) >= 2 over the Q1 window.",
      solution: `SELECT user_id FROM (
  SELECT user_id, COUNT(DISTINCT date_trunc('month', played_on)) AS months
  FROM plays WHERE played_on >= '2025-01-01' AND played_on < '2025-04-01'
  GROUP BY user_id
) t WHERE months >= 2 ORDER BY user_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "p9", title: "Monthly revenue: completed vs cancelled", difficulty: 4, schema: "brightmart",
      prompt: "Per month: `month` (date), `completed_rev` and `cancelled_rev` (item revenue split by order status, 2 dp, 0 where none). Order by month.",
      hint: "SUM(...) FILTER (WHERE status = 'completed') and the same for cancelled; COALESCE to 0.",
      solution: `SELECT date_trunc('month', o.ordered_on)::date AS month,
       ROUND(COALESCE(SUM(i.quantity * i.unit_price) FILTER (WHERE o.status = 'completed'), 0)::numeric, 2) AS completed_rev,
       ROUND(COALESCE(SUM(i.quantity * i.unit_price) FILTER (WHERE o.status = 'cancelled'), 0)::numeric, 2) AS cancelled_rev
FROM orders o JOIN order_items i ON i.order_id = o.order_id
GROUP BY 1 ORDER BY month`,
      orderSensitive: true, interview: true,
    },
  ],
  analytics: [
    {
      id: "a7", title: "Weekly new-user counts", difficulty: 3, schema: "wavely",
      prompt: "Return `week` (Monday of the signup week, date) and `new_users`, ordered by week.",
      hint: "date_trunc('week', signup_date)::date.",
      solution: `SELECT date_trunc('week', signup_date)::date AS week, COUNT(*) AS new_users
FROM users GROUP BY 1 ORDER BY week`,
      orderSensitive: true, interview: true,
    },
    {
      id: "a8", title: "Overall refund rate", difficulty: 3, schema: "brightmart",
      prompt: "Of completed orders, what share were refunded? Return `refund_rate` = ROUND(refunded / completed, 4). One row.",
      hint: "LEFT JOIN refunds to completed orders; COUNT(DISTINCT refund order) / COUNT(DISTINCT order).",
      solution: `SELECT ROUND(COUNT(DISTINCT r.order_id)::numeric / COUNT(DISTINCT o.order_id), 4) AS refund_rate
FROM orders o LEFT JOIN refunds r ON r.order_id = o.order_id
WHERE o.status = 'completed'`,
      interview: true,
    },
    {
      id: "a9", title: "Average completed orders per customer", difficulty: 3, schema: "brightmart",
      prompt: "Among customers who have any completed order, what's the average number of completed orders each? Return `avg_orders` (2 dp). One row.",
      hint: "COUNT(*) / COUNT(DISTINCT customer_id) over completed orders.",
      solution: `SELECT ROUND(COUNT(*)::numeric / COUNT(DISTINCT customer_id), 2) AS avg_orders
FROM orders WHERE status = 'completed'`,
      interview: true,
    },
  ],
  joins: [
    {
      id: "j7", title: "Customers buying from 2+ categories", difficulty: 3, schema: "brightmart",
      prompt: "How many customers bought products from 2 or more distinct categories (completed orders only)? Return one column `n`.",
      hint: "Join orders→items→products, GROUP BY customer, HAVING COUNT(DISTINCT category) >= 2, then count.",
      solution: `SELECT COUNT(*) AS n FROM (
  SELECT o.customer_id
  FROM orders o
  JOIN order_items i ON i.order_id = o.order_id
  JOIN products p ON p.product_id = i.product_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id HAVING COUNT(DISTINCT p.category) >= 2
) t`,
      interview: true,
    },
    {
      id: "j8", title: "Completed orders by country", difficulty: 3, schema: "brightmart",
      prompt: "For every country, return `country` and `orders` (count of completed orders — 0 if none). Most orders first, ties by country.",
      hint: "LEFT JOIN with the status filter in ON; COUNT(o.order_id).",
      solution: `SELECT c.country, COUNT(o.order_id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
GROUP BY c.country ORDER BY orders DESC, c.country`,
      orderSensitive: true, interview: true,
    },
  ],
  subqueries: [
    {
      id: "s7", title: "Tracks played more than average", difficulty: 3, schema: "wavely",
      prompt: "Return `track_id` and `plays` for tracks played more times than the average track's play count. Most plays first, ties by track_id.",
      hint: "Per-track play count CTE, then WHERE plays > (SELECT AVG(plays) FROM cte).",
      solution: `WITH pc AS (SELECT track_id, COUNT(*) AS plays FROM plays GROUP BY track_id)
SELECT track_id, plays FROM pc
WHERE plays > (SELECT AVG(plays) FROM pc)
ORDER BY plays DESC, track_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "s8", title: "Customers above the average order count", difficulty: 4, schema: "brightmart",
      prompt: "Return `customer_id` and `n` (their completed-order count) for customers with more completed orders than the average customer (averaged over customers who have any). Most first, ties by customer_id.",
      hint: "Per-customer count CTE, compare to (SELECT AVG(n) FROM cte).",
      solution: `WITH oc AS (SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'completed' GROUP BY customer_id)
SELECT customer_id, n FROM oc
WHERE n > (SELECT AVG(n) FROM oc)
ORDER BY n DESC, customer_id`,
      orderSensitive: true, interview: true,
    },
  ],
};
