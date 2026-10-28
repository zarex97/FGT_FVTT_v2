---
id: 2026-10-28-cleanse-keeps-unremovable-silently
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Haradhanu Janaka's "removes all debuffs" says what it took and what it could not.
**Actual:** With an Unremovable Curse beside a Burn and an Atk Dwn, the card said "Burn removed", "Atk Dwn removed" and nothing of the Curse; with only the Curse held, the NP posted no card at all.
**Cause:** `module/engine/skill-use.mjs:2495 @ a17cfa57` — `removalCandidates` filters an Unremovable instance out before anything is said, and `attack.mjs` posted the caster's card only for an applied row.
**Fix:** `module/engine/skill-use.mjs:1069 @ a17cfa57` — `heldUnremovable` adds "Curse stays: it is Unremovable" (`selectorMatches` with `evenUnremovable`), and the caster's card posts for a held row too; live, the line on the card.
