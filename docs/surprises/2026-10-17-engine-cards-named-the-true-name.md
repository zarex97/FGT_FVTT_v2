---
id: 2026-10-17-engine-cards-named-the-true-name
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** every card the engine posts names a Unit as the table knows it (`publicIdentityOf`, #230 §46.4-NV;
the Proto Gil lesson widened CLAUDE.md to say so).
**Actual:** live, Round 5 tick 13: Player1 spent Suspend Skill and the public card read *"Master of Archer of Faction 1
spends 1 Command Spell(s): Suspend Skill, on Arjuna's Fated Rivals of the Mahabharata."* The End of the Turn card and
the periodic card named Units the same way (Surprise 2026-10-17-regen-heal-said-nowhere).
**Cause:** `module/engine/command-spells.mjs:220 @ 5ecdefeb` — three more cards read `actor.name` beside
`publicIdentityOf`; the lesson was applied to the lines a new feature wrote, not swept across the old ones.
**Fix:** `module/engine/command-spells.mjs:220 @ 5ecdefeb` — the Command Spell card, the Turn and Round end cards and
the periodic card ask `publicIdentityOf`. A sweep for the rest is left open (Ch. 46 §46.35).
