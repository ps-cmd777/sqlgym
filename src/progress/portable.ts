/**
 * Portable progress.
 *
 * SQLGym deliberately has no accounts, which is one of the honest things about
 * it: nothing you type leaves your machine. The cost is that progress lives in
 * localStorage, so a new browser, a new laptop or a cleared cache wipes it.
 * For a product whose whole proposition is "come back and keep going", that is
 * a hole, not a trade-off.
 *
 * This closes it without a server, an email address or a login: progress
 * encodes to a short string the learner can save anywhere, and pastes back to
 * restore. The privacy claim survives completely.
 *
 * Format:  sqlgym1.<base64url payload>.<checksum>
 * Payload: solvedIds joined by "," then "|" then solve-days as YYMMDD
 *
 * Ids and dates are short by design, so a full 185-problem history is roughly
 * a kilobyte — small enough to paste into a note, a password manager or a
 * chat message to yourself.
 */

export interface PortableProgress {
  solved: string[];
  /** ISO days, "YYYY-MM-DD". Drives the streak. */
  days: string[];
}

const PREFIX = "sqlgym1";

/** FNV-1a. Not security — this only has to catch a truncated paste. */
function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const toB64Url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64Url = (s: string) =>
  decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/** "2026-07-31" → "260731", halving the size of a year of solve days. */
const packDay = (iso: string) => iso.slice(2).replace(/-/g, "");
const unpackDay = (p: string) => `20${p.slice(0, 2)}-${p.slice(2, 4)}-${p.slice(4, 6)}`;

/** The streak only ever walks back from today, so older solve days affect no
 *  number the interface shows. Keeping the last 90 turns a 5,200-character
 *  code into something a person will actually paste. */
const DAYS_KEPT = 90;

export function encodeProgress(p: PortableProgress): string {
  const days = [...p.days].sort().slice(-DAYS_KEPT);
  const body = `${p.solved.join(",")}|${days.map(packDay).join(",")}`;
  const payload = toB64Url(body);
  return `${PREFIX}.${payload}.${checksum(body)}`;
}

export type DecodeResult =
  | { ok: true; value: PortableProgress }
  | { ok: false; error: string };

export function decodeProgress(code: string): DecodeResult {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Paste a progress code first." };

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { ok: false, error: "That does not look like a SQLGym progress code." };
  }

  let body: string;
  try {
    body = fromB64Url(parts[1]);
  } catch {
    return { ok: false, error: "The code is damaged. Copy it again, complete." };
  }

  // A truncated paste is the likely failure, and it would silently restore
  // partial progress without this check.
  if (checksum(body) !== parts[2]) {
    return { ok: false, error: "The code looks incomplete. Copy the whole thing and retry." };
  }

  const [solvedPart = "", daysPart = ""] = body.split("|");
  const solved = solvedPart ? solvedPart.split(",").filter(Boolean) : [];
  const days = daysPart
    ? daysPart.split(",").filter((d) => /^\d{6}$/.test(d)).map(unpackDay)
    : [];

  return { ok: true, value: { solved, days } };
}
