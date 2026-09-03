# Medusa — design

**Date:** 2026-09-03
**Source:** `char_orig_sheets/Copia de Medusa.md`
**Chapters affected:** [04 — Units](../../04-units.md), [06 — Stats and Resources](../../06-stats-and-resources.md),
[08 — Board and Geometry](../../08-board-and-geometry.md), [09 — Targeting](../../09-targeting.md),
[11 — Effect Engine](../../11-effect-engine.md), [12 — Combat Process](../../12-combat-process.md),
[13 — Damage Pipeline](../../13-damage-pipeline.md), [14 — Checks](../../14-checks-and-randomness.md),
[16 — Relationships](../../16-relationships.md), [43 — Bounded Fields](../../43-bounded-fields.md),
[44 — Case: Expanded Roster](../../44-case-expanded-roster.md), [45 — Implementation Status](../../45-implementation-status.md),
[A — Effect Catalogue](../../A-effect-catalogue.md), [B — Rank Tables](../../B-rank-tables.md),
[D — Servant Data Sheets](../../D-servant-data-sheets.md), [E — Event Reference](../../E-event-reference.md)

---

## 1. The problem

Pale Rider was a Servant who does almost nothing himself. Medusa is the opposite: every one of
her ten abilities is something she *does*, and the engine's gaps are all in the verbs.

Three of them are structural rather than incidental.

**She is the only unit in the game that cares where she is looking.** *"Cannot be used on a Unit
if there is an obstacle/obstruction between Medusa and the target Unit, and can only be used if
Medusa is facing the targeted Unit."* Ch. 44 §44.3 already ruled on this — D44.8, *"no general
line of sight; `requiresClearPath` is a per-ability targeting predicate"* — and neither predicate
exists. `system.facing` exists and is drawn on the token; nothing has ever read it as a
prerequisite.

**Her Noble Phantasm is built over four turns before it exists.** Blood Fort Andromeda is not
cast. Medusa spends four separate Attack actions placing Bloodmarks, and the field activates when
the fourth completes a legal square. Ch. 43 names the mode (`markDefined`) and rules that the
marks are `Structure` actors; nothing implements either. It is the only field in the corpus with
no duration at all — it runs until Medusa dies, and Ch. 43's `expiry: onOwnerDefeat` was written
for it alone.

**Her Mystic Eyes are a decision tree, not a check.** Three branches chosen by what the target
*is*, one of which rolls a second time on failure, and one branch's outcome is a stat reduction
rather than an effect. `runCheckPhase` is a single Luck check with `onSuccess`/`onFail`, each
holding a flat list of effects.

The rest is narrower, and all of it is general:

| Sheet clause | What the engine lacks |
|---|---|
| Riding: *Riding Attack* / *Passenger Seat* | Both are in `GRANTS` and **no engine reads either** — declared, never consumed |
| Riding: unlocked *by the Active*, not permanent | A grant cannot be conditional on a mode being on |
| Divinity `E−` | Nothing; `Rank.parse("E-")` already yields ordinal −1 |
| Independent Action: *+1◈ Sustainability per Civilian killed while Free* | `civilianKill` fires; nothing pays out on it |
| Monstrous Strength: *used at the start of a Damage Step* | `fgt.damageStepStart` is in Appendix E and **is never fired** |
| Monstrous Strength / Metamorphosis: *cannot be used on the same Turn as* | No mutual same-turn exclusion between two abilities |
| Metamorphosis: *Dmg Up (Bind)* | `Bind` is an umbrella over ten effects (§A); no effect **family** exists |
| Mystic Eyes: *obstruction between* / *facing the target* | `requiresClearPath`, `requiresFacing` — neither exists |
| Mystic Eyes: three target branches, one nested | `runCheckPhase` is one Luck check, two flat branches |
| Mystic Eyes: *reduce the DU's Agility by 2* | A check branch can apply effects and nothing else |
| Mystic Eyes: *ignore debuff resistance due to Magic Resistance* | Resistance is a number; its **source** is not recorded |
| Mystic Eyes: `Petrify` | The pipeline's >200 rule exists; the **effect definition** does not |
| Blood Temple: *if BFA is Active, −2◈ instead* | No predicate asks whether a named field of one's own is open |
| BFA: four marks, 5×5/7×7/9×9 | No `Mark` action, no `markDefined` construction, no `Structure` content |
| BFA: *only Masters can destroy*, *visible within 3 panels* | No per-kind destructibility, no proximity visibility |
| BFA: drain-to-heal, capped at the amount drained | Field events write to their victim; none pays a **pool** to somebody else |
| BFA: *halved against `Mechanical`* | An interior rule cannot scale by an attribute |
| Bellerophon: 1×13 diagonal, bidirectional except on the Large Board | The geometry already does both; `legalPlacements` **offers only the four cardinals**, and no shape reads board size |

