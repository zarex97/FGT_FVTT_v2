---
id: 2026-10-15-restore-card-claimed-a-clamp
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Castor's Mana Burst, "Restore 2 Agility and 2 Luck to this Servant", with Luck full at 9: the card says Agility 14 → 16 and Luck unchanged.
**Actual:** "Agility +2, Luck +2". Luck stayed 9. Round 2's "both twins" card read "Agility +1, Luck +1" and named nobody.
**Cause:** `module/engine/skill-use.mjs#statChangeLine @ 960496f` printed the authored delta, while its neighbour `resourceLine` has printed real numbers with "(no change)" since #185; the row carried no name for a target other than the caster.
**Fix:** `module/engine/skill-use.mjs` statChange phase `@ 3cc6a34` — reads each stat before and after, prints `Luck 9 (no change)`, and prefixes the twin's rows with its name.
