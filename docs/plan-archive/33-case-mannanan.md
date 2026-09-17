# 33 — Case Study: Mannanán mac Lir

**Built.** Fourteen abilities, every clause running in a live world; the tally in §33.8 records
what each one cost. This chapter was written as a design and is kept as one — where the build
departed from it, §33.9 says so and why.

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

## 33.9 What the build changed

Fourteen of the fifteen mechanisms above were built as specified. The rest of this section is the
list of places where the design and the engine disagreed, and which one won.

**No script.** §33.4 budgets the reference set's one `Script` element for *Fragarach*, and it
turned out not to need one. The genuinely computational part is *"was it their strongest"*, and
that belongs in `rules/np-strength.mjs` — pure, testable, and rankable against a synthetic
neutral defender — rather than inside a registered function content cannot inspect. What is left
is a two-branch declaration on the ability itself:

```yaml
cancelsNP:
  againstStrongest: { effect: instakill }
  otherwise: { reflect: true }
```

The reference set's script count is therefore **zero**, and the `Script` element remains an
escape hatch nothing has yet needed.

**`ResourceMax` was not built.** §33.2 proposes a rule element that raises the pool's ceiling
while a predicate holds. Holder Mode is permanent and one-way, so the ceiling is raised by
**writing the field once**, at entry — a derived cap maintained for a state that never reverts is
machinery with no second case. The clause is a `StatDelta` in the revival's `then:` and a
`statChange` phase on the button.

**`ReplaceAbility` was not built either.** §33.5 describes an element that hides one ability and
reveals another while a predicate holds, sharing the cooldown. Expressed as the two gates that
already exist — `requirements: [{kind: modeInactive, mode: godsHolderPossession}]` on *Toole
Fragarach* and `modeActive` on *Hallowed Sea God's Sword*, plus `alsoTriggers` in both directions
— it is the same rule with the same two properties, in vocabulary the validator already checks.
Drake's normal-attack replacement is a different shape (a Unit's attack, not an ability slot) and
will need its own answer.

**A mode may have an entry price.** Mad Enhancement, Presence Concealment and Riding's Active are
all free switches, so the toggle was a bare write with no gates and no phases. *God's Holder:
Possession* is the first that is not — three gates and three writes — so `onToggleMode` now runs
the ability's `phases` and its requirements on the way **on**. Switching a mode off still pays
nothing: no sheet in the corpus states an exit price.

**`ignoresOverkill`.** §31.2's revival machinery subtracts the excess damage that killed the
bearer from whatever the source restores — God Hand's own clause, generalised because every
source in the corpus had it. Possession is *"restoring her Health **to** 50% of its maximum
value"*, a destination rather than an amount, so it opts out. The same distinction appears on the
button as `heal: {toPercentOfMax: 50}` beside the existing `percentOfMax`.

**`rangeBonus`.** *"Range+2 for the Combat Process"* is a **relative** reach and the anchor
vocabulary had only an absolute one. Authored as the 3 it works out to today it would have been
wrong the moment anything moved her Range — which Holder Mode does, and which is the whole reason
her second sword exists.

**Three defects in shipped machinery**, none of them hers, each found by a clause of hers landing
on it:

- A Unit reduced to **zero Health came back at maximum**. Each actor type's `prepareBaseData`
  backfills an unset Health pool and recognised "unset" as *zero* — which is also what a Unit
  that has just been killed looks like. Every Servant in the game was unkillable by damage unless
  something had happened to persist its `max`. The initial is `null` now, and zero is a value.
- **`min: 0` on a choice prompt was ignored.** Four call sites have passed it since they were
  written and `ChoiceDialog` enforced an exact count, so declining was only possible by dismissing
  the window; Confirm warned and refused. Jack's pre-emption, the attacker's timing window and
  both of Mannanán's own offers were all affected.
- **The attack path read the document where it should have read the projection.** `baseSpecFor`
  and `targetSpecFor` took `attacker.system.normalAttack` and `attacker.system.range`, so Holder
  Mode's banded attack bypassed Magic Resistance (from the projection) and then dealt the sheet's
  flat STR (from the document), and her own Normal Attack was refused at 2 panels while every
  other consumer agreed she reached 3. A `Range Up` on any Servant had the same effect.

---

**Next:** [34 — Case Study: The Dioscuri](34-case-dioscuri.md)
