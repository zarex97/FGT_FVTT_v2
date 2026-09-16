# Nursery Rhyme, Part 3 — Nameless Forest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A passive Noble Phantasm that kills by accumulation — tokens that permanently shave an enemy's Max Health, both Base Attacks and Max Luck, a d12 that deletes them, and a Luck Check that is the only way out.

**Architecture:** Two phases. Phase 1 makes the four engine changes — a token grant that performs permanent **writes** rather than contributions, a rank table indexed by the target's own parameter, an optional check offered on a Unit's own Turn, and the death roll. Phase 2 authors two files and walks them on a live board.

**Tech Stack:** Foundry VTT v14, ES modules, JSDoc typing, Vitest, YAML content compiled to LevelDB packs. Layer discipline `domain → rules → engine → apps` is enforced by ESLint.

**Spec:** `docs/superpowers/specs/2026-09-16-nursery-3-nameless-forest-design.md` — read it before Task 1, **including its three correction blocks**: the event is `turnEnd` and not `unitTurnEnd`, a rank table is indexed by its owning ability's rank and nothing else today, and the once-per-Turn escape has no mechanism at all.

## Global Constraints

- **Part 3 of 4.** It depends on **Part 1** only (`nursery-rhyme.yml` must exist) and is **independent of Parts 2 and 4** — it may be built before or after the summons, and must assume neither. Her Servant file gains **one** ref here.
- **The sheet's errata is binding.** *"reduce its Max Health by ~~50~~ 25, Base Attack (both) by ~~20~~ 10"* — **25 and 10 are live** (R1). Superseded text is not an alternative reading. Any test or file carrying 50 or 20 is wrong.
- **R2 is the clause most likely to be built wrong, and the plan is shaped around it.** Every other stat change in this engine is a *contribution* that springs back when its source leaves. These must not: *"(Health and Luck that are lost from the effects of this NP are not restored)"*. A `MaxDelta` scaled by `perStack` would look correct, pass a casual test, and silently restore everything the instant a Unit escaped.
- **R3 inverts under one careless reading.** A **high** MAG Rank makes escape **easier** — `rules/checks.mjs#resolveCheck` computes `total = roll + mods` and succeeds on `total <= target`, so a negative modifier helps. An implementer who reads "EX: −3" as "harder for EX" flips six table rows and produces a Noble Phantasm strongest against exactly the Servants it should struggle with. **The table is tested at all six grades.**
- **Layer boundaries.** `module/domain` and `module/rules` are pure. `npm run lint` runs `tools/check-layers.mjs`.
- **Both allowlists.** Any new authored field goes in `actorSystem()`/`itemSystem()` in `tools/lib/content.mjs` **and** the matching list in `module/content/authored-fields.mjs`.
- **`npm test`, `npm run lint` and `npm run validate:content` must pass at every commit.**
- **Rebuilding packs needs the world shut down.** `node tools/fgt-world.mjs shutdown` → `npm run build:packs` → `launch` → rejoin.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
  ```

---

# Phase 1 — four engine changes

---

### Task 1: The escape ladder's table, indexed by the target's own parameter (E2, R3, R4 — clauses F10, F11)

**Files:**
- Modify: `module/domain/tables.mjs` (add `namelessForestEscape`)
- Modify: `module/rules/elements.mjs` (`rawValue` — a `rankFrom`)
- Test: `test/unit/nursery-forest.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: a table `namelessForestEscape` indexed `EX −3, A −2, B −1, C 0, D +1, E +2`; and `{table: "<name>", rankFrom: "@<ref path>"}` on any element, indexing that table by a rank read off the refs instead of by the owning ability's rank.

**This task is first because R3 is the ruling the whole Noble Phantasm turns on**, and because getting its sign wrong is invisible in every other test.

- [ ] **Step 1: Write the failing test**

Create `test/unit/nursery-forest.test.mjs`:

```js
/**
 * @file Nameless Forest, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 3 of four. The only ability in either roster that wins by waiting.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { resolveCheck } from "../../module/rules/checks.mjs";

const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("R3 - the MAG ladder, at all six grades", () => {
  // The sign question decides the whole ability, so every row is pinned. An
  // implementer who reads "EX: -3" as "harder for EX" flips all six and
  // produces a Noble Phantasm strongest against exactly the Servants it
  // should struggle with.
  it.each([
    ["EX", -3], ["A", -2], ["B", -1], ["C", 0], ["D", 1], ["E", 2],
  ])("MAG %s modifies the dice by %i", (grade, expected) => {
    expect(lookup("namelessForestEscape", Rank.parse(grade))).toBe(expected);
  });

  it("and a NEGATIVE modifier makes escape MORE likely", () => {
    // The check itself, so the direction is proved rather than asserted.
    // `resolveCheck` computes total = roll + mods and succeeds on total <= target.
    const ex = resolveCheck({ roll: 8, target: 7, modifiers: [{ source: "MAG EX", value: -3 }] });
    const e = resolveCheck({ roll: 8, target: 7, modifiers: [{ source: "MAG E", value: 2 }] });
    expect(ex.success).toBe(true);
    expect(e.success).toBe(false);
  });

  it("R4 - the Home Base term STACKS with it", () => {
    // "(stacks with the MAG Rank modifiers as seen below)". A MAG EX unit at
    // home rolls at -6.
    const both = resolveCheck({
      roll: 12, target: 7,
      modifiers: [{ source: "MAG EX", value: -3 }, { source: "Home Base", value: -3 }],
    });
    expect(both.total).toBe(6);
    expect(both.success).toBe(true);
  });

  it("R3 - and both terms point the SAME way", () => {
    // The coherence check. The sheet separately refuses to delete a Unit at
    // home, so safety and magical power each make the forest easier to walk
    // out of. If the MAG rows were flipped, these two would disagree.
    expect(lookup("namelessForestEscape", Rank.parse("EX"))).toBeLessThan(0);
    expect(HOME_BASE_ESCAPE_MODIFIER).toBeLessThan(0);
  });
});

describe("E2 - a rank table indexed by the target's own parameter", () => {
  it("reads the grade off a ref path instead of the owning ability's rank", () => {
    const out = collectContributions(
      [{
        id: "nf", name: "Nameless Forest", rank: "C",
        passiveRules: [{
          key: "CheckModifier", check: "luck",
          table: "namelessForestEscape", rankFrom: "@self.parameters.mag",
        }],
      }],
      { options: new Set(), refs: { self: { parameters: { mag: "A" } } } },
    );
    // A, not C. The ability is Rank C, and reading the table by the ability's
    // rank -- which is what every other table in the corpus does -- would give
    // 0 here and silently make the ladder do nothing.
    expect(out.checkModifiers[0].value).toBe(-2);
  });

  it("falls back to the owning ability's rank when no rankFrom is given", () => {
    const out = collectContributions(
      [{ id: "x", rank: "B", passiveRules: [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape" }] }],
      { options: new Set(), refs: {} },
    );
    expect(out.checkModifiers[0].value).toBe(-1);
  });

  it("contributes nothing when the path resolves to no grade", () => {
    // A Master has no `parameters`. Silently reading `undefined` as EX would
    // hand every Master the best escape in the game.
    const out = collectContributions(
      [{ id: "nf", rank: "C", passiveRules: [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }] }],
      { options: new Set(), refs: { self: { parameters: {} } } },
    );
    expect(out.checkModifiers).toEqual([]);
  });
});
```

