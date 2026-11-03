"""Map each roster sheet to its TYPE-MOON wiki page (#376).

Tries the sheet name, then the name with its variant marks stripped, then the
wiki's own search. Every guess is written to resolved.json with how it was
found, so a wrong match is visible and can be pinned in ALIASES.
"""
import json, os, re, sys
import wiki
from roster import roster

HERE = os.path.dirname(__file__)
ALIASES = json.load(open(os.path.join(HERE, "aliases.json"), encoding="utf-8")) \
    if os.path.exists(os.path.join(HERE, "aliases.json")) else {}
NOT_SERVANTS = {"Note for Grand Order Campaign"}
VARIANT = re.compile(r"\s*\((Summer|Santa|Alter|Lily|Mistake|Extra|Light|Saber|Lancer|Archer|Caster|Rider|"
                     r"Berserker|Assassin|Ruler|Avenger|Foreigner|Pretender)\)\s*|^Summer\s+|\s+Summer$|^Space\s+|\s+Alter$",
                     re.I)


def base_name(name):
    return VARIANT.sub(" ", name).strip()


def true_names(path):
    """The sheet's own `True Name:` line, split on commas; marks like (?) dropped."""
    from roster import ROOT
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        text = f.read(3000)
    m = re.search(r"True Name:\s*([^\n]+?)(?:\s{2,}|\n|Region:)", text)
    if not m:
        return []
    parts = re.split(r",|/|\band\b", m.group(1))
    return [re.sub(r"\(\?\)|\\|\*", "", p).strip() for p in parts if p.strip()]


def query(titles):
    d = wiki.api(wiki.TM, action="query", titles="|".join(titles), redirects=1)
    q = d["query"]
    redir = {}
    for key in ("normalized", "redirects"):
        for r in q.get(key, []):
            redir[r["from"]] = r["to"]
    found = {p["title"] for p in q["pages"] if not p.get("missing") and not p.get("invalid")}
    out = {}
    for t in titles:
        x = t
        for _ in range(5):
            if x in redir:
                x = redir[x]
        out[t] = x if x in found else None
    return out


def search(name):
    d = wiki.api(wiki.TM, action="query", list="search", srsearch=name, srlimit=3)
    hits = d["query"]["search"]
    return hits[0]["title"] if hits else None


def main():
    rows = [r for r in roster() if r["name"] not in NOT_SERVANTS]
    for r in rows:
        r["trueNames"] = true_names(r["file"])
    names = sorted({r["name"] for r in rows} | {base_name(r["name"]) for r in rows}
                   | {t for r in rows for t in r["trueNames"]})
    names = [ALIASES.get(n, n) or n for n in names]
    hit = {}
    for i in range(0, len(names), 50):
        hit.update(query(names[i:i + 50]))
    out = []
    for r in rows:
        n, b = r["name"], base_name(r["name"])
        if n in ALIASES:
            page, how = (hit.get(ALIASES[n]) if ALIASES[n] else None), "alias"
        elif any(hit.get(t) for t in r["trueNames"]):
            t = next(t for t in r["trueNames"] if hit.get(t))
            page, how = hit[t], "trueName"
        elif hit.get(n):
            page, how = hit[n], "name"
        elif hit.get(ALIASES.get(b, b)):
            page, how = hit[ALIASES.get(b, b)], "base"
        else:
            page, how = search(b), "search"
        out.append({**r, "base": b, "page": page, "how": how})
    json.dump(out, open(os.path.join(HERE, "resolved.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(Counter(x["how"] for x in out))


if __name__ == "__main__":
    main()
