import type { Extraction, FeeBasis, Tri } from "./types";

export const EMPTY: Extraction = {
  people: [], organizations: [], accreditation_numbers: [], states_mentioned: [],
  claims_accredited: "unknown", claims_to_be_vso: "unknown", fee_requested: "unknown", fee_basis: "unknown",
  fee_percent_of_past_due: null, fee_flat_usd: null, fee_multiple_of_monthly_increase: null,
  written_agreement_mentioned: "unknown", claim_stage: "unknown", asks_for_va_login: "unknown",
  pressure_tactics: [], evidence: [],
};

const TRI = new Set(["yes", "no", "unknown"]);
const BASIS = new Set(["percent_of_past_due", "multiple_of_monthly_increase", "percent_of_future_payments", "upfront_flat", "subscription", "none", "unknown"]);
const STAGE = new Set(["initial_claim", "increase", "supplemental_or_appeal", "unknown"]);
const num = (v: unknown) => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/); // "6x", "20%", "$1,500" -> 6, 20, 1500
  return m ? Number(m[0]) : null;
};
const tri = (v: unknown): Tri => (TRI.has(String(v)) ? (String(v) as Tri) : "unknown");
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Coerce model output into a valid Extraction; anything off-schema becomes "unknown". */
export function sanitize(raw: unknown, sourceText: string): Extraction {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const evidence = arr<{ field: string; quote: string }>(o.evidence)
    .filter((e) => e && typeof e.quote === "string" && e.quote.length > 2)
    // Evidence must be a real quote from the text, or it is dropped.
    .filter((e) => sourceText.toLowerCase().includes(e.quote.toLowerCase().slice(0, 60)));
  const people = arr<Record<string, unknown>>(o.people)
    .map((p) => ({ first_name: (p?.first_name as string) ?? null, last_name: (p?.last_name as string) ?? null, role_claimed: (p?.role_claimed as string) ?? null }))
    // A name must actually appear in the text.
    .filter((p) => p.last_name && sourceText.toLowerCase().includes(String(p.last_name).toLowerCase()));
  return {
    people,
    organizations: arr<string>(o.organizations).filter((s) => typeof s === "string"),
    accreditation_numbers: arr<string>(o.accreditation_numbers).map(String).filter((s) => /\d{3,}/.test(s) && sourceText.includes(s.replace(/\D/g, ""))),
    states_mentioned: arr<string>(o.states_mentioned).map((s) => String(s).toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)),
    claims_accredited: tri(o.claims_accredited),
    claims_to_be_vso: tri(o.claims_to_be_vso),
    fee_requested: tri(o.fee_requested),
    fee_basis: (BASIS.has(String(o.fee_basis)) ? o.fee_basis : "unknown") as FeeBasis,
    fee_percent_of_past_due: num(o.fee_percent_of_past_due),
    fee_flat_usd: num(o.fee_flat_usd),
    fee_multiple_of_monthly_increase: num(o.fee_multiple_of_monthly_increase),
    written_agreement_mentioned: tri(o.written_agreement_mentioned),
    claim_stage: (STAGE.has(String(o.claim_stage)) ? o.claim_stage : "unknown") as Extraction["claim_stage"],
    asks_for_va_login: tri(o.asks_for_va_login),
    pressure_tactics: arr<string>(o.pressure_tactics).filter((s) => typeof s === "string").slice(0, 5),
    evidence,
  };
}

export function parseJsonLoose(s: string): unknown {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Hybrid: Gemma reads the text; explicit, quotable fee arithmetic found by exact patterns
 * ("5x the monthly increase", "20% of past-due benefits", "$1,500 one-time fee") overrides the
 * model on those fields, because a pattern match is a quote, not a judgement.
 * Everything else (names, stage, VSO and accreditation claims, login requests) comes from Gemma.
 */
export function mergeGrounded(model: Extraction, text: string): { x: Extraction; overrides: string[] } {
  const g = extractBaseline(text);
  const x = structuredClone(model);
  const overrides: string[] = [];
  if (g.fee_basis !== "unknown" && g.fee_basis !== x.fee_basis) { overrides.push(`fee_basis: ${x.fee_basis} -> ${g.fee_basis}`); x.fee_basis = g.fee_basis; }
  for (const k of ["fee_multiple_of_monthly_increase", "fee_percent_of_past_due", "fee_flat_usd"] as const) {
    if (g[k] !== null && g[k] !== x[k]) { overrides.push(`${k}: ${x[k]} -> ${g[k]}`); x[k] = g[k]; }
  }
  if ((g.fee_basis !== "unknown" || (g.fee_requested === "yes" && g.evidence.some((e) => e.field === "fee_requested"))) && x.fee_requested !== "yes") {
    overrides.push(`fee_requested: ${x.fee_requested} -> yes`); x.fee_requested = "yes";
  }
  if (g.asks_for_va_login === "yes" && x.asks_for_va_login !== "yes") { overrides.push("asks_for_va_login -> yes"); x.asks_for_va_login = "yes"; }
  for (const e of g.evidence) if (!x.evidence.some((m) => m.quote === e.quote)) x.evidence.push(e);
  return { x, overrides };
}

// ---------- baseline: keyword/regex extractor (no AI) ----------
const WORD_NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10 };
const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR GU".split(" ");

