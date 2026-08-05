/**
 * Spaced review.
 *
 * Solving a problem once is not the same as knowing it. Three weeks after you
 * work out the NOT IN trap you have usually lost it again, and a practice site
 * that never asks twice cannot tell the difference between someone who learned
 * something and someone who happened to get it right on a Tuesday.
 *
 * So every solved Core Path step comes back on a widening schedule: one day,
 * then three, then a week, then three weeks. Get it right and it moves on to
 * the next interval. Get it wrong and it drops back one, because forgetting is
 * information, not a punishment.
 *
 * Where a problem has variants, review serves a variant instead of the one you
 * already solved. Recalling the shape is the point; recognising the wording is
 * not.
 */

/** Days between reviews. Four intervals is enough for interview preparation;
 *  anything longer than three weeks belongs to a different kind of product. */
export const INTERVALS = [1, 3, 7, 21] as const;

export interface ReviewEntry {
  /** Index into INTERVALS. At INTERVALS.length the item has graduated. */
  stage: number;
  /** ISO day this becomes due. */
  due: string;
  /** ISO day it was last answered, for display. */
  last: string;
}

export type Reviews = Record<string, ReviewEntry>;

export const today = (d = new Date()): string => d.toLocaleDateString("sv");

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return today(d);
}

/** True once an item has passed every interval and needs no more reviews. */
export const isGraduated = (e: ReviewEntry) => e.stage >= INTERVALS.length;

/**
 * A correct answer. A brand new solve enters at stage 0 and comes back
 * tomorrow; a correct review advances one interval.
 */
export function onCorrect(entry: ReviewEntry | undefined, now = today()): ReviewEntry {
  const stage = entry ? Math.min(entry.stage + 1, INTERVALS.length) : 0;
  const interval = INTERVALS[Math.min(stage, INTERVALS.length - 1)];
  return { stage, due: addDays(now, interval), last: now };
}

/**
 * A wrong answer on something already scheduled. Drop back one interval rather
 * than resetting to zero: one slip does not undo three weeks of recall, and
 * resetting hard is the thing that makes review systems feel punitive.
 */
export function onIncorrect(entry: ReviewEntry, now = today()): ReviewEntry {
  const stage = Math.max(0, entry.stage - 1);
  return { stage, due: addDays(now, INTERVALS[stage]), last: now };
}

/** Ids due on or before `now`, oldest due date first. */
export function dueIds(reviews: Reviews, now = today()): string[] {
  return Object.entries(reviews)
    .filter(([, e]) => !isGraduated(e) && e.due <= now)
    .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : 0))
    .map(([id]) => id);
}

/** The base id of a problem, stripping any variant suffix ("f1-b" → "f1"). */
export const baseId = (id: string) => id.replace(/-[a-z]$/, "");

/**
 * Pick which version of a due problem to serve. Prefer one the learner has not
 * solved, so review tests recall rather than memory of the wording. Falls back
 * to the original when no variant exists.
 */
export function pickForReview(
  dueId: string,
  allIds: string[],
  solved: (id: string) => boolean,
): string {
  const base = baseId(dueId);
  const family = allIds.filter((id) => baseId(id) === base);
  const unseen = family.filter((id) => !solved(id));
  return unseen[0] ?? dueId;
}
