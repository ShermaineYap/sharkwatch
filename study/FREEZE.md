# Design freeze before held-out scoring

The held-out set (`heldout.jsonl`) was collected and labelled after the development set results were seen,
and before any system was run on it. The extraction prompt, grounded patterns, rules and verification
ladder were frozen at the git commit that adds this file. The held-out set is scored once, with that code,
and the result is reported whatever it is.
