# 11 — The Effect Engine

> **Transfer and visibility (Ch. 45).** `transferEffect` moves an instance and **keeps its
> absolute expiry** — because durations are stored as absolute ticks, a transfer is a move rather
> than a re-application, which is what "duration maintained" means. The one adjustment is
> `pausedTicks`, rebased when one of the two has been Stopped. An Unremovable effect is never
> transferable, because a transfer removes before it applies.
>
> `visibilityOf` defaults by polarity, with one asymmetry worth stating: a **debuff is also
> visible to whoever inflicted it**. They applied it and already know what they applied, so
> telling them is not a leak.

> **Implemented (Ch. 45 A5, D1).** Auras (§11.6) are real: `module/rules/auras.mjs` expands each
> onto the units in range whose relation matches, and `snapshotBoard` runs the pass once every
> unit is projected. **Self-inclusion is correct** — "every allied unit" includes the unit itself
> unless the text says otherwise, which is why `relations` defaults to `["ally", "self"]`; the
> auras that exclude their bearer say so and drop `"self"`.
>
> The application-chance path (§11.2 step 3) is also live: `ApplicationChance` contributions now
> reach `applyEffect` through the target's snapshot. It previously read a `ctx.resist` that no
> caller supplied.
>
> Still open: Transfer (§11.8), and Visibility (§11.10) is collected-only.

Chapter 10 classified effects. This chapter specifies the runtime: how an effect instance is
represented, how it is applied, stacked, suppressed, ticked, expired, and removed.

---

## 11.1 Definition vs instance

Two distinct things, and conflating them is the first mistake to avoid.

**`EffectDefinition`** — the catalogue entry. Immutable, shared, authored once. `Atk Up` has
exactly one definition. Lives in a compendium, loaded into a registry at world start.

**`EffectInstance`** — one application of a definition to one unit, with a magnitude, a
duration, a source, and possibly a stage or use count. A unit may carry four `Atk Up` instances
from four sources.

```ts
interface EffectInstance {
  id: string;                       // ActiveEffect document id
  defId: string;                    // → EffectDefinition
  unitId: string;                   // bearer

  magnitude: Magnitude | null;      // {base, np?}
  stage: number;                    // Curse/Poison; 1 otherwise
  duration: Duration;               // Ch. 07 §7.4
  uses: number | null;

  source: {
    unitId: string;                 // who applied it
    abilityId: string | null;
    kind: "skill" | "np" | "attack" | "environment" | "self";
  };

  flags: {
    unremovable: boolean;
    suppressed: boolean;            // derived each pass
    hidden: boolean;                // closed-info play
  };

  payload: Record<string, unknown>; // per-definition extras (Shield hp, Repel value…)
}
```

Backed by a Foundry `ActiveEffect` with a `TypeDataModel` on `effect.system`. The ActiveEffect
gives us native `duration.start`, status icons, and transfer semantics; our `system` payload
gives us everything the core schema does not model.

**DECISION.** We do **not** use Foundry's `changes` array for our modifiers. Foundry's change
system applies `{key, mode, value}` against document paths, which cannot express predicated,
NP-scoped, ordered, suppressible modifiers. Our rule elements (Ch. 24) run in the derived-data
pass instead. `changes` stays empty except for a small number of purely-cosmetic token changes
(tint, size).

---

## 11.2 Application

The full pipeline for applying one effect to one target:

