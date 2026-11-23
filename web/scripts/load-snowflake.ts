// Loads the VA roster CSVs into Snowflake through the SQL API (same auth the app uses).
// Usage: npx tsx scripts/load-snowflake.ts ../data_snapshot_2026-11-23   (needs SNOWFLAKE_* in env)
import fs from "node:fs";
import path from "node:path";
import { sql } from "../lib/snowflake";

const dir = process.argv[2];
const schemaSql = fs.readFileSync(path.join(import.meta.dirname, "../../snowflake/01_schema_and_match.sql"), "utf8");

function csv(file: string): string[][] {
  const t = fs.readFileSync(path.join(dir, file), "utf8");
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.slice(1).filter((r) => r.length > 1);
}
const lit = (v: string) => (v === "" ? "NULL" : `'${v.replace(/'/g, "''")}'`);

// 1. DDL statements (everything before the query examples), one at a time.
const ddl = schemaSql.split("-- Tier 1")[0].split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean);
for (const s of ddl) { await sql(s); console.log("ok:", s.split("\n")[0].slice(0, 70)); }

// 2. Data, in batches.
for (const [file, table] of [["attorneys.csv", "ATTORNEYS"], ["claims_agents.csv", "CLAIMS_AGENTS"], ["vso_reps.csv", "VSO_REPS"], ["vso_org_reps.csv", "VSO_ORG_REPS"]]) {
  const rows = csv(file);
  for (let i = 0; i < rows.length; i += 800) {
    const values = rows.slice(i, i + 800).map((r) => `(${r.map(lit).join(",")})`).join(",");
    await sql(`INSERT INTO ${table} VALUES ${values}`);
  }
  console.log(`${table}: ${rows.length} rows`);
}
const [[n]] = await sql("SELECT COUNT(*) FROM PEOPLE");
console.log("PEOPLE view rows:", n);
