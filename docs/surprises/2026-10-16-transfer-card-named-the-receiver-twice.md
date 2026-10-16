---
id: 2026-10-16-transfer-card-named-the-receiver-twice
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Player1 places [Avalon] in her Master; the card says who gave it and whom each Item Rite locks (#230 AV.2.give, AV.2.lock).
**Actual:** the card read "Item Rite · Item Rite · Master of Saber of Faction 1: [Avalon] → Master of Saber of Faction 1": the receiver named twice, the giver never, the two locks nobody's.
**Cause:** `module/engine/skill-use.mjs:577 @ uncommitted` — the `transferItem` phase pushed its row with the receiver's `unitId`, and its Item Rite rows with none, so the card's per-row "whose" prefix (`skill-use.mjs#postSkillCard`) fell back to the phase target for both. The arena test read the world, never the card.
**Fix:** `module/engine/skill-use.mjs:582 @ uncommitted` — the hand-over row is the giver's, each lock row its holder's; the arena test now reads the card's rows.