with `import { collectContributions } from "../../module/rules/elements.mjs";` added, and `HOME_BASE_ESCAPE_MODIFIER` exported from `module/domain/tables.mjs` beside the table.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-forest.test.mjs`
Expected: FAIL — `lookup` returns `null` for an unknown table.

- [ ] **Step 3: Add the table**

In `module/domain/tables.mjs`:

```js
/**
 * How a Unit's own MAG Rank modifies its escape from the Nameless Forest.
 *
 * > *"the value of the dice rolled for the affected Unit's Luck Check is
 * > modified as follows- MAG Rank EX: −3, A: −2, B: −1, C: No change, D: +1,
 * > E: +2"*
 *
 * **SIGNS AS WRITTEN, and a high Rank escapes MORE easily.** `checks.mjs`
 * computes `total = roll + modifiers` and succeeds on `total <= target`, so a
 * negative modifier helps.
 *
 * That reads backwards until you notice the Home Base term does the same thing
 * and that the sheet separately refuses to delete a Unit standing at home.
 * Both point one way: safety and magical power each make the forest easier to
 * walk out of. A powerful magus sees through it; so does somebody standing on
 * their own ground.
 */
export const namelessForestEscape = Object.freeze({
  EX: -3, A: -2, B: -1, C: 0, D: 1, E: 2,
});

/**
 * *"If the Unit is within its Home Base: −3 (stacks with the MAG Rank
 * modifiers as seen below)"* — so a MAG EX Unit at home rolls at −6.
 */
export const HOME_BASE_ESCAPE_MODIFIER = -3;
```

and register `namelessForestEscape` wherever `lookup` finds its tables.

- [ ] **Step 4: Add `rankFrom`**

In `module/rules/elements.mjs#rawValue`:

```js
function rawValue(el, rank, ctx, field) {
  if (el.table) {
    // WHICH rank indexes the table.
    //
    // Every table in the corpus until now is read against the OWNING ability's
    // rank, which is what `rank` is. Nameless Forest is read against the
    // *target's own MAG parameter*: *"the value of the dice rolled for the
    // affected Unit's Luck Check is modified as follows- MAG Rank EX: −3…"*
    //
    // A path rather than a field name, because `expressionRefs` already
    // publishes `self.parameters` and a second vocabulary for reaching the
    // same object would be one more thing to keep in step.
    //
    // A path that resolves to no grade contributes NOTHING rather than falling
    // back to the ability's rank. A Master has no `parameters`, and reading
    // `undefined` as EX would hand every Master the best escape in the game.
    const index = el.rankFrom ? gradeAt(el.rankFrom, ctx) : rank;
    if (el.rankFrom && !index) return null;
    const v = lookup(el.table, index);
    // A dice-formula table with a per-step delta returns `{formula, bonus}`;
    // the caller decides what to do with it.
    return v ?? null;
  }
  …
}
```

`gradeAt` walks the same `@a.b.c` path `resolveExpression` walks and returns a `Rank` or `null`. Reuse the walk rather than writing a second one — extract it from `resolveExpression` if it is not already separable.

**And `CheckModifier` must drop a contribution whose value is `null`.** `scalar(resolveValue(...))` of `null` is `0` today, which is indistinguishable from MAG C. Check what `scalar` does with `null` before writing this, and if it coerces, make `CheckModifier` return early instead.

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint
git add module/domain/tables.mjs module/rules/elements.mjs test/unit/nursery-forest.test.mjs
git commit -F - <<'MSG'
feat(rules): a rank table may be indexed by the target's own parameter

Every table in the corpus until now is read against the OWNING ability's rank.
Nameless Forest is read against the affected Unit's own MAG parameter: "the
value of the dice rolled for the affected Unit's Luck Check is modified as
follows- MAG Rank EX: -3, A: -2, B: -1, C: No change, D: +1, E: +2".

Signs as written, and a high Rank escapes MORE easily -- resolveCheck computes
total = roll + mods and succeeds on total <= target, so a negative modifier
helps. That reads backwards until you notice the Home Base term does the same
thing and that the sheet separately refuses to delete a Unit standing at home.
Both point one way. The table is tested at all six grades for exactly this
reason.

A path that resolves to no grade contributes nothing rather than falling back.
A Master has no parameters, and reading undefined as EX would hand every Master
the best escape in the game.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 2: A token that writes, and does not spring back (E1, R2 — clauses F3, F5, F6, F7, F9)

