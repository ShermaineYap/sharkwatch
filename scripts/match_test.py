"""Day-1 test: can a Jaro-Winkler name match against the VA roster
(a) find the right person when the name has a typo, and
(b) avoid 'finding' people who are not in the roster?

Snowflake's JAROWINKLER_SIMILARITY returns 0-100; rapidfuzz's JaroWinkler
returns 0-1, so thresholds here are reported on Snowflake's 0-100 scale.
"""
import random, re, sys, unicodedata, json
import pandas as pd
from rapidfuzz.distance import JaroWinkler
from rapidfuzz import process

random.seed(305)
D = sys.argv[1]

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z ]", "", s.lower()).strip()

frames = []
for f, kind in [("attorneys", "attorney"), ("claims_agents", "claims_agent"), ("vso_reps", "vso_rep")]:
    d = pd.read_csv(f"{D}/{f}.csv", dtype=str).fillna("")
    d["kind"] = kind
    frames.append(d[["first_name", "last_name", "state", "registration_num", "kind"]])
P = pd.concat(frames, ignore_index=True)
P["full"] = (P.first_name.map(norm) + " " + P.last_name.map(norm)).str.strip()
names = P.full.tolist()
name_set = set(names)

# Ambiguity: same normalised full name, different people
dup = P.groupby("full").registration_num.nunique()
amb_rows = int(P.full.map(dup).gt(1).sum())

def typo(s):
    i = random.randrange(1, len(s) - 1)
    op = random.choice(["swap", "drop", "sub", "double"])
    if op == "swap": return s[:i] + s[i + 1] + s[i] + s[i + 2:]
    if op == "drop": return s[:i] + s[i + 1:]
    if op == "double": return s[:i] + s[i] + s[i:]
    return s[:i] + random.choice("abcdefghijklmnopqrstuvwxyz") + s[i + 1:]

def best(q):
    m = process.extractOne(q, names, scorer=JaroWinkler.normalized_similarity)
    return m[0], round(m[1] * 100, 1)

# (a) positives with one typo
pos = P[P.full.str.len() > 8].sample(200, random_state=305)
pos_res = []
for _, r in pos.iterrows():
    q = typo(r.full)
    hit, score = best(q)
    pos_res.append({"truth": r.full, "query": q, "hit": hit, "score": score, "correct": hit == r.full})

# (b) negatives: real first + real last names recombined, combo not in roster
firsts = P.first_name.map(norm).replace("", pd.NA).dropna().tolist()
lasts = P.last_name.map(norm).replace("", pd.NA).dropna().tolist()
neg_res = []
while len(neg_res) < 200:
    q = f"{random.choice(firsts)} {random.choice(lasts)}"
    if q in name_set: continue
    hit, score = best(q)
    neg_res.append({"query": q, "hit": hit, "score": score})

pos_df, neg_df = pd.DataFrame(pos_res), pd.DataFrame(neg_res)
rows = []
for t in [85, 88, 90, 92, 94, 96, 98]:
    rows.append({
        "threshold": t,
        "typo_found_correct_%": round(100 * ((pos_df.score >= t) & pos_df.correct).mean(), 1),
        "fake_name_false_match_%": round(100 * (neg_df.score >= t).mean(), 1),
    })
out = {
    "roster_people": len(P),
    "by_kind": P.kind.value_counts().to_dict(),
    "rows_with_ambiguous_name": amb_rows,
    "ambiguous_pct": round(100 * amb_rows / len(P), 2),
    "typo_top1_correct_any_score_%": round(100 * pos_df.correct.mean(), 1),
    "threshold_sweep": rows,
    "worst_fake_matches": neg_df.sort_values("score", ascending=False).head(5).to_dict("records"),
}
print(json.dumps(out, indent=1))
pos_df.to_csv(f"{D}/../test_positive_typos.csv", index=False)
neg_df.to_csv(f"{D}/../test_negative_fakes.csv", index=False)
