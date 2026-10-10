---
id: 2026-10-10-storm-border-restrictions-unread
found: live press
kind: collected-but-unread
status: fixed
reviewed: false
---
**Expected:** inside the Storm Border, an ability that creates a Large or Giant thing is refused (ruling
R1) — `rules/costs.mjs` has a `forbidCreating` refusal for exactly this.

**Actual:** Quetzalcoatl's Winged Serpent (`creates: [giant]`) passed `canUseAbility` for Nemo inside,
same as on the ground.

**Cause:** `packs/_source/platforms/storm-border.yml` authors `dimension.restrictions: [ForbidCreating]`
and nothing reads it; the `ForbidCreating` executor (`module/rules/elements.mjs:1722`) only ever ran for
an element on a Unit's own abilities. The second Storm Border key found unread this audit, after
`terrainTags`.

**Fix:** `module/rules/snapshot.mjs#annotatePlatforms @ d162f50` — every Unit on a dimension's Level
runs the dimension's restrictions through the executors and keeps their suppressions.
