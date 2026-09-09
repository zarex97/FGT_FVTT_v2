# The global Noble Phantasm round gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ch. 07 §7.9's Noble Phantasm availability gate real — no NP before Round 6 (Round 4 for Assassin) — with a per-ability override, an additive cooldown interaction, and a seam for the unbuilt Master Essence shifts.

**Architecture:** One pure Layer-2 module (`rules/np-gate.mjs`) holds all the arithmetic. One reader (`rules/costs.mjs#canUseAbility`) consults it where it already consults `requiresRound`, with the gate arguments defaulting to the published constants so a call site that forgets them gets the gate rather than no gate. One writer (`engine/io.mjs`'s cooldown setter) records increases taken while still gated. Three world settings seed from `CONFIG.FGT.gates`.

**Tech Stack:** Foundry VTT v14, ES modules, Vitest. Layered: `domain`(1) ← `rules`(2) ← `engine`(3) ← `apps`/`documents`(4), enforced by `tools/check-layers.mjs`. `rules/` and `domain/` may never touch `game`, `canvas`, `ui` or `Hooks`.

**Spec:** `docs/superpowers/specs/2026-09-09-np-round-gate-design.md`

## Global Constraints

- **The gate defaults on.** Every optional argument (`gates`, `turn`, `turnsPerRound`) falls back to a published constant. A call site that omits one must get the correct Round-6 gate, never an absent gate — "silently skipped" is the defect class this plan exists to close.
- **`rules/` may not touch `game`.** Settings are read in Layer 3 (`engine/`) or Layer 4 (`apps/`) and passed down as plain values. `tools/check-layers.mjs` enforces this; run it.
- **Absolute, never a countdown.** `cooldown.gatedDelay` is a permanent shift of the availability turn. It is never decremented and never reset.
- **A stated gate overrides the global one** (spec R3). This reverses the `max()` rule recorded in Ch. 44 §44.5. `max()` still applies *between an ability's own two ways of stating a gate* (`npGateRound` and `targeting.limits.requiresRound`), because both are the ability speaking.
- **The gate covers `isNP || categorizedAsNP`** (spec R2).
- **A multi-class Servant takes the earliest gate** (spec R5).
- **Live verification is required.** Green tests are not evidence. Every task that changes behaviour ends with a measurement in the `fgt2026` world before the next task starts. Bring the world up with:
  ```bash
  node -e "fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent('http://localhost:30000/'),{method:'PUT'})"
  node tools/fgt-world.mjs launch && node tools/fgt-world.mjs join
  ```
  A pack change needs `node tools/fgt-rebuild.mjs` (Foundry must be closed; the tool handles it).
- **Docs travel with the change.** `docs/45` alone is not enough; the affected 00–44 chapter must change in the same commit.
- **Commit message trailer:**
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
  ```

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/np-gate.mjs` *(new)* | All gate arithmetic. Pure. Answers "which Round does this unit's NP open in" and "on which absolute Turn is this ability available". |
| `test/unit/np-gate.test.mjs` *(new)* | Exhaustive tests for the above, including the essence seam and turn arithmetic across `turnsPerRound ∈ {3, 8, 15}`. |
| `module/data/item/ability.mjs:42` | `abilityCommon()`'s shared `cooldown` SchemaField gains `gatedDelay`. One edit serves both `AbilityData` and `NoblePhantasmData`. |
| `module/engine/io.mjs:449` | `setCooldown` records an increase taken before the gate opens. The only site in the system where a cooldown increase is applied. |
| `module/rules/ability-use.mjs:396` | `usageSpecFor` projects `categorizedAsNP` and `cooldown.gatedDelay`, which it does not today. |
| `module/rules/costs.mjs:132` | `canUseAbility` consults the gate where it already consults `requiresRound`. |
| `module/settings.mjs` | Three world settings seeded from `CONFIG.FGT.gates`. |
| `module/rules/environment.mjs:568` | `attacksPermitted` takes the gate value instead of hardcoding `> 1`. |
| `module/engine/attack.mjs:132,180` | Passes the settings down. |
| `module/engine/skill-use.mjs:83` | Passes the settings down. |
| `packs/_source/abilities/normal-magic-crest.yml` | Gains `npGateRound: 3`. |

---

### Task 1: The pure module

Nothing changes behaviour in this task — the module is written and tested in isolation, and read by nobody until Task 4. That is deliberate: the arithmetic is the part worth getting exactly right, and it is the part that can be tested without a world.

**Files:**
- Create: `module/rules/np-gate.mjs`
- Test: `test/unit/np-gate.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `NP_GATE` — `{round: 6, assassinRound: 4}`, frozen
  - `ESSENCE_SHIFT` — `{kaleidoscope: 4, imaginaryNumber: 3, leyline: 2, harvest: 1}`, frozen
  - `isGated(ability) → boolean`
  - `baseGateRound(unit, gates = NP_GATE) → number`
  - `essenceShift(master) → number`
  - `gateRoundFor(unit, master, gates = NP_GATE) → number`
  - `gateTurnFor(unit, master, {gates, turnsPerRound}) → number`
  - `npAvailableTurn(unit, ability, master, {gates, turnsPerRound}) → number`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/np-gate.test.mjs`:

```js
/**
 * @file The Noble Phantasm availability gate.
 * @see docs/07-time-model.md §7.9, module/rules/np-gate.mjs
 *
 * `CONFIG.FGT.gates` held all four of §7.9's numbers from the day the config
 * was written and NOTHING read that object. Measured live before this existed:
 * a Noble Phantasm fires in Round 1.
 */

import { describe, it, expect } from "vitest";
import {
  NP_GATE, ESSENCE_SHIFT, isGated, baseGateRound, essenceShift,
  gateRoundFor, gateTurnFor, npAvailableTurn,
} from "../../module/rules/np-gate.mjs";

const servant = (classes) => ({ id: "s", kind: "servant", servantClasses: classes });

describe("isGated", () => {
  it("covers a real Noble Phantasm", () => {
    expect(isGated({ isNP: true })).toBe(true);
  });

  it("...and one that is only CATEGORIZED as one", () => {
    // The same predicate §15.5's other three scoping questions use. EMIYA's
    // Overedge, Bašmu's Dragonfire, Mannanán's Fragarach Counter and the
    // Hanging Gardens are all in scope.
    expect(isGated({ categorizedAsNP: true })).toBe(true);
  });

  it("leaves an ordinary Skill alone", () => {
    expect(isGated({ isNP: false, categorizedAsNP: false })).toBe(false);
    expect(isGated({})).toBe(false);
    expect(isGated(null)).toBe(false);
  });
});

describe("baseGateRound", () => {
  it("opens at Round 6 for everyone", () => {
    expect(baseGateRound(servant(["saber"]))).toBe(6);
  });

  it("...and two Rounds earlier for an Assassin", () => {
    expect(baseGateRound(servant(["assassin"]))).toBe(4);
  });

  it("gives a multi-class Servant the EARLIEST of its classes", () => {
    // The mirror of ZON's rule that the widest zone applies: a rule that opens
    // sooner is not cancelled by one that opens later.
    expect(baseGateRound(servant(["saber", "assassin"]))).toBe(4);
    expect(baseGateRound(servant(["assassin", "berserker"]))).toBe(4);
  });

  it("gives a unit with no classes the general gate, not an exemption", () => {
    // Exemption is a decision and no sheet states one.
    expect(baseGateRound(servant([]))).toBe(6);
    expect(baseGateRound({ id: "m", kind: "master" })).toBe(6);
    expect(baseGateRound(undefined)).toBe(6);
  });

  it("takes its numbers from the gates it is handed", () => {
    expect(baseGateRound(servant(["saber"]), { round: 3, assassinRound: 2 })).toBe(3);
    expect(baseGateRound(servant(["assassin"]), { round: 3, assassinRound: 2 })).toBe(2);
  });
});

describe("essenceShift", () => {
  it("is zero for every Master in the game today", () => {
    // The seam. `MasterData.essences` is a SetField that nothing writes and
    // nothing reads; the essence subsystem is unbuilt (spec §2).
    expect(essenceShift({ id: "m", essences: [] })).toBe(0);
    expect(essenceShift({ id: "m" })).toBe(0);
    expect(essenceShift(null)).toBe(0);
  });

  it("reads the table when a Master carries one", () => {
    expect(essenceShift({ essences: ["kaleidoscope"] })).toBe(4);
    expect(essenceShift({ essences: ["harvest"] })).toBe(1);
  });

  it("takes the LARGEST when a Master somehow carries two", () => {
    // One essence per Master is the rule; the arithmetic must not silently
    // stack two into a Round-0 gate if the setup UI ever admits both.
    expect(essenceShift({ essences: ["harvest", "kaleidoscope"] })).toBe(4);
  });

  it("ignores an essence that does not shift the gate", () => {
    expect(essenceShift({ essences: ["formalcraft"] })).toBe(0);
  });
});

describe("gateRoundFor", () => {
  it("subtracts the shift", () => {
    expect(gateRoundFor(servant(["saber"]), { essences: ["kaleidoscope"] })).toBe(2);
    expect(gateRoundFor(servant(["assassin"]), { essences: ["leyline"] })).toBe(2);
  });

  it("never returns a Round before the first", () => {
    // Round 0 does not exist, and a gate of 0 would read as "no gate".
    expect(gateRoundFor(servant(["assassin"]), { essences: ["kaleidoscope"] })).toBe(1);
  });

  it("is the base gate for a Servant with no Master", () => {
    expect(gateRoundFor(servant(["saber"]), null)).toBe(6);
  });
});

describe("gateTurnFor", () => {
  it("converts the Round to the first Turn of it", () => {
    // Round 6 at three Turns to the Round starts on global turn 16.
    expect(gateTurnFor(servant(["saber"]), null, { turnsPerRound: 3 })).toBe(16);
    expect(gateTurnFor(servant(["assassin"]), null, { turnsPerRound: 3 })).toBe(10);
  });

  it("holds across every turnsPerRound the harness exercises", () => {
    // §7.10 tests the time model against {3, 8, 15} rather than sampling.
    expect(gateTurnFor(servant(["saber"]), null, { turnsPerRound: 8 })).toBe(41);
    expect(gateTurnFor(servant(["saber"]), null, { turnsPerRound: 15 })).toBe(76);
  });

  it("defaults to three Turns to the Round", () => {
    expect(gateTurnFor(servant(["saber"]), null, {})).toBe(16);
  });
});

describe("npAvailableTurn", () => {
  const np = (over = {}) => ({ isNP: true, cooldown: { remaining: 0, gatedDelay: 0 }, ...over });

  it("is the gate turn for an ability nothing has delayed", () => {
    expect(npAvailableTurn(servant(["saber"]), np(), null, { turnsPerRound: 3 })).toBe(16);
  });

  it("adds a cooldown increase taken while still gated", () => {
    // > "If a Unit has its NP Cooldown increased before its NP would be
    // > available, then its NP would only be usable X Turns AFTER its NP would
    // > be available, X being the number of Turns its NP Cooldown was increased
    // > by."
    //
    // Additive, not `max()` — §7.9's own pseudocode says max and is wrong
    // (spec R1). Under max() an NP Lock spent before the gate is free, which is
    // the outcome the clause exists to prevent.
    const locked = np({ cooldown: { remaining: 0, gatedDelay: 5 } });
    expect(npAvailableTurn(servant(["saber"]), locked, null, { turnsPerRound: 3 })).toBe(21);
  });

  it("is the gate turn for an ability the gate does not cover", () => {
    // An ordinary Skill is available whenever its own cooldown allows.
    expect(npAvailableTurn(servant(["saber"]), { isNP: false }, null, { turnsPerRound: 3 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and watch every one fail**

Run: `npx vitest run test/unit/np-gate.test.mjs`
Expected: FAIL — `Failed to resolve import "../../module/rules/np-gate.mjs"`.

- [ ] **Step 3: Write the module**

Create `module/rules/np-gate.mjs`:

```js
/**
 * @file The Noble Phantasm availability gate.
 * @see docs/07-time-model.md §7.9
 *
 * Layer 2 (rules). Pure — no `game`, no `canvas`, no settings.
 *
 * > *"Usable after 5 full Rounds — i.e. from Round 6. Assassin: after 3 — from
 * > Round 4."*
 *
 * `CONFIG.FGT.gates` has held all four of §7.9's numbers since the config file
 * was written and **nothing read that object**. Measured live before this
 * module existed: a Noble Phantasm fires in Round 1. This is the project's
 * dominant defect shape — a rule collected, correct and inert — applied to one
 * of the game's load-bearing constraints.
 *
 * The arithmetic lives here rather than in the reader because it is the part
 * worth testing exhaustively and the part that needs no world: §7.10's argument
 * for the whole time model.
 */

/**
 * The published defaults, mirrored from `CONFIG.FGT.gates`.
 *
 * Mirrored rather than imported: `config.mjs` is Layer 4 and this is Layer 2.
 * The world settings that seed from CONFIG are read in the engine and passed
 * in; these are what a caller gets when it passes nothing, and a caller that
 * passes nothing must get the RULE rather than no rule.
 *
 * @type {Readonly<{round: number, assassinRound: number}>}
 */
export const NP_GATE = Object.freeze({ round: 6, assassinRound: 4 });

/**
 * Master Essences that open the gate early, and by how many Rounds.
 *
 * > *"Kaleidoscope: Servant NP is usable 4 Rounds earlier (Round 2 onwards)."*
 *
 * The seam for an unbuilt subsystem (spec §2). `MasterData.essences` is a
 * `SetField` that nothing writes and nothing reads, and there is no content
 * pack — so `essenceShift` returns 0 in every world today. When the essence
 * subsystem is built it populates that set and this begins working with no
 * change here.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const ESSENCE_SHIFT = Object.freeze({
  kaleidoscope: 4, imaginaryNumber: 3, leyline: 2, harvest: 1,
});

/** Classes whose gate opens early. Assassin is the only one §7.9 names. */
const EARLY_CLASSES = Object.freeze(["assassin"]);

/**
 * Does the availability gate cover this ability?
 *
 * `isNP || categorizedAsNP` — the same predicate §15.5's three other scoping
 * questions use (cooldown scope, damage-modifier scope, NP Seal scope).
 * Availability is a fourth scoping question that chapter never asked, and it
 * gets the same answer (spec R2).
 *
 * @param {object|null} ability a usage spec or an ability's system data
 * @returns {boolean}
 */
export function isGated(ability) {
  return Boolean(ability?.isNP) || Boolean(ability?.categorizedAsNP);
}

/**
 * The Round this unit's Noble Phantasms open in, before any essence.
 *
 * A Servant holding more than one class takes the **earliest** of them (spec
 * R5) — the mirror of `zonRadius`'s rule that the widest zone applies, because
 * a rule that opens sooner is not cancelled by one that opens later.
 *
 * A unit with no classes at all takes the general gate rather than being
 * exempt. Exemption is a decision and no sheet states one.
 *
 * @param {object|null|undefined} unit a unit snapshot
 * @param {{round: number, assassinRound: number}} [gates]
 * @returns {number}
 */
export function baseGateRound(unit, gates = NP_GATE) {
  const classes = unit?.servantClasses ?? [];
  const early = classes.some((c) => EARLY_CLASSES.includes(c));
  return early ? (gates.assassinRound ?? NP_GATE.assassinRound) : (gates.round ?? NP_GATE.round);
}

/**
 * How many Rounds early this Master's Essence opens its Servant's gate.
 *
 * The **largest** when a Master somehow carries two. One essence per Master is
 * the rule, and summing them would let two small ones reach Round 0 — a gate of
 * zero reads as no gate at all, which is the one outcome no essence buys.
 *
 * @param {object|null|undefined} master a Master's snapshot
 * @returns {number}
 */
export function essenceShift(master) {
  const held = [...(master?.essences ?? [])].map((id) => ESSENCE_SHIFT[id] ?? 0);
  return held.length > 0 ? Math.max(...held) : 0;
}

/**
 * The Round this unit's Noble Phantasms actually open in.
 *
 * Never earlier than Round 1: Round 0 does not exist, and a gate of 0 would
 * read as "no gate" to every comparison downstream.
 *
 * @param {object|null|undefined} unit
 * @param {object|null|undefined} master
 * @param {{round: number, assassinRound: number}} [gates]
 * @returns {number}
 */
export function gateRoundFor(unit, master, gates = NP_GATE) {
  return Math.max(1, baseGateRound(unit, gates) - essenceShift(master));
}

/**
 * The first absolute Turn on which the gate is open.
 *
 * Round `n` begins on global turn `(n − 1) × turnsPerRound + 1` (§7.4's
 * global-turn index).
 *
 * @param {object|null|undefined} unit
 * @param {object|null|undefined} master
 * @param {{gates?: object, turnsPerRound?: number}} [ctx]
 * @returns {number}
 */
export function gateTurnFor(unit, master, ctx = {}) {
  const turnsPerRound = ctx.turnsPerRound ?? 3;
  return (gateRoundFor(unit, master, ctx.gates ?? NP_GATE) - 1) * turnsPerRound + 1;
}

/**
 * The absolute Turn this ability becomes usable.
 *
 * > *"If a Unit has its NP Cooldown increased before its NP would be available
 * > (i.e. before 5 Rounds have passed), then its NP would only be usable X
 * > Turns **after** its NP would be available, X being the number of Turns its
 * > NP Cooldown was increased by."*
 *
 * **Additive, not `max()`.** §7.9 prints both readings — the prose says the two
 * compose additively and the pseudocode beneath it says
 * `max(gateTurn, readyOnTurn)` — and the prose is right (spec R1). Under `max()`
 * an NP Lock spent while the target's NP was gated anyway costs the caster a
 * Skill and buys nothing, which is precisely the outcome this clause exists to
 * prevent.
 *
 * `gatedDelay` is the running total of increases taken before the gate opened,
 * recorded by `engine/io.mjs`'s cooldown writer. Zero for every ability in
 * every world until something increases a cooldown early.
 *
 * @param {object|null|undefined} unit
 * @param {object|null} ability
 * @param {object|null|undefined} master
 * @param {{gates?: object, turnsPerRound?: number}} [ctx]
 * @returns {number} `0` when the gate does not cover this ability
 */
export function npAvailableTurn(unit, ability, master, ctx = {}) {
  if (!isGated(ability)) return 0;
  return gateTurnFor(unit, master, ctx) + (ability?.cooldown?.gatedDelay ?? 0);
}
```

- [ ] **Step 4: Run the tests and the layer check**

Run: `npx vitest run test/unit/np-gate.test.mjs && node tools/check-layers.mjs`
Expected: all tests PASS; `Layer boundaries intact`.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: 3182 passing plus the new ones. **Nothing else may change** — the module is read by nobody yet. If any existing test moves, stop: something imported this by accident.

- [ ] **Step 6: Commit**

```bash
git add module/rules/np-gate.mjs test/unit/np-gate.test.mjs
git commit -F - <<'EOF'
feat(np-gate): the availability arithmetic, as a pure module

`CONFIG.FGT.gates` has held all four of §7.9's numbers since the config file
was written and nothing read that object. Measured live: a Noble Phantasm
fires in Round 1.

The arithmetic first, read by nobody: it is the part worth testing
exhaustively and the part that needs no world. `essenceShift` is the seam for
the unbuilt Master Essence subsystem and returns 0 in every world today.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 2: The settings, and the one gate that already worked

`attacksPermitted` implements §7.9's first-round attack ban correctly and hardcodes its number, so `CONFIG.FGT.gates.noAttackRound` sits beside it unread. This task gives all four gates one source of truth, and it is deliberately first among the wiring tasks because it changes no behaviour at all — the default is the number that was hardcoded.

**Files:**
- Modify: `module/settings.mjs`
- Modify: `module/rules/environment.mjs:568`
- Modify: `module/engine/attack.mjs:180`
- Modify: `lang/en.json`
- Test: `test/unit/environment-rest.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: settings `npGateRound` (6), `npGateRoundAssassin` (4), `noAttackRound` (1); `attacksPermitted(round, noAttackRound = 1) → boolean`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/environment-rest.test.mjs`:

```js
describe("the first-round attack ban reads its Round", () => {
  // §7.9's fourth gate. The rule was right and its number was hardcoded, so
  // `CONFIG.FGT.gates.noAttackRound` sat beside it unread — the same shape as
  // the other three, one step further along.
  it("bans attacks through the Round it is given", () => {
    expect(attacksPermitted(1, 1)).toBe(false);
    expect(attacksPermitted(2, 1)).toBe(true);
  });

  it("moves with the setting", () => {
    expect(attacksPermitted(2, 2)).toBe(false);
    expect(attacksPermitted(3, 2)).toBe(true);
  });

  it("defaults to banning Round 1, which is what it hardcoded", () => {
    expect(attacksPermitted(1)).toBe(false);
    expect(attacksPermitted(2)).toBe(true);
  });

  it("permits everything when the ban is switched off", () => {
    expect(attacksPermitted(1, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch the middle two fail**

Run: `npx vitest run test/unit/environment-rest.test.mjs`
Expected: FAIL — `attacksPermitted(2, 2)` returns `true`, because the second argument is ignored.

- [ ] **Step 3: Take the number as an argument**

In `module/rules/environment.mjs`, replace `attacksPermitted`:

```js
export function attacksPermitted(round, noAttackRound = 1) {
  return (round ?? 1) > noAttackRound;
}
```

Update its docstring to record why the argument exists:

```js
/**
 * May anybody Attack this Round?
 *
 * > *"During the first Round, neither Player/Faction is allowed to Attack."*
 * > — §19.7 step 12
 *
 * The Round comes in as an argument rather than off `CONFIG`, because this is
 * Layer 2 and may not reach it — and it was hardcoded as `> 1`, which left
 * `CONFIG.FGT.gates.noAttackRound` sitting beside three other unread numbers.
 * `0` switches the ban off.
 *
 * @param {number} round
 * @param {number} [noAttackRound] the last Round in which nobody may Attack
 * @returns {boolean}
 */
```

- [ ] **Step 4: Register the three settings**

In `module/settings.mjs`, after the `turnsPerRound` registration:

```js
  // §7.9's round-indexed gates. All four numbers have been in
  // `CONFIG.FGT.gates` since that file was written and NOTHING read the object
  // -- so a Noble Phantasm was usable in Round 1 in every world. Settings
  // rather than constants so `settings-are-read.test.mjs` holds each of them to
  // having a reader, which is the guard that would have caught this.
  s("npGateRound", {
    name: "FGT.Settings.NpGateRound", hint: "FGT.Settings.NpGateRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 1, initial: 6 }),
    default: CONFIG.FGT?.gates?.npRound ?? 6, requiresReload: false,
    onChange: () => guardRuleChange("npGateRound"),
  });
  // "Assassin: after 3 -- from Round 4."
  s("npGateRoundAssassin", {
    name: "FGT.Settings.NpGateRoundAssassin", hint: "FGT.Settings.NpGateRoundAssassinHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 1, initial: 4 }),
    default: CONFIG.FGT?.gates?.npRoundAssassin ?? 4, requiresReload: false,
    onChange: () => guardRuleChange("npGateRoundAssassin"),
  });
  // "Neither faction may Attack during Round 1." `0` switches the ban off.
  s("noAttackRound", {
    name: "FGT.Settings.NoAttackRound", hint: "FGT.Settings.NoAttackRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    default: CONFIG.FGT?.gates?.noAttackRound ?? 1, requiresReload: false,
    onChange: () => guardRuleChange("noAttackRound"),
  });
```

Add all three to `RULE_SETTINGS` at the top of the file, so a mid-match change warns:

```js
const RULE_SETTINGS = ["turnsPerRound", "difficulty", "activeSkillBudget", "boardSize",
                       "warType", "ruleset",
                       // Moving a Round gate mid-match changes when every Noble
                       // Phantasm in the world becomes usable.
                       "npGateRound", "npGateRoundAssassin", "noAttackRound"];
```

- [ ] **Step 5: Add the six strings**

In `lang/en.json`, beside the other `FGT.Settings.*` entries:

```json
  "FGT.Settings.NpGateRound": "Noble Phantasm gate (Round)",
  "FGT.Settings.NpGateRoundHint": "The first Round in which a Noble Phantasm may be used. The rulebook says 6 — after five full Rounds have passed.",
  "FGT.Settings.NpGateRoundAssassin": "Noble Phantasm gate — Assassin (Round)",
  "FGT.Settings.NpGateRoundAssassinHint": "The Assassin class unlocks two Rounds early. The rulebook says 4.",
  "FGT.Settings.NoAttackRound": "No-attack Rounds",
  "FGT.Settings.NoAttackRoundHint": "Nobody may Attack up to and including this Round. The rulebook says 1. Set 0 to allow attacks immediately.",
```

- [ ] **Step 6: Read the setting at the call site**

In `module/engine/attack.mjs:180`, pass it in:

```js
  if (combat?.started
    && !attacksPermitted(combat.round ?? 1, game.settings.get("fgt", "noAttackRound"))
    && actionKind !== "skill") {
    throw new Error("FGT | No attacks are permitted during the first Round.");
  }
```

- [ ] **Step 7: Run the tests and the layer check**

Run: `npm test && node tools/check-layers.mjs`
Expected: all PASS, including `settings-are-read.test.mjs` — which will fail if any of the three new settings has no `game.settings.get("fgt", "<key>")` reader. `npGateRound` and `npGateRoundAssassin` get theirs in Task 4; if the guard complains now, add them to that test's `NOT_READ_BY_CODE` set **with the reason "read in Task 4"** and remove them there. Do not leave them in that set.

- [ ] **Step 8: Verify live**

Bring the world up, then:

```bash
node tools/fgt-eval.mjs "
const combat = game.combats.active;
await combat.update({ round: 1 });
await new Promise(r => setTimeout(r, 400));
return JSON.stringify({
  noAttackRound: game.settings.get('fgt', 'noAttackRound'),
  npGateRound: game.settings.get('fgt', 'npGateRound'),
  npGateRoundAssassin: game.settings.get('fgt', 'npGateRoundAssassin'),
})"
```

Expected: `{noAttackRound: 1, npGateRound: 6, npGateRoundAssassin: 4}`. Then confirm a Normal Attack is still refused in Round 1 and permitted in Round 2 — the behaviour must be **unchanged**, because the default is the number that was hardcoded.

- [ ] **Step 9: Document and commit**

In `docs/07-time-model.md` §7.9, after the table, record that the four gates now have one source of truth and are world settings.

```bash
git add module/settings.mjs module/rules/environment.mjs module/engine/attack.mjs lang/en.json test/unit/environment-rest.test.mjs docs/07-time-model.md
git commit -F - <<'EOF'
feat(np-gate): §7.9's four gates get one source of truth

`attacksPermitted` implemented the first-round ban correctly and hardcoded its
number, so `CONFIG.FGT.gates.noAttackRound` sat beside three other unread
numbers. All four are world settings now, seeded from CONFIG and guarded by
`guardRuleChange` -- and by `settings-are-read.test.mjs`, which holds each to
having a reader. That guard is what would have caught this class of defect.

No behaviour changes: the defaults are the numbers that were hardcoded.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 3: The additive delay, recorded

The field is written here and read in Task 4. Splitting them is deliberate: the write is at a single site in the engine and can be verified in a live world on its own, before the gate that reads it starts refusing anything.

**Files:**
- Modify: `module/data/item/ability.mjs:42` (inside `abilityCommon()`)
- Modify: `module/engine/io.mjs:449`
- Modify: `module/rules/ability-use.mjs:396`
- Test: `test/unit/ability-use.test.mjs` (or the file holding `usageSpecFor`'s tests — `test/unit/costs.test.mjs` currently has them)

**Interfaces:**
- Consumes: `gateTurnFor` from Task 1.
- Produces: `ability.system.cooldown.gatedDelay` (integer, default 0), projected onto the usage spec as `cooldown.gatedDelay`; `usageSpecFor` also now projects `categorizedAsNP`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/costs.test.mjs`:

```js
describe("the usage spec carries what the gate reads", () => {
  const spec = (over) => usageSpecFor({ id: "np", type: "ability", system: over });

  it("projects categorizedAsNP", () => {
    // The gate covers `isNP || categorizedAsNP` (spec R2) and this projection
    // carried only `isNP` -- so the gate would have missed exactly the four
    // abilities the ruling put in scope.
    expect(spec({ categorizedAsNP: true }).categorizedAsNP).toBe(true);
    expect(spec({}).categorizedAsNP).toBe(false);
  });

  it("projects the gated cooldown delay", () => {
    expect(spec({ cooldown: { remaining: 0, gatedDelay: 5 } }).cooldown.gatedDelay).toBe(5);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/costs.test.mjs`
Expected: FAIL — `expected undefined to be true`.

- [ ] **Step 3: Declare the field**

In `module/data/item/ability.mjs`, inside `abilityCommon()`'s `cooldown` SchemaField (after `regen`):

```js
      // How much this ability's cooldown was increased WHILE ITS NOBLE
      // PHANTASM GATE WAS STILL SHUT.
      //
      // > "If a Unit has its NP Cooldown increased before its NP would be
      // > available, then its NP would only be usable X Turns after its NP
      // > would be available, X being the number of Turns its NP Cooldown was
      // > increased by." (§7.9)
      //
      // A permanent shift of the availability turn, never a countdown and never
      // reset -- the same argument every duration in this system makes. Zero
      // for every ability in every world until something increases a cooldown
      // early.
      gatedDelay: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
```

One edit serves both `AbilityData` and `NoblePhantasmData`, which share `abilityCommon()`.

- [ ] **Step 4: Project both fields**

In `module/rules/ability-use.mjs#usageSpecFor`, beside `isNP`:

```js
    isNP: ability.type === "noblePhantasm" || Boolean(sys.isNP),
    // The gate covers `isNP || categorizedAsNP` (Ch. 07 §7.9, Ch. 15 §15.5),
    // and this projection carried only the first -- so the gate would have
    // missed EMIYA's Overedge, Bašmu's Dragonfire, Mannanán's Fragarach
    // Counter and the Hanging Gardens, which is exactly the set the ruling
    // put in scope.
    categorizedAsNP: Boolean(sys.categorizedAsNP),
    cooldown: sys.cooldown ?? { remaining: 0, gatedDelay: 0 },
```

- [ ] **Step 5: Record the increase**

In `module/engine/io.mjs#setCooldown`, replace the write:

```js
      const next = mode === "set"
        ? ticks
        : (mode === "increase" ? current + ticks : Math.max(0, current - ticks));

      // §7.9's cooldown interaction: an increase taken BEFORE the Noble
      // Phantasm gate opens pushes the availability turn out by that much, on
      // top of the gate. Recorded here because this is the only place in the
      // system where a cooldown increase is applied, and read by
      // `rules/np-gate.mjs#npAvailableTurn`.
      //
      // Additive rather than `max()` (spec R1): under `max()` an NP Lock spent
      // while the target's NP was gated anyway costs its caster a Skill and
      // buys nothing.
      const update = { "system.cooldown.remaining": next };
      if (mode === "increase" && ticks > 0) {
        const { gateTurnFor, isGated } = await import("../rules/np-gate.mjs");
        const gateTurn = isGated(item.system)
          ? gateTurnFor(snapshotUnit(actor), masterOf(actor), {
            gates: gateSettings(),
            turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          })
          : 0;
        const now = game.combat?.system?.globalTurn ?? 0;
        if (now < gateTurn) {
          update["system.cooldown.gatedDelay"] = (item.system.cooldown?.gatedDelay ?? 0) + ticks;
        }
      }
      await item.update(update);
```

Add the two helpers near the top of `module/engine/io.mjs`:

```js
/**
 * The gate numbers, read where Layer 3 may read them.
 *
 * `rules/np-gate.mjs` is Layer 2 and may not touch `game`, so the settings are
 * fetched here and handed down as plain values.
 *
 * @returns {{round: number, assassinRound: number}}
 */
function gateSettings() {
  return {
    round: game.settings.get("fgt", "npGateRound"),
    assassinRound: game.settings.get("fgt", "npGateRoundAssassin"),
  };
}

/**
 * The Master this actor is contracted to, as a snapshot, or `null`.
 *
 * Only the essence shift needs it, and no Master carries an essence yet — but
 * reading it now is what makes the seam real rather than notional.
 *
 * @param {object} actor
 * @returns {object|null}
 */
function masterOf(actor) {
  const id = actor?.system?.masterId ?? null;
  const master = id ? game.actors.get(id) : null;
  return master ? snapshotUnit(master) : null;
}
```

`io.mjs` already imports `snapshotUnit` from `../rules/snapshot.mjs` (line 18) — **use that name**, not `unitSnapshot`, and do **not** import from `./board.mjs`: `board.mjs` is the higher-level module here and pulling it in from `io.mjs` would invert the dependency.

- [ ] **Step 6: Run the tests and the layer check**

Run: `npm test && node tools/check-layers.mjs`
Expected: all PASS. The new field is written but read by nothing that refuses, so no existing test may move.

- [ ] **Step 7: Verify the write live**

The gate does not refuse yet, so this measures the accumulator alone. With the world up:

```bash
node tools/fgt-eval.mjs "
const I = await import('/systems/fgt/module/engine/intents.mjs');
const { applyWorldIntents } = await import('/systems/fgt/module/engine/applier.mjs');
const combat = game.combats.active;
const ozy = [...game.actors].find(a => a.system?.contentId === 'ozymandias');
const np = ozy.items.find(i => i.type === 'noblePhantasm');
await np.update({ 'system.cooldown.remaining': 0, 'system.cooldown.gatedDelay': 0 });
// Round 2 -- well before the Round-6 gate
await combat.update({ round: 2, 'system.globalTurn': 4 });
await new Promise(r => setTimeout(r, 400));
await applyWorldIntents([I.cooldown(ozy.id, np.id, 5, 'increase')], 'probe');
await new Promise(r => setTimeout(r, 600));
const early = { remaining: np.system.cooldown.remaining, gatedDelay: np.system.cooldown.gatedDelay };
// ...and again, well after it
await combat.update({ round: 9, 'system.globalTurn': 25 });
await new Promise(r => setTimeout(r, 400));
await applyWorldIntents([I.cooldown(ozy.id, np.id, 5, 'increase')], 'probe');
await new Promise(r => setTimeout(r, 600));
return JSON.stringify({ early, late: { remaining: np.system.cooldown.remaining, gatedDelay: np.system.cooldown.gatedDelay } }, null, 1)"
```

Expected: `early` shows `remaining: 5, gatedDelay: 5`; `late` shows `remaining: 10, gatedDelay: 5` — the second increase lands on the cooldown but **not** on the delay, because the gate was already open.

- [ ] **Step 8: Document and commit**

In `docs/07-time-model.md` §7.9, replace the `npAvailableTurn` pseudocode with the additive form and say the previous printing was wrong (spec R1).

```bash
git add module/data/item/ability.mjs module/engine/io.mjs module/rules/ability-use.mjs test/unit/costs.test.mjs docs/07-time-model.md
git commit -F - <<'EOF'
feat(np-gate): record a cooldown increase taken before the gate opens

§7.9 prints two readings of its own cooldown interaction -- prose saying the
gate and the increase compose additively, pseudocode saying `max()` -- and the
prose is right: under `max()` an NP Lock spent while the target's NP was gated
anyway costs its caster a Skill and buys nothing, which is the outcome the
clause exists to prevent. The pseudocode is corrected.

`cooldown.gatedDelay` is written at the one site where a cooldown increase is
applied. A permanent shift of the availability turn, never a countdown and
never reset.

`usageSpecFor` also now projects `categorizedAsNP`, which it did not -- the
gate covers `isNP || categorizedAsNP`, so without it the gate would have missed
exactly the four abilities that ruling puts in scope.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 4: The gate refuses

This is the task that changes the game. Everything before it was inert.

**Files:**
- Modify: `module/rules/costs.mjs:132`
- Modify: `module/engine/attack.mjs:132` and its three other `canUseAbility` call sites
- Modify: `module/engine/skill-use.mjs:83`
- Modify: `module/apps/actor-sheet/context.mjs:609`
- Modify: `module/apps/hud/action-bar.mjs:163`
- Test: `test/unit/costs.test.mjs`

**Interfaces:**
- Consumes: `isGated`, `gateRoundFor`, `npAvailableTurn`, `NP_GATE` from Task 1; `cooldown.gatedDelay` and `categorizedAsNP` on the usage spec from Task 3.
- Produces: `canUseAbility({ability, unit, master, round, turn, gates, turnsPerRound})` refusing with `reason: "round"` and `detail: {requiresRound, round}`.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/costs.test.mjs`:

```js
describe("the global Noble Phantasm gate", () => {
  const ok = (over = {}) => ({
    ability: np(), unit: servant({ servantClasses: ["saber"] }),
    master: master(), round: 6, ...over,
  });

  it("refuses a Noble Phantasm before Round 6", () => {
    const verdict = canUseAbility(ok({ round: 5 }));
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("round");
    expect(verdict.detail).toMatchObject({ requiresRound: 6, round: 5 });
  });

  it("...and allows it at Round 6", () => {
    expect(canUseAbility(ok({ round: 6 })).ok).toBe(true);
  });

  it("opens two Rounds early for an Assassin", () => {
    const assassin = servant({ servantClasses: ["assassin"] });
    expect(canUseAbility(ok({ unit: assassin, round: 4 })).ok).toBe(true);
    expect(canUseAbility(ok({ unit: assassin, round: 3 })).ok).toBe(false);
  });

  it("covers an ability that is only CATEGORIZED as a Noble Phantasm", () => {
    const crest = { id: "c", categorizedAsNP: true, cooldown: { remaining: 0 } };
    expect(canUseAbility(ok({ ability: crest, round: 5 })).ok).toBe(false);
  });

  it("leaves an ordinary Skill alone", () => {
    const skill = { id: "s", cooldown: { remaining: 0 } };
    expect(canUseAbility(ok({ ability: skill, round: 1 })).ok).toBe(true);
  });

  it("lets a stated gate override the global one -- LATER", () => {
    // Ozymandias: "can only be used after 7 full Rounds have passed."
    const late = np({ requiresRound: 8 });
    expect(canUseAbility(ok({ ability: late, round: 7 })).ok).toBe(false);
    expect(canUseAbility(ok({ ability: late, round: 8 })).ok).toBe(true);
  });

  it("...and EARLIER, which is what keeps the Magic Crest's own row alive", () => {
    // Spec R3. This is the direction `max()` could not express, and it is why
    // the composition rule Ch. 44 recorded is replaced.
    const crest = { id: "c", categorizedAsNP: true, requiresRound: 3, cooldown: { remaining: 0 } };
    expect(canUseAbility(ok({ ability: crest, round: 2 })).ok).toBe(false);
    expect(canUseAbility(ok({ ability: crest, round: 3 })).ok).toBe(true);
  });

  it("takes the gate numbers it is handed", () => {
    expect(canUseAbility(ok({ round: 3, gates: { round: 3, assassinRound: 2 } })).ok).toBe(true);
  });

  it("defaults to the published gate when handed none", () => {
    // The failure mode this whole change exists to close: a call site that
    // forgets must get the RULE, never no rule.
    expect(canUseAbility(ok({ round: 5 })).ok).toBe(false);
  });

  it("adds a cooldown increase taken while gated", () => {
    // Gate turn for Round 6 at three Turns to the Round is 16; a delay of 5
    // pushes availability to turn 21, which is Round 7.
    const locked = np({ cooldown: { remaining: 0, gatedDelay: 5 } });
    expect(canUseAbility(ok({ ability: locked, round: 6, turn: 16, turnsPerRound: 3 })).ok)
      .toBe(false);
    expect(canUseAbility(ok({ ability: locked, round: 7, turn: 21, turnsPerRound: 3 })).ok)
      .toBe(true);
  });
});
```

`servant()` in that file takes no overrides today; change its definition to accept them:

```js
const servant = (over = {}) => ({
  id: "s", kind: "servant", contract: "contracted", masterId: "m",
  servantClasses: ["saber"], ...over,
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/unit/costs.test.mjs`
Expected: FAIL — every refusal case returns `ok: true`, because no gate exists.

- [ ] **Step 3: Read the gate**

In `module/rules/costs.mjs`, add the import:

```js
import { isGated, gateRoundFor, npAvailableTurn, NP_GATE } from "./np-gate.mjs";
```

Change the signature and the round gate:

```js
export function canUseAbility({
  ability, unit, master = null, round = 1, turn = null,
  gates = NP_GATE, turnsPerRound = 3, ...ctx
}) {
```

and replace the `requiresRound` block:

```js
  // §7.9's availability gate. An ability's OWN gate wins outright -- Ozymandias
  // states Round 8 and the Magic Crest states Round 3, and BOTH must hold
  // (spec R3). The global gate covers only abilities that state neither.
  //
  // This replaces the `max()` composition Ch. 44 §44.5 recorded: `max()` cannot
  // express a stated gate EARLIER than the global one, which is what the Magic
  // Crest's own row in §7.9's table is.
  //
  // `gates` defaults to the published numbers rather than to nothing, because
  // there are seven call sites and "silently skipped" is precisely the defect
  // this gate is being built to close.
  const stated = ability?.requiresRound ?? null;
  const requiresRound = stated !== null
    ? stated
    : (isGated(ability) ? gateRoundFor(unit, master, gates) : null);

  if (requiresRound !== null && round < requiresRound) {
    return { ok: false, reason: "round", detail: { requiresRound, round }, cost };
  }

  // ...and the Turn-level half, which only a cooldown increase taken before the
  // gate opened can trigger. Skipped entirely when nothing has delayed this
  // ability, which is every ability in every world until one does.
  const delay = ability?.cooldown?.gatedDelay ?? 0;
  if (delay > 0 && stated === null && isGated(ability)) {
    const availableTurn = npAvailableTurn(unit, ability, master, { gates, turnsPerRound });
    const now = turn ?? ((round - 1) * turnsPerRound + 1);
    if (now < availableTurn) {
      return {
        ok: false, reason: "round",
        detail: { requiresRound: Math.ceil(availableTurn / turnsPerRound), round, delayedBy: delay },
        cost,
      };
    }
  }
```

- [ ] **Step 4: Run the gate tests**

Run: `npx vitest run test/unit/costs.test.mjs`
Expected: the new block PASSES. Other tests in the file may now fail — that is Step 5.

- [ ] **Step 5: Run the whole suite and triage the fallout**

Run: `npm test`

Existing fixtures use Noble Phantasms at `round: 3`, which the gate now refuses. For **each** failure, decide:

- **A convenience** — the round was chosen arbitrarily to satisfy an unrelated assertion. Update it to `round: 6` and leave a one-line comment saying the gate now applies.
- **A decision** — the test asserts something *about* rounds. Do not edit it; stop and report it.

The known cases in `test/unit/costs.test.mjs` are the local `ok()` helper at line 61 (`round: 3` — a convenience, change to 6) and the four Master-health assertions at lines 157–176 (conveniences, change to 6). Check `test/unit/items.test.mjs`, `test/unit/karna.test.mjs` and `test/unit/sheet-present.test.mjs` too.

- [ ] **Step 6: Pass the settings down at every call site**

Layer 3 and 4 read the settings; Layer 2 receives them. Add to each of the seven call sites:

```js
    gates: {
      round: game.settings.get("fgt", "npGateRound"),
      assassinRound: game.settings.get("fgt", "npGateRoundAssassin"),
    },
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    turn: game.combat?.system?.globalTurn ?? null,
```

The sites are `engine/attack.mjs:132`, `engine/attack.mjs:2394`, `engine/attack.mjs:4775`, `engine/attack.mjs:4834`, `engine/skill-use.mjs:83`, `apps/actor-sheet/context.mjs:609` and `apps/hud/action-bar.mjs:163`. Factor the object into one exported helper rather than repeating it seven times — put `gateContext()` in `module/engine/board.mjs` beside `currentBoard`, which every one of these files already imports.

If `settings-are-read.test.mjs` had `npGateRound`/`npGateRoundAssassin` in `NOT_READ_BY_CODE` from Task 2, **remove them now**.

- [ ] **Step 7: Run everything**

Run: `npm test && node tools/check-layers.mjs`
Expected: all PASS.

- [ ] **Step 8: Verify live — the four scenarios this task owns**

```bash
node tools/fgt-eval.mjs "
const { canUseAbility } = await import('/systems/fgt/module/rules/costs.mjs');
const { usageSpecFor } = await import('/systems/fgt/module/rules/ability-use.mjs');
const { currentBoard, gateContext } = await import('/systems/fgt/module/engine/board.mjs');
const b = currentBoard();
const ozy = [...game.actors].find(a => a.system?.contentId === 'ozymandias');
const mes = ozy.items.find(i => i.system?.contentId === 'ozymandias-mesektet');
const unit = b.units.find(u => u.id === ozy.id);
const master = b.units.find(u => u.id === ozy.system.masterId) ?? null;
const at = (round) => canUseAbility({
  ability: usageSpecFor(mes), unit, master, round, ...gateContext(),
});
return JSON.stringify({
  round5: at(5), round6: at(6),
}, null, 1)"
```

Expected: `round5` refuses with `reason: "round"` and `detail.requiresRound: 6`; `round6` is `ok: true`.

Then run the same against a **live declaration**, which is the thing that matters — reset the budget and turn state, set the Round to 5, and confirm `resolveAttack` throws *"it cannot be used before Round 6 (this is Round 5)"*; then Round 6 and confirm it resolves. Then confirm Ozymandias's Ramesseum Tentyris still refuses at Round 7 and opens at Round 8.

- [ ] **Step 9: Document and commit**

Update `docs/07-time-model.md` §7.9 (the gate is built), `docs/15-abilities.md` §15.5 (availability is a fourth scoping question), and `docs/44-case-expanded-roster.md` §44.5 (the `max()` rule is replaced by "a stated gate overrides").

```bash
git add -A
git commit -F - <<'EOF'
feat(np-gate): the gate refuses

Every Servant in every world could fire its Noble Phantasm on Turn one.
`CONFIG.FGT.gates.npRound` had held the number 6 since the config file was
written and nothing read it.

A stated gate overrides the global one rather than composing by max(), which
reverses what Ch. 44 §44.5 recorded. `max()` cannot express a stated gate
EARLIER than the global one, and §7.9's own table gives the Magic Crest exactly
that -- its Round-3 row is dead under max().

`gates` defaults to the published numbers rather than to nothing: there are
seven call sites, and a forgotten argument must produce the rule rather than no
rule, which is the defect class this closes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 5: The Magic Crest's own Round

One authored line, and the live proof that a stated gate can open *earlier* than the global one — the direction `max()` could not express.

**Files:**
- Modify: `packs/_source/abilities/normal-magic-crest.yml`

**Interfaces:**
- Consumes: the override semantics from Task 4.
- Produces: nothing further.

- [ ] **Step 1: Author the gate**

In `packs/_source/abilities/normal-magic-crest.yml`, after `categorizedAsNP: true`:

```yaml
# "Magic Crest — usable after 2 full Rounds, from Round 3" (Ch. 07 §7.9's own
# table row). It is `categorizedAsNP`, so the global Noble Phantasm gate covers
# it -- and its own row is what keeps it usable three Rounds before that. A
# stated gate OVERRIDES the global one; under the `max()` rule this replaced,
# this line would have been dead and a Master would have had no offensive
# option before Round 6.
npGateRound: 3
```

- [ ] **Step 2: Validate and rebuild**

Run: `npm run validate:content && npm test && node tools/fgt-rebuild.mjs`
Expected: `0 error(s)`; all tests pass; the world comes back up.

- [ ] **Step 3: Verify live**

With a Normal-ruleset Master on the board, confirm its Magic Crest is refused in Round 2 with *"it cannot be used before Round 3"* and allowed in Round 3 — while a Servant's Noble Phantasm on the same board is still refused until Round 6.

```bash
node tools/fgt-eval.mjs "
const { canUseAbility } = await import('/systems/fgt/module/rules/costs.mjs');
const { usageSpecFor } = await import('/systems/fgt/module/rules/ability-use.mjs');
const { currentBoard, gateContext } = await import('/systems/fgt/module/engine/board.mjs');
const b = currentBoard();
const m = [...game.actors].find(a => a.type === 'master' && a.items.some(i => i.system?.contentId === 'normal-magic-crest'));
if (!m) return 'no Normal-ruleset Master on the board';
const crest = m.items.find(i => i.system?.contentId === 'normal-magic-crest');
const unit = b.units.find(u => u.id === m.id);
const at = (round) => canUseAbility({ ability: usageSpecFor(crest), unit, master: unit, round, ...gateContext() });
return JSON.stringify({ round2: at(2), round3: at(3) }, null, 1)"
```

Expected: `round2` refuses with `detail.requiresRound: 3`; `round3` is `ok: true`.

- [ ] **Step 4: Document and commit**

```bash
git add packs/_source/abilities/normal-magic-crest.yml
git commit -F - <<'EOF'
feat(np-gate): the Magic Crest states its own Round

§7.9 gives the Magic Crest its own table row -- "usable after 2 full Rounds,
from Round 3" -- and it is `categorizedAsNP`, so the global gate covers it.
Its own row is what keeps it usable three Rounds earlier, and only because a
stated gate overrides the global one: under `max()` this line would be dead and
a Normal-ruleset Master would have no offensive option before Round 6.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 6: The gate, in a live match

No new code. The spec lists seven measurements and this task is all seven, run end to end in `fgt2026`.

**Files:** `docs/45-implementation-status.md`, `docs/07-time-model.md`

- [ ] **Step 1: Bring the world up**

```bash
node -e "fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent('http://localhost:30000/'),{method:'PUT'})"
node tools/fgt-world.mjs launch && node tools/fgt-world.mjs join && node tools/fgt-world.mjs status
```

- [ ] **Step 2: Run the spec's seven scenarios**

Each through a real declaration (`resolveAttack`), not only through `canUseAbility` — a gate that refuses in the rules layer and not at the button is a gate that does not exist:

1. A Servant's Noble Phantasm refused in Round 5 and allowed in Round 6, the refusal naming the Round.
2. An Assassin's Noble Phantasm allowed in Round 4 and refused in Round 3. (Summon one from `packs/_source/servants-normal/` or give a Servant `servantClasses: ["assassin"]`.)
3. Ozymandias's Ramesseum Tentyris still refused at Round 7 and opening at Round 8.
4. A Master's Magic Crest refused in Round 2 and allowed in Round 3.
5. `CS: Force Noble Phantasm` still refused before the gate — it lists `overridesValidation: [cooldown, usesExhausted]` with `round` deliberately absent, so this is a regression check on a rule that was previously unreachable.
6. An NP Lock applied in Round 2 pushing availability past Round 6 by exactly its length: increase a Noble Phantasm's cooldown by 5 in Round 2, then confirm it is still refused at Round 6 turn 16 and allowed at turn 21.
7. A Normal Attack still permitted from Round 2 and refused in Round 1.

- [ ] **Step 3: Look at it**

Open a Servant's sheet in the browser with the Round below the gate and screenshot it. The Noble Phantasm must read *"available from Round 6"* with a count of Rounds away, from `apps/actor-sheet/present.mjs`'s `FGT.Ability.FromRound` — a refusal a player can act on rather than a disabled button with no reason.

- [ ] **Step 4: Record what was observed**

Write the entry in `docs/45-implementation-status.md` in the style of the other **built** entries — naming what was measured rather than what the tests assert — and correct §7.9's closing note.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -F - <<'EOF'
docs(np-gate): the gate, measured in a live match

Seven scenarios through real declarations rather than through `canUseAbility`
alone: a gate that refuses in the rules layer and not at the button is a gate
that does not exist.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

## Self-review

**Spec coverage.** §1 (what is wrong) → Tasks 2 and 4. §2 (essences out of scope) → Task 1's `essenceShift` seam and its tests. R1 additive → Tasks 1 and 3. R2 `categorizedAsNP` → Task 1's `isGated`, Task 3's projection, Task 4's test. R3 stated overrides → Task 4's reader and both-direction tests, Task 5's content. R4 settings → Task 2. R5 earliest class → Task 1. §4.4 `attacksPermitted` → Task 2; Magic Crest → Task 5. §4.5 settings → Task 2. §5 (Force NP, the refusal surface, Ozymandias, the Assassin NP) → Task 6 scenarios 3 and 5. §6 fallout → Task 4 Step 5. §7 testing → Tasks 1, 4, 6. §8 chapters → Tasks 2, 3, 4, 6.

**Type consistency.** `gateRoundFor(unit, master, gates)` and `npAvailableTurn(unit, ability, master, ctx)` are called with those exact argument orders in Task 4. `cooldown.gatedDelay` is the field name in Tasks 3 and 4 and in the Task 1 test fixtures. `gateContext()` is introduced in Task 4 Step 6 and used in Tasks 4, 5 and 6.

**One thing an executor must not do.** Task 2 Step 7 permits parking `npGateRound`/`npGateRoundAssassin` in `NOT_READ_BY_CODE` for one commit only. Task 4 Step 6 removes them. Leaving them there is the exact defect this plan is about.
