/** Module 0: warm-up drills — true beginner start, one concept per problem. */

import type { Module } from "./types";

export const warmups: Module = {
  id: "warmups",
  title: "First steps: reading data", track: "core",
  blurb: "Your first queries: SELECT, WHERE, ORDER BY, LIMIT — one new idea at a time.",
  theory: `## A table is a spreadsheet
A database table is rows and columns, exactly like a spreadsheet tab. Reading it is four simple moves — pick columns, filter rows, sort, cut.

\`\`\`
users                       <- the "tracks" / "users" tables work the same way
user_id | username | country
1       | ana      | US
2       | boris    | DE
3       | carmen   | US
\`\`\`

## SELECT — pick which columns
\`SELECT\` chooses columns; \`FROM\` names the table.

\`\`\`sql
SELECT username, country FROM users;
\`\`\`
\`SELECT *\` means "every column" — handy for a quick look, but name your columns in real answers.

## WHERE — keep only some rows
\`WHERE\` throws away rows that don't match. Text goes in single quotes; numbers don't.

\`\`\`sql
SELECT username FROM users WHERE country = 'US';   -- ana, carmen
\`\`\`
Combine with \`AND\` / \`OR\`. \`IN ('US','DE')\` is a tidy way to say "any of these." \`LIKE 'a%'\` matches text patterns (\`%\` = anything).

## ORDER BY and LIMIT — sort, then take the top
\`ORDER BY\` sorts (add \`DESC\` for high-to-low). \`LIMIT n\` keeps the first n rows **after** sorting — together they answer every "top 5…" question.

\`\`\`sql
SELECT title FROM tracks ORDER BY duration_s DESC LIMIT 5;   -- 5 longest
\`\`\`

## COUNT — how many?
\`COUNT(*)\` counts rows. Add a \`WHERE\` first to count just a subset.

\`\`\`sql
SELECT COUNT(*) FROM tracks WHERE genre = 'jazz';
\`\`\`
That's your first taste of aggregation — the next module goes deeper.`,
  problems: [
    {
      id: "wu1", title: "List every track's title and artist", difficulty: 1, schema: "wavely",
      takeaway:
        "`SELECT` chooses columns, `FROM` chooses the table. Naming the two columns you want beats `SELECT *`, which breaks quietly the day someone adds a column.",
      prompt: "Return the `title` and `artist` of every track.",
      hint: "SELECT title, artist FROM tracks",
      solution: "SELECT title, artist FROM tracks",
    },
    {
      id: "wu2", title: "List product names and prices", difficulty: 1, schema: "brightmart",
      takeaway:
        "Column order in `SELECT` is the column order you get back. It costs nothing to put the identifying column first and makes results far easier to read.",
      prompt: "Return `product_name` and `price` for all products.",
      hint: "Two columns, one table: products.",
      solution: "SELECT product_name, price FROM products",
    },
    {
      id: "wu3", title: "Find users from the US", difficulty: 1, schema: "wavely",
      takeaway:
        "String comparison needs quotes: `country = 'US'`. Double quotes mean something else in SQL, they name a column.",
      prompt: "Return the `username` of every user from the US.",
      hint: "WHERE country = 'US' — text needs single quotes.",
      solution: "SELECT username FROM users WHERE country = 'US'",
    },
    {
      id: "wu4", title: "Products priced over 100", difficulty: 1, schema: "brightmart",
      takeaway:
        "`WHERE` is evaluated per row and keeps only the rows where the condition is true.",
      prompt: "Return `product_name` and `price` of products costing more than 100.",
      hint: "WHERE price > 100 — numbers don't need quotes.",
      solution: "SELECT product_name, price FROM products WHERE price > 100",
    },
    {
      id: "wu5", title: "Long rock tracks", difficulty: 1, schema: "wavely",
      takeaway:
        "Conditions combine with `AND` and `OR`. When you mix them, use brackets, because `AND` binds tighter and that is a classic silent bug.",
      prompt: "Return the `title` of tracks in the 'rock' genre that are longer than 200 seconds.",
      hint: "Combine with AND: genre = 'rock' AND duration_s > 200.",
      solution: "SELECT title FROM tracks WHERE genre = 'rock' AND duration_s > 200",
    },
    {
      id: "wu6", title: "Users in Spain, Italy, or Poland", difficulty: 1, schema: "wavely",
      takeaway:
        "`IN (a, b, c)` is a readable shorthand for a chain of `OR`s on the same column.",
      prompt: "Return `username` and `country` of users from Spain ('ES') or Italy ('IT') or Poland ('PL').",
      hint: "country IN ('ES', 'IT', 'PL') beats three ORs.",
      solution: "SELECT username, country FROM users WHERE country IN ('ES', 'IT', 'PL')",
    },
    {
      id: "wu7", title: "Products whose name ends in 1", difficulty: 1, schema: "brightmart",
      takeaway:
        "`LIKE` with `%` matches any run of characters; `_` matches exactly one. `%` at the start of a pattern stops an index from helping.",
      prompt: "Return the `product_name` of products whose name ends in '1' (e.g. 'Product 1', 'Product 11', 'Product 21').",
      hint: "LIKE '%1' — the % matches anything before.",
      solution: "SELECT product_name FROM products WHERE product_name LIKE '%1'",
    },
    {
      id: "wu8", title: "Products from most to least expensive", difficulty: 1, schema: "brightmart",
      takeaway:
        "`ORDER BY x DESC` sorts high to low. Without `ORDER BY`, the database is free to return rows in any order at all, and it will change on you.",
      prompt: "Return `product_name` and `price` of ALL products, most expensive first. Break price ties by product_name alphabetically.",
      hint: "ORDER BY price DESC, product_name.",
      solution: "SELECT product_name, price FROM products ORDER BY price DESC, product_name",
      orderSensitive: true,
    },
    {
      id: "wu9", title: "The five longest tracks", difficulty: 1, schema: "wavely",
      takeaway:
        "`LIMIT` is applied last, after sorting. `LIMIT` without `ORDER BY` gives you an arbitrary handful, not the top ones.",
      prompt: "Return the `title` and `duration_s` of the 5 longest tracks, longest first (break ties by title).",
      hint: "ORDER BY duration_s DESC, title — then LIMIT 5.",
      solution: "SELECT title, duration_s FROM tracks ORDER BY duration_s DESC, title LIMIT 5",
      orderSensitive: true,
    },
    {
      id: "wu10", title: "Count all customers", difficulty: 1, schema: "brightmart",
      takeaway:
        "`COUNT(*)` counts rows in the group, and with no `GROUP BY` the whole table is one group.",
      prompt: "How many customers are there in total? Return one column `n`.",
      hint: "SELECT COUNT(*) AS n FROM customers.",
      solution: "SELECT COUNT(*) AS n FROM customers",
    },
    {
      id: "wu11", title: "Count jazz tracks", difficulty: 1, schema: "wavely",
      takeaway:
        "`WHERE` narrows the rows first, then the aggregate runs over what is left.",
      prompt: "How many tracks are in the 'jazz' genre? Return one column `n`.",
      hint: "COUNT(*) plus WHERE genre = 'jazz'.",
      solution: "SELECT COUNT(*) AS n FROM tracks WHERE genre = 'jazz'",
    },
    {
      id: "wu12", title: "Orders placed in December 2025", difficulty: 1, schema: "brightmart",
      takeaway:
        "For a whole month, `>= '2025-12-01' AND < '2026-01-01'` is safer than `BETWEEN`, which would miss timestamps late on the last day.",
      prompt: "Return `order_id` and `ordered_on` for orders placed in December 2025 (any status), earliest first; break ties by order_id.",
      hint: "ordered_on >= '2025-12-01' AND ordered_on < '2026-01-01'.",
      solution: "SELECT order_id, ordered_on FROM orders WHERE ordered_on >= '2025-12-01' AND ordered_on < '2026-01-01' ORDER BY ordered_on, order_id",
      orderSensitive: true,
    },
  ],
};
