# 09 — Targeting

> **Note (Ch. 45 C4).** A bounded-field **isolation** filter joins the resolver at step 4c. Full
> isolation partitions the board into two independent combats: a player whose units straddle the
> boundary still takes one turn and acts with both groups, but the groups cannot reach each other.

> **Note (Ch. 45 C3).** The cross-level filter is live. It reads `board.crossLevel`, which
> `snapshotBoard` now builds from the platforms actually on the board — the step existed and was
> called from the beginning, with nothing ever supplying that map. See Ch. 20 §20.7.

Automated targeting is the requirement this system is judged on. Every ability in F/GT
declares *where* it reaches in a small, closed vocabulary of shapes, and the engine must
resolve, preview, validate, and apply that declaration without a human clicking individual
tokens.

This chapter builds the targeting type system from the ground up: the four orthogonal axes of
a target specification, the complete shape catalogue observed in the source, the resolution
algorithm, filtering, validation, and the exceptional cases. Chapter 28 covers the Foundry
v14 implementation.

---

## 9.1 Why a type system

The naive approach — "pick targets by clicking" — fails four ways in this game:

1. **The shapes are not free-form.** "A 5×5 area in a non-diagonal direction next to the
   caster" admits exactly four placements. Letting a player free-place a 5×5 template lets
   them cheat, and forces them to know the rule.
2. **Selection is rule-bound.** *"All enemy Units within…"* is not the same as
   *"all of Scáthach's targets of choice within…"* which is not the same as
   *"an allied Unit within…"*. Clicking cannot distinguish these.
3. **Legality is checkable.** A Good-aligned Servant may not place an AoE NP that catches a
   Civilian. A Servant outside its Master's ZON may not use an NP at all. These should be
   refused at placement time with an explanation, not discovered after the fact.
4. **Damage varies within an area.** Nemo's *Triton's Conch* deals 1.5× to adjacent units and
   0.5× to units two panels out. The target set is not flat; it is banded.

So targeting is a declarative specification, evaluated by an engine.

---

> **Implementation note.** The anchors are `self`, `selfEdgeAdjacent`, `withinRange`,
> `targetUnit`, `movementPath`, `zone`, `platform`, `global` and `sourceOfAttack`, and
> `module/rules/targeting/vocabulary.mjs` pairs each with the words a GM reads (§29.6). The ids
> there **must** be the resolver's own: the picker briefly called `withinRange` "point", which
> authored cleanly, validated, and threw `Unknown targeting anchor "point"` the first time Medea's
> Rain of Light was aimed. A drift test now holds the two lists against each other in both
> directions, as it already did for shapes.

## 9.2 The four axes

Every targeting declaration is a product of four independent choices.

```ts
interface TargetSpec {
  anchor:    AnchorSpec;      // WHERE the shape is positioned
  shape:     ShapeSpec;       // WHAT geometry it covers
  selection: SelectionSpec;   // WHICH units in that geometry are affected
  limits:    LimitSpec;       // HOW MANY, and any legality constraints
}
```

Keeping them orthogonal is what makes the catalogue small. Nine anchors × eleven shapes ×
six selections covers every ability in the reference set, and new content composes rather than
extends.

---

## 9.3 Axis 1 — Anchor

The anchor answers: *relative to what, and chosen by whom, is the shape positioned?*

```ts
type AnchorSpec =
  | { kind: "self" }
  | { kind: "selfEdgeAdjacent"; direction: "chosen" | Cardinal }
  | { kind: "withinRange"; range: RangeSpec; minRange?: number }
  | { kind: "targetUnit"; range: RangeSpec; relation: Relation }
  | { kind: "movementPath" }
  | { kind: "zone"; zoneId: string }
  | { kind: "platform"; platformId: "own" | string }
  | { kind: "global" }
  | { kind: "sourceOfAttack" };
```

### `self` — centred on the caster

The shape is centred on the caster's panel (or footprint centre for multi-panel units).

> Nemo, *Triton's Conch*: "Hits a 5×5 panel area **around Nemo**."
> Semiramis, *Sikera Ušum* (non-DSC form): "affects the 5×5 panel area **around her**."

For an even-dimensioned shape centred on a unit there is no true centre panel. The reference
set contains no even-dimensioned self-centred shape, so we define the rule and move on:
**for even dimensions, the caster occupies the lower-right of the four central panels**, and
the UI shows the resulting offset. Recorded in Ch. 41.

### `selfEdgeAdjacent` — the "non-diagonal direction next to" anchor

This is F/GT's signature shape anchor and it deserves careful definition.