Fourteen engine features. Nine of them are the "declared and never consumed" pattern this project
keeps finding — `ridingAttack`, `passengerSeat`, `damageStepStart`, `expiry: onOwnerDefeat`,
`markDefined`, `Structure`, `requiresClearPath`, `requiresFacing` and `Petrify` are all named in
the specification and implemented by nothing.

---

## 2. What is deliberately not built

**Achilles's `Troias Tragōidia`.** Ch. 44 §44.3 pairs it with Bellerophon as the same shape, and
its `@count(hitTargets)` expression is a separate language feature. Bellerophon needs the shape;
it does not need the expression. Achilles is not in this scope.

**General line of sight.** D44.8 already decided against it. `requiresClearPath` is a targeting
predicate on one ability, and the global no-LOS rule stands.

**A Large Board.** Bellerophon's *"only hits in one direction on the Large Board"* is read off
`board.bounds`, which the 25×25 board already sets. No new setting.

---

## 3. Design

### 3.1 Facing and clear path (Ch. 09, Ch. 44 §44.3)

Two independent targeting predicates in `rules/targeting/resolve.mjs`, applied as filter steps
next to the concealment and Master-protection filters they resemble.

`requiresFacing: true` — the target must be in the caster's **front** quadrant. No new geometry:
`domain/geometry.mjs#coneOf(facing, self, other)` already answers `front|right|back|left` for any
pair of panels and any of the eight compass facings. The predicate is
`coneOf(caster.facing, caster.panel, target.panel) === "front"` and that is the whole
implementation.

> `coneOf` is itself written-and-never-read: **nothing in the system calls it.** Ch. 14 §14.5's
> Evade table lists *"attacked from left or right +1"* and *"attacked from behind +2"*, and
> `rollEvade` assembles its modifiers from `checkPlan` contributions and the NP/AoE flags only —
> so the directional modifiers are not applied to anything today. That is a Ch. 14 gap, not a
> Medusa one, and it is **not in this scope**; noted because it is the reason the function it
> needs already exists.

`requiresClearPath: true` — no **blocking** unit may stand strictly between caster and target on
the straight line joining them. The sheet's own example is the specification:

> *Unit [Cannot be targeted] — Unit [Can be targeted] — Medusa*

The nearer unit is targetable; the one behind it is not. Blocking is `kind !== "civilian"` and not
defeated: a corpse and a bystander do not obstruct.

This does need new geometry. `geo.line` projects a *direction* for a length; nothing walks between
two given panels, so `panelsBetween(a, b)` joins it — a supercover walk that yields the panels
strictly between, exclusive of both ends, and returns `[]` for panels that are not on a shared
row, column or exact diagonal. A target off any of those three axes has no "between" to obstruct
and is unrestricted, which is the conservative reading and the only one the sheet's single
example supports.

Both are per-ability, both default off, and both are recorded as `excluded` reasons so the
targeting HUD can say *why* a unit greyed out — which is the whole point of the affordance
(Ch. 28 §28.6).

### 3.2 Effect families (Ch. 11, §A)

`Bind` is not an effect. §A defines it as *"umbrella for Stun, Disable, Immobilize, Slow, Petrify,
Shock, Webbed, Seal, Freeze, Crystalfreeze"*, and Metamorphosis's third clause is *"all damage
dealt to Units inflicted with Bind effects is increased by 50%"*.

An effect definition gains `families: [...]`, and the registry indexes them. A new roll option
`target:hasFamily:<id>` joins `target:hasEffect:<id>`, so the damage bonus is an ordinary
predicated `Dmg Up` and nothing in the pipeline changes. `Bind` is declared as a family on the
ten member effects rather than as a list held centrally — a new binding effect should not need an
edit somewhere else to count.

### 3.3 Resistance provenance (Ch. 11)

