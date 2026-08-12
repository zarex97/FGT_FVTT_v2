# 18 — Action Economy

A player commands up to 14 units but may only act with a handful each turn. The budget is the
game's core constraint and the thing that makes it chess-like rather than a brawl. This
chapter specifies the budget, what consumes it, and the forced-action effects that spend it
against the player's will.

---

## 18.1 The budget

> *"During a Faction's Turn, the Faction may Move a maximum of **4 Servants** and **3 Masters**,
> but is only allowed a maximum of **2 Servant Attacks** (no limit on Master Attacks, but only
> once per Turn for each Master)."*
> *"Note that the Units that Move do not need to be the same Units that Attack. A Unit can only
> Move and/or Attack once per Turn."*

```ts
interface TurnBudget {
  servantMoves:   { used: number; max: 4 };
  masterMoves:    { used: number; max: 3 };
  servantAttacks: { used: number; max: 2 };
  masterAttacks:  { used: number; max: Infinity };   // once per Master, enforced per-unit
}
```

Read carefully, this is four independent pools:

- Up to 4 Servants may **move**.
- Up to 3 Masters may **move**.
- Up to 2 Servants may **attack**.
- Any number of Masters may attack, but each Master only once.
- Each individual unit may move once and attack once.

So a player can move 4 Servants and have 2 *different* Servants attack — six Servants active in
a turn. Or the same 2 Servants can move and attack, leaving 2 more moves for others.

**The budget is per-Faction, per-Turn.** In the 7-player format each player controls one
Master–Servant pair and takes their own Turn, so the budget is effectively unlimited relative
to their roster; in the 3-player format one player commands seven pairs and the budget bites
hard. Both are supported by making the budget a per-Combatant (per-player) value, with the
maxima configurable per ruleset.

---

## 18.2 What consumes budget

```ts
type BudgetConsumer =
  | "servantMove" | "masterMove" | "servantAttack" | "masterAttack" | "none";
```

| Action | Consumes |
|---|---|
| Move a Servant | `servantMove` |
| Move a Master | `masterMove` |
| Servant Normal Attack | `servantAttack` |
| Servant Attack Skill | `servantAttack` (*"usually count as the Unit's Attack for the Turn unless stated"*) |
| Servant Damage Spell | `servantAttack` (same clause) |
| Servant Noble Phantasm | `servantAttack` (*"count as the Unit's Attack for that Turn, regardless of whether the NP deals damage or is a non-damaging NP unless stated"*) |
| Master Normal Attack | `masterAttack` |
| Master Magic Crest | `masterAttack` |
| Active Skill (non-attack) | **one unit slot** — see §18.3 |
| Counter | **nothing** — it is a Reaction on someone else's turn |
| Evade / Block | nothing |
| Riding Attack | `servantAttack` (*"Counts as a Normal Attack"*) plus the movement it consumes |
| `Gather` (Semiramis) | `servantMove` (*"Using 'Gather' counts as a Unit's 'Move' for that Turn"*) |
| Summon acting (Bašmu) | **nothing** (*"Bašmu do not count towards the number of Units who Move/Attack in a Turn"*) |
| Platform acting (HGoB) | **nothing** (*"does not count towards number of Units who Move or Act in a Turn"*) |

Note the non-damaging NP clause: using a purely supportive NP like Van Gogh's *De Sterrennacht*
still consumes a Servant Attack. That is a real cost and the UI must show it before confirming.

---

## 18.3 The Active Skill question

The ambiguous rule (Ch. 15 §15.3):

> *"Only a Unit that has Moved or Attacked during its Turn may use its Active Skills; similarly,
> a Unit that has used an Active Skill counts towards the number of Units who Move or Attack
> during that Turn."*

**DECISION** (restated): the second clause is the operative rule; the first is read as a
garbled restatement of it. Using an Active Skill consumes **one unit slot** — and the question
is *which pool*.

Neither is stated. Three candidate readings:

| Reading | Consequence |
|---|---|
| (a) It consumes a `servantMove` | A player can use 4 skills, or 2 skills + 2 moves, etc. |
| (b) It consumes a `servantAttack` | Only 2 skills per turn — very restrictive given how skill-dense the reference Servants are |
| (c) It consumes from whichever pool has room, player's choice | Most flexible |

**DECISION.** Reading (a): an Active Skill consumes a **move** slot from the appropriate pool
(servant or master). Rationale: reading (b) would make Servants like Scáthach or Karna — who
have five or six active skills each — nearly unusable, and the rules already have a separate,
explicit attack budget for damage. Reading (c) invites confusion.

