import type { FreeHelpOrg, RosterKind, RosterPerson, Verification } from "./types";

// Day-1 study on the 2026-11-23 snapshot (see DAY1_FINDINGS.md):
// fuzzy >= 94 matched 12% of made-up names, so fuzzy results are only ever "did you mean".
export const SUGGEST_THRESHOLD = 90;

export function normName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normNumber(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

/** Jaro-Winkler similarity on a 0-100 scale, matching Snowflake's JAROWINKLER_SIMILARITY scale. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 100;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range), hi = Math.min(i + range + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < 4 && a[p] === b[p]) p++;
  return Math.round((jaro + p * 0.1 * (1 - jaro)) * 1000) / 10;
}

export interface RosterStore {
  name: string;
  snapshot(): Promise<string>;
  byNumber(num: string): Promise<RosterPerson[]>;
  byName(fullNorm: string): Promise<RosterPerson[]>;
  suggest(fullNorm: string, limit: number): Promise<(RosterPerson & { score: number })[]>;
  freeHelp(state: string): Promise<FreeHelpOrg[]>;
}

export interface VerifyInput {
  first_name?: string | null;
  last_name?: string | null;
  number?: string | null;
  state?: string | null;
}

/** The verification ladder. Only a number match or exact name + state can come out as verified. */
export async function verify(store: RosterStore, q: VerifyInput): Promise<Verification> {
  const full = normName(`${q.first_name ?? ""} ${q.last_name ?? ""}`);
  const num = normNumber(q.number);
  const state = (q.state ?? "").toUpperCase() || null;
  const label = [q.first_name, q.last_name].filter(Boolean).join(" ") || (num ? `#${num}` : "");

  if (num) {
    const hits = await store.byNumber(num);
    if (hits.length) {
      // If a name was also given, it must agree with the record.
      const agrees = !full || hits.some((h) => normName(`${h.first_name} ${h.last_name}`) === full || normName(h.last_name) === normName(q.last_name));
      return { query: label, status: agrees ? "verified_by_number" : "number_not_found", candidates: hits };
    }
    return { query: label, status: "number_not_found", candidates: [] };
  }
  if (!full || !q.last_name) return { query: label, status: "nothing_to_check", candidates: [] };

  const exact = await store.byName(full);
  if (exact.length) {
    const inState = state ? exact.filter((p) => p.state === state) : [];
    if (inState.length) return { query: label, status: "exact_name_state", candidates: inState };
    return { query: label, status: "exact_name_only", candidates: exact.slice(0, 5) };
  }
  const sugg = await store.suggest(full, 5);
  if (sugg.length) return { query: label, status: "near_miss", candidates: sugg };
  return { query: label, status: "not_found", candidates: [] };
}

// ---------- bundled snapshot store (works with no cloud account) ----------
type Row = [RosterKind, string, string, string, string, string, string, string];
interface SnapshotFile { snapshot: string; source: string; people: Row[]; freeHelp: Record<string, FreeHelpOrg[]> }

function toPerson(r: Row): RosterPerson {
  const [kind, registration_num, first_name, last_name, city, state, zip, phone] = r;
  return { kind, registration_num, first_name, last_name, city, state, zip, phone };
}

export class SnapshotStore implements RosterStore {
  name = "bundled VA roster snapshot";
  private byNum = new Map<string, Row[]>();
  private byFull = new Map<string, Row[]>();
  private fulls: string[] = [];
  constructor(private data: SnapshotFile) {
    for (const r of data.people) {
      const n = normNumber(r[1]);
      this.byNum.set(n, [...(this.byNum.get(n) ?? []), r]);
      const f = normName(`${r[2]} ${r[3]}`);
      if (!this.byFull.has(f)) this.fulls.push(f);
      this.byFull.set(f, [...(this.byFull.get(f) ?? []), r]);
    }
  }
  async snapshot() { return this.data.snapshot; }
  async byNumber(num: string) { return (this.byNum.get(normNumber(num)) ?? []).map(toPerson); }
  async byName(full: string) { return (this.byFull.get(full) ?? []).map(toPerson); }
  async suggest(full: string, limit: number) {
    const scored: { f: string; s: number }[] = [];
    for (const f of this.fulls) {
      const s = jaroWinkler(full, f);
      if (s >= SUGGEST_THRESHOLD) scored.push({ f, s });
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).flatMap(({ f, s }) => (this.byFull.get(f) ?? []).map((r) => ({ ...toPerson(r), score: s }))).slice(0, limit);
  }
  async freeHelp(state: string) { return this.data.freeHelp[state.toUpperCase()] ?? []; }
}
