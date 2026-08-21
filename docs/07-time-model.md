# 07 — The Time Model

> **Implemented (Ch. 45).** Delay (§7.8) resolves in `computeTurnOrder`, which applies delays in
> **declaration** order rather than turn order — two factions each delaying past the other end up
> where they started, which is what happens at the table.
>
> One clause was genuinely missing: a Delay declared against a faction that had **already acted**
> is meant to apply next round, and because `system.delays` is cleared at round start it was
> being discarded instead. `carryDelaysForward` keeps exactly those.

The ◈ operator is the single most distinctive thing about F/GT's rules, and the subsystem the
prototype lacked entirely. Get this wrong and every duration, every cooldown, and every
periodic effect in the game is wrong. This chapter specifies it completely.

---

## 7.1 The hierarchy

```
Game
 └── Round  1, 2, 3, …
      └── Turn  (one per player, plus one for the GM)
           ├── Turn Start
           ├── [player acts]
           └── Turn End
```

**Turns per round = number of players + 1 (the GM).** The source enumerates:

| Variant | Turns per Round |
|---|---|
| Great Holy Grail War, Moon Cell HGW (2 players + GM) | **3** |
| Holy Grail War, Snowfield (pre-True-Masters), Ainsworth | **8** |
| Snowfield HGW (post-True-Masters) | **15** |

This value is `turnsPerRound`, a **ruleset configuration constant** fixed at game start. It is
the value ◈ resolves to.

---

## 7.2 The ◈ operator

> *"From now onwards, this symbol: ◈ will be used to represent 'number of Turns in a Round'.
> So, Cooldown: 3◈ means 3 × Number of Turns in a Round; or 6◈+⅔◈ means 6 × Number of Turns in
> a Round plus ⅔ × Number of Turns in a Round."*

And the rounding rule, which is unusual and must not be "corrected":

> *"Whenever a fraction appears when calculating ◈, such as ⅓◈, always **Round Down** the
> resulting number/decimal (i.e. 2.33333333~ becomes 2), even if it would have been rounded up
> (i.e. 4.666666666~ becomes 4 and **not 5**)."*

The source then gives a verification table:

| Turns/Round | ⅓◈ | ⅔◈ | ½◈ |
|---|---|---|---|
| 3 | 1 | 2 | 2 |
| 8 | 2 | 5 | 4 |
| 15 | 5 | 10 | 7 |

**Check these against naive `floor(fraction × turns)`:**

| | ⅓ | ⅔ | ½ |
|---|---|---|---|
| **3** | floor(1.0)=1 ✓ | floor(2.0)=2 ✓ | floor(1.5)=**1** ✗ (source says 2) |
| **8** | floor(2.67)=2 ✓ | floor(5.33)=5 ✓ | floor(4.0)=4 ✓ |
| **15** | floor(5.0)=5 ✓ | floor(10.0)=10 ✓ | floor(7.5)=**7** ✓ |

Two of the three ½ cases match floor; the 3-turn case does not — the source says `½ = 2` where
floor gives 1. But `round(1.5) = 2` and `round(7.5) = 8 ≠ 7`. So neither pure floor nor pure
round reproduces the table.

