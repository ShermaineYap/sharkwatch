export type Tri = "yes" | "no" | "unknown";
export type FeeBasis =
  | "percent_of_past_due"
  | "multiple_of_monthly_increase"
  | "percent_of_future_payments"
  | "upfront_flat"
  | "subscription"
  | "none"
  | "unknown";
export type ClaimStage = "initial_claim" | "increase" | "supplemental_or_appeal" | "unknown";

export interface Person {
  first_name: string | null;
  last_name: string | null;
  role_claimed?: string | null;
}

export interface Extraction {
  people: Person[];
  organizations: string[];
  accreditation_numbers: string[];
  states_mentioned: string[];
  claims_accredited: Tri;
  claims_to_be_vso: Tri;
  fee_requested: Tri;
  fee_basis: FeeBasis;
  fee_percent_of_past_due: number | null;
  fee_flat_usd: number | null;
  fee_multiple_of_monthly_increase: number | null;
  written_agreement_mentioned: Tri;
  claim_stage: ClaimStage;
  asks_for_va_login: Tri;
  pressure_tactics: string[];
  evidence: { field: string; quote: string }[];
}

export type RosterKind = "attorney" | "claims_agent" | "vso_rep";

export interface RosterPerson {
  kind: RosterKind;
  registration_num: string;
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export type VerificationStatus =
  | "verified_by_number" // exact accreditation number
  | "exact_name_state" // exact normalised name and state
  | "exact_name_only" // exact name, state unknown or different
  | "near_miss" // fuzzy suggestion only, never verified
  | "not_found"
  | "number_not_found"
  | "nothing_to_check";

export interface Verification {
  query: string;
  status: VerificationStatus;
  candidates: (RosterPerson & { score?: number })[];
}

export interface FreeHelpOrg {
  name: string;
  reps: number;
  phone: string;
  cities: string[];
}

export interface Flag {
  id: string;
  severity: "red" | "amber";
  cite: string;
  plain: string;
}

export type Verdict = "red" | "amber" | "green" | "insufficient";

export interface CheckResult {
  verdict: Verdict;
  headline: string;
  flags: Flag[];
  verifications: Verification[];
  extraction: Extraction;
  extractor: { name: string; model: string | null; ms: number; cached: boolean; overrides?: string[] };
  roster: { store: string; snapshot: string; ms: number };
  freeHelp: { state: string | null; orgs: FreeHelpOrg[] };
  recognizedOrgs: string[];
}
