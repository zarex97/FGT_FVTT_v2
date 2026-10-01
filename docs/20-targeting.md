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
| `module/engine/attack-preflight.mjs` | The gates a declaration passes before anything is spent or written, shared by `resolveAttack` and `performRidingAttack` (Ch. 19) |
| `module/rules/legality.mjs` | Rendering refusals for the UI (hard/overridable/confirm) |
| `module/apps/canvas/target-region.mjs` | Transient Region showing the area on the scene |
| `module/apps/canvas/target-review.mjs` | Confirmation dialog listing chosen, excluded, and damage preview; its button reads *Attack* for an attack and *Use* otherwise (§46.4-CM). For a `chosen` selection with two or more candidates it is where the pick is made: unticked checkboxes, *Use* disabled until between one and `count` are ticked, opened whatever the `targetingReview` setting says (#129) |

## How it works

### Pre-checks

**Step 0 — Caster placement.** The caster must have a panel on the board. An unplaced caster has no position from which to measure distance, so every range check would fail with no clear symptom (`module/rules/targeting/resolve.mjs:88-94`).

**Step 0b — Conditional anchor flattening.** Some abilities read "…*or if* a condition is met, a different area"; Nemo's Voyager of the Storm is one of two covering both. The anchor and shape swap together as a unit, resolved before expansion begins, because a predicate cannot describe two separate geometries (`module/rules/targeting/resolve.mjs:98-115`). Branches test in order and the first match wins.

### The eleven main steps

**1. Anchor** — Resolve where the area is placed from. Nine anchor kinds: `self`, `targetUnit`, `withinRange` (free panel), `selfEdgeAdjacent` (direction choice), `fieldEdge`, `zone`, `movementPath`, `platform`, `global`, `sourceOfAttack`. `movementPath` (with the `path` shape and `placement.path`) is how a Riding Attack's line goes through the survivor filters below (`rules/movement.mjs#ridingAttackPath`, Ch. 5): it used to bypass them as `pathTargets`, so a field's isolation, the cross-level rules and the targetability aura never applied to it (#114). Each computes a panel (or panel set) where the shape expands. An anchor's reach is its `range` (absolute), or the caster's own Range plus `rangeBonus` when it states no `range`, so an ability whose sheet gives it no Range of its own authors none and follows her buffs and penalties (Xiuhcoatl, #65). Range is measured from all panels a multi-panel unit occupies, not from a corner anchor alone (`module/rules/targeting/resolve.mjs:117-119`), and `targetUnit` measures it TO all panels of the target too: a 3x3 Bašmu or the 9x9 garden is in Range if any part of it is (§46.4-BT). The origin is the caster's own footprint **unless** the anchor names `originUnitId`: a bare Normal Attack by a rider whose mount replaces it (`attacksAsPlatform`) carries the mount there (`engine/attack.mjs#targetSpecFor`, from `rules/platforms.mjs#attackSourceOf`), so a target 2 panels from the far side of a 2x2 mount is in Range though it is 3 from her own panel; what she casts herself carries no origin and measures from her panel (#171). A platform with Health to lose is attackable like any Unit; one without stays excluded as "a platform" (§46.4-BS).

**2. Shape** — Expand the area around the anchor. Thirteen shape kinds delegate to domain primitives (`chebyshevRadius`, `attackRange`, `rect`, `line`, `zone`) or targeting-specific constructors (`orientedRect` for direction-based placement). See chapter 05 for the geometry primitives (`module/rules/targeting/resolve.mjs:131-135`).

**3. Occupancy** — Include units whose footprint **intersects any panel** in the area. Multi-panel units (platforms, summons) count as "in range" if any of their panels touch the zone (`module/rules/targeting/resolve.mjs:136-143`).

**4. Relation filter** — Keep only units matching the declared relations: `ally`, `enemy`, `self`, or `neutral`. The self-inclusion rule states: *"When a Skill affects 'all allied Units', the user is included."* An explicit `includeSelf: false` overrides this for damaging AoE Noble Phantasms (`module/rules/targeting/resolve.mjs:149-163`). Then four sub-filters apply: **4b compulsion** (narrowed to compelled targets for attacks only), **4b-ii forced target** (caster suppression overriding choice), **4c bounded field isolation** (two independent combats on either side), **4d cross-level protection** (platforms state who shoots in, out, and whether ground is reachable) (`module/rules/targeting/resolve.mjs:165-247`).

**5. Kind filter** — Exclude platforms and structures unless explicitly named. Structures that declare `destroyableBy` are included if the caster matches (`module/rules/targeting/resolve.mjs:249-270`).

**6. Attribute filter** — Run the ability's target predicate (e.g., "male", "has Divinity"). Then **6b parameter comparison**: aggregate counts like *"3+ Parameters one Rank lower than the caster"* that no predicate can express (`module/rules/targeting/resolve.mjs:272-295`).

**7. Visibility** — Concealment blocks *targeting* (direct selection) **for an Attack or an enemy Unit's Skill, and no more** (Presence Concealment clause 1), but an AoE still catches concealed units with a coin flip (`module/rules/targeting/resolve.mjs:297-307`). The step runs only for a chosen or counted selection, and it keeps a concealed Unit when the ability is not an Attack and the Unit is an ally of the caster: an allied Servant under Presence Concealment can be healed, guarded or buffed by a single-target Skill (Medea's Teachings of Circe, Kiritsugu's Scapegoat, Jack's Surgical Procedure, Scáthach's AR and Primordial Rune; Good God's Wisdom and Shadow of Longing once a chosen selection can be completed). Whether the use is an Attack is `limits.forAttack`, set by `targetSpecFor` from `classifyAbility`; a spec that does not say is an Attack, so a caller that never learned the flag is unchanged. A concealed enemy is still refused by any Skill, and a concealed ally by any Attack (#133, after §46.4-AK, which fixed the token-visibility half).

**8. Protection** — Master-protection rules, targetability auras (Bašmu), destructibility limits, facing requirements, and path clarity. A Master adjacent to its own Servant cannot be targeted directly, but an AoE area can catch it incidentally (`module/rules/targeting/resolve.mjs:309-408`).

**9. Chooser** — Narrow by selection mode: `all`, `nearest` (sorted by distance), `random` (seeded for replay), or `chosen` (player picks from candidates). `chosen` answers `needsChoice` with the `candidates` and no `units` until the placement carries `chosenIds`; the resolver's contract stays that. **The session supplies the choice (#129).** `validate()` -- the one projection every UI path calls -- settles a choice among one: when `needsChoice` survives with a single candidate it resolves again under that candidate's id, so limits stay in force, and the layer, HUD outline and preview all see the Unit. That is 21 of the 23 abilities that author `chosen`, which name their Unit with the anchor (`targetUnit`, `withinRange`, `fieldEdge` over a `unit` shape). Two or more candidates always ask: `reviewTargets` takes the candidates and `max: count`, whatever the `targetingReview` setting says, because a choice cannot be skipped. A choice that still survives to the engine is a refusal, not a run: `pendingChoiceErrors` gives `"Choose a target."` to `resolveAttack` (it throws) and `resolveSkillTargets` (`errors`), so a macro cannot pay a cost and resolve against nobody; the no-canvas `legacyPlacement` sends the targeted Unit as `chosenIds`. Then **9b attacker's narrowing**: the player can always hit fewer targets than the rules allow (`module/rules/targeting/resolve.mjs:410-464`).

**10. Limits** — Enforce `maxTargets`, `minTargets`, `requireUnitId` (Counters must catch their attacker), `requiresZon`, `requiresCasterIn/Out`, and `casterOutsideArea` (EMIYA cannot be in his own Caladbolg blast) (`module/rules/targeting/resolve.mjs:466-508`).

**11. Result** — Add the linked partner if specified, after limits. The partner is guaranteed included despite limits, because the clause names them by identity, not as bystanders caught by the area (`module/rules/targeting/resolve.mjs:510-533`).

## Invariants & edge cases

1. **Every filter drops via `drop(u, reason)`, so the review dialog lists why each excluded unit was excluded.** The reason is captured at the decision point, not reconstructed later (`module/rules/targeting/resolve.mjs:75-86`).

2. **Compulsion narrows only Attack resolutions.** Penthesilea's Howl of the War God buffs all allies in range; compulsion to attack a different enemy should not refuse the buff (`module/rules/targeting/resolve.mjs:180-181`).

3. **Bounded field isolation reads the attack's NP tags,** so Doomsday Come's exception (*"Anti-World or higher can cross the boundary"*) can fire. Without them, isolation would ask every question as if the attack were Normal (`module/rules/targeting/resolve.mjs:214-217`).

4. **Cross-level protection was documented and unit-tested but never called** until this chapter. The Hanging Gardens' Aerial Garden of Vanity hit units directly below it, measured live (`module/rules/targeting/resolve.mjs:228-233`). It also hit units standing on the garden itself, the *"above"* of its sheet; step 4e and `targeting.forbidAboard` refuse those (§46.4-BR).

5. **Master protection splits on `isChosen`.** A directly targeted Master is refused; an AoE that happens to catch a Master is allowed, because rule 4 (Ch. 32) describes exactly that scenario when it says the area "gets CAUGHT IN" the master (`module/rules/targeting/resolve.mjs:313-323`).

5a. **A defeated Unit is never a target.** A defeat leaves the token on the board, so the area catches it; step 4 drops it with the reason `defeated` and the review dialog lists it under NOT TARGETED. A forced target or compulsion that names a defeated Unit forces nothing (#168).

6. **Damage preview runs the real pipeline with min/max dice rolls**, not an approximation. Because the resolver is pure, the preview reproduces exact damage ranges before the player commits (`module/rules/preview.mjs:2-9`). The context it runs is `previewContext` in `module/engine/attack.mjs`, built from the resolver's own attack: the ability's Rank, scale tags, Noble Phantasm category and element come from `attackIdentityOf`, which the resolution (`damageContext`) and the counterfactual call too, and a declared `damage.component` becomes the base through `declaredBase`, as in `baseSpecFor`. A preview that builds its own attack shows a different rule from the one that runs: it compared Magic Resistance against the caster's MAG instead of the Noble Phantasm's Rank, and previewed a MAG Noble Phantasm from the caster's Normal Attack (#124). `test/unit/preview-matches-resolution.test.mjs` holds the two together.

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
