"""Shared MediaWiki API access for the Linked Summon research (#376).

Plain page fetches return 403 from the cloud container; the API answers.
Responses are cached under tools/relations/.cache (git-ignored) so a rerun
does not hit the wikis again.
"""
import hashlib, json, os, time, urllib.parse, urllib.request

TM = "https://typemoon.fandom.com/api.php"
FGO = "https://fategrandorder.fandom.com/api.php"
CACHE = os.path.join(os.path.dirname(__file__), ".cache")
UA = "FGT-FVTT-relations-research/1.0"


def api(base, **params):
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = base + "?" + urllib.parse.urlencode(params)
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data
