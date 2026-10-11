---
kind: two-readers-one-rule
lesson: When adding or fixing a rule, find every other place that answers the same question and make them call one reader.
landed: CLAUDE.md#Lessons
---
**Mechanism:** One question is answered in two places, and the answers drift. The bar's gate and the declaration's gate, two effect paths each reading a chance, a die rolled at dispatch and again at application, an entry gate reading a bare snapshot while its neighbours read the board, a click handler that never asks whether its slot is greyed, `isSpell` and `category: spell` disagreeing about what a Spell is, and a regen counter and `tickPeriodics` disagreeing about the Turn an effect stops.
**Lesson:** Before adding or fixing a rule, grep for every other site that answers the same question. Make them all call one reader, and fix the reader, not one site.
**Surprises:** [2026-10-10-attack-skill-lit-after-attacking](../2026-10-10-attack-skill-lit-after-attacking.md) · [2026-10-10-ring-chance-two-readers](../2026-10-10-ring-chance-two-readers.md) · [2026-10-10-rider-chance-rolled-twice](../2026-10-10-rider-chance-rolled-twice.md) · [2026-10-10-effect-gate-reads-bare-snapshot](../2026-10-10-effect-gate-reads-bare-snapshot.md) · [2026-10-10-faction-budget-swallowed-the-press](../2026-10-10-faction-budget-swallowed-the-press.md) · [2026-10-10-silence-misses-category-spells](../2026-10-10-silence-misses-category-spells.md) · [2026-10-10-np-regen-ticks-on-expiry-turn](../2026-10-10-np-regen-ticks-on-expiry-turn.md)