```
applyEffect(def, target, magnitude, duration, source, context) → ApplicationResult

 1. IMMUNITY GATE
    Does the target have an immunity that covers this definition?
      - (Name) Immune matching def.id
      - Debuff Immune (if polarity=debuff, and not terminal-unless-stated)
      - nv/v/Men/Off/Def Debuff Immune matching classification
      - No Buff (if polarity=buff)
    → BLOCKED, with the blocking effect named.

 2. REPLACEMENT / EXCLUSIVITY GATE
    - def.blocks lists ids the target already has that forbid this ⇒ BLOCKED
    - target has an effect whose `blocks` includes def.id ⇒ BLOCKED
    - mental exclusivity table (§10.5)
    - sleep-family state machine
    → BLOCKED or → REPLACE (remove the old, carry duration per rule)

 3. CHANCE ROLL
    finalChance = base
                + inflicter modifiers (Debuff ChUp, Item Construction, Queen's Poison…)
                − target modifiers (Debuff ResUp, Magic Resistance, Item Construction,
                                    Master essence, Self-Suggestion…)
    terminal ladder applied if def is Instakill/Death/Erase
    roll d100; ≥ finalChance ⇒ RESISTED
    (skipped entirely if finalChance ≥ 100 and no roll is needed — but the roll is still
     logged as automatic, for audit)

 4. PREVENTION WINDOW
    If RESISTED-fail and the target may use `Luck Check: Prevention`,
    offer it (once per Combat Process, not for terminal effects).
    → may convert FAIL into BLOCKED.

 5. STACKING RESOLUTION
    Consult def.stacking against existing instances of the same defId:
      NONE_NO_REFRESH  → no-op if present
      NONE_REFRESH     → extend/replace duration
      STAGE            → increment stage
      MAGNITUDE_STACKS → add a second instance
      HIGHEST_ONLY     → keep the larger magnitude
      COUNT            → increment uses
    → produces zero or one create/update operation.

 6. CONSTRUCT
    Resolve duration TickExpr → absolute expiry using the target's local clock.
    Build the EffectInstance.

 7. EMIT INTENT
    { t: "applyEffect", unitId, effect, sourceId }
```

Every step is logged with its outcome, so the chat card can say *"Curse resisted (rolled 78 vs
65%)"* or *"Charm blocked by Berserk"*.

### Buff application chance

Buffs have a chance too, though it is 100% by default. `Buff ChUp` (applier side) and
`Buff Up`/`Buff Down` (recipient side) modify it. `No Buff` blocks outright, and the source is
explicit about the multi-buff case:

> *"If a single effect that applies multiple buffs is used on a Unit with No Buff, **all** of
> those buffs will fail to be applied."*

So `No Buff` is checked once per applying ability, not per buff, and blocks the whole batch.

---

## 11.3 Stacking rules

```ts
type StackingRule =
  | { rule: "noneNoRefresh" }        // default for debuffs
  | { rule: "noneRefresh" }          // reapplication extends
  | { rule: "noneExtend" }           // Webbed: duration is summed
  | { rule: "stage"; max?: number }  // Curse, Poison
  | { rule: "magnitudeStacks" }      // multiple instances coexist and sum
  | { rule: "highestOnly" }          // Territory Creation, Item Construction
  | { rule: "count" };               // "N times" buffs
```

### `noneNoRefresh` — the default

*"Does not stack and will not reset the duration if reapplied unless stated."* Reapplication is
a **no-op**. Applies to almost every volatile and mental debuff.

### `stage`

`Curse` and `Poison`. Reapplication increments `stage`. The damage formula reads stage:

```ts
curseDamage  = (stage) => 25 * stage;                 // linear
poisonDamage = (stage) => 20 * Math.pow(2, stage-1);  // exponential
```

Van Gogh's *Imaginary Numbers Arts* inflicts *"Curse on herself, 3 times"* — three separate
stage increments in one application, so the application loop runs three times with three
independent resistance rolls (which for a self-application at 500% chance always succeed).

### `highestOnly`

The source states it for two class skills:
> *"If there are multiple allied Units with this Skill, only the Territory Creation with the
> **highest Rank** takes effect."*
> *"If a Unit is affected by multiple instances of this Skill, only the Item Construction with
> the **highest Rank** takes effect."*

Note these compare **rank**, not magnitude. So `highestOnly` needs a comparison key:

```yaml
stacking: { rule: highestOnly, compareBy: sourceRank }
```

These are also **auras**, not applied effects — the recipient does not carry an Item
Construction effect; the rule element on the source affects nearby units. So `highestOnly`
resolution happens during aura collection, not during application. §11.6.

### `magnitudeStacks`

Multiple instances coexist and their contributions sum. `Atk Up` from three sources gives
three instances. This is the default for buffs.

Explicit non-stacking buffs, called out individually in the source: `Dodge`, `Invuln`, `Aim`,
`Pierce`, `Anti-Purge`, `Substitution`, `STR Reflect`, `MAG Reflect`, `Guts`, `Debuff Immune`
and all its variants, `Decoy`, `NP Seal`, `Skill Seal`. These use `noneRefresh`.

### `count`

