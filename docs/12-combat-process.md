# 12 — The Combat Process

> **Implemented (Ch. 45 Phase A).** All six steps run. The Injury Roll (§12.6) reads the
> pipeline's `exceededInjuryThreshold` rather than re-comparing the total to 100, because Def
> Crk's bonus is added *after* the threshold snapshot. The AoE fan-out (§12.10) builds one
> Process per defender, sharing a `groupId`. The Counter (§12.8) is offered when eligible and
> resolved as a full nested Process, marked `isCounter` so it cannot be countered in turn.
>
> Interrupts (§12.11) land through Ch. 17's Command Spell protocol: `applyInterrupt` mutates the
> Process and the ladder resumes from wherever it left it.
>
> Still absent from §12.10's sketch: the **batched** damage pass. Damage is computed per Process
> rather than as one synchronous pure batch across all defenders — a performance shape, not a
> correctness one.

The Combat Process is the heart of the game and the most intricate piece of rules machinery in
it. This chapter transcribes the rulebook's steps into an explicit state machine, resolves the
ambiguities in the contest ladder, and specifies who decides what at each node.

---

## 12.1 Phase vs Process

> *"A Combat Process is a single instance of battle between the Attacking Unit and the
> Defending Unit(s), from Step 1 to Step 4. A Combat Phase includes the Combat Process that was
> initiated by the Attacking Unit, and any following Combat Processes if the Defending Unit(s)
> Counters."*

```
CombatPhase
 ├── CombatProcess #1   (AU → DU)     steps 1..6
 └── CombatProcess #2   (DU → AU)     steps 1..5, counter step omitted
                                      "Counters cannot be Countered again."
```

A Phase contains 1 or 2 Processes. For AoE attacks a Phase may contain **N+1** Processes — one
initiating, plus up to one counter per surviving defender in range.

State that resets per **Process**:
- `luckChecksUsed` — *"The same Luck Check can only be used once per Combat Process."*
- The reaction ladder position.

State that resets per **Phase**:
- Charm removal timing — *"the Charm debuff is removed from it at the end of the Combat Phase."*
- `Repel` damage — *"the AU receives X Fixed damage at the end of the Combat Process"* — per
  Process, actually. Worth noting the source uses both boundaries and they must be read
  literally each time.

---

## 12.2 The step list

Transcribed from *Rules — Combat*, with our numbering additions marked:

| Step | Name | Actor | Description |
|---|---|---|---|
| 1 | Declaration | AU | AU declares an Attack on DU |
| 2 | Reaction | DU | Do nothing / Block / Evade |
| 2.1 | Lucky Hit | AU | Luck Check to contest a successful Evade |
| 2.2 | Counter-contest | DU | Luck Check to contest 2.1 |
| 2.3 | Accept or Escape | DU | Accept the outcome, or spend a Command Spell |
| 2.4 | Lucky Evasion | DU | Luck Check to contest a *failed* Evade |
| 2.5 | Counter-contest | AU | Luck Check to contest 2.4 |
| 3 | Damage Step | AU | Coin flip → Attack+ / Attack−, compute and apply damage |
| 4 | Injury | DU | Injury Roll if damage > 100 and DU survived |
| 5 | Facing | DU | DU turns to face the AU (not for AoE) |
| 6 | Counter | DU | If in range and eligible, declare a counter-attack |

Steps 2.1–2.5 are our numbering of the rulebook's own sub-steps; the rulebook labels them
identically. Step 5 and 6 are numbered by us (the rulebook describes them as "5." and "6." in
the same list but calls the Process "Steps 1 to 4" elsewhere — a source inconsistency,
Ch. 41).

---

## 12.3 The reaction ladder as a state machine

This is the part that must be exactly right. Reading the source literally:

```
                          ┌───────────────────┐
                          │ 1. AU declares    │
                          └─────────┬─────────┘
                                    ▼
                          ┌───────────────────┐
                          │ 2. DU reacts      │
                          └──┬────────┬───────┘
              (a) nothing    │        │  (c) Evade
              (b) Block ─────┤        │
                             │        ▼
                             │   ┌─────────────────────────┐
                             │   │ Evade roll              │
                             │   │ table = (DU.agi ≥ AU.agi)│
                             │   │       ? "Evade" : "Evade-"│
                             │   │ success = roll < DU.agi  │
                             │   └────┬──────────────┬─────┘
                             │        │ SUCCESS      │ FAIL
                             │        ▼              ▼
                             │  ┌───────────┐  ┌───────────┐
                             │  │ 2.1  AU   │  │ 2.4  DU   │
                             │  │ Lucky Hit │  │ Lucky Eva.│
                             │  │ luck check│  │ luck check│
                             │  └──┬─────┬──┘  └──┬─────┬──┘
                             │ FAIL│     │SUCCESS │SUCC │FAIL
                             │     ▼     ▼        ▼     ▼
                             │  ┌─────┐ ┌──────────┐  ┌──────────┐
                             │  │ NO  │ │ 2.2  DU  │  │ 2.3  DU  │
                             │  │DMG  │ │ contest  │  │ accept   │
                             │  │→ S5 │ │luck check│  │ or CS    │
                             │  └─────┘ └──┬────┬──┘  └──┬────┬──┘
                             │       SUCC  │    │FAIL    │    │CS
                             │             ▼    ▼        ▼    ▼
                             │        ┌─────┐ ┌────────┐ │  ┌─────┐
                             │        │ NO  │ │  2.3   │ │  │ NO  │
                             │        │DMG  │ │        │◀┘  │DMG  │
                             │        │→ S5 │ └────────┘    │→ S5 │
                             │        └─────┘               └─────┘
                             │
                             │   [2.5 AU contest, reached from 2.4 SUCCESS]
                             │     AU luck check:
                             │       SUCCESS → 2.3   (DU must accept or spend CS)
                             │       FAIL    → NO DMG → S5
                             ▼
                    ┌───────────────────┐
                    │ 3. Damage Step    │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ 4. Injury Roll    │  if dmg > 100 and DU alive
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ 5. DU faces AU    │  not for AoE
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ 6. Counter?       │  if DU evaded OR survived, and AU in DU's range
                    └───────────────────┘
```

### The ladder in prose

**If the Evade succeeds**, the attacker gets one chance to "luck through" it (2.1). If the
attacker fails, the attack whiffs entirely. If the attacker succeeds, the defender gets one
chance to re-negate (2.2). If the defender succeeds, the attack whiffs. If the defender fails,
the defender is out of luck-based options and reaches 2.3: accept the hit, or burn a Command
Spell to teleport/escape.

**If the Evade fails**, the defender gets one chance to luck out of it (2.4). If the defender
fails, straight to 2.3. If the defender succeeds, the *attacker* gets a chance to re-negate
(2.5). If the attacker succeeds, the defender is back at 2.3. If the attacker fails, the
attack whiffs.

Symmetric, two rungs deep on each side, terminating in 2.3.

### Formal transition table

```ts
type LadderState =
  | "declare" | "react" | "evadeRoll"
  | "s21_luckyHit" | "s22_duContest" | "s23_acceptOrEscape"
  | "s24_luckyEvasion" | "s25_auContest"
  | "damage" | "noDamage" | "injury" | "facing" | "counter" | "done";

const TRANSITIONS: Record<string, LadderState> = {
  "react:nothing":            "damage",
  "react:block":              "damage",        // block reduces damage at stage 12
  "react:evade":              "evadeRoll",

  "evadeRoll:success":        "s21_luckyHit",
  "evadeRoll:fail":           "s24_luckyEvasion",

  "s21_luckyHit:fail":        "noDamage",
  "s21_luckyHit:success":     "s22_duContest",
  "s21_luckyHit:declined":    "noDamage",

  "s22_duContest:success":    "noDamage",
  "s22_duContest:fail":       "s23_acceptOrEscape",
  "s22_duContest:declined":   "s23_acceptOrEscape",

  "s24_luckyEvasion:success": "s25_auContest",
  "s24_luckyEvasion:fail":    "s23_acceptOrEscape",
  "s24_luckyEvasion:declined":"s23_acceptOrEscape",

  "s25_auContest:success":    "s23_acceptOrEscape",
  "s25_auContest:fail":       "noDamage",
  "s25_auContest:declined":   "noDamage",

  "s23_acceptOrEscape:accept":"damage",
  "s23_acceptOrEscape:cs":    "noDamage",

  "damage:done":              "injury",
  "injury:done":              "facing",
  "noDamage:done":            "facing",
  "facing:done":              "counter",
  "counter:done":             "done",
};
```

