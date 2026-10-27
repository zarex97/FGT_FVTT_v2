---
id: 2026-10-27-attack-path-wrote-the-queued-end
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Usage 1 as Fafnir queues Fafnir's end for the Turn's end; that Turn's 40 upkeep charges first.
**Actual:** Fafnir was off before the Turn's end; the Master paid no upkeep, though the card said *"Akafiloga Argrise: Fafnir ends at the end of this Turn."*
**Cause:** `module/engine/attack.mjs:6893 @ 6ef9ce96` — the attack path writes a `setMode` phase itself as well as the caster pass at declaration, so the queued end had a second, immediate writer.
**Fix:** `module/engine/attack.mjs:6898 @ ab3d28a9` — the attack path skips an `atTurnEnd` setMode; a played test holds Fafnir Active through the hit.
