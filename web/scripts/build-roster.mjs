// Builds data/roster.json from the VA OGC roster CSVs (see ../parse_rosters.py).
// Usage: node scripts/build-roster.mjs <csvDir> <outFile>
import fs from "node:fs";
import path from "node:path";

const [dir, out] = process.argv.slice(2);

function parseCsv(file) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const people = [];
for (const [file, kind] of [["attorneys.csv", "attorney"], ["claims_agents.csv", "claims_agent"], ["vso_reps.csv", "vso_rep"]]) {
  for (const r of parseCsv(file)) {
    people.push([kind, r.registration_num, r.first_name, r.last_name, r.city, r.state, r.zip, r.phone]);
  }
}

const orgRows = parseCsv("vso_org_reps.csv");
const byState = {};
for (const r of orgRows) {
  const s = r.rep_state || r.org_state;
  if (!s) continue;
  byState[s] ??= {};
  const o = (byState[s][r.organization_name] ??= { name: r.organization_name, reps: 0, phone: r.org_phone, cities: new Set() });
  o.reps++;
  if (r.rep_city) o.cities.add(r.rep_city);
}
const freeHelp = {};
for (const [s, orgs] of Object.entries(byState)) {
  freeHelp[s] = Object.values(orgs)
    .sort((a, b) => b.reps - a.reps)
    .slice(0, 8)
    .map((o) => ({ name: o.name, reps: o.reps, phone: o.phone, cities: [...o.cities].slice(0, 4) }));
}

const snapshot = parseCsv("attorneys.csv")[0]?.snapshot_date ?? "unknown";
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ snapshot, source: "https://www.va.gov/ogc/apps/accreditation/", people, freeHelp }));
console.log(`people=${people.length} states=${Object.keys(freeHelp).length} snapshot=${snapshot} -> ${out}`);
