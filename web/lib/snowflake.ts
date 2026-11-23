import crypto from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import type { FreeHelpOrg, RosterKind, RosterPerson } from "./types";
import type { RosterStore } from "./roster";
import { SUGGEST_THRESHOLD } from "./roster";

/**
 * Roster store backed by Snowflake, queried through the Snowflake SQL API (key-pair JWT auth).
 * Tables and views: snowflake/01_schema_and_match.sql.
 * Env: SNOWFLAKE_ACCOUNT (e.g. ORGNAME-ACCTNAME), SNOWFLAKE_USER, SNOWFLAKE_PRIVATE_KEY (PKCS8 PEM),
 *      SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE, SNOWFLAKE_SCHEMA, SNOWFLAKE_ROLE (optional)
 */
export function snowflakeConfigured(): boolean {
  return Boolean(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER && process.env.SNOWFLAKE_PRIVATE_KEY);
}

let cachedJwt: { token: string; exp: number } | null = null;

async function jwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - 60 > now) return cachedJwt.token;
  const account = process.env.SNOWFLAKE_ACCOUNT!.toUpperCase().split(".")[0];
  const user = process.env.SNOWFLAKE_USER!.toUpperCase();
  const pem = process.env.SNOWFLAKE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const pub = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ type: "spki", format: "der" });
  const fp = "SHA256:" + crypto.createHash("sha256").update(pub).digest("base64");
  const key = await importPKCS8(pem, "RS256");
  const exp = now + 3000;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(`${account}.${user}.${fp}`)
    .setSubject(`${account}.${user}`)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  cachedJwt = { token, exp };
  return token;
}

export async function sql(statement: string, binds: (string | number | null)[] = []): Promise<string[][]> {
  const host = `https://${process.env.SNOWFLAKE_ACCOUNT!.toLowerCase()}.snowflakecomputing.com`;
  const bindings = Object.fromEntries(
    binds.map((v, i) => [String(i + 1), { type: typeof v === "number" ? "FIXED" : "TEXT", value: v === null ? null : String(v) }]),
  );
  const res = await fetch(`${host}/api/v2/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await jwt()}`,
      "X-Snowflake-Authorization-Token-Type": "KEYPAIR_JWT",
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "sharkwatch/1.0",
    },
    body: JSON.stringify({
      statement,
      bindings,
      timeout: 20,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "SHARKWATCH_WH",
      database: process.env.SNOWFLAKE_DATABASE ?? "SHARKWATCH",
      schema: process.env.SNOWFLAKE_SCHEMA ?? "ROSTER",
      ...(process.env.SNOWFLAKE_ROLE ? { role: process.env.SNOWFLAKE_ROLE } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Snowflake ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { data?: string[][] };
  return body.data ?? [];
}

const COLS = "KIND, REGISTRATION_NUM, FIRST_NAME, LAST_NAME, CITY, STATE, ZIP, PHONE";
const row = (r: string[]): RosterPerson => ({
  kind: r[0] as RosterKind, registration_num: r[1], first_name: r[2], last_name: r[3],
  city: r[4] ?? "", state: r[5] ?? "", zip: r[6] ?? "", phone: r[7] ?? "",
});

export class SnowflakeStore implements RosterStore {
  name = "Snowflake (SHARKWATCH.ROSTER)";
  async snapshot() {
    const r = await sql("SELECT TO_VARCHAR(MAX(SNAPSHOT_DATE)) FROM PEOPLE");
    return r[0]?.[0] ?? "unknown";
  }
  async byNumber(num: string) {
    return (await sql(`SELECT ${COLS} FROM PEOPLE WHERE LTRIM(REGISTRATION_NUM, '0') = ?`, [num])).map(row);
  }
  async byName(full: string) {
    return (await sql(`SELECT ${COLS} FROM PEOPLE WHERE FULL_NORM = ? LIMIT 20`, [full])).map(row);
  }
  async suggest(full: string, limit: number) {
    const rows = await sql(
      `SELECT ${COLS}, JAROWINKLER_SIMILARITY(FULL_NORM, ?) AS S FROM PEOPLE
       WHERE JAROWINKLER_SIMILARITY(FULL_NORM, ?) >= ? ORDER BY S DESC LIMIT ?`,
      [full, full, SUGGEST_THRESHOLD, limit],
    );
    return rows.map((r) => ({ ...row(r), score: Number(r[8]) }));
  }
  async freeHelp(state: string): Promise<FreeHelpOrg[]> {
    const rows = await sql(
      `SELECT ORGANIZATION_NAME, COUNT(*) AS REPS, ANY_VALUE(ORG_PHONE),
              ARRAY_TO_STRING(ARRAY_SLICE(ARRAY_UNIQUE_AGG(REP_CITY), 0, 4), '|')
       FROM VSO_ORG_REPS WHERE COALESCE(REP_STATE, ORG_STATE) = ? GROUP BY ORGANIZATION_NAME ORDER BY REPS DESC LIMIT 8`,
      [state.toUpperCase()],
    );
    return rows.map((r) => ({ name: r[0], reps: Number(r[1]), phone: r[2] ?? "", cities: (r[3] ?? "").split("|").filter(Boolean) }));
  }
}