Every rung is **optional** — a `declined` transition exists for each Luck Check, because Luck
is a finite resource and a player may not want to spend it. The UI presents each as
"Contest (costs 1 Luck, current 7) / Decline".

**RISK.** Five sequential prompts across two clients is a lot of latency for one attack. Two
mitigations: (a) an "auto-decline luck checks below N% success" per-player setting, and (b)
an "auto-accept" fast path when the defender has no Luck, no Command Spells, and no
Dodge/Invuln — in which case the whole ladder collapses to a single prompt. In practice most
attacks resolve in one or two prompts.

---

## 12.4 Step 2 — the reaction, in detail

### Evade

```ts
function evadeRoll(du, au, ctx): { success: boolean; value: number } {
  if (hasEffect(du, "dodge")) return { success: true, value: 0 };   // automatic
  if (hasEffect(au, "aim"))   return { success: false, value: 99 }; // Aim beats Dodge and Evade
  if (hasEffect(du, "substitution")) return { success: true, value: 0 }; // beats Aim

  const table = du.agility.value >= au.agility.value ? "evade" : "evade-";
  let v = roll(table);

  v += ctx.isNP        ? 3 : 0;
  v += ctx.isAoE       ? 2 : 0;
  v += ctx.side === "left" || ctx.side === "right" ? 1 : 0;
  v += ctx.side === "back" ? 2 : 0;
  v += presenceConcealmentBonus(au);        // +2..+4 by rank
  v += sumOf(du, "aglDwn") - sumOf(du, "aglUp");
  v += sumOf(au, "tecUp") - sumOf(au, "tecDwn");
  v += hasEffect(du, "slow") ? 2 : 0;
  v += hasEffect(du, "immobilize") ? 4 : 0;
  v += hasEffect(du, "blind") ? 3 : 0;
  v += deafenDelta(du, au);
  v += hasEffect(du, "crystallize") ? roll("1d6") : 0;

  return { success: v < du.agility.value, value: v };
}
```

Precedence, from the effect texts:

```
Substitution > Aim > Dodge > (roll)
```

- *"A Unit affected by Aim is able to ignore the effects of Dodge on an enemy Unit and the
  Evade action of the enemy Unit."*
- *"Substitution … cannot be hit by all Attacks including NP and Fixed damage; even if the AU
  has Aim … If a Unit has both Substitution and Dodge when Attacked, Substitution takes
  priority."*

Also: *"A Unit with Dodge cannot use the Evade action"* — Dodge replaces Evade, it does not
add to it. And: *"If a Unit with the Dodge buff is made to perform an Evade roll (and
specifically an Evade roll, not Agility Check), then the Dodge buff will apply and perform an
automatic successful Evade."*

Note the last clause distinguishes **Evade rolls** from **Agility Checks**. Note 12 in the
General Notes: *"All Evades are Agility Checks, but not all Agility Checks are Evades."*
So Dodge fires on Evades but not on, say, the Cover shove check or the HGoB knock-off check.
`AgilityCheckKind` is an explicit parameter to the check resolver (Ch. 14).

### Block

```ts
function blockReduction(du, ctx): number {
  // Block is a flat percentage, NOT a roll (Ch. 41 Q1, revised 0.2.0).
  let pct = BLOCK_BASE_PERCENT;                      // 25
  pct += sumOf(du, "blockUp");                       // Block Up adds percentage points
  if (luckCheck(du, "strengthenBlock").success)
    pct += BLOCK_BASE_PERCENT;                       // "use the Block value again"
  return pct;                                        // applied at pipeline stage 14
}
```

**Block is 25%, and it is *not* doubled against Noble Phantasms.** The earlier draft had Block
as a dice roll doubled against NP; the game's author replaced it with a flat percentage that is
the same value for NP. The rulebook's *"When Blocking Noble Phantasms, double the value of the
Block roll"* is therefore superseded.

- *"A Unit with Invuln cannot use the Block action."*
- *"Pierce … ignore the effects of Invuln on an enemy Unit and the Block action."*
- `Break` — *"has a chance to ignore Block, and deals extra damage if the Attack was Blocked."*

`Luck Check: Strengthen Block` is one of the eight named Luck Checks and rolls Block a second
time on success.

### Do nothing

