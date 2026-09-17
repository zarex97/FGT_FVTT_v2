# 20 — Targeting: the eleven-step algorithm

## What it is

Targeting decides **which units are affected by an ability** and **why**. The `resolveTargets` function is pure — it takes an ability's declaration, the caster's state, and the board snapshot, and returns which units the area contains, which are filtered out, and why. Because it has no side effects, the canvas layer calls the real resolver repeatedly on every pointer move, so the preview showing the selected area is exactly what the attack will hit, and validation failures appear inline while the player is still aiming.

The algorithm is eleven steps plus two upfront checks. Each step narrows the survivor list, produces errors (refusals that make the placement illegal) or warnings (refusals that are suppressed by Command Spells), and drops units with human-readable reasons for the review dialog.

## Where it lives

| File | Role |
|---|---|
| `module/rules/targeting/resolve.mjs` | The eleven-step resolver; entry points `resolveTargets` and `validate` |
| `module/rules/targeting/shapes.mjs` | Axis 2 shape expansion (chapter 05 handles the primitives) |
| `module/rules/targeting/vocabulary.mjs` | Anchor and shape ids for the UI, paired with schematics and labels |
| `module/rules/targeting/facing.mjs` | Facing prerequisites: front-quadrant checks, path-clear |
| `module/rules/legality.mjs` | Rendering refusals for the UI (hard/overridable/confirm) |
| `module/apps/canvas/target-region.mjs` | Transient Region showing the area on the scene |
| `module/apps/canvas/target-review.mjs` | Confirmation dialog listing chosen, excluded, and damage preview |

## How it works

### Pre-checks

**Step 0 — Caster placement.** The caster must have a panel on the board. An unplaced caster has no position from which to measure distance, so every range check would fail with no clear symptom (`module/rules/targeting/resolve.mjs:88-94`).

**Step 0b — Conditional anchor flattening.** Some abilities read "…*or if* a condition is met, a different area"; Nemo's Voyager of the Storm is one of two covering both. The anchor and shape swap together as a unit, resolved before expansion begins, because a predicate cannot describe two separate geometries (`module/rules/targeting/resolve.mjs:98-115`). Branches test in order and the first match wins.

### The eleven main steps

**1. Anchor** — Resolve where the area is placed from. Nine anchor kinds: `self`, `targetUnit`, `withinRange` (free panel), `selfEdgeAdjacent` (direction choice), `fieldEdge`, `zone`, `movementPath`, `platform`, `global`, `sourceOfAttack`. Each computes a panel (or panel set) where the shape expands. Range is measured from all panels a multi-panel unit occupies, not from a corner anchor alone (`module/rules/targeting/resolve.mjs:117-119`).

**2. Shape** — Expand the area around the anchor. Thirteen shape kinds delegate to domain primitives (`chebyshevRadius`, `attackRange`, `rect`, `line`, `zone`) or targeting-specific constructors (`orientedRect` for direction-based placement). See chapter 05 for the geometry primitives (`module/rules/targeting/resolve.mjs:131-135`).

**3. Occupancy** — Include units whose footprint **intersects any panel** in the area. Multi-panel units (platforms, summons) count as "in range" if any of their panels touch the zone (`module/rules/targeting/resolve.mjs:136-143`).

**4. Relation filter** — Keep only units matching the declared relations: `ally`, `enemy`, `self`, or `neutral`. The self-inclusion rule states: *"When a Skill affects 'all allied Units', the user is included."* An explicit `includeSelf: false` overrides this for damaging AoE Noble Phantasms (`module/rules/targeting/resolve.mjs:149-163`). Then four sub-filters apply: **4b compulsion** (narrowed to compelled targets for attacks only), **4b-ii forced target** (caster suppression overriding choice), **4c bounded field isolation** (two independent combats on either side), **4d cross-level protection** (platforms state who shoots in, out, and whether ground is reachable) (`module/rules/targeting/resolve.mjs:165-247`).

**5. Kind filter** — Exclude platforms and structures unless explicitly named. Structures that declare `destroyableBy` are included if the caster matches (`module/rules/targeting/resolve.mjs:249-270`).

**6. Attribute filter** — Run the ability's target predicate (e.g., "male", "has Divinity"). Then **6b parameter comparison**: aggregate counts like *"3+ Parameters one Rank lower than the caster"* that no predicate can express (`module/rules/targeting/resolve.mjs:272-295`).

