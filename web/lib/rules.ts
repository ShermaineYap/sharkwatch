import type { Extraction, Flag, Verdict, Verification } from "./types";

// Rule text checked against 38 CFR 14.636 (eCFR, current as of 2026-11-19).
// Decisions are deterministic: the language model only extracts facts; it never decides.
export const RULES = {
  R1: { cite: "38 CFR 14.636(b)", plain: "Only VA-accredited attorneys and claims agents may receive fees for help with a VA claim. This helper asks for a fee, and we could not verify them as an accredited attorney or claims agent." },
  R2: { cite: "38 CFR 14.636(b)", plain: "Veterans Service Organizations and their accredited representatives are not allowed to charge. Their help is always free." },
  R3: { cite: "38 CFR 14.636(c)(1)(i)", plain: "Accredited attorneys and agents may charge only for work done after VA has sent its decision on your first claim. Nobody may charge you to file a first claim." },
  R4: { cite: "38 CFR 14.636(f)(1)", plain: "A fee above 33⅓% of past-due benefits is presumed unreasonable." },
  R5: { cite: "38 CFR 14.636(f)(1)", plain: "Fees up to 20% of past-due benefits are presumed reasonable. Between 20% and 33⅓%, ask the representative to justify the fee." },
  R6: { cite: "38 CFR 14.636(f)(1), (h)(3)", plain: "This fee is based on your future monthly payments (for example \"5x your monthly increase\"). The regulation measures fees against past-due benefits (back pay), not future payments. This is the billing model used by unaccredited claims consultants." },
  R7: { cite: "38 CFR 14.636(e), (g)", plain: "Any fee must be in a written agreement signed by you and the representative, with your VA file number, and filed with VA within 30 days. Ask for it before you agree to anything." },
  R8: { cite: "VA.gov sign-in safety", plain: "Never give anyone your VA.gov, ID.me or Login.gov username, password or codes. An accredited representative does not need them." },
} as const;

type RuleId = keyof typeof RULES;
const flag = (id: RuleId, severity: "red" | "amber"): Flag => ({ id, severity, ...RULES[id] });

const VERIFIED = new Set(["verified_by_number", "exact_name_state"]);

export function decide(x: Extraction, verifications: Verification[]): { verdict: Verdict; headline: string; flags: Flag[] } {
  const flags: Flag[] = [];
  const feeYes = x.fee_requested === "yes" || (x.fee_basis !== "none" && x.fee_basis !== "unknown");
  const verifiedFeeAllowed = verifications.some(
    (v) => VERIFIED.has(v.status) && v.candidates.some((c) => c.kind === "attorney" || c.kind === "claims_agent"),
  );
  const verifiedVso = verifications.some((v) => VERIFIED.has(v.status) && v.candidates.every((c) => c.kind === "vso_rep"));

  const outsideModel = ["multiple_of_monthly_increase", "percent_of_future_payments", "subscription", "upfront_flat"].includes(x.fee_basis);
  if (feeYes && (verifiedVso || x.claims_to_be_vso === "yes")) flags.push(flag("R2", "red"));
  else if (feeYes && !verifiedFeeAllowed) {
    // Red only when the text also shows a concrete breach; otherwise "verify before you pay".
    const claimsAccreditedButNot = x.claims_accredited === "yes" && verifications.some((v) => ["near_miss", "not_found", "number_not_found"].includes(v.status));
    flags.push(flag("R1", outsideModel || x.claim_stage === "initial_claim" || claimsAccreditedButNot ? "red" : "amber"));
  }

  if (feeYes && x.claim_stage === "initial_claim") flags.push(flag("R3", "red"));

  const pct = x.fee_percent_of_past_due;
  if (feeYes && pct !== null && pct > 100 / 3 + 0.01) flags.push(flag("R4", "red"));
  else if (feeYes && pct !== null && pct > 20) flags.push(flag("R5", "amber"));

  if (["multiple_of_monthly_increase", "percent_of_future_payments", "subscription"].includes(x.fee_basis)) flags.push(flag("R6", "red"));

  if (feeYes && x.written_agreement_mentioned !== "yes") flags.push(flag("R7", "amber"));
  if (x.asks_for_va_login === "yes") flags.push(flag("R8", "red"));

  const anyRed = flags.some((f) => f.severity === "red");
  const nearMiss = verifications.some((v) => v.status === "near_miss" || v.status === "number_not_found");
  const nameOnly = verifications.some((v) => v.status === "exact_name_only");

  let verdict: Verdict;
  let headline: string;
  if (anyRed) {
    verdict = "red";
    headline = "Stop. Do not sign or pay yet.";
  } else if (flags.length || nearMiss || nameOnly || verifications.some((v) => VERIFIED.has(v.status))) {
    verdict = "amber";
    headline = verifiedFeeAllowed ? "Accredited, but check the fee terms first." : "Check a few things before you agree.";
  } else if (x.fee_requested === "no") {
    verdict = "green";
    headline = "This text says the help is free. Free help from accredited VSOs is normal; still confirm who they are.";
  } else {
    verdict = "insufficient";
    headline = "Not enough to check yet. Ask them two questions.";
  }
  return { verdict, headline, flags };
}
