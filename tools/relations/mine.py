"""Fetch every roster page's `Relationships` section and keep the entries
that name another roster Servant (#376).

Writes mined.json: one record per (source page, target page) with the
entry's text, the subsection it sits under, the page revision id and URL.
A record is evidence for review, not a relationship: the preset is a human
call (spec §2.1).
"""
import json, os, re, urllib.parse
from collections import defaultdict
import wiki
from resolve import query

HERE = os.path.dirname(__file__)
GROUPISH = re.compile(r"Servants|Emperors|Knights|Round Table|members|Argonauts|Classroom|Shinsengumi|Generals", re.I)
LINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")


def sections(page):
    d = wiki.api(wiki.TM, action="parse", page=page, prop="sections|revid", redirects=1)
    return d["parse"]["sections"], d["parse"]["revid"]


def wikitext(page, index):
    d = wiki.api(wiki.TM, action="parse", page=page, prop="wikitext", section=index, redirects=1)
    return d["parse"]["wikitext"]


def clean(text):
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = LINK.sub(lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"<[^>]+>|'''?|\{\{[^}]*\}\}", "", text)
    return re.sub(r"\s+", " ", text).strip()


def entries(text):
    """`;[[Target]]` headed entries, each with its `:` body and the subsection it sits in."""
    out, cur, sub = [], None, None
    for line in text.splitlines():
        h = re.match(r"^(=+)\s*(.*?)\s*\1\s*$", line)
        if h:
            sub = clean(h.group(2))
            continue
        if line.startswith(";"):
            # an entry with no body of its own, right after a group heading's
            # entries, belongs to that group ("[[Argonauts]] Servants" then
            # ";[[Jason]]", ";[[Medea]]"...): it points back at the heading
            prev = out[-1] if out else None
            group = None
            if prev is not None:
                group = prev["group"] if not prev["body"] and prev.get("group") is not None \
                    else (len(out) - 1 if prev["body"] else None)
            cur = {"head": line[1:], "targets": [m.group(1).strip() for m in LINK.finditer(line)],
                   "sub": sub, "body": [], "group": group}
            out.append(cur)
        elif line.startswith(":") and cur:
            cur["body"].append(line.lstrip(":"))
    return out


def main():
    resolved = json.load(open(os.path.join(HERE, "resolved.json"), encoding="utf-8"))
    by_page = defaultdict(list)
    for r in resolved:
        if r["page"]:
            by_page[r["page"]].append(r["id"])
    raw, missing = [], []
    for page in sorted(by_page):
        secs, revid = sections(page)
        rel = [s for s in secs if s["line"].strip().lower() == "relationships"]
        if not rel:
            missing.append(page)
            continue
        level = rel[0]["toclevel"]
        # the section and its subsections share the first index's text
        text = wikitext(page, rel[0]["index"])
        es = entries(text)
        for e in es:
            g = es[e["group"]] if e["group"] is not None else None
            e["groupHead"] = clean(g["head"]) if g else None
            e["groupBody"] = " ".join(g["body"]) if g else ""
            e["groupTargets"] = g["targets"] if g else []
            raw.append({"page": page, "revid": revid, **e})
    targets = sorted({t for e in raw for t in e["targets"]})
    canon = {}
    for i in range(0, len(targets), 50):
        canon.update(query(targets[i:i + 50]))
    def strip(t):
        return re.sub(r"\s*\([^)]*\)\s*$", "", t or "").strip()

    by_base = defaultdict(set)
    for p in by_page:
        by_base[strip(p)].add(p)

    def land(t):
        """A link's roster page: exact, else its base form, else the one roster form of that base."""
        c = canon.get(t) or t
        if c in by_page:
            return c, "exact"
        if strip(c) in by_page:
            return strip(c), "base"
        forms = by_base.get(c, set()) | (by_base.get(strip(c), set()) if strip(c) != c else set())
        if len(forms) == 1:
            return next(iter(forms)), "form"
        return None, None

    out = []
    for e in raw:
        hits = {}
        for t in e["targets"]:
            p, via = land(t)
            if p and p != e["page"]:
                hits.setdefault(p, via)
        text = clean(" ".join(e["body"]))
        group = None
        if not text and e["groupHead"] and GROUPISH.search(e["groupHead"]) \
                and not any(land(t)[0] for t in e["groupTargets"]):
            # the heading names no roster figure: a group, and its text is the evidence
            group, text = e["groupHead"], clean(e["groupBody"])
        for t, via in sorted(hits.items()):
            out.append({"group": group,
                "from": e["page"], "to": t, "via": via, "sub": e["sub"],
                "text": text[:600],
                "revid": e["revid"],
                "url": "https://typemoon.fandom.com/wiki/" + urllib.parse.quote(e["page"].replace(" ", "_"))
                       + "?oldid=" + str(e["revid"]),
            })
    json.dump({"pages": len(by_page), "noRelationships": missing, "records": out},
              open(os.path.join(HERE, "mined.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    pairs = {tuple(sorted((r["from"], r["to"]))) for r in out}
    print(f"{len(by_page)} pages, {len(missing)} without Relationships, {len(out)} records, {len(pairs)} pairs")


if __name__ == "__main__":
    main()