*"Debuffs inflicted by this Skill ignore the DU's debuff resistance due to Magic Resistance."*

The applier's chance calculation sums resistance contributions into one number, so a bypass
scoped to one *source* cannot be expressed. Each contribution keeps a `source` tag it already
carries for display; `applyEffect` gains `ignoresResistanceFrom: ["magicResistance"]` and drops
matching contributions before summing.

Scoped to the source, not to the magnitude: Magic Resistance's *other* halves — MAG negation and
the Instakill/Death interaction — are untouched, which is what the sheet says.

### 3.4 A general check phase (Ch. 14)

`runCheckPhase` becomes recursive and parameterised:

```yaml
kind: check
check: agility                 # or luck; luck keeps today's Luck-cost behaviour
branches:
  - when: ["target:kind:master", "target:attribute:human"]
    onSuccess: { effects: [{ id: stun, duration: "2◈" }] }
    onFail:    { effects: [{ id: petrify }] }
  - when: ["target:npcOrLowMag"]
    onSuccess: { statDeltas: [{ path: agility.value, delta: -2 }] }
    onFail:                    # nested: "If Failed, roll again"
      check: agility
      onSuccess: { effects: [{ id: stun, duration: "1◈" }] }
      onFail:    { effects: [{ id: petrify }] }
```

Three changes, each independently useful:

- **`check:` selects the parameter.** An Agility Check spends no Luck; a Luck Check still costs 1
  whether or not it succeeds (Ch. 14). Cover (§16.4 rule 4) already resolves an Agility Check
  through `resolveCheck` + `checkPlan`; this uses the same pair.
- **`branches:` with a `when:` predicate**, first match wins, evaluated against the *target's*
  option set. Medusa's three classes are ordinary predicates; no new vocabulary beyond
  `target:mag:gte:<rank>`, which the NP-scale ladder's shape already suggests.
- **A branch may nest**, and may carry `statDeltas` as well as `effects`. Nesting is what
  *"If Failed, roll again"* is; `statDeltas` is what *"reduce the DU's Agility by 2"* is.

The existing single-branch `onSuccess`/`onFail` shape stays valid — Scáthach's Gate of Skye uses
it and must not change.

### 3.5 `damageStepStart`, and same-turn exclusion (Ch. 12, Ch. 15)

Monstrous Strength is *"used at the start of a Damage Step when performing an Attack"*. It is a
player-activated ability at a timing the Combat Process passes through, so the Process raises
`fgt.damageStepStart` on the attacker before stage 1 and offers any ability whose `window` names
that event. The event is in Appendix E already; this is its first firing and its first listener.

*"Cannot be used on the same Turn as Monstrous Snake Metamorphosis"* is a **mutual** same-turn
lock. `toggleLock` (§15.3) is the existing two-way lockout for modes; this is the same idea for
uses, so abilities gain `excludesThisTurn: [<contentId>]` and the check is symmetric — declaring
either blocks the other for the turn, whichever was authored first.

### 3.6 Riding's conditional grants (Ch. 08, Ch. 15)

Medusa's Riding differs from Achilles's and Ozymandias's: *"Additionally, 'Riding Attack' and
'Passenger Seat' can be used on this Turn"* — the two passives are unlocked **by the Active**, not
permanent. So `GrantedAbility` gains `while:` naming an effect, and Riding's Active applies a
marker the grant is predicated on. Achilles keeps the unconditional form.

Then both grants need readers, because neither has ever had one:

**Riding Attack** — *"Can Attack all Units in its path while Moving in a straight line as its
Normal Attack during its Turn. Cannot Attack or Move after it has stopped."* A move that is also
an attack: the path must be straight, every unit passed through is a defender in one fan-out, and
the move ends the turn's attack and movement together. Its length is *"MOV minus the number of
panels it has already Moved"*, which `budget.mjs` already tracks.

