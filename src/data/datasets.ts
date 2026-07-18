/**
 * Original, seeded practice datasets. All data is fictional and generated —
 * nothing is copied from any platform or real company.
 *
 * Two schemas, chosen so every interview pattern has natural data:
 *   wavely     — a music-streaming app: users, tracks, plays, subscriptions.
 *                Streaks, retention, sessionization, engagement live here.
 *   brightmart — a marketplace: customers, products, orders, order_items,
 *                refunds. Joins, fan-out, revenue math, pivots live here.
 *
 * Each problem runs against TWO independently seeded variants of its schema:
 * the visible one you explore, and a hidden one your query is re-graded on.
 * Hard-coding the expected output passes the first and fails the second.
 */

// Deterministic PRNG (mulberry32) — same seed, same data, every build.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const day = (start: string, offset: number) => {
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;

const COUNTRIES = ["US", "GB", "DE", "FR", "NL", "ES", "AM", "PL"] as const;
const PLANS = ["free", "plus", "premium"] as const;
const GENRES = ["pop", "rock", "jazz", "electronic", "hiphop", "classical"] as const;
const ARTISTS = ["Nova Marlowe", "The Copper Owls", "DJ Meridian", "Lisaveta", "Kite Theory",
  "Oren Vale", "Miren & Salt", "Blue Hour Trio"] as const;
const CATEGORIES = ["Audio", "Lighting", "Office", "Wearables", "Cables"] as const;

export interface Dataset {
  schema: string;   // CREATE TABLE statements
  inserts: string;  // INSERT statements
}

export function generateWavely(seed: number): Dataset {
  const r = rng(seed);
  const nUsers = 60;
  const nTracks = 40;

  const schema = `
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username TEXT NOT NULL,
  country TEXT NOT NULL,
  signup_date DATE NOT NULL,
  referred_by INT NULL
);
CREATE TABLE tracks (
  track_id INT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre TEXT NOT NULL,
  duration_s INT NOT NULL
);
CREATE TABLE plays (
  play_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  track_id INT NOT NULL,
  played_on DATE NOT NULL,
  seconds_played INT NOT NULL
);
CREATE TABLE subscriptions (
  sub_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  plan TEXT NOT NULL,
  monthly_price NUMERIC(6,2) NOT NULL,
  started_on DATE NOT NULL,
  cancelled_on DATE NULL
);`;

  const rows: string[] = [];
  for (let u = 1; u <= nUsers; u++) {
    const signup = day("2025-01-01", int(r, 0, 330));
    const referrer = u > 5 && r() < 0.25 ? int(r, 1, u - 1) : "NULL";
    rows.push(`INSERT INTO users VALUES (${u}, ${sqlStr("user_" + u)}, ` +
      `${sqlStr(pick(r, COUNTRIES))}, '${signup}', ${referrer});`);
  }
  for (let t = 1; t <= nTracks; t++) {
    rows.push(`INSERT INTO tracks VALUES (${t}, ${sqlStr("Track " + t)}, ` +
      `${sqlStr(pick(r, ARTISTS))}, ${sqlStr(pick(r, GENRES))}, ${int(r, 95, 420)});`);
  }
  let playId = 0;
  for (let u = 1; u <= nUsers; u++) {
    const activity = r(); // some users are heavy, some barely active
    const nPlays = activity < 0.2 ? int(r, 0, 3) : activity < 0.7 ? int(r, 5, 25) : int(r, 30, 70);
    // seed streaks: heavy users get runs of consecutive days
    let cursor = int(r, 30, 300);
    for (let p = 0; p < nPlays; p++) {
      cursor += r() < 0.55 ? 0 : r() < 0.8 ? 1 : int(r, 2, 9);
      const playedOn = day("2025-01-01", Math.min(cursor, 360));
      const track = int(r, 1, nTracks);
      rows.push(`INSERT INTO plays VALUES (${++playId}, ${u}, ${track}, ` +
        `'${playedOn}', ${int(r, 10, 420)});`);
    }
  }
  let subId = 0;
  for (let u = 1; u <= nUsers; u++) {
    if (r() < 0.55) continue; // free-tier only
    const plan = pick(r, PLANS.slice(1));
    const price = plan === "plus" ? 4.99 : 9.99;
    const started = day("2025-01-01", int(r, 10, 320));
    const cancelled = r() < 0.3 ? `'${day(started, int(r, 20, 120))}'` : "NULL";
    rows.push(`INSERT INTO subscriptions VALUES (${++subId}, ${u}, ${sqlStr(plan)}, ` +
      `${price}, '${started}', ${cancelled});`);
    if (r() < 0.15) { // some users re-subscribe: history matters
      const started2 = day(started, int(r, 130, 220));
      rows.push(`INSERT INTO subscriptions VALUES (${++subId}, ${u}, 'premium', 9.99, ` +
        `'${started2}', NULL);`);
    }
  }
  return { schema, inserts: rows.join("\n") };
}

