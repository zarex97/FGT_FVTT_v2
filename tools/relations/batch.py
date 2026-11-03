"""Group mined entries into pairs of figures and split them into one batch per
Class (#376). A pair goes to the Class of its alphabetically first figure's
first roster sheet; proposals cross-reference the other Class."""
import json, os
from collections import defaultdict

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "work")


def main():
    res = json.load(open(os.path.join(HERE, "resolved.json"), encoding="utf-8"))
    mined = json.load(open(os.path.join(HERE, "mined.json"), encoding="utf-8"))["records"]
    sheets = defaultdict(list)
    for r in res:
        if r["page"]:
            sheets[r["page"]].append(f'{r["name"]} ({r["class"]})')
    pairs = defaultdict(list)
    for m in mined:
        a, b = sorted((m["from"], m["to"]))
        pairs[(a, b)].append({"speaker": m["from"], "about": m["to"], "sub": m["sub"],
                              "text": m["text"], "url": m["url"]})
    batches = defaultdict(list)
    for (a, b), entries in sorted(pairs.items()):
        cls = sheets[a][0].rsplit("(", 1)[1].rstrip(")")
        batches[cls].append({"a": a, "b": b, "aSheets": sheets[a], "bSheets": sheets[b], "entries": entries})
    os.makedirs(OUT, exist_ok=True)
    for cls, rows in batches.items():
        json.dump(rows, open(os.path.join(OUT, f"{cls}.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(cls, len(rows))


if __name__ == "__main__":
    main()
