---
id: 2026-10-15-mana-burst-counter-already-built
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** the ticket: both Mana Bursts are "own Turn only" today, and need building to be usable on a Counter, as Raikou's is.
**Actual:** pressed first, as Heracles attacking Pollux and then Castor, the Counter was already there: the Counter opens its own Process aimed back at him, the `choose` is asked once, 150 + 150, Pollux's Evade lands, Castor's Avenger +80 counts and his Noble Phantasm cut falls on both twins.
**Cause:** `module/rules/counter.mjs:93 @ 7231295` — `answersACounter` takes every Attack Skill and `rules/costs.mjs:249` lifts "used during your Turn" for a Counter (`!ctx.isCounter`). The Dioscuri's Mana Bursts carry the same flags as Raikou's, so nothing was missing; the ticket's line was a reading of the YAML's `timing: { window: ownTurn }`, which is documentary.
**Fix:** none needed; pinned so it cannot regress: `dioscuri-209-rulings.test.mjs` (offered, gated) and `dioscuri-209-arena.test.mjs` (played). Removing the `!ctx.isCounter` exemption or marking Pollux's `cannotCounter` fails them.