export function generateBrightmart(seed: number): Dataset {
  const r = rng(seed);
  const nCustomers = 50;
  const nProducts = 30;

  const schema = `
CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  joined_on DATE NOT NULL
);
CREATE TABLE products (
  product_id INT PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(8,2) NOT NULL
);
CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  ordered_on DATE NOT NULL,
  status TEXT NOT NULL  -- completed | cancelled
);
CREATE TABLE order_items (
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(8,2) NOT NULL
);
CREATE TABLE refunds (
  refund_id INT PRIMARY KEY,
  order_id INT NOT NULL,
  refunded_on DATE NOT NULL,
  amount NUMERIC(8,2) NOT NULL
);`;

  const rows: string[] = [];
  const prices: number[] = [];
  for (let c = 1; c <= nCustomers; c++) {
    rows.push(`INSERT INTO customers VALUES (${c}, ${sqlStr("Customer " + c)}, ` +
      `${sqlStr(pick(r, COUNTRIES))}, '${day("2024-06-01", int(r, 0, 400))}');`);
  }
  for (let p = 1; p <= nProducts; p++) {
    const price = Math.round((5 + r() * 195) * 100) / 100;
    prices.push(price);
    rows.push(`INSERT INTO products VALUES (${p}, ${sqlStr("Product " + p)}, ` +
      `${sqlStr(pick(r, CATEGORIES))}, ${price});`);
  }
  let orderId = 100, refundId = 0;
  for (let c = 1; c <= nCustomers; c++) {
    const nOrders = int(r, 0, 8); // some customers never order: LEFT JOIN bait
    for (let o = 0; o < nOrders; o++) {
      orderId++;
      const orderedOn = day("2025-01-01", int(r, 0, 360));
      const status = r() < 0.9 ? "completed" : "cancelled";
      rows.push(`INSERT INTO orders VALUES (${orderId}, ${c}, '${orderedOn}', ${sqlStr(status)});`);
      const nItems = int(r, 1, 4);
      for (let i = 0; i < nItems; i++) {
        const pid = int(r, 1, nProducts);
        rows.push(`INSERT INTO order_items VALUES (${orderId}, ${pid}, ` +
          `${int(r, 1, 3)}, ${prices[pid - 1]});`);
      }
      if (status === "completed" && r() < 0.12) {
        rows.push(`INSERT INTO refunds VALUES (${++refundId}, ${orderId}, ` +
          `'${day(orderedOn, int(r, 2, 20))}', ${Math.round(r() * 8000) / 100});`);
      }
    }
  }
  return { schema, inserts: rows.join("\n") };
}

const DEPTS = ["Engineering", "Data", "Sales", "Support", "Finance"] as const;
const FIRST = ["Ana", "Boris", "Carmen", "Dev", "Elif", "Farid", "Greta", "Hakob", "Ines",
  "Jonas", "Karine", "Liam", "Mira", "Noor", "Odin", "Priya", "Quinn", "Rosa", "Sevan",
  "Tara", "Umut", "Vera", "Wei", "Ximena", "Yusuf", "Zara"] as const;

/** Orbit — a company org chart for hierarchy/recursion problems.
 *  Employee 1 is the CEO; everyone else has a manager, forming a tree
 *  4-5 levels deep with realistic department clustering. */
export function generateOrbit(seed: number): Dataset {
  const r = rng(seed);
  const nEmployees = 45;

  const schema = `
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  salary INT NOT NULL,
  hired_on DATE NOT NULL,
  manager_id INT NULL  -- NULL for the CEO
);`;

  const rows: string[] = [];
  const managersByLevel: number[][] = [[1]]; // level 0: the CEO
  rows.push(`INSERT INTO employees VALUES (1, ${sqlStr(FIRST[0] + " " + "Petros")}, ` +
    `'Engineering', ${int(r, 210, 260) * 1000}, '${day("2020-01-15", 0)}', NULL);`);

  let id = 1;
  for (let level = 1; level <= 4 && id < nEmployees; level++) {
    const layer: number[] = [];
    const width = [0, 4, 12, 18, 30][level];
    for (let k = 0; k < width && id < nEmployees; k++) {
      id++;
      const managerPool = managersByLevel[level - 1];
      const manager = managerPool[k % managerPool.length];
      const dept = level === 1 ? DEPTS[k % DEPTS.length] : pick(r, DEPTS);
      const salary = Math.round((180 - level * 30 + r() * 40)) * 1000;
      const hired = day("2020-06-01", int(r, 0, 2000));
      const name = `${pick(r, FIRST)} ${pick(r, FIRST)}yan`;
      rows.push(`INSERT INTO employees VALUES (${id}, ${sqlStr(name)}, ${sqlStr(dept)}, ` +
        `${salary}, '${hired}', ${manager});`);
      layer.push(id);
    }
    managersByLevel.push(layer);
  }
  return { schema, inserts: rows.join("\n") };
}

export type SchemaName = "wavely" | "brightmart" | "orbit";

export const SEEDS = { visible: 1101, hidden: 7907 } as const;

export function buildDataset(name: SchemaName, variant: keyof typeof SEEDS): Dataset {
  const seed = SEEDS[variant];
  if (name === "wavely") return generateWavely(seed);
  if (name === "brightmart") return generateBrightmart(seed);
  return generateOrbit(seed);
}

/** Table list per schema, for the schema-browser UI. */
export const SCHEMA_TABLES: Record<SchemaName, string[]> = {
  wavely: ["users", "tracks", "plays", "subscriptions"],
  brightmart: ["customers", "products", "orders", "order_items", "refunds"],
  orbit: ["employees"],
};
