# 27 — Platforms, levels and scene levels

## What it is

Platforms are **large Servants or structures** that carry passengers — the Hanging Gardens of Babylon at 9×9 panels, the Golden Hind, the Storm Border dimension. The system treats platforms not as special token overlays but as first-class game objects: each active platform gets its own **Scene Level** (a Foundry level in the scene), passengers ride as tokens on that level, and cross-level targeting rules encode who may shoot into a platform, out of it, and directly underneath it.

A platform's **footprint** (`{w, h}`) declares how many panels it occupies. Membership in "aboard" is not a stored list but a *consequence* — units on the platform's Scene Level are aboard, and the level itself is the record. Passengers move with the platform when it moves, survive tests when it takes damage, and scatter to the ground when it is destroyed, all ordered by the specification's exact sequence.

## Where it lives

| File | Role |
|---|---|
| `module/rules/platforms.mjs` | Verdicts and descriptors: passengers, boarding, cross-level rules, upkeep, destruction |
| `module/engine/platforms.mjs` | Operations: boarding, falling, destruction, activation |
| `module/engine/scene-levels.mjs` | Scene Level lifecycle: creating, orphans, moving units, scattering, teardown |
| `module/engine/token-footprint.mjs` | Keeping platform tokens the size their footprint declares |
| `module/engine/dimension.mjs` | The Storm Border — a pocket dimension entered and left |
| `module/apps/canvas/token.mjs` | Click targeting: only the level being viewed accepts clicks |
| `module/rules/targeting/resolve.mjs` | Step 4d: cross-level protection checks |

## How it works

### Platforms and Scene Levels

**The load-bearing decision** (`module/rules/platforms.mjs:13-17`): *"each active platform gets its own Scene Level"*. This design produces separate occupancy (passengers are read off level membership, not a stored manifest), separate targeting (cross-level rules decide who may reach across), native visual separation (platforms are drawn on their own elevation band), and fog that is independent per level.

A platform on the ground (level 0) has no passengers — a platform sitting at level 0 has not been activated (`module/rules/platforms.mjs:60-77`). `passengersOf` filters to units on the platform's level and excludes the platform itself. The guard against reading "everyone on the ground belongs to this platform" is documented: the Hanging Gardens' token was never assigned to its new level and therefore counted every unit in the scene as a passenger (`module/rules/platforms.mjs:61-72`).

### Boarding and carrying

Boarding is a roll against the platform's declared difficulty, modified by the unit's Agility and Luck Ranks. A platform that specifies a `boarding` block states it in full — the Golden Hind rolls a ten-sided die with no relief clause — and every other platform defaults to the Hanging Gardens' rule: 1d12, target 12, reduced by rank relief and special circumstances (`module/rules/platforms.mjs:508-529`). The modifier **reduces the required value**, not the roll (`module/engine/platforms.mjs:21-23`).

A unit brought aboard stays there when the platform moves (`module/rules/platforms.mjs:100-108`): passengers move **forced**, which keeps boarding off their own movement budget and away from movement-triggered effects. Relative position is preserved so formation survives.

Being knocked off the edge (`module/rules/platforms.mjs:559-574`) runs three checks in order: the unit's Agility Check, then a Servant's rescue check for an adjacent Master, then the fall itself. A successful rescue or Agility Check prevents the fall; both fail and the unit takes `10×2d6` damage and moves one panel down. Masters who fall and land perform an Overpower roll — the only outcome that falls twice (`module/rules/platforms.mjs:559-575`).

### Cross-level targeting

The platform itself may always be targeted. Occupants are protected by **four independent axes** (`module/rules/platforms.mjs:135-193`), each decided per-platform and authored in the platform's `crossLevel` block. A platform that says nothing is transparent — `OPEN_PLATFORM` allows free targeting in, out, and into AOE passengers (`module/rules/platforms.mjs:31-38`).

The four axes (`module/rules/platforms.mjs:165-193`):

- **Shooting IN** — the target's platform decides. May be `free`, `rangedOnly`, or `forbidden`.
- **Shooting OUT** — the attacker's platform decides independently. Same three options, and a fortress that nobody shoots into may let occupants shoot out, or may not.
- **Directly beneath** — a boolean flag `forbidDirectlyBelow`. The Hanging Gardens forbids it; Dragon Wing Warriors overrules it by setting `allowDirectlyBelow` on the phase (`module/rules/platforms.mjs:187-190`).
- **AOE passengers** — what fraction of area damage reaches an occupant. The Golden Hind soaks 50% for most, all of it for Masters; Quetzalcoatlus soaks nothing for the mount itself (`module/rules/platforms.mjs:462-467`).

