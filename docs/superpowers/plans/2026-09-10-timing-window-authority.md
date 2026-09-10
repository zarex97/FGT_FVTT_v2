# Timing Window Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `timing.window` a single enumerated authority, so the field 117 of 195 authored abilities use stops being a free string that nothing checks.

**Architecture:** One new pure Layer-2 module, `module/rules/windows.mjs`, enumerating the ability timing windows and naming which dispatcher offers each. The four existing partial lists — two module-local constants in `reactions.mjs`, `ATTACKER_WINDOWS`, and a hardcoded string literal in `attack.mjs` — are re-derived from it. `tools/lib/content.mjs` then validates every authored `timing.window` against it, the way it already validates requirement kinds.

**Tech Stack:** Plain ESM, Vitest, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-ability-editor-design.md` §3.4 and §11.1

## Global Constraints

- **Layer rule:** `module/rules/` is Layer 2 — pure, no `game`/`canvas`/`ui` globals, no imports from `module/engine/` or `module/apps/`. `npm run lint` runs `tools/check-layers.mjs` and fails on a violation.
- **No behaviour change in Tasks 1–2.** These tasks re-point existing constants at a shared table. Every window string must remain byte-identical; any change to which abilities are offered at which window is a bug in this plan, not an improvement.
- **Docs travel with the commit.** Chapter 45 alone is never enough — the affected 00–44 chapter must change in the same commit.
- **Commit message trailers** (every commit in this plan):
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
  ```
- **Full verification before any completion claim:** `npm test && npm run lint && npm run validate:content`.

---

## Background: the three disagreeing lists

An executor needs to know this or Task 3 will look like it is breaking working content.

**What the engine dispatches** (five windows, all reachable, spread across three files):

| Window | Dispatched by | Constant today |
|---|---|---|
| `whenAttacked` | `rules/reactions.mjs:80` | `REACTION_WINDOW`, module-local |
| `whenAllyAttacked` | `rules/reactions.mjs:208` | `ALLY_WINDOW`, module-local |
| `damageStep` | `engine/attack.mjs:4288` | `ATTACKER_WINDOWS`, exported |
| `combatPhaseStart` | `engine/attack.mjs:4288` | `ATTACKER_WINDOWS`, exported |
| `whenTargetedByNP` | `engine/attack.mjs:4763` | **a bare string literal** |

Plus `ownTurn`, which **no dispatcher matches**. It is documentary: "usable during your Turn", i.e. the sheet button. `rules/ability-use.mjs:115` reads `timing.window` only to classify an ability as `windowed`. 89 of the 117 uses are `ownTurn`.

**What the content actually authors** (flattened across arrays, `packs/_source/abilities` + `class-skills`):

```
ownTurn           89
whenAttacked       5
whenAllyAttacked   3
combatPhaseStart   3
damageStep         3
whenTargetedByNP   1
```

Exactly the six above. The corpus is currently clean — this plan is a guard against future drift, not a repair of existing content.

**What the documentation claims** — `docs/15-abilities.md` §15.3 declares an eleven-value `TimingWindow` union:

```ts
"ownTurn" | "anyTime" | "combatPhaseStart" | "combatProcessStart" | "damageStepStart"
| "whenAttacking" | "whenAttacked" | "whenTargetedByNP" | "whenAllyAttacked"
| "onDefeat" | "reaction"
```

**This list is wrong in two ways.** It says `damageStepStart`; the engine and every authored ability say `damageStep` — a GM authoring from the chapter writes a window that never fires. And five of its entries (`anyTime`, `combatProcessStart`, `whenAttacking`, `onDefeat`, `reaction`) are dispatched for abilities by nothing; `anyTime`, `onDefeat` and `react` belong to the **command spell** vocabulary (`rules/command-spells.mjs:33`), which is a separate list and must stay separate.

Task 4 fixes the chapter.

**A window may be a string or an array.** Karna's *Uncrowned Arms Mastership* carries two, and `reactions.mjs:113` flattens with `[sys.timing?.window ?? []].flat()` for exactly that reason. Every consumer must go through the shared helper.

