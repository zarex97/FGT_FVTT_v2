---
id: 2026-10-20-soaked-froze-nobody
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** the design (`2026-09-16-anastasia-design.md` E3) read Soaked (a), *"a 25% chance of being inflicted with Freeze, this is additive to any Freeze chance the Attack might have"*, as a vulnerability that raises an Attack's own Freeze roll by 25.
**Actual:** none of her Ice Attacks inflicts Freeze, so with her own kit Soaked froze nobody. The user ruled the 25 a roll of its own when the Attack carries none (#258 reading 4).
**Cause:** `packs/_source/effects/soaked.yml:34 @ 50eae993` — "additive" was read as the whole clause, and the first half, a chance of its own, was dropped. The other reading was never put to the user.
**Fix:** `packs/_source/effects/soaked.yml @ 0552085c` — a `damageTaken` handler rolls 25 on an Ice Attack that dealt damage and carries no Freeze (`attack:inflicts:freeze`, new), inflicted by the attacker (`inflictedBy: victim`, new); the −25 now applies only to an Attack that carries Freeze.
