# 32 — Case Study: Semiramis

> **Gather has a control (Ch. 45).** `engine/gather.mjs` was complete and had no caller, so
> Construction could not be fed by the action the sheet describes. The action bar offers it to any
> unit the rule allows, and because *"Semiramis or any allied Unit"* may perform it the slot
> appears on an **ally's** bar as a consequence of who else is on the board.


Semiramis is the acceptance test for **everything structural**. She is conditionally a different
Servant depending on a coin flip at summon, builds a 9×9 flying fortress over many rounds via a
resource counter with six accrual sources, summons a dragon bound to that fortress, carries a
transferable item that grants a status, and has a Noble Phantasm whose behaviour changes
entirely based on which version of herself was summoned.

If the architecture handles Semiramis, it handles the game.

---

## 32.1 The conditional class skill

```
(Semiramis) Double Summon: Caster — Rank: B
(Trigger) When Semiramis is summoned, Flip a Coin. If Heads, she is summoned with the
'Double Summon: Caster' Skill. If Tails, she does not have it.
```

A **summon-time branch** that changes: her Range, her normal-attack component, her
Sustainability, whether Territory Creation EX applies to her home base or only to the HGoB,
whether she can use `Summoning: Bašmu`, whether `Hanging Gardens of Babylon` exists at all, and
which of two forms `Sikera Ušum` takes.

**DECISION.** Model as a **summon-time variant**, resolved once and stored, not as a runtime
predicate evaluated everywhere.

```yaml
summonVariants:
  - id: dsc
    roll: { formula: "coinFlip", on: "heads" }
    grants: [semiramis-double-summon-caster]
    overrides:
      range: { panels: 3, targets: 1 }
      normalAttack:
        mode: byRange
        bands:
          - { maxRange: 2, spec: { mode: fixed, component: str } }
          - { maxRange: 99, spec: { mode: fixed, component: mag } }
      sustainability: { base: "4◈" }
  - id: noDsc
    default: true
    overrides:
      range: { panels: 2, targets: 1 }
      normalAttack: { mode: fixed, component: str }
      sustainability: { base: "2◈" }
```

The summon dialog rolls it, shows the result, and applies the variant. Everything downstream
reads `self:variant:dsc` as an ordinary roll option.

**Why not a runtime predicate:** because the branch affects the *shape* of her data (range
bands, sustainability), not just conditional effects. Resolving once keeps every reader simple
and makes the sheet honest about what she actually is.

### The `DSC` buff

Complicating it: if she was *not* summoned with the skill, her `Double Summon` **active** skill
grants it temporarily for 1◈:

> *"If Semiramis does not have the 'Double Summon: Caster' Skill, she gains the 'DSC' buff for
> 1◈ Turns, this buff grants her the 'Double Summon: Caster' Skill."*

So the variant is the *baseline* and the buff is an override on top. Both feed the same roll
option:

```js
const hasDSC = unit.variant === "dsc" || unit.hasEffect("dscBuff");
```

with `dscBuff` granting the ability via `GrantAbility` (Ch. 24 §24.3) for 1◈. The
range/attack-component overrides ride along with the granted ability rather than being
duplicated.

---

## 32.2 HGoB Construction — the six-source counter

```
1. Region: Middle East → starts at 25; adjacent → starts at 10
2. On summon: 2d6, multiplied together
3. End of every Round: 1d4 + 2
4. Item Construction used: +1 per [Semiramis' Poison] produced
5. Any non-Spell Skill used except Item Construction: +2
6. 'Gather' action: +3 (Semiramis +5, her Master +4)

Region multiplier: Middle East → all increases doubled (excluding 1 and 2);
adjacent → all increases +2 (excluding 1 and 2)
```

A resource with six heterogeneous triggers and a global multiplier. The resource system
(Ch. 06 §6.10) handles five of them declaratively:

```yaml
resources:
  hgobConstruction:
    max: 100
    initial: "@region:middleEast ? 25 : (@region:adjacentToMiddleEast ? 10 : 0)"
    gainTriggers:
      - { trigger: summon, formula: "multiplyDice(1d6, 1d6)", bypassMultiplier: true }
      - { trigger: roundEnd, formula: "1d4+2" }
      - { trigger: abilityUsed, filter: { id: semiramis-item-construction },
          amount: "@lastItemConstructionCount" }
      - { trigger: abilityUsed, filter: { isSpell: false, not: [semiramis-item-construction] },
          amount: 2 }
      - { trigger: action, filter: { kind: gather },
          amount: "@actor.id == semiramis ? 5 : (@actor.isSemiramisMaster ? 4 : 3)" }
    multiplier:
      - { predicate: ["board:region:middleEast"], factor: 2 }
      - { predicate: ["board:region:adjacentToMiddleEast"], addend: 2 }
```

