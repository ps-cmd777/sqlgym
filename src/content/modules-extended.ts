/** Modules 10-12: writing data, hierarchies & recursion, expressions. Original. */

import type { Module } from "./types";

export const mutations: Module = {
  id: "mutations",
  title: "Modifying data", track: "advanced",
  blurb: "INSERT, UPDATE, DELETE — and how professionals avoid destroying production data while doing it.",
  theory: `## Now you're editing the spreadsheet
Until now you've only *read* data. This module *changes* it — add rows, edit rows, delete rows. Analyst interviews lean on SELECT, but analytics-engineer and senior screens check you can change data **safely**.

## The three verbs
\`\`\`sql
INSERT INTO products (product_id, product_name, price)  -- add a row
VALUES (999, 'Gift Card', 25.00);

UPDATE products SET price = price * 1.10                 -- change rows
WHERE category = 'Cables';

DELETE FROM order_items                                  -- remove rows
WHERE order_id IN (SELECT order_id FROM orders WHERE status = 'cancelled');
\`\`\`
Notice: \`UPDATE\` and \`DELETE\` **without a WHERE hit every row.** That's how people wipe a table by accident.

## The safety ritual (say it out loud in interviews)
Before any UPDATE or DELETE in real life: run it as a \`SELECT\` first with the same WHERE, check the row count looks right, *then* change the verb. Saying this ritual signals seniority.

## UPSERT — insert, or update if it already exists
\`\`\`sql
INSERT INTO products (product_id, price) VALUES (1, 49.99)
ON CONFLICT (product_id) DO UPDATE SET price = EXCLUDED.price;
\`\`\`
\`EXCLUDED\` is the row you tried to insert. Read it as "add this; if it clashes on the key, update instead."

## Transactions — all or nothing
\`BEGIN … COMMIT\` groups statements so they all succeed or all roll back. Anything that moves value between rows (a transfer, a rebalance) belongs in one — you never want half of it to land.

**How grading works here:** your statements run against a fresh copy of the database, then a check query inspects the result — on the visible copy and a hidden one.`,
  problems: [
    {
      id: "m1", title: "Add a new product", difficulty: 1, schema: "brightmart", kind: "dml",
      prompt: "Insert a new product: product_id 999, name 'Gift Card', category 'Office', price 25.00.",
      hint: "INSERT INTO products VALUES (…) — match the column order or name the columns.",
      solution: "INSERT INTO products (product_id, product_name, category, price) VALUES (999, 'Gift Card', 'Office', 25.00)",
      checkSql: "SELECT product_id, product_name, category, price FROM products WHERE product_id = 999",
    },
    {
      id: "m2", title: "Raise cable prices by 10%", difficulty: 2, schema: "brightmart", kind: "dml",
      prompt: "Raise the price of every product in the 'Cables' category by 10% (multiply by 1.10).",
      hint: "UPDATE products SET price = … WHERE category = 'Cables'.",
      solution: "UPDATE products SET price = price * 1.10 WHERE category = 'Cables'",
      checkSql: "SELECT product_id, ROUND(price, 2) FROM products ORDER BY product_id",
      interview: true,
    },
    {
      id: "m3", title: "Delete items from cancelled orders", difficulty: 3, schema: "brightmart", kind: "dml",
      prompt: "Delete all order_items belonging to cancelled orders.",
      hint: "DELETE FROM order_items WHERE order_id IN (SELECT … WHERE status = 'cancelled').",
      solution: "DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE status = 'cancelled')",
      checkSql: `SELECT COUNT(*) FROM order_items i JOIN orders o ON o.order_id = i.order_id GROUP BY o.status ORDER BY o.status`,
      interview: true,
    },
    {
      id: "m4", title: "Insert-or-update a product (upsert)", difficulty: 3, schema: "brightmart", kind: "dml",
      prompt: "Upsert product 1: if it exists, set its price to 49.99; if not, insert it as ('Product 1', 'Audio', 49.99). Use INSERT … ON CONFLICT.",
      hint: "INSERT … VALUES (1, 'Product 1', 'Audio', 49.99) ON CONFLICT (product_id) DO UPDATE SET price = EXCLUDED.price.",
      solution: "INSERT INTO products (product_id, product_name, category, price) VALUES (1, 'Product 1', 'Audio', 49.99) ON CONFLICT (product_id) DO UPDATE SET price = EXCLUDED.price",
      checkSql: "SELECT product_id, ROUND(price, 2) FROM products WHERE product_id = 1",
      interview: true,
    },
    {
      id: "m5", title: "Move price between two products (transaction)", difficulty: 4, schema: "brightmart", kind: "dml",
      prompt: "In one transaction: decrease the price of product 2 by 5.00 and increase the price of product 3 by 5.00. Wrap both updates in BEGIN/COMMIT.",
      hint: "BEGIN; UPDATE …; UPDATE …; COMMIT;",
      solution: `BEGIN;
UPDATE products SET price = price - 5.00 WHERE product_id = 2;
UPDATE products SET price = price + 5.00 WHERE product_id = 3;
COMMIT;`,
      checkSql: "SELECT product_id, ROUND(price, 2) FROM products WHERE product_id IN (2, 3) ORDER BY product_id",
      interview: true,
    },
    {
      id: "m6", title: "Archive then purge cancelled orders", difficulty: 4, schema: "brightmart", kind: "dml",
      prompt: "Cancelled orders should be purged, but keep an audit: first create table cancelled_archive AS the full rows of cancelled orders, then delete those orders from orders.",
      hint: "CREATE TABLE cancelled_archive AS SELECT * FROM orders WHERE …; then DELETE.",
      solution: `CREATE TABLE cancelled_archive AS SELECT * FROM orders WHERE status = 'cancelled';
DELETE FROM orders WHERE status = 'cancelled';`,
      checkSql: `SELECT (SELECT COUNT(*) FROM cancelled_archive) AS archived,
       (SELECT COUNT(*) FROM orders WHERE status = 'cancelled') AS remaining`,
      interview: true,
    },
  ],
};

