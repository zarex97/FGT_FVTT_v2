# 06 — Stats and Resources

> **Implemented (Ch. 45 A3, C2).** The Injury Roll is live. The threshold test reads the damage
> pipeline's pre-Def-Crk snapshot rather than comparing the final total to 100 — Def Crk's bonus
> damage *"does not count towards the amount required"*, and stage 16 adds it after the snapshot,
> so a fresh comparison would fire on hits the rules exclude.
>
> Agility is depleted by exactly three things, and all three now exist: the Injury Roll,
> `Def Dwn (C)`, and Luck Checks. The Home Base restores 1 per Round (§19.1 E1) and a Civilian
> kill grants 1.

Parameters are ranks; **stats** are the numbers combat actually reads. This chapter specifies
each stat's semantics, its modifier model, its clamping rules, and the general-purpose
**resource** system that ability-specific pools (Fragarach Tokens, Proliferation stocks, HGoB
Construction) plug into.

---

## 6.1 The stat model

Every numeric stat is one of three shapes.

### Shape 1 — `Resource`: a depleting pool with a maximum

```ts
interface Resource {
  value: number;        // current
  max: number;          // maximum
  base: number;         // max before modifiers (for reversibility)
}
```

Used by: Health, Agility, Luck, and every ability-specific pool.

Invariants:
- `0 ≤ value ≤ max` — enforced on every write.
- Raising `max` does **not** raise `value` (except where an effect says so — `Max HpUp`
  explicitly restores health by the amount the max increased).
- Lowering `max` clamps `value` down. `Max HpDwn` says *"Health is not restored when the
  effect of this debuff ends"*, so the clamp is one-way: the value stays where the clamp put
  it when max is restored.

### Shape 2 — `DerivedScalar`: a base plus ordered modifiers

```ts
interface DerivedScalar {
  base: number;
  get value(): number;      // base after all active modifiers, clamped
}
```

Used by: MOV, Range, Base Attack (STR), Base Attack (MAG), Sustainability, ZON.

These are recomputed on every derived-data pass. They have no "current" — there is no such
thing as "spent MOV" stored on the stat (spent movement lives in `turnState.movedPanels`).

### Shape 3 — `Counter`: a monotonic tally with no maximum

```ts
interface Counter { value: number; }
```

Used by: Curse stage, Poison stage, defeated-Servant count, `Attacks recorded by God Hand`.

The distinction from `Resource` matters: a Counter has no max to clamp against and no
"restore to full" semantics.

---

## 6.2 Health

```ts
health: Resource
```

**Defeat condition.** The rulebook says *"The Unit is defeated when this drops below 0"* but
almost every effect says *"reduced to 0"*. **DECISION.** Defeat triggers at `value ≤ 0`.
Treating "below 0" literally would mean a unit at exactly 0 survives, which contradicts
`Instakill` ("its Health is reduced to 0") being lethal. Recorded in Ch. 41.

**Health loss vs damage.** A load-bearing distinction, stated in the General Notes:

> *"An effect that causes a Unit to lose Health which does not state or mention 'damage' means
> that the Health loss is not caused by 'damage', and thus is not affected by effects that
> modify/affect the amount of damage dealt/taken."*

So there are two mutation paths:

```ts
type HealthMutation =
  | { kind: "damage"; packet: DamagePacket }     // goes through the full pipeline
  | { kind: "loss";   amount: number; source: string }   // bypasses everything
  | { kind: "heal";   amount: number; source: string; modifiable: boolean };
```

Examples of `loss`, not damage:
- Master health cost of using an NP (`Rank A: 50/60`).
- Mad Enhancement's per-turn Master drain.
- Nightmare's *"loses Health at the end of its Turn equal to 10% of its current value"*.
- Golden Hind's 50/round Master upkeep.

Examples of `damage` that look like loss:
- Curse Damage, Burn Damage, Poison Damage — these **are** damage, but the source says they
  *"ignore all effects that modify the amount of damage dealt and/or received"*. So they are
  `damage` for trigger purposes (they fire `onDamageTaken`, they can be converted to healing
  by `PoisHeal`/`CursHeal`/`FlamHeal`) but skip the modifier stages of the pipeline.

**DECISION.** `DamagePacket` carries a `bypassModifiers: boolean`. Volatile-debuff damage sets
it. This keeps one code path with one flag rather than two parallel systems, and preserves
trigger semantics.