export function extractBaseline(text: string): Extraction {
  const t = text.toLowerCase();
  const x: Extraction = structuredClone(EMPTY);
  const ev = (field: string, re: RegExp) => { const m = text.match(re); if (m) x.evidence.push({ field, quote: m[0] }); };

  const mult = t.match(/(\d+|two|three|four|five|six|seven|eight|ten)\s*(?:x|times|months?'?(?:\s+worth)?)\s*(?:of\s+)?(?:the\s+|your\s+|any\s+|that\s+)?(?:amount\s+of\s+any\s+)?(?:monthly\s+)?(?:benefits?\s+)?increase/);
  if (mult) {
    x.fee_basis = "multiple_of_monthly_increase";
    x.fee_multiple_of_monthly_increase = WORD_NUM[mult[1]] ?? Number(mult[1]);
    x.fee_requested = "yes";
    ev("fee_basis", /(\d+|two|three|four|five|six|seven|eight|ten)\s*(x|times|months)[^.]{0,60}increase/i);
  }
  const pct = t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)\s*(?:of\s+)?(?:any\s+|your\s+|the\s+)?(?:awarded\s+)?(?:past[- ]due|back ?pay|retroactive)/);
  if (pct && x.fee_basis === "unknown") { x.fee_basis = "percent_of_past_due"; x.fee_percent_of_past_due = Number(pct[1]); x.fee_requested = "yes"; }
  const flat = text.match(/\$\s?([\d,]{3,})(?:\.\d\d)?\s*(?:one[- ]time\s+)?(?:fee|upfront|flat)|(?:one[- ]time|flat|upfront)\s+\$\s?([\d,]{3,})/i);
  if (flat && x.fee_basis === "unknown") { x.fee_basis = "upfront_flat"; x.fee_flat_usd = Number((flat[1] ?? flat[2]).replace(/,/g, "")); x.fee_requested = "yes"; }
  // Contingency wording ("no fee unless we win", "only pay if your rating goes up") means a fee when successful.
  const contingent = /no fee unless (we|you) win|if we do not win[^.]{0,40}no fee|(only|you) pay (the fee )?(only )?if (you|we) win|you only pay if|only pay (after|when|if)/.test(t);
  if (contingent) { x.fee_requested = "yes"; ev("fee_requested", /no fee unless (we|you) win|if we do not win[^.]{0,40}no fee|(only|you) pay (the fee )?(only )?if (you|we) win|you only pay if[^.]{0,40}|only pay (after|when|if)[^.]{0,40}/i); }
  if (x.fee_requested === "unknown" && /\b(our|my|the|their|a)\s+(standard\s+|membership\s+|consulting\s+)?fee\b|\bbill(ed|s)?\b|\bpay (us|me|the company)\b|\bcontingency fee\b/.test(t)) x.fee_requested = "yes";
  if (/free of charge|always free|at no cost|no charge|for free\b|services are free|no-cost/.test(t) && x.fee_requested !== "yes") x.fee_requested = "no";

  if (/first (va )?(disability )?claim|initial (va )?claim|file (your|a) (first|new) claim/.test(t)) x.claim_stage = "initial_claim";
  else if (/appeal|higher[- ]level review|supplemental|after (an |the )?initial|decision on (your|the veteran'?s) initial/.test(t)) x.claim_stage = "supplemental_or_appeal";
  else if (/increase|higher rating|rating from/.test(t)) x.claim_stage = "increase";

  if (/(va\.gov|id\.me|login\.gov)\s*(login|password|username|sign[- ]in|credentials)|send me your (va|login|password)/.test(t)) x.asks_for_va_login = "yes";
  if (/written (fee )?agreement|fee agreement/.test(t)) x.written_agreement_mentioned = "yes";
  if (/\bvso\b|service officer|veterans service organization/.test(t) && /\bour\b|\bwe\b/.test(t) && /vfw|legion|dav\b/.test(t)) x.claims_to_be_vso = "yes";
  if (/accredited/.test(t) && !/not (va[- ])?accredited/.test(t)) x.claims_accredited = "yes";

  for (const m of text.matchAll(/\b(?:attorneys?|agent|expert|this is|i am|i'm|name is)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+(?:-[A-Z][a-z]+)?)/g)) x.people.push({ first_name: m[1], last_name: m[2] });
  for (const m of text.matchAll(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(?:and his|and her|of \[|, Esq)/g)) x.people.push({ first_name: m[1], last_name: m[2] });
  for (const m of text.matchAll(/(?:accreditation|registration)\s*(?:number|no\.?|#)\s*:?\s*(\d{3,6})/gi)) x.accreditation_numbers.push(m[1]);
  for (const m of text.matchAll(/\b([A-Z]{2})\b/g)) if (STATES.includes(m[1]) && m[1] !== "VA") x.states_mentioned.push(m[1]);
  x.people = x.people.filter((p, i, a) => a.findIndex((q) => q.first_name === p.first_name && q.last_name === p.last_name) === i);
  return x;
}