`Debuff Immune for 1◈ Turns, 1 time`. Both a duration and a use count; whichever runs out
first ends it. Consumption is per-Attack (Ch. 07 §7.5).

Kingprotea's `NP DmUp (GAO)` is the extreme case: applied N times where N = her Proliferation
stocks, each a separate removable buff, decaying one per turn she Acts. That is
`magnitudeStacks` with a per-instance decay trigger — not `count`.

---

## 11.4 Suppression

Suppression is *"this effect exists but does nothing right now"*. It is distinct from removal
and from expiry, and it is what makes `Petrify`, `Pigify`, `Toad`, and `Addle` implementable.

```ts
interface SuppressionRule {
  id: string;
  predicate: Predicate;                    // when this suppressor is active
  suppresses: SuppressionSelector;
}

type SuppressionSelector =
  | { kind: "allEffects" }                        // Petrify
  | { kind: "passiveAbilityEffects" }             // Pigify, Toad
  | { kind: "automaticEffects" }                  // Addle
  | { kind: "byFamily"; families: string[] }
  | { kind: "byId"; ids: string[] };
```

The four suppressors in the reference set:

| Suppressor | Suppresses | Source text |
|---|---|---|
| `Petrify` | all buffs, debuffs, other effects on the unit | *"Buffs, debuffs, and other effects have no effect on a Petrified Unit."* |
| `Pigify` | passive effects of Skills/NP | *"Passive effects of Skills/NP have their effect negated for the duration."* |
| `Toad` | passive effects of Skills/NP | same |
| `Addle` | automatically-activating skills and effects | *"Negates all Skills and effects which activate automatically."* |

Suppression is evaluated **once per derived-data pass**, before modifier collection:

```ts
function evaluateSuppression(unit: UnitSnapshot): void {
  const suppressors = unit.effects.filter(e => defOf(e).suppression);
  for (const eff of unit.effects) {
    eff.flags.suppressed = suppressors.some(s =>
      matches(defOf(s).suppression.suppresses, eff) && !isSelf(s, eff));
  }
}
```

A suppressor never suppresses itself (`!isSelf`), or `Petrify` would immediately disable
`Petrify`. This is a real bug class and the guard is not optional.

**Ordering question:** does `Petrify` suppress `Pigify`, which then un-suppresses passives?
`Petrify` suppresses *"buffs, debuffs, and other effects"* — Pigify is a debuff, so yes, and
the passives come back. **DECISION.** Suppression is evaluated to a **fixed point**: iterate
until the suppressed set stops changing, with a cycle guard. In practice one or two iterations.
Documented, and property-tested for termination.

**RISK.** Fixed-point suppression can oscillate (A suppresses B, B suppresses A). The guard
detects a repeated state and resolves by suppressor priority (`Petrify` highest), logging a
warning. No such pair exists in the current catalogue.

---

## 11.5 The effect lifecycle

```
                    apply()
                       │
                       ▼
              ┌─────────────────┐
              │    PENDING      │  chance roll, prevention window
              └────────┬────────┘
             blocked / resisted │ succeeded
              ┌────────┘        ▼
              ▼          ┌─────────────┐
        ┌──────────┐     │   ACTIVE    │◀──────┐
        │ REJECTED │     └──┬───┬───┬──┘       │
        └──────────┘        │   │   │          │ un-suppress
                            │   │   └──────────┤
              suppressor on │   │              │
                            ▼   │        ┌─────┴──────┐
                    ┌────────────┐       │ SUPPRESSED │
                    │ SUPPRESSED │───────┘            │
                    └────────────┘                    │
                            │                          │
      duration expires ─────┼──── uses exhausted ──────┤
      cure / dispel   ──────┤                          │
      replaced        ──────┤                          │
                            ▼                          │
                    ┌──────────────┐                   │
                    │   REMOVED    │───────────────────┘
                    └──────────────┘
```

Suppressed effects still **tick their duration**. The source does not say otherwise, and
`Stop` — which explicitly freezes durations — is a separate mechanism, implying that ordinary
suppression does not.

---

## 11.6 Auras

An **aura** is a rule element on unit A that affects units within a radius, without applying an
effect to them. This is architecturally distinct from an applied effect and the difference
matters.

Auras in the reference set:

| Aura | Radius | Effect |
|---|---|---|
| Item Construction | 2 | ±X% debuff inflict/resist for allies |
| Territory Creation | (whole home base) | damage bonus in base; damage reduction for allies in base |
| `Area CritUp` | ability-defined | crit chance for allies in radius |
| Penthesilea's *Charisma* passive | 2 | +20 flat damage for **other** allies |
| Kiritsugu's *Affection of the Holy Grail* passive | 2 | +4 to Luck Check rolls for everyone **except himself** |
| Bašmu's protection | 1 | enemies cannot attack Semiramis or allies adjacent to Bašmu |
| Master protection | 2 | Master cannot be targeted |
| `Decoy` | max(3, enemy range) | movement and target constraints on enemies |

Why they must not be applied effects:

1. **Leaving the radius must remove the benefit instantly.** An applied effect would need a
   position-watcher to remove it, which is a write on every move — expensive and racy.
2. **`highestOnly` resolution is global.** "Only the highest-rank Territory Creation takes
   effect" requires comparing all sources at evaluation time, which is natural for auras and
   awkward for applied instances.
3. **They should not be dispellable.** Dispelling an ally's aura contribution from *your* unit
   makes no sense; the aura lives on its source.

**DECISION.** Auras are rule elements with a `range` field, collected during the *recipient's*
derived-data pass by querying nearby units:

```ts
function collectAuras(unit: UnitSnapshot, board: BoardSnapshot): RuleElement[] {
  const out: RuleElement[] = [];
  for (const other of board.units.values()) {
    if (other.id === unit.id && !auraIncludesSelf(other)) continue;
    for (const re of other.ruleElements) {
      if (!re.aura) continue;
      if (chebyshev(unit.position, other.position) > re.aura.radius) continue;
      if (!relationMatches(re.aura.relations, relation(other, unit))) continue;
      out.push(bindAura(re, other, unit));
    }
  }
  return dedupeByHighest(out);
}
```

**RISK.** This is O(units × rules) per derived-data pass. With 28 units × ~40 rules, that is
~1,100 checks per unit, ~31,000 per full board pass. At 60 fps that would be unacceptable;
derived data does not run at 60 fps. It runs on document change. Mitigations: a spatial index
(units bucketed by panel region, so only nearby units are scanned), an `anyAuras` early-out
per unit, and memoization keyed on `(unitPosition, boardVersion)`. Budgeted at ≤4 ms for a full
board pass; measured in Ch. 38.

---

## 11.7 Removal

Four removal reasons, with different rules:

```ts
type RemovalReason = "expire" | "cure" | "dispel" | "replace" | "consume" | "manual";
```

| Reason | Blocked by `unremovable`? | Blocked by `Buff Removal ResUp`? |
|---|---|---|
| `expire` (duration ran out) | **No** — *"An Unremovable buff/debuff/effect can still Expire"* | **No** — *"Does not affect natural expiration"* |
| `cure` (debuff removal effect) | Yes | n/a |
| `dispel` (buff removal effect) | Yes | Yes (chance-based) |
| `replace` (Seared over Burn) | Declared per rule | No |
| `consume` (uses exhausted, Guts triggered) | No | No |
| `manual` (GM) | No | No |

### Which effect gets removed?

> *"Whenever an effect removes buff or debuff from a Unit, and the effect specifies the number
> of buffs/debuffs removed, it removes the **latest** buff/debuff. However, if it removes a
> **random** buff/debuff, assign a number to each and roll a die to determine."*

So "remove 1 buff" is LIFO by application time, and "remove a random buff" is a genuine
uniform roll. Two different selectors, both needed:

```ts
type RemovalSelector =
  | { kind: "latest"; count: number }
  | { kind: "random"; count: number }
  | { kind: "byId"; ids: string[] }
  | { kind: "byFamily"; families: string[]; count?: number }
  | { kind: "all" }
  | { kind: "allExcept"; ids: string[] };
```

Kiritsugu's *Lethal Gunfire Suppression* uses `latest 1` (*"remove 1 buff from the DU at the
start of the Damage Step"*). Command Spell *Cure Servant* uses
`all` with unremovables excluded.

Statuses (polarity `status`) are never in the candidate set for `cure` or `dispel`, and never
counted by "remove N buffs".

### Home base cure

