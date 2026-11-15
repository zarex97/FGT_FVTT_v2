---
id: 2026-11-14-gm-turn-horror-claimed-automatic
found: retraction
kind: claim-without-reading-the-path
status: open
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** My recommendation for the Godot port's World Turn (Q18, 2026-11-13) said it runs "everything the GM's Turn does now, automatically", naming "the Units a sheet gives to the GM, such as Gilles' Horror, which attacks the nearest Unit in range". I rested that on a grep of the ruling (#293, 12d, ruled 2026-10-22), not on the code that runs it.
**Actual:** The engine does not attack for the Horror. On the GM's Turn it posts a card naming the nearest Unit the Horror must Attack, or that none is in reach, and the GM presses the Attack: *"FGT.Form.MustAttack"* / *"FGT.Form.NoneInReach"*. Found by the port plan's writer B and confirmed by reading the function.
**Cause:** `module/engine/form-range.mjs:89 @ 624eccf2` — `announceGmTurn` only creates a ChatMessage; the swing is the human GM's. A ruling read is not the path that runs it.
**Fix:** Open for the port: the World Turn's automatic swing is new behaviour, designed in `grail-tact-godot/docs/plan/07-war-lifecycle.md`, and its Clauses go to the user as a reading before they are built. Nothing in this repo changes.