> Van Gogh, *Het Gele Huis*: "Affects all enemy Units within a 5×5 panel area **in any
> non-diagonal direction next to Gogh**."
> Kingprotea, *Airavata King Size*: "Hits a 3×3 panel area **in any non-diagonal direction next
> to herself**."
> Scáthach, *Gate of Skye*: "within a 5×5 panel area **in any non-diagonal direction next to
> her**."
> Nemo, *Barrel Bombing*: "Hits a 3×3 panel area **in any non-diagonal direction next to
> Nemo**."
> Bašmu, *Cursed Poison Dragonfire*: "Hits a 3×3 panel area **in any non-diagonal direction
> next to itself**."

The reading: a `w × h` block, flush against the caster on one of the four cardinal sides, and
**centred on the caster's axis**. The caster is *not* inside it.

**A compulsion narrows attacks only.** *"She will constantly Move towards and **Attack** said
Unit"* restricts which enemy Penthesilea may hit and says nothing about who she may buff. The
filter applied to every resolution, so *Howl of the War God* — "affects all allied Units within a
2 panel area" — refused with "no legal targets" for as long as a Greek Male stood near her. A
resolution that cannot reach an enemy is not an attack, which is the whole test.

**Verified in play (Scáthach).** *Gate of Skye* was the first content to use it against a real
board, and the four directions do catch four different sets from the same panel — which is what
makes the direction the player's decision rather than a formality. The `chooser`/`choose`
combination matters too: *"all of Scáthach's targets **of choice** within a 5×5"* means the area
catches everyone and she picks which of them the Noble Phantasm affects.

For a 3×3 to the north of a caster at `(0,0)`:

```
       j-1  j   j+1
i-3     .   .   .        ← rows i-3..i-1 are the 3×3 block
i-2     .   .   .
i-1     .   .   .
i        -  @   -        ← the caster, NOT in the area
```

For a 5×5 to the east:

```
        j   j+1 j+2 j+3 j+4 j+5
i-2      -   .   .   .   .   .
i-1      -   .   .   .   .   .
i        @   .   .   .   .   .
i+1      -   .   .   .   .   .
i+2      -   .   .   .   .   .
```

Formally, for direction `d` with unit delta `(di, dj)`, block dimensions `w × h`, caster at
`c`:

```ts
function orthogonalAdjacentRect(c: GridOffset, w: number, h: number, d: Cardinal) {
  const { i: di, j: dj } = DELTA[d];
  const along  = (di !== 0) ? h : w;         // extent along the direction
  const across = (di !== 0) ? w : h;         // extent perpendicular
  const halfA  = Math.floor(across / 2);
  const out: GridOffset[] = [];
  for (let step = 1; step <= along; step++) {
    for (let off = -halfA; off <= across - 1 - halfA; off++) {
      out.push(di !== 0
        ? { i: c.i + di * step, j: c.j + off }
        : { i: c.i + off,       j: c.j + dj * step });
    }
  }
  return out;
}
```

**Odd dimensions** (every case in the reference set: 3×3, 5×5, 7×7) centre exactly.
**Even dimensions** use the `floor` above, biasing the block one panel toward negative
offsets; the preview shows it and the player can see what they are getting. Recorded in
Ch. 41.

**Direction is a player choice** presented as four ghost previews. This is the key UX
affordance: the player sees all four legal placements and clicks one. No free placement, no
rule knowledge required.

### `withinRange` — free placement inside the caster's reach

> Karna, *Brahmastra Kundala*: "**Range=5.** Hits a 7×7 panel area **within Range**."
> Semiramis, *Familiar: Doves*: "**Range=4.** Hits a 3×3 panel area **within Range**."
> Semiramis, *Arrogant King's Poison*: "Hits a 3×3 panel area **within Range**."
> HGoB, *Aerial Garden of Vanity*: "**Range=7.** Hits a 7×7 panel area within Range."

The shape's **centre** is placed on any panel satisfying `inAttackRange(caster, centre, R)`.
The shape itself may extend beyond the range — this is important and frequently misread. A
7×7 centred at range 5 reaches out to 8 panels. The *anchor* is range-limited, not the
footprint.

`minRange` handles the one instance of a minimum:

> Karna, *Vasavi Shakti*: "**Range=3 to 4.** … Hits a 3×3 panel area within Range."

So `{ kind: "withinRange", range: 4, minRange: 3 }` — the anchor panel must be at attack-range
distance between 3 and 4 inclusive. The preview greys the inner ring.

### `targetUnit` — a single named unit

> Scáthach, *Ár*: "**Range=2.** Used on **an allied Unit** within Range."
> Karna, *Discernment of the Poor*: "**Range=2.** Used on **an enemy Unit**."
> Van Gogh, *Shadow of Longing…*: "Used on **an allied Unit** within a 2 panel area of herself."
> Kiritsugu, *Scapegoat*: "Used on **an allied Unit** within a 2 panel area of Kiritsugu."

Note two distinct range expressions here: `Range=2` (the attack-range shape with diagonal
reduction — irrelevant below R=3) and "within a 2 panel area" (plain Chebyshev). They coincide
at R=2 but diverge at R≥3, so the spec records which is meant:

