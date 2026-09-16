# Nursery Rhyme, Part 4 — The Queen's Glass Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Noble Phantasm that returns every Unit in a 3-panel ring to the state it held three Rounds ago — and, once per game, six Rounds back the moment Nursery dies.

**Architecture:** Three phases. Phase 1 builds the history subsystem bottom-up: the gate that keeps every other match free, the recorder, the ring buffer, and the restore. Phase 2 opens the engine's escape hatch — a closed, name-keyed `Script` registry, which the element has always promised and never had — and writes the one entry in it. Phase 3 authors the ability and walks it on a live board.

**Tech Stack:** Foundry VTT v14, ES modules, JSDoc typing, Vitest, YAML content compiled to LevelDB packs. Layer discipline `domain → rules → engine → apps` is enforced by ESLint.

**Spec:** `docs/superpowers/specs/2026-09-16-nursery-4-glass-game-design.md`, which adopts **Ch. 43 §43.11** wholesale. **Read both before Task 1**, and read the spec's three correction blocks: *"enters Combat"* is a moment the engine does not have, effect 2 must not hang on `unitDefeated`, and the `Script` registry does not exist.

## Global Constraints

- **Part 4 of 4.** It depends on **Part 1** for the Servant and on **Part 3** only for R2's carve-out. If Part 3 is not built when this is, the carve-out is **inert rather than wrong**, and goes live the moment tokens exist. Her Servant file gains its **last** ability ref here.
- **The gate is the whole performance story.** `historyRecording` is **off by default** and switched on only when a unit declaring `requiresHistory: true` enters play. *"A match without Nursery Rhyme pays nothing."* **The flag must be tested as a flag** — a match with no such ability present writes **nothing** — and that assertion is worth more than any of the restore tests.
- **Both allowlists, from the start.** `requiresHistory` is exactly the shape of field this project has now silently dropped **six** times: on the schema, in the YAML, absent from `itemSystem()`, compiled to its default. It goes into `tools/lib/content.mjs` **and** `module/content/authored-fields.mjs` in the same commit that adds it to the schema.
- **Not restored, ever:** position, facing, turn budget, contract state (R1 / **Q45**, already settled), and Nameless Forest Tokens (R2). The first four are excluded **by omission from the buffer**, which is what makes Q45 cheap to keep and expensive to reverse. The fifth is a **named carve-out** in the applier, because tokens live in `resources` and the buffer stores `resources`.
- **Layer boundaries.** `module/domain` and `module/rules` are pure. `npm run lint` runs `tools/check-layers.mjs`.
- **`npm test`, `npm run lint` and `npm run validate:content` must pass at every commit.**
- **Rebuilding packs needs the world shut down.** `node tools/fgt-world.mjs shutdown` → `npm run build:packs` → `launch` → rejoin.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
  ```

---

# Phase 1 — the history subsystem

---

### Task 1: The gate (E2 — the constraint the whole part rests on)

**Files:**
- Modify: `module/data/item/ability.mjs` (`requiresHistory`)
- Modify: `tools/lib/content.mjs`, `module/content/authored-fields.mjs` (**both** allowlists)
- Create: `module/rules/history.mjs`
- Test: `test/unit/nursery-glass-game.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `requiresHistory: boolean` on the ability schema; `historyWanted(board)` exported pure from `module/rules/history.mjs`, true exactly when some unit on the board carries an ability declaring it.

**First, because everything after it is conditional on it.** A recorder written before its gate is a recorder that runs in every match in the game, and the cost is paid by 28 other Servants for a feature one uses.

- [ ] **Step 1: Write the failing test**

Create `test/unit/nursery-glass-game.test.mjs`:

```js
/**
 * @file The Queen's Glass Game, against her sheet and Ch. 43 §43.11.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/43-bounded-fields.md §43.11
 *
 * Part 4 of four, and the first ability in either roster that reads the past.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { historyWanted } from "../../module/rules/history.mjs";

const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("E2 - the gate, which is the whole performance story", () => {
  it("is OFF for a board with nobody who wants history", () => {
    // This assertion is worth more than any of the restore tests. If the
    // recorder is ever on by default, every match in the game pays for a
    // feature one Servant uses.
    const board = { units: [
      { id: "a", abilities: [{ id: "x", requiresHistory: false }] },
      { id: "b", abilities: [{ id: "y" }] },
    ] };
    expect(historyWanted(board)).toBe(false);
  });

  it("is ON as soon as one unit declares it", () => {
    const board = { units: [
      { id: "a", abilities: [{ id: "x" }] },
      { id: "n", abilities: [{ id: "glass", requiresHistory: true }] },
    ] };
    expect(historyWanted(board)).toBe(true);
  });

  it("is OFF again once that unit is gone", () => {
    // "switched on when a unit declaring requiresHistory enters play and off
    // when none remains."
    expect(historyWanted({ units: [{ id: "a", abilities: [{ id: "x" }] }] })).toBe(false);
  });

  it("stays ON for a DEFEATED declarer", () => {
    // Effect 2 fires on her defeat and rewinds 6 Rounds. A gate that switched
    // off the moment she died would throw away the buffer the clause needs,
    // one step before it is read.
    const board = { units: [{ id: "n", defeated: true, abilities: [{ id: "glass", requiresHistory: true }] }] };
    expect(historyWanted(board)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs`
Expected: FAIL — cannot resolve `module/rules/history.mjs`.

- [ ] **Step 3: Write the pure gate**

```js
/**
 * @file Whether this match records history at all.
 * @see docs/43-bounded-fields.md §43.11
 *
 * Layer 2 (rules). Pure.
 *
 * §43.11's load-bearing optimisation, in one function: *"`historyRecording` is
 * off by default and switched on only when an ability declaring
 * `requiresHistory: true` enters play. A match without Nursery Rhyme pays
 * nothing."*
 *
 * A DEFEATED declarer still counts. The Queen's Glass Game's second effect
 * fires on Nursery's defeat and rewinds six Rounds; a gate that closed the
 * moment she died would discard the buffer one step before the clause reads it.
 */

/**
 * @param {object} board
 * @returns {boolean}
 */
export function historyWanted(board) {
  return (board?.units ?? []).some((u) =>
    (u.abilities ?? []).some((a) => a?.requiresHistory === true));
}
```