**7. Visibility** — Concealment blocks *targeting* (direct selection), but an AoE still catches concealed units with a coin flip (`module/rules/targeting/resolve.mjs:297-307`).

**8. Protection** — Master-protection rules, targetability auras (Bašmu), destructibility limits, facing requirements, and path clarity. A Master adjacent to its own Servant cannot be targeted directly, but an AoE area can catch it incidentally (`module/rules/targeting/resolve.mjs:309-408`).

**9. Chooser** — Narrow by selection mode: `all`, `nearest` (sorted by distance), `random` (seeded for replay), or `chosen` (player picks from candidates). Then **9b attacker's narrowing**: the player can always hit fewer targets than the rules allow (`module/rules/targeting/resolve.mjs:410-464`).

**10. Limits** — Enforce `maxTargets`, `minTargets`, `requireUnitId` (Counters must catch their attacker), `requiresZon`, `requiresCasterIn/Out`, and `casterOutsideArea` (EMIYA cannot be in his own Caladbolg blast) (`module/rules/targeting/resolve.mjs:466-508`).

**11. Result** — Add the linked partner if specified, after limits. The partner is guaranteed included despite limits, because the clause names them by identity, not as bystanders caught by the area (`module/rules/targeting/resolve.mjs:510-533`).

## Invariants & edge cases

1. **Every filter drops via `drop(u, reason)`, so the review dialog lists why each excluded unit was excluded.** The reason is captured at the decision point, not reconstructed later (`module/rules/targeting/resolve.mjs:75-86`).

2. **Compulsion narrows only Attack resolutions.** Penthesilea's Howl of the War God buffs all allies in range; compulsion to attack a different enemy should not refuse the buff (`module/rules/targeting/resolve.mjs:180-181`).

3. **Bounded field isolation reads the attack's NP tags,** so Doomsday Come's exception (*"Anti-World or higher can cross the boundary"*) can fire. Without them, isolation would ask every question as if the attack were Normal (`module/rules/targeting/resolve.mjs:214-217`).

4. **Cross-level protection was documented and unit-tested but never called** until this chapter. The Hanging Gardens' Aerial Garden of Vanity hit units directly below it, measured live (`module/rules/targeting/resolve.mjs:228-233`).

5. **Master protection splits on `isChosen`.** A directly targeted Master is refused; an AoE that happens to catch a Master is allowed, because rule 4 (Ch. 32) describes exactly that scenario when it says the area "gets CAUGHT IN" the master (`module/rules/targeting/resolve.mjs:313-323`).

6. **Damage preview runs the real pipeline with min/max dice rolls**, not an approximation. Because the resolver is pure, the preview reproduces exact damage ranges before the player commits (`module/rules/preview.mjs:2-9`).

## Traps and anti-patterns

**Documenting and unit-testing a filter that nothing consumes.** Cross-level protection — whether a platform's shooter, platform interior, or ground target can be hit from another level — was documented on the schema, unit-tested with a full test suite, and then never called. Hanging Gardens' *Aerial Garden of Vanity* hit units directly underneath it, measured live in a game. The code path existed and was correct; it was simply dead (`module/rules/targeting/resolve.mjs:228-240`). **Documentation and tests are not substitutes for use.** A constraint that matters must be enforced where it is needed — here, where survivors are filtered (`module/rules/targeting/resolve.mjs:245`).

## Open questions

- **Confirmed by reading, and the ordering is deliberate.** The partner clause runs after the limit
  step (`module/rules/targeting/resolve.mjs:526-533`), skips anyone already chosen, and marks what it
  adds with `viaPartnerClause: true`. The reasoning is stated in situ: *"`maxTargets` bounds what the
  shape may catch; the partner is not something the shape caught, and letting a count limit cut her
  would make the clause depend on how many bystanders happened to be standing nearby."* A partner is
  guaranteed by identity and cannot be displaced by a crowd.

- **Still open.** A conditional anchor whose `shape` overrides the declaration's resolves once, and
  nothing re-runs it -- so the question is whether any caller resolves the same spec twice and
  expects the same answer. No such caller was found by reading, which is weak evidence of absence
  rather than proof. A regression test pinning one resolution against a re-resolution would settle
  it.

- **Ch. 32 rule 4 describes a Master "getting caught in" an AoE while a Servant guards them, triggering Cover.** The filtering gated on `isChosen` allows this scenario to reach the area, but whether Cover itself fires correctly has not been confirmed in a running world.
