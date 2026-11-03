"""The roster of the Linked Summon research: every sheet in char_orig_sheets/by-class."""
import os, re, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SHEETS = os.path.join(ROOT, "char_orig_sheets", "by-class")


def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def roster():
    out = []
    for cls in sorted(os.listdir(SHEETS)):
        d = os.path.join(SHEETS, cls)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith(".md"):
                name = f[:-3]
                out.append({"id": f"{slug(cls)}/{slug(name)}", "name": name, "class": cls,
                            "file": os.path.relpath(os.path.join(d, f), ROOT)})
    return out
