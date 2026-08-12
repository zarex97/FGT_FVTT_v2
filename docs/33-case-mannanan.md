# 33 — Case Study: Mannanán mac Lir

Mannanán is the acceptance test for **reactive mechanics**. She has a counter that fires on
being attacked *or debuffed*, a Noble Phantasm that cancels an incoming Noble Phantasm and
retaliates, a token economy feeding three different consumers, and a mode switch triggered by
her own defeat.

---

## 33.1 The sheet

```
True Name: Mannanán mac Lir (Bazett Fraga McRemitz)     Region: Ireland
Alignment: Neutral Good
STR A   END B   AGI B   MAG EX   LUC D
Attributes: Female, Servant (Pseudo Servant), [Sky], King, Humanoid, Living Human
Base Health 1250   MOV 6   Range 1 panel, 1 target
BA(STR) 150   BA(MAG) 250   Sustainability 2◈
Fragarach Tokens: 5/5
```

Note `Pseudo Servant` — per the attribute rules (Ch. 02 §2.10) this means she does **not** gain
the `Spirit` attribute, and `Living Human` is listed explicitly. So effects keying on `Spirit`
miss her and effects keying on `Living Human` hit her. A single attribute changes her matchups
substantially, and it falls out of the closure rules with no special handling.

---

## 33.2 The Fragarach Token economy

One resource, four producers, three consumers.

**Producers:**

| Source | Gain |
|---|---|
| *God's Holder: Tradition Carrier* passive 1 | +1 at end of every Round |
| Fragarach Counter (from the `Fragarach` status) | +1 per counter |
| Holder Mode | +1 at end of any Turn she Acts |
| (max 5, raised to 7 in Holder Mode) | |

**Consumers:**

| Sink | Cost | Effect |
|---|---|---|
| *Tradition Carrier* passive 2 | 1 | +30% Crit Chance for a Combat Phase |
| *Toole Fragarach* | 3 | A three-hit attack skill |
| *Fragarach* (NP) | 5 | Cancel an enemy NP |

**Passive scaling:** *"Crit Damage dealt is increased by 5% for every Fragarach Token."* So
holding tokens is itself valuable, creating real tension with spending them.

```yaml
resources:
  fragarachTokens:
    max: 5
    initial: 5
    display: pips
    gainTriggers:
      - { trigger: roundEnd, amount: 1 }
      - { trigger: turnEnd, amount: 1, predicate: ["self:acted", "self:mode:holder"] }

abilities:
  - mannanan-tradition-carrier:
      rank: EX
      hasPassive: true
      passiveRules:
        - key: ResourceMax
          resource: fragarachTokens
          value: 7
          predicate: ["self:mode:holder"]

        - key: CritModifier
          aspect: damage
          value: "5 * @self.resources.fragarachTokens.value"

        - key: OptionalCost
          timing: combatPhaseStart
          cost: { resource: fragarachTokens, amount: 1 }
          then: [{ key: CritModifier, aspect: chance, value: 30, duration: combatPhase }]

        - key: DurationExtension
          amount: "⅓◈"
          appliesTo: buffs
          direction: incoming
```

Two elements worth noting:

**`OptionalCost`** — a passive that *offers* a spend at a timing window. It renders as a
prompt at the start of any Combat Phase Mannanán participates in: *"Spend 1 Fragarach Token
for +30% Crit Chance this phase? (5 available)"*. New element, but general — several future
Servants will have "spend a resource for a bonus" passives.

**`DurationExtension`** — *"The duration of buffs are extended by ⅓◈ extra Turns when applied to
Mannanán."* A modifier on the *effect application pipeline* rather than on a stat. It slots into
step 6 of the application pipeline (Ch. 11 §11.2), adjusting the resolved tick count before the
expiry is stamped.

---

## 33.3 The `Fragarach` status

Applied by her `Fragarach Enbarr` NP for ⅓◈. Fully specified in Ch. 24 §24.8; the summary of
what it proved:

```
1. When Mannanán is Attacked, she cannot perform a normal Counter.
2. When Mannanán is Attacked OR inflicted with a debuff, at the end of the Combat Process
   (if Attacked), she automatically performs a Fragarach Counter on the DU, dealing 2.5×
   damage using BA(STR). Cannot be Blocked; cannot be Evaded except with Dodge. Then:
   a. Def Dwn (C) on the target for 1◈
   b. S.Crit Up to allies within 2 panels for ⅓◈
   c. Her NP Cooldown −⅓◈
   d. +1 Fragarach Token
3. Fragarach Counters deal NP Damage; however they are NOT affected by NP Seal.
4. Unremovable.
```

Four properties that needed engine support:

**Triggering on being debuffed, not just attacked.** Most counter mechanisms key on damage.
This one fires on `effectApplied` where the effect is a debuff and the source is an enemy —
which means a pure control ability (a Stun, a Def Dwn) *provokes a 2.5× retaliation*. Tactically
enormous, and it means the counter trigger is a **set** of events.

**Unblockable and evadable-only-by-Dodge.** A per-attack reaction restriction:

```yaml
formula:
  unblockable: true
  evadableOnlyBy: [dodge]
```

which the reaction ladder consults at step 2, removing Block from the options and making the
Evade roll auto-fail unless `Dodge` is present.

**NP damage scope without NP Seal scope.** The clearest justification for the three independent
scoping flags (Ch. 15 §15.5):

```yaml
scoping: { cooldown: skill, damage: np, seal: none }
```

A single derived predicate would have made this inexpressible.

**Replacing the normal counter.** `ForbidReaction: [counter]` plus the automatic counter, so
she trades the option for a stronger fixed one.

---

## 33.4 `Fragarach` — the NP-cancelling Noble Phantasm

The hardest single ability in the reference set.

```
Can only be used by removing 5 Fragarach Tokens. Can be used when a Noble Phantasm is used
against Mannanán. Cannot be used against (Passive) or (Non-damaging) Noble Phantasms.

1. If the NP was the enemy Unit's strongest NP (or its only damage-dealing NP), the NP is
   cancelled and the Servant who used it is inflicted with Instakill.
2. If the NP was not the strongest, the NP is cancelled and the equivalent damage that NP
   would have dealt is dealt to the NP's user instead (only affects the user if it was AoE).

Effective at any Range. Cannot be responded to (Block, Evade, Luck Check, Counter, etc).
Cooldown: 8◈.
```

### What makes it hard

1. **It interrupts another resolution.** Only Command Spells otherwise do this (Ch. 17 §17.1) —
   so the interrupt machinery must accept a non-Command-Spell interrupt source.
2. **It requires comparing abilities.** "Strongest NP" means evaluating every damaging NP the
   enemy has and ranking them. That is a genuine computation, not a lookup.
3. **It computes counterfactual damage.** Branch 2 needs "the damage that NP *would* have
   dealt" — which is exactly what the pure pipeline produces without applying (Ch. 13 §13.1).
4. **It cannot be responded to.** A resolution with no reaction ladder at all.

### The design

```yaml
id: mannanan-fragarach
name: "Fragarach: Gouging Sword of the War God"
rank: EX
isNP: true
timing: { window: whenTargetedByNP }
costs: [{ kind: resource, key: fragarachTokens, amount: 5 }]
cooldown: "8◈"
requirements:
  - { kind: incomingAbility, isNP: true, dealsDamage: true, notPassive: true }
phases:
  - kind: script
    fn: "mannanan.fragarach"
```

The script, which is the one place a script is genuinely warranted:

```js
CONFIG.FGT.scripts["mannanan.fragarach"] = async (ctx) => {
  const incoming = ctx.interruptedAttack;
  const user = incoming.attacker;

  // Rank the enemy's damaging NPs by expected damage against a neutral target.
  const damagingNPs = user.abilities.filter(a => a.isNP && a.dealsDamage && !a.isPassive);
  const ranked = damagingNPs
    .map(np => ({ np, expected: expectedDamage(np, user, ctx.board) }))
    .sort((a, b) => b.expected - a.expected);

  const isStrongest = ranked.length <= 1 || ranked[0].np.id === incoming.abilityId;

  ctx.cancelAttack(incoming);                       // no damage, no effects, to anyone

  if (isStrongest) {
    return [{ t: "applyEffect", unitId: user.id,
              effect: { defId: "instakill" }, sourceId: ctx.caster.id }];
  }

  // Counterfactual: what would it have dealt to its intended target?
  const would = incoming.aoe
    ? computeDamage({ ...incoming.context, defender: user })     // "only affects the user if AoE"
    : incoming.precomputed.damageByDefender[ctx.caster.id];

  return [{ t: "damage", unitId: user.id, amount: would,
            breakdown: { source: "Fragarach reflection" } }];
};
```

**`expectedDamage`** is the interesting helper: it runs the pipeline against a synthetic neutral
defender (no resistances, no buffs) with expected roll values, so the comparison is stable and
does not depend on who is currently in front of the NP. Deterministic across clients, which is
what matters.