Two things needed engine support:

**`multiplyDice(a, b)`** — the source says *"roll 2 six-sided dice. HGoB Construction is
increased by X, where X = the number of both six-sided die **multiplied** together."* Standard
dice notation cannot express this, so it is a registered dice helper.

**The `Gather` action.** A new action kind:

```yaml
actions:
  gather:
    label: "FGT.Action.Gather"
    availableWhen: [{ predicate: ["ally:has:semiramisConstruction"] }]
    consumes: servantMove          # "counts as a Unit's 'Move' for that Turn"
    forbidsThisTurn: [attack]      # "cannot Attack on the same Turn"
```

`Gather` is available to *any* allied unit, not just Semiramis, which makes it a genuine team
activity and a real tactical choice: three allies gathering is +9/round (or +18 in the Middle
East), which halves the build time.

---

## 32.3 Channelled activation

```
When HGoB's Construction reaches 100, it can be activated. Semiramis has to be within her
Home Base, and cannot Act for 3◈ Turns. If Semiramis is Attacked during this period, the
period is interrupted and she has to restart. If not interrupted, the HGoB is activated at
the end of the last Turn. Her Master only loses Health when it successfully activates.
However, Semiramis can perform the activation without being in her Master's ZON.
```

The channelled ability kind (Ch. 20 §20.4). Four properties nothing else in the game has:

1. Multi-turn commitment with the unit unable to act.
2. Interruption on being **attacked** — not on taking damage, so even a fully-evaded attack
   interrupts.
3. Restart, not cancel: the counter resets and she may try again.
4. Cost paid on success only.

```yaml
channel:
  isChannelled: true
  duration: "3◈"
  requirements:
    - { kind: inZone, zoneId: ownHomeBase }
    - { kind: resourceAtLeast, key: hgobConstruction, amount: 100 }
  exemptions: [inZon]
  interruptedBy: [attackDeclaredAgainstSelf]
  onInterrupt: restart
  costTiming: onSuccess
  duringChannel:
    - { key: CannotAct }
    - { key: DisplayBadge, label: "FGT.Semiramis.Channelling" }
```

`interruptedBy: attackDeclaredAgainstSelf` rather than `damageTaken` is the faithful reading and
it makes the channel far more fragile — any enemy in range can reset three rounds of work with a
single attack. That is clearly intentional; the fortress should be hard to build.

The HUD shows the channel prominently for **all** players, because an opponent needs to know to
interrupt it. This is not hidden information — Semiramis sitting motionless in her home base for
three rounds is observable at the table.

---

## 32.4 The Hanging Gardens

Full specification in Ch. 20 §20.4. The conversion:

```yaml
platform:
  id: hanging-gardens-of-babylon
  footprint: { w: 9, h: 9 }            # 11×11 on the large board
  footprintByBoardSize: { 13: [9,9], 25: [11,11] }
  levelName: "Hanging Gardens of Babylon"
  stats:
    health: 6000
    agility: 0
    luck: 0
    mov: 2
    movByBoardSize: { 13: 2, 25: 3 }
    baseAttack: { mode: owner, component: mag }
  capacity: null
  acceptsEffects: false
  canReact: false
  canBeCountered: false
  countsTowardTurnBudget: false
  movesOntoOccupiedPanels: true
  countsAsHomeBaseFor: "@owner.factionId"

  subZones:
    - id: throneRoom
      shape: { kind: rect, w: 5, h: 5, align: centre }
      tags: [throneRoom]

  boarding:
    formula: "1d12"
    successOn: 12
    modifiers:
      - { predicate: [{ rankIn: ["@unit.parameters.agi", ["C","B"]] }], reduceTarget: 1 }
      - { predicate: [{ rankGte: ["@unit.parameters.agi", "A"] }], reduceTarget: 2 }
      - { predicate: [{ rankIn: ["@unit.parameters.luc", ["C","B"]] }], reduceTarget: 1 }
      - { predicate: [{ rankGte: ["@unit.parameters.luc", "A"] }], reduceTarget: 2 }
      - { predicate: ["unit:hitByDragonWingWarriorsThisTurn"], reduceTarget: 2 }
      - { predicate: ["unit:attribute:levitating"], formula: "1d8", successOn: 8 }
    bringsMasterWithin: 2

  crossLevel:
    mayTargetOccupants: false
    requiresRanged: true
    forbidDirectlyBelow: true

  ownerEffects:
    - key: RankShift
      parameters: [str, end, agi, mag, luc]
      steps: 1
      statDeltas:
        baseAttackStr: 25
        health: { max: 500, current: 500 }
        mov: 1
        agility: { max: 2, current: 2 }
        baseAttackMag: 50
        luck: { max: 4, current: 4 }
    - { key: ExemptFromZon }
    - { key: SustainabilityModifier, delta: "2◈" }
    - { key: TerritoryCreationScope, scope: platform, rank: EX, homeBaseRank: C }

  attacks:
    - id: dragon-wing-warriors
      cooldown: "1◈"
      target:
        anchor: { kind: compound, of: [
          { kind: withinRange, range: { metric: attackRange, panels: 4 } },
          { kind: platform, platformId: own, includeBelow: true }] }
        shape: { kind: rect, w: 5, h: 5 }
        selection: { relations: [enemy], chooser: all }
      formula:
        fixed: 50
        component: str
        multihit: "1d6+4"
        perHitEvadable: true
        perHitBlockable: true
        singleInjuryRoll: true

    - id: aerial-garden-of-vanity
      cooldown: "2◈"
      target:
        anchor: { kind: withinRange, range: { metric: attackRange, panels: 7 },
                  exclude: [under, above] }
        shape: { kind: rect, w: 7, h: 7 }
        selection: { relations: [enemy], chooser: all }
      formula:
        base: [{ unit: owner, component: mag, factor: 1.0 }]
        multiplier: 2

  destruction:
    triggers: [ownerDefeated, healthZero]
    passengerSave: { check: [agility, luck], chooser: roller }
    onSaveFail: { fixedDamage: 100, component: str }
    masterExemptIfServantSaved: true
    scatter: below
    dismissSummons: [basmu]
    onDestroy: { resource: hgobConstruction, set: 0 }
    rebuildable: true
```

**Script elements needed: one** — `TerritoryCreationScope`, because "Territory Creation EX
applies to the HGoB area while the home base drops to Rank C" is a scope rewrite of another
ability that no generic element expresses. It is ten lines.

---

## 32.5 Bašmu — the bound summon

```
Summoning: Bašmu
Spell. Can only be used when Semiramis has 'Double Summon: Caster'.
1. If not within her HGoB: Damage Spell. Hits a 3×3 area within Range for 25% extra damage
   and inflicts Poison. Cooldown: 2◈.
2. If within her HGoB: summons a Bašmu on a panel directly next to her. Counts as her Attack.
```

One ability with two completely different behaviours, selected by a zone predicate. The
conditional anchor mechanism (Ch. 09 §9.3) generalizes to conditional *phases*:

```yaml
phases:
  - kind: conditional
    branches:
      - predicate: [{ not: "self:inZone:hgob" }]
        phases:
          - kind: damage
            target:
              anchor: { kind: withinRange, range: { metric: attackRange, panels: "@self.range" } }
              shape: { kind: rect, w: 3, h: 3 }
              selection: { relations: [enemy], chooser: all }
            formula: { base: [{ unit: self, component: mag, factor: 1.0 }], multiplier: 1.25 }
          - kind: applyEffect
            target: reuse
            effects: [{ id: poison }]
      - predicate: ["self:inZone:hgob"]
        phases:
          - kind: summon
            spec: { actorId: basmu, placement: adjacentToCaster, maxConcurrent: 1 }
```

The Bašmu itself:

```yaml
id: basmu
type: summon
system:
  health: { value: 1250, max: 1250 }
  agility: { value: 14, max: 14 }
  luck: { value: 7, max: 7 }
  mov: 5
  range: { panels: 2, targets: 1 }
  baseAttack: { str: 150, mag: 150 }
  normalAttack: { mode: fixed, component: str }
  attributes: [earth, large, dragon]
  constraints:
    maxConcurrent: 1
    boundToZoneId: hgob
    dismissOnZoneRemoval: true
    countsTowardTurnBudget: false
    actionsPerTurn: 1
    movesOntoOccupiedPanels: true
abilities:
  - basmu-normal-attack-poison:
      hasPassive: true
      passiveRules:
        - { key: OnEvent, event: damageStepEnd,
            predicate: ["self:isAttacker", "attack:kind:normal"],
            then: [{ key: ApplyEffect, target: victim, effect: { id: poison }, chance: 50 }] }
  - basmu-protection:
      hasPassive: true
      passiveRules:
        - key: TargetabilityModifier
          aura: { radius: 1, relations: [ally] }
          effect: cannotBeTargetedByEnemies
          appliesTo: [semiramis, semiramisAllies]
  - basmu-cursed-poison-dragonfire:
      categorizedAsNP: true          # explicit in the source
      scoping: { cooldown: np, damage: np, seal: np }
      cooldown: "3◈"
      phases:
        - kind: damage
          target:
            anchor: { kind: selfEdgeAdjacent, direction: chosen }
            shape: { kind: rect, w: 3, h: 3 }
            selection: { relations: [enemy], chooser: all }
          formula: { base: [{ unit: self, component: mag, factor: 1.0 }], multiplier: 3 }
        - kind: applyEffect
          target: reuse
          effects:
            - { id: poison }
            - { id: critDmDwn, duration: "1◈", magnitude: { base: -30 } }
```

Note `basmu-protection`: *"Enemy Units cannot Attack Semiramis or her allied Units if a Bašmu is
next to them."* A summon granting an aura that protects *other* units — the aura mechanism
(Ch. 11 §11.6) handles it without special-casing.

---

## 32.6 `[Semiramis' Poison]` — a transferable item granting a status

```
Item Construction — Rank: C
(Active) Roll a four-sided die; Semiramis creates that number of [Semiramis' Poison] Items.

Item: whenever Semiramis is standing directly next to an allied Unit, any number can be
passed from Semiramis to that Unit (once per Turn). Consume 1: the Unit gains 'Queen's Poison'
for 3◈ Turns (neither a buff nor a debuff, Unremovable):
  1. Chance of inflicting volatile debuffs +30%
  2. Chance of being inflicted by volatile debuffs −15%
  3. When the Unit performs a Normal Attack using BA(STR), Poison is inflicted at the end of
     the Damage Step, with a 50% chance of an additional Stage (this 50% is a flat chance not
     affected by debuff modifiers); then remove 'Queen's Poison' from the AU.
```

The item model (Ch. 15 §15.8) plus a status effect:

```yaml
item:
  id: semiramis-poison
  transferable: true
  transferRange: 1
  transfersPerTurn: 1
  transferFrom: [semiramis]
  consumeEffect:
    - kind: applyEffect
      target: self
      effects: [{ id: queensPoison, duration: "3◈" }]

effect:
  id: queensPoison
  polarity: status
  removability: { unremovable: true }
  rules:
    - { key: ApplicationChance, direction: outgoing, value: 30,
        predicate: ["effect:volatility:volatile"] }
    - { key: ApplicationChance, direction: incoming, value: -15,
        predicate: ["effect:volatility:volatile"] }
    - key: OnEvent
      event: damageStepEnd
      predicate: ["self:isAttacker", "attack:kind:normal", "attack:component:str"]
      then:
        - { key: ApplyEffect, target: victim, effect: { id: poison } }
        - { key: ApplyEffect, target: victim, effect: { id: poison },
            chance: 50, bypassChanceModifiers: true }
        - { key: RemoveEffect, target: self, selector: { kind: byId, ids: [queensPoison] } }
```

`bypassChanceModifiers: true` is the mechanism for the source's parenthetical — a flat 50% that
ignores the entire chance-modification system. Three effects in the game need it (`Terror`,
`Disorder`, this one), so it earns its place.

---

## 32.7 `Sikera Ušum` — two Noble Phantasms in one

```
1. If NOT summoned with DSC: affects the 5×5 area around her (which Moves with her) for 2◈.
2. If summoned with DSC: usable only within the Throne Room. Affects the Throne Room for 3◈,
   and all Units within when activated cannot leave while it is Active.

Effects of the NP area:
  a. Semiramis' BA(STR) Normal Attacks inflict Poison.
  b. A Unit other than Semiramis or her Master that Acts then ends its Turn inside is Poisoned.
  c. Units Poisoned inside take Poison damage at end of its Turn and at end of any Turn it
     Acts, in addition to at end of Round.
  d. Poison Immune inside is reduced to a 75% Poison Resist; existing Poison Resist is halved.
  e. Units weak to Poison take double Poison damage.
```

A **persistent zone with five rules**, one of which (d) *modifies the immunity system itself*
inside the area.

