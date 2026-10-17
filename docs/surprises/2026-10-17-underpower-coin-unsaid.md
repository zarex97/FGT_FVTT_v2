---
id: 2026-10-17-underpower-coin-unsaid
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** the Master of Rider of Faction 1's Magic Crest on an enemy Archer shows its Underpower coin,
as an Attack on a Master shows Overpower's, Heads or Tails (#174).
**Actual:** the card said nothing about Underpower: the coin came up Heads, and only a Tails left a
breakdown row.
**Cause:** `module/engine/attack.mjs:5160 @ b0313abf` — the flip was rolled and kept only when it
halved the damage; no flag, no summary line.
**Fix:** `module/engine/attack.mjs:5160 @ b0313abf`, `module/rules/explain.mjs#underpowerText` — the
flip is stamped on the result and printed either way.
