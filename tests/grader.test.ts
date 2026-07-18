/** Unit tests for the comparison core — pure, no engine. */

import { describe, expect, it } from "vitest";
import { compareResults, normalizeCell } from "../src/grader/grader";
import type { QueryResult } from "../src/engine/engine";

const qr = (columns: string[], rows: unknown[][]): QueryResult =>
  ({ columns, rows, elapsedMs: 0 });

describe("normalizeCell", () => {
  it("normalizes numeric strings like Postgres NUMERIC output", () => {
    expect(normalizeCell("42.50")).toBe(normalizeCell(42.5));
    expect(normalizeCell("42")).toBe(normalizeCell(42));
  });
  it("treats NULL as distinct from the string 'null' and empty string", () => {
    expect(normalizeCell(null)).not.toBe(normalizeCell("null"));
    expect(normalizeCell(null)).not.toBe(normalizeCell(""));
  });
  it("normalizes Date objects and midnight timestamps to ISO days", () => {
    expect(normalizeCell(new Date("2025-03-01T00:00:00Z"))).toBe("2025-03-01");
    expect(normalizeCell("2025-03-01 00:00:00")).toBe("2025-03-01");
  });
  it("keeps float precision differences within tolerance equal", () => {
    expect(normalizeCell(0.30000000000000004)).toBe(normalizeCell(0.3));
  });
});

describe("compareResults", () => {
  const expected = qr(["a", "b"], [[1, "x"], [2, "y"]]);

  it("accepts same rows in different order by default", () => {
    const actual = qr(["a", "b"], [[2, "y"], [1, "x"]]);
    expect(compareResults(actual, expected, false).correct).toBe(true);
  });

  it("rejects wrong order when orderSensitive", () => {
    const actual = qr(["a", "b"], [[2, "y"], [1, "x"]]);
    const verdict = compareResults(actual, expected, true);
    expect(verdict.correct).toBe(false);
    expect(verdict.message).toMatch(/order/i);
  });

  it("accepts different column names (aliases) with same data", () => {
    const actual = qr(["alpha", "beta"], [[1, "x"], [2, "y"]]);
    expect(compareResults(actual, expected, false).correct).toBe(true);
  });

  it("rejects wrong column count with a clear message", () => {
    const actual = qr(["a"], [[1], [2]]);
    const verdict = compareResults(actual, expected, false);
    expect(verdict.correct).toBe(false);
    expect(verdict.message).toMatch(/Expected 2 column/);
  });

  it("duplicates matter: multiset comparison catches fan-out", () => {
    const actual = qr(["a", "b"], [[1, "x"], [1, "x"], [2, "y"]]);
    const verdict = compareResults(actual, expected, false);
    expect(verdict.correct).toBe(false);
    expect(verdict.message).toMatch(/1 unexpected/);
  });

  it("reports missing rows with samples", () => {
    const actual = qr(["a", "b"], [[1, "x"]]);
    const verdict = compareResults(actual, expected, false);
    expect(verdict.correct).toBe(false);
    expect(verdict.missingSample).toEqual([["2", "y"]]);
  });

  it("NUMERIC-string vs number cells compare equal", () => {
    const actual = qr(["a", "b"], [["1", "x"], ["2", "y"]]);
    expect(compareResults(actual, expected, false).correct).toBe(true);
  });

  it("NULL cells match only NULL", () => {
    const withNull = qr(["a"], [[null]]);
    expect(compareResults(qr(["a"], [[null]]), withNull, false).correct).toBe(true);
    expect(compareResults(qr(["a"], [["null"]]), withNull, false).correct).toBe(false);
  });
});