This call (`module/rules/targeting/resolve.mjs:229-245`) runs at step 4d of the targeting resolver and decides whether each target is reachable before any other filter.

### Destruction and scattering

When a platform is destroyed, the sequence is ordered and the order matters (`module/rules/platforms.mjs:591-615`):

1. **Save.** Passengers roll to avoid damage from the platform's destruction.
2. **Damage.** Passengers who failed take 100 fixed damage, sourced from the platform.
3. **Scatter.** *Every* passenger moves to the ground, including those who made the save — surviving the platform is not the same as staying in the air.
4. **Reverse effects.** Effects the platform granted its owner are removed (`module/engine/scene-levels.mjs:335-341`).
5. **Remove bound summons.** Creatures bound to the platform go with it. Bašmu is the reference case (`module/engine/scene-levels.mjs:344-359`).
6. **Delete the level.** The Scene Level is deleted only after every token has scattered off it (`module/engine/scene-levels.mjs:249-271`), because `TokenDocument#level` is required and non-nullable and Foundry does not re-parent on delete.

This is orchestrated by `engine/platforms.mjs#destroyPlatform` (`module/engine/platforms.mjs:122-151`), which calls the rules layer for descriptors, writes intents, and then runs `teardown` to perform the Foundry side (`module/engine/scene-levels.mjs:284-291`).

### Pocket dimensions

The Storm Border (and any dimension) is a platform with no ground footprint. `enterDimension` rolls for eligible enemies, moves the manifest onto a new Scene Level, and records the entry panel. `resurface` moves the manifest back to the ground, offset from where it submerged (`module/engine/dimension.mjs:221-368`). Travel distance grows by 1 panel per ⅓ turn spent inside (`module/engine/dimension.mjs:133-140`). Neither resize the manifest — passengers keep their relative positions and move as a group.

A dimension whose owner is defeated forces a Luck Check. On success the dimension resurfaces but the owner still dies. On failure, every occupant takes Erase (`module/engine/dimension.mjs:197-202`). This is not a revival and must not register as one.

### Token sizing

A platform's `footprint` (`{w, h}`) must match its token's Foundry size (`TokenDocument#width`/`#height`). Because these live in different places and nothing connects them, sizing is enforced in three layers (`module/engine/token-footprint.mjs:20-27`):

1. **Content pipeline** — `tools/lib/content.mjs` compiles the prototype token's size from the authored footprint.
2. **On token creation** — `preMoveToken` hook sizes any platform token before it enters the world.
3. **On footprint change** — `updateActor` hook pushes a footprint edit onto the prototype and every placed token.

A token whose live size drifts from its stored size (e.g. mid-animation after a resize) is re-prepared to match (`module/engine/token-footprint.mjs:187-193`).

### Which level accepts a click

Clicking a token selects it only if that token is on the level being viewed (`module/apps/canvas/token.mjs:63-86`). A single-level scene is unaffected; the filter only matters once a platform exists and creates a second level. The override applies per-token so it re-evaluates on every refresh, surviving updates that would reset it. Otherwise a 9×9 platform at high elevation would swallow every click on the board beneath it.

## Invariants & edge cases

1. **A platform on level 0 has no passengers.** `passengersOf` refuses this read rather than returning every unit on the board (`module/rules/platforms.mjs:60-77`).

2. **Scene Levels are stacked above the ground, not picked by content.** Two platforms that chose the same elevation band would have their tokens inferred onto each other, so `nextBand` stacks each new level above every existing one (`module/engine/scene-levels.mjs:55-58`). Elevation follows level assignment so tokens inferred by `inferLevelFromElevation` land on the right level.

3. **Every orphaned platform level whose actor is gone is cleaned up on the next activation.** Nothing else removes levels, so levels accumulate until one platform is activated in the same scene (`module/engine/scene-levels.mjs:136-189`). Orphaned tokens on those levels are brought down first, because a deleted level leaves every token on it pointing at a non-existent id.

4. **Scattering must complete before the level is deleted.** The schema constraint forces this order (`module/engine/scene-levels.mjs:13-21`), and `destroyLevel` refuses to delete a level that still holds tokens.