If a unit both moves and uses a skill in the same turn, that is **one** slot, not two — the
budget counts *units*, not actions (*"the number of Units who Move or Attack"*). So the budget
consumer is recorded per-unit and set once:

```ts
function consumeBudget(unit, action, budget): Result {
  if (unit.turnState.countedAgainstBudget !== null) return OK;   // already counted this turn
  const pool = poolFor(unit.kind, action);
  if (budget[pool].used >= budget[pool].max) return Refused(pool);
  budget[pool].used += 1;
  unit.turnState.countedAgainstBudget = pool;
  return OK;
}
```

Attacks are the exception: they consume from `servantAttack` **in addition** to the unit having
been counted for movement, because the source states them as separate maxima. A Servant that
moves and attacks consumes one `servantMove` and one `servantAttack`.

Recorded in Ch. 41 as Q5, with all three readings documented so the game's author can rule.

---

## 18.4 Per-unit limits

Independent of the faction budget, each unit has its own limits:

```ts
interface UnitTurnState {
  moved: boolean;
  movedPanels: number;
  moveSegments: number;         // Riding permits 2
  attacked: boolean;
  usedActiveSkill: boolean;
  acted: boolean;
}
```

> *"A Unit can only Move and/or Attack once per Turn."*
> *"A Unit may either Move before Attacking, or Attack before Moving."*

So order is free but each is once — except under Riding.

### Riding's double move

> *"The Servant is able to Move twice in one turn **if it Attacks in that turn** (before and
> after the Attack). However, the total number of panels Moved during both times cannot exceed
> its MOV."*

```
Legal:    move(3) → attack → move(2)     with MOV ≥ 5
Legal:    attack → move(5)
Legal:    move(5) → attack
Illegal:  move(3) → move(2)              (no attack between)
Illegal:  move(4) → attack → move(4)     with MOV 6 (total exceeds MOV)
```

The UI enforces this by disabling the move button after the first segment until an attack has
occurred, and by showing remaining panels as `MOV − movedPanels`.

### Riding Attack's interaction

> *"the Servant cannot Attack after it has stopped, and neither can it Move a second time after
> using a Riding Attack."*
> *"If the Unit has already Moved during its Turn and intends to use Riding Attack, the number
> of panels it can Move for its Riding Attack is equal to its MOV minus the number of panels it
> has already Moved."*

So Riding Attack is a terminal action for that unit's turn, and its length draws from the same
budget.

---

## 18.5 Forced actions

Several effects **compel** a unit to act, spending budget the player did not choose to spend.
This is the mechanically nastiest part of the action economy and it needs careful handling.

### The compulsion effects

| Effect | Compulsion |
|---|---|
| `Berserk` | *"A Unit inflicted with Berserk **has** to Move and Attack on its Turn if able"* |
| `Decoy` (on an enemy) | *"**has** to Attack the Unit with Decoy if it is able to"* |
| Penthesilea's *Hatred of Achilles* | *"she will constantly Move towards and Attack said Unit … This counts towards the number of Units that Move and/or Attack during your Turn"* |
| Karna's *Fated Rivals* | *"If Arjuna is on the opposing Faction and within Range of Karna, they will only Attack each other"* |
| `Charm` | Control switches to the enemy player entirely |
| `Confuse` | *"At the end of its Player's Turn, it will perform random Actions"* |

### The multi-unit clause

Both `Berserk` and `Decoy` carry the same qualifier:

> *"if there are multiple Units on the board capable of Attacking in the same Turn and the player
> performs any Attacks, the Unit affected must be one of the Attackers."*

Read precisely: the compulsion is **conditional on the player attacking at all**. A player who
attacks with nobody is not forced to attack with the compelled unit. But if they attack with
anyone, the compelled unit must be among the attackers.

That is a *constraint on the turn as a whole*, not on an individual action — which means it
cannot be validated action-by-action. It must be validated at **turn end**.

**DECISION.** Compulsions are validated at turn end. If the player's declared actions violate a
compulsion, the turn cannot be ended and the UI explains which constraint is unmet:

```
Cannot end turn:
  ▸ Lancer is affected by Decoy (from Kiritsugu's Scapegoat on Archer).
    You attacked with 1 Servant this turn, so Lancer must be one of the attackers.
    → Attack with Lancer, or undo Saber's attack.
```