> *"If a Unit affected by debuffs remains in its Home Base for 3 full Rounds, it is cured of all
> debuffs at the end of the Round excluding Unremovable debuffs unless stated."*

A `cure` with `allExcept: unremovables`, triggered by the residency counter (Ch. 07 §7.7).

---

## 11.8 Transfer

> **Keyword: Transfer.** *"If an effect states to 'transfer a buff from the DU to the AU/this
> Unit', it means the buff is removed from the DU and applied to the AU instead, with the
> duration being maintained."*

Duration is **preserved absolutely**, not restarted. Since we store absolute expiry turns
(Ch. 07 D7.3), transfer is trivial: move the instance, keep `expiryTurn`. If the recipient has
a different `pausedTicks` (one of them has been Stopped), the expiry is rebased:

```ts
newExpiry = oldExpiry - source.pausedTicks + target.pausedTicks;
```

Van Gogh's *Shadow of Longing* is the reference case, and it is a transfer of *debuffs*, not
buffs:

> *"Remove all Curse debuffs from **all** Units within a 3 panel area of Gogh, then apply them
> to herself (apply all stages of Curse accordingly, if any affected Unit has more than one
> stage of Curse)."*

So stages sum. If three units carry Curse stages 2, 1, and 4, Van Gogh gains 7 stages. Transfer
of a `stage`-stacking effect adds stages rather than creating multiple instances.

---

## 11.9 Periodic ticking

Effects with a `PeriodicSpec` (Ch. 07 §7.4) fire at their declared triggers.

```ts
interface PeriodicSpec {
  interval: TickExpr;                    // "⅓◈", "1 turn", "round"
  on: Set<"turnEnd"|"roundEnd"|"unitTurnEnd"|"actedTurnEnd"|"turnStart">;
  skipFinalTurn: boolean;
  action: PeriodicAction;
}
```

The catalogue's periodic effects:

| Effect | Interval | Trigger | Action |
|---|---|---|---|
| `Curse` | ⅓◈ | turnEnd | 25 × stage curse damage |
| `Poison` | — | roundEnd | 20 × 2^(stage−1) poison damage |
| `Burn` | — | roundEnd | 50 burn damage |
| `Freeze` | — | roundEnd | 100 ice damage |
| `Crystalfreeze` | — | roundEnd | 100 fixed damage |
| `Crystallize` | — | actedTurnEnd | 50 fixed damage |
| `Sap/Bleed` | — | unitTurnEnd + actedTurnEnd | 50 health loss |
| `Nightmare` | — | unitTurnEnd | 10% of current health loss |
| `Drowning` | — | unitTurnEnd + actedTurnEnd | 50 health loss |
| `Regen` | per spec | per spec | heal |
| `NP Regen` | per spec | turnEnd | cooldown −N |
| `Terror` | — | turnEnd | 50% chance of Stun 1◈, then Terror removed |
| `Disorder` | — | turnStart | 50% chance of Skill Seal for the turn |
| `Shock` | — | turnStart | d6; on 3 or 4, cannot act this turn |
| `NP DmUp (GAO)` | — | unitTurnEnd + actedTurnEnd | remove one instance |
| Mad Enhancement | — | actedTurnEnd | Master loses X health |

Note `Sap/Bleed` and `Drowning` fire on **both** `unitTurnEnd` and `actedTurnEnd`, which
collapse to one firing when the unit acted on its own turn (dedup by `(instanceId, globalTurn)`
— Ch. 07 §7.4).

`Terror` and `Disorder` are notable because their probability is explicitly **not** modified by
debuff chance effects: *"The Stun inflicting chance of Terror is not affected by effects that
affect chance of inflicting and being inflicted with debuffs."* So the inner application skips
step 3 of §11.2 and rolls flat.

---

## 11.10 Effect visibility in closed-info play

Per the rulebook's Closed Info rules, a player learns:
- effects applied **to their own units**, and only those;
- that a skill was used, but not what it did, unless announced.

```ts
interface EffectVisibility {
  visibleTo: "all" | "owner" | "faction" | "gm";
}
```

Default by polarity:
- Debuffs on a unit → visible to that unit's owner and the GM. The *inflicter* also sees them
  (they applied them and know what they applied).
- Buffs on a unit → visible to that unit's owner and the GM only.
- Statuses like active Presence Concealment → visible to owner and GM; other players do not
  even see the token.

