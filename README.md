# SharkWatch

**Check a VA claims helper before you sign.** Paste the ad, text message, web page or contract a "claims consultant" sent you. SharkWatch tells you three things, each with its source:

1. **Who is offering help:** is this person in the VA's own roster of accredited attorneys, claims agents and VSO representatives?
2. **Does the fee follow VA rules:** checked against 38 CFR 14.636 (no fees for a first claim, fees measured against back pay, the 20% and 33⅓% presumptions, written agreements).
3. **Where to get free help:** accredited Veterans Service Organizations in your state, from the same roster.

Built for the **305 Veterans Hackathon, November 2026** (GDG at FIU). Competition type: **Technical**.

## Why

Filing a VA claim is free, and accredited Veterans Service Organizations help for free. Yet unaccredited "claim sharks" typically charge veterans upwards of $5,000, often as "5x or 6x your monthly increase" ([KLRD, 2026](https://klrd.gov/2026/03/02/briefing-book-2026-veterans-affairs-claim-sharks/)). There is no federal criminal penalty for it today, so checking for yourself is the main protection. VA's own search only takes a person's name; it cannot read an ad, and it says nothing about the fee.

## How it works

```
pasted text ──► Gemma reads the facts ──► grounded fee patterns ──► roster check ──► fixed rules ──► verdict
               (names, fee basis, stage,    (exact "5x the monthly     (Snowflake, or       (38 CFR 14.636;
                login requests, quotes)      increase" wording wins)    bundled snapshot)    the AI never decides)
```

- **Gemma** (`gemma-4-31b-it` through the Gemini API in the live app; Gemma 4 E2B locally for the study) extracts facts as JSON with exact evidence quotes. Names and quotes that are not in the text are discarded. Instructions hidden in the text are ignored.
- **Snowflake** holds the VA roster (`snowflake/01_schema_and_match.sql`): a `PEOPLE` view over attorneys, claims agents and VSO reps; exact lookups; `JAROWINKLER_SIMILARITY` for "did you mean" suggestions; per-state free-help aggregation. The app queries it through the Snowflake SQL API with key-pair auth (`web/lib/snowflake.ts`). Without Snowflake credentials it uses a bundled snapshot with the same logic.
- **Rules** (`web/lib/rules.ts`) are deterministic and cite the regulation paragraph for every flag.

### The verification ladder (the headline finding)

Day-1 test on the VA roster (14,654 people, snapshot 2026-11-23): fuzzy name matching is unsafe. At a Jaro-Winkler threshold that still finds 94% of typo'd real names, **12% of made-up names "match" someone accredited** (e.g. "Jennifer Steele" scores 98.7 against a real "Jennifer Steel"). So SharkWatch never says "verified" from a fuzzy match:

| Evidence | Result |
|---|---|
| Accreditation number matches (unique across all 14,654) | Verified |
| Exact name + state (0.09% random collision) | Name found in this state; confirm the number |
| Exact name, no state | Name found, not confirmed |
| Similar name only | **Not in VA's roster.** "Did you mean" shown, never green |

Details: [`DAY1_FINDINGS.md`](DAY1_FINDINGS.md).

## Measured study

Real public text only (company names replaced with `[COMPANY]`), labelled under a fixed [policy](study/LABEL_POLICY.md) before any model run.

**Held-out set** (19 new excerpts, scored once after the public design-freeze commit `dadbc33`):

| | Verdict correct | Claim-shark texts caught | Legitimate texts wrongly red |
|---|---|---|---|
| Gemma alone | 94.7% | 4 of 4 | 0 of 13 |
| Keyword rules alone | 73.7% | 2 of 4 | 0 of 13 |
| **SharkWatch** | **94.7%** | **4 of 4** | **0 of 13** |

**Development set** (23 excerpts, seen while improving): 87.0% verdicts correct, 8 of 8 claim-shark texts caught, 0 of 10 legitimate texts wrongly red. Gemma 4 E2B (Q4_0, llama.cpp, 2-core CPU) returned valid JSON 42 of 42 times, median about 26 s per text.

One design change was made after the freeze, to stop "free consultation" offers from unaccredited companies being shown as free help: see [`study/POST_FREEZE.md`](study/POST_FREEZE.md). It changed no held-out verdict.

Reproduce: `python3 scripts/run_gemma_study.py study/heldout.jsonl <cache> <runs>` then `cd web && npx tsx scripts/score-study.ts ../study/heldout.jsonl <out> <cache> <runs>`.

## Run it

```bash
cd web
npm install
npm test            # 20 unit tests: rules, verification ladder, extraction safety
npm run dev         # http://localhost:3000
```

Optional environment variables are in [`web/.env.example`](web/.env.example). Without any keys, the built-in examples use recorded Gemma output and new text uses a keyword fallback (clearly labelled in the result).

To load the roster into Snowflake: run `snowflake/01_schema_and_match.sql` setup, then `cd web && npx tsx scripts/load-snowflake.ts ../data_snapshot_2026-11-23`.

To refresh the roster: `python3 scripts/parse_rosters.py <raw> data_snapshot_<date>` (downloads from <https://www.va.gov/ogc/apps/accreditation/>), then `npm run roster`.

## Honest limitations

- Companies are not in VA's roster; only people are. If a text names only a company, SharkWatch can only say so and tell you what to ask.
- A name match is not identity: someone can use a real accredited person's name. The accreditation number is the strong check, and even that should be confirmed on VA's site.
- The roster snapshot is dated; VA refreshes it three times a week.
- The study is small (42 excerpts) and single-annotator; the labels were written by the author.
- Fee rules here are federal only. Some states have their own laws on claims consultants.
- Not legal advice.

## Data, tools and credits

- VA Office of General Counsel accreditation roster: <https://www.va.gov/ogc/apps/accreditation/> (public data).
- 38 CFR 14.636 text from the eCFR API (current as of 2026-11-19).
- Gemma 4 (Google) via the Gemini API and, for the local study, `ggml-org/gemma-4-E2B-it-GGUF` with llama.cpp.
- Snowflake (SQL API, `JAROWINKLER_SIMILARITY`).
- Next.js, React, jose, Vitest; Public Sans and Source Serif 4 fonts.
- **AI assistance:** this project was built with substantial help from Claude (Anthropic) for research, code, the study harness and writing. All design decisions, labels and claims were reviewed by the author. Gemma is the AI used inside the product.

## Licence

MIT. See [`LICENSE`](LICENSE).