**Healing.** `Heal Up` increases the amount healed but explicitly *"does not increase the
magnitude of the healing effect received"* — i.e. it modifies the *applied* number, not the
source effect's stated value, which matters when a third effect reads the source value.
Home Base healing and Command Spell healing are exempt from `Heal Up` unless stated.
`No Heal` and `Gashed` block healing outright (Gashed also blocks Agility restoration).

**Overheal.** Not permitted. `value` clamps to `max`.

**Shield.** The `Shield (X)` buff is not extra Health; it is a separate pool that absorbs
damage first and passes the remainder through. Modelled as an effect carrying its own
`Resource`, consulted at pipeline stage 12 (Ch. 13). A Master with a Shield cannot be
Overpowered.

---

## 6.3 Agility

```ts
agility: Resource
```

Agility is **not** a to-hit bonus. It is the number you must roll *under* on an Evade roll,
and it is a depleting resource that combat grinds down.

**Consumption:**
- **Injury Roll** — after surviving an attack that dealt >100 damage, roll and subtract the
  result from current Agility. This is the primary attrition mechanism in the game.
- `Def Dwn (C)` — −1 Agility whenever the unit is successfully attacked.
- `Shock` — −3 to **max and current**.

**Restoration:**
- Home Base: +1 at end of Round (if not in combat there that Round).
- Command Spell `Half Heal` (+50% of max) / `Full Heal` (to max).
- Skills: Karna's *Flash of the Sun God* +3, Scáthach's *Ár* +4, Mannanán's
  *Sealing Designation Enforcer* +3, the Dioscuri's *Mana Burst* +1/+2.
- Shock removal: *"When Shock is removed from a Unit and its Max Agility is restored, restore
  its current Agility by 1."*

**Comparison semantics.** Evade uses `Evade` if the DU's Agility is **≥** the AU's, and
`Evade−` if lower. This is a *current-value* comparison, not a rank comparison. Two units with
`AGI: A` can be on opposite sides of the threshold if one has taken injuries.

`Agility Boost` forces the favourable roll; `Agility Loss` forces the unfavourable one.

**Max Agility modifiers:** `Shock` (−3), Master essences (`Imaginary Around` +4, `Gandr` +3,
`Black Keys (G)` +2, `Preemption` +1). These modify `max`; the current value clamps down and
does not automatically restore when the modifier ends.

---

## 6.4 Luck

```ts
luck: Resource
```

Structurally identical to Agility, but the consumption model is what makes it interesting:

> *"Every time a Unit performs a Luck Check, reduce the Unit's Luck by 1 after resolving the
> effects of the Luck Check."*

Win or lose. This makes Luck a **budget for contesting outcomes**, and it means the reaction
ladder (Ch. 12) has a real cost curve — you can contest, and contest the contest, but each
rung costs a point of a finite pool and lowers your odds on the next one.

**Ordering matters.** "after resolving the effects" means the check is evaluated against the
pre-decrement value, then the decrement applies. And for double-checks (Lucky Hit and Lucky
Evasion against an NP require **two consecutive successes**), *both* checks are made at the
pre-decrement value and the −2 applies after both resolve. Explicitly stated in the source and
easy to get wrong.

```ts
async function luckCheck(unit, opponent, kind): Promise<CheckResult> {
  const table = unit.luck.value >= opponent.luck.value ? "luckCheck" : "luckCheck-";
  const roll = await rollNamed(table, modifiersFor(unit, kind));
  const success = roll.total < unit.luck.value;      // pre-decrement
  intents.push({ t: "statDelta", unitId: unit.id, stat: "luck", delta: -1, clamp: true });
  return { success, roll };
}
```

**`Def Dwn (A)`** reduces Luck by 1 whenever the unit is successfully attacked — a second
drain independent of checks.

**Once per Combat Process.** *"The same Luck Check can only be used once per Combat Process
unless stated."* Tracked in `turnState.reactionsThisPhase` as `luckCheck:<kind>` keys, cleared
at Combat Process boundaries — note, per *Process*, not per *Phase*, so a counter-attack gets
a fresh set.

---

## 6.5 MOV

```ts
mov: DerivedScalar
```