The token status-icon layer respects this: a client renders only effects it may see. Since
`ActiveEffect` documents are embedded in the Actor, and the Actor's ownership already gates
visibility, this falls out of Foundry's permission model for owned actors — but **not** for
unowned ones, where the client receives the full actor data.

**RISK.** In closed-info games, a player's client holds the full data of enemy actors it can
see on the canvas. Foundry cannot hide embedded documents on a visible actor. Full mitigation
requires enemy actors to be `LIMITED` or `NONE` ownership with a GM-maintained "shadow" actor
carrying only public data. Chapter 26 specifies this pattern and its costs. Open-info play is
the default and has no such issue.

---

## 11.11 The effect registry

At world init, all `EffectDefinition` documents are loaded from the compendium into a registry:

```ts
class EffectRegistry {
  get(id: string): EffectDefinition;               // throws on unknown — fail loud (P4)
  byFamily(family: string): EffectDefinition[];
  validate(): ValidationReport;                    // run at init in dev mode
}
```

`get()` throwing on an unknown id is deliberate (principle P4). A skill referencing a typo'd
effect id should crash visibly with the offending ability named, not silently apply nothing.

The registry is also what the sheet's effect-picker and the GM's manual-apply dialog read, so
there is one source of truth for "what effects exist".

---

## 11.12 Worked example — Van Gogh's *Het Gele Huis* (skill form)

```
Affects all enemy Units within a 5×5 panel area in any non-diagonal direction next to Gogh:
  1. 150% chance of Def Dwn for 1◈, +10% damage taken
  2. Def Dwn (C) for 1◈, +20% damage taken, Agility −1 when successfully attacked
Then, all allied Units within 2 panels of herself:
  1. Evade for 1◈, 1 time
  2. Regen for 1◈+½◈, 5% of max at unit turn end / acted turn end / round end
  3. 500% chance of Curse
```

At 3 turns/round, with two enemies (E1 with 20% Debuff ResUp, E2 with none) and Van Gogh plus
one ally in radius:

```
PHASE 1 — enemies
  E1: Def Dwn      chance 150 + 0 (Gogh's Item Construction B- gives +35 to HER inflicts)
                          = 185 − 20 (E1's ResUp) = 165 ⇒ auto-apply
      Def Dwn (C)  separate roll, same maths ⇒ auto-apply
  E2: same, no resistance ⇒ auto-apply
  → 4 independent resistance evaluations (2 units × 2 debuffs)

PHASE 2 — allies (relations [ally, self] ⇒ INCLUDES Van Gogh)
  Van Gogh: Evade (1◈=3 ticks, 1 use), Regen (1◈+½◈ = 3+2 = 5 ticks), Curse
  Ally:     same three
  → Curse at 500% − ally's resistance ⇒ auto-apply, stage +1 each

INTENTS
  applyEffect ×2 on E1, ×2 on E2, ×3 on Van Gogh, ×3 on ally  = 10
  cooldown set on hetGeleHuis: 4◈−⅓◈ = 12−1 = 11 ticks
  turnBudget: Van Gogh counted as having Acted
```

Every number in that trace comes from data, not code. That is the target.

---

## 11.13 Summary of decisions

| # | Decision |
|---|---|
| D11.1 | Definition and instance are separate types; instances are `ActiveEffect` documents with a typed `system` payload. |
| D11.2 | Foundry's `changes` array is not used for rules modifiers; rule elements run in derived data instead. |
| D11.3 | Auras are rule elements queried by the recipient, never applied effects. |
| D11.4 | Suppression is a separate mechanism from removal, evaluated to a fixed point with a self-guard and a cycle guard. |
| D11.5 | Suppressed effects continue to tick their duration; only `Stop` freezes durations. |
| D11.6 | `unremovable` blocks cure/dispel but never expiry or consumption. |
| D11.7 | "Remove N buffs" is LIFO; "remove a random buff" is a real roll. Statuses are never candidates. |
| D11.8 | Transfer preserves absolute expiry, rebasing for `pausedTicks` differences; stage-stacking transfers sum stages. |
| D11.9 | The effect registry throws on unknown ids rather than degrading silently. |

---

**Next:** [12 — The Combat Process](12-combat-process.md)
