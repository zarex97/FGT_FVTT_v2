---
id: 2026-10-15-ticket-said-27-5-the-template-floors-to-25
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** the ticket's acceptance line, *"Mana Burst under Mad Enhancement gets +27.5%"* (55 halved).
**Actual:** the shared template halves with `magnitudeRoundTo: 5`, a floor to a multiple of 5 that Kingprotea's sheet confirms (85 halves to 40, not 42.5): the engine gives **25**. The plan flagged it before any code was written and the coordinator decided on 2026-10-15: build 25, one rounding for every bearer, and say so.
**Cause:** `packs/_source/class-skills/mad-enhancement.yml:79 @ 7231295` — the rounding is the template's own rule (`docs/B-rank-tables.md`: "halved and floored to a multiple of 5"); the ticket did the arithmetic without reading it.
**Fix:** none to the code: `dioscuri-209-arena.test.mjs` names the rounding ("27.5 is 25") and `docs/22-damage-pipeline.md` stage 1b and §46.31 say so. A per-bearer rounding slot would have made Kingprotea's printed 40 a special case.