```ts
type RangeSpec =
  | { metric: "attackRange"; panels: number }   // "Range=N", uses §8.2 shape
  | { metric: "chebyshev";   panels: number };  // "within an N panel area"
```

**DECISION.** When an ability says "Range=N" use `attackRange`; when it says "within an N panel
area" use `chebyshev`. This is a real semantic difference at N≥3 and the content authoring
guide makes it explicit.

### `movementPath` — Riding Attack

> Riding, Passive 2: "the Servant is able to attack **all enemies in his path** while Moving in
> a straight line."

The shape is the line of panels traversed. Covered in §9.4 under `path`.

### `zone` — a named area

> Semiramis, *Sikera Ušum* (DSC form): "Affects **the Throne Room** for 3◈ Turns."
> Territory Creation: "all allied Units who are **in their Home Base**."
> Nemo: "if Nemo is within a **'Waterside' or 'Imaginary Numbers Space'** area."

Zone membership is a read (§8.5), not a geometric computation.

### `platform` — everyone aboard

> Drake, *Voyager of the Storm*: "or if the Golden Hind is boarded, affects **all allied Units
> upon the Golden Hind**."
> Nemo, *Journey's Guidance*: "or if Zero Sail is activated, affects all allied Units **within
> the Storm Border**."

Note both are *conditional alternates* — the ability has one target spec normally and a
different one when the platform is active. So `AnchorSpec` supports a conditional wrapper:

```ts
type AnchorSpec = /* … */ | { kind: "conditional"; branches: Array<{ predicate: Predicate; anchor: AnchorSpec }> };
```

### `global` — the whole board

> Mannanán, *Fragarach*: "Both versions of this NP are effective at **any Range**."
> `Repel`: "the AU receives X Fixed damage at the end of the Combat Process, and is dealt
> **regardless of Range**."
> `STR Reflect` / `MAG Reflect`: "is dealt to the AU instead **regardless of Range**."

Rare but real. Used only by reactive effects that already have a determined target.

### `sourceOfAttack` — the unit that just attacked me

Used by every counter, reflect, and repel effect. Not a geometric query at all — the target is
carried in the combat context. Listed as an anchor so that counters share the targeting
pipeline rather than bypassing it, which matters because counters still respect
`Presence Concealment`'s "cannot be Countered" clause and the Master-redirect rule.

---

## 9.4 Axis 2 — Shape

```ts
type ShapeSpec =
  | { kind: "point" }                                     // single panel
  | { kind: "unit" }                                      // exactly one unit
  | { kind: "rect"; w: number; h: number }
  | { kind: "square"; size: number }                      // sugar for rect(n,n)
  | { kind: "chebyshevRadius"; r: number }                // "within an N panel area"
  | { kind: "attackRange"; r: number }                    // §8.2 octagonal shape
  | { kind: "line"; length: number | "movementBudget"; width: number; direction: DirSpec }
  | { kind: "path" }                                      // the actual movement path
  | { kind: "ring"; inner: number; outer: number }
  | { kind: "orientedRect"; long: number; short: number; axis: "facing" }
  | { kind: "zone"; zoneId: string }
  | { kind: "banded"; bands: Array<{ maxDistance: number; multiplier?: number; shape?: ShapeSpec }> };
```

### `rect` / `square`

The workhorse. Every "M×N panel area" in the game. Combined with `selfEdgeAdjacent` it gives
the directional block; combined with `withinRange` it gives the free-placed block.

Sizes observed: 3×3, 5×5, 7×7, 7×3/3×7, 9×9 (HGoB footprint), 4×3 (Golden Hind), 11×11
(HGoB large board), 5×5 (Throne Room).

### `chebyshevRadius`

"Within an N panel area of X" — the `(2r+1) × (2r+1)` block centred on X, **including** X's
panel. Used by every party/aura effect. Radius 2 is overwhelmingly the most common (the
"Party Area" keyword is defined as exactly this).

### `attackRange`

The octagonal shape from §8.2. Used when an ability's area *is* the caster's threat range —
principally normal attacks and Riding's detection.

### `line`

> Riding Attack: a straight line along the movement direction, width 1, length = remaining
> movement budget.

```ts
{ kind: "line", length: "movementBudget", width: 1, direction: { kind: "chosen", cardinal: true } }
```

### `orientedRect`

