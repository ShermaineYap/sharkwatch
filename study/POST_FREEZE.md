# One change after the design freeze

After the held-out set was scored with the frozen design (commit dadbc33), the development set still showed a
dangerous error: 3 of 11 unaccredited-company texts that advertise a "free consultation" or "free strategy
session" came out green ("free help"). Telling a veteran a claim shark is free help is the worst error this
tool can make, so we changed the design after the freeze:

- A free consultation, evaluation or strategy session is treated as a sales step, not as free claims help
  (`mergeGrounded` in `web/lib/extract.ts`), unless the text separately says the claims help itself is free.
- The green stamp now reads "NO FEE" (not "FREE HELP") and still tells the reader to confirm who they are.

| Set | Frozen design | After the fix |
|---|---|---|
| Development (23) verdict correct | 73.9% | 87.0% |
| Development: unaccredited texts shown green | 3 of 11 | 0 of 11 |
| Held-out (19) verdict correct | 94.7% | 94.7% |
| Held-out: unaccredited texts shown green | 0 of 5 | 0 of 5 |

The held-out number reported as the headline is the frozen one. The fix did not change any held-out verdict,
but because it was made after seeing development results, the development number after the fix is not an
unbiased estimate.

Files: `results_dev_frozen.json`, `results_heldout_frozen.json`, `results_heldout_postfix.json`;
the app's `web/data/study-results.json` is the development set with the final code.
