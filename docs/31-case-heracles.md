# 31 — Case Study: Heracles

Heracles is the acceptance test for the **defeat and revival subsystem**. He carries four
distinct revival mechanisms with an explicit priority chain, a permanent Mad Enhancement that
cannot be deactivated, and a Noble Phantasm that *records the attacks that killed him* so they
can never kill him again. Nothing else in the reference set stresses `onDefeat` this hard.

---

## 31.1 The sheet

```
True Name: Heracles           Region: Greece        Alignment: Chaotic Mad
STR A+   END A   AGI A   MAG B   LUC A
Attributes: Male, Servant, [Earth], Humanoid
Base Health 1500   MOV 6   Range 1 panel, 1 target
BA(STR) 160   BA(MAG) 175   Sustainability 2◈
```

Six abilities: Mad Enhancement B (permanent), Divinity A, Battle Continuation A, Indomitable A,
Bravery A+, Eye of the Mind (False) B, plus two Noble Phantasms — God Hand B (passive) and
Nine Lives A+.

---

## 31.2 The revival chain

The sheet states the priority explicitly:

> *"The priority of revival effects in Herc are as follows: Undying > normal Guts > Battle
> Continuation > God Hand"*

which specialises the general rule from the status-effects document:

> *"Special Guts/Other revival buffs > Guts > Passive revival effects"*

Four mechanisms:

| # | Source | Trigger | Restores | Limit |
|---|---|---|---|---|
| 1 | `Undying` (from *Indomitable*) | defeat | 25% of Max Health | 1◈+⅔◈ duration; consumed on use; stacks with other Guts but not itself |
| 2 | generic `Guts` | defeat | per the applying effect | consumed on use |
| 3 | Battle Continuation A | defeat | `5d20` | Cooldown 3◈, **and** health must have exceeded 50% of max since the last use |
| 4 | God Hand B | health reduced to 0 | `10d20` | **11 uses total** |

### The design

```ts
interface RevivalSource {
  id: string;
  priority: number;              // higher wins
  available(unit, ctx): boolean;
  restore(unit, ctx): { health: number; agility?: number; luck?: number };
  consume(unit): Intent[];
  consumesOnUse: boolean;
}
```

Revival sources are *queried*, not hardcoded. The defeat handler:

```js
async function resolveDefeat(unit, ctx) {
  const sources = collectRevivalSources(unit)          // from effects and abilities
    .filter(s => s.available(unit, ctx))
    .sort((a, b) => b.priority - a.priority);

  if (!sources.length) return [{ t: "defeat", unitId: unit.id, cause: ctx.cause }];

  const src = sources[0];
  const restored = src.restore(unit, ctx);
  return [
    ...src.consume(unit),
    { t: "statDelta", unitId: unit.id, stat: "health", delta: restored.health, clamp: true },
    { t: "log", entry: { kind: "revival", source: src.id, restored } },
  ];
}
```

Priorities: `Undying` 300, generic `Guts` 200, `Battle Continuation` 100, `God Hand` 50.
Content declares them; the engine never names Heracles.

### The two conditions on Battle Continuation

> *"Cooldown: 3◈ Turns, **and** the Unit's Health must have been restored back to above half its
> maximum value at least once since the last activation."*

The second condition needs a flag that the health system maintains:

```yaml
- key: OnEvent
  event: healthChanged
  predicate: [{ gte: ["@self.health.value", "@self.health.max * 0.5"] }]
  then:
    - { key: SetFlag, flag: battleContinuationRearmed, value: true }
```

and `available()` checks both the cooldown and the flag, clearing the flag on use. A small
piece of authored state rather than engine support.

---

## 31.3 God Hand — the hard part

```
(Passive 1) Whenever Heracles' Health is reduced to 0, roll ten twenty-sided dice, and
restore his Health by the number rolled. If the damage of the Attack that defeated Heracles
exceeds his current Health, the excess damage is reduced from his newly restored Health, and
so on. Can only be used 11 times.

(Passive 2) Whenever an Attack reduces Heracles' Health to 0 for the first time, record that
Attack under this Skill. These recorded Attacks can no longer defeat Heracles — whenever a
recorded Attack would reduce his Health to 0, his Health will remain at 1 instead.
```

