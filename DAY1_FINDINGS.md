# SharkWatch: Day-1 findings (23 Nov 2026)

## 1. VA roster: confirmed usable
Downloaded today from https://www.va.gov/ogc/apps/accreditation/ (the "Download Complete Lists" form posts to `attorneyexcellist.asp`, `caexcellist.asp`, `repexcellist.asp`, `orgsexcellist.asp`). The ".xls" files are really HTML tables; `parse_rosters.py` turns them into CSVs.

| List | Rows | Key columns |
|---|---|---|
| Attorneys | 5,211 | name, registration num, POA code, city, state, ZIP, phone, date accredited |
| Claims agents | 715 | same as attorneys |
| VSO representatives | 8,728 | name, registration num, city, state, ZIP, phone |
| VSO organization-to-rep links | 18,730 rows, 87 organizations | org name, org phone/city/state, rep name, rep city/state/ZIP |

**No list has a firm or company name for attorneys or agents.** Only recognised VSOs appear by organisation name. So "Is ACME Veteran Consulting accredited?" can't be answered from the roster. The app must ask for the *person's* name or accreditation number, and say so plainly.

## 2. Name matching: fuzzy matching is unsafe for verification
Test (`match_test.py`): 200 roster names with one injected typo, and 200 made-up names (real first and last names recombined, not in the roster). Thresholds on Snowflake's 0-100 Jaro-Winkler scale.

| Threshold | Typo'd real names found | Made-up names wrongly "found" |
|---|---|---|
| 90 | 100% | 60.5% |
| 94 | 94% | 12% |
| 96 | 86% | 4% |
| 98 | 60% | 1% |

Example: "Jennifer Steele" (not in roster) scores 98.7 against a real "Jennifer Steel". A shark could borrow a near-identical name.

Safer signals measured on the same roster:
- **Registration number** is unique across all 14,654 people, with none blank: exact lookup is safe to show as verified.
- **Exact name + state**: a random made-up name collides with a real person only 0.09% of the time; 0.85% of roster rows share name and state with someone else (show all candidates).
- Exact name without state: 2.98% collision, which is too high to show as verified.

**Product decision (headline feature):** a verification ladder.
1. Number matches → **Verified** (green).
2. Exact name + state → **Name found, confirm their number** (amber, shows candidates).
3. Fuzzy only → **Not verified. Did you mean…?** (never green).
4. Nothing → **Not in VA's roster as of [date]**.

## 3. Fee rules: checked against the regulation
Source: 38 CFR 14.636, eCFR text current as of 19 Nov 2026 (`rules/fee_rules.json`).
- (b) Only accredited agents and attorneys may receive fees; VSOs may not.
- (c)(1)(i) Fees only for representation after notice of an initial decision.
- (e) Fees may be fixed, hourly, a percentage, or a mix. **A flat fee alone is not a red flag**, which corrected an assumption in the original plan.
- (f)(1) ≤20% of past-due benefits presumed reasonable; >33⅓% presumed unreasonable.
- (g) Agreements must be written, signed, include the VA file number, and be filed within 30 days.

## 4. Still to test (needs your keys)
- Gemma extraction: 20 texts against `prompts/extract.md`, counting JSON failures and field accuracy; check free-tier limits for `gemma-4-31b-it` in AI Studio.
- Snowflake: load the CSVs, run `snowflake/01_schema_and_match.sql`, and run one query from a Vercel function (key-pair auth).
- R8 (VA.gov login sharing) still needs an official VA source link.
