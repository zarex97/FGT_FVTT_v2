# The global Noble Phantasm round gate

**Date:** 2026-09-09
**Chapter:** Ch. 07 §7.9, with consequences in Ch. 15 §15.5 and Ch. 44 §44.5

## 1. What is wrong

Ch. 07 §7.9 states four round-indexed gates. `CONFIG.FGT.gates` holds all four numbers
(`npRound: 6`, `npRoundAssassin: 4`, `magicCrestRound: 3`, `noAttackRound: 1`) and **nothing reads
that object**. Measured:

| Gate | State |
|---|---|
| Noble Phantasm, Round 6 (Assassin 4) | **Unimplemented.** No reader, and no content authors `targeting.limits.requiresRound`. Verified live: an NP fires in Round 1. |
| Magic Crest, Round 3 | **Unimplemented.** `normal-magic-crest.yml` states no gate. |
| First-round attack ban | **Implemented**, but in `rules/environment.mjs#attacksPermitted`, which hardcodes `> 1` instead of reading the config. Verified live: both a Normal Attack and an NP are refused in Round 1. |
| Per-ability override | **Implemented** (Ozymandias, `npGateRound: 8`). |

This is the project's dominant defect shape — a rule collected, correct, and inert — applied to one
of the game's load-bearing constraints. Every Servant in every world can fire its Noble Phantasm on
Turn one.

## 2. What this design does not do

**The Master Essence subsystem stays out.** `MasterData.essences` is a `SetField` that nothing
writes and nothing reads; there is no content pack; all 28 essences across four ranks are
unimplemented. Four of them shift this gate (`Kaleidoscope` −4, `Imaginary Number` −3, `Leyline`
−2, `Harvest` −1). Essences are their own subsystem — setup-time selection, per-rank limits, and
four unrelated mechanical families of which the gate shift is only one — and folding them in here
would make this spec about something else.

Instead this design provides the **seam**: `essenceShift(master)` is a real function reading a real
table, and it returns `0` because `master.essences` is empty in every world. When essences are
built, they populate that set and the shift begins working with no change to the gate.

The cooldown model itself (D7.5 says `elapsed`; the code stores `remaining`) is not touched.

## 3. Rulings

| # | Question | Ruling |
|---|---|---|
| R1 | §7.9's prose says the gate and a cooldown increase compose **additively**; its pseudocode says `max(gateTurn, readyOnTurn)`. | **Additive.** The source clause is *"its NP would only be usable X Turns **after** its NP would be available, X being the number of Turns its NP Cooldown was increased by"*. `max()` would make an NP Lock spent before availability free, which is the outcome the clause exists to prevent. The pseudocode in §7.9 is corrected. |
| R2 | Does the gate reach abilities that are only *categorized as* Noble Phantasms? | **Yes.** `isNP \|\| categorizedAsNP`, the same predicate §15.5's other three scoping questions use. Availability becomes a fourth scoping question with the same answer. |
| R3 | R2 makes the Magic Crest's own "from Round 3" row unreachable under `max()`. | **A stated gate overrides the global one.** An ability naming `npGateRound` (or `targeting.limits.requiresRound`) uses exactly that; the global gate covers only abilities that state none. **This reverses the `max()` composition recorded in Ch. 44 §44.5**, which is corrected. |
| R4 | Where do the numbers live? | **World settings**, seeded from `CONFIG.FGT.gates`, so a GM can move them and `settings-are-read.test.mjs` holds them to having a reader — the guard that would have caught this defect class in the first place. |
| R5 | Which gate applies to a multi-class Servant? | **The earliest.** The mirror of ZON's rule that the widest zone applies: a rule that opens sooner is not cancelled by one that opens later. |

## 4. Architecture

### 4.1 One pure module

`module/rules/np-gate.mjs` — Layer 2, pure, no `game`, no `canvas`, no `ui`:

```js
/** Published defaults, mirrored from CONFIG.FGT.gates. */
export const NP_GATE = Object.freeze({ round: 6, assassinRound: 4 });

/** Essence id -> rounds earlier. Read by nothing until essences exist. */
export const ESSENCE_SHIFT = Object.freeze({
  kaleidoscope: 4, imaginaryNumber: 3, leyline: 2, harvest: 1,
});

export function isGated(ability)                          // isNP || categorizedAsNP   (R2)
export function baseGateRound(unit, gates)                // earliest of its classes    (R5)
export function essenceShift(master)                      // 0 until essences exist
export function gateRoundFor(unit, master, gates)         // max(1, base - shift)
export function gateTurnFor(unit, master, ctx)            // (round - 1) * tpr + 1
export function npAvailableTurn(unit, ability, master, ctx)  // gateTurn + gatedDelay   (R1)
```

`baseGateRound` reads `unit.servantClasses`. A unit that is not a Servant, or one with no classes,
takes the general gate rather than being exempt: exemption is a decision, and no sheet states one.

### 4.2 One reader

`rules/costs.mjs#canUseAbility` consults it exactly where it already consults `requiresRound`. Its
argument object gains `turn` and `gates`, **both optional with published defaults** — so a call
site that forgets them gets the correct Round-6 gate rather than no gate. That matters: there are
seven call sites, and "silently skipped" is the failure mode this whole spec exists to fix.

