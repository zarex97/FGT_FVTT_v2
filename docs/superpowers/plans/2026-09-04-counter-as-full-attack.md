# Counter as a Full Attack — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a defender answer the Counter rung with any ability the system already calls an Attack — a Noble Phantasm, an attack Skill, or the Normal Attack — aimed anywhere that catches the original attacker.

**Architecture:** A new pure module `module/rules/counter.mjs` owns the two new rules (what may Counter, and who may Counter a Counter). `engine/combat-process.mjs` gains two Process fields to carry them. `engine/attack.mjs`'s declaration body is extracted so the Counter path and the normal path are the same code with different flags. The choice is made on the existing action bar, armed automatically, and committed through a new socket operation.

**Tech Stack:** Foundry VTT v14, ApplicationV2, ES modules, vitest, SCSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-counter-as-full-attack-design.md`

## Global Constraints

- **Layers.** `module/domain` and `module/rules` must never touch Foundry globals (`game`, `canvas`, `ui`, `Hooks`, `ChatMessage`). `tools/check-layers.mjs` enforces this and runs in `npm run lint`.
- **Every task ends with a live check** in the running world at `http://localhost:30000` via claude-in-chrome, **looked at in a screenshot**. A green suite is not evidence. Three simultaneous sessions in one Chrome: `mcp__chrome-devtools__new_page` with `isolatedContext: "p1"` / `"p2"` gives each its own cookie jar; the claude-in-chrome tab is the third.
- **Canvas interaction must use real pointer events.** `mcp__claude-in-chrome__computer` hover/click. Synthetic `KeyboardEvent`/`PointerEvent` dispatch does **not** reach PIXI's targeting layer — verified this session.
- **Docs move with the code.** Each task updates the chapter it changes (00–44), not only `docs/45-implementation-status.md`. The CHANGELOG entry is written once, in Task 6.
- **Chain default:** `fgt.counterChain` defaults to `"collateral"`.
- **Depth backstop:** `MAX_COUNTER_DEPTH = 8`.
- Run `npm run lint` and `npx vitest run` before every commit. Commit messages end with the two attribution lines used throughout this branch.

## World fixtures (already set up, reuse them)

| Unit | Actor id | Owner | Faction | Panel | Notes |
|---|---|---|---|---|---|
| Heracles | `SYV9LwndQdB06IBJ` | Player1 | `faction-1` | (6,1) | Divinity, Mad Enhancement, **Nine Lives** (NP) |
| Karna (foe) | `buTLFCGAlQKOXXuy` | Player2 | `faction-2` | (6,2) | Magic Resistance, **Brahmastra Kundala** (NP) |
| Foe Master | `7Vq3qg04Sh1ivtMr` | GM | — | (8,2) | the bystander for area tests |

Users: Gamemaster `7mB8UPGVR6alzrrT`, Player1 `yVevT9Da3egFpXeO`, Player2 `vL77HYG9fUm8uOwI`. Grid distance is 1, so one panel is 100px and `panel = {i: x/100, j: y/100}`.

---

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/counter.mjs` *(new)* | Pure: which abilities may Counter; who may Counter a Counter; the depth cap. |
| `test/unit/counter.test.mjs` *(new)* | Tests for the above. |
| `module/engine/combat-process.mjs` | Process fields `requiredTargetId` / `counterDepth`; `beginCounter` fans out; `canCounter` delegates the chain rule. |
| `module/rules/targeting/resolve.mjs` | `limits.requireUnitId` — the attacker must be among the resolved units. |
| `module/engine/attack.mjs` | Extract `declareProcesses`; `runCounter` takes a choice; sibling predicates disambiguated by attacker. |
| `module/net/operations.mjs` | `declareCounter`. |
| `module/apps/hud/present.mjs` | `slotFor` gains the counter view. |
| `module/apps/hud/action-bar.mjs` | Counter mode: arm, glow, route the click. |
| `module/apps/chat/cards.mjs` | Arm the bar on the rung; disarm off it. |
| `module/settings.mjs`, `lang/en.json`, `templates/`, `styles/src/_apps.scss` | Setting, strings, markup, glow. |

---

## Task 1: The pure counter rules

**Files:**
- Create: `module/rules/counter.mjs`
- Test: `test/unit/counter-rules.test.mjs` **(new — `test/unit/counter.test.mjs` already exists and covers the ENGINE's counter step; do not overwrite it)**
- Modify: `docs/12-combat-process.md` (§12.8 note)

**Interfaces:**
- Consumes: `classifyAbility(item)` from `module/rules/ability-use.mjs`, returning `{kind, isAttack, clickable, toggles, action}`.
- Produces:
  - `COUNTER_CHAIN_MODES: readonly ["collateral", "strict"]`
  - `MAX_COUNTER_DEPTH: 8`
  - `counterOffer(items) -> Array<{id: string|null, name: string, img: string|null, isNP: boolean, isNormalAttack: boolean}>`
  - `mayCounterAgain(process, defenderId, mode) -> boolean`

- [ ] **Step 1: Write the failing test**

Create `test/unit/counter-rules.test.mjs`:

```js
/**
 * @file What may answer a Counter, and who may Counter a Counter.
 * @see module/rules/counter.mjs, docs/12-combat-process.md §12.8
 *
 * `beginCounter` has taken the attack as a parameter since it was written and
 * no caller ever passed one, so every Counter in the game was a Normal Attack.
 * These are the two rules that were missing underneath that.
 */
import { describe, it, expect } from "vitest";
import {
  counterOffer, mayCounterAgain, MAX_COUNTER_DEPTH, COUNTER_CHAIN_MODES,
} from "../../module/rules/counter.mjs";

const np = (id, name) => ({ id, name, img: `${id}.webp`, type: "noblePhantasm", system: {} });
const attackSkill = (id, name) => ({
  id, name, img: `${id}.webp`, type: "ability",
  system: { isAttackSkill: true, phases: [{ kind: "damage" }] },
});
const buff = (id, name) => ({
  id, name, img: `${id}.webp`, type: "ability", system: { phases: [{ kind: "applyEffect" }] },
});
const mode = (id, name) => ({ id, name, type: "ability", system: { isMode: true } });
const passiveNP = (id, name) => ({ id, name, type: "noblePhantasm", system: { isPassive: true } });

describe("counterOffer", () => {
  it("always offers the Normal Attack first, and it is free", () => {
    const [first] = counterOffer([]);
    expect(first.isNormalAttack).toBe(true);
    expect(first.id).toBeNull();
  });

  it("offers Noble Phantasms and attack Skills", () => {
    const out = counterOffer([np("np1", "Nine Lives"), attackSkill("s1", "Overedge")]);
    expect(out.map((o) => o.id)).toEqual([null, "np1", "s1"]);
    expect(out[1].isNP).toBe(true);
    expect(out[2].isNP).toBe(false);
  });

  it("refuses anything that is not an Attack", () => {
    // The same predicate the action bar routes on, so "what is an Attack" has
    // one definition rather than two that drift.
    const out = counterOffer([buff("b1", "Argos"), mode("m1", "Mad Enhancement"), passiveNP("p1", "Goddess of War")]);
    expect(out.map((o) => o.id)).toEqual([null]);
  });

  it("survives a unit with no abilities at all", () => {
    expect(counterOffer(undefined)).toHaveLength(1);
  });
});

describe("mayCounterAgain", () => {
  const counter = (over = {}) => ({
    isCounter: true, requiredTargetId: "A", counterDepth: 1, ...over,
  });

  it("leaves an ordinary attack to the normal §12.8 rules", () => {
    expect(mayCounterAgain({ isCounter: false }, "B", "strict")).toBe(true);
  });

  it("never lets the unit a Counter was aimed at answer it — Rule 1", () => {
    // A attacks B, B counters A. Without this the two counter each other until
    // one of them dies, which is the safety property the whole rule exists for.
    expect(mayCounterAgain(counter(), "A", "collateral")).toBe(false);
    expect(mayCounterAgain(counter(), "A", "strict")).toBe(false);
  });

  it("lets a bystander answer in collateral mode", () => {
    // C was caught in B's area Counter aimed at A. C was not being countered,
    // so C keeps its own right to counter B.
    expect(mayCounterAgain(counter(), "C", "collateral")).toBe(true);
  });

  it("refuses a bystander in strict mode", () => {
    expect(mayCounterAgain(counter(), "C", "strict")).toBe(false);
  });

  it("treats a missing requiredTargetId as aimed at nobody, and refuses", () => {
    // A Counter with no recorded target is a bug upstream. Refusing is the
    // safe reading: the alternative opens the chain this rule closes.
    expect(mayCounterAgain(counter({ requiredTargetId: null }), "C", "collateral")).toBe(false);
  });
});