- [ ] **Step 4: Declare the field, in all three places**

- `module/data/item/ability.mjs` — `requiresHistory: new fields.BooleanField({ initial: false })`.
- `tools/lib/content.mjs` — `itemSystem()`.
- `module/content/authored-fields.mjs` — `AUTHORED_ITEM_KEYS`.

Then run `npx vitest run test/unit/authored-fields.test.mjs`. **All three, in this commit.** A field on the schema and absent from the allowlists compiles to `false` silently, and the ability that declares it records nothing at all — which is exactly the shape of the six defects this project has already shipped, two of them caught only on a live board.

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/rules/history.mjs module/data/item/ability.mjs tools/lib/content.mjs module/content/authored-fields.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(rules): a match records history only when something asks it to

s43.11's load-bearing optimisation, and the constraint the whole of Part 4
rests on: "historyRecording is off by default and switched on only when an
ability declaring requiresHistory: true enters play. A match without Nursery
Rhyme pays nothing."

A defeated declarer still counts. The Queen's Glass Game's second effect fires
on her defeat and rewinds six Rounds, so a gate that closed the moment she died
would discard the buffer one step before the clause reads it.

requiresHistory goes onto the schema and into BOTH allowlists in this commit.
It is exactly the shape of field this project has silently dropped six times --
present on the schema, absent from itemSystem(), compiled to its default -- and
the last two of those were caught only on a live board.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 2: The snapshot shape (E1, R1 — clauses G4, G5)

**Files:**
- Modify: `module/rules/history.mjs`
- Test: `test/unit/nursery-glass-game.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `snapshotUnit(unit, globalTurn)` returning §43.11's `UnitStateSnapshot`, and `diffSnapshots(prev, next)` / `applyPatch(base, patch)` for the ring buffer's patch storage.

- [ ] **Step 1: Write the failing test**

```js
import { snapshotUnit, diffSnapshots, applyPatch } from "../../module/rules/history.mjs";

