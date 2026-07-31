/** Unit tests for Postgres error translation — pure, no engine. */

import { describe, expect, it } from "vitest";
import { explainError } from "../src/grader/explain";

describe("explainError", () => {
  it("names the missing column", () => {
    const ex = explainError('column "usernam" does not exist');
    expect(ex?.title).toContain("usernam");
    expect(ex?.hint).toBeTruthy();
  });

  it("explains the GROUP BY rule conceptually, not mechanically", () => {
    const ex = explainError(
      'column "users.username" must appear in the GROUP BY clause or be used in an aggregate function',
    );
    expect(ex?.title).toContain("users.username");
    // The value here is the idea, not a restatement of the error.
    expect(ex?.hint).toMatch(/stands for many input rows/);
  });

  it("routes aggregate-in-WHERE to HAVING", () => {
    const ex = explainError("aggregate functions are not allowed in WHERE");
    expect(ex?.hint).toMatch(/HAVING/);
  });

  it("explains why a window function cannot be filtered in WHERE", () => {
    const ex = explainError("window functions are not allowed in WHERE");
    expect(ex?.hint).toMatch(/CTE|subquery/i);
  });

  it("points divide-by-zero at NULLIF", () => {
    expect(explainError("division by zero")?.hint).toMatch(/NULLIF/);
  });

  it("quotes the token a syntax error happened near", () => {
    const ex = explainError('syntax error at or near "FROM"');
    expect(ex?.title).toContain("FROM");
  });

  it("disambiguates an ambiguous column", () => {
    const ex = explainError('column reference "user_id" is ambiguous');
    expect(ex?.title).toContain("user_id");
    expect(ex?.hint).toMatch(/alias/i);
  });

  it("returns null for anything it does not recognise, so the raw text shows", () => {
    expect(explainError("some novel error nobody has seen")).toBeNull();
  });

  it("never returns an empty title for a rule it matched", () => {
    const samples = [
      'column "x" does not exist',
      'relation "y" does not exist',
      "division by zero",
      'syntax error at or near "SELCT"',
      "more than one row returned by a subquery used as an expression",
      'missing FROM-clause entry for table "u"',
      "each UNION query must have the same number of columns",
      "invalid input syntax for type integer",
    ];
    for (const s of samples) {
      const ex = explainError(s);
      expect(ex, s).not.toBeNull();
      expect(ex!.title.length, s).toBeGreaterThan(10);
    }
  });
});