**Files:**
- Modify: `module/engine/scheduler.mjs` (`StatDelta` reaching `*.max`, and an `alsoCurrent`)
- Modify: `module/engine/io.mjs#adjustStat`
- Test: `test/unit/nursery-forest.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `{key: "StatDelta", stat: "health.max", delta: -25, alsoCurrent: true}` writing both the ceiling and the current value; the same for `baseAttack.str`, `baseAttack.mag` and `luck.max`.

**This is the one place Part 3 diverges from how the engine normally expresses a stat change, and the divergence is the sheet's own parenthesis.** A `MaxDelta` contribution scaled by `perStack` would look correct and would restore everything the instant the tokens left — which is precisely what *"(Health and Luck that are lost from the effects of this NP are not restored)"* forbids.

- [ ] **Step 1: Write the failing test**

```js
describe("R2 - the reductions are WRITES, and do not spring back", () => {
  it("one token takes 25 Max Health, 10 off BOTH Base Attacks, and 1 Max Luck", () => {
    // R1: 25 and 10. The sheet strikes through 50 and 20; superseded text is
    // not an alternative reading.
    const writes = tokenWrites(1);
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: "health.max", delta: -25, alsoCurrent: true }),
      expect.objectContaining({ stat: "baseAttack.str", delta: -10 }),
      expect.objectContaining({ stat: "baseAttack.mag", delta: -10 }),
      expect.objectContaining({ stat: "luck.max", delta: -1, alsoCurrent: true }),
    ]));
  });

  it("three tokens have taken 75, 30 and 30, and 3", () => {
    const after = applyWrites({ health: { value: 1000, max: 1000 }, baseAttack: { str: 200, mag: 200 }, luck: { value: 8, max: 8 } },
      [tokenWrites(1), tokenWrites(1), tokenWrites(1)].flat());
    expect(after.health.max).toBe(925);
    expect(after.baseAttack).toEqual({ str: 170, mag: 170 });
    expect(after.luck.max).toBe(5);
  });

  it("THE TEST THAT MATTERS - a successful escape zeroes the pool and moves NOTHING else", () => {
    // "(Health and Luck that are lost from the effects of this NP are not
    // restored)". A MaxDelta contribution scaled by a held count would spring
    // back here, look correct, and pass a casual test.
    const before = { health: { value: 900, max: 925 }, baseAttack: { str: 170, mag: 170 }, luck: { value: 5, max: 5 },
      resources: { namelessForestTokens: { value: 3 } } };
    const after = applyWrites(before, escapeWrites());
    expect(after.resources.namelessForestTokens.value).toBe(0);
    expect(after.health).toEqual({ value: 900, max: 925 });
    expect(after.baseAttack).toEqual({ str: 170, mag: 170 });
    expect(after.luck).toEqual({ value: 5, max: 5 });
  });

  it("alsoCurrent pulls a current value down with its ceiling", () => {
    // A Unit at full Health whose maximum drops must not sit above it.
    const after = applyWrites({ health: { value: 1000, max: 1000 } },
      [{ stat: "health.max", delta: -25, alsoCurrent: true }]);
    expect(after.health).toEqual({ value: 975, max: 975 });
  });

  it("...but does not heal a wounded one", () => {
    // A Unit at 400 of 1000 goes to 400 of 975, not to 975.
    const after = applyWrites({ health: { value: 400, max: 1000 } },
      [{ stat: "health.max", delta: -25, alsoCurrent: true }]);
    expect(after.health).toEqual({ value: 400, max: 975 });
  });
});
```

`tokenWrites`, `escapeWrites` and `applyWrites` are thin helpers: the first two read the authored rules out of `nameless-forest.yml` (Task 5) and the third replays descriptors against a plain object. Until Task 5 exists, write them against the literal rule objects the file will carry, and re-point them in Task 5.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-forest.test.mjs -t "do not spring back"`
Expected: FAIL — `alsoCurrent` is ignored, so the fourth assertion leaves the current value at 1000 above a max of 975.

- [ ] **Step 3: Implement `alsoCurrent`**

In `module/engine/io.mjs#adjustStat`, when the path ends in `.max` and the intent carries `alsoCurrent`:

```js
      // A ceiling that drags its current value down with it.
      //
      // > *"For every Nameless Forest Counter on a Unit, reduce its Max Health
      // > by 25 … and Max Luck by 1."*
      //
      // A Unit at full Health whose maximum drops must not sit above its own
      // ceiling — but a WOUNDED one must not be healed on the way. So the
      // current value is clamped to the new maximum rather than moved by the
      // same delta: 1000/1000 becomes 975/975, and 400/1000 becomes 400/975.
```

`StatDelta` passes the flag through; the write is a single `actor.update` with both paths, so a failure cannot leave a current value stranded above its max.

- [ ] **Step 4: Confirm `baseAttack.str` is reachable**

`adjustStat` builds `system.${stat}`, so `baseAttack.str` resolves. Confirm `baseAttack` is a plain `{str, mag}` on the Servant schema and not derived — `grep -n "baseAttack" module/data/actor/servant.mjs`. **If it is derived from the parameter tables, a write to it will be recomputed away on the next prepare, and this task must write to a `baseAttackDelta` the derivation subtracts instead.** That is a real fork in the road; find out before authoring Task 5.

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint
git add module/engine/io.mjs module/engine/scheduler.mjs test/unit/nursery-forest.test.mjs
git commit -F - <<'MSG'
feat(engine): a stat write may drag its current value down with its ceiling

"For every Nameless Forest Counter on a Unit, reduce its Max Health by 25 ...
and Max Luck by 1" -- and "(Health and Luck that are lost from the effects of
this NP are not restored)".

That parenthesis is why these are WRITES rather than contributions. Every other
stat change in this engine springs back when its source leaves; a MaxDelta
scaled by a held token count would look correct, pass a casual test, and
silently restore everything the instant a Unit escaped.

alsoCurrent clamps the current value to the new maximum rather than moving it
by the same delta, so a Unit at full Health does not sit above its own ceiling
and a wounded one is not healed on the way down: 1000/1000 becomes 975/975 and
400/1000 becomes 400/975.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 3: The death roll (E3, R5, R6 — clauses F12, F13, F14)

**Files:**
- Create: `module/rules/nameless-forest.mjs`
- Modify: `module/engine/scheduler.mjs` (the `turnEnd` pass)
- Test: `test/unit/nursery-forest.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `deathRollOutcome({tokens, roll, inHomeBase})` exported pure, returning `{rolls: boolean, deleted: boolean, reason: string|null}`.

**The event is `turnEnd`.** *"At the end of the Unit's Turn"* — `engine/scheduler.mjs:65`, which fires for the units of the faction whose Turn is ending. `unitTurnEnd` does not exist; the three that do are `turnEnd`, `actedTurnEnd` and `anyTurnEnd`.

- [ ] **Step 1: Write the failing test**

```js
import { deathRollOutcome } from "../../module/rules/nameless-forest.mjs";