With an "undo" affordance, because discovering the constraint after committing an attack is
otherwise a dead end. Turn actions are therefore **undoable until turn end** — which has broad
architectural consequences (§18.7).

### Berserk's other constraints

Beyond the compulsion, `Berserk` restricts *what* the action may be:

> 1. *"will only Move towards and Attack the **nearest** enemy Unit, and can only use Normal
>    Attacks which use Base Attack (STR). If the affected Unit's Normal Attacks only use Base
>    Attack (MAG), its Range is reduced to 1 panel while Berserked."*
> 3. *"A Berserked Unit cannot Block or Evade."*

So a Berserked unit's legal move set is "toward the nearest enemy" and its legal target set is
"the nearest enemy". Both are computed by the movement and targeting engines with a
`compulsion` filter, exactly as `Decoy` is.

### Confuse — random action selection

> *"A Unit with Confuse cannot be controlled by its Player. At the end of its Player's Turn, it
> will perform random Actions (normally decided through dice rolls and coin flips)."*

The one place the system must make a tactical decision. **DECISION.** The random action
selector is deliberately simple and fully logged:

```
1. Roll 1d4 for action class:
     1 → Move only        2 → Attack only
     3 → Move and Attack  4 → Do nothing
2. If moving: roll a direction (1d4 cardinal), move up to MOV panels in that direction,
   stopping at the first illegal panel.
3. If attacking: enumerate legal targets (any relation — a Confused unit may hit allies),
   roll uniformly among them.
4. Log every roll.
```

Crucially, a Confused unit **may attack its allies**, which is the point of the debuff. The
target enumeration therefore uses `relations: [any]`.

Whether a Confused unit's actions consume the player's budget is unstated. **DECISION.** Yes —
it acts on its player's turn, and nothing exempts it. Ch. 41.

### Charm — control transfer

> *"A Charmed Unit has its control switched to the Player controlling the Unit who inflicted
> Charm on the DU for X Turns."*

So the unit acts on the **charmer's** turn, using the charmer's budget. Its faction does not
change (Ch. 04 §4.10), which raises the question of whether it can attack its own faction —
unresolved by the source. **DECISION.** Yes: the charmer directs it and may target anyone,
because a Charm that could not turn a unit against its allies would be nearly useless. Ch. 41.

Implementation: `controllerId` changes; `factionId` does not. The turn scheduler assigns units
to turns by `controllerId`, so this falls out naturally.

---

## 18.6 Prevention effects

The inverse of compulsion — effects that prevent action.

| Effect | Prevents |
|---|---|
| `Stun`, `Stop`, `Freeze`, `Petrify`, `Sleep`, `Nightmare`, `Coma`, `Webbed`, `Crystalfreeze` | All actions |
| `Immobilize` | Movement only |
| `Disable` | Everything except Move |
| `Seal` | STR normal attacks, Skills, Attack Skills, NP (Spells still usable) |
| `Silence` | Spells and MAG-based attacks |
| `Skill Seal` | Skills and Spells |
| `NP Seal` | Noble Phantasms |
| `Shock` | 1/3 chance per turn (d6, fail on 3–4) of losing the turn |
| `Disorder` | 50% chance per turn of `Skill Seal` for that turn |
| `Blind` | 80% chance of missing (40% with Clairvoyance) |
| `Drowning` | 80% chance of failing (no cooldown on failure) |

A prevented unit does **not** consume budget — the action never happens. But `Shock` and
`Disorder` roll at turn *start*, so a player learns before planning. `Blind` and `Drowning` roll
at execution, so the action is declared, the budget is spent, and the attack misses. That
asymmetry is faithful to the text and is surfaced in the UI (a `Blind` unit's attack button
carries an "80% miss chance" badge).

---

## 18.7 Undo

Compulsion validation at turn end (§18.5) requires undo. So does simple usability — a
misplaced move in a tactical game is infuriating without it.

**DECISION.** Actions taken during your own turn are undoable until the turn is ended, with
these exclusions:

| Undoable | Not undoable |
|---|---|
| Movement | Anything that revealed hidden information to an opponent |
| Skill use with no opponent-visible effect | An attack that has been resolved (the defender reacted) |
| Targeting selection | A Command Spell spend (the opponent saw it) |
| Facing choice | Anything after the turn was ended |

The boundary is **information disclosure**. Once an opponent has learned something from your
action, undoing it would let you extract information for free — the classic take-back exploit.

Implementation: an **action journal** per turn.

