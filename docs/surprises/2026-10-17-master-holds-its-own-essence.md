---
id: 2026-10-17-master-holds-its-own-essence
found: live press
kind: sheet-binds-only-its-owner
status: fixed
reviewed: true
pattern: sheet-binds-only-its-owner
---
**Expected:** an Essence enhances its Master's Servant (*"impart different enhancements on their
respective Servants"*); the Master itself carries none of it.
**Actual:** the Master of Rider of Faction 1's Magic Crest card listed *"Dmg Up Pendant"* in its own
breakdown, and a Master holding Black Keys (R) would have had +100 Max Health.
**Cause:** `module/rules/snapshot.mjs:1760 @ b0313abf` and `module/documents/index.mjs:60 @
b0313abf` — both collect the rules of every Item a Unit holds, and the Master holds its own Essence,
whose rules are written for the Servant's copy.
**Fix:** same two sites — a `masterEssence` Item contributes only as a copy (`grantedBy`).