describe("the constants", () => {
  it("names both chain modes", () => {
    expect(COUNTER_CHAIN_MODES).toEqual(["collateral", "strict"]);
  });

  it("caps the depth", () => {
    expect(MAX_COUNTER_DEPTH).toBe(8);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/counter-rules.test.mjs`
Expected: FAIL — `Failed to resolve import "../../module/rules/counter.mjs"`.

- [ ] **Step 3: Write the module**

Create `module/rules/counter.mjs`:

```js
/**
 * @file What may answer a Counter, and who may Counter a Counter.
 * @see docs/12-combat-process.md §12.8
 *
 * Layer 2 (rules). Pure.
 *
 * The rulebook says the DU *"may use the 'Counter' Action and declare an
 * Attack on the AU"* — an Attack, not *the* Normal Attack. `beginCounter` has
 * taken the attack as a parameter since it was written and no caller ever
 * passed one, so the default was the entire feature.
 */

import { classifyAbility } from "./ability-use.mjs";

/**
 * How far a chain of Counters may run before the engine stops it.
 *
 * A constant rather than a setting. The chain already terminates on cost —
 * reaching a bystander needs an AREA ability and an ability pays its own price,
 * while a Normal Attack cannot catch a bystander at all — so this is a backstop
 * against a content bug that authors a free area attack, not a rule. A table
 * that legitimately reaches depth 8 has found something worth reading about.
 */
export const MAX_COUNTER_DEPTH = 8;

/** The two answers to "may a Counter be Countered?" (`fgt.counterChain`). */
export const COUNTER_CHAIN_MODES = Object.freeze(["collateral", "strict"]);

/**
 * Everything this unit could answer a Counter with.
 *
 * The Normal Attack is always first and always free. Everything else is
 * whatever `classifyAbility` already calls an Attack — reused rather than
 * re-derived so that "what is an Attack" has exactly one definition in the
 * system. That predicate already drops passives, modes and dialog abilities,
 * and already keeps the non-damaging Noble Phantasms, which still cost a
 * Servant its attack.
 *
 * Whether the unit can PAY for one of these is a separate question, answered by
 * `rules/costs.mjs#canUseAbility`. Kept separate so an ability the counterer
 * cannot afford is still offered, disabled, with its reason: a player deciding
 * whether to counter needs to know the Noble Phantasm exists.
 *
 * @param {object[]} items ability documents, or anything with `type` and `system`
 * @returns {Array<{id: string|null, name: string, img: string|null, isNP: boolean, isNormalAttack: boolean}>}
 */
export function counterOffer(items) {
  const normal = {
    id: null, name: "FGT.Chat.NormalAttack", img: null, isNP: false, isNormalAttack: true,
  };
  const abilities = (items ?? [])
    .filter((item) => classifyAbility(item).isAttack)
    .map((item) => ({
      id: item.id,
      name: item.name,
      img: item.img ?? null,
      isNP: item.type === "noblePhantasm" || item.system?.isNP === true,
      isNormalAttack: false,
    }));
  return [normal, ...abilities];
}

/**
 * May the defender of this Process counter it?
 *
 * The safety property of the whole feature, in one place.
 *
 * **Rule 1**, true in both modes: the unit a Counter was aimed at never answers
 * it. Without that, two Servants in range of each other counter one another
 * until one of them dies.
 *
 * **The setting** governs only the other case — a bystander an area Counter
 * caught on its way to somebody else. In `collateral` they keep their own right
 * to counter, because they were not the ones being countered; their answer is
 * itself a Counter aimed at its target, so Rule 1 closes it one step later.
 *
 * A Counter with no `requiredTargetId` is a bug upstream, and refusing is the
 * safe reading: the alternative is the open chain this function exists to close.
 *
 * @param {object} process a `ProcessState`
 * @param {string} defenderId the unit asking to counter
 * @param {string} mode one of `COUNTER_CHAIN_MODES`
 * @returns {boolean}
 */
export function mayCounterAgain(process, defenderId, mode) {
  if (!process?.isCounter) return true;
  if (!process.requiredTargetId) return false;
  if (defenderId === process.requiredTargetId) return false;
  return mode === "collateral";
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/counter-rules.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Lint, including the layer check**

Run: `npm run lint`
Expected: clean, and `FGT | Layer boundaries intact`. If it reports a boundary violation, the module has reached for a Foundry global — remove it; this file must stay pure.

- [ ] **Step 6: Document it in the chapter**

In `docs/12-combat-process.md`, immediately after the `canCounter` code block in §12.8, add:

```markdown
> **Implementation note.** `module/rules/counter.mjs` holds the two rules this section
> implies but never states. `counterOffer` answers *"declare an Attack"* — any ability
> `classifyAbility` calls an Attack, plus the Normal Attack, which is always offered and
> always free. `mayCounterAgain` answers *"Counters cannot be Countered again"* precisely:
> the unit a Counter was **aimed at** never answers it, and whether a bystander an area
> Counter merely caught may answer is the `fgt.counterChain` setting, default `collateral`.
```

- [ ] **Step 7: Live check**

The module is not wired to anything yet, so the check is that the world still loads with it present.

1. `mcp__chrome-devtools__new_page` → `http://localhost:30000/join`, join as Gamemaster.
2. In the page: `game.ready` → expect `true`.
3. `mcp__claude-in-chrome__read_console_messages` with `pattern: "FGT \\|"`, `onlyErrors: true` → expect no errors.
4. Screenshot the canvas and confirm the board draws.

- [ ] **Step 8: Commit**

```bash
git add module/rules/counter.mjs test/unit/counter-rules.test.mjs docs/12-combat-process.md
git commit -F- <<'MSG'
The two rules a Counter always needed

`counterOffer` answers "declare an Attack" and `mayCounterAgain` answers
"Counters cannot be Countered again". Pure, tested, wired to nothing yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 2: Process fields, the chain rule, and the setting

**Files:**
- Modify: `module/engine/combat-process.mjs` (`begin`, `beginFanOut`, `beginCounter`, `canCounter`)
- Modify: `module/engine/attack.mjs` (`counterAvailable`, `alreadyInjuryRolled`)
- Modify: `module/settings.mjs`, `lang/en.json`
- Test: `test/unit/counter.test.mjs` (existing — append the new blocks AND update the assertions Step 2b names)
- Modify: `docs/12-combat-process.md`, `docs/21-system-skeleton.md`

**Interfaces:**
- Consumes: `mayCounterAgain`, `MAX_COUNTER_DEPTH`, `COUNTER_CHAIN_MODES` from Task 1.
- Produces:
  - `begin({..., requiredTargetId = null, counterDepth = 0})` — both fields on every state
  - `beginFanOut({..., isCounter = false, requiredTargetId = null, counterDepth = 0})` — passes all three through
  - `beginCounter(s, {attack, targetIds, isAoE}) -> ProcessState[]` — **now an array**
  - `canCounter(s, {..., chainMode = "collateral"}) -> boolean`

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/counter.test.mjs`. It already imports `begin, beginCounter, beginFanOut, canCounter, advance, pendingPrompt` from the engine and defines the `proc()` and `eligible` helpers — reuse them rather than redefining. Add `MAX_COUNTER_DEPTH` to its imports from `../../module/rules/counter.mjs`.

```js
describe("counter process fields", () => {
  const parent = () => ({
    ...begin({ attackerId: "A", defenderId: "B", attack: { abilityId: null, kind: "normal" } }),
    state: "counter",
  });

  it("gives every process a requiredTargetId and a depth", () => {
    const s = begin({ attackerId: "A", defenderId: "B", attack: {} });
    expect(s.requiredTargetId).toBeNull();
    expect(s.counterDepth).toBe(0);
  });

  it("fans a counter out over every unit the ability caught", () => {
    const states = beginCounter(parent(), { targetIds: ["A", "C"] });
    expect(states.map((s) => s.defenderId)).toEqual(["A", "C"]);
  });

  it("marks every process of the fan-out as a counter aimed at the attacker", () => {
    // Not just the one against A. A bystander's process that forgot `isCounter`
    // would reopen the chain through the side door.
    const states = beginCounter(parent(), { targetIds: ["A", "C"] });
    for (const s of states) {
      expect(s.isCounter).toBe(true);
      expect(s.requiredTargetId).toBe("A");
      expect(s.counterDepth).toBe(1);
    }
  });

  it("keeps the parent's groupId, because a Counter is part of the same Combat Phase", () => {
    // §12.1: a Phase is the declaration plus any Counters. `fireCombatPhaseEnd`
    // counts unfinished siblings by groupId, so a counter with its own group
    // would let the phase end while the counter is still running.
    const p = parent();
    const states = beginCounter(p, { targetIds: ["A"] });
    expect(states[0].groupId).toBe(p.groupId);
  });

  it("counts depth upward through a chain", () => {
    const first = beginCounter(parent(), { targetIds: ["A", "C"] });
    const second = beginCounter({ ...first[1], state: "counter", attackerId: "B", defenderId: "C" }, { targetIds: ["B"] });
    expect(second[0].counterDepth).toBe(2);
  });

  it("defaults to a single-target Normal Attack at the original attacker", () => {
    const states = beginCounter(parent());
    expect(states).toHaveLength(1);
    expect(states[0].defenderId).toBe("A");
    expect(states[0].attack).toEqual({ abilityId: null, kind: "normal" });
    expect(states[0].isAoE).toBe(false);
  });
});

describe("canCounter and the chain", () => {
  const ok = {
    defenderAlive: true, attackerInRange: true, chainMode: "collateral",
  };
  const counterState = (over = {}) => ({
    ...begin({ attackerId: "B", defenderId: "A", attack: {} }),
    isCounter: true, requiredTargetId: "A", counterDepth: 1, ...over,
  });

  it("still allows a counter on an ordinary attack", () => {
    expect(canCounter(begin({ attackerId: "A", defenderId: "B", attack: {} }), ok)).toBe(true);
  });

  it("refuses the unit the counter was aimed at, in both modes", () => {
    expect(canCounter(counterState(), ok)).toBe(false);
    expect(canCounter(counterState(), { ...ok, chainMode: "strict" })).toBe(false);
  });

  it("allows a bystander in collateral mode and refuses in strict", () => {
    const bystander = counterState({ defenderId: "C" });
    expect(canCounter(bystander, ok)).toBe(true);
    expect(canCounter(bystander, { ...ok, chainMode: "strict" })).toBe(false);
  });

  it("stops at the depth cap even in collateral mode", () => {
    const deep = counterState({ defenderId: "C", counterDepth: MAX_COUNTER_DEPTH });
    expect(canCounter(deep, ok)).toBe(false);
  });

  it("still refuses for every §12.8 reason it always did", () => {
    const s = begin({ attackerId: "A", defenderId: "B", attack: {} });
    expect(canCounter(s, { ...ok, attackerInRange: false })).toBe(false);
    expect(canCounter(s, { ...ok, attackerHasAccel: true })).toBe(false);
    expect(canCounter(s, { ...ok, defenderHasBerserk: true })).toBe(false);
    expect(canCounter(s, { ...ok, defenderHasFragarach: true })).toBe(false);
    expect(canCounter(s, { ...ok, defenderAlive: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/counter.test.mjs`
Expected: FAIL — `beginCounter(...).map is not a function`, and the `requiredTargetId` assertions get `undefined`.

- [ ] **Step 2b: Update the seven existing `beginCounter` assertions**

`beginCounter` returns an **array** now and takes an options object instead of a bare
`attack`. The existing `describe("beginCounter")` block in `test/unit/counter.test.mjs`
assumes both of the old shapes and will fail. Replace that whole block with:

```js
describe("beginCounter", () => {
  it("swaps the attacker and the defender", () => {
    const [counter] = beginCounter(proc());

    expect(counter.attackerId).toBe("def");
    expect(counter.defenderId).toBe("atk");
  });

  it("marks the new process as a counter", () => {
    expect(beginCounter(proc())[0].isCounter).toBe(true);
  });

  it("produces a process the unit it was aimed at cannot counter", () => {
    // The property that actually stops the recursion. It used to be "a marked
    // process is refused"; it is now "the unit it was AIMED at is refused", so
    // that `fgt.counterChain` can let a bystander answer without reopening it.
    const [counter] = beginCounter(proc());
    expect(canCounter(counter, { ...eligible, chainMode: "collateral" })).toBe(false);
    expect(canCounter(counter, { ...eligible, chainMode: "strict" })).toBe(false);
  });

  it("counters with a normal attack unless told otherwise", () => {
    expect(beginCounter(proc())[0].attack).toMatchObject({ kind: "normal", abilityId: null });
  });

  it("can counter with a named ability", () => {
    const [counter] = beginCounter(proc(), { attack: { abilityId: "gaeBolg", kind: "np" } });
    expect(counter.attack).toMatchObject({ abilityId: "gaeBolg", kind: "np" });
  });

  it("is single-target by default, so the counter turns its target", () => {
    // It used to be single-target ALWAYS -- "a counter is one unit hitting one
    // unit" -- which was only true because the `attack` parameter was never
    // passed and every counter was a Normal Attack. A counter declared with an
    // area Noble Phantasm has that Noble Phantasm's shape.
    const [aoe] = beginFanOut({ attackerId: "atk", targetIds: ["def", "d2"], attack });

    expect(beginCounter(aoe)[0].isAoE).toBe(false);
    expect(beginCounter(aoe, { targetIds: ["atk", "d3"] })[0].isAoE).toBe(true);
  });

  it("starts a fresh ladder rather than inheriting the original's state", () => {
    const spent = advance(proc(), "done");

    expect(beginCounter(spent)[0].state).toBe("declare");
    expect(beginCounter(spent)[0].history).toEqual([]);
  });
});
```

Then run `grep -n "beginCounter" test/unit/*.mjs` and fix any remaining caller the same way.

- [ ] **Step 3: Add the fields to `begin` and `beginFanOut`**

In `module/engine/combat-process.mjs`, change `begin`'s signature and body:

```js
export function begin({
  attackerId, defenderId, attack, isAoE = false, groupId = null,
  isCounter = false, requiredTargetId = null, counterDepth = 0,
}) {
  return {
    state: "declare",
    attackerId,
    defenderId,
    attack,
    reaction: null,
    evaded: false,
    isAoE,
    groupId,
    // "Counters cannot be Countered again" — carried on the state because the
    // check happens inside a process that has no other way to know what it is.
    isCounter,
    // WHO this counter was aimed at. Implicit in `defenderId` while a counter
    // was 1v1; an area counter has several defenders and only one of them was
    // the point, and `rules/counter.mjs#mayCounterAgain` needs to tell them
    // apart.
    requiredTargetId,
    // 0 for a declaration, +1 per counter. The chain terminates on cost, not on
    // this; it is a backstop against a content bug (`MAX_COUNTER_DEPTH`).
    counterDepth,
    history: [],
    rolls: [],
  };
}
```

And `beginFanOut` — note it currently **drops `isCounter` entirely**, which is a latent bug the moment a counter fans out:

```js
export function beginFanOut({
  attackerId, targetIds, attack, groupId = null, isAoE = null,
  isCounter = false, requiredTargetId = null, counterDepth = 0,
}) {
  const ids = targetIds ?? [];
  if (ids.length === 0) return [];

  const group = groupId ?? `fan.${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  const area = isAoE ?? ids.length > 1;
  return ids.map((defenderId) =>
    begin({
      attackerId, defenderId, attack, isAoE: area, groupId: group,
      // Carried to EVERY process in the fan-out. A bystander's process that
      // forgot it would let the counter be countered, which is exactly the
      // chain `mayCounterAgain` exists to close.
      isCounter, requiredTargetId, counterDepth,
    }));
}
```

- [ ] **Step 4: Make `beginCounter` fan out**

Replace `beginCounter` entirely. Keep the existing doc comment's first half and add the new reasoning:

```js
/**
 * The counter sub-process: an Attack the other way round (§12.8).
 *
 * > *"the DU may use the 'Counter' Action and declare an Attack on the AU.
 * > Steps 1 and 4 of Combat are repeated, but with the roles reversed."*
 *
 * A **fresh** set of processes, not a mutation of the original: the counter
 * runs the full ladder (Ch. 41's ruling on the "Steps 1 and 4" typo), so it
 * needs its own history and its own state.
 *
 * **An array, and an area is allowed.** The old single-target signature said "a
 * counter is one unit hitting one unit", which was only true because the
 * `attack` parameter it already took was never passed: every counter was a
 * Normal Attack. A counter declared with a Noble Phantasm has that Noble
 * Phantasm's shape.
 *
 * **The parent's `groupId` is kept.** §12.1: a Combat Phase is the declaration
 * plus any counters. `engine/attack.mjs#fireCombatPhaseEnd` counts unfinished
 * siblings by `groupId` and says so in as many words — *"a counter can add a
 * process to the group after the first one finished"* — so giving the counter
 * its own group would end the phase while the counter is still resolving.
 *
 * It carries no budget cost: `resolveAttack`'s spend is above the extraction
 * this path calls, so a counter does not skip it, it never reaches it.
 *
 * @param {ProcessState} s the process being countered
 * @param {object} [choice]
 * @param {object} [choice.attack] what to counter with; a Normal Attack by default
 * @param {string[]} [choice.targetIds] every unit the ability caught; the
 *   original attacker MUST be among them (`rules/counter.mjs`)
 * @param {boolean|null} [choice.isAoE]
 * @returns {ProcessState[]}
 */
export function beginCounter(s, { attack = { abilityId: null, kind: "normal" }, targetIds = null, isAoE = null } = {}) {
  const ids = targetIds?.length ? targetIds : [s.attackerId];
  return beginFanOut({
    attackerId: s.defenderId,
    targetIds: ids,
    attack,
    groupId: s.groupId,
    isAoE: isAoE ?? ids.length > 1,
    isCounter: true,
    requiredTargetId: s.attackerId,
    counterDepth: (s.counterDepth ?? 0) + 1,
  });
}
```

- [ ] **Step 5: Delegate the chain rule from `canCounter`**

Add the import at the top of `module/engine/combat-process.mjs`:

```js
import { mayCounterAgain, MAX_COUNTER_DEPTH } from "../rules/counter.mjs";
```

Replace `canCounter`'s opening clause. The old body began `if (s.isCounter) return false;`:

```js
export function canCounter(s, {
  defenderAlive, attackerInRange, attackerHasAccel = false, defenderCanAct = true,
  defenderHasBerserk = false, defenderHasFragarach = false, attackerConcealedAndFaster = false,
  chainMode = "collateral",
}) {
  // "Counters cannot be Countered again." First, because it is the one clause
  // that is a safety property rather than a rules detail. It used to be a flat
  // refusal on `isCounter`; it is now precise about WHICH unit is refused, so
  // that a bystander an area counter merely caught keeps its own right to
  // answer (`fgt.counterChain`).
  if (!mayCounterAgain(s, s.defenderId, chainMode)) return false;
  // The backstop. Cost is what actually terminates the chain; this catches a
  // content bug that authors a free area attack.
  if ((s.counterDepth ?? 0) >= MAX_COUNTER_DEPTH) return false;

  if (attackerHasAccel) return false;
  if (!defenderCanAct) return false;
  if (!attackerInRange) return false;
  if (defenderHasBerserk) return false;
  if (defenderHasFragarach) return false;
  if (attackerConcealedAndFaster) return false;

  return s.evaded || defenderAlive;
}
```

- [ ] **Step 6: Register the setting**

In `module/settings.mjs`, immediately after the `closedInfo` registration:

```js
  // §12.8. Rule 1 — the unit a Counter was aimed at never answers it — is not
  // configurable; it is what stops two Servants countering each other to death.
  // This governs only the bystander an AREA counter caught on its way to
  // somebody else. Default `collateral`: they were not the one being
  // countered, so they keep their own right to counter.
  s("counterChain", {
    name: "FGT.Settings.CounterChain", hint: "FGT.Settings.CounterChainHint",
    type: String, default: "collateral",
    choices: { collateral: "FGT.CounterChain.Collateral", strict: "FGT.CounterChain.Strict" },
  });
```

In `lang/en.json`, beside the other `FGT.Settings.*` keys:

```json
  "FGT.Settings.CounterChain": "Countering a Counter",
  "FGT.Settings.CounterChainHint": "A unit an area Counter merely caught was not the one being countered. Collateral lets it counter back; Strict does not. Either way, the unit a Counter was aimed at can never answer it.",
  "FGT.CounterChain.Collateral": "A bystander may counter back",
  "FGT.CounterChain.Strict": "No counter may be countered",
```

- [ ] **Step 7: Read the setting in `counterAvailable`**

In `module/engine/attack.mjs`, in `counterAvailable`, add `chainMode` to the object handed to `process.canCounter`:

```js
    attackerConcealedAndFaster: reactionsRefused(attacker, defender).includes("counter"),
    // The GM's `fgt.counterChain`. Read here rather than in the pure module,
    // which takes every derived fact as an argument.
    chainMode: game.settings.get("fgt", "counterChain"),
```

- [ ] **Step 8: Disambiguate the injury-roll siblings**

Still in `module/engine/attack.mjs`, `alreadyInjuryRolled` finds siblings by `groupId` + same defender. Now that a counter shares the parent's `groupId` **and** may catch a unit the original attack also caught, those two are no longer the same exchange. Add the attacker to the predicate:

```js
function alreadyInjuryRolled(state, message) {
  return game.messages.some((m) => {
    if (m.id === message.id) return false;
    const raw = m.getFlag("fgt", "process");
    if (!raw) return false;
    let other;
    try { other = process.deserialize(raw); } catch { return false; }
    // `attackerId` as well as `groupId` and the defender. A Counter shares the
    // parent's group (§12.1's Combat Phase) and an AREA counter can catch a
    // unit the original attack also caught -- so without this, C's injury from
    // A's Noble Phantasm and C's injury from B's counter would be summed as
    // though they were two hits of one multi-hit ability.
    if (other.groupId !== state.groupId) return false;
    if (other.attackerId !== state.attackerId) return false;
    if (other.defenderId !== state.defenderId) return false;
    return m.getFlag("fgt", "injury")?.reason !== "singleInjuryRollPending";
  });
}
```

Read the existing body first and keep whatever it does with the `injury` flag; the change is only the two added equality checks. Apply the same `attackerId` check to the sibling search in `singleInjuryRoll` if it has one.

- [ ] **Step 9: Fix every existing `beginCounter` caller**

`runCounter` in `module/engine/attack.mjs` calls `process.beginCounter(state)` and expects one state. It now gets an array. Change it minimally — Task 5 rewrites this function properly:

```js
  const [counter] = process.beginCounter(state);
  const advanced = process.advance(counter, "done");
```

and use `advanced` where `counter` was used below.

Run `grep -rn "beginCounter" module/ test/` and fix every hit.

- [ ] **Step 10: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. If a golden damage test fails on a snapshot containing `requiredTargetId: null` or `counterDepth: 0`, update the expected fixture — the new fields are on every state by design.

Run: `npm run lint` — expected clean.

- [ ] **Step 11: Live check — the existing counter still works, and cannot be countered**

Set up three sessions (see Global Constraints). Then, as **Player1** in the claude-in-chrome tab:

1. Select Heracles: `canvas.tokens.placeables.find(p => p.actor?.id === "SYV9LwndQdB06IBJ").control({releaseOthers: true})`
2. Click the Attack slot: `document.querySelector('.fgt-actionbar [data-slot="attack"]').click()`
3. Hover Karna's panel with a **real** pointer event and click to confirm, then click **Attack** in the review dialog.
4. As **Player2**, click **Block**, then **Counter** on the counter rung.
5. Screenshot Player1's chat. Expected: a second card, Lancer ⚔ Berserker, and **no Counter prompt on it** — Heracles was the unit the counter was aimed at.
6. Confirm the field is set:
   ```js
   const m = game.messages.contents.at(-1);
   const p = JSON.parse(m.getFlag("fgt","process"));
   ({ isCounter: p.isCounter, requiredTargetId: p.requiredTargetId, depth: p.counterDepth, group: p.groupId });
   ```
   Expected: `isCounter: true`, `requiredTargetId: "SYV9LwndQdB06IBJ"`, `depth: 1`, and `group` equal to the parent card's `groupId`.

- [ ] **Step 12: Update the docs**

`docs/12-combat-process.md` §12.8 — after the note added in Task 1:

```markdown
> A Counter keeps the **parent's `groupId`**, because §12.1's Combat Phase is the
> declaration plus its counters and `fireCombatPhaseEnd` counts unfinished siblings by
> group. That means an area Counter can catch a unit the original attack also caught, so
> the single-Injury-Roll sibling search matches on `attackerId` too — otherwise one
> unit's injuries from two different attackers in one Phase are summed as though they
> were two hits of one ability.
```

`docs/21-system-skeleton.md` — add to the settings table:

```markdown
| `counterChain` | world | `collateral` | Whether a bystander caught by an area Counter may counter back (§12.8) |
```

- [ ] **Step 13: Commit**

```bash
git add module/engine/combat-process.mjs module/engine/attack.mjs module/settings.mjs lang/en.json test/unit/counter.test.mjs docs/12-combat-process.md docs/21-system-skeleton.md
git commit -F- <<'MSG'
Counters fan out, and know who they were aimed at

`beginCounter` returns an array and carries `requiredTargetId` and
`counterDepth` onto every process in it -- `beginFanOut` was dropping
`isCounter` entirely, which would have reopened the chain the moment a counter
had more than one defender.

`canCounter` now refuses by unit rather than by flag, so `fgt.counterChain`
can let a bystander answer. The parent's groupId is kept deliberately: a
Combat Phase is the declaration plus its counters, and the injury-roll sibling
search gained an attackerId check because of it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 3: `requireUnitId` — the attacker must be caught

**Files:**
- Modify: `module/rules/targeting/resolve.mjs`
- Test: `test/unit/targeting.test.mjs` (existing — append). It already imports `resolveTargets, legalPlacements, validate` from `module/rules/targeting/resolve.mjs`.
- Modify: `docs/09-targeting.md`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `spec.limits.requireUnitId: string|undefined` — when set, `validate` fails unless that unit is among the resolved targets.

- [ ] **Step 1: Write the failing test**

Append to the targeting test file:

```js
describe("limits.requireUnitId", () => {
  // A Counter may be aimed anywhere as long as it catches the unit that
  // attacked you. Expressed as a targeting LIMIT rather than a check after the
  // fact, so the refusal is drawn under the cursor while the player is still
  // aiming -- §28.8's rule for every other legality clause.
  const board = {
    units: [
      { id: "A", name: "Attacker", kind: "servant", faction: "f1", panel: { i: 2, j: 2 }, health: { value: 10 } },
      { id: "C", name: "Bystander", kind: "servant", faction: "f1", panel: { i: 5, j: 5 }, health: { value: 10 } },
    ],
    factions: [{ id: "f1", allies: [] }, { id: "f2", allies: [] }],
  };
  const caster = { id: "B", name: "Counterer", kind: "servant", faction: "f2", panel: { i: 2, j: 3 }, range: { panels: 6 } };
  const spec = (limits) => ({
    anchor: { kind: "withinRange", range: 6 },
    shape: { kind: "single" },
    selection: { relations: ["enemy"] },
    limits,
  });

  it("passes when the required unit is caught", () => {
    const v = validate(spec({ requireUnitId: "A" }), caster, board, { panel: { i: 2, j: 2 } });
    expect(v.ok).toBe(true);
  });

  it("refuses when it is not, and says whose fault it is", () => {
    const v = validate(spec({ requireUnitId: "A" }), caster, board, { panel: { i: 5, j: 5 } });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/Attacker/);
  });

  it("changes nothing when the limit is absent", () => {
    const v = validate(spec({}), caster, board, { panel: { i: 5, j: 5 } });
    expect(v.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/targeting.test.mjs`
Expected: FAIL on the second case — `expected false to be true`, because the limit is ignored.

- [ ] **Step 3: Implement the limit**

In `module/rules/targeting/resolve.mjs`, in `resolveTargets`, immediately after the existing `limits.casterOutsideArea` check and before the `limits.requiresZon` check:

```js
  // A Counter may be aimed anywhere, as long as it catches the unit that
  // attacked. Stated as a limit rather than checked afterwards so the refusal
  // is drawn under the cursor while the player is still aiming (§28.8), which
  // is a refusal they fix by moving the mouse rather than by guessing.
  if (limits.requireUnitId && !chosen.some((t) => t.unitId === limits.requireUnitId)) {
    const required = (board.units ?? []).find((u) => u.id === limits.requireUnitId);
    errors.push(`This Counter must include ${required?.name ?? "the unit that attacked"}.`);
  }
```

Place it after `chosen` has been narrowed to its final value — find the line where `chosen` is last reassigned (`limits.maxTargets` slicing) and put this below it.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/targeting.test.mjs`
Expected: PASS.

Run: `npx vitest run` — expected the full suite still green.

- [ ] **Step 5: Live check**

As Player1 in the claude-in-chrome tab, confirm the limit refuses in a real targeting session by pushing a spec through the resolver on the client:

```js
const { validate } = await import("/systems/fgt/module/rules/targeting/resolve.mjs");
const { currentBoard, unitSnapshot } = await import("/systems/fgt/module/engine/board.mjs");
const board = currentBoard();
const her = game.actors.get("SYV9LwndQdB06IBJ");
const spec = {
  anchor: { kind: "withinRange", range: 6 },
  shape: { kind: "single" },
  selection: { relations: ["enemy"] },
  limits: { requireUnitId: "buTLFCGAlQKOXXuy" },
};
const hit  = validate(spec, unitSnapshot(her), board, { panel: { i: 6, j: 2 } });
const miss = validate(spec, unitSnapshot(her), board, { panel: { i: 8, j: 2 } });
({ hit: hit.ok, miss: miss.ok, why: miss.reasons });
```

Expected: `hit: true`, `miss: false`, and `why` naming Karna. Screenshot the console result.

- [ ] **Step 6: Document it**

In `docs/09-targeting.md`, in the table or list of `limits`, add a row:

```markdown
| `requireUnitId` | The named unit must be among the resolved targets. A Counter's *"declare an Attack on the AU"* (§12.8) — the area may be centred anywhere as long as it catches the attacker. |
```

- [ ] **Step 7: Commit**

```bash
git add module/rules/targeting/resolve.mjs test/unit/targeting.test.mjs docs/09-targeting.md
git commit -F- <<'MSG'
Targeting can require a particular unit be caught

`limits.requireUnitId`, for a Counter's "declare an Attack on the AU". A limit
rather than a check afterwards, so the refusal is drawn under the cursor while
the player is still aiming.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 4: Extract the declaration body

**Files:**
- Modify: `module/engine/attack.mjs` (`resolveAttack`)
- Test: no new tests — this task's contract is that **nothing changes**
- Modify: `docs/12-combat-process.md`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```js
  declareProcesses({
    attackerId, attacker, ability, attackSpec, targets, placement, board,
    isCounter = false, requiredTargetId = null, counterDepth = 0,
  }) -> Promise<{groupId, processes: Array<{messageId, state}>, messageId, state}>
  ```

This is a **pure refactor**. `resolveAttack` keeps its budget spend, its legality checks and its target resolution; only the "turn resolved targets into live Processes with cards and events" half moves.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run` and note the exact pass count. Nothing in this task may change it.

- [ ] **Step 2: Cut the body out**

In `module/engine/attack.mjs`, find the block in `resolveAttack` that begins with the `primaryId` computation (`const primaryId = attackSpec.pierce && ...`) and ends with the `return { groupId: states[0].groupId, processes, messageId: ..., state: ... };`.

Move that entire block, verbatim, into a new function placed directly below `resolveAttack`:

```js
/**
 * Turn resolved targets into live Combat Processes: one per defender, each
 * with its reaction offer, its card, its flags and its events.
 *
 * Extracted from `resolveAttack` so the **Counter** path can use it too. A
 * counter needs every one of these steps — the fan-out, the per-defender
 * reaction offer, the concealment refusals, `attackDeclared`, `attacked`, the
 * caster phases, `abilityUsed`, the ladder-collapse flag — and a second copy
 * would be the one nobody updates. This file has been bitten by exactly that
 * twice: `resolveAttack` kept no use record, and an attack's rider phases
 * ignored `target`.
 *
 * What deliberately did NOT move is the budget spend. It stays in
 * `resolveAttack`, above this call, so a Counter does not *skip* paying for a
 * turn — the payment is not on its path at all.
 *
 * @param {object} args
 * @returns {Promise<{groupId: string, processes: Array<{messageId: string, state: object}>, messageId: string, state: object}>}
 */
async function declareProcesses({
  attackerId, attacker, ability, attackSpec, targets, placement, board,
  isCounter = false, requiredTargetId = null, counterDepth = 0,
}) {
  // ...the moved block, unchanged except for the two edits in Step 3...
}
```

- [ ] **Step 3: Thread the counter fields through the fan-out**

Inside the moved block, the `process.beginFanOut({...})` call gains three arguments:

```js
    ? process.beginFanOut({
      attackerId,
      targetIds,
      attack: attackSpec,
      isAoE: new Set(targetIds).size > 1,
      isCounter, requiredTargetId, counterDepth,
    })
```

and the single-process fallback beside it:

```js
    : [process.begin({
      attackerId, defenderId: null, attack: attackSpec,
      isCounter, requiredTargetId, counterDepth,
    })];
```

`targetIds` is derived inside the moved block from `targets`; if it was computed above the cut line in `resolveAttack`, move that derivation down with it.

- [ ] **Step 4: Call it from `resolveAttack`**

Where the block used to be:

```js
  return declareProcesses({
    attackerId, attacker, ability, attackSpec, targets, placement, board,
  });
```

- [ ] **Step 5: Run the suite and the lint**

Run: `npx vitest run`
Expected: exactly the pass count from Step 1. A refactor that changes a test result is not a refactor — read the failure and put back whatever you dropped.

Run: `npm run lint` — expected clean.

- [ ] **Step 6: Live regression — a normal attack and an area NP still work**

Three sessions. As **Player1**:

1. Heracles attacks Karna with a Normal Attack, through the bar and the canvas, as in Task 2's live check.
2. As **Player2**, Block. Confirm damage resolves and Karna's Health drops:
   `game.actors.get("buTLFCGAlQKOXXuy").system.health`
3. Screenshot both players' cards.
4. Now the area path: as Player1, use Heracles's **Nine Lives** Noble Phantasm on a panel that catches at least two units. Confirm one card per defender and that they share a `groupId`:
   ```js
   game.messages.contents.slice(-3).map(m => {
     const raw = m.getFlag("fgt","process");
     if (!raw) return null;
     const p = JSON.parse(raw);
     return { def: p.defenderId, group: p.groupId, aoe: p.isAoE };
   });
   ```
   Expected: one entry per defender, all with the same `group`, `aoe: true`.

If Nine Lives is refused for Sustainability, top it up as GM first:
`await game.actors.get("SYV9LwndQdB06IBJ").update({"system.sustainability.value": 20})`

- [ ] **Step 7: Document the extraction**

In `docs/12-combat-process.md`, in the implementation note at the head of the chapter, add:

```markdown
> Declaration is **one code path**. `engine/attack.mjs#declareProcesses` turns resolved
> targets into live Processes — the fan-out, each defender's reaction offer and
> concealment refusals, the cards, `attackDeclared`, `attacked`, the caster phases and
> `abilityUsed` — and both an ordinary declaration and a §12.8 Counter go through it. The
> budget spend stays above it in `resolveAttack`, so a Counter does not skip paying for a
> turn; the payment is not on its path.
```

- [ ] **Step 8: Commit**

```bash
git add module/engine/attack.mjs docs/12-combat-process.md
git commit -F- <<'MSG'
Extract the declaration body so a Counter can use it

`declareProcesses` is the half of `resolveAttack` that turns resolved targets
into live Processes with cards and events. A Counter needs all of it, and a
second copy would be the one nobody updates -- this file has been bitten by
that twice already.

No behaviour change. The budget spend stays in `resolveAttack` above the call,
so a Counter never reaches it rather than skipping it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 5: Declare a Counter with a chosen ability

**Files:**
- Modify: `module/engine/attack.mjs` (`runCounter`, `advanceAttack`)
- Modify: `module/net/operations.mjs`
- Test: `test/unit/authorize.test.mjs` (append the authorizer tests)
- Modify: `docs/26-authority-and-sockets.md`

**Interfaces:**
- Consumes: `declareProcesses` (Task 4), `beginCounter(s, {attack, targetIds, isAoE})` (Task 2), `limits.requireUnitId` (Task 3), `counterOffer` (Task 1).
- Produces:
  - `runCounter(state, {abilityId, placement}) -> Promise<{groupId, processes, messageId, state}|null>`
  - socket operation `declareCounter` with payload `{messageId, abilityId, placement, respondingUnitId}`

- [ ] **Step 1: Write the authorizer tests**

Append to `test/unit/authorize.test.mjs`:

```js
describe("declareCounter authorization", () => {
  // The second half matters more than the first. Without the rung check, any
  // owner could post this operation at any moment and get a free attack that
  // costs no turn budget -- which is precisely what a Counter is, minus the
  // part where somebody attacked you first.
  const auth = OPERATIONS.declareCounter.authorize;

  it("refuses a user who does not own the responding unit", () => {
    const out = auth({ respondingUnitId: "archer", messageId: "m1" }, "alice");
    expect(out.allowed).toBe(false);
  });

  it("allows the owner while the parent process is on the counter rung", () => {
    const out = auth({ respondingUnitId: "saber", messageId: "onCounterRung" }, "alice");
    expect(out.allowed).toBe(true);
  });

  it("refuses the owner when the parent process is somewhere else", () => {
    const out = auth({ respondingUnitId: "saber", messageId: "onDamageRung" }, "alice");
    expect(out.allowed).toBe(false);
  });
});
```

This needs the `world()` helper at the top of that file to serve messages. Extend it so `game.messages.get(id)` returns `{ getFlag: () => JSON.stringify({ state: id === "onCounterRung" ? "counter" : "damage" }) }`, and make sure the file's global stub assigns `globalThis.game` before the assertions run — follow whatever the existing tests in that file already do.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/authorize.test.mjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'authorize')`.

- [ ] **Step 3: Rewrite `runCounter`**

Replace `runCounter` in `module/engine/attack.mjs`:

```js
/**
 * Run the counter as its own Combat Processes, roles reversed (§12.8, §27.10).
 *
 * A full declaration, not a bare damage roll: Ch. 41 rules that the source's
 * *"Steps 1 and 4 are repeated"* is a typo for "1 **to** 4".
 *
 * The counterer picks WHAT to counter with. Until now this function hardcoded a
 * Normal Attack and `beginCounter`'s `attack` parameter — which it has had
 * since it was written — was never passed by anybody.
 *
 * No budget is spent: `declareProcesses` is below `resolveAttack`'s spend, so
 * this path never reaches it. The chosen ability's OWN cost is paid, because
 * `declareProcesses` runs the caster phases and `recordUse` exactly as a
 * declaration on your own turn does.
 *
 * @param {object} state the process being countered
 * @param {object} [choice]
 * @param {string|null} [choice.abilityId] null for a Normal Attack
 * @param {object} [choice.placement] from the targeting session
 * @returns {Promise<object|null>}
 */
async function runCounter(state, { abilityId = null, placement = null } = {}) {
  const counterer = game.actors.get(state.defenderId);
  const required = game.actors.get(state.attackerId);
  if (!counterer || !required) return null;

  const ability = abilityId ? counterer.items.get(abilityId) : null;
  const board = boardSnapshot();
  const attackSpec = attackSpecFor(counterer, ability);

  // The units this counter actually caught. A Normal Attack with no placement
  // is the original attacker and nobody else -- the old behaviour, kept as the
  // default so a counter declared without a choice still works.
  const spec = ability
    ? targetSpecForAttack(counterer, ability, rollOptionsFor({ attacker: unitFrom(board, counterer) }))
    : null;
  const targets = spec && placement
    ? resolveTargets({ ...spec, limits: { ...(spec.limits ?? {}), requireUnitId: state.attackerId } },
      unitFrom(board, counterer) ?? unitSnapshot(counterer), board, placement)
    : { units: [{ unitId: state.attackerId }] };

  // The safety net for a payload that got past the authorizer with a placement
  // that misses. The targeting session refuses this under the cursor; this is
  // the server saying so again, because the client is not the authority.
  if (!targets.units.some((u) => u.unitId === state.attackerId)) return null;

  return declareProcesses({
    attackerId: counterer.id,
    attacker: counterer,
    ability,
    attackSpec,
    targets,
    placement,
    board,
    isCounter: true,
    requiredTargetId: state.attackerId,
    counterDepth: (state.counterDepth ?? 0) + 1,
  });
}
```

Check the real names of `attackSpecFor`, `targetSpecForAttack`, `rollOptionsFor`, `resolveTargets`, `unitFrom`, `unitSnapshot` and `boardSnapshot` against the imports already at the top of `module/engine/attack.mjs` and use whatever that file actually calls them. Do not add an import that duplicates an existing one under a new name.

- [ ] **Step 4: Pass the choice through `advanceAttack`**

In `advanceAttack`, the `counter` branch currently reads:

```js
  } else if (state.state === "counter" && event === "counter") {
    const counter = await runCounter(state);
```

Change it to accept the choice, and change `advanceAttack`'s own signature to carry it:

```js
export async function advanceAttack({ messageId, event, abilityId = null, placement = null }) {
```

```js
  } else if (state.state === "counter" && event === "counter") {
    const counter = await runCounter(state, { abilityId, placement });
    // A refused counter must not advance the ladder: the rung stays open and
    // the player may aim again. Silently advancing was how a mis-aimed area
    // would have consumed the whole counter.
    if (!counter) {
      ui.notifications?.warn(game.i18n.localize("FGT.Counter.MustIncludeAttacker"));
      return state;
    }
    state = process.advance(state, "counter", { counterMessageId: counter?.messageId ?? null });
```

Add to `lang/en.json`:

```json
  "FGT.Counter.MustIncludeAttacker": "A Counter must include the unit that attacked you.",
```

- [ ] **Step 5: Add the socket operation**

In `module/net/operations.mjs`, after `advanceProcess`:

```js
  /**
   * Declare a §12.8 Counter with a chosen ability.
   *
   * Separate from `advanceProcess` because it carries a placement and because
   * its authorizer needs a second clause: the parent Process must actually be
   * ON its counter rung. Without that, any owner could post this at any moment
   * and receive a free attack that costs no turn budget — which is what a
   * Counter is, minus the part where somebody attacked them first.
   */
  declareCounter: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      if (user?.isGM) return { allowed: true, reason: null };

      const unit = game.actors.get(payload.respondingUnitId);
      if (!unit?.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: "Not your decision to make." };
      }

      const message = game.messages.get(payload.messageId);
      const raw = message?.getFlag("fgt", "process");
      let state = null;
      try { state = raw ? JSON.parse(raw) : null; } catch { state = null; }
      if (state?.state !== "counter") {
        return { allowed: false, reason: "That Process is not offering a Counter." };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { advanceAttack } = await import("../engine/attack.mjs");
      return advanceAttack({
        messageId: payload.messageId,
        event: "counter",
        abilityId: payload.abilityId ?? null,
        placement: payload.placement ?? null,
      });
    },
  },
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS, including the orphan-operation drift test in `authorize.test.mjs` — `declareCounter` is requested from `cards.mjs` in Task 6, so **until then it will fail as an orphan**. Add `"declareCounter"` to that test's `DEAD` set temporarily with the comment `// wired in Task 6`, and REMOVE it in Task 6. Do not leave it there.

Run: `npm run lint` — expected clean.

- [ ] **Step 7: Live check — declare a counter with a Noble Phantasm, from the console**

The UI arrives in Task 6, so drive the new operation directly. Three sessions.

1. As **Player1**: Heracles attacks Karna (bar → canvas → confirm).
2. As **Player2**: Block, so the ladder reaches the counter rung. Do **not** press Counter.
3. As **Player2**, in the console — Karna counters with Brahmastra Kundala aimed at Heracles's panel (6,1):
   ```js
   const { FGTSocket } = await import("/systems/fgt/module/net/socket.mjs");
   const m = game.messages.contents.at(-1);
   const np = game.actors.get("buTLFCGAlQKOXXuy").items.find(i => i.name.startsWith("Brahmastra"));
   await FGTSocket.request("declareCounter", {
     messageId: m.id, respondingUnitId: "buTLFCGAlQKOXXuy",
     abilityId: np.id, placement: { panel: { i: 6, j: 1 } },
   });
   ```
4. Screenshot Player2's chat. Expected: a new card headed **Lancer ⚔ Berserker** naming Brahmastra Kundala, not "Normal Attack".
5. Confirm the NP was actually paid for:
   ```js
   const k = game.actors.get("buTLFCGAlQKOXXuy");
   ({ sus: k.system.sustainability, used: k.items.get(np.id)?.system?.timesUsed });
   ```
   Expected: Sustainability reduced, `timesUsed` incremented.
6. Confirm the miss case is refused. Repeat from step 1, and at step 3 aim at a panel that does not catch Heracles, e.g. `{ i: 2, j: 8 }`. Expected: the request resolves without creating a counter card, a warning notification appears, and the counter rung is **still open** on the card.

- [ ] **Step 8: Document the operation**

In `docs/26-authority-and-sockets.md`, in the operations table, add:

```markdown
| `declareCounter` | Owner of the responding unit, **and** the parent Process must be on its `counter` rung | Declares a §12.8 Counter with a chosen ability and placement. The second clause is what stops the operation being a free attack on demand. |
```

- [ ] **Step 9: Commit**

```bash
git add module/engine/attack.mjs module/net/operations.mjs lang/en.json test/unit/authorize.test.mjs docs/26-authority-and-sockets.md
git commit -F- <<'MSG'
A Counter can be declared with any Attack

`runCounter` takes the chosen ability and placement and goes through
`declareProcesses`, so a counter with a Noble Phantasm resolves through exactly
the machinery a declaration on your own turn does -- targeting, the ladder,
the caster phases and the ability's own cost -- minus the turn budget.

The new `declareCounter` operation authorizes on ownership AND on the parent
Process being on its counter rung; without the second clause it would be a
free attack available at any moment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 6: The armed action bar

**Files:**
- Modify: `module/apps/hud/present.mjs`, `module/apps/hud/action-bar.mjs`
- Modify: `module/apps/chat/cards.mjs`, `templates/hud/action-bar.hbs`, `templates/chat/attack.hbs`
- Modify: `styles/src/_apps.scss`, `lang/en.json`
- Test: `test/unit/action-bar-present.test.mjs` (existing — append), `test/unit/authorize.test.mjs` (remove the temporary DEAD entry)
- Modify: `docs/29-user-interface.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `counterOffer` (Task 1), `declareCounter` (Task 5), `limits.requireUnitId` (Task 3).
- Produces: `ActionBar.armForCounter({ token, messageId, requiredTargetId })` and `ActionBar.disarmCounter()`.

- [ ] **Step 1: Write the failing presenter test**

Append to `test/unit/action-bar-present.test.mjs`:

```js
describe("slotFor in counter mode", () => {
  const np = { id: "np1", name: "Nine Lives", img: "np.webp", isNP: true };
  const ok = { ok: true };

  it("marks an Attack as available to Counter with", () => {
    const slot = slotFor(np, { verdict: ok, counter: { isAttack: true } });
    expect(slot.counter).toBe(true);
    expect(slot.disabled).toBe(false);
  });

  it("disables anything that is not an Attack, and says why", () => {
    // Dimmed with a reason, never hidden. A dead control with no explanation
    // is how a player concludes the system is broken.
    const slot = slotFor({ id: "s1", name: "Argos" }, { verdict: ok, counter: { isAttack: false } });
    expect(slot.disabled).toBe(true);
    expect(slot.reason).toBe("notAnAttack");
    expect(slot.counter).toBe(false);
  });

  it("keeps an unaffordable Attack visible, disabled, with its own reason", () => {
    // The counterer needs to know the Noble Phantasm exists and why it cannot
    // be used, which is a different fact from "this is not an Attack".
    const slot = slotFor(np, {
      verdict: { ok: false, reason: "sustainability" }, counter: { isAttack: true },
    });
    expect(slot.disabled).toBe(true);
    expect(slot.reason).toBe("sustainability");
    expect(slot.counter).toBe(true);
  });

  it("behaves exactly as before when not countering", () => {
    const slot = slotFor(np, { verdict: ok });
    expect(slot.counter).toBe(false);
    expect(slot.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/action-bar-present.test.mjs`
Expected: FAIL — `expected undefined to be true`.

- [ ] **Step 3: Teach `slotFor` the counter view**

In `module/apps/hud/present.mjs`, extend `slotFor`'s options and body:

```js
export function slotFor(ability, { verdict, cost = null, turnsPerRound = 3, counter = null }) {
  const remaining = ability?.cooldownRemaining ?? 0;
  const cooldown = remaining > 0
    ? { remaining, label: ticksLabel(remaining, turnsPerRound) }
    : null;

  let ring = null;
  if (ability?.isNP && ability?.fieldOpen) ring = "built";
  else if (ability?.active) ring = "on";

  const refused = verdict?.ok === false;
  // §12.8. While the bar is armed for a Counter, an ability that is not an
  // Attack is not a choice -- and it is DIMMED with a reason rather than
  // hidden, so a player can see that their buff exists and is simply not an
  // answer to being attacked.
  const notAnAttack = Boolean(counter) && counter.isAttack === false;

  return {
    id: ability?.id ?? null,
    name: ability?.name ?? "",
    img: ability?.img ?? null,
    cost,
    cooldown,
    ring,
    // The glow. True only for something that could actually answer, which is a
    // different question from whether it can be afforded -- an unaffordable
    // Noble Phantasm still glows, and still says why it is disabled.
    counter: Boolean(counter) && counter.isAttack === true,
    disabled: refused || Boolean(cooldown) || notAnAttack,
    reason: notAnAttack
      ? "notAnAttack"
      : (refused ? (verdict.reason ?? "unavailable") : (cooldown ? "cooldown" : null)),
  };
}
```

- [ ] **Step 4: Run the presenter tests**

Run: `npx vitest run test/unit/action-bar-present.test.mjs`
Expected: PASS.

- [ ] **Step 5: Arm the bar**

In `module/apps/hud/action-bar.mjs`, add the state and the two entry points to the class:

```js
  /**
   * The Counter this bar is armed for, or `null`.
   *
   * §12.8's rung is the one moment a unit may attack outside its own turn, so
   * the bar is armed FOR the player rather than waiting for them to find it:
   * the token is selected, the bar opens, and the abilities that could answer
   * glow.
   *
   * @type {{messageId: string, requiredTargetId: string}|null}
   */
  counter = null;

  /**
   * @param {object} args
   * @param {object} args.token
   * @param {string} args.messageId
   * @param {string} args.requiredTargetId
   */
  static armForCounter({ token, messageId, requiredTargetId }) {
    const bar = ActionBar.instance;
    if (!bar || !token) return;
    token.control({ releaseOthers: true });
    bar.token = token;
    bar.counter = { messageId, requiredTargetId };
    bar.render({ force: true });
  }

  /** Put the bar back to normal. Idempotent. */
  static disarmCounter() {
    const bar = ActionBar.instance;
    if (!bar?.counter) return;
    bar.counter = null;
    if (bar.rendered) bar.render({ force: true });
  }
```

In `_prepareContext`, pass the counter view down to each ability slot and expose the flag to the template. Inside the `.map` over abilities, change the `slotFor` call:

```js
        const slot = slotFor({
          ...entry,
          img: item.img,
          name: item.name,
          active: Boolean(item.system?.active),
          fieldOpen: openFields.has(entry.contentId ?? item.id),
        }, {
          verdict,
          cost: abilityCost(item.system?.cost, null, snapshot),
          turnsPerRound,
          counter: this.counter ? { isAttack: use.isAttack } : null,
        });
```

and add to the returned context object:

```js
      counter: this.counter ? { armed: true } : null,
```

The `refresh` debounce in `attach()` sets `bar.token` from the current selection and closes the bar when nothing is controlled. Guard it so an armed bar is not closed by an incidental deselect:

```js
    const refresh = foundry.utils.debounce(() => {
      const controlled = canvas.tokens?.controlled?.[0] ?? null;
      // An armed bar belongs to a Counter rung, not to the selection. Closing
      // it because the player clicked empty canvas would lose the prompt.
      if (bar.counter) return bar.render({ force: true });
      bar.token = controlled?.actor?.isOwner ? controlled : null;
      if (bar.token) bar.render({ force: true });
      else if (bar.rendered) bar.close();
    }, 60);
```

- [ ] **Step 6: Route the armed click**

In `onUseSlot`, before the existing `row === "actions"` branch:

```js
    // §12.8. While armed, every click is a Counter declaration: the Normal
    // Attack from the actions row, an ability from any other. The ordinary
    // handlers below are not reached, so a Move or a mode toggle cannot be
    // performed by answering an attack.
    if (this.counter) {
      const isNormal = row === "actions" && id === "attack";
      const item = isNormal ? null : actor.items.get(id);
      if (!isNormal && !(item && classifyAbility(item).isAttack)) {
        ui.notifications.warn(game.i18n.localize("FGT.Counter.NotAnAttack"));
        return;
      }
      return this.declareCounterWith(actor, item);
    }
```

And add the method:

```js
  /**
   * Aim a Counter and send it.
   *
   * `requireUnitId` goes into the spec's limits, so an area that misses the
   * attacker is refused **under the cursor** while the player is still aiming
   * rather than after they commit (§28.8).
   *
   * Cancelling targeting leaves the bar armed. Declining is a button on the
   * card and is always explicit — a cancelled aim must not spend the rung.
   *
   * @param {object} actor
   * @param {object|null} item null for a Normal Attack
   * @returns {Promise<void>}
   */
  async declareCounterWith(actor, item) {
    const armed = this.counter;
    if (!armed) return;

    const { pickPlacementFor } = await import("../actor-sheet/sheet.mjs");
    const placement = await pickPlacementFor(actor, item, {
      requireUnitId: armed.requiredTargetId,
    });
    if (!placement) return;

    const { FGTSocket } = await import("../../net/socket.mjs");
    try {
      await FGTSocket.request("declareCounter", {
        messageId: armed.messageId,
        respondingUnitId: actor.id,
        abilityId: item?.id ?? null,
        placement,
      });
      ActionBar.disarmCounter();
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }
```

`pickPlacement` in `module/apps/actor-sheet/sheet.mjs` is currently a module-private function. Export it as `pickPlacementFor(actor, ability, { requireUnitId = null } = {})` and, inside it, merge the limit into the spec it builds:

```js
  const spec = targetSpecForAttack(actor, ability, rollOptionsFor({ attacker: boardSelf }));
  const aimed = requireUnitId
    ? { ...spec, limits: { ...(spec.limits ?? {}), requireUnitId } }
    : spec;
```

and pass `aimed` to `pickTarget` in place of `spec`. Keep the existing private `pickPlacement` as a thin call to it so `declareAttack` is untouched.

- [ ] **Step 7: Arm and disarm from the card**

In `module/apps/chat/cards.mjs`, inside the `renderChatMessageHTML` hook, after `fillAttackCard`:

```js
    armCounterRung(message);
```

and add:

```js
/**
 * Arm the token's action bar when this viewer owns the unit being offered a
 * Counter, and disarm it when the rung has passed.
 *
 * §12.8's rung is the one moment a unit may attack outside its own turn, so the
 * player is not left to discover that the bar has become meaningful — the token
 * is selected, the bar opens, and the abilities that could answer glow.
 *
 * @param {object} message
 */
function armCounterRung(message) {
  if (message.getFlag?.("fgt", "kind") !== "attack") return;
  const raw = message.getFlag("fgt", "process");
  if (!raw) return;

  let state = null;
  try { state = process.deserialize(raw); } catch { return; }

  const prompt = pendingPrompt(state);
  const isCounterRung = state.state === "counter" && prompt?.kind === "counter";
  const actor = game.actors.get(state.defenderId);

  if (!isCounterRung || !actor?.isOwner) {
    ActionBar.disarmCounter();
    return;
  }
  const token = actor.getActiveTokens?.()[0] ?? null;
  if (!token) return;
  ActionBar.armForCounter({
    token, messageId: message.id, requiredTargetId: state.attackerId,
  });
}
```

Import `ActionBar` at the top of `cards.mjs`: `import { ActionBar } from "../hud/action-bar.mjs";`. If that creates an import cycle (`check-layers` or a runtime `undefined`), use a dynamic `await import` inside `armCounterRung` instead and make the function `async`, calling it without awaiting.

- [ ] **Step 8: Markup and strings**

`templates/hud/action-bar.hbs` — add the glow class and the hint to the slot button:

```hbs
            <button type="button"
                    class="fgt-slot{{#if slot.disabled}} fgt-slot--disabled{{/if}}{{#if slot.ring}} fgt-slot--{{slot.ring}}{{/if}}{{#if slot.counter}} fgt-slot--counter{{/if}}"
                    data-action="useSlot" data-row="{{row.id}}" data-slot="{{slot.id}}"
                    data-tooltip="{{slot.tooltip}}">
```

Still in that template, above `<div class="fgt-actionbar__rows">`:

```hbs
  {{#if counter.armed}}
    <div class="fgt-actionbar__counter">{{localize "FGT.Counter.Armed"}}</div>
  {{/if}}
```

In `_prepareContext`, the ability tooltip must say the new thing. Where `tooltip` is built, replace it with:

```js
          tooltip: slot.counter && !slot.disabled
            ? `${item.name} — ${game.i18n.localize("FGT.Counter.Available")}`
            : (slot.disabled
              ? `${item.name} — ${slot.reason === "notAnAttack"
                ? game.i18n.localize("FGT.Counter.NotAnAttack")
                : abilityRefusal(verdict, entry, turnsPerRound)}`
              : item.name),
```

`lang/en.json`:

```json
  "FGT.Counter.Armed": "Counter — choose an Attack",
  "FGT.Counter.Available": "Available as a Counter",
  "FGT.Counter.NotAnAttack": "Not an Attack — a Counter must be one",
```

`templates/chat/attack.hbs` — the counter prompt's own buttons come from `promptOptions`, so no change is needed there; the Decline button already exists as `data-fgt-event="declined"`.

- [ ] **Step 9: The glow**

In `styles/src/_apps.scss`, inside the existing `.fgt-slot` block:

```scss
  // §12.8. Armed for a Counter: this ability can answer. A soft outer glow
  // rather than a border, so it reads as "reach for this" and does not collide
  // with `--on` and `--built`, which say something else entirely.
  &--counter {
    box-shadow: 0 0 0 1px rgba(255, 214, 128, 0.9), 0 0 10px 2px rgba(255, 176, 32, 0.55);
    animation: fgt-counter-pulse 1.6s ease-in-out infinite;
  }

@keyframes fgt-counter-pulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255, 214, 128, 0.9), 0 0 8px 1px rgba(255, 176, 32, 0.45); }
  50%      { box-shadow: 0 0 0 1px rgba(255, 226, 160, 1),   0 0 14px 4px rgba(255, 176, 32, 0.7); }
}
```

Put the `@keyframes` at the top level of the file, not nested inside `.fgt-slot`. And add, beside the other `.fgt-actionbar__*` rules:

```scss
  &__counter {
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 214, 128, 0.95);
  }
```

Run: `npm run build:styles`
Run: `npx vitest run test/unit/styles.test.mjs` — the one-owner-per-class guard must stay green.

- [ ] **Step 10: Remove the temporary orphan exemption**

In `test/unit/authorize.test.mjs`, delete `"declareCounter"` from the `DEAD` set added in Task 5 Step 6. `cards.mjs` requests it now, so the drift test should pass without the exemption. If it does not, the arming code is not calling the operation — fix that rather than the test.

- [ ] **Step 11: Run everything**

Run: `npm run lint` — expected clean.
Run: `npx vitest run` — expected all green.
Run: `npm run check:templates` — expected `0 problem(s)`.

- [ ] **Step 12: Live check — the whole feature, three sessions**

**12a. The bar arms itself.**
1. Player1: Heracles attacks Karna.
2. Player2: Block.
3. On Player2's screen, **without clicking anything**, screenshot. Expected: Karna is selected, the action bar is open, "Counter — choose an Attack" is showing, and Brahmastra Kundala and the Attack action glow while Magic Resistance and Riding are dimmed.
4. Hover a glowing slot and screenshot the tooltip. Expected: *"Brahmastra Kundala — Available as a Counter"*.
5. Hover a dimmed one. Expected: *"Riding — Not an Attack — a Counter must be one"*.

**12b. The required target is refused under the cursor.**
6. Click Brahmastra Kundala. Targeting opens.
7. Hover a panel far from Heracles, e.g. (2,8). Screenshot. Expected: illegal tint and a refusal naming Heracles.
8. Hover Heracles's panel (6,1). Screenshot. Expected: legal, "click to confirm".

**12c. It resolves, and pays.**
9. Click to confirm; confirm in the review dialog. Screenshot both players' chat. Expected: a card headed **Lancer ⚔ Berserker** naming Brahmastra Kundala.
10. `game.actors.get("buTLFCGAlQKOXXuy").system.sustainability` — expected reduced.
11. Confirm no turn budget was spent: the Faction 2 turn panel's Servant-attacks counter is unchanged from before step 6. Screenshot it.

**12d. The chain rule, both settings.**
12. As GM: `await game.settings.set("fgt","counterChain","collateral")`. Move Foe Master to a panel inside Brahmastra Kundala's area so it is caught as a bystander, and give it to Player2 if the area needs an owner who can answer.
13. Repeat 1–9. Expected: Heracles gets **no** Counter prompt (Rule 1) and the bystander **does**.
14. As GM: `await game.settings.set("fgt","counterChain","strict")`, repeat. Expected: the bystander gets no Counter prompt either.
15. Screenshot each.

**12e. Declining still works.**
16. Reach the rung and click **Decline** on the card. Expected: the ladder completes, the bar disarms, and the glow is gone. Screenshot.

- [ ] **Step 13: Documentation and changelog**

`docs/29-user-interface.md` §29.5 — add:

```markdown
> **Armed for a Counter.** On §12.8's rung the bar is armed *for* the player rather than
> waiting to be found: the token is selected, the bar opens, and every ability that could
> answer glows and hints *"Available as a Counter"*. Everything else dims with *"Not an
> Attack"* — dimmed rather than hidden, because a player needs to see that their buff
> exists and is simply not an answer to being attacked. Cancelling the aim leaves the bar
> armed; declining is always a deliberate click on the card.
```

`docs/45-implementation-status.md` — update the Chapter 12 row to record that §12.8's Counter is a full attack declaration, and note that the **Master redirect** remains unimplemented.

`CHANGELOG.md` — under `## [Unreleased]`, in `### Added`:

```markdown
- **A Counter is a real attack (Ch. 12 §12.8).** The rung accepts any ability
  `classifyAbility` calls an Attack — a Noble Phantasm, an attack Skill, or the Normal
  Attack — aimed anywhere that catches the unit that attacked you. `beginCounter` had
  taken the attack as a parameter since it was written and no caller ever passed one, so
  the default *was* the feature: every Counter in the game was a Normal Attack at exactly
  one target. The ability pays its own cost and no turn budget, the choice is made on the
  token's own bar (armed automatically, with the eligible abilities glowing), and
  `fgt.counterChain` decides whether a bystander an area Counter merely caught may
  answer — the unit it was *aimed* at never can, in either mode.
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -F- <<'MSG'
Arm the bar for a Counter

On the counter rung the token is selected, its bar opens, and every ability
that could answer glows with "Available as a Counter"; everything else dims
with "Not an Attack" rather than disappearing. Aiming refuses under the cursor
unless the attacker is caught, and cancelling leaves the rung open -- declining
stays a deliberate click.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §3 which abilities qualify | 1 (`counterOffer`), 6 (`classifyAbility` gate in `onUseSlot`) |
| §4 chain rule, setting, depth, new fields | 1, 2 |
| §5 required target, `requireUnitId` | 3, 5 (server re-check), 6 (aiming) |
| §5 range checked twice | 2 (`counterAvailable` unchanged) + 6 (per-ability refusal on the slot) |
| §6 one declaration path | 4 |
| §7 the interaction, arming, authority | 5 (`declareCounter`), 6 (bar) |
| §8 files | all |
| §9 testing, incl. live per task | every task's penultimate step |
| D2 pays its own cost, no budget | 4 (spend stays above), 5 (caster phases run), 6 live step 11 |
| D7 automatic counters unchanged | untouched by every task — `runCounter`'s default is still a Normal Attack |
| D10 Master redirect stays a gap | Task 6 Step 13 records it |

**Known ordering hazard, stated on purpose:** Task 5 adds `declareCounter` before anything requests it, so the orphan-operation drift test added earlier this branch will fail. Task 5 Step 6 exempts it temporarily and Task 6 Step 10 removes the exemption. If the plan is executed out of order or stopped between 5 and 6, that exemption is live code debt — do not ship it.
