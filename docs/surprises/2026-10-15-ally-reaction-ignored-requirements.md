---
id: 2026-10-15-ally-reaction-ignored-requirements
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Rho Aias, used once and EMIYA's Health not restored above half since, is not offered.
**Actual:** offered on his reaction card; pressed, refused (`healthRestoredSince`) with a toast on the GM only; Nine Lives hit him for 956 unshielded.
**Cause:** `module/rules/reactions.mjs#allyReactions @ 960496f` asked no requirement; `abilitiesAtWindow` passed an ability without `lastUsedTick`, so the gate read "never used". The refusal toasted on the client resolving it, the active GM.
**Fix:** `reactions.mjs#selfGatesPass @ 3cc6a34` for both; `attack.mjs#tellReactionRefused` whispers the owner, worded.
