/**
 * Query skeletons.
 *
 * The gap between "I have no idea" and "show me the answer" is where the
 * learning actually happens, and a binary reveal skips straight over it. A
 * skeleton keeps the shape of the solution and blanks out the specifics, so
 * you can see that the answer needs a window function partitioned by
 * something, without being told what.
 *
 * Deriving this mechanically rather than authoring it means every problem has
 * one, including the 145 off the Core Path. Keywords, punctuation and
 * structure survive; identifiers, literals and aliases become blanks.
 */

/** Reserved words that carry structure and should stay visible. */
const KEYWORDS = new Set([
  "select", "from", "where", "group", "by", "having", "order", "limit", "offset",
  "join", "inner", "left", "right", "full", "outer", "cross", "lateral", "on",
  "using", "with", "recursive", "as", "and", "or", "not", "in", "exists",
  "between", "like", "ilike", "is", "null", "distinct", "case", "when", "then",
  "else", "end", "union", "intersect", "except", "all", "any", "asc", "desc",
  "over", "partition", "rows", "range", "preceding", "following", "current",
  "row", "unbounded", "filter", "within", "grouping", "sets", "rollup", "cube",
  "insert", "into", "values", "update", "set", "delete", "conflict", "do",
  "nothing", "returning", "begin", "commit", "rollback", "nulls", "first", "last",
  // aggregate and window functions: which function it is, is the lesson
  "count", "sum", "avg", "min", "max", "round", "coalesce", "nullif",
  "row_number", "rank", "dense_rank", "ntile", "lag", "lead", "percent_rank",
  "percentile_cont", "percentile_disc", "stddev", "generate_series", "date_trunc",
  "extract", "string_agg", "array_agg", "json_agg", "json_build_object",
  "width_bucket", "split_part", "concat", "upper", "lower", "left", "substring",
  "abs", "greatest", "least", "cast", "interval", "date", "numeric", "int",
  "integer", "text", "true", "false",
]);

/** A blank stands in for a name or value the learner has to supply. */
const BLANK = "___";

/**
 * Turn a solution into a skeleton.
 *
 * Deliberately conservative: when in doubt it keeps the token, because a
 * skeleton that hides too much is no more useful than no skeleton at all.
 */
export function skeleton(sql: string): string {
  // Strip comments first; they frequently give the answer away.
  const cleaned = sql.replace(/--[^\n]*/g, "");

  return cleaned.replace(
    // string literals | numbers | qualified or bare identifiers | anything else
    /'[^']*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?\b/g,
    (token) => {
      if (token.startsWith("'")) return BLANK;
      if (/^\d/.test(token)) return BLANK;

      // Qualified names like p.category: blank the whole thing, since the
      // alias is usually as informative as the column.
      const head = token.split(".")[0].toLowerCase();
      const whole = token.toLowerCase();
      if (KEYWORDS.has(whole)) return token;
      if (token.includes(".")) return BLANK;
      if (KEYWORDS.has(head)) return token;
      return BLANK;
    },
  ).replace(/\n{3,}/g, "\n\n").trim();
}