describe("E1 - the snapshot shape, from §43.11", () => {
  const unit = () => ({
    id: "foe", globalTurn: 9,
    panel: { i: 4, j: 7 }, facing: "north",
    health: { value: 600, max: 1000 }, agility: { value: 12, max: 14 }, luck: { value: 6, max: 8 },
    parameters: { str: "B", end: "C", agi: "B", mag: "E", luc: "C" },
    effects: [{ defId: "atkUp", magnitude: 30, expiry: 14, sourceId: "nursery" }],
    cooldowns: { someNp: { remaining: 4, max: 9 } },
    resources: { namelessForestTokens: { value: 2 } },
    modes: { madEnhancement: { active: true } },
    turnState: { movedPanels: 3, acted: true },
    contract: "free",
  });

  it("records the six things the sheet names", () => {
    const s = snapshotUnit(unit(), 9);
    expect(s.globalTurn).toBe(9);
    expect(s.stats.health).toEqual({ value: 600, max: 1000 });
    expect(s.parameters.mag).toBeTruthy();
    expect(s.effects).toHaveLength(1);
    expect(s.cooldowns.someNp).toEqual({ remaining: 4, max: 9 });
    expect(s.resources.namelessForestTokens).toEqual({ value: 2 });
    expect(s.modes.madEnhancement).toEqual({ active: true });
  });

  it("R1/Q45 - and records NEITHER position NOR facing", () => {
    // "The source lists 'Stats, Parameters, Buffs, Debuffs, Cooldowns, and
    // other existing effects' -- not location. Units are not teleported back."
    //
    // Excluded from the BUFFER rather than filtered by the applier, which is
    // what makes Q45 cheap to keep and expensive to reverse.
    const s = snapshotUnit(unit(), 9);
    expect(s.panel).toBeUndefined();
    expect(s.facing).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain("north");
  });

  it("R1 - nor turn budget, nor contract", () => {
    const s = snapshotUnit(unit(), 9);
    expect(s.turnState).toBeUndefined();
    expect(s.contract).toBeUndefined();
  });

  it("R8 - an effect snapshot records the id of its SOURCE", () => {
    // §43.11's own RISK: the applier drops instances whose source no longer
    // exists, and it can only do that if the snapshot recorded one.
    expect(snapshotUnit(unit(), 9).effects[0].sourceId).toBe("nursery");
  });

  it("stores FULL instances, not ids", () => {
    // "effects: EffectInstanceSnapshot[] // full instances, not ids". An id
    // alone cannot restore a magnitude or an expiry.
    const e = snapshotUnit(unit(), 9).effects[0];
    expect(e).toMatchObject({ defId: "atkUp", magnitude: 30, expiry: 14 });
  });

  it("round-trips through a patch", () => {
    const a = snapshotUnit(unit(), 9);
    const moved = unit(); moved.health.value = 250;
    const b = snapshotUnit(moved, 10);
    expect(applyPatch(a, diffSnapshots(a, b))).toEqual(b);
  });

  it("a patch between identical states is empty", () => {
    // The diffing is what keeps the buffer inside its budget. A patch that
    // always carries everything is a ring buffer of full snapshots wearing a
    // disguise.
    const a = snapshotUnit(unit(), 9);
    const b = snapshotUnit(unit(), 9);
    expect(Object.keys(diffSnapshots(a, b))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs -t "the snapshot shape"`
Expected: FAIL — `snapshotUnit is not a function`.

- [ ] **Step 3: Write it**

Implement the three functions against §43.11's `UnitStateSnapshot` interface, quoted in the file header so a reader can check the shape against the chapter without leaving the file. The exclusion list gets its own comment:

```js
  // WHAT IS NOT HERE, and why it is not here.
  //
  // Position, facing, turn budget and contract state. Q45 settled it: *"The
  // source lists 'Stats, Parameters, Buffs, Debuffs, Cooldowns, and other
  // existing effects' — not location. Units are not teleported back."*
  //
  // Excluded from the BUFFER rather than filtered by the applier. That is what
  // makes the ruling cheap to keep — nothing to filter, on every restore, for
  // ever — and expensive to reverse, which is the correct asymmetry for a
  // ruling this settled.
```

- [ ] **Step 4: Run and commit**

```bash
npm test && npm run lint
git add module/rules/history.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(rules): the per-unit state snapshot, and its patch

s43.11's UnitStateSnapshot, quoted in the file header so a reader can check the
shape against the chapter without leaving the file.

Position, facing, turn budget and contract are excluded from the BUFFER rather
than filtered by the applier. Q45 settled that units are not teleported back,
and excluding them at the write end makes the ruling cheap to keep -- nothing
to filter on every restore, for ever -- and expensive to reverse, which is the
right asymmetry for a ruling this settled.

Effects are stored as full instances rather than ids, because an id alone
cannot restore a magnitude or an expiry, and each records the id of its source
so the applier can drop orphans.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 3: The ring buffer (E1 — clause G4)

**Files:**
- Create: `module/engine/state-history.mjs`
- Modify: `module/data/misc.mjs` (the `Combat` model gains the buffer)
- Modify: `module/engine/scheduler.mjs` (record at the end-of-turn boundary)
- Test: `test/unit/nursery-glass-game.test.mjs`

**Interfaces:**
- Consumes: `historyWanted` (Task 1), `snapshotUnit`/`diffSnapshots`/`applyPatch` (Task 2).
- Produces: `recordTurn(board, globalTurn)`, and `stateAt(history, unitId, globalTurn)` returning a reconstructed snapshot or `null`.

- [ ] **Step 1: Write the failing test**

```js
import { recordTurn, stateAt, RETENTION_TURNS } from "../../module/engine/state-history.mjs";

describe("E1 - the ring buffer", () => {
  it("retains max(6 Rounds) + 2 turns and no more", () => {
    // §43.11's figure. Effect 2 reaches back six Rounds, so anything shorter
    // makes the once-per-game rewind reach past the end of the buffer.
    expect(RETENTION_TURNS(3)).toBe(6 * 3 + 2);
  });

  it("reconstructs a state ten turns old from its patches", () => {
    const h = tenTurnsOfHistory();
    expect(stateAt(h, "foe", 4).stats.health.value).toBe(800);
    expect(stateAt(h, "foe", 9).stats.health.value).toBe(250);
  });

  it("returns null for a turn that has fallen off the end", () => {
    // Not a throw, and not the oldest entry it still holds. A rewind that
    // silently restored the wrong turn would be worse than one that did
    // nothing, because it would look like it worked.
    const h = tenTurnsOfHistory();
    expect(stateAt(h, "foe", -5)).toBeNull();
  });

  it("returns null for a unit it has never seen", () => {
    expect(stateAt(tenTurnsOfHistory(), "stranger", 4)).toBeNull();
  });

  it("writes NOTHING when the gate is closed", () => {
    // The assertion that matters most in this file.
    const board = { units: [{ id: "a", abilities: [{ id: "x" }] }] };
    expect(recordTurn(board, 1)).toEqual([]);
  });

  it("stays inside its storage budget at the stated worst case", () => {
    // §43.11 claims ~280 KB at 28 units x 50 turns. Within an order, because
    // a buffer that quietly grows unbounded on a long match is the failure
    // mode the diffing exists to prevent -- and a test asserting an exact
    // figure would break on any harmless field addition.
    const bytes = JSON.stringify(worstCaseHistory(28, 50)).length;
    expect(bytes).toBeLessThan(2_800_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs -t "the ring buffer"`
Expected: FAIL — cannot resolve `module/engine/state-history.mjs`.

- [ ] **Step 3: Build it**

A per-unit ring on the `Combat` document: the oldest retained entry is a **full** snapshot and every later one a patch against its predecessor, so `stateAt` replays forward from the base. Retention is `6 × turnsPerRound + 2`, and the `+ 2` is §43.11's — keep its reasoning in the comment rather than the bare number.

`recordTurn` returns an empty array when `historyWanted` is false, and the scheduler calls it at the end-of-turn boundary.

- [ ] **Step 4: Run and commit**

```bash
npm test && npm run lint
git add module/engine/state-history.mjs module/data/misc.mjs module/engine/scheduler.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(engine): a per-unit ring buffer of past states

s43.11's design, implemented as written: one entry per unit per turn, the
oldest a full snapshot and every later one a patch against its predecessor,
retained for 6 Rounds plus two turns because the once-per-game rewind reaches
back six.

stateAt returns null for a turn that has fallen off the end, rather than the
oldest entry it still holds. A rewind that silently restored the wrong turn
would be worse than one that did nothing, because it would look like it worked.

The budget is a test. s43.11 claims ~280 KB at 28 units by 50 turns, and a
buffer that quietly grows unbounded on a long match is the failure mode the
diffing exists to prevent.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 4: The restore (E3, R2, R6, R8 — clauses G4, G6, G9)

**Files:**
- Modify: `module/engine/state-history.mjs` (`rewindIntents`)
- Modify: `module/engine/applier.mjs` (the `rewind` intent)
- Test: `test/unit/nursery-glass-game.test.mjs`

**Interfaces:**
- Consumes: `stateAt` (Task 3).
- Produces: `rewindIntents(board, unitIds, toTurn, {exclude})` returning one `rewind` intent per unit plus a `log` per dropped orphan.

- [ ] **Step 1: Write the failing test**

```js
import { rewindIntents, REWIND_EXCLUDED_RESOURCES } from "../../module/engine/state-history.mjs";

describe("E3 - the restore", () => {
  it("emits one rewind per named unit and none for anybody else", () => {
    const out = rewindIntents(boardWithHistory(), ["foe", "ally"], 4);
    expect(out.filter((i) => i.kind === "rewind").map((i) => i.unitId)).toEqual(["foe", "ally"]);
  });

  it("restores stats, cooldowns, effects, resources and modes", () => {
    const i = rewindIntents(boardWithHistory(), ["foe"], 4)[0];
    expect(i.state.stats.health.value).toBe(800);
    expect(i.state.cooldowns.someNp.remaining).toBe(9);
    expect(i.state.effects).toHaveLength(1);
    expect(i.state.modes.madEnhancement).toEqual({ active: true });
  });

  it("R2 - and does NOT restore Nameless Forest Tokens", () => {
    // Stated twice on the sheet, once per effect. Tokens live in `resources`
    // and the buffer stores `resources`, so this is a NAMED CARVE-OUT rather
    // than an emergent property -- without it the rewind silently undoes
    // Part 3.
    expect(REWIND_EXCLUDED_RESOURCES).toContain("namelessForestTokens");
    const i = rewindIntents(boardWithHistory(), ["foe"], 4)[0];
    expect(i.state.resources.namelessForestTokens).toBeUndefined();
  });

  it("R2 - but DOES restore every other pool", () => {
    // The carve-out is one named pool, not "resources are excluded".
    const i = rewindIntents(boardWithHistory(), ["foe"], 4)[0];
    expect(i.state.resources.fragarachTokens).toEqual({ value: 2 });
  });

  it("R8 - drops an effect whose source is gone, and logs each drop", () => {
    // §43.11's own RISK, verbatim: "What must not happen is the rewind
    // restoring an effect whose source has since been removed, producing an
    // orphaned instance."
    const board = boardWithHistory();
    board.units = board.units.filter((u) => u.id !== "nursery");
    const out = rewindIntents(board, ["foe"], 4);
    expect(out.find((i) => i.kind === "rewind").state.effects).toHaveLength(0);
    expect(out.some((i) => i.kind === "log" && i.event === "rewindDroppedOrphan")).toBe(true);
  });

  it("R1 - and writes no position", () => {
    const i = rewindIntents(boardWithHistory(), ["foe"], 4)[0];
    expect(i.state.panel).toBeUndefined();
  });

  it("emits nothing for a unit with no history that far back", () => {
    expect(rewindIntents(boardWithHistory(), ["foe"], -99)).toEqual([]);
  });

  it("R6 - restoring a defeated Nursery does not undo her defeat", () => {
    // "a rewind that restores health undoes a kill (though not a defeat)".
    // Her Stats come back and she stays defeated: the rewind is a parting
    // shot, not a resurrection.
    const i = rewindIntents(boardWithHistory(), ["nursery"], 4)[0];
    expect(i.state.stats.health.value).toBeGreaterThan(0);
    expect(i.clearsDefeat).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs -t "the restore"`
Expected: FAIL — `rewindIntents is not a function`.

- [ ] **Step 3: Build it**

The carve-out and the orphan drop each get the comment that says why:

```js
/**
 * Pools a rewind must leave alone.
 *
 * > *"Does not affect Nameless Forest Tokens."* — stated twice on her sheet,
 * > once per effect.
 *
 * A NAMED carve-out rather than an emergent property. The tokens live in
 * `resources` and the buffer stores `resources`, so nothing about the shape of
 * the data keeps them out: without this list the rewind silently undoes
 * Part 3, restoring an enemy's tokens along with its Health.
 *
 * One named pool, not "resources are excluded" — every other pool comes back.
 */
export const REWIND_EXCLUDED_RESOURCES = Object.freeze(["namelessForestTokens"]);
```

- [ ] **Step 4: The applier**

A `rewind` intent applies as **one** `actor.update` per unit, so a failure cannot leave a Unit half in the past. It never touches `defeated` (R6).

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint
git add module/engine/state-history.mjs module/engine/applier.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(engine): restoring a unit to a state it held

One intent per unit, applied as a single update, so a failure cannot leave a
Unit half in the past.

Nameless Forest Tokens are a NAMED carve-out, not an emergent property. They
live in `resources` and the buffer stores `resources`, so nothing about the
shape of the data keeps them out -- without the list the rewind silently undoes
Part 3, handing an enemy back the tokens that were killing it. One named pool:
every other pool comes back.

An effect whose source has since been removed is dropped and logged, which is
s43.11's own stated risk. And a restored Nursery stays defeated: the rewind is
a parting shot, not a resurrection.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

# Phase 2 — the escape hatch

---

### Task 5: A `Script` registry, which the element has always promised (E4)

**Files:**
- Create: `module/engine/scripts.mjs`
- Modify: `module/engine/scheduler.mjs` (dispatch a handler carrying a `script`)
- Test: `test/unit/nursery-glass-game.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `SCRIPTS`, a frozen name-keyed registry; `runScript(name, ctx)` returning intents or `[]` for an unknown name.

**The fourth Collected thing this Servant has found.** `rules/elements.mjs:1834` collects a `Script` into `eventHandlers` as `{event, script, source}`, and **nothing reads `handler.script`.** The element's own comment promises *"named entries in a closed registry, never `eval`"* — there is no registry. That is consistent rather than surprising: the corpus has zero Scripts (Ch. 34 and Ch. 36 both close their tallies with *"Script elements: zero"*), so the hatch has never been opened.

**The registry is the half that has to be right**, because every future Script inherits it. Closed and name-keyed is the security property, not a style choice: compendia are shared, and content must never be able to execute.

- [ ] **Step 1: Write the failing test**

```js
import { SCRIPTS, runScript } from "../../module/engine/scripts.mjs";

describe("E4 - the Script registry", () => {
  it("is CLOSED - an unknown name runs nothing and does not throw", () => {
    // Compendia are shared. A name that is not in the registry is content
    // trying to execute, and the answer is silence plus a log line -- not a
    // throw that takes the turn down, and certainly not an eval.
    expect(runScript("whateverTheyTyped", {})).toEqual([]);
  });

  it("is frozen, so nothing can add an entry at runtime", () => {
    expect(Object.isFrozen(SCRIPTS)).toBe(true);
  });

  it("holds exactly the entries the corpus actually has", () => {
    // Ch. 44 §44.6 budgets four across ~130 abilities and the tally has stood
    // at zero. This is the first. If this list grows past what Ch. 44 budgets,
    // that is a design conversation and not a merge.
    expect(Object.keys(SCRIPTS)).toEqual(["nurseryRhyme.rewind"]);
  });

  it("dispatches a collected Script handler by name", () => {
    const handler = { event: "turnEnd", script: "nurseryRhyme.rewind", source: "The Queen's Glass Game" };
    expect(() => dispatchHandler(handler, {})).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs -t "the Script registry"`
Expected: FAIL — cannot resolve `module/engine/scripts.mjs`.

- [ ] **Step 3: Build the registry**

```js
/**
 * @file The escape hatch — a closed registry of named scripts.
 * @see docs/24-rules-engine.md, docs/44-case-expanded-roster.md §44.6
 *
 * `rules/elements.mjs`'s `Script` element has promised this since it was
 * written — *"named entries in a closed registry, never `eval`. Compendia are
 * shared, so content must not be able to execute."* — and there has been
 * nothing to promise. The corpus has zero Scripts, so the hatch had never been
 * opened; Ch. 34 and Ch. 36 both close their tallies with *"Script elements:
 * zero."*
 *
 * CLOSED is the security property, not a style choice. A compendium is data
 * other people wrote; a `script:` naming something outside this object runs
 * nothing and says so in the log.
 *
 * Ch. 24's position holds: *"Scripts are the escape hatch, not the norm."* Ch.
 * 44 §44.6 budgets four across ~130 abilities. Adding a fifth entry here is a
 * design conversation, not a merge.
 */
export const SCRIPTS = Object.freeze({
  /** @see module/engine/glass-game.mjs — Task 6. */
  "nurseryRhyme.rewind": rewindScript,
});
```

- [ ] **Step 4: Run and commit**

```bash
npm test && npm run lint
git add module/engine/scripts.mjs module/engine/scheduler.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(engine): the Script registry the element has always promised

rules/elements.mjs's Script element collects {event, script, source} into
eventHandlers and nothing has ever read handler.script. Its own comment
promises "named entries in a closed registry, never eval. Compendia are shared,
so content must not be able to execute" -- and there was no registry.

Consistent rather than surprising: the corpus has zero Scripts, so the hatch
had never been opened. Ch. 34 and Ch. 36 both close their tallies with "Script
elements: zero."

Closed is the security property. A compendium is data other people wrote, and a
script: naming something outside the registry runs nothing and says so in the
log -- it does not throw, and it certainly does not eval.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 6: `nurseryRhyme.rewind` (E4, R3, R4, R5, R6, R7 — clauses G2, G7, G8, G9, G10)

**Files:**
- Create: `module/engine/glass-game.mjs`
- Modify: `module/engine/scheduler.mjs#resolveDefeat` (effect 2's rung)
- Modify: `module/data/actor/servant.mjs` (the spent flag, and the clock)
- Test: `test/unit/nursery-glass-game.test.mjs`

**Interfaces:**
- Consumes: `rewindIntents` (Task 4), `SCRIPTS` (Task 5).
- Produces: the `nurseryRhyme.rewind` script; `glassGameClock(unit, board)` pure; `glassGameSpent` on the Servant schema.

**Effect 2 does not hang on `unitDefeated`.** `engine/scheduler.mjs#resolveDefeat` fires that event **first**, before the revival query — its own comment says so: *"Handlers first: `unitDefeated` is where content that is not a revival hangs."* A handler there fires on a Nursery whom Guts is about to save. The right seam is the **tail of `resolveDefeat`**, beside `linkedDeathIntents`, whose docstring states the distinction for the Dioscuri: *"This is the tail of `resolveDefeat`, reached only once the revival chain has resolved TO a defeat."*

- [ ] **Step 1: Write the failing test**

```js
import { glassGameClock } from "../../module/engine/glass-game.mjs";

describe("R3 - effect 1's clock", () => {
  it("advances at a Turn end with an enemy inside her 3-panel ring", () => {
    expect(glassGameClock({ ticks: 0 }, ringWith("enemy"))).toMatchObject({ ticks: 1 });
  });

  it("fires at 3 Rounds, and not before", () => {
    expect(glassGameClock({ ticks: 8 }, ringWith("enemy")).fires).toBe(false);
    expect(glassGameClock({ ticks: 8 }, ringWith("enemy"), { turnsPerRound: 3 }).ticks).toBe(9);
    expect(glassGameClock({ ticks: 9 }, ringWith("enemy"), { turnsPerRound: 3 }).fires).toBe(true);
  });

  it("G3 - does not fire if the ring is empty at that Turn's end", () => {
    // "if there are STILL enemy Units within a 3 panel area at the end of that
    // Turn". The clock reaching three is necessary and not sufficient.
    expect(glassGameClock({ ticks: 9 }, ringWith(), { turnsPerRound: 3 }).fires).toBe(false);
  });

  it("R4 - an empty ring at ROUND end resets the clock to zero", () => {
    expect(glassGameClock({ ticks: 8 }, ringWith(), { roundEnd: true }).ticks).toBe(0);
  });

  it("R4 - ...and does NOT touch the buffer", () => {
    // "the effect of / duration of time passed for this NP is reset" -- the
    // clock. The recorded history must survive, because effect 2 still needs
    // six Rounds of it.
    const out = glassGameClock({ ticks: 8 }, ringWith(), { roundEnd: true });
    expect(out.clearsHistory ?? false).toBe(false);
  });
});

describe("R5/R7 - effect 2", () => {
  it("fires from the tail of resolveDefeat, not from unitDefeated", () => {
    // unitDefeated fires BEFORE the revival query -- "Handlers first:
    // unitDefeated is where content that is not a revival hangs." A handler
    // there fires on a Nursery whom Guts is about to save, and spends her
    // once-per-game rewind on a death that did not happen.
    const intents = resolveDefeat(nurseryWithGuts(), ctx());
    expect(intents.some((i) => i.kind === "rewind")).toBe(false);
  });

  it("fires once the chain has resolved TO a defeat", () => {
    const intents = resolveDefeat(nurseryWithNothing(), ctx());
    expect(intents.some((i) => i.kind === "rewind")).toBe(true);
  });

  it("R7 - and never twice, across a revival and a second death", () => {
    // "Can only be used once during the entire game." The flag lives on the
    // ACTOR, not on the effect instance, so a Nursery revived by a Command
    // Spell and defeated again gets nothing.
    const nursery = nurseryWithNothing();
    resolveDefeat(nursery, ctx());
    nursery.glassGameSpent = true;
    expect(resolveDefeat(nursery, ctx()).some((i) => i.kind === "rewind")).toBe(false);
  });

  it("R6 - rewinds her too, and leaves her defeated", () => {
    const intents = resolveDefeat(nurseryWithNothing(), ctx());
    const mine = intents.find((i) => i.kind === "rewind" && i.unitId === "nursery");
    expect(mine).toBeTruthy();
    expect(mine.clearsDefeat).toBe(false);
  });

  it("reaches back SIX Rounds, where effect 1 reaches three", () => {
    const intents = resolveDefeat(nurseryWithNothing(), ctx({ tick: 30, turnsPerRound: 3 }));
    expect(intents.find((i) => i.kind === "rewind").toTurn).toBe(30 - 18);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs -t "effect 1's clock"`
Expected: FAIL — cannot resolve `module/engine/glass-game.mjs`.

- [ ] **Step 3: Write the clock**

*"Enters Combat"* is **the first Turn end at which an enemy stands within her 3-panel ring**, and the clock runs from there. The derivation goes in the file, because the engine has no such moment and a reader is entitled to know where the definition came from:

```js
/**
 * How far along effect 1's countdown this Unit is.
 *
 * > *"Activates at the end of the Turn, 3◈ Turns after Nursery enters Combat,
 * > if there are still enemy Units within a 3 panel area of Nursery at the end
 * > of that Turn."*
 *
 * **"Enters Combat" is a moment this engine does not have.** There is no
 * `enterCombat` event, no combat-lock flag and no `inCombat` state anywhere in
 * `module/`; the phrase occurs once in the whole repository, in Ch. 43 §43.11's
 * quotation of this same sheet.
 *
 * So it is DEFINED here as *the first Turn end at which an enemy Unit stands
 * within her 3-panel ring*, and the derivation is the clause's own next
 * sentence: *"At the end of every Round, if there are **no enemy Units within a
 * 3 panel area** of Nursery, the duration of time passed for this NP is
 * reset."* The reset is keyed on that predicate, so the start must be too — a
 * clock that begins on one condition and resets on another cannot be reasoned
 * about. Reading it as "when the match starts" would also leave the reset
 * clause meaningless for the first three Rounds of every game.
 *
 * One predicate, read at one boundary, doing both jobs.
 */
```

- [ ] **Step 4: Write the script and its rung**

`rewindScript` reads the clock, resolves the ring, and calls `rewindIntents(board, ids, tick - 3◈)`. Effect 2 goes in the **tail of `resolveDefeat`**, beside `linkedDeathIntents`, gated on `glassGameSpent`, reaching back `6◈`, including her, and never clearing her defeat.

`glassGameSpent` is a `BooleanField` on the Servant schema. **It is a world field, not an authored one** — do not add it to the allowlists, and do check `test/unit/actor-fields.test.mjs` passes: a `StringField` with `choices` and a blank initial is what broke every actor in the world once already.

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint
git add module/engine/glass-game.mjs module/engine/scripts.mjs module/engine/scheduler.mjs module/data/actor/servant.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(engine): nurseryRhyme.rewind, the corpus's first Script

"Enters Combat" is a moment this engine does not have -- no event, no flag, no
state, and the phrase occurs once in the whole repository, in ch. 43's
quotation of this same sheet. It is defined here as the first Turn end at which
an enemy stands within her 3-panel ring, derived from the clause's own reset
sentence: the reset is keyed on that predicate, so the start must be too. A
clock that begins on one condition and resets on another cannot be reasoned
about.

Effect 2 hangs in the TAIL of resolveDefeat, not on unitDefeated. That event
fires before the revival query -- "Handlers first: unitDefeated is where content
that is not a revival hangs" -- so a handler there would spend her once-per-game
rewind on a death that Guts was about to undo. The Dioscuri's linked death sits
in the same tail for the same reason.

She is rewound and stays defeated. The rewind is a parting shot, not a
resurrection.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

# Phase 3 — her content

---

### Task 7: The ability, and her last ability ref (G1, G3, G7, G10)

**Files:**
- Create: `packs/_source/abilities/nursery-queens-glass-game.yml`
- Modify: `packs/_source/servants/nursery-rhyme.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("The Queen's Glass Game (G1-G10)", () => {
  const a = () => ability("nursery-queens-glass-game");

  it("G1 - Rank C, NP, Anti-Self/Anti-World, PASSIVE", () => {
    expect(a()).toMatchObject({ rank: "C", isNP: true, passive: true });
    expect(a().npTags.sort()).toEqual(["antiSelf", "antiWorld"]);
  });

  it("E2 - declares that it needs history", () => {
    // The one field the whole subsystem is gated on, and exactly the shape
    // this project has silently dropped six times.
    expect(a().requiresHistory).toBe(true);
  });

  it("G2 - effect 1 is a Script on turnEnd", () => {
    const one = a().passiveRules.find((r) => r.script === "nurseryRhyme.rewind" && r.event === "turnEnd");
    expect(one).toBeTruthy();
  });

  it("G3 - gated on an enemy inside a 3-panel ring", () => {
    const one = a().passiveRules.find((r) => r.event === "turnEnd");
    expect(one.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 3 });
  });

  it("G8 - effect 2 is the same Script on a defeat rung", () => {
    const two = a().passiveRules.find((r) => r.script === "nurseryRhyme.rewind" && r.event !== "turnEnd");
    expect(two.event).toBe("finalDefeat");
  });

  it("G10 - and is once per game", () => {
    const two = a().passiveRules.find((r) => r.event === "finalDefeat");
    expect(two.oncePerGame).toBe(true);
  });

  it("her ability list is now complete", () => {
    expect(servant("nursery-rhyme").abilities).toContainEqual({ ref: "nursery-queens-glass-game" });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-glass-game.test.mjs -t "The Queen's Glass Game"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# THE FIRST `Script` IN THE CORPUS. Ch. 34 and Ch. 36 both close their tallies
# with "Script elements: zero", and Ch. 44 §44.6 budgets four across ~130
# abilities; this is one of them, and the only one built.
#
# Why this one is not data: every other ability in the corpus is a COMPOSITION
# of named mechanisms. This one walks a unit set, resolves a historical index,
# diffs two states and emits a heterogeneous batch -- and it has exactly one
# customer. A rule element generalising "rewind" from a single example would be
# inventing a vocabulary for a shape nothing else has. Ch. 24: "Scripts are the
# escape hatch, not the norm."
#
# If a second rewind ever appears, generalise then -- the rule Ch. 44 already
# applies to `innocentWorld` and `heel`.
schema: 1
id: nursery-queens-glass-game
name: "The Queen's Glass Game: Perpetual Engine - Maiden Empire"
rank: C
isNP: true
categorizedAsNP: true
npTags: [antiSelf, antiWorld]
kind: noblePhantasm
passive: true
# THE GATE. Without this the recorder never switches on, this Noble Phantasm
# has no past to read, and both effects do nothing at all -- silently.
requiresHistory: true
description: |
  (Passive) 1. Activates at the end of the Turn, 3◈ Turns after Nursery enters Combat, if there are
  still enemy Units within a 3 panel area of Nursery at the end of that Turn; the Stats, Parameters,
  Buffs, Debuffs, Cooldowns and other existing effects of all Units within a 3 panel area of Nursery
  are returned to what they were 3◈ Turns ago. Does not affect Nameless Forest Tokens. At the end of
  every Round, if there are no enemy Units within a 3 panel area of Nursery, the duration of time
  passed for this NP is reset.
  2. Activates when Nursery is defeated. The same are returned to what they were 6◈ Turns before
  Nursery was defeated (includes herself). Does not affect Nameless Forest Tokens. Can only be used
  once during the entire game.
passiveRules:
  # EFFECT 1. Fires at the end of the Turn, after all other end-of-turn
  # processing (Ch. 07 §7.7), so it undoes that Turn's events too.
  - key: Script
    script: nurseryRhyme.rewind
    event: turnEnd
    rewind: "3◈"
    includesSelf: false
    targeting:
      anchor: { kind: self }
      shape: { kind: chebyshevRadius, r: 3 }
      selection: { relations: [enemy, ally, self], chooser: all }

  # EFFECT 2. `finalDefeat`, NOT `unitDefeated` -- that event fires BEFORE the
  # revival query ("Handlers first: unitDefeated is where content that is not a
  # revival hangs"), so a handler there would spend her once-per-game rewind on
  # a death that Guts was about to undo.
  #
  # "(includes herself)" -- and she stays defeated. The rewind is a parting
  # shot, not a resurrection.
  - key: Script
    script: nurseryRhyme.rewind
    event: finalDefeat
    rewind: "6◈"
    includesSelf: true
    oncePerGame: true
    targeting:
      anchor: { kind: self }
      shape: { kind: chebyshevRadius, r: 3 }
      selection: { relations: [enemy, ally, self], chooser: all }
```

- [ ] **Step 4: Her last ref**

```yaml
  # Part 4, and the last.
  - { ref: nursery-queens-glass-game }
```

Update the ability-count assertion in `test/unit/nursery.test.mjs`. **Read the file** — which parts have landed decides the number, and Parts 2 and 3 are independent of each other.

- [ ] **Step 5: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/nursery-queens-glass-game.yml packs/_source/servants/nursery-rhyme.yml test/unit/nursery.test.mjs test/unit/nursery-glass-game.test.mjs
git commit -F - <<'MSG'
feat(content): The Queen's Glass Game, and the corpus's first Script

Every other ability in this corpus is a composition of named mechanisms. This
one walks a unit set, resolves a historical index, diffs two states and emits a
heterogeneous batch -- and it has exactly one customer. A rule element
generalising "rewind" from a single example would be inventing a vocabulary for
a shape nothing else has.

Ch. 24: "Scripts are the escape hatch, not the norm." Ch. 44 budgets four
across ~130 abilities; this is the only one built. If a second rewind ever
appears, generalise then.

requiresHistory is the field the whole subsystem is gated on. Without it the
recorder never switches on, this Noble Phantasm has no past to read, and both
of its effects do nothing at all -- silently, which is why it is in both
allowlists from the start.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 8: Documentation and the live board

**Files:**
- Modify: `docs/07-time-model.md`, `docs/11-effect-engine.md`, `docs/24-rules-engine.md`, `docs/30-chat-and-audit.md`, `docs/43-bounded-fields.md`, `docs/44-case-expanded-roster.md`, `docs/45-implementation-status.md`, `docs/41-open-questions.md`, `docs/E-event-reference.md`, `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Document**

- **Ch. 43 §43.11** — mark the design **built**, and record where the implementation departed from it, if anywhere.
- **Ch. 24** — the `Script` registry exists; the tally moves from zero to **one**, and Ch. 34's and Ch. 36's *"Script elements: zero"* lines get a forward pointer rather than a rewrite — they were true when written and the sentence they support is still true.
- **Ch. 44 §44.6** — `nurseryRhyme.rewind` built; three of four budgeted Scripts still unbuilt.
- **Ch. 07 §7.7** — the rewind's place in the end-of-turn order.
- **Ch. 41 Q45** — marked **settled in code**, naming the test that holds it.
- **Appendix E** — `finalDefeat`, and how it differs from `unitDefeated`.
- **Ch. 45** — **all four parts built**; Servant count and the Nursery Rhyme entry completed.
- **`CHANGELOG.md`** and **`README.md`**.

- [ ] **Step 2: Bring the world up**

```bash
node tools/fgt-world.mjs shutdown
npm run build:packs
node tools/fgt-world.mjs launch
```

Then join as Gamemaster over CDP. Launch fails with no Foundry tab open — open one first.

- [ ] **Step 3: Confirm the gate compiled**

Read the ability out of the compendium and check **`requiresHistory` is `true`**. If it compiled to `false`, the allowlists are wrong and everything below will appear to work while recording nothing. **This is the single most likely failure in Part 4, and it is silent.**

- [ ] **Step 4: Walk the inventory**

- [ ] **E2, the gate, negatively** — a board with **no** Nursery: play three Rounds and confirm the Combat document's history buffer is **empty**. This is the observation the whole design is for.
- [ ] **E2, positively** — the same board with her on it, and the buffer filling one entry per unit per turn.
- [ ] **G2/R3** — the clock starting at the first Turn end with an enemy in her ring, and effect 1 firing at the end of the **third** Round after that.
- [ ] **G3** — the enemies leaving the ring before that Turn's end, and the rewind **not** firing.
- [ ] **G7/R4** — a Round ending with the ring empty, the clock back to zero, and — critically — **effect 2 still able to reach six Rounds back afterwards**. The buffer must have survived.
- [ ] **G4** — three Rounds of ordinary play (damage, a buff applied, a cooldown spent), then the rewind, then the enemies' sheets: the **Health**, the **effect** and the **cooldown** they held three Rounds ago.
- [ ] **G5/R1** — and those enemies **standing exactly where they are now**. Not teleported.
- [ ] **G6/R2** — a Nameless Forest token still on them afterwards. (If Part 3 is not built, record that this is inert and why.)
- [ ] **R8** — an effect whose source has since left the board **dropped**, with the log line naming it.
- [ ] **G8/R5** — Nursery defeated **with** a revival available: she is revived, and **no rewind happens**.
- [ ] **G8/R5** — Nursery defeated with nothing left: the 6◈ rewind fires.
- [ ] **G9/R6** — her own sheet restored, and **still defeated**.
- [ ] **G10/R7** — revived by a Command Spell, defeated a second time, and **no second rewind**.

- [ ] **Step 5: Fix what the board disagrees with**

Any clause that misbehaves is a bug in this implementation, not in the sheet. Fix it, add the unit test that would have caught it, re-verify.

- [ ] **Step 6: Final commit**

```bash
npm test && npm run lint && npm run validate:content
git add -A
git commit -F - <<'MSG'
test(content): The Queen's Glass Game, verified on a live board

Every clause observed rather than inferred, and the first observation is a
NEGATIVE one: a board without her records nothing at all. That is what the
whole design is for, and it is the only way to see it.

The two that a passing suite cannot give: a Nursery who is revived and does NOT
spend her once-per-game rewind, and enemies restored to three Rounds ago while
standing exactly where they are now.

[Record here what the board disagreed with, and what was fixed.]

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

## Self-review notes

**Spec coverage.** R1 Tasks 2, 4 and 8; R2 Tasks 4 and 8; R3 Tasks 6 and 8; R4 Tasks 6 and 8; R5 Tasks 6 and 8; R6 Tasks 4, 6 and 8; R7 Tasks 6 and 8; R8 Tasks 2, 4 and 8. E1 Tasks 2 and 3; E2 Task 1; E3 Task 4; E4 Tasks 5 and 6. Every one of §5's ten clauses has a task: G1/G3/G7/G10 Task 7; G2 Tasks 3 and 6; G4 Tasks 2–4; G5 Task 2; G6 Task 4; G8/G9 Task 6.

**Task order is strictly bottom-up, and deliberately so.** The gate (1) before the shape (2) before the buffer (3) before the restore (4) before the registry (5) before the script (6) before the content (7). Nothing earlier depends on anything later, and the gate is first because a recorder written before its gate is one that runs in every match in the game.

**Type consistency.** `historyWanted(board)` is Task 1's and is called only by Task 3. `snapshotUnit`/`diffSnapshots`/`applyPatch` are Task 2's and are called only by Task 3. `stateAt(history, unitId, globalTurn)` is Task 3's and is called only by Task 4. `rewindIntents(board, unitIds, toTurn, {exclude})` is Task 4's and is called only by Task 6's script. `SCRIPTS`/`runScript` are Task 5's. `"nurseryRhyme.rewind"` is spelled identically in Tasks 5, 6 and 7. `REWIND_EXCLUDED_RESOURCES` is Task 4's and named in Task 4's tests alone. `requiresHistory` is spelled identically in Tasks 1 and 7.

**One new event name, and it is deliberate.** `finalDefeat` (Tasks 6 and 7) is not a rename of `unitDefeated` and does not replace it. The two are different moments — one before the revival query and one after it — and Appendix E gains a row saying so in Task 8. The Dioscuri's linked death already lives at the second moment without a name; this gives it one.

**The three checks a green suite cannot give**, all in Task 8: the **negative** gate observation (a board without her writing nothing), a **revived** Nursery not spending her rewind, and enemies restored in time while unmoved in space. Each has a failure mode that looks exactly like success from inside the test suite — `requiresHistory` compiled to `false` most of all, which would let every other observation here pass while the buffer stayed empty.
