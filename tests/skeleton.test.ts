/** Unit tests for query skeletons — pure, no engine. */

import { describe, expect, it } from "vitest";
import { skeleton } from "../src/content/skeleton";

describe("skeleton", () => {
  it("keeps the clause keywords that carry the shape", () => {
    const out = skeleton("SELECT name FROM users WHERE country = 'US' ORDER BY name");
    expect(out).toContain("SELECT");
    expect(out).toContain("FROM");
    expect(out).toContain("WHERE");
    expect(out).toContain("ORDER BY");
  });

  it("blanks column and table names", () => {
    const out = skeleton("SELECT username FROM users");
    expect(out).not.toContain("username");
    expect(out).not.toContain("users");
    expect(out).toBe("SELECT ___ FROM ___");
  });

  it("blanks string literals, which usually are the answer", () => {
    expect(skeleton("SELECT a FROM b WHERE c = 'DE'")).not.toContain("DE");
  });

  it("blanks numbers", () => {
    expect(skeleton("SELECT a FROM b LIMIT 5")).not.toContain("5");
  });

  it("keeps which aggregate is used, because that is the lesson", () => {
    const out = skeleton("SELECT COUNT(*) FROM t GROUP BY x HAVING COUNT(*) > 1");
    expect(out).toContain("COUNT");
    expect(out).toContain("GROUP BY");
    expect(out).toContain("HAVING");
  });

  it("keeps window function structure", () => {
    const out = skeleton(
      "SELECT ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY played_on DESC) FROM plays",
    );
    expect(out).toContain("ROW_NUMBER");
    expect(out).toContain("OVER");
    expect(out).toContain("PARTITION BY");
    expect(out).not.toContain("user_id");
    expect(out).not.toContain("played_on");
  });

  it("blanks qualified names entirely, alias included", () => {
    const out = skeleton("SELECT p.category FROM products p");
    expect(out).not.toContain("category");
    expect(out).not.toContain("p.");
  });

  it("strips comments, which often give the answer away", () => {
    const out = skeleton("-- use NOT EXISTS here\nSELECT a FROM b");
    expect(out).not.toContain("NOT EXISTS here");
    expect(out).not.toContain("--");
  });

  it("keeps NOT EXISTS and IS NULL, which are the point of several problems", () => {
    const out = skeleton("SELECT a FROM b WHERE NOT EXISTS (SELECT 1 FROM c) AND d IS NULL");
    expect(out).toContain("NOT EXISTS");
    expect(out).toContain("IS NULL");
  });

  it("preserves line structure so a CTE still looks like a CTE", () => {
    const sql = "WITH t AS (\n  SELECT a FROM b\n)\nSELECT * FROM t";
    const out = skeleton(sql);
    expect(out).toContain("WITH");
    expect(out.split("\n").length).toBeGreaterThan(2);
  });

  it("never returns an empty string for real SQL", () => {
    expect(skeleton("SELECT 1").length).toBeGreaterThan(0);
  });
});