export const hierarchy: Module = {
  id: "hierarchy",
  title: "Recursive queries", track: "advanced",
  blurb: "Who reports to whom, up and down any number of levels — the advanced topic that separates senior candidates.",
  theory: `## Start with a family tree
An org chart is just a family tree: everyone has one parent (their boss), except the person at the very top. In SQL that's one table pointing at itself:

\`\`\`
emp_id | name   | manager_id
1      | Ana    | NULL     <- the boss, no manager
2      | Boris  | 1        <- Boris's manager is Ana
3      | Carmen | 2        <- Carmen's manager is Boris
4      | Dev    | 2        <- Dev's manager is Boris too
\`\`\`

\`manager_id\` points to another row's \`emp_id\`. Ana is the top, so hers is NULL.

## The easy question, and the hard one
Easy: "Who reports directly to Ana?" — one hop. A plain self-join finds Boris.

Hard: "Give me **everyone** under Ana — her reports, their reports, all the way down." You can't write a fixed number of joins, because you don't know how deep it goes. This is what recursion is for.

## Recursion = keep asking the same question
The plain-English recipe:

1. Start with Ana's direct reports. (found: Boris)
2. Now ask: who reports to the people I just found? (Boris's reports: Carmen, Dev)
3. Ask again about *those* people. (Carmen and Dev have no reports)
4. Nobody new — stop.

That "start, then repeat until nothing new" is exactly \`WITH RECURSIVE\`:

\`\`\`sql
WITH RECURSIVE chain AS (
  -- STEP 1 (the "anchor"): where we begin
  SELECT emp_id, name FROM employees WHERE manager_id = 1

  UNION ALL

  -- STEP 2 (repeats): children of everyone found so far
  SELECT e.emp_id, e.name
  FROM employees e
  JOIN chain ON e.manager_id = chain.emp_id
)
SELECT * FROM chain;
\`\`\`

The top half runs once (Ana's reports). The bottom half runs again and again — each round finds the children of the previous round's rows — until a round finds nobody. Then it stops. That's the whole trick.

## Two habits that make you look senior
- **Add a \`depth\` counter** (\`chain.depth + 1\` each round). It answers the inevitable "how many levels deep?" and stops a runaway query if the data has a loop.
- **Build a path string** (\`chain.path || ' > ' || e.name\`) to get \`"Ana > Boris > Carmen"\` — instantly readable, and it shows you understand what's happening.`,
  problems: [
    {
      id: "h1", title: "Direct reports per manager", difficulty: 2, schema: "orbit",
      prompt: "For each manager (anyone who appears as someone's manager_id), return `manager_name` and `direct_reports` (count). Most reports first, ties by name.",
      hint: "Self-join employees to itself on manager_id; group by the manager.",
      solution: `SELECT m.name AS manager_name, COUNT(*) AS direct_reports
FROM employees e JOIN employees m ON m.emp_id = e.manager_id
GROUP BY m.name ORDER BY direct_reports DESC, manager_name`,
      orderSensitive: true,
    },
    {
      id: "h2", title: "Everyone under a given manager", difficulty: 3, schema: "orbit",
      prompt: "Using WITH RECURSIVE, return the `emp_id` and `name` of every employee in employee 2's subtree — direct and indirect reports (not employee 2 themself).",
      hint: "Anchor: manager_id = 2. Step: join employees to the CTE on manager_id = cte.emp_id.",
      solution: `WITH RECURSIVE reports AS (
  SELECT emp_id, name FROM employees WHERE manager_id = 2
  UNION ALL
  SELECT e.emp_id, e.name FROM employees e JOIN reports r ON e.manager_id = r.emp_id
)
SELECT emp_id, name FROM reports`,
      interview: true,
    },
    {
      id: "h3", title: "Org depth per employee", difficulty: 3, schema: "orbit",
      prompt: "Return `emp_id`, `name`, and `level` for all employees, where the CEO is level 1, their reports level 2, and so on. Order by level, then emp_id.",
      hint: "Anchor on manager_id IS NULL with level 1; add 1 per step.",
      solution: `WITH RECURSIVE org AS (
  SELECT emp_id, name, 1 AS level FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.emp_id, e.name, o.level + 1 FROM employees e JOIN org o ON e.manager_id = o.emp_id
)
SELECT emp_id, name, level FROM org ORDER BY level, emp_id`,
      orderSensitive: true, interview: true,
    },
    {
      id: "h4", title: "Management chain as a path", difficulty: 4, schema: "orbit",
      prompt: "For employee 40, return one row with `chain`: the names from the CEO down to employee 40, joined by ' > ' (e.g. 'CEO Name > … > Employee 40 Name').",
      hint: "Recurse UP from employee 40 via manager_id, carrying a path; or down from the CEO. String position matters.",
      solution: `WITH RECURSIVE up AS (
  SELECT emp_id, manager_id, name::text AS chain FROM employees WHERE emp_id = 40
  UNION ALL
  SELECT e.emp_id, e.manager_id, e.name || ' > ' || up.chain
  FROM employees e JOIN up ON e.emp_id = up.manager_id
)
SELECT chain FROM up WHERE manager_id IS NULL`,
      interview: true,
    },
    {
      id: "h5", title: "Total salary under each VP", difficulty: 4, schema: "orbit",
      prompt: "For each level-2 manager (direct reports of the CEO), return `manager_name` and `subtree_salary`: the sum of salaries of everyone in their subtree INCLUDING themselves. Largest first, ties by name.",
      hint: "Recursive CTE carrying the level-2 root's id down the tree, then GROUP BY root.",
      solution: `WITH RECURSIVE sub AS (
  SELECT emp_id, name AS root_name, emp_id AS root_id, salary
  FROM employees WHERE manager_id = 1
  UNION ALL
  SELECT e.emp_id, s.root_name, s.root_id, e.salary
  FROM employees e JOIN sub s ON e.manager_id = s.emp_id
)
SELECT root_name AS manager_name, SUM(salary) AS subtree_salary
FROM sub GROUP BY root_name ORDER BY subtree_salary DESC, manager_name`,
      orderSensitive: true, interview: true,
    },
    {
      id: "h6", title: "Deepest reporting chain", difficulty: 4, schema: "orbit",
      prompt: "Return one row, one column `max_depth`: the number of levels in the org (CEO = 1).",
      hint: "The level query from h3, then MAX.",
      solution: `WITH RECURSIVE org AS (
  SELECT emp_id, 1 AS level FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.emp_id, o.level + 1 FROM employees e JOIN org o ON e.manager_id = o.emp_id
)
SELECT MAX(level) AS max_depth FROM org`,
      interview: true,
    },
  ],
};