---

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/windows.mjs` | **Create.** The enumerated ability window vocabulary, the derived constants, and `windowsOf()`. Pure data + one pure function. |
| `test/unit/windows.test.mjs` | **Create.** The vocabulary's own tests, and the drift test holding it against the dispatchers. |
| `module/rules/reactions.mjs` | **Modify.** Delete the two local constants and `ATTACKER_WINDOWS`; re-export from `windows.mjs`. Use `windowsOf()` at line 113. |
| `module/engine/attack.mjs` | **Modify.** Replace the `"whenTargetedByNP"` literal at 4763 with the named constant. |
| `tools/lib/content.mjs` | **Modify.** Validate `timing.window` for ability-shaped documents. |
| `docs/15-abilities.md` | **Modify.** §15.3's union corrected to what the engine implements. |
| `docs/45-implementation-status.md` | **Modify.** The entry recording it. |

---

## Task 1: The window vocabulary

**Files:**
- Create: `module/rules/windows.mjs`
- Test: `test/unit/windows.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ABILITY_WINDOWS: Readonly<Record<string, {id: string, dispatched: boolean, hint: string}>>`
  - `ABILITY_WINDOW_IDS: readonly string[]`
  - `REACTION_WINDOW: "whenAttacked"`
  - `ALLY_WINDOW: "whenAllyAttacked"`
  - `NP_DECLARATION_WINDOW: "whenTargetedByNP"`
  - `ATTACKER_WINDOWS: readonly ["damageStep", "combatPhaseStart"]`
  - `isAbilityWindow(id: unknown): boolean`
  - `windowsOf(timing: object|null|undefined): string[]`

- [ ] **Step 1: Write the failing test**

Create `test/unit/windows.test.mjs`:

```js
/**
 * @file The ability timing window vocabulary.
 * @see module/rules/windows.mjs, docs/15-abilities.md §15.3
 *
 * `timing.window` is authored by 117 of 195 abilities and, until this module,
 * was matched by string comparison at three scattered call sites with no
 * enumeration anywhere. A typo authored cleanly, validated, passed CI, and
 * produced a reaction window that never fired.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  ABILITY_WINDOWS, ABILITY_WINDOW_IDS, REACTION_WINDOW, ALLY_WINDOW,
  NP_DECLARATION_WINDOW, ATTACKER_WINDOWS, isAbilityWindow, windowsOf,
} from "../../module/rules/windows.mjs";

describe("the vocabulary", () => {
  it("holds exactly the six windows an ability may name", () => {
    expect([...ABILITY_WINDOW_IDS].sort()).toEqual([
      "combatPhaseStart", "damageStep", "ownTurn",
      "whenAllyAttacked", "whenAttacked", "whenTargetedByNP",
    ]);
  });

  it("marks ownTurn as the one window nothing dispatches", () => {
    // It is documentary -- "usable during your Turn", the sheet button. No
    // dispatcher matches it, and a reader who assumes otherwise will go
    // looking for the call site that offers it.
    expect(ABILITY_WINDOWS.ownTurn.dispatched).toBe(false);
    for (const id of ABILITY_WINDOW_IDS.filter((w) => w !== "ownTurn")) {
      expect(ABILITY_WINDOWS[id].dispatched, id).toBe(true);
    }
  });

  it("gives every window a hint, so the editor can explain it", () => {
    for (const id of ABILITY_WINDOW_IDS) {
      expect(ABILITY_WINDOWS[id].hint.length, id).toBeGreaterThan(0);
    }
  });

  it("names the derived constants the dispatchers use", () => {
    expect(REACTION_WINDOW).toBe("whenAttacked");
    expect(ALLY_WINDOW).toBe("whenAllyAttacked");
    expect(NP_DECLARATION_WINDOW).toBe("whenTargetedByNP");
    expect([...ATTACKER_WINDOWS]).toEqual(["damageStep", "combatPhaseStart"]);
  });

  it("derives every constant from the table rather than restating it", () => {
    for (const w of [REACTION_WINDOW, ALLY_WINDOW, NP_DECLARATION_WINDOW, ...ATTACKER_WINDOWS]) {
      expect(ABILITY_WINDOW_IDS, w).toContain(w);
    }
  });
});

describe("isAbilityWindow", () => {
  it("accepts a known window and refuses anything else", () => {
    expect(isAbilityWindow("whenAttacked")).toBe(true);
    // The documented-but-wrong spelling from docs/15-abilities.md §15.3.
    expect(isAbilityWindow("damageStepStart")).toBe(false);
    // A command spell window. The two vocabularies stay separate.
    expect(isAbilityWindow("anyTime")).toBe(false);
    expect(isAbilityWindow(null)).toBe(false);
    expect(isAbilityWindow(42)).toBe(false);
  });
});

describe("windowsOf", () => {
  it("reads a single window", () => {
    expect(windowsOf({ window: "whenAttacked" })).toEqual(["whenAttacked"]);
  });

  it("reads a list, because an ability may name two", () => {
    // Karna's Uncrowned Arms Mastership: "used during your Turn OR at the
    // start of a Combat Phase."
    expect(windowsOf({ window: ["ownTurn", "combatPhaseStart"] }))
      .toEqual(["ownTurn", "combatPhaseStart"]);
  });

  it("reads an absent timing as no windows rather than throwing", () => {
    expect(windowsOf(null)).toEqual([]);
    expect(windowsOf(undefined)).toEqual([]);
    expect(windowsOf({})).toEqual([]);
  });
});

describe("drift: the vocabulary and the dispatchers", () => {
  // Modelled on test/unit/targeting.test.mjs:600-660, which tests BOTH
  // directions because it was written after the picker offered `point` and
  // the resolver only knew `withinRange`.
  const sources = [
    readFileSync("module/rules/reactions.mjs", "utf8"),
    readFileSync("module/engine/attack.mjs", "utf8"),
    readFileSync("module/rules/ability-use.mjs", "utf8"),
  ].join("\n");

  it("has no dispatcher naming a window as a bare string literal", () => {
    // The defect this module exists to end: `attack.mjs` matched
    // "whenTargetedByNP" as an inline literal, so nothing could enumerate it.
    for (const id of ABILITY_WINDOW_IDS) {
      const literal = new RegExp(`["'\`]${id}["'\`]`, "g");
      const hits = (sources.match(literal) ?? []).length;
      expect(hits, `"${id}" is still written as a literal in a dispatcher; import it from windows.mjs`)
        .toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/unit/windows.test.mjs
```

Expected: FAIL — `Failed to resolve import "../../module/rules/windows.mjs"`.

- [ ] **Step 3: Write the implementation**

Create `module/rules/windows.mjs`:

```js
/**
 * @file The ability timing window vocabulary.
 * @see docs/15-abilities.md §15.3
 *
 * Layer 2 (rules). Pure data.
 *
 * **Why this exists.** `timing` is a bare `ObjectField` (`data/item/ability.mjs`),
 * and `timing.window` is authored by 117 of the 195 abilities in
 * `packs/_source` — the most-used structured field in the content. Until this
 * module there was no enumeration of it anywhere: windows were matched by
 * string comparison at three scattered call sites, two of them against
 * module-local constants and one against a bare literal, and the content build
 * checked nothing. A typo authored cleanly, validated, passed CI, and produced
 * an ability whose reaction window never fired.
 *
 * That is the identical failure `test/unit/targeting.test.mjs` was written
 * after, when the picker offered `point` and the resolver only knew
 * `withinRange`. One list, and a drift test in both directions.
 *
 * **`ownTurn` is the odd one.** No dispatcher matches it — it is documentary,
 * meaning "usable during your Turn", which is the sheet button rather than an
 * offer. `dispatched` says so rather than leaving a reader to hunt for a call
 * site that does not exist. 89 of the 117 uses are this one.
 *
 * Command spells have their own windows (`rules/command-spells.mjs#WINDOWS`)
 * and the two lists must never merge, for the same reason their requirement
 * lists must not (`tools/lib/content.mjs`): `anyTime` and `onDefeat` describe
 * moments an ability has no way to be offered at.
 */