Two mechanics, both unusual.

### Passive 1 — cascading overkill

The excess damage carries into the restored health, and *"and so on"* — so a single very large
attack can burn multiple God Hand charges in one resolution.

```js
function godHandAbsorb(unit, incomingDamage, charges) {
  let remaining = incomingDamage - unit.health.value;    // overkill after reaching 0
  let health = 0;
  let used = 0;

  while (remaining > 0 && charges - used > 0) {
    const restored = rollSum("10d20");
    used++;
    if (restored > remaining) { health = restored - remaining; remaining = 0; }
    else                      { remaining -= restored; }
  }
  return { health, chargesUsed: used, defeated: remaining > 0 && charges - used <= 0 };
}
```

A 4,000-damage hit against Heracles at 1,500 health: 2,500 overkill, absorbed by roughly
2–3 charges at an average of 105 per roll. So a single Noble Phantasm can eat a quarter of
God Hand.

**RISK.** The loop is unbounded in principle. Bounded in practice by `charges` (≤ 11), so at
most 11 iterations. Guarded anyway.

### Passive 2 — recording attack identity

*"Record that Attack"*. What identifies an "Attack"?

Three candidate readings:

| Reading | Consequence |
|---|---|
| (a) The specific ability | Karna's *Brahmastra Kundala* can never kill him again, but *Vasavi Shakti* can |
| (b) The attacking unit | Karna can never kill him again, by any means |
| (c) The specific instance | Meaningless — an instance never recurs |

(c) is vacuous, (b) is extraordinarily strong. **DECISION.** Reading **(a)**: the ability
identity, plus `"normalAttack"` as a pseudo-ability id per attacker. So Karna's normal attacks
become non-lethal to Heracles after one kill, but his three Noble Phantasms each get their own
chance. Recorded in Ch. 41.

```yaml
id: heracles-god-hand
isNP: true
source: np
hasPassive: true
hasActive: false
passiveRules:
  - key: RevivalSource
    priority: 50
    charges: 11
    restore: { formula: "10d20", cascading: true }

  - key: OnEvent
    event: healthReachedZero
    then:
      - key: RecordAttackIdentity
        set: godHandRecorded
        identity: "@ctx.attack.abilityId ?? ('normal:' + @ctx.attacker.id)"

  - key: DamageNegation
    mode: floorAtOne
    predicate:
      - { in: ["@ctx.attack.identity", "@self.flags.godHandRecorded"] }
```

`RecordAttackIdentity` and the `floorAtOne` negation mode are the only two additions needed, and
both are general — `floorAtOne` is also how `Endure` works.

The recorded set is a `SetField` on the ability item, so it persists and is visible on the sheet:

```
God Hand: Twelve Labors                    Rank B · NP · Passive
  Charges: 7 / 11
  Recorded attacks (4):
    Karna — normal attack
    Karna — Vasavi Shakti
    Scáthach — Gáe Bolg Alternative
    Semiramis — Aerial Garden of Vanity
```

Showing this on the sheet is not decoration: it is tactical information the opponent's player
also needs, and in an open-info game it changes their plan.

---

## 31.4 Permanent Mad Enhancement

> *"(Passive) Constantly Active. Cannot be deactivated."*

followed by the standard Mad Enhancement text with an active-use description, and then:

> *"Mad Enhancement can be deactivated for 1◈ Turns by spending a Command Spell (it will
> reactivate if the aforementioned conditions are still met after those 1◈ Turns)."*

So it is a **mode that starts active, cannot be toggled by the player, and can be suppressed by
a Command Spell for a fixed window**. The mode model (Ch. 15 §15.6) handles it:

```yaml
mode:
  isMode: true
  active: true                    # starts active
  cannotDeactivate: true
  minDuration: null
  suppressibleBy: { commandSpell: deactivateMadEnhancement, duration: "1◈" }
```

And the health-drain clause differs from the generic skill:

> *"This Servant's Master loses 20 Health at the end of every Turn it Acts; its Master's Health
> **cannot drop below 20** in this way."*