```yaml
phases:
  - kind: zone
    spec:
      conditional:
        - predicate: [{ not: "self:variant:dsc" }]
          shape: { kind: rect, w: 5, h: 5, anchor: self, follows: true }
          duration: "2◈"
        - predicate: ["self:variant:dsc"]
          requirements: [{ kind: inZone, zoneId: throneRoom }]
          shape: { kind: zone, zoneId: throneRoom }
          duration: "3◈"
          confinesOccupants: true
      rules:
        - { key: OnEvent, event: damageStepEnd,
            predicate: ["attacker:is:semiramis", "attack:kind:normal", "attack:component:str"],
            then: [{ key: ApplyEffect, target: victim, effect: { id: poison } }] }

        - { key: OnEvent, event: turnEnd,
            predicate: ["unit:acted", "unit:inZone:self",
                        { not: { anyOf: ["unit:is:semiramis", "unit:is:semiramisMaster"] } }],
            then: [{ key: ApplyEffect, target: unit, effect: { id: poison } }] }

        - { key: PeriodicOverride, effectId: poison,
            addTriggers: [unitTurnEnd, actedTurnEnd] }

        - { key: ImmunityDowngrade, effectId: poison,
            immuneBecomes: { resist: 75 }, resistMultiplier: 0.5 }

        - { key: VulnerabilityAmplifier, effectId: poison, factor: 2,
            predicate: ["unit:weakTo:poison"] }
```

Three new rule-element keys: `PeriodicOverride`, `ImmunityDowngrade`, `VulnerabilityAmplifier`.
All three are zone-scoped modifications of the effect system, and all three are general — any
future "field that changes how a status works inside it" uses them.

**Script elements needed: zero.**

---

## 32.8 Familiar: Doves

```
(Passive) Whenever Semiramis sees a Unit for the first time, the 'Dove' effect is applied
(neither buff nor debuff, Unremovable). Semiramis can see the position of all Units with 'Dove'
regardless of Fog of War (but the effect does not remove Fog of War for her).
(Active) Range=4. Hits a 3×3 area within Range. Inflicts Debuff ResDwn for ⅓◈ (+30% chance of
being inflicted); then reduce Semiramis' NP Cooldown by X, where X = number of enemy Units on
the board with 'Dove' (max 1◈).
```

The passive is a **vision-triggered permanent mark** that grants position-only visibility.

```yaml
- key: OnEvent
  event: unitFirstSeen
  predicate: ["self:is:semiramis"]
  then:
    - { key: ApplyEffect, target: seenUnit,
        effect: { id: dove, duration: permanent, polarity: status, unremovable: true } }

- key: RevealPosition
  scope: markedByDove
  revealsOnly: [position]
```

`unitFirstSeen` is a new event, fired by the vision system when a token enters a unit's sight
for the first time. `RevealPosition` renders a ghost marker for Semiramis's controller without
lifting fog — Foundry supports this by drawing on a custom layer rather than modifying the fog
texture.

The active's cooldown reduction reads the board:

```yaml
- kind: cooldown
  target: self
  changes:
    - ability: all
      scope: np
      delta: "-min(@count(enemies where effect:dove), ticksPerRound)"
```

`@count(...)` is a small aggregate in the expression language. Two abilities need it, so it is
worth the grammar addition.

---

## 32.9 Tally

| Mechanism | New engine support needed |
|---|---|
| Conditional class skill | `summonVariants` (declarative) |
| Six-source counter | `multiplyDice` helper; the `Gather` action kind |
| Channelled activation | Ch. 20 §20.4's channel kind |
| 9×9 platform with sub-zones | Ch. 20's platform model |
| Compound anchor (range + platform + below) | `anchor: compound` |
| Bound summon with a protective aura | none — existing mechanisms |
| Transferable item granting a status | none — existing mechanisms |
| Flat chance bypassing the modifier system | `bypassChanceModifiers` |
| Zone that rewrites immunity semantics | `ImmunityDowngrade`, `PeriodicOverride`, `VulnerabilityAmplifier` |
| Vision-triggered permanent mark | `unitFirstSeen` event, `RevealPosition` element |
| Territory Creation scope rewrite | `TerritoryCreationScope` — the one script-adjacent element |
| Board-size-dependent values | `*ByBoardSize` fields |

Eleven additions, ten of them general-purpose rule elements or declarative fields, one narrow.
For the most structurally demanding character in the reference set, that is a good ratio — and
every one of those additions is now available to future content.

---

## 32.10 Implementation notes

