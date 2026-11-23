import rosterData from "../data/roster.json";
import { SnapshotStore, verify, type RosterStore } from "./roster";
import { SnowflakeStore, snowflakeConfigured } from "./snowflake";
import { cached, extractWithGemma, gemmaConfigured } from "./gemma";
import { extractBaseline, mergeGrounded } from "./extract";
import { decide } from "./rules";
import type { CheckResult, Extraction, Verification } from "./types";

let snapshot: SnapshotStore | null = null;
function snapshotStore() {
  return (snapshot ??= new SnapshotStore(rosterData as never));
}

export function store(): RosterStore {
  return snowflakeConfigured() ? new SnowflakeStore() : snapshotStore();
}

export interface CheckInput {
  text: string;
  name?: string;
  number?: string;
  state?: string;
}

function splitName(n: string) {
  const parts = n.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first_name: null, last_name: parts[0] ?? null };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export async function runCheck(input: CheckInput): Promise<CheckResult> {
  const text = input.text.trim();

  // 1. Extract facts: recorded Gemma output (examples) -> live Gemma -> keyword baseline.
  let x: Extraction, extractor: CheckResult["extractor"];
  const hit = cached(text);
  if (hit) {
    const m = mergeGrounded(hit.x, text);
    x = m.x;
    extractor = { name: "Gemma (recorded run) + grounded fee patterns", model: hit.model, ms: hit.ms, cached: true, overrides: m.overrides };
  } else if (gemmaConfigured()) {
    try {
      const g = await extractWithGemma(text);
      const m = mergeGrounded(g.x, text);
      x = m.x;
      extractor = { name: "Gemma + grounded fee patterns", model: g.model, ms: g.ms, cached: false, overrides: m.overrides };
    } catch (e) {
      const t0 = Date.now();
      x = extractBaseline(text);
      extractor = { name: `Keyword fallback (Gemma unavailable: ${(e as Error).message.slice(0, 60)})`, model: null, ms: Date.now() - t0, cached: false };
    }
  } else {
    const t0 = Date.now();
    x = extractBaseline(text);
    extractor = { name: "Keyword fallback (no Gemma key set)", model: null, ms: Date.now() - t0, cached: false };
  }

  // 2. Verify every person and number against the VA roster.
  let s = store();
  const t1 = Date.now();
  const state = (input.state || x.states_mentioned[0] || "").toUpperCase() || null;
  const targets: { first_name?: string | null; last_name?: string | null; number?: string | null }[] = [];
  if (input.number || input.name) targets.push({ ...(input.name ? splitName(input.name) : {}), number: input.number || null });
  for (const n of x.accreditation_numbers) targets.push({ number: n });
  for (const p of x.people) targets.push(p);
  let verifications: Verification[] = [];
  let snapshotDate = "";
  try {
    verifications = await Promise.all(targets.slice(0, 5).map((t) => verify(s, { ...t, state })));
    snapshotDate = await s.snapshot();
  } catch {
    // Snowflake unreachable: fall back to the bundled snapshot rather than fail the check.
    s = snapshotStore();
    verifications = await Promise.all(targets.slice(0, 5).map((t) => verify(s, { ...t, state })));
    snapshotDate = await s.snapshot();
  }
  const freeHelp = { state, orgs: state ? await s.freeHelp(state).catch(() => snapshotStore().freeHelp(state)) : [] };
  const roster = { store: s.name, snapshot: snapshotDate, ms: Date.now() - t1 };

  // 3. Decide with fixed rules (the model never decides).
  const { verdict, headline, flags } = decide(x, verifications);
  return { verdict, headline, flags, verifications, extraction: x, extractor, roster, freeHelp };
}
