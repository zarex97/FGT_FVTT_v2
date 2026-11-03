"""Leads for the `named` preset (#376): a roster sheet whose text names another
roster figure. A regex hit is a lead; each is read in context before proposing."""
import json, os, re
from collections import defaultdict
from roster import ROOT

HERE = os.path.dirname(__file__)
GENERIC = {"saber", "archer", "lancer", "rider", "caster", "assassin", "berserker", "ruler", "avenger",
           "beast", "valkyrie", "gorgon", "avenger", "jeanne", "merlin", "medusa", "nero", "summer"}


def main():
    res = [r for r in json.load(open(os.path.join(HERE, "resolved.json"), encoding="utf-8")) if r["page"]]
    keys = defaultdict(set)  # figure page -> names that point at it
    for r in res:
        for n in [r["name"], r["base"], r["page"], *r["trueNames"]]:
            n = re.sub(r"\s*\([^)]*\)", "", n or "").strip()
            if len(n) >= 5 and n.lower() not in GENERIC:
                keys[r["page"]].add(n)
    leads = []
    for r in res:
        text = open(os.path.join(ROOT, r["file"]), encoding="utf-8").read()
        # skip the header block (name, true name, region): the sheet naming itself
        body = text[600:]
        for page, names in keys.items():
            if page == r["page"]:
                continue
            for n in sorted(names, key=len, reverse=True):
                m = re.search(r"(?<![\w])" + re.escape(n) + r"(?![\w])", body)
                if m:
                    s = max(0, m.start() - 160)
                    leads.append({"sheet": r["name"], "class": r["class"], "page": r["page"], "names": page,
                                  "match": n, "context": re.sub(r"\s+", " ", body[s:m.end() + 160])})
                    break
    json.dump(leads, open(os.path.join(HERE, "work", "named-leads.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print(len(leads), "leads")


if __name__ == "__main__":
    main()
