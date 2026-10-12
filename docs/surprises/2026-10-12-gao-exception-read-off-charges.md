---
id: 2026-10-12-gao-exception-read-off-charges
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** no GAO charge off at the end of the Turn she used Monstrous Strength, on any Turn (#198 reading 12).
**Actual:** with no stocks the use gained nothing, nothing was re-stamped, and the Counter's Turn spent one (6 → 5).
**Cause:** `packs/_source/effects/np-dm-up-gao.yml @ 08ea4b1` keyed the exception to the charges' apply Turn only.
**Fix:** same file @ 98f05ca — `unlessUsedThisTurn: { contentId: kingprotea-monstrous-strength }`; re-pressed: 3 kept.
