// Scores the measured study: Gemma vs keyword baseline, both feeding the same roster check and rules.
// Usage: npx tsx scripts/score-study.ts ../study/items.jsonl data/study-results.json
import fs from "node:fs";
import { extractBaseline, mergeGrounded } from "../lib/extract";
import { sanitize } from "../lib/extract";
import { textKey } from "../lib/gemma";
import { decide } from "../lib/rules";
import { SnapshotStore, verify } from "../lib/roster";
import roster from "../data/roster.json";
import type { Extraction } from "../lib/types";

const [inFile, outFile, cacheFile, runsFile] = process.argv.slice(2);
const gcache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
const cached = (t: string) => { const h = gcache[textKey(t)]; return h ? { x: sanitize(h.raw, t), model: h.model } : null; };
const items = fs.readFileSync(inFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const runs = JSON.parse(fs.readFileSync(runsFile, "utf8")) as { id: string; ms: number; json_ok: boolean }[];
const store = new SnapshotStore(roster as never);

async function verdictFor(x: Extraction) {
  const v = await Promise.all([...x.accreditation_numbers.map((n) => ({ number: n })), ...x.people].slice(0, 5).map((p) => verify(store, p)));
  return { ...decide(x, v), v };
}

const FIELDS = ["fee_requested", "fee_basis", "claim_stage"] as const;
type Row = Record<string, unknown>;
const rows: Row[] = [];
for (const it of items) {
  const g = cached(it.text)!;
  const b = extractBaseline(it.text);
  const h = mergeGrounded(g.x, it.text).x;
  const gv = await verdictFor(g.x), bv = await verdictFor(b), hv = await verdictFor(h);
  const row: Row = { id: it.id, group: it.group, expected: it.label.verdict, gemma: gv.verdict, baseline: bv.verdict, hybrid: hv.verdict, ms: runs.find((r) => r.id === it.id)?.ms };
  for (const f of FIELDS) { row[`g_${f}`] = g.x[f] === it.label[f]; row[`b_${f}`] = b[f] === it.label[f]; row[`h_${f}`] = h[f] === it.label[f]; }
  if (it.label.fee_multiple) { row.g_mult = g.x.fee_multiple_of_monthly_increase === it.label.fee_multiple; row.b_mult = b.fee_multiple_of_monthly_increase === it.label.fee_multiple; row.h_mult = h.fee_multiple_of_monthly_increase === it.label.fee_multiple; }
  if (it.label.roster) row.roster = { expected: it.label.roster, gemma: gv.v.map((x) => x.status + ":" + (x.candidates[0]?.kind ?? "")) };
  row.h_flags = hv.flags.map((f) => f.id + f.severity[0]);
  row.g_flags = gv.flags.map((f) => f.id + f.severity[0]);
  rows.push(row);
}
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : null);
const acc = (k: string) => pct(rows.filter((r) => r[k] === r.expected).length, rows.length);
const field = (p: string) => Object.fromEntries([...FIELDS, "mult"].map((f) => { const xs = rows.filter((r) => r[`${p}_${f}`] !== undefined); return [f, pct(xs.filter((r) => r[`${p}_${f}`]).length, xs.length)]; }));
const legit = rows.filter((r) => r.group === "accredited" || r.group === "vso");
const sharks = rows.filter((r) => r.expected === "red");
const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  n: rows.length,
  verdict_accuracy: { gemma: acc("gemma"), baseline: acc("baseline"), hybrid: acc("hybrid") },
  field_accuracy: { gemma: field("g"), baseline: field("b"), hybrid: field("h") },
  false_red_on_legit: { n: legit.length, gemma: legit.filter((r) => r.gemma === "red").length, baseline: legit.filter((r) => r.baseline === "red").length, hybrid: legit.filter((r) => r.hybrid === "red").length },
  red_recall: { n: sharks.length, gemma: sharks.filter((r) => r.gemma === "red").length, baseline: sharks.filter((r) => r.baseline === "red").length, hybrid: sharks.filter((r) => r.hybrid === "red").length },
  json_valid: `${runs.filter((r) => r.json_ok).length}/${runs.length}`,
  gemma_latency_ms_cpu: { median: ms[Math.floor(ms.length / 2)], max: ms.at(-1) },
  model: cached(items[0].text)!.model,
};
fs.writeFileSync(outFile, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.table(rows.map((r) => ({ id: r.id, exp: r.expected, gemma: r.gemma, base: r.baseline, hybrid: r.hybrid, h_flags: (r.h_flags as string[]).join(" ") })));