5. **The platform's own token must be placed on its level at activation.** Called first because every other placed token is moved by the caller, and placement without the platform produces a manifesto that makes every unit in the scene a passenger (`module/engine/platforms.mjs:213-222`).

6. **Level assignment is dispatched through `displaceToken`, not a direct update.** The level and elevation are Foundry v14 `MOVEMENT_FIELDS`, so assignment through the normal path is constrained by movement legality. An explicit `action: "displace"` and `fgtForced` flag tell the movement hook to stand aside (`module/engine/scene-levels.mjs:369-410`).

7. **Dimension travel preserves formation.** Passengers move as an offset group, not individually (`module/engine/dimension.mjs:350-360`).

## Traps and anti-patterns

**Cross-level rules documented and unit-tested but never called.** The `crossLevelLegal` function was written and thoroughly tested (`module/rules/platforms.mjs:165-193`), and `resolveTargets` has read `board.crossLevel` since it was written. But nothing ever *supplied* it — the Hanging Gardens' Aerial Garden of Vanity hit units standing directly underneath it, measured live. **If a rule matters, something must call it** (`module/rules/platforms.mjs:144-149`). **Found and fixed by `module/rules/targeting/resolve.mjs:229-245`, which now reads the verdict and applies it.**

**Platform token placed on the ground level instead of its own.** `activatePlatform` was created, the level was assigned to the platform actor, the platform's passengers were placed on it — and the platform's own token was never moved off the ground. So the Hanging Gardens sat at elevation 0, colliding with every unit, and `passengersOf` returned 21 of 21 units in the scene. **The platform's own token must be included in the level-move call** — `activatePlatform` now places it first, before any passenger (`module/engine/platforms.mjs:206-226`).

**Orphaned levels accumulating until the scene is unplayable.** Deleting a platform actor by hand, or an activation that failed after creating a level but before populating it, left the level behind forever. A second activation would create a second orphaned level. Measured at three stray "Hanging Gardens of Babylon" levels on one scene. **Clean up every orphaned level on the next activation, and bring stranded tokens down first, because deleting a level under its tokens leaves them pointing at a non-existent id** (`module/engine/scene-levels.mjs:136-189`).

**Elevation bands miscalculated, placing passengers inside the ground.** The band calculation used `count × height`, assuming the ground was `LEVEL_HEIGHT` tall. Foundry's default ground is `{bottom: 0, top: 20}`, so the first platform landed at 10–20, inside the ground band. Tokens assigned to it at elevation 10 were inferred back down to the ground because the ground level scored 0 (interior) and the platform scored 1 (on its bottom). Measured live: a unit placed aboard stayed at elevation 0. **Calculate the next band above the highest existing `top`, not as a multiple of the default height** (`module/engine/scene-levels.mjs:34-49`).

**Passengers assigned down but not back up to a platform.** The level and elevation fields are `MOVEMENT_FIELDS`, routed through the movement pipeline. A resize that found the path impossible deleted all movement fields from the update without error, so a token could move down but never back up to a platform. `activatePlatform` was left without access to `platformId`. **Assign levels through `displaceToken` with an explicit `action: "displace"` and `fgtForced: true` flag, bypassing legality** (`module/engine/scene-levels.mjs:369-410`).

## Open questions

- **Confirmed by reading the lookup.** The reuse is explicit and two-keyed:
  `game.actors.find((a) => a.system?.contentId === platformId && a.system?.ownerId === ownerId)`,
  with `?? game.actors.get(platformId)` as a direct-id fallback, and creation only when neither hits
  (`module/engine/dimension.mjs:233-243`). Matching on **owner as well as content** is what stops two
  different owners sharing one pocket dimension, and the comment states the case it was written for:
  *"A previous submersion leaves its actor behind, so an existing one is reused rather than
  duplicated."*

- **Verified, and it is a defect — [#24](https://github.com/zarex97/FGT_FVTT_v2/issues/24).** The
  Master-bringing branch has **no distance test at all**. `module/engine/platforms.mjs:78-83` moves
  the Master to the platform whenever `bringMaster` is set, under a comment describing a check —
  *"checked against where the Master stood, not where the Servant ended up"* — that is not in the
  code. There is no Chebyshev call and no `2` anywhere in either platforms module. The question of
  *which* panel is measured is therefore moot: none is. `bringMaster` also defaults to `false` and no
  call site passes `true`, and `boardPlatform` itself has no caller, no action-registry entry and no
  UI affordance — so boarding is unreachable in play today.