```js
// The ability's OWN gate wins outright (R3); the global one covers the rest.
const stated = ability?.requiresRound ?? null;
const gate = stated !== null
  ? stated
  : (isGated(ability) ? gateRoundFor(unit, master, gates) : null);
```

`usageSpecFor` keeps folding an ability's two ways of stating a gate together by `max()` — both are
the ability speaking — and that folded value is what `stated` reads. So `max()` survives *within*
an ability and is replaced *between* an ability and the world.

### 4.3 The additive delay

`cooldown.gatedDelay`, an integer on `AbilityData` and `NoblePhantasmData`, default 0.

Written at **one** site: `engine/io.mjs`'s cooldown writer (`io.mjs:462`), the only place in the
system where a cooldown increase is applied. When `mode === "increase"` and the current global turn
precedes this ability's gate turn, the increase is added to `gatedDelay` as well as to `remaining`.

Never reset. *"Usable X Turns after its NP would be available"* is a permanent shift of the
availability turn, not a second countdown — and this codebase's rule about clocks applies: an
absolute shift cannot fail to be applied, where a countdown needs a hook that can.

Round-level comparison suffices whenever `gatedDelay` is 0, which is every ability in every world
until something increases a cooldown early; turn-level comparison is used only when it is not. That
keeps the common path free of the turn plumbing.

### 4.4 The rest of the block

- `attacksPermitted` reads the `noAttackRound` setting instead of hardcoding `> 1`, so all four
  gates in `CONFIG.FGT.gates` have exactly one source of truth.
- `normal-magic-crest.yml` gains `npGateRound: 3`, so §7.9's Magic Crest row becomes the ability's
  own statement and (per R3) overrides the global gate.

### 4.5 Settings

`npGateRound` (6), `npGateRoundAssassin` (4) and `noAttackRound` (1), registered world-scope,
`config: true`, seeded from `CONFIG.FGT.gates`, and added to `RULE_SETTINGS` so `guardRuleChange`
warns when one moves mid-match. Read in Layer 3 and passed down, because `rules/` may not touch
`game`.

## 5. What already works and must keep working

- **Force Noble Phantasm cannot bypass it.** `cs-force-noble-phantasm.yml` lists
  `overridesValidation: [cooldown, usesExhausted]` with `round` deliberately absent and a comment
  saying so. No change is needed; the refusal simply becomes reachable for the first time.
- **The refusal surface exists.** `reason: "round"` is already in `rules/legality.mjs`, already
  rendered by `apps/actor-sheet/present.mjs` as *"available from Round N"* with an `away` count,
  and already produces `usageRefusal`'s *"it cannot be used before Round N (this is Round M)"*.
- **Ozymandias's gate.** `npGateRound: 8` must still refuse at Round 7 and open at Round 8.
- **The Normal Assassin NP.** States `npGateRound: 4`, which equals the global Assassin gate, so it
  is unchanged either way.

## 6. Fallout

Turning on a gate that has never fired changes every world and an unknown number of fixtures.
`test/unit/costs.test.mjs` alone runs Noble Phantasms at `round: 3` in at least eight assertions.

Each is inspected rather than bulk-edited: a fixture encoding a **convenience** (a round chosen
arbitrarily to satisfy an unrelated assertion) is updated; one encoding a **decision** is flagged
to the author rather than changed.

## 7. Testing

**Pure** (`test/unit/np-gate.test.mjs`): the class branch; a multi-class Servant taking the earliest
gate; a non-Servant taking the general gate; the essence seam returning 0, and the table applying
when a set is supplied; turn arithmetic across `turnsPerRound ∈ {3, 8, 15}`; the additive delay.

**Gate** (`test/unit/costs.test.mjs`): an NP refused below the gate and allowed at it; an Assassin
allowed two Rounds earlier; a stated gate overriding the global one in **both** directions — later
(Ozymandias) and earlier (the Magic Crest); a non-NP ability ungated; a `categorizedAsNP` ability
gated.

**Live**, in `fgt2026`, because green tests are not evidence for any of it:

1. A Servant's NP refused in Round 5, allowed in Round 6, the refusal naming the Round.
2. An Assassin's NP allowed in Round 4 and refused in Round 3.
3. Ozymandias still refused at Round 7 and opening at Round 8.
4. A Master's Magic Crest refused in Round 2 and allowed in Round 3.
5. `CS: Force Noble Phantasm` still refused before the gate.
6. An NP Lock applied in Round 2 pushing availability past Round 6 by exactly its length.
7. A Normal Attack still permitted from Round 2 and refused in Round 1.

## 8. Chapters to correct

- **Ch. 07 §7.9** — the pseudocode (R1), and the section's silence about the gate being unbuilt.
- **Ch. 15 §15.5** — availability is a fourth scoping question, answered by the same predicate.
- **Ch. 44 §44.5** — `max()` is replaced by "a stated gate overrides the global one" (R3).
- **Ch. 45** — the entry, naming what was measured live rather than what the tests assert.