/**
 * @typedef {object} WindowEntry
 * @property {string} id
 * @property {boolean} dispatched whether any call site offers abilities at it
 * @property {string} hint one line, in the words a GM uses
 */

/** Every window an ability's `timing.window` may name. */
export const ABILITY_WINDOWS = Object.freeze({
  ownTurn: Object.freeze({
    id: "ownTurn",
    // Documentary. `rules/ability-use.mjs` reads it only to classify the
    // ability; nothing offers at it.
    dispatched: false,
    hint: "During its owner's own Turn — the ordinary case, and the sheet button.",
  }),
  whenAttacked: Object.freeze({
    id: "whenAttacked",
    dispatched: true,
    hint: "When this Unit is attacked, as a reaction inside the attacker's Combat Process.",
  }),
  whenAllyAttacked: Object.freeze({
    id: "whenAllyAttacked",
    dispatched: true,
    hint: "When an allied Unit nearby is about to be hit — the bearer is neither attacker nor defender.",
  }),
  damageStep: Object.freeze({
    id: "damageStep",
    dispatched: true,
    hint: "At the start of a Damage Step, on this Unit's OWN attack.",
  }),
  combatPhaseStart: Object.freeze({
    id: "combatPhaseStart",
    dispatched: true,
    hint: "At the start of a Combat Phase, on this Unit's own attack.",
  }),
  whenTargetedByNP: Object.freeze({
    id: "whenTargetedByNP",
    dispatched: true,
    hint: "When a Noble Phantasm is DECLARED against this Unit, before any Combat Process exists.",
  }),
});

