/**
 * Postgres error translation.
 *
 * The database says `column "usernam" does not exist`, which is precise and
 * unhelpful to someone learning. Worse, the most common beginner errors are
 * the ones with the most opaque messages: the GROUP BY rule reads like a
 * compiler diagnostic but is really a conceptual point about aggregation.
 *
 * Each rule turns an error into a plain sentence plus, where there is one,
 * the idea behind it. The raw text is always still shown underneath — this
 * explains, it never hides.
 */

export interface Explained {
  /** One sentence, plain language, no jargon the learner has not met yet. */
  title: string;
  /** The concept, when the error is really about a concept. */
  hint?: string;
}

type Rule = [test: RegExp, build: (m: RegExpMatchArray) => Explained];

const RULES: Rule[] = [
  [
    /column "([^"]+)" does not exist/i,
    (m) => ({
      title: `There is no column called ${m[1]}.`,
      hint: "Open Tables below the prompt to see the exact column names. Postgres folds unquoted names to lower case, so Username and username are the same, but userName in double quotes is not.",
    }),
  ],
  [
    /relation "([^"]+)" does not exist/i,
    (m) => ({
      title: `There is no table called ${m[1]}.`,
      hint: "Check Tables below the prompt. Each problem only has the tables listed there.",
    }),
  ],
  [
    /column "([^"]+)" must appear in the GROUP BY clause or be used in an aggregate function/i,
    (m) => ({
      title: `${m[1]} needs to be either grouped or aggregated.`,
      hint: "Once you GROUP BY, each output row stands for many input rows. Every column you select has to be one of the things you grouped by, or wrapped in an aggregate like COUNT or SUM, because otherwise there is no single value to show.",
    }),
  ],
  [
    /aggregate functions are not allowed in WHERE/i,
    () => ({
      title: "An aggregate cannot go in WHERE.",
      hint: "WHERE runs before rows are grouped, so COUNT and SUM do not exist yet. Filter on an aggregate in HAVING instead.",
    }),
  ],
  [
    /window functions are not allowed in WHERE/i,
    () => ({
      title: "A window function cannot go in WHERE.",
      hint: "Window functions are computed after WHERE has already run. Put the query in a CTE or subquery, then filter on the result in an outer query.",
    }),
  ],
  [
    /syntax error at or near "([^"]+)"/i,
    (m) => ({
      title: `Postgres could not parse the query around ${m[1]}.`,
      hint: "Usually a missing comma between columns, an unclosed bracket, or a keyword in the wrong order. SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT is the order Postgres expects.",
    }),
  ],
  [
    /division by zero/i,
    () => ({
      title: "Something divided by zero.",
      hint: "Wrap the denominator in NULLIF(x, 0). Dividing by NULL gives NULL instead of an error, which is usually what you want in a rate.",
    }),
  ],
  [
    /operator does not exist: ([^\s]+) ([^\s]+) ([^\s]+)/i,
    (m) => ({
      title: `You cannot use ${m[2]} between a ${m[1]} and a ${m[3]}.`,
      hint: "The two sides are different types. Cast one of them, for example value::numeric or value::date.",
    }),
  ],
  [
    /invalid input syntax for type (\w+)/i,
    (m) => ({
      title: `A value could not be read as a ${m[1]}.`,
      hint: "Check quoting. Dates and numbers need to match the column's type, and a quoted number is text until you cast it.",
    }),
  ],
  [
    /each UNION query must have the same number of columns/i,
    () => ({
      title: "The two halves of the UNION return different numbers of columns.",
      hint: "UNION stacks results vertically, so both sides need the same column count in the same order with compatible types.",
    }),
  ],
  [
    /subquery (?:must return only one column|has too many columns)/i,
    () => ({
      title: "That subquery returns more than one column.",
      hint: "Used where a single value is expected, a subquery must select exactly one column. EXISTS is the right tool when you only care whether a row is there.",
    }),
  ],
  [
    /more than one row returned by a subquery/i,
    () => ({
      title: "That subquery returned several rows where one value was expected.",
      hint: "Add an aggregate like MAX, or a LIMIT 1 with an explicit ORDER BY so which row you get is not left to chance.",
    }),
  ],
  [
    /missing FROM-clause entry for table "([^"]+)"/i,
    (m) => ({
      title: `${m[1]} is used but never joined or listed in FROM.`,
      hint: "Either add the table to the query, or the alias you are using does not match the one you declared.",
    }),
  ],
  [
    /column reference "([^"]+)" is ambiguous/i,
    (m) => ({
      title: `${m[1]} exists in more than one of the joined tables.`,
      hint: "Say which one you mean by prefixing the alias, for example u.user_id rather than user_id.",
    }),
  ],
];

export function explainError(raw: string): Explained | null {
  for (const [test, build] of RULES) {
    const m = raw.match(test);
    if (m) return build(m);
  }
  return null;
}
