---
kind: hidden-timing-rule
lesson: For every "first", "then", "if defeated" or "when X" clause, find the key that sets its timing and press the order live.
landed: CLAUDE.md#Lessons
---
**Mechanism:** When something runs is set by a rule written elsewhere, not by where it is written. A phase listed first runs after damage without `when: beforeDamage`. A death check ordered literally runs ahead of the revival chain. A `revival:` predicate is answered at collection unless `DEFERRED_PREFIXES` holds it.
**Lesson:** For each ordering word in a clause, find the key that decides its timing (`when`, `DEFERRED_PREFIXES`, the revival chain, the ladder's `TRANSITIONS`) and press the order on a live board.
**Surprises:** [2026-10-10-first-apply-runs-after-damage](../2026-10-10-first-apply-runs-after-damage.md) · [2026-10-10-luck-check-before-guts](../2026-10-10-luck-check-before-guts.md) · [2026-10-10-indomited-dropped-at-collection](../2026-10-10-indomited-dropped-at-collection.md)
