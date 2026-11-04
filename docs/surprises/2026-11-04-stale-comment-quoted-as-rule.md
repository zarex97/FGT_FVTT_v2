---
id: 2026-11-04-stale-comment-quoted-as-rule
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** I told the user a card shows the public identity *"including to the unit's own owner, whose card is the same card the opponent is reading"*, quoting `public-identity.mjs`, and picked one card for all.
**Actual:** The user: *"I feel like the owner should have a different view of the card."* On reading the path, a card already can: `fillAttackCard` re-renders on every client, and `fillSkillEffects` is *"one message, rendered differently per client"*.
**Cause:** `module/engine/public-identity.mjs:10 @ 35c9fee5` — the comment says none of the three surfaces *"can render per viewer"*. It holds for a token's texture, and `module/apps/chat/cards.mjs:131 @ 35c9fee5` has long done otherwise for a card. I quoted the comment and did not read the render path.
**Fix:** `docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md @ cb28c87d` — reading 53: the owner gets a different view. The stale comment changes with #387.