/** @type {readonly string[]} */
export const ABILITY_WINDOW_IDS = Object.freeze(Object.keys(ABILITY_WINDOWS));

/** The window an ability must name to be offered as a defender's reaction. */
export const REACTION_WINDOW = ABILITY_WINDOWS.whenAttacked.id;

/** The window for an ability somebody else's peril triggers. */
export const ALLY_WINDOW = ABILITY_WINDOWS.whenAllyAttacked.id;

/**
 * The window answering a DECLARATION rather than a moment inside a Process —
 * Mannanán's Fragarach, which stops the Process from happening at all.
 */
export const NP_DECLARATION_WINDOW = ABILITY_WINDOWS.whenTargetedByNP.id;

/** The windows the **attacker's own** abilities may name. */
export const ATTACKER_WINDOWS = Object.freeze([
  ABILITY_WINDOWS.damageStep.id,
  ABILITY_WINDOWS.combatPhaseStart.id,
]);

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isAbilityWindow(id) {
  return typeof id === "string" && Object.hasOwn(ABILITY_WINDOWS, id);
}

/**
 * The windows one `timing` block names, as a list.
 *
 * A window may be a single string or a list of them — Karna's Uncrowned Arms
 * Mastership is *"used during your Turn or at the start of a Combat Phase"* —
 * so every consumer flattens. This is that flattening, in one place, rather
 * than `[sys.timing?.window ?? []].flat()` repeated at each call site.
 *
 * @param {object|null|undefined} timing
 * @returns {string[]}
 */
