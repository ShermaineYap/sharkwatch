"""Run study texts through local Gemma 4 E2B. Saves after every item; resumes if restarted.
Usage: python3 run_gemma_study.py items.jsonl cache_out.json runs_out.json"""
import json, time, hashlib, sys, os
from llama_cpp import Llama
items_f, cache_f, runs_f = sys.argv[1:4]
items = [json.loads(l) for l in open(items_f)]
prompt = open("sharkwatch/prompts/extract.md").read()
MODEL = "gemma-4-E2B-it Q4_0 (local, llama.cpp)"
cache = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
runs = json.load(open(runs_f)) if os.path.exists(runs_f) else []
done = {r["id"] for r in runs}
m = Llama(model_path="models/gemma-4-E2B-it-Q4_0.gguf", n_ctx=4096, n_threads=2, verbose=False, seed=305)
for it in items:
    if it["id"] in done: continue
    text = it["text"].strip()
    t0 = time.time()
    r = m.create_chat_completion(messages=[{"role": "user", "content": prompt.replace("{{TEXT}}", text)}], temperature=0, max_tokens=1200)
    ms = int((time.time() - t0) * 1000)
    out = r["choices"][0]["message"]["content"]
    try:
        raw = json.loads(out[out.find("{"): out.rfind("}") + 1]); ok = True
    except Exception:
        raw, ok = {"_unparsed": out[:500]}, False
    cache[hashlib.sha256(text.encode()).hexdigest()[:16]] = {"model": MODEL, "raw": raw, "ms": ms}
    runs.append({"id": it["id"], "ms": ms, "json_ok": ok, "out_tokens": r["usage"]["completion_tokens"]})
    json.dump(cache, open(cache_f, "w"), indent=1); json.dump(runs, open(runs_f, "w"), indent=1)
    print(it["id"], ms, "ok" if ok else "PARSE-FAIL", flush=True)
