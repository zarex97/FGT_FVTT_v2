---
id: 2026-10-14-dodge-ruling-misquoted
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** #204's "Already ruled" line: "Dodge for a duration evades every Attack in it, not only the next (Jack, #185)". So the copied Eye of the Mind's Dodge, ⅔◈, would stand after Medea's Aero.
**Actual:** Dodge evaded Aero and was gone. #185 rules only Dodge's DURATION inside the Mist (reading 11); `packs/_source/effects/dodge.yml` says "Automatically evades the next attack".
**Cause:** `gh issue view 204 @ 4983091` — the line was written from memory of #185, not read from it.
**Fix:** the "Already ruled" line comes out of #204 (corrected in the issue body with the press evidence).