Compare the generic version: *"when its Health is X or less, ME is forcibly deactivated."*
Heracles's cannot deactivate, so instead the drain floors at 20. Same shape as Penthesilea's,
different from Kingprotea's and Castor's.

```yaml
- key: OnEvent
  event: actedTurnEnd
  predicate: ["self:mode:madEnhancement"]
  then:
    - key: StatDelta
      target: contractedMaster
      stat: health
      delta: -20
      floor: 20                   # cannot drop below 20 via this effect
      kind: loss                  # not damage (Ch. 06 §6.2)
```

The `floor` parameter on `StatDelta` is the generalization; three Servants need it.

---

## 31.5 Bravery and the Mad Enhancement interaction

> *"Note: Bravery cannot be used and has no effects when Mad Enhancement is Active."*

Since Heracles's Mad Enhancement is *always* active, Bravery is *always* dead — unless a Command
Spell suppresses ME for 1◈.

That is not a bug in the character; it is a deliberate cost/benefit. But it means the sheet must
show Bravery as disabled with the reason, or players will assume it is broken:

```
🛡 Bravery                                Rank A+   [ USE ]  ← disabled
   ✕ Has no effect while Mad Enhancement is Active
     (Heracles's Mad Enhancement cannot be deactivated — spend a Command
      Spell to suppress it for 1◈)
```

```yaml
blockedWhen:
  - { predicate: ["self:mode:madEnhancement"],
      reason: "FGT.Block.BraveryVsMadEnhancement" }
suppressedWhen:
  - { predicate: ["self:mode:madEnhancement"] }
```

`blockedWhen` gates the active use; `suppressedWhen` disables the passive (Mental debuff
resistance −50%). Both needed, because the ability has both.

---

## 31.6 Eye of the Mind (False)

```
(Passive) Upon a successful Evade, reduce the Cooldown of this Skill by ⅓◈ Turns.
(Active) Used at the start of a Combat Process when Attacked. Applies Dodge to Heracles for
⅔◈ Turns, and applies Crit DmUp for 1◈ Turns, Crit Damage dealt is increased by 35%.
Cooldown: 4◈ Turns.
```

Three things worth noting:

1. **`whenAttacked` timing window** — used reactively, at `combatProcessStart`. So it appears as
   an option on the reaction prompt (Ch. 27 §27.8), alongside Evade/Block/Nothing.
2. **`Dodge` for ⅔◈** — automatic successful evade, which interacts with Mad Enhancement's
   "can only Evade with Evade−" clause. `Dodge` supersedes the roll entirely
   (Ch. 12 §12.4), so ME's restriction becomes irrelevant while Dodge is up. Correct and
   valuable.
3. **Self-reducing cooldown on successful evade** — including evades granted by its own Dodge.
   So using it can accelerate its own return. An intentional feedback loop.

```yaml
- key: OnEvent
  event: evadeSucceeded
  predicate: ["self:isDefender"]
  then:
    - { key: CooldownDelta, ability: self, delta: "-⅓◈" }
```

---

## 31.7 The full conversion