**Resolution.** ½◈ at 3 turns/round = 2 is almost certainly a deliberate exception (a
half-round of 1 turn out of 3 is degenerate — it would make "half a round" shorter than "a
third of a round"). Every other cell is `floor`.

**DECISION.** Implement `floor` as the rule, with the published table as an **override table**
consulted first. This reproduces the source exactly, is data-driven, and makes the one anomaly
visible rather than buried in a rounding hack.

```ts
const TICK_OVERRIDES: Record<number, Record<string, number>> = {
  3:  { "1/3": 1, "2/3": 2, "1/2": 2 },
  8:  { "1/3": 2, "2/3": 5, "1/2": 4 },
  15: { "1/3": 5, "2/3": 10, "1/2": 7 },
};

function fractionTicks(num: number, den: number, turnsPerRound: number): number {
  const key = `${num}/${den}`;
  const override = TICK_OVERRIDES[turnsPerRound]?.[key];
  if (override !== undefined) return override;
  return Math.floor((num / den) * turnsPerRound);
}
```

Recorded in Ch. 41 for authorial confirmation.

---

## 7.3 `TickExpr` — the duration expression type

Durations in the source appear in these forms:

```
1◈            3◈            8◈
⅓◈            ⅔◈            ½◈
1◈+⅔◈         6◈+⅓◈         7◈+⅓◈         3◈+⅓◈        1◈+½◈
4◈-⅓◈         3◈-⅔◈         2◈-⅔◈         3◈-⅓◈
"this Turn"   "1 Turn"      "2 Turns"     "until X"     "permanent"
```

Note both `+` and `−` fractional adjustments, and that plain-turn counts coexist with ◈ counts
(Castor's Self-Replenishment reduces NP cooldown by *2 Turns*, not 2◈).

```ts
type TickExpr =
  | { kind: "ticks";  n: number }                                  // literal turns
  | { kind: "rounds"; whole: number; frac?: Fraction; sign?: 1|-1 } // a◈ ± b/c◈
  | { kind: "thisTurn" }                                           // until end of current turn
  | { kind: "permanent" }
  | { kind: "untilEvent"; event: string }                          // "until Zero Sail ends"
  | { kind: "uses"; n: number };                                   // "1 time", "3 times"

interface Fraction { num: number; den: number; }
```

Resolution to an integer tick count:

```ts
function resolveTicks(e: TickExpr, ctx: { turnsPerRound: number }): number | typeof INFINITE {
  switch (e.kind) {
    case "ticks":     return e.n;
    case "thisTurn":  return 0;           // see §7.5 — expires at end of current turn
    case "permanent": return INFINITE;
    case "untilEvent":return INFINITE;    // removed by an event, not a countdown
    case "uses":      return INFINITE;    // count-limited, not time-limited
    case "rounds": {
      const whole = e.whole * ctx.turnsPerRound;
      if (!e.frac) return whole;
      const f = fractionTicks(e.frac.num, e.frac.den, ctx.turnsPerRound);
      return whole + (e.sign ?? 1) * f;
    }
  }
}
```

### Worked examples at 3 turns/round

| Expression | Whole | Fraction | Total ticks |
|---|---|---|---|
| `1◈` | 3 | — | **3** |
| `⅓◈` | 0 | 1 | **1** |
| `1◈+⅔◈` | 3 | +2 | **5** |
| `4◈-⅓◈` | 12 | −1 | **11** |
| `6◈+⅓◈` | 18 | +1 | **19** |
| `7◈+⅓◈` | 21 | +1 | **22** |
| `1◈+½◈` | 3 | +2 | **5** |

### The same at 8 turns/round

| Expression | Total ticks |
|---|---|
| `1◈` | **8** |
| `⅓◈` | **2** |
| `1◈+⅔◈` | 8 + 5 = **13** |
| `4◈-⅓◈` | 32 − 2 = **30** |
| `7◈+⅓◈` | 56 + 2 = **58** |

Content is authored once as `"1◈+⅔◈"` and behaves correctly in both variants. This is
success criterion **SC-3**.

### Parsing

The authoring format accepts the human notation directly, so content matches the source text
character for character:

```
"1◈"      "⅓◈"      "1◈+⅔◈"     "4◈-⅓◈"     "2 turns"    "this turn"
"1/3◈"    "1+2/3◈"                                        "permanent"
```

Both Unicode vulgar fractions (`⅓ ⅔ ½ ¼ ¾`) and ASCII (`1/3`) are accepted. The parser is
strict: anything else fails the content build with the document name and field path.

---

## 7.4 Duration semantics — when does an effect actually end?

This is where most implementations get it wrong. The source is explicit:

> *"For effects that state 'Lasts for X Turns' and 'Cooldown: X Turns', the Turn that the
> ability/skill/whatever was used is **not counted**. The count is started from the next Turn
> onwards."*

And provides the canonical trace:

```
Turn 4 (Red) Servant uses Charisma.        [0 Turns have passed]  [Cooldown: 0/9]
Turn 5 (Blue)                              [1 Turn has passed]    [Cooldown: 1/9]
Turn 6 (GM)                                [2 Turns have passed]  [Cooldown: 2/9]
Round 2 ends.
Turn 7 (Red)  [3 Turns have passed, effects of Charisma end at the end of the Turn]
                                                                   [Cooldown: 3/9]
```

Three things to extract:

1. **The turn of use is turn 0.** Counting starts the next turn.
2. **An effect with duration N expires at the END of the turn on which N turns have passed.**
   Charisma with `1◈` (= 3 ticks at 3 turns/round) is used on turn 4 and ends at the end of
   turn 7. It is active during turns 4, 5, 6, and 7 — four turns of presence for a
   three-tick duration.
3. **Cooldown counts the same way** but is *available* when the count reaches its maximum.

**DECISION.** Store absolute expiry, not a countdown. Countdowns require a write to every
effect on every turn boundary (28 units × 30 effects = 840 document writes per turn — a
non-starter). Absolute expiry is computed once at application time and compared on read.

```ts
interface Duration {
  startTurn: number;          // global turn index at application
  ticks: number | INFINITE;   // resolved from TickExpr
  expiryTurn: number;         // startTurn + ticks   (inclusive: expires at END of this turn)
  uses: number | null;        // for "X times" effects
  usesRemaining: number | null;
}

const isActive = (d: Duration, now: number) =>
  (d.ticks === INFINITE || now <= d.expiryTurn) &&
  (d.usesRemaining === null || d.usesRemaining > 0);
```

A **global turn index** — a monotonically increasing integer across the whole match — is the
backbone. `globalTurn = (round − 1) × turnsPerRound + turnInRound`. It never resets, so
arithmetic never has to handle round boundaries.

Foundry's `ActiveEffect.duration.start` natively records `{combat, combatant, initiative,
round, turn, time}` at creation, which gives us `startTurn` for free and survives reloads.

### The "does not take effect on the Turn it ends on" rule

Several effects carry this clause explicitly:

> **Regen:** *"Does not take effect on the Turn it ends on."*
> **NP Regen:** *"Does not take effect on the same Turn that it ends on."*

So a periodic effect fires on turns `startTurn+1 … expiryTurn−1`, not through `expiryTurn`.
This is a per-effect flag, not a global rule — Curse and Poison have no such clause.

```ts
interface PeriodicSpec {
  interval: TickExpr;               // "⅓◈", "1 turn", "round"
  on: "turnEnd" | "roundEnd" | "unitTurnEnd" | "actedTurnEnd";
  skipFinalTurn: boolean;           // the clause above
}
```

Note `on` has four values and they are genuinely different:
- `turnEnd` — every turn, any player's.
- `roundEnd` — once per round.
- `unitTurnEnd` — end of the *owner's* turn only.
- `actedTurnEnd` — end of any turn in which the unit Acted.

Van Gogh's Regen fires on *all three of* "end of the Unit's Turn, end of a Turn the Unit Acts,
and end of the Round" — so `on` is a **set**, not a scalar. And when both `unitTurnEnd` and
`actedTurnEnd` would fire on the same turn (the owner acted on their own turn), it must fire
**once**, not twice. Deduplication by `(effectId, globalTurn)` is mandatory.

---

## 7.5 Special duration values

### `this Turn`

Used by Nemo's *Great Ram Nautilus* (`apply NP DmUp for this Turn`) and Kingprotea's
*Airavata King Size*. Expires at the end of the current turn — i.e. `expiryTurn = startTurn`,
which under the "turn of use is turn 0" rule means it is active for the remainder of the
current turn and gone at its end. Correct and distinct from `1 turn`, which would survive into
the next turn.

### `X times` / `1 time`

A **use-limited** effect: `Evade for 2◈ Turns, 2 times`, `Debuff Immune for 1◈ Turns, 1 time`.
Both limits apply — it ends when either the ticks run out or the uses are spent.

The consumption rule is specified for the awkward multi-hit case:

> *"When a Unit with a buff that lasts for X times is hit by a single Attack that hits multiple
> times, that counts as only receiving one Attack and therefore, 1 time."*

So `usesRemaining` decrements per **Attack**, not per damage instance. The Combat Process
carries an `attackId`, and use-consumption is idempotent per `(effectId, attackId)`.

### `until event`

Semiramis's HGoB NP field (until HGoB is destroyed), Nemo's Zero Sail (until resurfacing),
Karna's Kavacha and Kundala (until Vasavi Shakti is used). Modelled as an effect with
`ticks: INFINITE` plus a subscription to a named event that removes it. See Appendix E.

### `permanent`

Vasavi Shakti's post-activation passives, Kiritsugu's `Kiritsugu` debuff. Never expires.

---

> **Implementation note.** A cooldown is set at **confirmation**, beside the cost, by
> `module/engine/cooldown.mjs` — one implementation shared by both use paths. They disagreed
> until Medea: the Skill path set a cooldown and `resolveAttack` never did, so **every Attack
> Skill and every Noble Phantasm in the game was infinitely reusable**, limited only by the attack
> budget, which is a different rule. Rule Breaker coming back off a `5◈+⅓◈` cooldown reading zero
> is what surfaced it.
>
> `alsoTriggers` (§7.6) rides the same helper. A **per-unit** cooldown is resolved against what
> the use produced rather than authored as a fixed tick — Medea's Dragon Tooth Warriors is
> "(Number of Warriors × ⅔◈)", so its cost is not known until the Skill has resolved.

## 7.6 Cooldowns

```ts
interface CooldownState {
  max: number;              // resolved ticks from the ability's TickExpr
  elapsed: number;          // turns passed since use
  get ready(): boolean { return this.elapsed >= this.max; }
}
```

Same "turn of use is turn 0" rule, same absolute-storage approach:

```ts
interface CooldownState {
  usedOnTurn: number | null;    // null = never used / ready
  max: number;
  readyOnTurn: number;          // usedOnTurn + max
}
```

**Modifiers to cooldown are pervasive** and come in several shapes:

| Shape | Example | Semantics |
|---|---|---|
| Reduce by N ticks | `Reduce NP Cooldown by 2◈ Turns` | `readyOnTurn -= n` |
| Reduce fully | CS `Full Cooldown` | `readyOnTurn = now` |
| Reset | Keyword: *"the Cooldown is set to its maximum value, not ended"* | `readyOnTurn = now + max` |
| Increase | Kiritsugu's *Chronos Rose*: `+1◈ to the DU's NP Cooldown` | `readyOnTurn += n` |
| Periodic reduction | `NP Regen`: `−1 turn at end of every Turn` **in addition to** the normal tick | `readyOnTurn -= 1` per fire |
| Stop reduction | `NP Lock` | pause the clock |
| Slow reduction | `NP Lag` | tick every other turn |

The last three cannot be expressed by adjusting `readyOnTurn` alone, because they change the
*rate* of time. **DECISION.** Cooldowns store `elapsed` explicitly and it is advanced by a
per-turn rate computed from active effects:

```ts
function cooldownRate(unit, ability): number {
  if (hasEffect(unit, "stop")) return 0;
  if (hasEffect(unit, "npLock") && ability.isNP) return 0;
  if (hasEffect(unit, "npLag") && ability.isNP) return (globalTurn % 2 === 0) ? 1 : 0;
  let r = 1;                                     // natural NP regen default = 1
  r += sumOf(unit, "npRegen", ability);          // NP Regen adds on top
  if (hasEffect(unit, "npDegen") && ability.isNP) r = -npDegenValue(unit);
  return r;
}
```

This is a write per ability per turn, which is bounded (≤ 10 abilities per unit) and only for
abilities actually on cooldown. Acceptable.

**Cap.** *"Effects which increase NP Cooldown cannot increase it past the maximum value unless
stated."* So `elapsed` clamps at `[0, max]` on increase.

### Cooldown scope rules

Two rules from the General Notes that content authors get wrong constantly:

> *"When a Unit is affected by an effect that reduces Skill/NP Cooldown, the effect affects
> **all** of that Unit's Skills/NPs unless stated by the effect."*

> *"Any Skill/Spell that is 'Categorized as Noble Phantasm' is affected by effects that affect
> NP Cooldown **and not** Skill/Spell Cooldown unless stated."*

```ts
function cooldownScopeMatches(effect: CooldownEffect, ability: Ability): boolean {
  if (effect.abilityIds) return effect.abilityIds.includes(ability.id);   // "stated"
  const isNPScoped = ability.isNP || ability.categorizedAsNP;
  return effect.scope === "np" ? isNPScoped : !isNPScoped;
}
```

### Mutually-exclusive cooldowns

The reference set has several abilities that lock each other:

- Van Gogh: `Het Gele Huis` (skill) and `Het Gele Huis: The Yellow House` (NP) — each
  "cannot be used if the other is on Cooldown".
- Scáthach: `Wisdom of Dún Scáith (Skill 1)`, `(Skill 2)`, `(Clairvoyance)` — mutually
  exclusive triple.
- Scáthach: `Gate of Skye` cannot be used if `Primordial Rune`, `Wisdom of Dún Scáith`, or
  `Gáe Bolg Alternative` are on cooldown, **and using it puts two of them on cooldown**.
- Karna: `Mana Burst (Flames)` / `Flash of the Sun God` — same-turn exclusion (not cooldown).
- Karna: `Brahmastra Kundala` puts `Mana Burst (Flames)` on cooldown when used.
- Scáthach: `Primordial Rune Spells` — using one blocks the other two until it is off cooldown.

Two distinct mechanisms:

```yaml
blockedBy:      [hetGeleHuisNP]        # cannot use while these are on cooldown
alsoTriggers:   [manaBurstFlames]      # using this puts these on cooldown too
sameTurnExclusive: [flashOfTheSunGod]  # cannot use both on the same turn
```

All three are declarative fields on the ability, validated for symmetry by the content build
(if A declares `blockedBy: [B]`, the build warns if B does not declare `blockedBy: [A]` and
the source implies mutual exclusion).

---

## 7.7 The scheduler

The scheduler is the component that turns "time passed" into effect firings. It runs on the
**GM client only** (authoritative), and broadcasts results.

### Turn boundary sequence

```
TURN N ENDS
 1. Fire onTurnEnd for the active player's units
 2. Fire onTurnEnd(acted) for ALL units that Acted this turn (any faction)
 3. Advance cooldown elapsed for all units, at each ability's computed rate
 4. Tick periodic effects due at turnEnd (dedup by effectId+turn)
 5. Evaluate expiry: effects with expiryTurn === N are removed  (AFTER their final tick,
    unless skipFinalTurn)
 6. Evaluate death/disappearance (Sustainability, Sacrifice, sustained damage)
 7. Increment globalTurn
TURN N+1 BEGINS
 8. Reset the incoming player's TurnBudget
 9. Reset per-unit turnState for the incoming player's units
10. Fire onTurnStart (Disorder's Skill Seal roll, Shock's action-loss roll)
11. Apply Delay reordering if any
```

Step ordering is load-bearing. In particular, **5 after 4**: an effect with one tick left
fires its final periodic effect and *then* expires — except where `skipFinalTurn` says
otherwise. And **2 covers all factions**: "the end of every Turn the Unit Acts" applies to
units that reacted during an enemy's turn.

### Round boundary sequence

```
ROUND R ENDS
 1. Fire onRoundEnd for all units
 2. Volatile debuff round ticks: Burn (50), Poison (stage damage), Freeze (100 ice),
    Crystalfreeze (100 fixed)
 3. Poison stage increment for units still poisoned at ROUND START (see below)
 4. Home Base regeneration: +100 HP, +1 AGI, for units in their base not involved in
    Combat there this Round
 5. Home Base debuff cure check: 3 consecutive full Rounds ⇒ cure all removable debuffs
 6. Resource gains on roundEnd (Fragarach Token, HGoB Construction d4+2)
 7. Platform upkeep (Golden Hind: Master −50 HP; deactivate if ≤50)
 8. Grail progress check
ROUND R+1 BEGINS
 9. Flip day/night phase
10. NP availability gate check (round ≥ 6, or ≥ 4 for Assassin)
11. Magic Crest gate check (round ≥ 3)
12. Poison staging (per its own rule: "If the Unit is still Poisoned at the start of a Round")
13. Random events (Civilian spawn on Lunatic)
```

Note Poison appears at both 3 and 12 — the source says damage at *end of Round* and staging at
*start of Round*, so they are separate steps and the order (damage before stage-up) matters
for the first round of exposure.

### Home base residency tracking

Rule 5 above requires knowing that a unit has been in its home base for *three consecutive
full Rounds*. That is a per-unit counter, incremented at round end if the unit is inside and
reset to 0 if it is not.

```ts
interface HomeBaseResidency {
  consecutiveRounds: number;
  combatThisRound: boolean;     // blocks the +100/+1 regen
}
```

`combatThisRound` is set by the combat engine whenever the unit participates in a Combat
Process inside its home base, and cleared at round start.

---

## 7.8 Delay — the turn-order mutation

`Delay+X` moves a *player's* turn down the order by X. It is the only effect that mutates the
schedule itself.

```
Players A..G, order A-B-C-D-E-F-G-GM.
During A's turn, A's unit inflicts Delay+2 on C's unit.
New order: A-B-D-E-C-F-G-GM.
```

Rules:
- If the affected player has **not** taken their turn this round, they are moved down by X
  *this round*.
- If they **have** already taken it, the shift applies *next round*.
- A player can never be moved past the GM.
- `Delay` is Unremovable.
- It is removed at the end of the round in which it took effect.

**Implementation.** The turn order is a derived array recomputed at round start (and on Delay
application), not a stored list:

```ts
function turnOrder(base: PlayerId[], delays: Map<PlayerId, number>, taken: Set<PlayerId>) {
  const pending = base.filter(p => !taken.has(p));
  for (const [p, x] of delays) {
    if (taken.has(p)) continue;               // applies next round instead
    const i = pending.indexOf(p);
    if (i < 0) continue;
    pending.splice(i, 1);
    pending.splice(Math.min(i + x, pending.length), 0, p);
  }
  return [...base.filter(p => taken.has(p)), ...pending, GM];
}
```

**RISK.** Delay interacts with `globalTurn` arithmetic. If a player's turn moves, the *number*
of turns in the round does not change, so `globalTurn` remains a clean counter and all
duration math is unaffected. Delay changes *who* acts at a given tick, not how many ticks
exist. This is why the global-turn-index design is worth the small indirection.

---

## 7.9 The NP and Magic Crest availability gates

Not durations, but round-indexed gates that live in this subsystem:

| Gate | Rule |
|---|---|
| Noble Phantasm | Usable after 5 full Rounds — i.e. **from Round 6**. Assassin: after 3 — **from Round 4**. |
| Magic Crest | Usable after 2 full Rounds — **from Round 3**. |
| First-round attacks | Neither faction may Attack during Round 1. |

Master essences shift the NP gate: `Kaleidoscope` −4 rounds (from Round 2),
`Imaginary Number` −3 (Round 3), `Leyline` −2 (Round 4), `Harvest` −1 (Round 5).

And there is an interaction the source calls out explicitly:

> *"If a Unit has its NP Cooldown increased before its NP would be available (i.e. before 5
> Rounds have passed), then its NP would only be usable X Turns after its NP would be
> available, X being the number of Turns its NP Cooldown was increased by."*