Panels movable per Turn. Diagonal movement is **forbidden** (Rules — Stats: *"Units are not
allowed to Move diagonally"*), so MOV is Manhattan distance along a path, not Chebyshev.

**Modifiers observed in the reference set:**

| Source | Effect |
|---|---|
| Riding (Active) | `+1..+6` by rank, for the Turn; explicitly *not a buff* and unremovable |
| Mad Enhancement | `+2` while active |
| Master adjacency | `+1` when a Master is directly next to its Servant |
| Kingprotea growth | `−1` per size increase |
| `MOV Up` / `MOV Down` | generic buff/debuff |
| `Slow` | halved |
| `Crystallize` | `−3` |
| `Pigify` | set to 2 |
| `Toad` | set to 1 |
| `Drowning` | `−1` |
| `Immobilize` | cannot move at all |
| Jumping off a platform | `−1` for that move |

**Floor.** *"MOV Down and other similar effects cannot reduce a Unit's MOV below 1."* So the
clamp is `max(1, computed)` — except `Immobilize`, which is a separate prohibition rather than
a MOV reduction, and Pigify/Toad which *set* rather than reduce.

**Modifier ordering.** Set-operations (`Pigify` → 2, `Toad` → 1) must apply after additive
ones, or a Toad'd unit with Riding active would move 6 panels. Order:

```
base → additive (+/−) → multiplicative (Slow ×0.5, floor) → set (Pigify/Toad) → clamp ≥1
```

Halving under `Slow` rounds **down** (consistent with the game's global round-down rule).

**Riding's double move.** *"The Servant is able to Move twice in one turn if it Attacks in
that turn (before and after the Attack). However, the total number of panels Moved during both
times cannot exceed its MOV."* So MOV is a per-turn budget spent across up to two segments,
not a per-move cap. Tracked as `turnState.movedPanels` against `mov.value`.

---

## 6.6 Range

```ts
range: { panels: DerivedScalar; targets: number }
```

Range is a *shape*, not a distance — see Chapter 08 for the diagonal-reduction geometry. Here
we cover the scalar and its modifiers.

The `targets` component ("Range: 3 panels, 1 target") caps how many units a normal attack may
hit. Every reference Servant has `1 target`; the field exists because the notation does.

**Modifiers:**

| Source | Effect |
|---|---|
| Mad Enhancement | `+1` |
| Kingprotea growth | `+1` per size step |
| `Range Up` buff | `+X` |
| Per-ability override | `Range+2 for the Combat Process` (Toole Fragarach), `Range=4` (absolute) |
| `Silence` on a MAG-only attacker | reduced to 1 |
| `Pigify` / `Toad` | reduced to 1 |
| Mannanán Holder Mode | set to 3 |
| Berserk on a MAG-only attacker | reduced to 1 |

Note the two forms: `Range+N` (relative, for a Combat Process) and `Range=N` (absolute, for an
ability). The ability model distinguishes `rangeDelta` from `rangeOverride`.

---

## 6.7 Base Attack

```ts
baseAttack: { str: DerivedScalar; mag: DerivedScalar }
```

The raw numbers before any multiplier. Authored per-Servant.

**Modifiers:**

| Source | Effect |
|---|---|
| Setup parameter grants | `±10` per added step (§5.6) |
| `Burn` | `−30` (to STR and MAG — see Ch. 41, the source has a literal `?`) |
| Kiritsugu's `Kiritsugu` debuff | both halved, ignores resistance, unremovable, no stack |
| `Pigify` | both reduced to 10% |
| `Toad` | both reduced to 5% |
| Karna's Vasavi Shakti activation | STR `+25`, permanent |
| Semiramis aboard HGoB | STR `+25`, MAG `+50` |

**Combined base attacks.** Several abilities use both:
- Castor's Mana Burst: `BA = 150 + 150 = 300`
- Pollux's Mana Burst: `BA = 200 + 150 = 350`
- Karna's Mana Burst (Flames): `BA = 125 + 175 = 300`
- Mannanán Holder Mode normal attack at range 1–2: `150 + (0.3 × 250) = 225`
- Mannanán's Hallowed Sea God's Sword: `150 + (0.5 × 250) = 275`
- Dioscuri NP: `half of Castor's STR + half of Pollux's STR = 75 + 100 = 175`

The last is notable: it reads across *two different units*. The ability's component spec must
be able to name a source unit, not just "self".

```ts
type BaseAttackSource =
  | { unit: "self" | "partner" | UnitRef; component: "str" | "mag"; factor: number };

// Dioscuri NP:
[ { unit: "castor", component: "str", factor: 0.5 },
  { unit: "pollux", component: "str", factor: 0.5 } ]
```

---

## 6.8 Sustainability

```ts
sustainability: DerivedScalar | null      // null = N/A (indefinite)
```

Ticks a Free Servant survives after its Master dies. See §4.4. Only counts down while the
Servant is `FREE`; it is inert while `CONTRACTED` or `UNBOUND`.

```ts
// on turn end, for each free servant
if (unit.contract.state === "free" && unit.sustainability !== null) {
  intents.push({ t: "statDelta", unitId, stat: "sustainabilityRemaining", delta: -1 });
  if (remaining <= 0) intents.push({ t: "defeat", unitId, cause: "disappeared" });
}
```

Two counters, not one: `sustainability` (the derived maximum) and `sustainabilityRemaining`
(set from it when the Servant becomes Free). Modifiers to `sustainability` while already Free
adjust the remaining value by the same delta.

---

## 6.9 ZON

```ts
zon: DerivedScalar        // on the Master, per contracted Servant
```

Technically a property of the Master–Servant *pair*, not of either unit alone, because the
default depends on the Servant's class:

```
Saber, Lancer, Rider, Berserker: 2 panels
Archer, Assassin:                4 panels
Caster:                          5 panels
```

Plus, for Casters and Assassins, *"the default ZON of their Masters is increased by 2 panels,
this does not stack with Independent Action and other Skills with the same effect (use the
effect with the highest increase)"*.

**Reading this carefully:** Assassin's base is already 4 and Caster's already 5, which look
like 2+2 and 3+2. The "+2" clause is therefore *the reason for* those numbers, not an
additional bonus on top. And it does not stack with Independent Action — you take the higher.

**DECISION.** Model as: `zonBase` by class (Saber/Lancer/Rider/Berserker 2, Archer 2,
Assassin 2, Caster 3), plus a **max-not-sum** bonus channel:

```ts
zon = zonBase
    + max(classAssassinCasterBonus, independentActionBonus, otherEquivalentBonuses)
    + madEnhancementBonus        // +2, stacks (it is not "the same effect")
    + highRankMasterBonus;       // +1, stacks
```

which reproduces the stated defaults (Assassin 2+2=4, Caster 3+2=5) and handles Kingprotea
(Independent Action B: +2; not a Caster/Assassin; Mad Enhancement +2 ⇒ base 2 + 2 + 2 = 6).

**RISK.** This is an inference from two sentences that could also be read as "Assassins get
4+2=6". Flagged in Ch. 41 as needing an authorial ruling; the implementation reads the split
from a config table so it can be changed without code.

**Consequences of being outside ZON:**
- Servant attack damage reduced by 5d10 (the Damage Modifier roll).
- Noble Phantasms cannot be used at all.

**Exceptions:** Semiramis aboard HGoB (*"ZON does not apply to her"*), and her HGoB activation
sequence (*"Semiramis can perform the activation without being in her Master's ZON"*).

**Dioscuri special case:** *"as long as the other counterpart is within their Master's ZON,
damage dealt is not reduced"* — the ZON test is `any(castor.inZon, pollux.inZon)`.

---

## 6.10 The resource system

Ability-specific pools are common enough in the reference set to deserve a general mechanism
rather than bespoke fields.

```ts
interface ResourceDef {
  key: string;                     // "fragarachTokens"
  label: string;
  max: number | "dynamic";         // dynamic ⇒ computed by a rule element
  initial: number;
  min: number;                     // usually 0
  gainTriggers: TriggerSpec[];     // when it goes up automatically
  persistence: "unit" | "ability"; // whose lifetime it shares
  display: "pips" | "bar" | "number";
}
```

### The reference set's resources

| Resource | Owner | Max | Gains | Spends |
|---|---|---|---|---|
| **Fragarach Tokens** | Mannanán | 5 (7 in Holder Mode) | +1 end of Round; +1 per Fragarach Counter; +1 end of any Turn she Acts (Holder Mode) | 3 → Toole Fragarach; 5 → Fragarach NP; 1 → +30% crit for a Combat Phase |
| **Proliferation stocks** | Kingprotea | 10 | +1 per ⅓◈ while *Endless Proliferation* is active | Cleared by *Infantile Regression* (converting to NP cooldown reduction) |
| **HGoB Construction** | Semiramis | 100 | 6 distinct sources incl. a per-Round d4+2, a `Gather` action, and per-skill-use increments | Consumed entirely on HGoB activation |
| **PRS Tokens** | Scáthach | 2 | +2 per *Primordial Rune* use | 1 → a Primordial Rune Spell that then does not enter cooldown |
| **NP DmUp (GAO) stacks** | Kingprotea | — | N per *Monstrous Strength* use, N = Proliferation stocks | Decays 1 per turn she Acts |
| **God Hand charges** | Heracles | 11 | none | 1 per death |
| **Recorded attacks** | Heracles | ∞ | 1 per distinct attack that first reduced him to 0 | never |
| **Command Spells** | every Master | 3 (+ borrowed) | inherited from killed Masters | 1–3 per command |

Note the variety: hard-capped pools, uncapped counters, pools that are really stack-counts of
a buff (GAO), and pools that are a *set of identifiers* rather than a number (Heracles's
recorded attacks). The last one does not fit `Resource` at all.

**DECISION.** Two mechanisms, not one:
1. `Resource` for numeric pools — the first six rows.
2. **Effect stacks** for things that are really "N instances of a buff" (GAO) — modelled as N
   `ActiveEffect`s with a shared group key, because the source says *"Each Proliferation stock
   counts as a separate buff"* and *"remove one 'NP DmUp (GAO)' buff from herself"*. They must
   be individually dispellable.
3. `Counter` + a **set field** for Heracles's recorded attacks, which stores ability
   identities, not a number.

The distinction between (1) and (2) is decided by one question: *can an enemy dispel it?* If
yes, it is an effect stack. Proliferation is explicitly dispellable ("the chance of buffs
being removed from herself is reduced by 35%" implies they can be removed), so Proliferation
is both — a `Resource` mirror for display and gating, backed by effect instances that are the
source of truth. The mirror is derived, never written directly.

### Resource triggers

`gainTriggers` reuses the general trigger system (Appendix E) rather than inventing a
parallel one:

```yaml
# Mannanán's God's Holder: Tradition Carrier, Passive 1
- key: ResourceGain
  resource: fragarachTokens
  amount: 1
  trigger: roundEnd
# Holder Mode adds:
- key: ResourceGain
  resource: fragarachTokens
  amount: 1
  trigger: turnEnd
  predicate: ["self:acted", "self:mode:holder"]
```

---

## 6.11 Modifier collection and ordering

Every `DerivedScalar` is computed by the same pipeline:

```ts
function derive(base: number, mods: Modifier[], clamp: Clamp): number {
  const sorted = mods.filter(m => m.active).sort((a, b) => a.priority - b.priority);
  let v = base;
  for (const m of sorted) {
    switch (m.op) {
      case "add":      v += m.value; break;
      case "multiply": v = Math.floor(v * m.value); break;
      case "set":      v = m.value; break;
      case "min":      v = Math.min(v, m.value); break;
      case "max":      v = Math.max(v, m.value); break;
    }
  }
  return clampTo(v, clamp);
}
```

Default priority bands (lower runs first):

| Band | Priority | Contains |
|---|---|---|
| Base adjustments | 10 | setup grants, permanent changes (Vasavi Shakti +25) |
| Additive | 20 | `MOV Up`, Mad Enhancement `+2`, Range Up |
| Multiplicative | 40 | `Slow` (×0.5), Pigify's 10% base-attack |
| Absolute set | 60 | `Pigify` MOV=2, Holder Mode Range=3 |
| Bound | 80 | `min`/`max` from effects |
| Clamp | — | the stat's own floor/ceiling |

Rounding is **always floor**, consistent with the game's global round-down rule.

**Suppression.** `Petrify` states *"Buffs, debuffs, and other effects have no effect on a
Petrified Unit"* and `Pigify`/`Toad` state *"Passive effects of Skills/NP have their effect
negated"*. These are not modifiers; they are **suppression predicates** evaluated before
collection:

```ts
mods.filter(m => !isSuppressed(m, unit))
```

Chapter 11 specifies suppression fully. It is called out here because a suppression bug looks
exactly like a modifier-ordering bug and the two are diagnosed very differently.

---

## 6.12 Stat display and the sheet contract

Every stat shown to a player must be able to explain itself. The sheet renders each derived
stat with a tooltip listing the ordered modifier chain:

```
MOV  6
  ├ base                    5
  ├ Riding (Active) A       +5   ← not a buff, unremovable
  ├ Mad Enhancement B       +2
  ├ Slow                    ×0.5  → 6
  └ clamp ≥1                 6
```

This is the same data structure the damage explainer uses (Ch. 30), produced by the same
`derive()` call with `explain: true`. One implementation, two consumers.

---

**Next:** [07 — The Time Model](07-time-model.md)
