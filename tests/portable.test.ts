/** Unit tests for portable progress — pure, no engine, no DOM. */

import { describe, expect, it } from "vitest";
import { decodeProgress, encodeProgress } from "../src/progress/portable";

const sample = {
  solved: ["wu1", "wu2", "n3", "w3-b", "ga7"],
  days: ["2026-07-29", "2026-07-30", "2026-07-31"],
};

describe("portable progress", () => {
  it("round-trips exactly", () => {
    const out = decodeProgress(encodeProgress(sample));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toEqual(sample);
  });

  it("round-trips an empty history", () => {
    const out = decodeProgress(encodeProgress({ solved: [], days: [] }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toEqual({ solved: [], days: [] });
  });

  it("stays small enough to paste even with everything solved", () => {
    // Guards against the encoding ballooning, not against an exact size. With
    // the real content — ids are 2-4 characters — everything solved plus a
    // year of activity encodes to about 1,760. This uses deliberately longer
    // ids so the bound has headroom.
    const big = {
      solved: Array.from({ length: 185 }, (_, i) => `w${i}-b`),
      days: Array.from({ length: 365 }, (_, i) =>
        new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)),
    };
    expect(encodeProgress(big).length).toBeLessThan(3000);
  });

  it("keeps only recent solve days, which is all the streak reads", () => {
    const days = Array.from({ length: 365 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
    const out = decodeProgress(encodeProgress({ solved: [], days }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.days).toHaveLength(90);
      // the most recent day must survive, or the streak breaks on restore
      expect(out.value.days.at(-1)).toBe(days.at(-1));
    }
  });

  it("rejects a truncated code rather than restoring half of it", () => {
    const code = encodeProgress(sample);
    const out = decodeProgress(code.slice(0, code.length - 12));
    expect(out.ok).toBe(false);
  });

  it("rejects a code whose payload was edited", () => {
    const [p, body, sum] = encodeProgress(sample).split(".");
    const out = decodeProgress(`${p}.${body.slice(0, -4)}AAAA.${sum}`);
    expect(out.ok).toBe(false);
  });

  it("rejects unrelated text with a readable message", () => {
    const out = decodeProgress("hello world");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/SQLGym progress code/);
  });

  it("rejects empty input", () => {
    const out = decodeProgress("   ");
    expect(out.ok).toBe(false);
  });

  it("survives ids containing hyphens, which variants use", () => {
    const withVariants = { solved: ["f1-b", "f1-c", "p4-b"], days: [] };
    const out = decodeProgress(encodeProgress(withVariants));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.solved).toEqual(withVariants.solved);
  });
});