export const expressions: Module = {
  id: "expressions",
  title: "Text, dates & CASE", track: "core",
  blurb: "Format text, do date math, and write IF-style logic (CASE) — fast and correctly, under time pressure.",
  theory: `## Formulas, but in SQL
In a spreadsheet you write formulas on cells — uppercase a name, subtract two dates, an \`IF()\` that returns one thing or another. SQL has all three. This module is fluency: doing them fast and correctly under time pressure.

## Text
Glue with \`||\`, change case with \`UPPER\` / \`LOWER\`, cut with \`SUBSTRING\`, and collapse a whole group into one string with \`STRING_AGG\`.

\`\`\`sql
SELECT UPPER(name) || ' - ' || dept AS label FROM employees;
-- "ANA - Engineering"
\`\`\`

## Dates
Pull a part out with \`EXTRACT\`, bucket to the month with \`date_trunc\`, or subtract two dates to get days:

\`\`\`sql
EXTRACT(DOW FROM order_date)         -- day of week: 0 = Sunday
date_trunc('month', order_date)      -- snaps to the 1st of the month
delivered_on - ordered_on            -- whole number of days
\`\`\`

## CASE — SQL's IF
\`CASE\` returns different values per row, like a nested \`IF()\`:

\`\`\`sql
SELECT CASE WHEN hired_on < '2022-01-01' THEN 'veteran'
            WHEN hired_on < '2024-01-01' THEN 'established'
            ELSE 'recent' END AS tenure
FROM employees;
\`\`\`

## Two number traps that fail interviews
- **Integer division**: \`1 / 2\` is \`0\` in SQL, not \`0.5\`. Multiply by \`1.0\` or cast \`::numeric\` first: \`refunds::numeric / orders\`.
- **Divide by zero** crashes. Guard the denominator with \`NULLIF\`: \`x / NULLIF(y, 0)\` returns NULL instead of erroring — then \`COALESCE\` if you want a default.`,
  problems: [
    {
      id: "x1", title: "Employee badges (name and department)", difficulty: 1, schema: "orbit",
      prompt: "Return each employee's `emp_id` and `badge`: their name uppercased, followed by ' · ' and their dept (e.g. 'ANA PETROS · Engineering').",
      hint: "UPPER(name) || ' · ' || dept.",
      solution: "SELECT emp_id, UPPER(name) || ' · ' || dept AS badge FROM employees",
    },
    {
      id: "x2", title: "Plays by day of week", difficulty: 3, schema: "wavely",
      prompt: "Count plays by day of week: `dow` (0=Sunday … 6=Saturday, as a number) and `plays`, ordered by dow.",
      hint: "EXTRACT(DOW FROM played_on) — cast to int for clean output.",
      solution: `SELECT EXTRACT(DOW FROM played_on)::int AS dow, COUNT(*) AS plays
FROM plays GROUP BY 1 ORDER BY dow`,
      orderSensitive: true, interview: true,
    },
    {
      id: "x3", title: "Employees by tenure", difficulty: 3, schema: "orbit",
      prompt: "Bucket employees by hire date: 'veteran' (hired before 2022-01-01), 'established' (2022-2023), 'recent' (2024-01-01 or later). Return `bucket` and `n`, ordered veteran → established → recent.",
      hint: "CASE on hired_on; order with a CASE key.",
      solution: `WITH b AS (
  SELECT CASE WHEN hired_on < '2022-01-01' THEN 'veteran'
              WHEN hired_on < '2024-01-01' THEN 'established'
              ELSE 'recent' END AS bucket
  FROM employees
)
SELECT bucket, COUNT(*) AS n FROM b GROUP BY bucket
ORDER BY CASE bucket WHEN 'veteran' THEN 1 WHEN 'established' THEN 2 ELSE 3 END`,
      orderSensitive: true, interview: true,
    },
    {
      id: "x4", title: "Category refund ratio (divide-by-zero safe)", difficulty: 3, schema: "brightmart",
      prompt: "Per product category: `category`, `refund_ratio` = refunded completed orders ÷ completed orders containing the category — but categories with zero completed orders must show NULL, not error. Round to 3 decimals. Order by category.",
      hint: "COUNT(...) / NULLIF(COUNT(...), 0) — the denominator guard is the exercise.",
      solution: `WITH cat_orders AS (
  SELECT DISTINCT p.category, o.order_id, o.status
  FROM order_items i JOIN products p ON p.product_id = i.product_id
  JOIN orders o ON o.order_id = i.order_id
)
SELECT category,
       ROUND(COUNT(*) FILTER (WHERE status = 'completed' AND order_id IN (SELECT order_id FROM refunds))::numeric
             / NULLIF(COUNT(*) FILTER (WHERE status = 'completed'), 0), 3) AS refund_ratio
FROM cat_orders GROUP BY category ORDER BY category`,
      orderSensitive: true,
    },
    {
      id: "x5", title: "Monthly order counts with labels", difficulty: 2, schema: "brightmart",
      prompt: "Monthly order counts with human labels: `label` (TO_CHAR format 'YYYY-MM') and `n_orders`, ordered by label.",
      hint: "TO_CHAR(ordered_on, 'YYYY-MM'); group and order by it.",
      solution: `SELECT TO_CHAR(ordered_on, 'YYYY-MM') AS label, COUNT(*) AS n_orders
FROM orders GROUP BY 1 ORDER BY label`,
      orderSensitive: true,
    },
    {
      id: "x6", title: "Department rosters as one list", difficulty: 4, schema: "orbit",
      prompt: "Per dept: `dept` and `roster` — employee names joined by ', ' in alphabetical order. Order by dept.",
      hint: "STRING_AGG(name, ', ' ORDER BY name).",
      solution: `SELECT dept, STRING_AGG(name, ', ' ORDER BY name) AS roster
FROM employees GROUP BY dept ORDER BY dept`,
      orderSensitive: true, interview: true,
    },
  ],
};
