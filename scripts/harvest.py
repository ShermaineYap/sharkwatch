import sys, re, json, hashlib, pathlib, urllib.request
from lxml import html as LH
out = pathlib.Path(sys.argv[1]); urls = [u.strip() for u in open(sys.argv[2]) if u.strip() and not u.startswith('#')]
FEE = re.compile(r"(fee|percent|%|back ?pay|past[- ]due|increase|free of charge|no cost|at no charge|accredit|pay (us|only)|contingen|invoice|charge)", re.I)
res = []
for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (research; student hackathon)"})
        raw = urllib.request.urlopen(req, timeout=20).read()
        doc = LH.fromstring(raw)
        for bad in doc.xpath('//script|//style|//noscript|//nav|//footer|//header'): bad.drop_tree()
        text = re.sub(r"\s+", " ", " ".join(doc.itertext())).strip()
        sents = re.split(r"(?<=[.!?])\s+", text)
        hits = [s for s in sents if FEE.search(s) and 30 < len(s) < 400]
        res.append({"url": u, "chars": len(text), "hits": hits[:40]})
        (out / (hashlib.md5(u.encode()).hexdigest()[:10] + ".txt")).write_text(u + "\n\n" + text)
        print(f"OK  {len(text):6d} {len(hits):3d}  {u}")
    except Exception as e:
        print(f"ERR {type(e).__name__}: {str(e)[:60]}  {u}")
json.dump(res, open(out / "hits.json", "w"), indent=1)
