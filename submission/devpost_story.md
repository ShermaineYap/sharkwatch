## Inspiration

Filing a VA disability claim is free, and accredited Veterans Service Organizations (VSOs) such as the VFW, DAV and the American Legion help for free. Yet unaccredited companies, often called "claim sharks", typically charge veterans upwards of $5,000 ([Kansas Legislative Research Dept., 2026](https://klrd.gov/2026/03/02/briefing-book-2026-veterans-affairs-claim-sharks/)), usually as "5x or 6x your monthly increase". Only VA-accredited attorneys and claims agents may charge, and never for a first claim (38 CFR 14.636). There is no federal criminal penalty for breaking that rule today, so the main protection is a veteran checking for themselves.

VA's own search tool only takes a person's name. A veteran has an ad, a text message or a contract. I wanted a tool that reads what they were actually sent.

## What it does

Paste the ad, message, web page or contract. SharkWatch answers three questions, with sources:

1. **Who is offering help?** Every person and accreditation number is checked against VA's accreditation roster (14,654 attorneys, claims agents and VSO representatives).
2. **Does the fee follow VA rules?** Fixed rules from 38 CFR 14.636, with the paragraph cited on every warning.
3. **Where is free help?** Accredited VSOs in the veteran's state, from the same roster.

The result is one of four stamps: **STOP** (the text shows a concrete rule breach), **CHECK** (verify before you pay), **NO FEE** (the text says the help is free) or **NOT ENOUGH** (with two questions to ask).

## How we built it

- **Gemma** reads the text and returns facts as JSON (names, fee basis, claim stage, login requests), each with an exact quote. The live app uses Gemma 4 31B through the Gemini API. The study used Gemma 4 E2B locally with llama.cpp. Names and quotes not in the text are discarded, and instructions hidden in the text are ignored.
- **Exact fee wording wins.** Phrases like "5x the monthly increase" or "20% of past-due benefits" override the model on fee fields.
- **Snowflake** holds the roster: a `PEOPLE` view over three tables, exact lookups, `JAROWINKLER_SIMILARITY` suggestions and per-state free-help aggregation. The app queries it through the Snowflake SQL API with key-pair auth. A bundled snapshot uses the same logic when Snowflake is not configured.
- **Fixed rules decide.** The AI never makes the verdict.
- Next.js on Vercel, 20 unit tests, accessible design (18px base type, keyboard focus, reduced motion).

## The finding that shaped it

On day one I tested name matching on the full roster. At a Jaro-Winkler threshold that still finds 94% of misspelled real names, **12% of made-up names "match" a real accredited person**. For example, "Jennifer Steele" is not on the roster but scores 98.7 against a real "Jennifer Steel". So SharkWatch says *verified* only for an exact accreditation number (unique across all 14,654 people) or an exact name in the same state (0.09% random collision). Similar names are shown as "did you mean", never green.

## Measured results

All text is real and public: companies' own pricing pages, news reports quoting their contracts, law firms, VSOs and county offices, with company names replaced. Labels were fixed by a written policy before any model ran.

**Held-out set (19 new excerpts, scored once after a public design-freeze commit):**

| | Verdict correct | Claim-shark texts caught | Legitimate texts wrongly red |
|---|---|---|---|
| Gemma alone | 94.7% | 4 of 4 | 0 of 13 |
| Keyword rules alone | 73.7% | 2 of 4 | 0 of 13 |
| **SharkWatch** | **94.7%** | **4 of 4** | **0 of 13** |

Development set (23 excerpts, seen while improving): 87.0% verdicts correct, 8 of 8 claim-shark texts caught, 0 of 10 legitimate texts wrongly red. Gemma returned valid JSON 42 of 42 times. Median time was 26-27 s per text on a 2-core CPU with no GPU; the hosted model is faster.

## Challenges we ran into

- The first prompt made the small Gemma model file "5x your monthly increase" under "percent of back pay", which hides exactly the claim-shark billing model. It caught 5 of 8 claim-shark texts, fewer than plain keyword rules. Defining every choice in the prompt fixed it.
- After the freeze, the development set still showed the worst possible error: 3 of 11 unaccredited companies offering a "free consultation" came out as free help. I changed the design so a free consultation counts as a sales step, and renamed the green stamp from "Free help" to "No fee". Afterwards 0 of 11 (development) and 0 of 5 (held-out) unaccredited texts came out green, and no held-out verdict changed. This change is documented in `study/POST_FREEZE.md`.
- VA's "Excel" roster downloads turned out to be HTML tables, with no company names for attorneys or agents.

## Accomplishments that we're proud of

A tool that refuses to guess: it never calls a similar name accredited, never lets the AI decide, and says "not enough" when the text gives nothing to check. Every number in this write-up comes from tests in the public repo.

## What we learned

Verification is a data problem before it is an AI problem. The roster, the regulation text and an honest held-out test did more for safety than any prompt.

## Honest limitations

- VA's roster lists people and VSOs, not companies. A text naming only a company cannot be verified, and SharkWatch says so.
- Someone can use a real accredited person's name. The accreditation number is the strong check.
- The study is small (42 excerpts) and was labelled by one person (the author).
- Federal rules only; some states have their own laws on claims consultants.
- General information, not legal advice. Nothing pasted is stored.

## What's next for SharkWatch

State laws, Spanish, a daily roster refresh as a Snowflake task, and a one-tap way to send a result to a service officer.

## Built with

Gemma 4 (Gemini API; llama.cpp locally), Snowflake (SQL API, JAROWINKLER_SIMILARITY), Next.js, React, TypeScript, Vercel, Vitest, VA Office of General Counsel accreditation roster, eCFR API. AI assistance: this project was built with substantial help from Claude (Anthropic) for research, code and writing; the author reviewed all design decisions, labels and claims.