```yaml
id: heracles
name: Heracles
type: servant
system:
  servantClasses: [berserker]
  alignment: { order: chaotic, morality: mad }
  region: [greece]
  attributes: [male, servant, earth, humanoid]
  parameters:
    base: { str: "A+", end: "A", agi: "A", mag: "B", luc: "A" }
  baseHealthOverride: 1500
  mov: 6
  range: { panels: 1, targets: 1 }
  baseAttack: { str: 160, mag: 175 }
  normalAttack: { mode: fixed, component: str }
  sustainability: { base: "2◈" }

abilities:
  - class-mad-enhancement:
      rank: B
      mode: { isMode: true, active: true, cannotDeactivate: true }
      overrides:
        masterDrain: { amount: 20, floor: 20 }
        damageTaken: { value: -40, npValue: -20 }
        damageDealt: { value: 60, magValue: 30 }
        mov: +2
        range: +1
        zon: +2
        sustainabilityPenalty: "-2◈"
        forceEvadeTable: unfavourable

  - divinity: { rank: A, flatDamage: 50 }

  - class-battle-continuation:
      rank: A
      flatReduction: { formula: "2d10+20", npDiceDoubled: true }
      revival: { priority: 100, formula: "5d20", cooldown: "3◈",
                 requiresRearm: { stat: health, aboveFraction: 0.5 } }

  - heracles-indomitable:
      rank: A
      cooldown: "4◈"
      phases:
        - kind: applyEffect
          target: self
          effects:
            - id: undying
              duration: "1◈+⅔◈"
              revival: { priority: 300, percentOfMax: 25 }
              stacksWithGuts: true
            - id: indomitable
              duration: "1◈+⅔◈"
              rules:
                - key: OnEvent
                  event: revived
                  then:
                    - { key: ApplyEffect, target: self,
                        effect: { id: atkUp, duration: "1◈+⅔◈",
                                  magnitude: { base: 30, np: 20 } } }

  - heracles-bravery:
      rank: "A+"
      cooldown: "4◈-⅓◈"
      blockedWhen: [{ predicate: ["self:mode:madEnhancement"] }]
      suppressedWhen: [{ predicate: ["self:mode:madEnhancement"] }]
      passiveRules:
        - { key: ApplicationChance, direction: incoming, value: -50,
            predicate: ["effect:category:mental"] }
      phases:
        - kind: applyEffect
          target: self
          effects: [{ id: atkUpStr, duration: "1◈", magnitude: { base: 25, np: 15 } }]

  - heracles-eye-of-the-mind-false:
      rank: B
      timing: { window: combatProcessStart, appliesTo: [whenAttacked] }
      cooldown: "4◈"
      passiveRules:
        - { key: OnEvent, event: evadeSucceeded, predicate: ["self:isDefender"],
            then: [{ key: CooldownDelta, ability: self, delta: "-⅓◈" }] }
      phases:
        - kind: applyEffect
          target: self
          effects:
            - { id: dodge, duration: "⅔◈" }
            - { id: critDmUp, duration: "1◈", magnitude: { base: 35 } }

  - heracles-god-hand: (see §31.3)

  - heracles-nine-lives:
      name: "Nine Lives: Shooting the Hundred Heads"
      rank: "A+"
      isNP: true
      cooldown: "7◈+⅓◈"
      countsAsAttack: true
      phases:
        - kind: damage
          target:
            anchor: { kind: withinRange, range: { metric: attackRange, panels: "@self.range" } }
            shape: { kind: unit }
            selection: { relations: [enemy], chooser: chosen, count: 1 }
          formula:
            base: [{ unit: self, component: str, factor: 1.0 }]
            multiplier: 4
            flat: 100
        - kind: applyEffect
          target: reuse
          effects: [{ id: defDwn, duration: "1◈", magnitude: { base: 30 } }]
```

**Script elements needed: zero.** God Hand's two passives needed two new rule-element keys
(`RevivalSource` with cascading restore, and `RecordAttackIdentity`), both general enough to
belong in the catalogue.

---

## 31.8 What Heracles proved

| Requirement surfaced | Where it landed |
|---|---|
| Revival as a priority-ordered query, not a chain of `if`s | Ch. 04 §4.13, `RevivalSource` element |
| Cascading overkill absorption across multiple charges | `RevivalSource.cascading` |
| Recording attack *identity* as unit state | `RecordAttackIdentity` element, `SetField` on the ability |
| `floorAtOne` damage negation | Shared with `Endure` |
| `StatDelta.floor` for drains that cannot kill | Shared with Penthesilea and Karna |
| Modes that start active and cannot be toggled | Ch. 15 §15.6 |
| Command-Spell suppression of a mode | Ch. 17 §17.2 |
| Abilities disabled *by their own owner's other ability* | `blockedWhen` / `suppressedWhen` |
| Self-accelerating cooldowns | `OnEvent → CooldownDelta` on self |

Nine requirements from one Servant, all of which generalized. That is the argument for using
the twelve reference Servants as the acceptance set rather than designing in the abstract.

---

**Next:** [32 — Case Study: Semiramis](32-case-semiramis.md)
