---
id: 2026-11-14-subagent-counts-disagreed
found: tooling
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** The fact reports I sent to the Godot port's plan writers gave counts I passed on as checked: a `UnitSnapshot` of "~115 top-level keys", "15 pure engine files", "~83 pure test files". One writer then reported "45 audits / 5,030 Clauses".
**Actual:** `snapshotUnit` returns 199 top-level keys, counted by script over its literal. Twelve of the 98 engine files have no Foundry global, and only five also have pure imports. The pure test count came back as 83 from one reader and 88 from another. GitHub shows 50 closed Servant audits holding exactly 5,565 Clauses (`gh issue list`, summed over titles), so the 45/5,030 came from a truncated list. Two other claims also proved stale: `module/rules/targeting/resolve.mjs` still says "nine anchors × eleven shapes" where the tables hold 12 and 12, and the "R=4 range diagram" said of a golden file is an authoring-vocabulary test.
**Cause:** `module/rules/snapshot.mjs:111 @ 624eccf2`, `module/rules/targeting/resolve.mjs:9 @ 624eccf2`. Each count was one reader's regex or grep pass, relayed without a second count, and I put them in a brief as facts.
**Fix:** The plan's editor pass uses the recounted figures. The pure test count is written as "about 85, to be recounted when the exporter is built". A count that sizes a milestone is recounted by me before it goes into a brief.