Semiramis is fully built and live-tested against a running world: every ability, Bašmu, and the
Hanging Gardens platform (activation through destruction's owner-effect reversal). Where the
actual build diverged from this chapter's illustrative pseudocode above:

- **No `anchor: compound`.** Dragon Wing Warriors' "Range 4 plus the area under the HGoB and the
  area of the HGoB" is authored as plain `withinRange` from the platform's own panel. A 9×9
  platform's Range-4 halo already overlaps its own footprint and the ground beneath it in every
  practical case, so the compound anchor's second and third terms never contribute anything a
  plain `withinRange` did not already cover.
- **No `TerritoryCreationScope`.** The EX/C scope split is ordinary `DamageModifier` + `Aura`
  pairs, each gated by an ordinary predicate (`self:variant:dsc`, `self:onPlatform:<id>`,
  `self:inHomeBase`) — the general predicate grammar already said what the script element would
  have said.
- **`singleInjuryRoll` is built.** Dragon Wing Warriors' repeat hits (`damage.repeat: {roll}`,
  Ch. 12's Combat Process) are each their own Combat Process and so each reach the Injury step —
  and each hit (50 Fixed damage) is individually well under the 100-damage threshold, so a naive
  "check the first hit only" reading would mean this NEVER rolls. `damage.singleInjuryRoll`
  (`engine/attack.mjs#applyInjury`) instead defers every process but the LAST to resolve its own
  damage step (same declaration, same defender), sums every sibling's damage, and performs one
  check against the total — "once, on the total", matching docs/12 §12.6's own reading. Live-
  verified against four defenders and ten hits each: one real Injury verdict per defender on the
  combined total, nine deferrals.
- **Summoning: Bašmu's summon branch is built.** One ability document, two branches
  (`targeting.branches`/`cooldown.branches`/`damage.branches`, first-match-wins the same way
  `field.branches` does below), selected by `self:onPlatform:hanging-gardens-of-babylon`. Needed
  `damage.branches` specifically because `isSpell: true` always routes through the attack path,
  which runs a real Combat Process against whoever the targeting resolves — herself, since
  `selection: {relations: [self]}` resolves self as a legitimate defender rather than an empty
  target list — and the summon branch deals no damage at all (`{fixed: true, base: {fixedValue:
  0}}`). Finding this live also surfaced a real, pre-existing bug: EMIYA's Thaumaturgy:
  Reinforcement and Tracing, both self-targeted Spells with no `damage:` block and their own
  `countsAsAttack: false`, were taking real self-damage from their own Base Attack on every use,
  because `classifyAbility`'s routing (as opposed to the separate `countsAsAttack()` budget check)
  never consulted that flag. Fixed at the root, not per-ability.
- **Sikera Ušum's Throne-Room branch is built.** `field.branches` picks geometry/duration/
  membership by the same predicate; `geometry.anchorRef: "platform"` anchors the field to the
  Hanging Gardens' own geometric centre rather than wherever aboard it she is standing
  (`rules/platforms.mjs#platformCentre`); `membership.trappedAtActivation` snapshots who was
  inside when the field opened (not a standing rule that would also trap a later arrival) and
  `rules/movement.mjs#canPassThrough` now actually asks Axis 2's `membershipVerdict` before a
  move, which nothing had ever done for *any* bounded field before this NP needed it.
- **Bašmu's platform tether is `boundToPlatformId`**, not `boundToZoneId`/`dismissOnZoneRemoval`:
  `engine/scene-levels.mjs#reverseOwnerEffects` already used that exact field name and dismisses
  unconditionally, which the sketch's separate `dismissOnZoneRemoval` flag would have duplicated.
- **The `hgobConstruction`→100 activation, the 3◈-Turn commitment, and the owner buff are real
  engine mechanisms now, not sketches**: the `channel` ability kind (`module/engine/channel.mjs`),
  `module/engine/hgob.mjs` (creates the platform actor, applies the owner buff, sets `zonExempt`,
  bumps `sustainabilityRemaining`), and `RankShift`'s `grades` field (Ch. 05 — a whole-grade shift
  is `Rank#stepGrade`, not `steps: 1`, which only ever walked the dense +/- ladder) all shipped as
  part of this build, along with fixes the platform surfaced in code that predates it: `board.zones`
  was never actually wired into `snapshotBoard` (Ch. 19's Home Base membership was `{}` for every
  unit, always), and `SummonData`/`PlatformData` had no `baseHealth`→`health.max` derivation at
  all (every Summon and every Platform built from content had 0 Health).

---

**Next:** [33 — Case Study: Mannanán mac Lir](33-case-mannanan.md)
