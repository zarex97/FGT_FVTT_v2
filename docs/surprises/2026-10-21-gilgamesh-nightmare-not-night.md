---
id: 2026-10-21-gilgamesh-nightmare-not-night
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Filing #294, *an effect that sets Day or Night*, I named Gilgamesh (Archer) as a third sheet. A grep
for `becomes (Night|Day)` had matched his sheet, and I wrote him into `docs/model/environment.md` and the issue
without opening the line.

**Actual:** Reading Archer in full, the match is *"Sleep (Note: If three or more 12s are rolled, becomes Nightmare
instead)"*. It names a debuff, not the Round's phase. Two sheets carry the rule, not three.

**Cause:** `char_orig_sheets/by-class/Archer/Gilgamesh.md:86`. A regex hit is a lead, the same mechanism as the
keyword pre-sort the user stopped earlier the same day.

**Fix:** `environment.md` and #294 now name Kuonji Alice and Tamamo Goth only. A sheet count in a model file comes
from Clauses read, never from a grep alone.