```ts
interface JournalEntry {
  id: string;
  action: DeclaredAction;
  intents: Intent[];              // what was applied
  inverse: Intent[];              // how to undo it
  disclosed: boolean;             // did an opponent learn anything?
  timestamp: number;
}
```

Because every mutation goes through the intent system (Ch. 03 §3.4), computing the inverse is
mechanical for most intent kinds (`statDelta` negates, `move` reverses the path, `applyEffect`
becomes `removeEffect`). Intents that are not cleanly invertible — a consumed roll, a revealed
effect — set `disclosed: true` and seal the journal up to that point.

**RISK.** Undo across the socket boundary is genuinely hard: the GM client may have applied
writes that the undoing client cannot reverse. Mitigation: undo is itself a socket operation
routed through the GM, and the journal lives on the `Combat` document so all clients see the
same history. Chapter 26 covers it.

---

## 18.8 Turn flow

```
TURN BEGINS for player P
 ├─ reset TurnBudget
 ├─ reset turnState for all units controlled by P (including Charmed units P now controls)
 ├─ roll turn-start effects (Shock, Disorder)
 ├─ open the action journal
 │
 ├─ [player acts]
 │    each action:
 │      ├─ validate legality (Ch. 15 §15.9)
 │      ├─ validate budget
 │      ├─ validate compulsion compatibility (soft — warn, do not block)
 │      ├─ resolve
 │      └─ journal
 │
 ├─ player requests END TURN
 │    ├─ validate compulsions (hard — block with explanation)
 │    ├─ resolve Confused units' random actions
 │    ├─ prompt for facing on any unit that moved and has not chosen  (Ch. 04 §4.2)
 │    └─ confirm
 │
 ├─ seal the journal (no more undo)
 ├─ fire turn-end effects (Ch. 07 §7.7)
 └─ advance
TURN ENDS
```

Note **facing is chosen at turn end**, per the rulebook: *"When a Unit ends its Turn, it has to
choose a Direction to face after it has stopped moving."* Not at the end of each move. So the
end-turn flow collects all outstanding facing choices in one dialog showing every moved unit —
a much better interaction than prompting after each move.

---

## 18.9 Budget display

The turn budget is the primary HUD element (Ch. 29):

```
┌─────────────────────────────────────────────────────┐
│  RED — Turn 2 of Round 7                            │
│                                                     │
│  Servant moves    ●●●○      2 / 4                   │
│  Master moves     ●○○       1 / 3                   │
│  Servant attacks  ●○        1 / 2                   │
│                                                     │
│  ⚠ Lancer must attack this turn (Decoy)             │
│  ⚠ Berserker must move and attack (Berserk)         │
│                                                     │
│  [ End Turn ]  ← disabled, 2 unmet compulsions      │
└─────────────────────────────────────────────────────┘
```

Compulsions are shown as persistent warnings from the moment they apply, not discovered at
turn end. The end-turn button is disabled with the reason inline. This turns a frustrating
rule into a legible one.

---

## 18.10 The GM's turn

The GM takes a Turn in each Round. Its content:

- Moving and attacking with GM-controlled units (Civilians, random-event units, unclaimed Free
  Servants — though those remain player-controlled per the rules).
- Introducing Random Events (Ch. 19).
- Resolving anything the rules assign to the Overseer (Discover rolls, hidden resolutions).

The GM's turn has no budget by default. It occupies the last turn slot in every Round, and
`Delay` can never push a player past it (Ch. 07 §7.8).

---

## 18.11 Summary of decisions

| # | Decision |
|---|---|
| D18.1 | Four independent budget pools, per-Faction, per-Turn, with per-unit once-each limits on top. |
| D18.2 | An Active Skill consumes a **move** slot (Ch. 41 Q5 documents the alternatives). |
| D18.3 | The budget counts **units**, not actions: a unit that moves and uses a skill consumes one slot. |
| D18.4 | Compulsions are validated at **turn end**, not per action, because their wording is turn-scoped. |
| D18.5 | Actions are undoable until turn end, except where an opponent learned something. |
| D18.6 | Undo is derived from intent inverses and routed through the GM proxy. |
| D18.7 | Confused units use a simple, fully-logged random selector and may target allies. |
| D18.8 | Charm changes `controllerId`, not `factionId`; the charmed unit acts on the charmer's turn and budget. |
| D18.9 | Facing is chosen once, at turn end, for all moved units in a single dialog. |

---

**Next:** [19 — Environment](19-environment.md)