**Passenger Seat** — *"The Servant's Master can Move together with its Servant; after Moving, both
Servant and Master must be in the same orientation/position prior to the Move. Counts as only
Moving one Unit."* The Master is displaced by the same delta the Servant moved, with
`{fgtForced: true}` (Ch. 08's `MOVEMENT_FIELDS` rule), and the budget is charged once.

The MOV bonus is `isBuff: false` already, which is what *"not a buff and cannot be removed by buff
removal"* requires; `riding.yml` states it and it needs no change.

### 3.7 Bloodmarks and `markDefined` (Ch. 43)

Ch. 43 §43.10 already decided the shape: Bloodmarks are `Structure` actors with a linked bounded
field. `StructureData` is registered and has no content; this is its first.

**The `Mark` action.** A new `ActionKind`, priced as her Attack for the turn — *"counts as her
Attack for the Turn"* — so `budget.mjs` bills it through the attack pool and the mutual
attack/riding-attack exclusion applies unchanged. It places a Structure on the panel Medusa
stands on. *"Bloodmarks can be placed on any panel, even within enemy Home Bases"*, so the
Home Base restriction (Ch. 08) is explicitly waived for it.

**Completion.** After each placement, the four-mark set is tested for a legal square: exactly four
marks, forming an axis-aligned square whose side is 5, 7 or 9. The corners must be *corners* — the
sheet says *"Mark the four corner panels of a 5×5, 7×7, or 9×9 panel area"* — so three collinear
marks and a fourth are not a field. On completion the field opens with `expiry: onOwnerDefeat`,
and *"all other Bloodmarks will vanish"*: any mark not part of the completed square is destroyed,
and Medusa cannot place new ones while it stands.

**Visibility.** *"Bloodmarks can only be seen from a distance of 3 cells Maximum."* Per-viewer, so
it is presentation and never state — the same ruling D44.9 made for `Disguise`. A mark's token is
hidden from a client with no owned unit within 3 panels of it. The GM always sees them.

**Destruction.** *"Only Masters can destroy a Bloodmark, and it is done by simply Attacking it."*
A `destroyableBy: ["master"]` on the Structure, refused in the targeting filter with a reason.
Destroying one before the fourth lands resets the count; destroying one *after* activation ends
the field, because the square no longer exists.

### 3.8 The drain, and its pool (Ch. 43)

Three tiers by what the victim is, at the end of every turn it **acts** within the field:

| Victim | Effect |
|---|---|
| Normal Human | dies immediately; Medusa **or** her Master heals 100 Health and 1 Agility |
| Master, non-normal Human | −40 Health |
| Servant, non-Human | −20 Health |

*"The total Health lost from all affected victims is used to heal either or both Medusa and her
Master (total amount healed between the two cannot exceed the amount of Health drained.)"*

This is the first field event that pays a **pool** to somebody outside itself. `runFieldEvent`
gains a `drain` action that accumulates into a per-tick total, and a `payout` that distributes it
to named beneficiaries capped at that total. The cap is the rule, so it is enforced in the rules
layer rather than trusted to the content: two beneficiaries and one pool means the split is a
choice, and an uncapped split would double the drain.

*"The effects of this NP is halved against Units with the 'Mechanical' Attribute"* — the tier's
magnitude is scaled by an attribute test on the victim, which is the same per-victim branching
`branches:` on an interior event already does for Pale Rider's Contagion.

Excluded: Medusa and her Master, always.

### 3.9 Bellerophon (Ch. 09)

**Less is missing here than §44.3 assumed.** `domain/geometry.mjs#line` already steps a diagonal
direction correctly, `DELTA` already holds all eight compass values, and the `line` shape already
passes `bidirectional` through. Diagonal lines work end to end today — with one exception, and it
is in the interaction rather than the maths: `legalPlacements`'s Mode A hardcodes
`["n", "e", "s", "w"]`, *"always all four, so the player sees the choice rather than discovering
it"*. So a diagonal line is expressible and unofferable.

The change is therefore a shape flag that widens the **picker**, not the geometry:
`directions: "all"` on the shape makes Mode A emit all eight ghost previews. `bidirectional`
becomes conditional on board size through the `*ByBoardSize` pattern the HGoB footprint
established — both directions on 13×13, forward only on 25×25. Then 4× BA(MAG) + 100,
`ignoresMagicResistance: true` (which exists), and `Crit Up` for 1◈.

---

## 4. Risks

**The check-phase rewrite touches shipped content.** Scáthach's Gate of Skye is the only current
author of a `check` phase, and its behaviour must not change. The generalisation is additive —
`check:` defaults to `luck`, a phase with no `branches:` keeps reading `onSuccess`/`onFail` — and
Gate of Skye's live behaviour is re-verified before the task closes.

**Riding Attack is a move and an attack at once.** It crosses `movement.mjs` and `attack.mjs`,
which have not had to agree about anything before. The mitigation is that it produces an ordinary
fan-out: the move resolves first and completely, then the units it passed through are the target
list of one normal Combat Phase.

**`markDefined` spans turns, so its state is on the board rather than in a dialog.** That is the
safer half — four Structure actors are inspectable, and a half-built field is just three marks.

---

## 5. Verification

Live in `fgt2026`, as ever, with measurements rather than assertions:

1. Mystic Eyes refused through an intervening Servant, allowed on the nearer one, refused when
   Medusa faces away — the sheet's own three-unit example, reproduced on the board.
2. Each of the three Mystic Eyes branches, including the nested re-roll, with the rolls rigged by
   Agility as Cover's were.
3. Four Bloodmarks placed over four turns; the field opens on the fourth; a stray fifth vanishes;
   a Master destroys one and the field ends; a Servant is refused the same attack.
4. A Master, a Servant and a Civilian standing in the field for one turn: 40 + 20 drained, the
   Civilian dead, and Medusa healed by no more than the total.
5. A `Mechanical` unit taking half.
6. Bellerophon fired diagonally on the 13×13 board hitting both directions, and on the 25×25
   hitting one.
7. Riding Attack through three units in a straight line; Passenger Seat moving the Master with
   her for one budget charge.

---

## 6. Sequence

Eight commits, ordered so each is independently testable and nothing depends on a later one.

| # | Commit | Why here |
|---|---|---|
| 1 | Statline, Divinity `E−`, Magic Resistance, Independent Action | The sheet's passive half; nothing depends on it and it proves the actor loads |
| 2 | Effect families; `Petrify`; `Bind` on its ten members | Needed by Metamorphosis and by Mystic Eyes |
| 3 | `requiresFacing`, `requiresClearPath` | Pure targeting, testable with no ability |
| 4 | The general check phase, and resistance provenance | Mystic Eyes' machinery, verified against Gate of Skye |
| 5 | Mystic Eyes | The first ability that needs 2, 3 and 4 together |
| 6 | `damageStepStart`, same-turn exclusion, Monstrous Strength, Metamorphosis, Blood Temple | The three remaining Actives; Blood Temple's field predicate is stubbed until 7 |
| 7 | Bloodmarks, `markDefined`, the drain pool, Blood Fort Andromeda | The largest, and the only one that needs `Structure` |
| 8 | Riding Attack, Passenger Seat, `allowDiagonal`, Bellerophon | The movement half and the line NP |

---

## 7. Self-review

**Coverage.** Every ability on the sheet maps to a commit: Riding (8), Magic Resistance (1),
Divinity (1), Independent Action (1), Monstrous Strength (6), Metamorphosis (6), Mystic Eyes (5),
Blood Temple (6, completed by 7), Blood Fort Andromeda (7), Bellerophon (8).

**Ambiguities resolved, and how.**

- *"Either Medusa or her Master heals 100 Health and 1 Agility"* on a Civilian death is stated as
  a choice with no default. Read as **Medusa unless her Master is the one who would be brought
  from below full**, because the pool clause immediately after it says *"either or both"* and
  gives no procedure either — a choice the game leaves to the table, and a default that never
  wastes healing is the least surprising one. Recorded in Ch. 43 rather than invented silently.
- *"the same orientation/position prior to the Move"* (Passenger Seat) reads as the Master keeping
  its **relative** position to Medusa, not its absolute one — otherwise the Master does not move
  at all and the clause says nothing.
- *"Normal Human"* versus *"non-normal Human"* is the `civilian` kind versus a Master or Servant
  carrying the `Human` attribute. The sheet's three tiers are exhaustive over the unit kinds.
- Mystic Eyes' second branch reads *"Non-humans, Servants with MAG of Rank C or lower"*. Taken as
  two conditions on one branch, matching the third branch's *"Servants with MAG of Rank B or
  higher"* — the two together partition Servants by MAG, and non-humans fall in with the lower.

**Type consistency.** `requiresFacing`/`requiresClearPath` are ability `targeting.limits` flags
throughout; `families` is on the effect definition and `target:hasFamily:<id>` is the option;
`drain`/`payout` are field-event actions; `excludesThisTurn` is an ability field; `directions`
is a `line` shape field taking `"all"`. Each appears with one name and one shape in every task that mentions it.