> Drake, *Golden Wild Hunt*: "Hits a **7×3 or 3×7** panel area in the direction the Golden Hind
> is facing (i.e. where the ship's bow is facing)."

The long axis aligns to the platform's facing. `7×3 or 3×7` is not a choice; it is the same
shape described for both facings. So:

```ts
{ kind: "orientedRect", long: 7, short: 3, axis: "facing" }
```

resolves to 7 rows × 3 columns when facing N/S and 3 rows × 7 columns when facing E/W.

**Ambiguity:** is the rectangle centred on the ship, or projected forward from the bow?
"In the direction the bow is facing" reads as projected forward. Note also the ability is
usable *without* the ship, in which case "the Range is still the same, just applied to Drake".
**DECISION.** Projected forward from the front edge, centred on the perpendicular axis — i.e.
`selfEdgeAdjacent` with the facing direction. Ch. 41.

### `ring`

Not present in the reference set, but the rulebook's mention of areas that exclude their
centre (`Note 11: All non-healing AoE Noble Phantasms which could include their user within
their own NP area, do not affect their user unless stated`) is handled by selection exclusion,
not by a ring. `ring` is retained for future content and because Foundry provides
`grid.getRing()` natively.

### `banded` — distance-dependent magnitude

> Nemo, *Triton's Conch*: "Hits a 5×5 panel area around Nemo. Deals **1.5× damage to Units
> directly next to Nemo**, while **Units at a 2 panel distance receive 0.5× damage**. … If the
> Unit was 2 panels away from Nemo, the chance of being inflicted with Deafen is **50%**
> instead."

So both the damage multiplier *and* the effect application chance vary by band. `banded` is a
shape wrapper whose resolution attaches a band index to each target, and downstream stages
(damage, effect application) read it.

```yaml
shape:
  kind: banded
  bands:
    - maxDistance: 1
      multiplier: 1.5
      effectChanceScale: 1.0
    - maxDistance: 2
      multiplier: 0.5
      effectChanceScale: 0.5
```

Kingprotea's *Airavata King Size* has a different kind of banding — the NP DmUp scales with her
*own size*, not with target distance — which is a caster-side modifier, not a shape band.
Do not conflate them.

### Shape composition

Two shapes compose in one ability more often than expected:

> Van Gogh, *Het Gele Huis*: enemies in a 5×5 orthogonal-adjacent block, **then** allies within
> a 2-panel radius of herself.
> Karna, *End of Charity*: self buff, **then** allies within 2 panels.
> Castor, *Stars of the Chief God*: himself and Pollux, **then** allies within 2 panels of
> whichever of them is in range.

**DECISION.** An ability has an ordered list of **phases** (Ch. 03 §3.5), each with its own
`TargetSpec`. Composition is sequencing, not shape algebra. A phase may declare
`reuseTargets: true` to operate on the previous phase's resolved set — which is how
*Brahmastra Kundala* applies Burn and Def Dwn to exactly the units it damaged, including any
that were resolved by a banded shape.

---

## 9.5 Axis 3 — Selection

Which units inside the geometry are actually affected?

```ts
interface SelectionSpec {
  relations: Relation[];              // ["enemy"], ["ally"], ["ally","self"], ["any"]
  includeSelf: boolean | "unlessStated";
  kinds: UnitKind[];                  // default: all except platform/structure
  attributes?: AttributePredicate;    // e.g. only units with [Divine]
  chooser: "all" | "chosen" | "nearest" | "random";
  count?: number | "unlimited";
  excludeConcealed: boolean;          // Presence Concealment blocks targeting
}
```

### `relations`

The four values from §4.10 (`self`, `ally`, `enemy`, `neutral`). Observed usages:

| Phrase | relations |
|---|---|
| "all enemy Units within…" | `["enemy"]` |
| "all allied Units within…" | `["ally", "self"]` — see below |
| "all Units within a 3 panel area of Gogh" | `["self","ally","enemy","neutral"]` |
| "an allied Unit within…" | `["ally", "self"]`, `chooser: "chosen"`, `count: 1` |
| "an enemy Unit" | `["enemy"]`, `chooser: "chosen"`, `count: 1` |

**The self-inclusion rule** is explicit in the source and easy to get wrong:

> *"When a Skill states 'used on an allied Unit' or 'affects all allied Units within…', the
> user is included. Otherwise, Active Skills always target self when no target is stated."*

So `"allied"` **includes the caster**. This is the default and it changes real outcomes —
Van Gogh's *Het Gele Huis* inflicts Curse on "all affected allied Units", which includes
herself, which is the entire point of her design (she wants the Curse). Getting this wrong
breaks her.

Counterpoints where self is excluded, always explicitly stated:
- Penthesilea's *Charisma* passive: "all damage dealt by **other** allied Units."
- Kiritsugu's *Affection of the Holy Grail*: "all Units within a 2 panel area of Kiritsugu
  **except himself**."
- Van Gogh's *De Sterrennacht*: "the number of affected allied Units with the 'Existence
  Outside the Domain' Skill **excluding herself**."
- Note 11: "All non-healing AoE Noble Phantasms which could include their user within their own
  NP area, **do not affect their user unless stated**."
- Karna's *Brahmastra Kundala*: "Karna is not affected by this NP if he is within the NP area."

**DECISION.** `includeSelf: "unlessStated"` is the default and resolves to:
- `true` for ally-targeting non-damaging effects,
- `false` for damaging AoE NPs (Note 11),
- explicit `true`/`false` overrides everything.

The content validator requires an explicit value on any damaging AoE whose area could contain
the caster, so the Note 11 default is never applied silently.

### `chooser: "chosen"` — partial selection

> Scáthach, *Gate of Skye*: "Affects **all of Scáthach's targets of choice** within a 5×5 panel
> area in any non-diagonal direction next to her."

The player picks a subset of the units inside the resolved area. Distinct from `"all"` and from
a single-target `count: 1`. The preview highlights everyone in the area and lets the player
toggle each.

This matters because *Gate of Skye* inflicts **Death** on failed Luck Checks, and it would hit
allies without the choice clause.

### `excludeConcealed`

> Presence Concealment, effect 1: "The Servant cannot be targeted for an Attack **or an enemy
> Unit's Skill**."

So concealed units are removed from enemy target sets entirely — but *not* from AoE damage,
which has its own coin-flip resolution:

> "If the Servant is caught in an AoE Attack and fails to Evade, Flip a Coin. If Heads, no
> damage and effects are received; if Tails, Total Damage taken from that Attack is reduced by
> 50% & PC is deactivated."

**DECISION.** Concealed units are excluded from `chooser: "chosen"` and `count`-limited
selections by enemies, but *included* in `chooser: "all"` AoE resolutions with a
`concealedAoE: true` marker that triggers the coin flip during resolution. The player placing
the AoE is never told the concealed unit is there — the marker is resolved GM-side.

**RISK.** This leaks information through timing (a suspiciously long resolution). Mitigated by
resolving all AoE coin flips GM-side in one batch. Full mitigation is impossible client-side;
see Ch. 26.

**As built.** Both halves work, and both were waiting on the same thing: nothing ever made a Unit
concealed. `unit.concealed` was projected by the snapshot and consulted **here**, in the counter
gate, in movement legality and on the Evade ladder — and written by no code and declared by no
schema. Four readers, one answer, always `false`.

It is derived from the `presenceConcealment` effect now. The exclusion above fires exactly as
written; the coin lands in the **damage step**, on Total Damage, after every pipeline stage and
after any Command Spell factor, because the sheet says *"Total Damage taken from that Attack"*.
Heads is applied as a **factor of zero** rather than as a skipped step, so the explainer shows it
as a modifier with a cause — and it also refuses the attack's riders, because the clause is *"no
damage **and effects** are received"*.

Measured live against Karna's *Brahmastra Kundala*: Heads took 1 466 to 0 and left the
concealment standing; Tails took 1 470 to 735 and ended it.

### Master protection

> *"Masters cannot be targeted for an Attack when their Servant is within 2 panels of their
> Master."*

A selection filter, applied to `["enemy"]` sets containing Masters. Bypassed by active
Presence Concealment (*"able to Attack Masters … regardless of the enemy Master-Servant
positions"*) and by Scáthach's *Gate of Skye* (*"Masters can be targeted regardless of their
distance from their Servant"*).

**As built.** The filter consults `caster.bypassesMasterProtection`, which it has done since it
was written and which **nothing ever set** — so the exemption could not be authored at all. It is
now a contribution: `Suppress { scope: masterProtection }`, carried by the `presenceConcealment`
effect, projected onto the snapshot. Verified live: a concealed Serenity reached a Foe Master
standing beside its Servant that EMIYA was refused as *"a Master protected by an adjacent
Servant"*.

The counter-redirect is the same rule from the other side: *"the Counter Attack cannot be used
on the Master if its Servant is within a 2 panel area of itself, the Counter Attack is
redirected to that Master's Servant instead"* — a **retarget**, not a refusal, and therefore
part of selection, not validation.

### Platform separation

> *"Enemy Units on the ground cannot target Units onboard the HGoB for Attacks/Skills/Noble
> Phantasms. Enemy Units on the ground can only Attack the HGoB with ranged Attacks … Units
> onboard the HGoB cannot Attack Units directly below the HGoB and vice versa."*

Three separate filters:
1. Cross-level targeting of *units* is forbidden (the platform itself is targetable).
2. Cross-level attacks must be ranged (`range.panels ≥ 2`).
3. Directly-below is excluded even for ranged.

Golden Hind's rules are similar but not identical (AoE deals full damage to the ship and 50%
to units aboard; Masters aboard take nothing). Chapter 20 tabulates the differences.

---

## 9.6 Axis 4 — Limits and legality

```ts
interface LimitSpec {
  maxTargets?: number;
  requiresLineOfSight: false;                  // always — see §8.6
  forbidCivilians?: "ifGoodAligned";
  requiresZon?: boolean;                       // NPs: true
  requiresCasterIn?: string;                   // zone id, e.g. HGoB Throne Room
  forbidsCasterIn?: string;
  minTargets?: number;
}
```

### Validation happens at placement, not at execution

The preview is live-validated. An illegal placement is rendered in red with a reason string,
and the confirm button is disabled. Reasons observed in the reference set:

| Condition | Message |
|---|---|
| Servant outside Master's ZON, using an NP | "Noble Phantasms require the Servant to be within its Master's ZON (currently 4 panels away, ZON is 2)." |
| Good-aligned Servant, AoE NP, Civilian in area | "Good-aligned Servants will not use an AoE Noble Phantasm with a Civilian in range. Spend a Command Spell (Kill Humans) to override." |
| Master's Health ≤ NP cost | "Karna's Master has 38 Health; this Noble Phantasm costs 50." |
| Semiramis not in Throne Room | "Sikera Ušum can only be used within the Throne Room of the Hanging Gardens." |
| Anchor outside range | "Anchor panel is 6 panels away; Range is 5." |
| Anchor inside minimum range | "Vasavi Shakti has a minimum Range of 3." |
| Cross-level, melee | "Units aboard the Hanging Gardens can only be attacked with ranged Attacks." |
| No legal targets | "No enemy Units in the selected area." |

The last one is a **warning**, not an error, for abilities whose effect is not target-dependent
(placing a zone). For an attack it is an error.

### Command-spell overrides

Several validations are overridable by spending a Command Spell. The dialog offers it inline
rather than making the player cancel, spend, and re-target. The command-spell system (Ch. 17)
exposes `canOverride(validationFailure): CommandSpellKind | null`.

---

## 9.7 The resolution algorithm

```
resolveTargets(spec, caster, board, placement?) → ResolvedTargets

 1. ANCHOR
    Compute the anchor panel(s) or unit reference.
    - self               → caster's centre panel
    - selfEdgeAdjacent   → caster's panel + chosen direction
    - withinRange        → the placement panel (validated against range/minRange)
    - targetUnit         → the chosen unit (validated against range + relation)
    - movementPath       → the traversed panel list
    - zone/platform      → the zone's panel set
    - global             → all panels
    - sourceOfAttack     → the attacker from context

 2. SHAPE
    Expand the anchor into a panel set, clipped to board bounds.
    For `banded`, produce (panel → band index) instead of a flat set.

 3. OCCUPANCY
    Collect unit ids occupying any panel in the set.
    Multi-panel units are included if ANY occupied panel intersects.
    Deduplicate.

 4. RELATION FILTER
    Keep units whose relation() to the caster is in spec.relations.
    Apply includeSelf.

 5. KIND FILTER
    Drop platforms/structures unless explicitly included.
    Drop civilians if forbidden.

 6. ATTRIBUTE FILTER
    Evaluate spec.attributes against each unit's closed attribute set.

 7. VISIBILITY FILTER
    Drop concealed units from chosen/count-limited selections;
    mark them concealedAoE in "all" selections.

 8. PROTECTION FILTER
    Drop Masters protected by an adjacent Servant, unless bypassed.
    Apply cross-level rules.

 9. CHOOSER
    all      → everything surviving
    chosen   → present the survivors for player selection, up to count
    nearest  → sort by distance, take count
    random   → shuffle deterministically (seeded), take count

10. LIMITS
    Enforce maxTargets/minTargets. Attach band indices. Attach distances.

11. RESULT
    { units: TargetedUnit[], panels: GridOffset[], anchor, warnings[] }
```

Steps 1–2 are pure geometry (L1). Steps 3–10 need the board snapshot (L2). Nothing writes.

```ts
interface TargetedUnit {
  unitId: string;
  distance: number;          // from caster, Chebyshev
  band: number;              // 0 if unbanded
  concealedAoE: boolean;
  relation: Relation;
}
```

---

## 9.8 The complete shape catalogue from the reference set

Every targeting declaration observed across the 12 Servants, normalized. This is the
acceptance surface for the targeting engine.

| # | Source phrasing | Anchor | Shape | Selection | Used by |
|---|---|---|---|---|---|
| T1 | "Range: 3 panels, 1 target" | `withinRange(attackRange 3)` | `unit` | enemy, count 1 | normal attacks |
| T2 | "Range=1" melee | `withinRange(attackRange 1)` | `unit` | enemy, count 1 | Heracles, Pollux |
| T3 | "affects all allied Units within a 2 panel area of X" | `self` | `chebyshevRadius 2` | ally+self, all | Party effects (very common) |
| T4 | "Used on an allied Unit within a 2 panel area" | `targetUnit(chebyshev 2, ally)` | `unit` | ally+self, chosen 1 | Van Gogh, Kiritsugu |
| T5 | "Range=2. Used on an enemy Unit" | `targetUnit(attackRange 2, enemy)` | `unit` | enemy, chosen 1 | Karna *Discernment* |
| T6 | "5×5 panel area in any non-diagonal direction next to X" | `selfEdgeAdjacent(chosen)` | `rect 5×5` | enemy, all | Van Gogh, Scáthach |
| T7 | "7×7 panel area in any non-diagonal direction next to X" | `selfEdgeAdjacent(chosen)` | `rect 7×7` | enemy, all | Van Gogh NP |
| T8 | "3×3 panel area in any non-diagonal direction next to X" | `selfEdgeAdjacent(chosen)` | `rect 3×3` | enemy, all | Kingprotea NP, Nemo, Bašmu |
| T9 | "Range=4. Hits a 3×3 panel area within Range" | `withinRange(attackRange 4)` | `rect 3×3` | enemy, all | Semiramis *Doves* |
| T10 | "Range=5. Hits a 7×7 panel area within Range" | `withinRange(attackRange 5)` | `rect 7×7` | enemy, all, self-excluded | Karna *Brahmastra Kundala* |
| T11 | "Range=3 to 4. Hits a 3×3 area within Range" | `withinRange(4, min 3)` | `rect 3×3` | enemy, all | Karna *Vasavi Shakti* |
| T12 | "Hits a 5×5 panel area around Nemo" (banded) | `self` | `banded[1→1.5×, 2→0.5×]` | enemy, all | Nemo *Triton's Conch* |
| T13 | "7×3 or 3×7 in the direction the bow faces" | `selfEdgeAdjacent(facing)` | `orientedRect 7×3` | enemy, all | Drake *Golden Wild Hunt* |
| T14 | "all enemies in his path while Moving in a straight line" | `movementPath` | `path` | enemy, all | Riding Attack |
| T15 | "targets of choice within a 5×5 … non-diagonal direction" | `selfEdgeAdjacent(chosen)` | `rect 5×5` | enemy, **chosen subset** | Scáthach *Gate of Skye* |
| T16 | "all Units within a 3 panel area of Gogh" | `self` | `chebyshevRadius 3` | **any relation**, all | Van Gogh *Shadow of Longing* |
| T17 | "affects the 5×5 panel area around her (which Moves with her)" | `self` | `rect 5×5`, persistent+following | zone effect | Semiramis *Sikera Ušum* |
| T18 | "Affects the Throne Room" | `zone("throneRoom")` | `zone` | any in zone | Semiramis *Sikera Ušum* (DSC) |
| T19 | "all allied Units upon the Golden Hind" | `platform("own")` | `zone` | ally+self, all | Drake, Nemo |
| T20 | "Range=7 plus the area under the HGoB and the area of the HGoB" | `withinRange(7) ∪ platform` | `rect 5×5` within | enemy, all | HGoB *Dragon Wing Warriors* |
| T21 | "effective at any Range" | `global` | `unit` | the NP's user | Mannanán *Fragarach* |
| T22 | "regardless of Range" | `sourceOfAttack` | `unit` | the AU | `Repel`, reflects, Fragarach Counter |
| T23 | "self" (no target stated) | `self` | `unit` | self | most buff skills |
| T24 | "Range=3" (single-target spell) | `withinRange(attackRange 3)` | `unit` | enemy, count 1 | Scáthach *Þurs*/*Úr*, Nemo *Quickfire* |

Twenty-four distinct declarations, expressible as **9 anchors × 11 shapes × 6 selections**.
No bespoke code per ability. That is the design target met.

---

## 9.9 Preview and interaction

The targeting UI has four modes, chosen by the anchor kind.

**Mode A — Direction picker** (`selfEdgeAdjacent` with `direction: "chosen"`).
Four ghost overlays appear around the caster, one per cardinal direction, tinted by legality.
Hovering highlights affected units and shows a count. Clicking confirms. Keyboard: arrow keys
cycle, Enter confirms, Escape cancels. **This is the single most important UX affordance in
the system** — it replaces the prototype's free-placement-plus-confirm-dialog loop with one
click, and it makes the "non-diagonal direction" rule self-teaching.

**Mode B — Free placement** (`withinRange`).
A crosshair follows the cursor, snapped to grid, showing the shape. Panels outside the legal
anchor range grey the shape out and show the reason. The affected-unit list updates live in a
floating panel. Click to confirm, right-click to cancel.

**Mode C — Unit picker** (`targetUnit`).
Legal targets are outlined and pulse; illegal ones are dimmed with a reason on hover. Click a
legal target. If exactly one legal target exists, an optional setting auto-selects it.

**Mode D — Subset picker** (`chooser: "chosen"` over an area).
Runs Mode A or B first to place the area, then presents each unit inside it as a toggle, with
a confirm button showing "N targets selected". Used only by *Gate of Skye* in the reference
set, but the interaction is generic.

All four render the same underlying `ResolvedTargets` preview object, so the affected-unit
list, the damage estimate, and the legality warnings are identical code across modes.

### Preview shows the damage estimate

Because the damage pipeline is pure (Ch. 01 §1.7, Ch. 13), the preview runs it speculatively
for each target and shows the expected value with the crit range:

```
Brahmastra Kundala — 7×7 within Range 5
  ▸ Heracles      1,847 – 2,431   (Burn, Def Dwn (B))
  ▸ Enemy Master     412 – 545     ⚠ Overpower roll applies
  ▸ Civilian       ⛔ blocked: Karna is Chaotic Good
```

This is only possible because the rules layer never writes. It is the payoff for the
Snapshot/Intent design.

---

## 9.10 Exceptional cases

### Attacks that retarget mid-resolution

`CS: Teleport Servant`, used when a Master is attacked, teleports the Servant next to the
Master and **switches the attacker's target to the Servant**, who then cannot Evade or Block.
So target resolution is not final until the reaction ladder completes. The `CombatPhase`
carries a mutable target list and a `retarget()` operation that is only reachable from the
command-spell interrupt handler.

### Attacks with no chosen target

`Dodge Counter` / `Guard Counter` / `Auto Counter` automatically counter the attacker, and
*move the counter-attacker into range if needed*:

> *"If the AU is not within Range, the affected Unit Moves until the AU is within Range. …
> the distance the affected Unit is allowed to Move is limited by its MOV Stat. If they are
> unable to Move the distance required, the Counter will fail. Also, the affected Unit will
> always Move the shortest distance possible."*

So the targeting engine is invoked with `anchor: sourceOfAttack` and, on failure, the movement
engine computes the shortest legal path bringing the AU into range, capped by MOV. If no such
path exists, the counter fails. This composes targeting and pathfinding, and it is the one
place where target resolution triggers movement.

### Riding Attack path resolution

The path is chosen by the player as a direction and a distance (capped by remaining MOV), and
the attack hits **every enemy on the path**, including those it passes through — Riding Attack
is the sole exception to the no-moving-through-enemies rule. Resolution order along the path
matters if an enemy dies mid-path (the panel becomes passable, but the path was already
declared). **DECISION.** The path is fixed at declaration; deaths do not extend it.

### Presence Concealment's occupied-panel clause

> *"If an enemy Unit Moves onto the exact panel occupied by a Unit with active Presence
> Concealment, the Unit with Presence Concealment must perform an Attack on the Unit who tried
> to Move onto its panel, while the enemy Unit stops on a panel that was 1 panel short of its
> Move."*

A movement-triggered forced attack with an implicit target. Implemented as a movement
interceptor that truncates the path and enqueues an attack with `anchor: sourceOfAttack`
reversed. Only applies when playing with hidden tokens.

---

## 9.11 Authoring format

The content author writes YAML (converted to JSON at build time — Ch. 37):

```yaml
# Van Gogh — Het Gele Huis: The Yellow House (NP)
phases:
  - id: debuff
    target:
      anchor: { kind: selfEdgeAdjacent, direction: chosen }
      shape:  { kind: rect, w: 7, h: 7 }
      selection: { relations: [enemy], chooser: all }
    effects:
      - { id: defDwn,  duration: "2◈", magnitude: 20, chance: 150 }
      - { id: defDwnC, duration: "2◈", magnitude: 20 }

  - id: allies
    target:
      anchor: { kind: self }
      shape:  { kind: chebyshevRadius, r: 2 }
      selection: { relations: [ally, self], chooser: all }
    effects:
      - { id: evade,  duration: "2◈", uses: 2 }
      - { id: regen,  duration: "3◈", percentOfMax: 5,
          on: [unitTurnEnd, actedTurnEnd, roundEnd] }
      - { id: curse,  chance: 500, stacks: 2 }
```

Readable, close to the source text, and fully machine-checkable. The validator confirms every
`id` exists in the effect catalogue, every duration parses, every shape is known, and every
selection is explicit where Note 11 would otherwise apply.

---

## 9.12 Summary of decisions

| # | Decision |
|---|---|
| D9.1 | Targeting is four orthogonal axes: anchor, shape, selection, limits. |
| D9.2 | `selfEdgeAdjacent` blocks are flush against the caster, centred on its axis, caster excluded. |
| D9.3 | `withinRange` limits the **anchor**, not the footprint; shapes may overhang. |
| D9.4 | "Range=N" means the octagonal attack-range shape; "within an N panel area" means Chebyshev. |
| D9.5 | "Allied" includes the caster by default; damaging AoE NPs exclude the caster by default (Note 11); both are overridable and the validator forces explicitness on the ambiguous case. |
| D9.6 | Concealed units are dropped from chosen selections but included, marked, in AoE. |
| D9.7 | Multi-shape abilities are ordered phases, not shape algebra; `reuseTargets` chains them. |
| D9.8 | Legality is validated live during placement with human-readable reasons and inline command-spell overrides. |
| D9.9 | No line of sight, ever. Level separation is not LOS. |
| D9.10 | The preview runs the real damage pipeline speculatively. |

---

**Next:** [10 — Effects Taxonomy](10-effects-taxonomy.md)
