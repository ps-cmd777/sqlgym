/** Module 0: warm-up drills — true beginner start, one concept per problem. */

import type { Module } from "./types";

export const warmups: Module = {
  id: "warmups",
  title: "First steps: reading data", track: "core",
  blurb: "Your first queries: SELECT, WHERE, ORDER BY, LIMIT — one new idea at a time.",
  theory: `## Reading a table with SELECT
A table is rows and columns, like a spreadsheet. \`SELECT\` chooses columns; \`FROM\` names the table:
\`\`\`sql
SELECT username, country FROM users;
\`\`\`
\`SELECT *\` means "all columns" — fine for exploring, avoided in final answers.

## Filtering rows with WHERE
\`WHERE\` keeps only rows that match a condition: \`=\`, \`<>\`, \`<\`, \`>\`, \`AND\`, \`OR\`, \`IN (…)\`, \`BETWEEN\`, and \`LIKE\` for text patterns (\`%\` = anything).

## Sorting and limiting
\`ORDER BY col\` sorts ascending; add \`DESC\` for descending. \`LIMIT n\` keeps the first n rows *after* sorting — together they answer every "top…" question.

## Counting
\`COUNT(*)\` counts rows. Add \`WHERE\` first to count a subset. That's your first aggregate — the deep end of aggregation comes in the next module.`,
  problems: [
    {
      id: "wu1", title: "List every track's title and artist", difficulty: 1, schema: "wavely",
      prompt: "Return the `title` and `artist` of every track.",
      hint: "SELECT title, artist FROM tracks",
      solution: "SELECT title, artist FROM tracks",
    },
    {
      id: "wu2", title: "List product names and prices", difficulty: 1, schema: "brightmart",
      prompt: "Return `product_name` and `price` for all products.",
      hint: "Two columns, one table: products.",
      solution: "SELECT product_name, price FROM products",
    },
    {
      id: "wu3", title: "Find users from the US", difficulty: 1, schema: "wavely",
      prompt: "Return the `username` of every user from the US.",
      hint: "WHERE country = 'US' — text needs single quotes.",
      solution: "SELECT username FROM users WHERE country = 'US'",
    },
    {
      id: "wu4", title: "Products priced over 100", difficulty: 1, schema: "brightmart",
      prompt: "Return `product_name` and `price` of products costing more than 100.",
      hint: "WHERE price > 100 — numbers don't need quotes.",
      solution: "SELECT product_name, price FROM products WHERE price > 100",
    },
    {
      id: "wu5", title: "Long rock tracks", difficulty: 1, schema: "wavely",
      prompt: "Return the `title` of tracks in the 'rock' genre that are longer than 200 seconds.",
      hint: "Combine with AND: genre = 'rock' AND duration_s > 200.",
      solution: "SELECT title FROM tracks WHERE genre = 'rock' AND duration_s > 200",
    },
    {
      id: "wu6", title: "Users in Spain, Italy, or Poland", difficulty: 1, schema: "wavely",
      prompt: "Return `username` and `country` of users from Spain ('ES') or Italy ('IT') or Poland ('PL').",
      hint: "country IN ('ES', 'IT', 'PL') beats three ORs.",
      solution: "SELECT username, country FROM users WHERE country IN ('ES', 'IT', 'PL')",
    },
    {
      id: "wu7", title: "Products whose name ends in 1", difficulty: 1, schema: "brightmart",
      prompt: "Return the `product_name` of products whose name ends in '1' (e.g. 'Product 1', 'Product 11', 'Product 21').",
      hint: "LIKE '%1' — the % matches anything before.",
      solution: "SELECT product_name FROM products WHERE product_name LIKE '%1'",
    },
    {
      id: "wu8", title: "Products from most to least expensive", difficulty: 1, schema: "brightmart",
      prompt: "Return `product_name` and `price` of ALL products, most expensive first. Break price ties by product_name alphabetically.",
      hint: "ORDER BY price DESC, product_name.",
      solution: "SELECT product_name, price FROM products ORDER BY price DESC, product_name",
      orderSensitive: true,
    },
    {
      id: "wu9", title: "The five longest tracks", difficulty: 1, schema: "wavely",
      prompt: "Return the `title` and `duration_s` of the 5 longest tracks, longest first (break ties by title).",
      hint: "ORDER BY duration_s DESC, title — then LIMIT 5.",
      solution: "SELECT title, duration_s FROM tracks ORDER BY duration_s DESC, title LIMIT 5",
      orderSensitive: true,
    },
    {
      id: "wu10", title: "Count all customers", difficulty: 1, schema: "brightmart",
      prompt: "How many customers are there in total? Return one column `n`.",
      hint: "SELECT COUNT(*) AS n FROM customers.",
      solution: "SELECT COUNT(*) AS n FROM customers",
    },
    {
      id: "wu11", title: "Count jazz tracks", difficulty: 1, schema: "wavely",
      prompt: "How many tracks are in the 'jazz' genre? Return one column `n`.",
      hint: "COUNT(*) plus WHERE genre = 'jazz'.",
      solution: "SELECT COUNT(*) AS n FROM tracks WHERE genre = 'jazz'",
    },
    {
      id: "wu12", title: "Orders placed in December 2025", difficulty: 1, schema: "brightmart",
      prompt: "Return `order_id` and `ordered_on` for orders placed in December 2025 (any status), earliest first; break ties by order_id.",
      hint: "ordered_on >= '2025-12-01' AND ordered_on < '2026-01-01'.",
      solution: "SELECT order_id, ordered_on FROM orders WHERE ordered_on >= '2025-12-01' AND ordered_on < '2026-01-01' ORDER BY ordered_on, order_id",
      orderSensitive: true,
    },
  ],
};