**RISK.** "Strongest" is ambiguous for NPs that are conditional (Karna's *Brahmastra* deals 4×
or 2× depending on the target's parameters) or non-damaging-but-powerful. **DECISION.** Rank by
expected damage against a neutral target, taking the *best* branch of any conditional. Recorded
in Ch. 41.

The `cannotBeRespondedTo` flag on the resolution short-circuits the ladder entirely — the
resolution goes from declaration straight to application.

---

## 33.5 Holder Mode

```
God's Holder: Possession
(Active) Can only be used when Mannanán's Health is less than 30% of maximum OR when she is
defeated, and while she has at least 1 Fragarach Token. Remove all Fragarach Tokens and she
enters Holder Mode, restoring Health to 50% of maximum.

(Passive) While in Holder Mode:
1. Max Fragarach Tokens becomes 7.
2. She also gains 1 Token at the end of every Turn she Acts.
3. Range becomes 3.
4. Normal Attacks at Range 1–2 use BA(STR) + 30% of BA(MAG) (150+75=225), not affected by
   Magic Resistance. At Range 3+ use BA(MAG).
5. Toole Fragarach is replaced with Hallowed Sea God's Sword.
```

Four mechanisms:

**Triggered by defeat as an alternative to revival.** So Holder Mode is a **fifth kind** of
revival source (Ch. 31 §31.2), with a distinct shape: it is *optional*, it has its own resource
requirement, and it transforms the unit rather than just restoring health.

```yaml
- key: RevivalSource
  id: holderMode
  priority: 250                      # above generic Guts, below Special Guts
  optional: true                      # the player chooses
  available: { predicate: [{ gte: ["@self.resources.fragarachTokens.value", 1] }] }
  restore: { percentOfMax: 50 }
  then: [{ key: EnterMode, mode: holder }]
```

**Range-banded normal attack with a magic-resistance exemption.** Exactly the
`AttackComponentSpec.byRange` shape from Ch. 04 §4.3:

```yaml
normalAttack:
  mode: byRange
  bands:
    - maxRange: 2
      spec: { mode: combined, strFactor: 1.0, magFactor: 0.3 }
      ignoresMagicResistance: true
    - maxRange: 99
      spec: { mode: fixed, component: mag }
```

**Ability replacement.** *Toole Fragarach* becomes *Hallowed Sea God's Sword*:

```yaml
- key: ReplaceAbility
  from: mannanan-toole-fragarach
  to: mannanan-hallowed-sea-gods-sword
  predicate: ["self:mode:holder"]
```

`ReplaceAbility` hides one ability and reveals another while the predicate holds, sharing the
cooldown state so a player cannot reset a cooldown by switching modes. Drake needs the same
element (her normal attacks are replaced by the Golden Hind's), so it is general.

**Permanent, not timed.** Holder Mode has no duration and no way back. A one-way transformation
that is the character's whole arc.

---

## 33.6 `Fragarach Enbarr` and the Decoy synergy

```
Fragarach Enbarr: Wildly Running Sword of the War God — Rank EX (NP) [Counter]
(Non-damaging). Has the following effects:
1. Atk Up for ⅓◈: +5% damage per Fragarach Counter on herself; halved for NP.
2. Decoy for ⅓◈.
3. The 'Fragarach' effect for ⅓◈.
```

Applying **Decoy to herself** is the design's centrepiece: Decoy forces nearby enemies to attack
*her*, and the `Fragarach` status turns every such attack into a 2.5× unblockable counter that
generates a token and reduces her NP cooldown.

Recall from Ch. 10 §10.6:

> *"Decoy is not affected by Debuff Resist or Immune effects when a Unit applies it on itself or
> on another allied Unit."*

So the self-application always lands. The engine's application pipeline (Ch. 11 §11.2) skips
steps 1, 3, and 4 when `relation(source, target) !== "enemy"` for effects flagged
`allySelfApplicationBypassesResistance`. Two effects need this: `Decoy` and Kiritsugu's
`Decoy (Scapegoat)`.

Note also effect 1 reads *"per Fragarach **Counter** on herself"* while the resource is called
Fragarach **Tokens**, and *God's Holder: Possession* says *"Remove all Fragarach **Counters**"*.
The source uses both names for the same thing. **DECISION.** They are the same resource;
`fragarachTokens` is canonical and `counters` is recorded as an alias in the glossary. Ch. 41.

---

## 33.7 `Sea God's Rune` and `Successor of the Red Branch`

Two straightforward buff skills, included because they show what the *typical* ability looks
like once the hard cases are handled:

```yaml
- mannanan-sea-gods-rune:
    rank: EX
    cooldown: "3◈"
    phases:
      - kind: cooldown
        target: self
        changes: [{ ability: all, scope: np, delta: "-2◈" }]
      - kind: applyEffect
        target: self
        effects:
          - { id: critUp,    duration: "⅓◈", magnitude: { base: 30 } }
          - { id: critDmUp,  duration: "⅓◈", magnitude: { base: 100 } }

- mannanan-successor-of-the-red-branch:
    rank: B
    cooldown: "3◈"
    phases:
      - kind: applyEffect
        target: self
        effects:
          - { id: evade,        duration: "⅓◈" }
          - { id: debuffImmune, duration: "⅓◈" }
      - kind: applyEffect
        target:
          anchor: { kind: self }
          shape: { kind: chebyshevRadius, r: 2 }
          selection: { relations: [ally, self], chooser: all }
        effects: [{ id: sCritUp, duration: "⅓◈", magnitude: { base: 20 } }]
```

Eleven and thirteen lines respectively. This is what SC-6 (a GM authors a Servant in under an
hour) rests on: the hard cases are hard, but the ordinary cases are three lines each and the
reference set is mostly ordinary cases.

---

## 33.8 Tally

| Mechanism | New support needed |
|---|---|
| Token economy with scaling passive | none — the resource system |
| Counter triggering on debuff application | `OnEvent` with an event set |
| Unblockable / Dodge-only-evadable attacks | `formula.unblockable`, `evadableOnlyBy` |
| NP damage scope without NP Seal scope | the three independent scoping flags |
| Interrupting another unit's NP | interrupt machinery generalized past Command Spells |
| "Strongest NP" comparison | `expectedDamage` helper + one script |
| Counterfactual damage | free — the pipeline is pure |
| Resolutions with no reaction ladder | `cannotBeRespondedTo` |
| Mode entered on defeat | `RevivalSource` with `optional` and `EnterMode` |
| Range-banded attack with an MR exemption | `AttackComponentSpec.byRange` |
| Ability replacement by mode | `ReplaceAbility` |
| Buff duration extension on application | `DurationExtension` |
| Optional resource spend at a timing window | `OptionalCost` |
| Self/ally Decoy bypassing resistance | `allySelfApplicationBypassesResistance` |

**Script elements: one** — and it is the one ability in the entire reference set that genuinely
requires cross-ability reasoning.

---

**Next:** [34 — Case Study: The Dioscuri](34-case-dioscuri.md)
