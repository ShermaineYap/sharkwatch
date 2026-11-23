import { describe, expect, it } from "vitest";
import roster from "../data/roster.json";
import { jaroWinkler, normName, SnapshotStore, verify } from "../lib/roster";
import { decide } from "../lib/rules";
import { EMPTY, extractBaseline, mergeGrounded, sanitize } from "../lib/extract";
import type { Extraction } from "../lib/types";

const store = new SnapshotStore(roster as never);
const x = (o: Partial<Extraction>): Extraction => ({ ...structuredClone(EMPTY), ...o });

describe("jaroWinkler (Snowflake 0-100 scale)", () => {
  it("matches known values", () => {
    expect(jaroWinkler("martha", "marhta")).toBe(96.1);
    expect(jaroWinkler("dixon", "dicksonx")).toBe(81.3);
    expect(jaroWinkler("same", "same")).toBe(100);
    expect(jaroWinkler("", "x")).toBe(0);
  });
});

describe("verification ladder", () => {
  it("verifies by accreditation number", async () => {
    const v = await verify(store, { number: "8877" });
    expect(v.status).toBe("verified_by_number");
    expect(v.candidates[0].last_name).toBe("Hill");
  });
  it("rejects a number that belongs to someone else", async () => {
    const v = await verify(store, { first_name: "Jane", last_name: "Nobody", number: "8877" });
    expect(v.status).toBe("number_not_found");
  });
  it("exact name + state is found; name in the wrong state is only a name match", async () => {
    expect((await verify(store, { first_name: "Brian", last_name: "Hill", state: "FL" })).status).toBe("exact_name_state");
    expect((await verify(store, { first_name: "Brian", last_name: "Hill", state: "AK" })).status).toBe("exact_name_only");
  });
  it("a near-identical made-up name is never verified", async () => {
    const v = await verify(store, { first_name: "Jennifer", last_name: "Steele" });
    expect(v.status).toBe("near_miss");
    expect(v.candidates.length).toBeGreaterThan(0);
  });
  it("normalises accents, case and punctuation", () => {
    expect(normName("  José  O'Brien-Smith ")).toBe("jose obriensmith");
  });
});

describe("rules (38 CFR 14.636)", () => {
  it("multiple of monthly increase from an unverified helper is red", () => {
    const d = decide(x({ fee_requested: "yes", fee_basis: "multiple_of_monthly_increase", fee_multiple_of_monthly_increase: 5 }), []);
    expect(d.verdict).toBe("red");
    expect(d.flags.map((f) => f.id)).toEqual(expect.arrayContaining(["R1", "R6"]));
  });
  it("a fee for a first claim is red even from a verified attorney", async () => {
    const v = [await verify(store, { number: "8877" })];
    const d = decide(x({ fee_requested: "yes", fee_basis: "percent_of_past_due", fee_percent_of_past_due: 20, claim_stage: "initial_claim" }), v);
    expect(d.flags.map((f) => f.id)).toContain("R3");
    expect(d.verdict).toBe("red");
  });
  it("20% of past-due from a verified attorney after a decision is amber (check terms), not red", async () => {
    const v = [await verify(store, { number: "8877" })];
    const d = decide(x({ fee_requested: "yes", fee_basis: "percent_of_past_due", fee_percent_of_past_due: 20, claim_stage: "supplemental_or_appeal", written_agreement_mentioned: "yes" }), v);
    expect(d.verdict).toBe("amber");
    expect(d.flags).toHaveLength(0);
  });
  it("above 33 1/3% is red, 25% is amber", () => {
    expect(decide(x({ fee_requested: "yes", fee_basis: "percent_of_past_due", fee_percent_of_past_due: 40 }), []).flags.map((f) => f.id)).toContain("R4");
    expect(decide(x({ fee_requested: "yes", fee_basis: "percent_of_past_due", fee_percent_of_past_due: 25 }), []).flags.map((f) => f.id)).toContain("R5");
  });
  it("a VSO asking for money is red", () => {
    expect(decide(x({ fee_requested: "yes", claims_to_be_vso: "yes" }), []).flags[0].id).toBe("R2");
  });
  it("asking for VA.gov login is red", () => {
    expect(decide(x({ asks_for_va_login: "yes" }), []).verdict).toBe("red");
  });
  it("free help is green; silence is insufficient", () => {
    expect(decide(x({ fee_requested: "no" }), []).verdict).toBe("green");
    expect(decide(x({}), []).verdict).toBe("insufficient");
  });
});

describe("extraction safety", () => {
  it("drops names and quotes the model invented", () => {
    const s = sanitize({ people: [{ first_name: "Ghost", last_name: "Person" }], evidence: [{ field: "x", quote: "not in text" }] }, "Call us today.");
    expect(s.people).toHaveLength(0);
    expect(s.evidence).toHaveLength(0);
  });
  it("coerces off-schema values to unknown and parses numbers like 6x", () => {
    const s = sanitize({ fee_basis: "contingency fee", fee_multiple_of_monthly_increase: "6x", claim_stage: "first" }, "6x");
    expect(s.fee_basis).toBe("unknown");
    expect(s.fee_multiple_of_monthly_increase).toBe(6);
    expect(s.claim_stage).toBe("unknown");
  });
  it("grounded patterns override the model on explicit fee arithmetic", () => {
    const text = "Our fee is just 5x your monthly increase, payable once VA approves.";
    const model = x({ fee_requested: "yes", fee_basis: "percent_of_past_due" });
    const { x: m, overrides } = mergeGrounded(model, text);
    expect(m.fee_basis).toBe("multiple_of_monthly_increase");
    expect(m.fee_multiple_of_monthly_increase).toBe(5);
    expect(overrides.length).toBeGreaterThan(0);
  });
  it("contingency wording is a fee, not free help", () => {
    for (const t of ["Let us fight for your benefits - no fee unless we win!", "You only pay if your VA pay goes up."]) {
      expect(extractBaseline(t).fee_requested).toBe("yes");
      expect(mergeGrounded(x({ fee_requested: "no" }), t).x.fee_requested).toBe("yes");
    }
    expect(extractBaseline("All services are free and at no cost to the Veteran.").fee_requested).toBe("no");
  });
  it("baseline reads the common claim-shark fee wording", () => {
    for (const [t, n] of [["five times the amount of any increase in his monthly VA compensation", 5], ["a fee equal to five months' worth of any benefits increase", 5], ["up to 6x the monthly increase in your VA benefit", 6]] as const) {
      expect(extractBaseline(t).fee_multiple_of_monthly_increase).toBe(n);
    }
  });
});
