"""Render classified batches into docs/relations/proposals/<Class>.md (#376).

Each Class file lists flagged pairs first (the user rules them), then every
proposed pair, then the pairs set aside (Chaldea chatter, denials) so the
user can see nothing was dropped silently. A pair also appears, as a
pointer, in the file of the other figure's Class."""
import glob, json, os, re
from collections import defaultdict
from roster import ROOT

HERE = os.path.dirname(__file__)
OUT = os.path.join(ROOT, "docs", "relations", "proposals")


def cls_of(sheets):
    return [s.rsplit("(", 1)[1].rstrip(")") for s in sheets]


def esc(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")


def who(page, sheets):
    names = sorted({s.rsplit(" (", 1)[0] for s in sheets})
    return f"**{page}**" + (f" ({', '.join(names)})" if names != [page] else "")


def nums(r):
    if not r.get("preset"):
        return "—"
    return f"`{r['preset']}` {r['same']}/{r['enemy']}" + (" ✱" if r.get("override") else "")


def main():
    rows_by_cls = defaultdict(list)
    inputs = {}
    for f in glob.glob(os.path.join(HERE, "work", "*.json")):
        n = os.path.basename(f)
        if n.endswith(".out.json") or n == "named-leads.json":
            continue
        for r in json.load(open(f, encoding="utf-8")):
            inputs[(r["a"], r["b"])] = r
    for f in sorted(glob.glob(os.path.join(HERE, "work", "*.out.json"))):
        cls = re.sub(r"-part\d+$", "", os.path.basename(f)[:-9])
        for r in json.load(open(f, encoding="utf-8")):
            src = inputs[(r["a"], r["b"])]
            r["aSheets"], r["bSheets"] = src["aSheets"], src["bSheets"]
            rows_by_cls[cls].append(r)
    pointers = defaultdict(list)
    for cls, rows in rows_by_cls.items():
        for r in rows:
            if r.get("preset"):
                for other in set(cls_of(r["bSheets"])) - {cls}:
                    pointers[other].append((cls, r))
    os.makedirs(OUT, exist_ok=True)
    total = defaultdict(int)
    for cls in sorted(set(rows_by_cls) | set(pointers)):
        rows = sorted(rows_by_cls.get(cls, []), key=lambda r: (r["a"], r["b"]))
        flagged = [r for r in rows if r.get("flag")]
        kept = [r for r in rows if r.get("preset") and not r.get("flag")]
        dropped = [r for r in rows if not r.get("preset") and not r.get("flag")]
        total["kept"] += len(kept); total["flag"] += len(flagged); total["drop"] += len(dropped)
        L = [f"# {cls}: proposed relationships",
             "",
             "Mined from the TYPE-MOON wiki for Linked Summon (#376), classed per "
             "[the spec](../../superpowers/specs/2026-11-03-linked-summon-design.md) §2.1. "
             "Numbers are same side / enemy side; ✱ marks an override of the preset. "
             "Nothing here is in the game until approved.",
             "",
             f"**{len(flagged)} to rule · {len(kept)} proposed · {len(dropped)} set aside** "
             f"(Chaldea chatter or no tie).",
             "",
             "## To rule", ""]
        L += ["| Pair | Context | Proposed | Why flagged | Reason | Evidence |", "|---|---|---|---|---|---|"]
        L += [f"| {who(r['a'], r['aSheets'])} – {who(r['b'], r['bSheets'])} | {r['context']} | {nums(r)} | "
              f"{esc(r.get('flagReason'))} | {esc(r['reason'])} | [“{esc(r['quote'])[:160]}”]({r['url']}) |"
              for r in flagged] or ["_None._"]
        L += ["", "## Proposed", "", "| Pair | Context | Proposed | Reason | Evidence |", "|---|---|---|---|---|"]
        L += [f"| {who(r['a'], r['aSheets'])} – {who(r['b'], r['bSheets'])} | {r['context']} | {nums(r)} | "
              f"{esc(r['reason'])} | [“{esc(r['quote'])[:160]}”]({r['url']}) |" for r in kept] or ["_None._"]
        if pointers.get(cls):
            L += ["", "## Listed under another Class", ""]
            L += [f"- {r['a']} – {r['b']}: {nums(r)}, see [{c}]({c.replace(' ', '%20')}.md)"
                  for c, r in sorted(pointers[cls], key=lambda x: (x[1]['a'], x[1]['b']))]
        L += ["", "## Set aside", "", "<details><summary>Pairs with no tie proposed</summary>", ""]
        L += [f"- {r['a']} – {r['b']} ({r['context']}): {esc(r['reason'])}" for r in dropped] or ["_None._"]
        L += ["", "</details>", ""]
        open(os.path.join(OUT, f"{cls}.md"), "w", encoding="utf-8").write("\n".join(L))
    print(dict(total))


if __name__ == "__main__":
    main()