So the gate and the cooldown compose additively rather than the gate simply overriding:

```ts
function npAvailableOnTurn(unit, np): number {
  const gateRound = baseGateRound(unit) + essenceShift(unit);
  const gateTurn  = (gateRound - 1) * turnsPerRound + 1;
  return Math.max(gateTurn, np.cooldown.readyOnTurn);
}
```

`Force Noble Phantasm` (2 Command Spells) overrides cooldown but explicitly **not** the gate:
*"Cannot be used to force NP usage before 5 Rounds (or 3 Rounds for Assassin) have passed."*

---

## 7.10 Testability

The entire time model is pure arithmetic over integers and lives in L1 (Ch. 01 §1.7). It is
tested exhaustively rather than by sampling:

- `resolveTicks` is tested against a table of every expression appearing in the reference set,
  cross-multiplied with `turnsPerRound ∈ {3, 8, 15}` — roughly 40 × 3 = 120 assertions,
  all hand-verified against the source.
- Duration expiry is property-tested: for any `startTurn` and `ticks`, `isActive` is true for
  exactly `ticks + 1` consecutive turns.
- The scheduler is tested with a scripted timeline fixture: a list of `(turn, event)` pairs
  and the expected firing log.
- Delay reordering is property-tested for the invariant "no player ever appears twice, and the
  GM is always last".

Chapter 38 covers the harness.

---

## 7.11 Summary of decisions

| # | Decision |
|---|---|
| D7.1 | ◈ resolves via a published override table first, `floor` otherwise. |
| D7.2 | The turn of use is turn 0; effects expire at the *end* of `startTurn + ticks`. |
| D7.3 | Store absolute expiry turns, not countdowns. |
| D7.4 | A global monotonic turn index is the time base; rounds are derived from it. |
| D7.5 | Cooldowns store `elapsed` and advance at an effect-computed rate, to support NP Lock/Lag/Regen. |
| D7.6 | Periodic `on` is a **set** of trigger kinds, with per-turn deduplication. |
| D7.7 | Use-limited effects decrement per *Attack*, idempotently per attack id. |
| D7.8 | Turn order is derived from a base order plus a Delay map, recomputed, never stored. |
| D7.9 | The NP gate and NP cooldown compose with `max()`, not override. |

---

**Next:** [08 — Board and Geometry](08-board-and-geometry.md)
