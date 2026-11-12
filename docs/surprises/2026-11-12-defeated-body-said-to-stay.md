---
id: 2026-11-12-defeated-body-said-to-stay
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** In the information-system grill (Q26) I recommended that a defeated Unit's Dossier stay open because *"a defeated Unit's body still sits on the board, and a later revival (Guts) unfreezes it."*
**Actual:** The user asked whether a final defeat removes the body. It does: `clearBody` deletes a defeated Unit's tokens one tick after the fall and keeps only the actor, and revivals run in the chain before a defeat is final, so nothing unfreezes.
**Cause:** `module/engine/io.mjs:1120 @ 67d83da` (`clearBody`): I described the body from memory of Feigned Defeat's stand-in body, without reading the defeat path, and a grill pick rested on it.
**Fix:** `docs/surprises/2026-11-12-defeated-body-said-to-stay.md:9 @ 67d83da`: the pick was taken back in the same turn and re-asked with the body's removal stated; the spec records the corrected ruling.
