"""Check every classified batch against its input (#376): same pairs in the
same order, closed words only, numbers present exactly when a preset is, and
each quote found in that pair's own entries (a wrong-batch read fails here)."""
import glob, json, os, sys

HERE = os.path.dirname(__file__)
CTX = {"legend", "grailwar", "story", "chaldea", "none"}
PRESET = {"bond", "knew", "cycle", None}
QUOTES = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"'})
norm = lambda s: " ".join((s or "").translate(QUOTES).split())
bad = 0
for out in sorted(glob.glob(os.path.join(HERE, "work", "*.out.json"))):
    name = os.path.basename(out)
    if name == "named.out.json":
        continue
    inp = json.load(open(out.replace(".out.json", ".json"), encoding="utf-8"))
    rows = json.load(open(out, encoding="utf-8"))
    errs = []
    if len(rows) != len(inp):
        errs.append(f"rows {len(rows)} != input {len(inp)}")
    for i, (r, s) in enumerate(zip(rows, inp)):
        if (r["a"], r["b"]) != (s["a"], s["b"]):
            errs.append(f"#{i} pair {r['a']}|{r['b']} != {s['a']}|{s['b']}")
            continue
        if r["context"] not in CTX or r.get("preset") not in PRESET:
            errs.append(f"#{i} closed word: {r['context']} {r.get('preset')}")
        if bool(r.get("preset")) != (r["context"] in ("legend", "grailwar", "story")):
            errs.append(f"#{i} preset {r.get('preset')} for {r['context']}")
        if r.get("preset") and not (isinstance(r.get("same"), int) and isinstance(r.get("enemy"), int)):
            errs.append(f"#{i} numbers missing")
        q = norm(r.get("quote"))
        if q and not any(q in norm(e["text"]) for e in s["entries"]):
            errs.append(f"#{i} quote not in this pair's entries: {r['a']}|{r['b']}: {q[:60]}")
    bad += len(errs)
    print(f"{name}: {len(rows)} rows, {len(errs)} problems")
    for e in errs[:8]:
        print("   ", e)
sys.exit(1 if bad else 0)
