---
id: 2026-10-10-opt-out-implies-default
found: retraction
kind: opt-out-implies-default
status: fixed
reviewed: false
---
**Expected:** I recommended one Injury Roll per target for Dohatsu Tenshou's five instances, if any one cleared the threshold.
**Actual:** Asked to explain, I took it back. Quickfire's sheet has to opt out in writing, *"only performs an Injury Roll once, regardless of number of hits"*, so the default is one roll per hit. The user ruled each instance rolls on its own.
**Cause:** `packs/_source/abilities/nemo-quickfire.yml:30 @ 27c8858` — the opt-out sentence was in front of me from Nemo's audit, and I didn't read it as evidence of the default it opts out of.
**Fix:** `#195 reading 18 @ 27c8858` — each instance over the threshold calls for its own Injury Roll. When a sheet says "only once" somewhere, treat "many" as the default everywhere it is silent.
