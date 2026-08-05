/** Unit tests for spaced review scheduling — pure, no storage, no DOM. */

import { describe, expect, it } from "vitest";
import {
  baseId, dueIds, INTERVALS, isGraduated, onCorrect, onIncorrect, pickForReview,
  type Reviews,
} from "../src/progress/review";

describe("scheduling", () => {
  it("puts a first solve one day out", () => {
    const e = onCorrect(undefined, "2026-08-05");
    expect(e.stage).toBe(0);
    expect(e.due).toBe("2026-08-06");
  });

  it("widens the interval on each correct review", () => {
    let e = onCorrect(undefined, "2026-08-05");   // due +1
    e = onCorrect(e, "2026-08-06");                // due +3
    expect(e.due).toBe("2026-08-09");
    e = onCorrect(e, "2026-08-09");                // due +7
    expect(e.due).toBe("2026-08-16");
    e = onCorrect(e, "2026-08-16");                // due +21
    expect(e.due).toBe("2026-09-06");
  });

  it("graduates after the last interval", () => {
    let e = onCorrect(undefined, "2026-08-05");
    for (let i = 0; i < INTERVALS.length; i++) e = onCorrect(e, "2026-08-05");
    expect(isGraduated(e)).toBe(true);
  });

  it("a graduated item never comes up again", () => {
    let e = onCorrect(undefined, "2026-01-01");
    for (let i = 0; i < INTERVALS.length; i++) e = onCorrect(e, "2026-01-01");
    expect(dueIds({ x: e }, "2030-01-01")).toEqual([]);
  });

  it("drops back one interval on a wrong answer, not to zero", () => {
    let e = onCorrect(undefined, "2026-08-05");
    e = onCorrect(e, "2026-08-06");
    e = onCorrect(e, "2026-08-09");   // stage 2, the 7 day interval
    expect(e.stage).toBe(2);
    const after = onIncorrect(e, "2026-08-10");
    expect(after.stage).toBe(1);      // back to 3 days, not back to 1
    expect(after.due).toBe("2026-08-13");
  });

  it("cannot drop below the first interval", () => {
    const e = onCorrect(undefined, "2026-08-05");
    const after = onIncorrect(e, "2026-08-06");
    expect(after.stage).toBe(0);
  });
});

describe("what is due", () => {
  const reviews: Reviews = {
    old:    { stage: 1, due: "2026-08-01", last: "2026-07-29" },
    today:  { stage: 0, due: "2026-08-05", last: "2026-08-04" },
    future: { stage: 2, due: "2026-08-20", last: "2026-08-13" },
  };

  it("includes overdue and due today, excludes the future", () => {
    expect(dueIds(reviews, "2026-08-05")).toEqual(["old", "today"]);
  });

  it("returns the most overdue first", () => {
    expect(dueIds(reviews, "2026-08-05")[0]).toBe("old");
  });

  it("is empty when nothing is due", () => {
    expect(dueIds(reviews, "2026-07-01")).toEqual([]);
  });
});

describe("choosing what to serve", () => {
  const all = ["f1", "f1-b", "f1-c", "n3", "w3", "w3-b"];

  it("strips variant suffixes to find the family", () => {
    expect(baseId("f1-b")).toBe("f1");
    expect(baseId("f1")).toBe("f1");
    expect(baseId("wu11")).toBe("wu11");
  });

  it("serves a variant the learner has not solved", () => {
    const solved = (id: string) => id === "f1";
    expect(pickForReview("f1", all, solved)).toBe("f1-b");
  });

  it("serves the next unseen variant once the first is used", () => {
    const solved = (id: string) => id === "f1" || id === "f1-b";
    expect(pickForReview("f1", all, solved)).toBe("f1-c");
  });

  it("falls back to the original when every variant is solved", () => {
    const solved = () => true;
    expect(pickForReview("f1", all, solved)).toBe("f1");
  });

  it("falls back to the original when there are no variants", () => {
    expect(pickForReview("n3", all, () => true)).toBe("n3");
  });

  it("finds the family when the due item is itself a variant", () => {
    const solved = (id: string) => id === "f1-b";
    expect(pickForReview("f1-b", all, solved)).toBe("f1");
  });
});
