---
id: 2026-10-18-kawarimi-card-said-nothing-happened
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Kawarimi's card says what the press did: two Units traded places.
**Actual:** Player1 pressed Kawarimi on Kingprotea's attack card; its Skill card read *"Karakuri Genpō: Kawarimi — Assassin on Lancer — No effects were applied."*, above the separate line *"Assassin and Lancer trade places."*
**Cause:** `templates/chat/skill.hbs:27 @ 27c1e9c2` — a card with no effect rows says "No effects were applied" unless the ability is a mode; a swap's whole effect is the engine's, after the Skill resolved, and wrote no row.
**Fix:** `module/engine/skill-use.mjs#postSkillCard @ dfcaa421`, `templates/chat/skill.hbs @ dfcaa421` — a `swapsPositions` ability's card says "Two Units trade places."
