---
id: 2026-10-10-storm-border-aura-reaches-nobody
found: live press
kind: dimension-has-no-token
status: fixed
reviewed: false
---
**Expected:** Journey's Guidance pressed inside the Storm Border gives every ally aboard S.Crit Up 15%
for ⅓◈, through the `sCritUpStormBorder` aura on Nemo.

**Actual:** the aura sat on Nemo (expiry tick 3) and no Unit's board projection carried a Crit chance
modifier — not his Master, not Medea, not Nemo.

**Cause:** `packs/_source/effects/s-crit-up-storm-border.yml` gates on `requiresRecipient:
{ platformContentId: platform-storm-border }`, and `module/rules/snapshot.mjs#annotatePlatforms @ 08ea4b1`
stamps `platformContentId` only from a platform token's footprint. A dimension has none. The same root as
#178.

**Fix:** `module/rules/snapshot.mjs:975 @ d162f50` — every Unit on a dimension's Level is stamped
with its `platformId` and `platformContentId`.