export function windowsOf(timing) {
  return [timing?.window ?? []].flat().filter((w) => typeof w === "string");
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/unit/windows.test.mjs
```

Expected: PASS on the vocabulary tests. The **drift test will still FAIL**, because `reactions.mjs` and `attack.mjs` still contain the literals — that is correct, and Task 2 fixes it. Confirm the only failure is `"has no dispatcher naming a window as a bare string literal"`.

- [ ] **Step 5: Commit**

```bash
git add module/rules/windows.mjs test/unit/windows.test.mjs
git commit -m "$(cat <<'EOF'
feat(rules): one list of the windows an ability may name

`timing.window` is authored by 117 of 195 abilities -- the most-used
structured field in the content -- and had no enumeration anywhere.
Windows were matched by string comparison at three scattered call
sites, two against module-local constants and one against a bare
literal, and the content build checked nothing. A typo authored
cleanly, validated, passed CI, and never fired.

Six windows, one of which (`ownTurn`) nothing dispatches: it is
documentary, and `dispatched: false` says so rather than leaving a
reader hunting for a call site that does not exist.

The drift test's literal check fails until the dispatchers are
re-pointed at this table, which is the next commit.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 2: Re-derive the dispatchers

**Files:**
- Modify: `module/rules/reactions.mjs:26`, `:46`, `:56`, `:113`
- Modify: `module/engine/attack.mjs:4763`
- Test: `test/unit/windows.test.mjs` (already written — the drift test goes green here)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `reactions.mjs` continues to export `ATTACKER_WINDOWS` (re-exported, not redefined), so its existing importers are unaffected.

**This task must not change behaviour.** Every string stays byte-identical; only where it is defined changes.

- [ ] **Step 1: Check who imports the constants being moved**

```bash
grep -rn "ATTACKER_WINDOWS" module test --include=*.mjs
```

Expected: definition at `module/rules/reactions.mjs:46` plus its importers. Every importer must keep working — `reactions.mjs` re-exports, so none of them change.

- [ ] **Step 2: Rewrite the constants in `reactions.mjs`**

Delete the local `REACTION_WINDOW` (line 26) and `ALLY_WINDOW` (line 56) definitions and the `ATTACKER_WINDOWS` definition (line 46), keeping their explanatory comments by moving the Servant-specific examples into the import block. Add near the other imports:

```js
// The windows themselves live in `rules/windows.mjs` -- one list, held against
// these dispatchers by a drift test in both directions. Re-exported because
// `ATTACKER_WINDOWS` has importers that should not care where it moved.
import {
  REACTION_WINDOW, ALLY_WINDOW, ATTACKER_WINDOWS, windowsOf,
} from "./windows.mjs";

export { ATTACKER_WINDOWS };
```

- [ ] **Step 3: Use the shared flattener at line 113**

Replace:

```js
    const windows = [sys.timing?.window ?? []].flat();
    if (!windows.includes(window)) return false;
```

with:

```js
    // A window may be a single string or a list; both are legitimate, and
    // Medea has one of each. `windowsOf` is that flattening in one place.
    if (!windowsOf(sys.timing).includes(window)) return false;
```

- [ ] **Step 4: Replace the literal in `attack.mjs`**

At `module/engine/attack.mjs:4763`, replace the string `"whenTargetedByNP"` with `NP_DECLARATION_WINDOW`, and add to that file's imports:

```js
import { NP_DECLARATION_WINDOW } from "../rules/windows.mjs";
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run test/unit/windows.test.mjs test/unit/reactions.test.mjs && npm test
```

Expected: all PASS, including the drift test that failed in Task 1. If any reaction test changes behaviour, a string was altered — revert and compare character by character.

- [ ] **Step 6: Verify the layer rule and the whole suite**

```bash
npm run lint && npm test
```

Expected: `FGT | Layer boundaries intact`, and 3319+ tests passing. `engine/attack.mjs` importing from `rules/` is Layer 3 → Layer 2, which is allowed; the reverse would not be.

- [ ] **Step 7: Commit**

```bash
git add module/rules/reactions.mjs module/engine/attack.mjs
git commit -m "$(cat <<'EOF'
refactor(rules): the dispatchers read the window list

Four partial lists become one. `REACTION_WINDOW` and `ALLY_WINDOW`
were module-local constants, `ATTACKER_WINDOWS` was exported from
reactions.mjs, and `whenTargetedByNP` was a bare literal in
attack.mjs -- so nothing could enumerate what an ability may name.

`ATTACKER_WINDOWS` is re-exported from its old home; its importers
do not change. `windowsOf` replaces the inline
`[sys.timing?.window ?? []].flat()`, which every consumer needs
because a window may legitimately be a string or a list.

No behaviour change: every window string is byte-identical, and the
drift test now passes in both directions.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 3: The content build validates the field

**Files:**
- Modify: `tools/lib/content.mjs:30` (imports), `:842` (wiring), and a new check function beside `activeRulesAreReachable` at `:643`
- Test: `test/unit/content.test.mjs`

**Interfaces:**
- Consumes: `ABILITY_WINDOW_IDS`, `windowsOf` from `module/rules/windows.mjs`.
- Produces: nothing other tasks consume.

`tools/lib/content.mjs:30` already imports `REQUIREMENT_KINDS` from `module/rules/items.mjs`, so importing from `module/rules/` here is the established pattern, not a new one.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/content.test.mjs`:

```js
describe("timing windows are validated", () => {
  it("refuses a window the engine does not dispatch", () => {
    // The spelling docs/15-abilities.md §15.3 published for years. An
    // ability naming it authors cleanly and its window never fires.
    const problems = [];
    timingWindowsAreKnown(
      { id: "x", timing: { window: "damageStepStart" } },
      "abilities/x.yml",
      problems,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/damageStepStart/);
    expect(problems[0]).toMatch(/damageStep/);
  });

  it("refuses a command spell window on an ability", () => {
    // The two vocabularies are deliberately separate: `anyTime` describes a
    // moment an ability has no way to be offered at.
    const problems = [];
    timingWindowsAreKnown({ id: "x", timing: { window: "anyTime" } }, "abilities/x.yml", problems);
    expect(problems).toHaveLength(1);
  });

  it("accepts every window the engine dispatches", () => {
    for (const id of ABILITY_WINDOW_IDS) {
      const problems = [];
      timingWindowsAreKnown({ id: "x", timing: { window: id } }, "abilities/x.yml", problems);
      expect(problems, id).toHaveLength(0);
    }
  });

  it("accepts a list of windows", () => {
    const problems = [];
    timingWindowsAreKnown(
      { id: "x", timing: { window: ["ownTurn", "combatPhaseStart"] } },
      "abilities/x.yml",
      problems,
    );
    expect(problems).toHaveLength(0);
  });

  it("says nothing about a document with no timing at all", () => {
    const problems = [];
    timingWindowsAreKnown({ id: "x" }, "abilities/x.yml", problems);
    expect(problems).toHaveLength(0);
  });
});
```

Add to that file's imports:

```js
import { timingWindowsAreKnown } from "../../tools/lib/content.mjs";
import { ABILITY_WINDOW_IDS } from "../../module/rules/windows.mjs";
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/content.test.mjs -t "timing windows"
```

Expected: FAIL — `timingWindowsAreKnown is not a function`.

- [ ] **Step 3: Implement the check**

In `tools/lib/content.mjs`, add to the import block near line 30:

```js
import { ABILITY_WINDOW_IDS, windowsOf } from "../../module/rules/windows.mjs";
```

Add beside `activeRulesAreReachable` (after line 653), and **export it** so the test can reach it:

```js
/**
 * Every `timing.window` names a window the engine dispatches.
 *
 * The field 117 of 195 abilities author, and until `rules/windows.mjs` there
 * was nothing to hold it against. The failure it prevents is silent: a window
 * nothing matches produces an ability that authors cleanly, validates, passes
 * CI, and is simply never offered.
 *
 * Command spell windows are deliberately NOT accepted here, for the same
 * reason their requirement kinds are not: `anyTime` and `onDefeat` describe
 * moments an ability has no way to be offered at.
 *
 * @param {object} doc
 * @param {string} path
 * @param {string[]} problems
 */
export function timingWindowsAreKnown(doc, path, problems) {
  for (const window of windowsOf(doc?.timing)) {
    if (ABILITY_WINDOW_IDS.includes(window)) continue;
    problems.push(
      `${path}: timing.window "${window}" is not a window the engine dispatches. ` +
      `Expected one of: ${ABILITY_WINDOW_IDS.join(", ")}. ` +
      `An unknown window authors cleanly and is never offered.`,
    );
  }
}
```

- [ ] **Step 4: Wire it into `validateDocument`**

At `tools/lib/content.mjs:842`, in the `else` branch beside the other ability checks:

```js
    activeRulesAreReachable(doc, path, problems);
    timingWindowsAreKnown(doc, path, problems);
    fieldIsOpenable(doc, path, problems);
```

Note the branch: command spells are validated in the same `else`, so if `packs/_source/command-spells` documents carry `timing.window` values from the command spell vocabulary, this check must be scoped. Verify with:

```bash
node -e "
const fs=require('fs'),yaml=require('yaml');
for(const f of fs.readdirSync('packs/_source/command-spells').filter(f=>f.endsWith('.yml'))){
  const d=yaml.parse(fs.readFileSync('packs/_source/command-spells/'+f,'utf8'));
  if(d?.timing?.window) console.log(f, JSON.stringify(d.timing.window));
}"
```

If that prints anything, scope the call with the same `dir`-based branch `validateDocument` already receives (`dir === "command-spells"`), matching how line 1039 selects `CS_REQUIREMENT_KINDS`. If it prints nothing, the unscoped call is correct and this note can be deleted.

- [ ] **Step 5: Run the tests and the real content build**

```bash
npx vitest run test/unit/content.test.mjs && npm run validate:content
```

Expected: tests PASS, and `validate:content` reports **0 errors** — the corpus was measured clean before this plan was written. If it reports errors, each one is a real ability whose window has never fired: **stop, list them, and report before changing any content.** Fixing them is not this task's job.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/content.mjs test/unit/content.test.mjs
git commit -m "$(cat <<'EOF'
feat(content): reject a timing window nothing dispatches

The build now holds `timing.window` against `rules/windows.mjs`, the
way it already holds requirement kinds against `rules/items.mjs`.

The failure it prevents is silent and was unguarded for the whole
life of the field: a window nothing matches produces an ability that
authors cleanly, validates, passes CI, and is never offered. 117 of
195 abilities carry one.

Command spell windows stay out, for the same reason their
requirement kinds do -- `anyTime` and `onDefeat` name moments an
ability has no way to be offered at.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 4: Correct the chapter

**Files:**
- Modify: `docs/15-abilities.md:485-500` (§15.3's `TimingWindow` union)
- Modify: `docs/45-implementation-status.md` (append an entry before the `**Previous:**` footer)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Replace §15.3's union**

`docs/15-abilities.md` §15.3 currently publishes eleven values. Two are wrong and five are not dispatched for abilities. Replace the `ts` block and add the note beneath it:

````markdown
```ts
type TimingWindow =
  | "ownTurn"            // default — the sheet button; NOTHING dispatches it
  | "whenAttacked"       // Medea's Argos and Trofa — a defender's reaction
  | "whenAllyAttacked"   // EMIYA's Rho Aias, Achilles's Akhilleus Kosmos
  | "damageStep"         // Asterios's Monstrous Strength — on your OWN attack
  | "combatPhaseStart"   // Semiramis's Scales of the Sacred Fish; Karna's UAM
  | "whenTargetedByNP";  // Mannanán's Fragarach — offered at the DECLARATION
```

> **Corrected 2026-09-10.** This union previously listed eleven values, and it was the third
> disagreeing list in the system. It said `damageStepStart`; the engine and every authored ability
> say **`damageStep`**, so a GM authoring from this chapter wrote a window that never fired. It also
> listed `anyTime`, `combatProcessStart`, `whenAttacking`, `onDefeat` and `reaction`, none of which
> any dispatcher offers abilities at — `anyTime`, `onDefeat` and `react` belong to the **command
> spell** vocabulary (`rules/command-spells.mjs`), which is a separate list and stays separate.
>
> The authority is now `module/rules/windows.mjs`. `tools/lib/content.mjs` rejects anything else,
> and a drift test fails if a dispatcher names a window as a bare string literal.

A window may be a **string or a list** — Karna's *Uncrowned Arms Mastership* is *"used during your
Turn or at the start of a Combat Phase"* — so every consumer reads it through `windowsOf()`.
````

- [ ] **Step 2: Append the Chapter 45 entry**

Insert before the `**Previous:**` footer of `docs/45-implementation-status.md`:

```markdown
---

## The window nothing checked — **repaired**

`timing.window` is authored by **117 of the 195** abilities in `packs/_source` — the most-used
structured field in the content — and had no enumeration anywhere. Windows were matched by string
comparison at three call sites: two module-local constants in `rules/reactions.mjs`, an exported
`ATTACKER_WINDOWS` holding two entries, and a bare `"whenTargetedByNP"` literal in `engine/attack.mjs`.
The content build checked nothing.

So a typo in it authored cleanly, validated, passed CI, and produced an ability whose reaction
window was never offered. Exactly the failure `test/unit/targeting.test.mjs` was written after, on a
far more used field.

There were **three disagreeing lists**. The engine dispatches five windows plus the undispatched
`ownTurn`. The content authors exactly those six. `docs/15-abilities.md` §15.3 published eleven —
including `damageStepStart`, which the engine spells `damageStep`, so the chapter itself instructed
authors to write a window that could never fire.

`module/rules/windows.mjs` is now the single list; the four partial lists derive from it,
`windowsOf()` replaces the `[timing?.window ?? []].flat()` every consumer needed, the content build
rejects an unknown window, and a drift test fails if any dispatcher goes back to a string literal.

The corpus was clean when the guard went in — this is a guard against future drift, not a repair.

---
```

- [ ] **Step 3: Verify the whole thing**

```bash
npm test && npm run lint && npm run validate:content && npm run check:templates
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/15-abilities.md docs/45-implementation-status.md
git commit -m "$(cat <<'EOF'
docs(abilities): §15.3's window union was the third disagreeing list

It published eleven values. It said `damageStepStart`; the engine and
every authored ability say `damageStep`, so a GM authoring from the
chapter wrote a window that never fired. Five more entries are
dispatched for abilities by nothing -- `anyTime`, `onDefeat` and
`react` are the COMMAND SPELL vocabulary, which stays separate.

Six values now, matching `rules/windows.mjs`, with `ownTurn` marked
as the one nothing dispatches.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 5: Verify in the live world

**Files:** none — verification only.

Green tests are not evidence that a reaction still fires. This task proves the refactor did not change behaviour where it actually matters.

- [ ] **Step 1: Reload the running world**

```bash
node tools/fgt-world.mjs status   # want "ready": true
node tools/fgt-reload.mjs
```

- [ ] **Step 2: Confirm the vocabulary loaded and the dispatchers agree**

```bash
echo "
const w = await import('/systems/fgt/module/rules/windows.mjs');
const r = await import('/systems/fgt/module/rules/reactions.mjs');
return {
  ids: w.ABILITY_WINDOW_IDS,
  attacker: [...r.ATTACKER_WINDOWS],
  flattens: w.windowsOf({ window: ['ownTurn', 'combatPhaseStart'] }),
};
" | node tools/fgt-eval.mjs
```

Expected: the six ids, `["damageStep","combatPhaseStart"]`, and the flattened pair.

- [ ] **Step 3: Prove a reaction is still offered**

Load a Servant with a `whenAttacked` ability (Medea's *Argos*) from the compendium, and ask the dispatcher directly:

```bash
echo "
const r = await import('/systems/fgt/module/rules/reactions.mjs');
const pack = game.packs.find(p => p.metadata.type === 'Item');
const medea = (await pack.getDocuments()).filter(i => (i.system?.timing?.window ?? '').includes?.('whenAttacked') || [i.system?.timing?.window].flat().includes('whenAttacked'));
return { candidates: medea.map(i => i.name).slice(0, 5), count: medea.length };
" | node tools/fgt-eval.mjs
```

Expected: a non-empty list. If it is empty, the compendium has no `whenAttacked` ability and the check is inconclusive — say so rather than claiming success.

- [ ] **Step 4: Report**

State what was run and what came back. Do not claim the refactor is verified if step 3 was inconclusive.

---

## Self-Review

**Spec coverage.** §3.4 asks for four things: `rules/windows.mjs` (Task 1), the four partial lists re-derived (Task 2), `tools/lib/content.mjs` validating the field (Task 3), and the drift test in both directions (Task 1's test, going green in Task 2). §11.1 asks that it merge before any editor work — this plan is standalone and produces no editor code. The multi-select note in §3.4 is consumed by the editor plan, not here. **No gaps.**

**Placeholders.** None. Every step carries the code or the exact command. Task 3 Step 4 contains a conditional, but it is a *verification with a command and both branches stated*, not a "figure it out".

**Type consistency.** `ABILITY_WINDOWS`, `ABILITY_WINDOW_IDS`, `REACTION_WINDOW`, `ALLY_WINDOW`, `NP_DECLARATION_WINDOW`, `ATTACKER_WINDOWS`, `isAbilityWindow`, `windowsOf`, `timingWindowsAreKnown` — each is defined in exactly one task and spelled identically at every later use. `windowsOf` takes the **`timing` object**, not the window value, at all four call sites.

**One risk the executor must not paper over.** Task 3 Step 5 may surface real content errors. The instruction is explicit: stop and report, do not fix. An ability whose window has never fired is a rules bug with a Servant behind it, and it deserves its own decision.