Skips to Step 3. Chosen when the defender wants to preserve Luck/Agility, or when they have
`Invuln`/`Anti-Purge` and reactions would be wasted.

---

## 12.5 Step 3 — the Damage Step

Full pipeline in Chapter 13. Here, its boundaries, because a large number of effects trigger
on them:

```
DAMAGE STEP
 ├── onDamageStepStart
 │     • Kingprotea's Monstrous Strength (used at the start of a Damage Step)
 │     • Kiritsugu's Suppression buff (removes 1 buff from the DU at the start)
 │
 ├── Crit determination (coin flip, modified by crit chance)
 ├── Damage computation (Ch. 13)
 ├── Damage application
 │
 └── onDamageStepEnd
       • Def Dwn (A): Luck −1 · Def Dwn (C): Agility −1
       • Semiramis's Queen's Poison: inflict Poison, remove the effect
       • Castor's Twin God's Divine Core: 5% chance of NP cooldown −1
       • Scáthach's Alpi buff: NP cooldown reduction
       • Dmged NP Regen
       • "Apply X at the end of the Damage Step" — the general form
```

The General Notes are explicit that this boundary is where post-hit effects land:

> *"Whenever an effect states 'Apply X after dealing damage', X is applied to the target
> **regardless of whether damage is dealt or not** unless stated. Slowly working to replace
> this with 'Apply X at the end of the Damage Step'."*

**Critical:** the effect applies even at zero damage. So an attack fully absorbed by `Invuln`
still inflicts its rider debuffs — and `Invuln`'s own text confirms it:
*"Does not prevent debuffs from Attacks even if no damage was taken!"*

### Crit determination

