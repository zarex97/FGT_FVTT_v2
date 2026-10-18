---
id: 2026-10-18-kirihanasu-card-told-everyone
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** A Feigned Defeat shows every player but hers a defeat, and nothing else they see says she lives (#249 readings 17, 27).
**Actual:** Scáthach's fatal hit, Kirihanasu taken: the whispered *"Assassin is defeated by Lancer."* reached Player2 alone, as built, and a PUBLIC Skill card *"Karakuri Genpō: Kirihanasu — Assassin — 2 effect(s) applied"* reached everyone in the same breath.
**Cause:** `module/engine/skill-use.mjs#postSkillCard @ 27c1e9c2` — every Skill card is public; the ghost's own Skills were planned whispered, and Kirihanasu's card is the first of them, posted after its phases made her one.
**Fix:** `module/engine/skill-use.mjs#postSkillCard @ dfcaa421` — a Unit holding `feignedDefeat` when its card is posted has it whispered to its owners and the GM.