describe("E3 - the death roll", () => {
  it("F12 - does not roll at 2 tokens", () => {
    expect(deathRollOutcome({ tokens: 2, roll: 1, inHomeBase: false })).toMatchObject({ rolls: false, deleted: false });
  });

  it("F12 - rolls at 3", () => {
    expect(deathRollOutcome({ tokens: 3, roll: 12, inHomeBase: false })).toMatchObject({ rolls: true, deleted: false });
  });

  it("F13 - deleted on a roll EQUAL to the count", () => {
    // "equal to or lower than". The boundary is the whole clause.
    expect(deathRollOutcome({ tokens: 3, roll: 3, inHomeBase: false }).deleted).toBe(true);
  });

  it("F13 - and not on a roll one above it", () => {
    expect(deathRollOutcome({ tokens: 3, roll: 4, inHomeBase: false }).deleted).toBe(false);
  });

  it("F13 - and the more tokens it carries, the likelier that is", () => {
    expect(deathRollOutcome({ tokens: 9, roll: 9, inHomeBase: false }).deleted).toBe(true);
    expect(deathRollOutcome({ tokens: 3, roll: 9, inHomeBase: false }).deleted).toBe(false);
  });

  it("F14/R6 - a Unit at home STILL ROLLS, and is refused the outcome", () => {
    // Skipping the roll and refusing the consequence are indistinguishable
    // today and will not be once anything reads the roll log. The sheet says
    // "a Unit cannot DISAPPEAR due to the effects of this NP if it is within
    // its Home Base" -- it refuses the disappearance, not the die.
    const out = deathRollOutcome({ tokens: 9, roll: 1, inHomeBase: true });
    expect(out).toMatchObject({ rolls: true, deleted: false, reason: "inHomeBase" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-forest.test.mjs -t "the death roll"`
Expected: FAIL — cannot resolve `module/rules/nameless-forest.mjs`.

- [ ] **Step 3: Write the pure pass**

```js
/**
 * @file The Nameless Forest's death roll.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md, docs/44-case-expanded-roster.md
 *
 * Layer 2 (rules). Pure.
 *
 * > *"At the end of the Unit's Turn, a Unit with at least 3 Nameless Forest
 * > Tokens rolls a twelve-sided die. If the number rolled is equal to or lower
 * > than the number of Nameless Forest Tokens on the Unit, the Unit disappears
 * > (i.e. is defeated). However, a Unit cannot disappear due to the effects of
 * > this NP if it is within its Home Base."*
 *
 * The only thing in either roster that can remove a Unit with no attack, no
 * roll to hit and no counter-play beyond a Luck Check. Its gates — the 2-panel
 * ring, the 3-token threshold, the Home Base exemption and the NP Seal clause —
 * are the whole of its balance, and every one is a separate clause that has to
 * actually fire.
 */

/** *"at least 3 Nameless Forest Tokens"*. */
export const DEATH_ROLL_THRESHOLD = 3;

/**
 * Does this Unit roll, and does the roll take it?
 *
 * The Home Base exemption refuses the OUTCOME and not the die. *"A Unit cannot
 * **disappear** due to the effects of this NP if it is within its Home Base"* —
 * skipping the roll and refusing its consequence are indistinguishable today,
 * and will not be once anything reads the roll log.
 *
 * @param {object} args
 * @param {number} args.tokens
 * @param {number} args.roll a d12
 * @param {boolean} args.inHomeBase
 * @returns {{rolls: boolean, deleted: boolean, reason: string|null}}
 */
export function deathRollOutcome({ tokens, roll, inHomeBase }) {
  if ((tokens ?? 0) < DEATH_ROLL_THRESHOLD) {
    return { rolls: false, deleted: false, reason: "belowThreshold" };
  }
  // *"equal to or lower than"* — the boundary is the clause.
  if (roll > tokens) return { rolls: true, deleted: false, reason: "survived" };
  if (inHomeBase) return { rolls: true, deleted: false, reason: "inHomeBase" };
  return { rolls: true, deleted: true, reason: null };
}
```

- [ ] **Step 4: Wire it to `turnEnd`**

The effect authors an `OnEvent turnEnd` handler with a `1d12` roll; its action reads `deathRollOutcome` and emits a **defeat** when it says so. *"Disappears (i.e. is defeated)"* — the sheet glosses its own term, so this is an **ordinary defeat**: it runs the revival chain like any other and is **not** `Death` semantics. Nothing on the sheet says revival is ignored.

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint
git add module/rules/nameless-forest.mjs module/engine/scheduler.mjs test/unit/nursery-forest.test.mjs
git commit -F - <<'MSG'
feat(rules): the Nameless Forest's death roll

"a Unit with at least 3 Nameless Forest Tokens rolls a twelve-sided die. If the
number rolled is equal to or lower than the number of Tokens, the Unit
disappears (i.e. is defeated)."

The only thing in either roster that can remove a Unit with no attack, no roll
to hit and no counter-play beyond a Luck Check.

A Unit at home still ROLLS and is refused the outcome, because the sheet
refuses the disappearance rather than the die. Skipping the roll and refusing
its consequence are indistinguishable today and will not be once anything reads
the roll log.

"Disappears (i.e. is defeated)" -- the sheet glosses its own term, so this is an
ordinary defeat that runs the revival chain. It is not Death semantics.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 4: An effect that offers its bearer an optional check (E4 — clause F8)

**Files:**
- Modify: `module/rules/elements.mjs` (an `OfferCheck` element)
- Modify: `module/engine/scheduler.mjs` (raise the pending row on `turnStart`)
- Modify: `module/apps/hud/pending-panel.mjs` (answer it)
- Test: `test/unit/nursery-forest.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `{key: "OfferCheck", check: "luck", perTurn: 1, onSuccess: [...], declineCosts: "nothing"}` on an effect definition, raising a pending `luckCheck` row for the bearer at the start of its own Turn.

**Can, not must.** Nothing in the corpus offers a Unit an optional roll on its own Turn. `grantedAbilities` is the obvious home and is the wrong one — `rules/granted.mjs` says outright it is *"a closed list, because these are the ones something in the engine actually asks about"*, capability ids rather than ability documents. What **does** already exist is the affordance: `apps/hud/pending-present.mjs` carries a `luckCheck` prompt kind, routes a row to the owner of the unit being asked, and §27.5 fixes the default on expiry as *"the option that spends nothing"* — which here is declining, exactly right for an optional escape.

**Raised outside the Combat Process**, which is the whole of the risk: a prompt inside the ladder is what hung `heelResolve`, and this one has no rung to hang.

- [ ] **Step 1: Write the failing test**

```js
describe("E4 - an optional check offered on the bearer's own Turn", () => {
  const forest = () => ({
    id: "nf", name: "Nameless Forest", rank: "C", fromEffect: true,
    rules: [{ key: "OfferCheck", check: "luck", perTurn: 1, declineCosts: "nothing",
              onSuccess: [{ key: "ResourceDelta", resource: "namelessForestTokens", set: 0 }] }],
  });

  it("raises one pending luckCheck row for the bearer at turnStart", () => {
    const rows = offersFor(forest(), { unitId: "foe", event: "turnStart" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "luckCheck", unitId: "foe" });
  });

  it("F8 - once per Turn, and no more", () => {
    const rows = offersFor(forest(), { unitId: "foe", event: "turnStart", offeredThisTurn: 1 });
    expect(rows).toEqual([]);
  });

  it("raises nothing on somebody ELSE's Turn", () => {
    // "During an affected Unit's Turn". Every affected Unit would otherwise be
    // offered an escape at the top of every Turn in the Round.
    const rows = offersFor(forest(), { unitId: "foe", event: "turnStart", activeFactionId: "other" });
    expect(rows).toEqual([]);
  });

  it("declining costs nothing", () => {
    // §27.5's default on expiry is "the option that spends nothing", and for an
    // OPTIONAL escape that is declining. A default that spent the attempt would
    // silently consume the one chance a Unit gets each Turn.
    expect(declineOutcome(forest())).toEqual({ spent: false });
  });

  it("a success zeroes the pool", () => {
    expect(forest().rules[0].onSuccess[0]).toMatchObject({ resource: "namelessForestTokens", set: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-forest.test.mjs -t "optional check offered"`
Expected: FAIL — no `OfferCheck` element.

- [ ] **Step 3: Build it**

An `OfferCheck` executor pushing onto a new `offeredChecks` bucket; a `turnStart` pass that turns each offer into a pending row for the units of the active faction only; and a handler in the pending panel that rolls the check with `checkPlan(unit, "luck")`'s modifiers folded in — which is how Task 1's ladder reaches this roll — and runs `onSuccess` when it passes.

Write the comment that says why it is not a grant:

```js
  /**
   * Offer the bearer an optional check on its own Turn.
   *
   * > *"During an affected Unit's Turn, it can attempt a Luck Check once per
   * > Turn to remove the effects of this NP from itself."*
   *
   * **Can**, not must — and nothing in the corpus offers a Unit an optional
   * roll on its own Turn. Every check today is either compulsory (an Evade in
   * the ladder) or attached to using something.
   *
   * NOT a `GrantedAbility`: that bucket is *"a closed list, because these are
   * the ones something in the engine actually asks about"* — capability ids
   * like `doubleMove`, not ability documents that appear on an action bar.
   *
   * Raised OUTSIDE the Combat Process, which is the whole of the risk. A prompt
   * inside the ladder is what hung `heelResolve`; this one has no rung to hang,
   * and §27.5's default on expiry — *"the option that spends nothing"* — is
   * declining, which is exactly right for an escape a Unit may decline.
   */
```

- [ ] **Step 4: Run and commit**

```bash
npm test && npm run lint
git add module/rules/elements.mjs module/engine/scheduler.mjs module/apps/hud/pending-panel.mjs test/unit/nursery-forest.test.mjs
git commit -F - <<'MSG'
feat(rules): an effect may offer its bearer an optional check

"During an affected Unit's Turn, it can attempt a Luck Check once per Turn to
remove the effects of this NP from itself." Can, not must -- and nothing in the
corpus offers a Unit an optional roll on its own Turn. Every check today is
either compulsory or attached to using something.

Not a GrantedAbility: that bucket is a closed list of capability ids that
something in the engine asks about, not ability documents on an action bar.

The affordance already existed. pending-present.mjs carries a luckCheck prompt
kind and routes a row to the owner of the unit being asked, and s27.5 fixes the
default on expiry as "the option that spends nothing" -- which for an optional
escape is declining, exactly right.

Raised outside the Combat Process. A prompt inside the ladder is what hung
heelResolve; this one has no rung to hang.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

# Phase 2 — her content

---

### Task 5: The Nameless Forest marker (F3–F15, R7)

**Files:**
- Create: `packs/_source/effects/nameless-forest.yml`

**Interfaces:**
- Consumes: Tasks 1–4 entire.
- Produces: an effect `namelessForest` carrying the token grant's writes, the escape offer, the death roll, and the compounding escape resistance.

- [ ] **Step 1: Write the failing test**

```js
describe("the Nameless Forest marker", () => {
  const f = () => effect("nameless-forest");

  it("is a STATUS, so ordinary buff-removal cannot strip it", () => {
    // Neither a buff nor a debuff in any useful sense, and a Noble Phantasm
    // whose whole counter-play is one Luck Check must not also fall to a
    // Cleanse.
    expect(f().polarity).toBe("status");
  });

  it("R1 - per token: 25, 10, 10, 1 - and NEVER 50 or 20", () => {
    const writes = f().rules.filter((r) => r.key === "StatDelta");
    const by = (stat) => writes.find((w) => w.stat === stat);
    expect(by("health.max")).toMatchObject({ delta: -25, alsoCurrent: true });
    expect(by("baseAttack.str").delta).toBe(-10);
    expect(by("baseAttack.mag").delta).toBe(-10);
    expect(by("luck.max")).toMatchObject({ delta: -1, alsoCurrent: true });
    for (const w of writes) expect([-25, -10, -1]).toContain(w.delta);
  });

  it("F10/F11 - both check modifiers, and both negative for the strong and the safe", () => {
    const mods = f().rules.filter((r) => r.key === "CheckModifier");
    const mag = mods.find((m) => m.table === "namelessForestEscape");
    expect(mag.rankFrom).toBe("@self.parameters.mag");
    const home = mods.find((m) => m.predicate?.includes("self:inHomeBase"));
    expect(home.value).toBe(-3);
  });

  it("F8 - the escape is OFFERED, once per Turn", () => {
    const offer = f().rules.find((r) => r.key === "OfferCheck");
    expect(offer).toMatchObject({ check: "luck", perTurn: 1 });
  });

  it("F9/R2 - a success removes the TOKENS and writes nothing back", () => {
    const offer = f().rules.find((r) => r.key === "OfferCheck");
    expect(offer.onSuccess.some((a) => a.key === "StatDelta")).toBe(false);
    expect(offer.onSuccess).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "ResourceDelta", resource: "namelessForestTokens", set: 0 }),
    ]));
  });

  it("F12 - the death roll fires at turnEnd, not roundEnd", () => {
    const roll = f().rules.find((r) => r.event === "turnEnd");
    expect(roll.roll).toBe("1d12");
  });

  it("R7 - each escape makes the next token 10% less likely, compounding", () => {
    // "the chance of it gaining Nameless Forest Tokens again is reduced by 10%
    // (base chance=100%); this effect can stack." A property of the UNIT, not
    // of the effect instance -- it survives losing every token.
    const offer = f().rules.find((r) => r.key === "OfferCheck");
    const resist = offer.onSuccess.find((a) => a.key === "ApplyEffect");
    expect(resist.effect.id).toBe("namelessForestResistance");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-forest.test.mjs -t "Nameless Forest marker"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# The marker the tokens hang from. It carries the escape offer, the death roll
# and the escape resistance; the TOKENS themselves are an ordinary §6.10 pool.
#
# `polarity: status`. It is neither a buff nor a debuff in any useful sense, and
# a Noble Phantasm whose entire counter-play is one Luck Check must not also
# fall to an ordinary Cleanse.
#
# THE FIGURES ARE THE ERRATA'D ONES. The sheet strikes through 50 and 20 in
# favour of 25 and 10; superseded text is not an alternative reading.
schema: 1
id: namelessForest
name: "Nameless Forest"
description: |
  For every Nameless Forest Token on this Unit, its Max Health is reduced by 25, both Base Attacks
  by 10, and its Max Luck by 1. Once per Turn during its own Turn it may attempt a Luck Check to
  remove every Token; Health and Luck already lost are not restored. At the end of its Turn, a Unit
  with at least 3 Tokens rolls a twelve-sided die and disappears on a roll at or below the count —
  unless it is within its Home Base.
polarity: status
volatility: nonVolatile
stacking: noneRefresh
baseChance: 100
rules:
  # THE WRITES. Not a MaxDelta contribution: "(Health and Luck that are lost
  # from the effects of this NP are not restored)". A contribution scaled by the
  # held token count would spring back the instant the tokens left, which is
  # precisely what that parenthesis forbids -- and it would look correct.
  #
  # `alsoCurrent` clamps the current value to the new ceiling rather than moving
  # it by the same delta, so a Unit at full Health does not sit above its own
  # maximum and a wounded one is not healed on the way down.
  - key: OnEvent
    event: resourceGained
    eventFilter: { resource: namelessForestTokens }
    automatic: true
    then:
      - { key: StatDelta, stat: "health.max", delta: -25, alsoCurrent: true }
      - { key: StatDelta, stat: "baseAttack.str", delta: -10 }
      - { key: StatDelta, stat: "baseAttack.mag", delta: -10 }
      - { key: StatDelta, stat: "luck.max", delta: -1, alsoCurrent: true }

  # THE LADDER. Read against the bearer's OWN MAG parameter, not against this
  # Noble Phantasm's Rank C -- which is what every other table in the corpus
  # does, and which would give 0 at every grade and silently do nothing.
  #
  # Signs as written: a high Rank escapes MORE easily, because resolveCheck
  # succeeds on `roll + mods <= target`.
  - { key: CheckModifier, check: luck, table: namelessForestEscape, rankFrom: "@self.parameters.mag" }

  # "(stacks with the MAG Rank modifiers as seen below)" -- a second modifier,
  # summed rather than replacing. A MAG EX Unit at home rolls at -6.
  #
  # And it points the same way the MAG rows do, which is the coherence check on
  # R3: the sheet separately refuses to delete a Unit at home.
  - { key: CheckModifier, check: luck, value: -3, predicate: ["self:inHomeBase"] }

  # THE ESCAPE. Offered, not compelled, once per Turn, on the bearer's own Turn.
  - key: OfferCheck
    check: luck
    perTurn: 1
    declineCosts: nothing
    onSuccess:
      # The tokens go. NOTHING is written back -- no StatDelta here, ever.
      - { key: ResourceDelta, resource: namelessForestTokens, set: 0 }
      - { key: RemoveEffect, effect: namelessForest, target: self }
      # "Every time a Unit successfully removes Nameless Forest Tokens from
      # itself, the chance of it gaining them again is reduced by 10% (base
      # chance=100%); this effect can stack."
      #
      # A property of the UNIT rather than of this instance, so it survives
      # losing every token and being caught again. Three escapes and the Unit
      # gains a token 70% of the time.
      - { key: ApplyEffect, target: self, effect: { id: namelessForestResistance }, duration: permanent }

  # THE DEATH ROLL. `turnEnd`, which fires for the units of the faction whose
  # Turn is ending -- "at the end of the UNIT'S Turn", not Nursery's, and not
  # the Round's.
  - key: OnEvent
    event: turnEnd
    automatic: true
    roll: "1d12"
    then:
      - { key: NamelessForestDeathRoll }
```

- [ ] **Step 4: The resistance effect**

`packs/_source/effects/nameless-forest-resistance.yml` — a permanent, stacking `ApplicationChance` of **−10** against `namelessForest`. Negative, because `rules/checks.mjs#applicationChance` computes `base + inflictBonus - resist`: a positive `resist` is what reduces the chance. Read that function before choosing the sign.

- [ ] **Step 5: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/effects/nameless-forest.yml packs/_source/effects/nameless-forest-resistance.yml test/unit/nursery-forest.test.mjs
git commit -F - <<'MSG'
feat(content): the Nameless Forest marker, and the resistance it leaves behind

polarity: status, because it is neither a buff nor a debuff in any useful sense
and a Noble Phantasm whose entire counter-play is one Luck Check must not also
fall to an ordinary Cleanse.

The stat reductions are WRITES. "(Health and Luck that are lost from the effects
of this NP are not restored)" -- a contribution scaled by the held token count
would spring back the instant the tokens left, and would look correct.

The escape ladder reads the bearer's own MAG parameter rather than this Noble
Phantasm's Rank C, which is what every other table in the corpus does and would
have given 0 at every grade.

The figures are the errata'd ones: 25 and 10, not the struck-through 50 and 20.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 6: The Noble Phantasm (F1, F2, F4, R8)

**Files:**
- Create: `packs/_source/abilities/nursery-nameless-forest.yml`
- Modify: `packs/_source/servants/nursery-rhyme.yml` (one ref)

- [ ] **Step 1: Write the failing test**

```js
describe("Nursery Rhyme: Nameless Forest (F1-F4)", () => {
  const a = () => ability("nursery-nameless-forest");

  it("F1 - Rank C, NP, Anti-Unit, and PASSIVE", () => {
    expect(a()).toMatchObject({ rank: "C", isNP: true, passive: true });
    expect(a().npTags).toEqual(["antiUnit"]);
  });

  it("F1 - passive, so it has no cooldown and no timing window", () => {
    // It is the only ability in either roster that wins by waiting. A cooldown
    // on it would be a cooldown on nothing.
    expect(a().cooldown ?? null).toBeNull();
    expect(a().timing ?? null).toBeNull();
  });

  it("R8/F2 - at the end of every ROUND, not every Turn", () => {
    // One token per Round per qualifying enemy. Fired at turnEnd instead, a
    // three-Turn Round would triple the rate and kill a Unit in a third of the
    // time.
    const rule = a().passiveRules[0];
    expect(rule.event).toBe("roundEnd");
  });

  it("F2 - all enemy Units within 2 panels of her", () => {
    const rule = a().passiveRules[0];
    expect(rule.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(rule.targeting.selection.relations).toEqual(["enemy"]);
  });

  it("F3 - each affected Unit gains ONE token, and the marker with it", () => {
    const rule = a().passiveRules[0];
    expect(rule.then).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "ResourceDelta", resource: "namelessForestTokens", delta: 1 }),
      expect.objectContaining({ key: "ApplyEffect", effect: { id: "namelessForest" } }),
    ]));
  });

  it("F4 - does not occur while Nursery carries NP Seal", () => {
    const rule = a().passiveRules[0];
    expect(rule.predicate).toContain("!self:effect:npSeal");
  });

  it("her Servant file gains exactly one ref", () => {
    expect(servant("nursery-rhyme").abilities).toContainEqual({ ref: "nursery-nameless-forest" });
  });
});
```

The `!self:effect:npSeal` spelling is a negation in the predicate grammar. **Check it** — `grep -n "npSeal" packs/_source/abilities/*.yml` finds how another sheet says "does not occur while sealed" — and use whichever form the grammar carries.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-forest.test.mjs -t "Nameless Forest (F1"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# A Noble Phantasm that is PASSIVE, CONTINUOUS, and kills by accumulation. The
# only ability in either roster that wins by waiting, and the only thing that
# can remove a Unit with no attack, no roll to hit and no counter-play beyond a
# Luck Check.
#
# Its gates -- the 2-panel ring, the 3-token threshold, the Home Base exemption
# and this NP Seal clause -- are the whole of its balance, and every one of them
# is a separate clause that has to actually fire.
schema: 1
id: nursery-nameless-forest
name: "Nursery Rhyme: Nameless Forest"
rank: C
isNP: true
categorizedAsNP: true
npTags: [antiUnit]
kind: noblePhantasm
passive: true
description: |
  (Passive) At the end of every Round, this NP affects all enemy Units within a 2 panel area of
  Nursery. Each time a Unit is affected, it gains one @effect[namelessForest]{Nameless Forest} Token;
  this does not occur if Nursery is inflicted with @effect[npSeal]{NP Seal}.
passiveRules:
  # "At the end of every ROUND" -- one token per Round per qualifying enemy.
  # Fired at `turnEnd` instead, a three-Turn Round would triple the rate and
  # kill a Unit in a third of the time.
  - key: OnEvent
    event: roundEnd
    automatic: true
    # "this effect does not occur if Nursery is inflicted with NP Seal" -- on
    # HER, not on the target, which is why it is a `self:` predicate on a rule
    # whose targeting reaches somebody else.
    predicate: ["!self:effect:npSeal"]
    targeting:
      anchor: { kind: self }
      shape: { kind: chebyshevRadius, r: 2 }
      selection: { relations: [enemy], chooser: all }
    then:
      # The marker first, so the write-handler it carries is in place before the
      # token that triggers it arrives. Reversed, the first token of a Unit's
      # stack would take no stats at all.
      - { key: ApplyEffect, target: affected, effect: { id: namelessForest }, duration: permanent }
      - { key: ResourceDelta, target: affected, resource: namelessForestTokens, delta: 1 }
```

**The ordering comment in that last block is load-bearing.** Confirm on the live board (Task 7) that a Unit's **first** token takes 25 Health — if the marker and the token land in the wrong order, only the second and later tokens will write, and the Noble Phantasm will be quietly 25 Health per Unit weaker than the sheet.

- [ ] **Step 4: Add the ref**

```yaml
  # Part 3.
  - { ref: nursery-nameless-forest }
```

and update the ability-count assertion in `test/unit/nursery.test.mjs` to match whatever it now is (10 if Part 2 is not yet built, 12 if it is — **read the file, do not assume which parts have landed**, since Part 3 is independent of Part 2).

- [ ] **Step 5: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/nursery-nameless-forest.yml packs/_source/servants/nursery-rhyme.yml test/unit/nursery.test.mjs test/unit/nursery-forest.test.mjs
git commit -F - <<'MSG'
feat(content): Nursery Rhyme: Nameless Forest

A Noble Phantasm that is passive, continuous, and kills by accumulation -- the
only ability in either roster that wins by waiting.

At the end of every ROUND, not every Turn. Fired at turnEnd instead, a
three-Turn Round would triple the rate and kill a Unit in a third of the time.

The marker is applied before the token that triggers its writes. Reversed, the
first token of every Unit's stack would take no stats at all, and the Noble
Phantasm would be quietly 25 Health per Unit weaker than the sheet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 7: Documentation and the live board

**Files:**
- Modify: `docs/05-ranks-and-parameters.md`, `docs/06-stats-and-resources.md`, `docs/14-checks-and-randomness.md`, `docs/44-case-expanded-roster.md`, `docs/45-implementation-status.md`, `docs/A-effect-catalogue.md`, `CHANGELOG.md`

- [ ] **Step 1: Document**

- **Ch. 05** — a rank table may now be indexed by a *target's* parameter, and this is the first that is.
- **Ch. 06 §6.10** — `namelessForestTokens` beside the PRS Tokens and the Fragarach Counters; and the distinction this part draws between a pool that *contributes* and one that *writes*.
- **Ch. 14** — `OfferCheck`, and why the default on declining spends nothing.
- **Ch. 44** — a Nameless Forest section: the errata, the sign question, and why R2 is expressed the way it is.
- **Appendix A** — `Nameless Forest` and `Nameless Forest Resistance` rows.
- **Ch. 45** — Part 3 of 4 built.
- **`CHANGELOG.md`** — an `## [Unreleased]` entry.

- [ ] **Step 2: Bring the world up**

```bash
node tools/fgt-world.mjs shutdown
npm run build:packs
node tools/fgt-world.mjs launch
```

Then join as Gamemaster over CDP. Launch fails with no Foundry tab open — open one first.

- [ ] **Step 3: Walk the inventory**

Every clause gets an observation, not an inference.

- [ ] **F2/R8** — an enemy standing in her 2-panel ring collecting **one** token at Round end, and **one** per Round rather than one per Turn. Watch a full Round of several Turns.
- [ ] **F5/F6/F7/R1** — its sheet showing Max Health **25** lower, both Base Attacks **10** lower, Max Luck **1** lower. **Read all four numbers.** Not 50, not 20.
- [ ] **F3 ordering** — the **first** token taking those stats, not the second. This is the failure the authoring comment warns about.
- [ ] **F4** — `NP Seal` on Nursery, and a Round passing with **no** token gained.
- [ ] **F8/E4** — the escape offered on the affected Unit's **own** Turn, once, and not on anybody else's.
- [ ] **F10/R3** — the Luck Check card showing **−2** for a MAG A Unit and **+2** for a MAG E one. Two different Units; this is the ruling the whole Noble Phantasm turns on.
- [ ] **F11/R4** — the same Unit at home showing **−3 more**, summed.
- [ ] **F9/R2 — the check that matters most.** A successful escape, and then the Unit's sheet: **tokens at zero, and Max Health, both Base Attacks and Max Luck exactly where the tokens left them.** Not restored.
- [ ] **F12/F13** — a three-token Unit rolling a d12 at the end of **its own** Turn, and a two-token Unit not rolling at all.
- [ ] **F14/R6** — the same three-token Unit **at home**, rolling, rolling low, and **surviving**. The roll must be visible in the log.
- [ ] **R7** — a Unit that has escaped three times gaining its next token about **70%** of the time. Its sheet should show the resistance stacked three deep.

- [ ] **Step 4: Fix what the board disagrees with**

Any clause that misbehaves is a bug in this implementation, not in the sheet. Fix it, add the unit test that would have caught it, re-verify.

- [ ] **Step 5: Final commit**

```bash
npm test && npm run lint && npm run validate:content
git add -A
git commit -F - <<'MSG'
test(content): Nameless Forest, verified on a live board

Every clause of the inventory observed rather than inferred -- above all the
one a passing test is least likely to catch: a Unit that escapes, and whose Max
Health, Base Attacks and Max Luck stay exactly where the tokens left them.

The MAG ladder was read off two different Units, one at A and one at E, because
its sign is the ruling the whole Noble Phantasm turns on and a single reading
cannot show a direction.

[Record here what the board disagreed with, and what was fixed.]

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

## Self-review notes

**Spec coverage.** R1 Tasks 2 and 5; R2 Tasks 2, 5 and 7; R3/R4 Tasks 1, 5 and 7; R5 Task 3; R6 Tasks 3 and 7; R7 Tasks 5 and 7; R8 Tasks 6 and 7. E1 Task 2; E2 Task 1; E3 Task 3; E4 Task 4. Every one of §5's fifteen rows has a task: F1/F2/F4 Task 6; F3/F5/F6/F7/F9 Tasks 2 and 5; F8 Tasks 4 and 5; F10/F11 Tasks 1 and 5; F12/F13/F14 Tasks 3 and 5; F15 Task 5.

**Task order is dependency order.** Task 1's table is read by Task 5's content; Task 2's writes are what Task 5 authors; Tasks 3 and 4 are independent of each other and of Tasks 1–2; Task 6 needs Task 5. Nothing earlier depends on anything later.

**Type consistency.** `namelessForestEscape` and `HOME_BASE_ESCAPE_MODIFIER` are defined in Task 1 and read in Tasks 1 and 5. `rankFrom: "@self.parameters.mag"` is the same string in Tasks 1 and 5. `deathRollOutcome({tokens, roll, inHomeBase})` is defined in Task 3 and called only from the element Task 5 authors. The pool is `namelessForestTokens` in Tasks 2, 5 and 6; the marker is `namelessForest` in Tasks 5 and 6; the resistance is `namelessForestResistance` in Task 5.

**One fork in the road, stated rather than assumed.** Task 2 Step 4 says explicitly that if `baseAttack` turns out to be *derived* from the parameter tables rather than stored, a write to it is recomputed away on the next prepare and the task must instead write to a delta the derivation subtracts. That question is settled with a `grep` before Task 5 is authored, because discovering it afterwards means rewriting the effect file.

**Three spellings deliberately left to their task, each with a stated check:** `scalar(null)`'s coercion (Task 1 Step 4 — the difference between "no contribution" and "MAG C"), `applicationChance`'s sign for the resistance (Task 5 Step 4), and the negation form for `!self:effect:npSeal` (Task 6 Step 1). Each names what to read.

**The check the whole part is arranged around** is Task 7's F9/R2 observation. Every other clause here can be got right by an implementer who has misread R2; that one cannot.