Base 50% (a coin flip). Modified by:
- `Crit Up` / `S.Crit Up` / `Crit Dwn` (target's `Crit Guard` reduces it)
- `Bal Dwn (X%)` on the DU increases the AU's crit chance by X
- `G.Crit` forces a crit; `No Crit` forbids one
- **None of these affect NP unless stated** — repeated across every crit effect
- `Over Crit`: if crit chance exceeds 100%, the excess becomes crit damage

```ts
function critChance(au, du, ctx): number {
  if (ctx.isNP && !ctx.abilityAllowsCritMods) return 0;      // NPs do not crit by default
  if (hasEffect(au, "noCrit")) return 0;
  if (hasEffect(au, "gCrit"))  return 100;
  let c = 50;
  c += sumOf(au, "critUp") + sumOf(au, "sCritUp");
  c += areaCritUp(au, board) * (hasEffect(au, "clarity") ? 2 : 1);
  c -= sumOf(au, "critDwn");
  c -= sumOf(du, "critGuard");
  c += balDwn(du);
  c += masterEssenceCrit(au);
  return c;   // NOT clamped here — Over Crit reads the excess
}
```

**Important:** the NP question. The rulebook says NPs use *"the 'Attack+' roll"* or
*"the 'Attack−' roll"* determined by a coin flip, exactly like normal attacks. So NPs **do**
crit — they are just not affected by crit-*chance* modifiers. The base 50% coin flip applies.

**DECISION.** `critChance` for an NP returns a flat 50 unless an effect explicitly states it
affects NP. Corrected from the code sketch above; the flag is `ctx.isNP ⇒ ignore modifiers`,
not `⇒ zero`. Recorded in Ch. 41 as a reading to confirm.

---

## 12.6 Step 4 — the Injury Roll

> *"If the DU survives but takes damage from the Attack and the damage received is greater than
> 100, perform an Injury Roll. Decrease the DU's Agility by that value."*

Conditions, all required:
1. The DU survived (`health > 0` after damage).
2. Damage was actually taken (`> 0`).
3. Total damage `> 100` — strictly greater.

Refinements:
- `Def Crk`'s bonus damage *"does not count towards the amount required for an Injury Roll"* —
  so the threshold test uses damage *before* the Def Crk addition.
- Multi-hit attacks (`Multihit`, `DblAtk Up`, `TrplAtk Up`, Nemo's `Quickfire`, HGoB's
  `Dragon Wing Warriors`, Mannanán's `Toole Fragarach`) perform **one** Injury Roll on the
  total.
- `Luck Check: Light Wound` can cancel it entirely.
- Golden Hind: *"Agility: 10 (Only performs Injury Roll when damaged by NP)"* — a per-unit
  override.

---

## 12.7 Step 5 — facing

> *"At the end of the Combat Process, the DU turns to face the AU/the Direction it was Attacked
> from. **Does not apply to AoE Attacks.**"*

Applies even when the attack missed entirely (the step is reached from `noDamage`). Simple, but
it means facing changes are a routine part of combat and the token rotation animates on almost
every exchange.

For a multi-panel AU, "the direction it was attacked from" uses the nearest occupied panel.

---

## 12.8 Step 6 — the Counter

> *"If the DU successfully Evaded the Attack **or survives** the Attack and the AU is within the
> Range of the DU, the DU may use the 'Counter' Action and declare an Attack on the AU. Steps 1
> and 4 of Combat are repeated, but with the roles reversed."*
> *"Counters cannot be Countered again."*

Eligibility:

```ts
function canCounter(du, au, ctx): boolean {
  if (ctx.isCounter) return false;                        // no counter-counters
  if (du.health.value <= 0) return false;                 // must survive
  if (!inAttackRange(du.position, au.position, du.range.panels)) return false;
  if (isBound(du)) return false;                          // Stun/Freeze/etc.
  if (hasEffect(du, "berserk") && !ctx.allowsBerserkCounter) return false;
  if (presenceConcealmentActive(au) && rankOf(du,"agi") < rankOf(au,"agi")) return false;
  if (hasEffect(au, "accel")) return false;               // "cannot React"
  if (ctx.sleepRemovedThisPhase) return false;            // Sleep: "cannot Counter"
  if (hasEffect(du, "fragarach")) return false;           // "cannot perform a normal Counter"
  return true;
}
```

Note *"Steps 1 and 4 are repeated"* — the source says 1 and 4, which would skip the reaction
ladder and the damage step. That is clearly a typo for "Steps 1 **to** 4"; a counter that
cannot be evaded and deals no damage is nonsense, and the Instant Counter keyword explicitly
describes skipping to Step 3 as its *special* property (*"skip straight to Step 3 of Combat"*),
which only makes sense if a normal counter does not skip. **DECISION.** A counter runs the full
Process. Ch. 41.

### Master redirect

> *"If a Master performs an Attack on an enemy Unit and the enemy Unit decides to Counter, the
> Counter Attack cannot be used on the Master if its Servant is within a 2 panel area of
> itself, the Counter Attack is **redirected** to that Master's Servant instead."*

A retarget, not a refusal. The counter proceeds against the Servant, and the Servant's range
eligibility is *not* re-checked against the counter-attacker (the redirect is mandatory).
**RISK.** What if the Servant is out of the counter-attacker's range? The source does not say.
**DECISION.** The redirect succeeds regardless of range, because the rule is written as an
absolute protection. Ch. 41.

### Automatic counters

| Effect | Behaviour |
|---|---|
| `Auto Counter` | Automatically counters any attack |
| `Dodge Counter` | Automatically evades a **non-AoE** attack, then counters |
| `Guard Counter` | Automatically blocks, then counters |
| `Instant Counter` (keyword) | Skips to Step 3 — no reaction ladder for the counter |
| Mannanán's `Fragarach` | Replaces the normal counter; 2.5× BA(STR), unblockable, unevadable except by Dodge, deals NP damage, triggers on being attacked **or debuffed** |

All automatic counters share the move-into-range clause (Ch. 09 §9.10) and all are negated by
`Addle`.

---

## 12.9 Special combat modes

### Servant attacks Master — Overpower

Inserted between Step 2 and Step 3:

```
2.9  If AU is a Servant and DU is a Master and the attack succeeded:
       if DU has Invuln or Shield → skip (cannot be Overpowered)
       chance = 50 − (DU has Def Up or Dmg Cut ? 10 : 0)
       flip:
         Heads → Master instantly defeated (offer Luck Check: Master's Luck first)
         Tails → proceed to Step 3
```

`Luck Check: Master's Luck` is offered both here **and** when normal damage would be lethal:
> *"Used when a Master is Attacked by a Servant and would be Overpowered; **or** if damage
> received from that Servant's Attack would defeat the Master. … If Successful, the Master is
> not instantly defeated and takes normal damage; and if that normal damage would have defeated
> the Master, it survives with 1 Health."*

So one successful check covers both the Overpower and the lethal-damage case in the same
attack.

### Master attacks Servant — Underpower

Applied at the end of the damage computation:

```
chance = 50 − (AU has Atk Up or NP DmUp ? 10 : 0)
flip:
  Heads → normal damage
  Tails → Total Damage halved, including NP
```

Note this operates on **Total Damage** — after every other modifier. It is stage 14 in the
damage pipeline.

### Noble Phantasm

Modifications to the Process when the attack is an NP:
- Evade rolls +3.
- Block rolls doubled.
- `Lucky Hit` and `Lucky Evasion` require **two consecutive successful** Luck Checks.
- Master loses Health by NP Rank × Master Rank before resolution; the NP is unusable if the
  Master's Health is ≤ the cost.
- Requires the Servant to be within its Master's ZON.
- Requires the round gate (Ch. 07 §7.9).
- Hits allies too unless stated; excludes the user unless stated (Note 11).
- `Cover` applies for Masters caught in AoE NPs (Ch. 16).
- Counts as the unit's Attack for the turn even if non-damaging.

### AoE

- Evade rolls +2.
- No facing update (Step 5 skipped).
- One `Lucky Hit` Luck Check affects only one DU: *"If the Attack was an AoE Attack, one 'Lucky
  Hit' Luck Check can only affect one DU per Luck Check."*
- Each DU runs its own reaction ladder independently.
- Resistance rolls are per-(unit, debuff).
- Concealed units resolve by coin flip instead of being excluded.

**Ordering across defenders.** With N defenders, do we run N complete ladders sequentially, or
all Step-2 reactions, then all Step-3 damages? **DECISION.** Reactions are collected in
parallel (all defenders prompted simultaneously), then damage is computed and applied in a
single batch. This is both faster and correct — no defender's outcome depends on another's,
except via the Lucky Hit one-DU-per-check rule, which is handled by making the attacker choose
the target of each Lucky Hit.

---

## 12.10 The AoE fan-out

```
CombatPhase (AoE)
 ├── resolve targets                     (Ch. 09)
 ├── per DU: build AttackContext
 ├── parallel prompt: all DUs choose react
 ├── collect evade rolls
 ├── attacker's Lucky Hit budget: one check per DU it wishes to contest
 ├── per DU: complete the ladder
 ├── batch: compute damage for all DUs        (pure — Ch. 13)
 ├── batch: apply damage + effects             (one intent list)
 ├── per DU: injury rolls
 ├── (no facing updates)
 └── counter opportunities, sequentially in turn order
```

The batch damage computation is the payoff for the pure pipeline: 12 defenders resolve in one
synchronous pass with no I/O.

---

## 12.11 Interrupts

Command Spells are the only mechanism that can interrupt an in-flight Process:

> *"Command Spells can be used at any time at all, even if it were to interrupt an ongoing
> process, such as Combat. Command Spells **overwrite/interrupt all other processes**."*

The state machine therefore supports a **suspend/resume**:

```ts
interface Interrupt {
  atState: LadderState;
  by: { userId: string; masterId: string };
  command: CommandSpellKind;
  effect: InterruptEffect;
}

type InterruptEffect =
  | { kind: "retarget"; newTargetId: string }        // CS: Teleport Servant
  | { kind: "escape" }                               // CS: Escape → noDamage
  | { kind: "modifyDamage"; factor: number }         // CS: Damage Block / Halve NP
  | { kind: "heal" }                                 // CS: Half/Full Heal
  | { kind: "survive"; fraction: number }            // CS: Survive Kill
  | { kind: "boostDamage"; factor: number };         // CS: Damage Up / NP Max
```

Several have timing restrictions the engine enforces:
- `Half Heal` / `Full Heal`: *"Cannot be used during a Damage Step if the damage dealt would
  defeat the Servant."* So they are blocked at `state === "damage"` when lethal.
- `Survive Kill`: *"Used when the Master's Servant would be defeated by an Attack and has no
  other method of revival."* So it is only offered after all revival sources are exhausted.
- `Damage Block`: *"Cannot be used against NP."*

`CS: Teleport Servant` is the most disruptive:
> *"When CS: Teleport Servant is used by a Master when it is Attacked, the AU's target is
> switched to the newly-teleported Servant. The newly-teleported Servant **cannot use Evade or
> Block** in this Combat Process."*

So the Process retargets mid-ladder and the new target enters at `react` with two of three
options removed. This is why the target list on `CombatPhase` is mutable.

---

## 12.12 Serialization and resumption

A Combat Process may span minutes of real time across three clients (attacker, defender, GM)
with a possible Command Spell interrupt from a fourth. It must survive a client reload.

**DECISION.** Adopt and formalize the prototype's step-per-message pattern:

- Each ladder transition creates a **new** `ChatMessage` whose flags carry the serialized
  `CombatProcess` state.
- The message's `whisper` targets the user whose decision is next.
- No client ever updates a document it does not own; the "next actor" reads state from the
  message, decides, and creates the *next* message.
- The GM client is the arbiter for rolls that must not be visible (the Discover roll,
  concealed-AoE coin flips).

Serialized state:

```ts
interface CombatProcessState {
  phaseId: string;
  processIndex: number;
  attackerUuid: string;
  defenderUuids: string[];
  ladder: Record<string, LadderState>;      // per-defender position
  context: AttackContext;                   // ability, multipliers, flags
  rolls: RollRecord[];                      // every roll so far, for audit
  luckChecksUsed: Record<string, string[]>; // per-unit, per-process
  interrupts: Interrupt[];
  version: number;                          // schema version
}
```

Chapter 27 specifies the message protocol, the timeout behaviour, and the reconnection story
in detail.

---

## 12.13 Worked example

**Karna (AGI A, Agility 19/20, BA(STR) 125, Divinity A +50) normal-attacks Heracles
(AGI A, Agility 16/19, Mad Enhancement B permanently active, Battle Continuation A) from
Heracles's left side, at night. Karna is inside his Master's ZON.**

```
STEP 1  Karna declares. Range 2, Heracles at distance 1. Legal.
        Karna's normal attack uses BA(STR) = 125 (he is not a Caster).

STEP 2  Heracles chooses Evade.
        Karna's Agility 19, Heracles's 16 → 16 < 19 → table = "Evade-"
        Mad Enhancement clause 6: "can only Evade with Evade-" → already Evade-
        Roll Evade-  → 14
        Modifiers: +1 (attacked from the left)                      → 15
        15 < 16 ? YES → EVADE SUCCEEDS

STEP 2.1  Karna may contest with Luck Check: Lucky Hit.
          Karna's Luck (D-derived, say 6), Heracles's Luck (A-derived, say 18)
          6 < 18 → table = "Luck Check-"
          Karna's player accepts the odds. Roll → 9.  9 < 6? NO → FAIL.
          Karna's Luck 6 → 5.
          → NO DAMAGE

STEP 5  Heracles turns to face Karna.

STEP 6  Heracles evaded and Karna is within Heracles's Range
        (1 base + 1 from Mad Enhancement = 2). Counter available.
        Heracles declares a counter → CombatProcess #2, roles reversed,
        Step 6 omitted.
```

Note how much of that came from data: the Evade− selection from a *current-agility* comparison,
the +1 from facing geometry, Mad Enhancement's clause 6 as a rule element, the Luck Check−
table from a *current-luck* comparison, the Luck decrement, and the counter range including
Mad Enhancement's `Range +1`. No branch in the engine mentions Karna or Heracles.

---

## 12.14 Summary of decisions

| # | Decision |
|---|---|
| D12.1 | The reaction ladder is an explicit state machine with a `declined` transition on every optional rung. |
| D12.2 | Precedence lattice: Substitution > Aim > Dodge; Anti-Purge > Pierce > Invuln. |
| D12.3 | NPs crit on the base 50% coin flip but ignore crit-chance modifiers unless stated. |
| D12.4 | A Counter runs the full Process (the source's "Steps 1 and 4" is read as "1 to 4"). |
| D12.5 | The Master counter-redirect succeeds regardless of the counter-attacker's range. |
| D12.6 | AoE reactions are prompted in parallel; damage is computed and applied in one batch. |
| D12.7 | Command Spells suspend and resume the state machine; the target list is mutable for `Teleport Servant`. |
| D12.8 | Process state is serialized into a chain of chat messages, one per transition, whispered to the deciding user. |
| D12.9 | Post-hit rider effects apply even at zero damage, per the General Notes and Invuln's own text. |

---

**Next:** [13 — The Damage Pipeline](13-damage-pipeline.md)
