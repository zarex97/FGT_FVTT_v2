# Master Rank and Field Painting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a Master's rank a way to be set and a reason to exist (ZON, Sustainability, a parameter grant, and Jack's Mist exemption), and let a freeform bounded field be redrawn on the canvas.

**Architecture:** One new pure module derives a `high｜low｜rankless` tier from the existing letter grade; the two cost readers keep their behaviour and only change which file they import from. The painter is a fifth interaction mode on the existing `TargetingLayer`, which draws and never decides — the legality half lives in `rules/bounded-fields.mjs` and is re-checked GM-side at commit. A prerequisite bug fix makes a field's Region store its exact panels instead of their bounding rectangle.

**Tech Stack:** Foundry VTT v14, ES modules, vitest, PIXI 7.4.3. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md`](../specs/2026-09-02-master-rank-and-field-painting-design.md)

## Global Constraints

- **Layer rule, enforced by `tools/check-layers.mjs`.** Layer 1 `domain/` → 2 `rules/` (pure) → 3 `engine/` → 4 `apps/`. Nothing in `module/domain` or `module/rules` may touch `game`, `ui`, `canvas`, `CONFIG`, `CONST`, `Hooks`, `foundry`, `fgt`, `window`, `document` or `PIXI` — ESLint's `no-restricted-globals` fails the build.
- **Every check must pass before each commit:** `npm run lint` (ESLint + layer check), `npx vitest run`, `npm run validate:content`, `npm run check:manifest`.
- **Test files** live at `test/unit/<name>.test.mjs` and use `import { describe, it, expect } from "vitest"`. Run one file with `npx vitest run test/unit/<name>.test.mjs`.
- **Content is authored in `packs/_source/**.yml`** and compiled with `npm run build:packs`. The built `packs/*/` directories are gitignored — never commit them. **The world must be shut down before `build:packs`**, or LevelDB throws `EBUSY`.
- **Styles** are compiled: edit `styles/src/*.scss` and run `npm run build:styles`. `styles/fgt.css` is generated and gitignored.
- **Never delete an authored field without a reader.** This codebase's signature defect is content that compiles and does nothing; if a task adds a schema field, that same task adds its consumer.
- **Existing behaviour in `rules/costs.mjs` and `rules/command-spells.mjs` is CORRECT.** `if (!rank) return true` implements Ch. 15 §15.4 (*"Rankless Masters use the left column"*). Task 2 is a behaviour-preserving de-duplication. An implementer who makes Rankless pay the Low column has broken the rules.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S
  ```

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `module/rules/master-rank.mjs` | Pure. Derive a Master's tier from its letter grade; the grant budget. |
| `test/unit/master-rank.test.mjs` | Tier derivation, the two price predicates, grant budget. |
| `test/unit/field-painting.test.mjs` | `legalRepaint`, `mayReshape`, the grid-shape round trip. |

**Modified**

| File | Change |
|---|---|
| `module/engine/fields.mjs` | `shapeOf` → grid shape; new `repaintField`. |
| `module/data/actor/master.mjs` | `rank` gains `choices` and an explicit `null`. |
| `module/rules/costs.mjs` | Delete local `isHighRankMaster`/`HIGH_RANK_MASTER`; import `paysHighColumn`. |
| `module/rules/command-spells.mjs` | Same. |
| `module/rules/setup-rolls.mjs` | `coinFlip` mode emits a `rank` line; Base Attack (MAG) derives from it. |
| `module/engine/summon.mjs` | Write the rolled rank to `system.rank`; derive `masterGrants` budget. |
| `module/apps/actor-sheet/context.mjs` | `masterContext` projects `rank` + `tier`. |
| `templates/actor/details.hbs` | Rank `<select>`. |
| `module/rules/zon.mjs` | High Rank `+1`, stacking. |
| `module/rules/snapshot.mjs` | Project `masterTier`; new `annotateMasterGrants` pass for Sustainability. |
| `module/rules/options.mjs` | Emit `(self｜target):masterTier:<t>`. |
| `module/rules/bounded-fields.mjs` | `isExempt` gains `masterTier`; new `legalRepaint`, `mayReshape`. |
| `module/data/actor/_shared.mjs` | `turnState.reshapedField`. |
| `module/apps/canvas/targeting-layer.mjs` | Mode E: `paintPanels`. |
| `module/apps/hud/token-hud.mjs` | Reshape button. |
| `module/engine/scheduler-hooks.mjs` | End-of-turn reshape prompt. |
| `packs/_source/abilities/jack-the-mist.yml` | `exemptIf: { masterTier: high }` on the Master contact clause. |
| `lang/en.json` | New strings. |
| `docs/…` | Chapters 04, 06, 16, 28, 43, 45; `CHANGELOG.md`. |

---

## Task 1: A field's Region stores its exact panels

The prerequisite. `shapeOf` builds a bounding rectangle; `boundedFieldsOf` reads panels back off the Region; so a non-rectangular footprint is silently squared off. Invisible today because every field in the corpus is a square.

**Files:**
- Modify: `module/engine/fields.mjs` (`shapeOf`, ~line 266)
- Test: `test/unit/field-painting.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `shapeOf(panels, scene) -> {type: "grid", offsets: Array<{i,j}>, origin: null}`

- [ ] **Step 1: Write the failing test**

Create `test/unit/field-painting.test.mjs`:

```js
/**
 * Redrawing a bounded field, and the storage that has to survive it.
 * @see docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md
 */
import { describe, it, expect } from "vitest";
import { shapeOf } from "../../module/engine/fields.mjs";

const scene = { grid: { size: 100 } };

describe("shapeOf — a field's stored geometry", () => {
  it("keeps an L-shape's exact panels instead of its bounding box", () => {
    // The whole point. A rectangle would fill in {i:1,j:1} and the board
    // would read a 2x2 where the author drew an L.
    const panels = [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }];
    const shape = shapeOf(panels, scene);

    expect(shape.type).toBe("grid");
    expect(shape.offsets).toEqual(panels);
    expect(shape.offsets).toHaveLength(3);
  });

  it("anchors at absolute board offsets, not deltas", () => {
    // `origin: null` is what makes the offsets absolute -- the resolver works
    // in whole-board panels, and a relative origin would shift the field.
    expect(shapeOf([{ i: 4, j: 7 }], scene).origin).toBeNull();
  });

  it("still describes a square exactly", () => {
    const square = [];
    for (let i = 2; i <= 4; i++) for (let j = 2; j <= 4; j++) square.push({ i, j });
    expect(shapeOf(square, scene).offsets).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/field-painting.test.mjs`

Expected: FAIL — `shapeOf` is not exported, so the import is `undefined`.

- [ ] **Step 3: Export and rewrite `shapeOf`**

In `module/engine/fields.mjs`, replace the whole `shapeOf` function (it currently returns a `rectangle`) with:

```js
/**
 * The Region shape that stores a field's panels.
 *
 * A **grid** shape with explicit offsets, not the bounding rectangle this used
 * to return. `engine/board.mjs#boundedFieldsOf` reads a field's panels back
 * OFF its Region (`panelsOfRegion`, which prefers
 * `getOccupiedGridSpaceOffsets()`), so a rectangle meant the stored panel set
 * was discarded on every board read and replaced by its own bounding box.
 *
 * That was invisible while every field in the corpus was a square, where the
 * two are the same set. It stops being invisible the moment anything paints an
 * L. `apps/canvas/target-region.mjs#gridShape` has always done it this way for
 * transient targeting areas; fields simply never did.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @param {object} scene unused, kept so the call site does not change
 * @returns {{type: string, offsets: Array<{i: number, j: number}>, origin: null}}
 */
export function shapeOf(panels, scene) {  // eslint-disable-line no-unused-vars
  return {
    type: "grid",
    offsets: panels.map((p) => ({ i: p.i, j: p.j })),
    // Null anchors at the first offset, which is already an absolute board
    // position -- fields work in absolute panels, never in deltas.
    origin: null,
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/field-painting.test.mjs`

Expected: PASS, 3 tests.

- [ ] **Step 5: Full checks**

Run: `npm run lint && npx vitest run && npm run validate:content`

Expected: all pass, 2130+ tests.

- [ ] **Step 6: Verify in the live world that existing fields still read the same panels**

The two fields in the corpus are squares, so their panel sets must not move. With the world running:

```
node tools/fgt-reload.mjs
```

Then evaluate (via `tools/fgt-eval.mjs`, or the scratchpad `ev.mjs` pinned to the Foundry tab):

```js
const { currentBoard } = await import('/systems/fgt/module/engine/board.mjs');
return JSON.stringify(currentBoard().fields.map(f => ({
  id: f.id, panels: f.panels.length,
  shape: canvas.scene.regions.get(f.regionId)?.shapes?.[0]?.type,
})), null, 1);
```

Expected: any existing field still reports the same panel count it had before. A newly cast field reports `shape: "grid"`.

- [ ] **Step 7: Commit**

```bash
git add module/engine/fields.mjs test/unit/field-painting.test.mjs
git commit -m "Store a bounded field's exact panels, not their bounding box

\`shapeOf\` built the Region as a rectangle around the field's panels while
\`boundedFieldsOf\` reads the panels back off the Region -- so the stored set
was discarded on every board read and replaced by its own bounding box.
Invisible while every field in the corpus is a square; it fills in the
notch the moment anything is painted as an L.

\`target-region.mjs#gridShape\` has always done this correctly for transient
targeting areas, and \`panelsOfRegion\` already prefers
\`getOccupiedGridSpaceOffsets()\`, which enumerates a grid shape exactly.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S"
```

---

## Task 2: A Master's rank can be set, and the coin flip keeps it

**Files:**
- Create: `module/rules/master-rank.mjs`, `test/unit/master-rank.test.mjs`
- Modify: `module/data/actor/master.mjs:15`, `module/rules/costs.mjs` (lines 22–24 and 264–285), `module/rules/command-spells.mjs` (lines 44–45 and 330–344), `module/rules/setup-rolls.mjs` (`baseAttackLine`, ~line 137), `module/engine/summon.mjs` (~line 219), `module/apps/actor-sheet/context.mjs` (`masterContext`, line 61), `templates/actor/details.hbs`, `lang/en.json`

**Interfaces:**
- Consumes: `Rank.parseOrNull(string|null) -> Rank|null` and `Rank#grade -> string` from `module/domain/rank.mjs`.
- Produces:
  - `tierOf(master) -> "high"|"low"|"rankless"`
  - `isHighRank(master) -> boolean`
  - `isRankless(master) -> boolean`
  - `paysHighColumn(master) -> boolean` — `tierOf() !== "low"`
  - `grantBudget(master) -> number` — parameter steps a Master may grant (1 for High, else 0)
  - `HIGH_GRADES: readonly string[]`

- [ ] **Step 1: Write the failing test**

Create `test/unit/master-rank.test.mjs`:

```js
/**
 * A Master's rank, and the two different questions asked of it.
 * @see docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md §2
 */
import { describe, it, expect } from "vitest";
import {
  tierOf, isHighRank, isRankless, paysHighColumn, grantBudget,
} from "../../module/rules/master-rank.mjs";

const master = (rank) => ({ id: "m1", kind: "master", rank });

describe("tierOf", () => {
  it("reads A and B as High", () => {
    expect(tierOf(master("A"))).toBe("high");
    expect(tierOf(master("B"))).toBe("high");
  });

  it("reads C and D as Low", () => {
    expect(tierOf(master("C"))).toBe("low");
    expect(tierOf(master("D"))).toBe("low");
  });

  it("reads an absent, blank or unparseable rank as Rankless", () => {
    // A world that predates the `choices` list stores "", and a typo stores
    // junk. Both are Rankless -- which is a real state, not an error.
    expect(tierOf(master(null))).toBe("rankless");
    expect(tierOf(master(""))).toBe("rankless");
    expect(tierOf(master("Rank A"))).toBe("rankless");
    expect(tierOf(undefined)).toBe("rankless");
  });
});

describe("the two price questions", () => {
  it("pays the High column for High AND Rankless", () => {
    // Ch. 15 §15.4: "Rankless Masters use the left column." The right column
    // is the Low Rank penalty, not the default -- this is the behaviour the
    // two cost readers already had, moved rather than changed.
    expect(paysHighColumn(master("A"))).toBe(true);
    expect(paysHighColumn(master(null))).toBe(true);
    expect(paysHighColumn(master("C"))).toBe(false);
  });

  it("keeps High Rank distinct from paying the High column", () => {
    // A Rankless Master pays the cheap price and gets none of a High Rank
    // Master's benefits. One predicate for both would be wrong.
    expect(paysHighColumn(master(null))).toBe(true);
    expect(isHighRank(master(null))).toBe(false);
    expect(isRankless(master(null))).toBe(true);
  });
});

describe("grantBudget", () => {
  it("gives a High Rank Master one parameter step and everyone else none", () => {
    expect(grantBudget(master("B"))).toBe(1);
    expect(grantBudget(master("C"))).toBe(0);
    expect(grantBudget(master(null))).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: FAIL — cannot resolve `../../module/rules/master-rank.mjs`.

- [ ] **Step 3: Write the module**

Create `module/rules/master-rank.mjs`:

```js
/**
 * @file A Master's rank, and what it buys.
 * @see docs/04-units.md §4.5, docs/15-abilities.md §15.4, docs/17-command-spells.md
 *
 * Layer 2. Pure.
 *
 * The stored value is a LETTER (Ch. 04: Masters are A–D) because that is what
 * a character sheet prints. Every rule in the corpus asks a coarser question —
 * High, Low, or Rankless — so the tier is derived here, once, rather than by
 * each reader parsing the grade for itself. Two copies of that parse already
 * existed, in `rules/costs.mjs` and `rules/command-spells.mjs`, and this
 * replaces both.
 *
 * `paysHighColumn` and `isHighRank` look like the same predicate and are not.
 * A **Rankless** Master pays the cheaper Noble Phantasm price (Ch. 15 §15.4:
 * *"Rankless Masters use the left column"* — the right column is the Low Rank
 * penalty, not the default) while getting none of a High Rank Master's
 * benefits. Collapsing them would either overcharge Rankless Masters or hand
 * them a ZON they have not earned.
 */

import { Rank } from "../domain/rank.mjs";

/** The grades that count as High Rank (Ch. 04 §4.5). */
export const HIGH_GRADES = Object.freeze(["A", "B"]);

/**
 * Which tier this Master belongs to.
 *
 * An absent, blank or unparseable rank is **Rankless**, which is a real state
 * with its own rules rather than a missing value.
 *
 * @param {object|null|undefined} master
 * @returns {"high"|"low"|"rankless"}
 */
export function tierOf(master) {
  const rank = Rank.parseOrNull(master?.rank ?? null);
  if (!rank) return "rankless";
  return HIGH_GRADES.includes(rank.grade) ? "high" : "low";
}

/** @param {object|null|undefined} master @returns {boolean} */
export function isHighRank(master) {
  return tierOf(master) === "high";
}

/** @param {object|null|undefined} master @returns {boolean} */
export function isRankless(master) {
  return tierOf(master) === "rankless";
}

/**
 * Whether this Master pays the LEFT (cheaper) column.
 *
 * High and Rankless both do. This is exactly the behaviour the two cost
 * readers already had; it is moved here, not changed.
 *
 * @param {object|null|undefined} master
 * @returns {boolean}
 */
export function paysHighColumn(master) {
  return tierOf(master) !== "low";
}

/**
 * How many parameter steps this Master may grant its Servant at summon.
 *
 * *"High Rank Masters additionally grant … a free `+` to one of their
 * Servant's Parameters"* (Ch. 04 §4.5). The summon dialog already offers the
 * CHOICE of which parameter; this is the allowance it spends against, which
 * nothing enforced before.
 *
 * @param {object|null|undefined} master
 * @returns {number}
 */
export function grantBudget(master) {
  return isHighRank(master) ? 1 : 0;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the regression test that proves the de-duplication changes nothing**

Append to `test/unit/master-rank.test.mjs`:

```js
import { npCostAt } from "../../module/rules/costs.mjs";
import { costOf } from "../../module/rules/command-spells.mjs";

describe("de-duplication is behaviour-preserving", () => {
  const servant = { id: "s1", kind: "servant", contract: "contracted", sustainability: 6 };
  const killYourself = { cost: 2, costByMasterRank: { high: 1, low: 2 } };

  it.each([
    ["A", "high"], ["B", "high"], ["C", "low"], ["D", "low"], [null, "rankless"], ["", "rankless"],
  ])("Noble Phantasm cost for a %s Master is unchanged", (rank) => {
    const cost = npCostAt({ rank: "A", unit: servant, master: master(rank) });
    // Rank A NP: 50 on the High column, 60 on the Low one (Ch. 15 §15.4).
    expect(cost.amount).toBe(tierOf(master(rank)) === "low" ? 60 : 50);
  });

  it("Kill Yourself is 1 for High, 2 for Low, 1 for Rankless", () => {
    expect(costOf(killYourself, master("A"))).toBe(1);
    expect(costOf(killYourself, master("C"))).toBe(2);
    expect(costOf(killYourself, master(null))).toBe(1);
  });

  it("Kill Yourself is 1 for everyone when the whole table is Rankless", () => {
    expect(costOf(killYourself, master("C"), { allMastersRankless: true })).toBe(1);
  });
});
```

- [ ] **Step 6: Run it — it must pass BEFORE the de-duplication**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: PASS. This is the point — the test captures today's behaviour so the refactor cannot change it. If it fails now, the assertions are wrong, not the code.

- [ ] **Step 7: De-duplicate**

In `module/rules/costs.mjs`: delete the `HIGH_RANK_MASTER` constant (lines 22–24) and the local `isHighRankMaster` function (lines 264–285, including its JSDoc), and add the import beside the others at the top:

```js
import { paysHighColumn } from "./master-rank.mjs";
```

Change the one call site in `npCostAt`:

```js
  return {
    kind: "masterHealth",
    amount: paysHighColumn(master) ? high : low,
    unitId: master?.id ?? null,
  };
```

In `module/rules/command-spells.mjs`: delete `HIGH_RANK_MASTER` (lines 44–45) and the local `isHighRankMaster` (lines 330–344), add the same import, and change the call site in `costOf`:

```js
  return paysHighColumn(master) ? variant.high : variant.low;
```

- [ ] **Step 8: Run everything — the regression test must still pass**

Run: `npm run lint && npx vitest run`

Expected: PASS. If any assertion in "de-duplication is behaviour-preserving" fails, the refactor changed behaviour — revert it rather than adjusting the test.

- [ ] **Step 9: Give the schema a vocabulary**

In `module/data/actor/master.mjs`, replace line 15:

```js
      // A–D (Ch. 04 §4.5), or `null` for Rankless — a real state with its own
      // rules, not a missing value. `choices` is what stops a typo ("high",
      // "Rank A") parsing to null and silently reading as Rankless.
      rank: new fields.StringField({
        required: false, nullable: true, initial: null, blank: true,
        choices: ["", "A", "B", "C", "D"],
      }),
```

- [ ] **Step 10: Put a control on the sheet**

In `templates/actor/details.hbs`, add beside the other `fgt-field` labels:

```handlebars
      {{#if details.isMaster}}
      <label class="fgt-field">
        <span>{{localize "FGT.Sheet.MasterRank"}}</span>
        <select name="system.rank">
          <option value="" {{#unless system.rank}}selected{{/unless}}>
            {{localize "FGT.MasterRank.rankless"}}
          </option>
          {{#each details.rankChoices as |grade|}}
          <option value="{{grade}}" {{#if (eq ../system.rank grade)}}selected{{/if}}>{{grade}}</option>
          {{/each}}
        </select>
        <span class="fgt-field__hint">{{localize details.masterTierLabel}}</span>
      </label>
      {{/if}}
```

In `module/apps/actor-sheet/context.mjs`, inside `masterContext`'s returned object, add:

```js
    // The letter the sheet prints, and what it buys — both, because a GM
    // setting "C" needs to see that it means Low Rank without looking it up.
    rankChoices: [...HIGH_GRADES, "C", "D"],
    masterTierLabel: `FGT.MasterRank.${tierOf(master.system)}`,
```

and import at the top of the file:

```js
import { tierOf, HIGH_GRADES } from "../../rules/master-rank.mjs";
```

Add `isMaster: master.type === "master"` wherever `details` is assembled for the template (the `details` context block), so the field only renders on a Master.

- [ ] **Step 11: Add the strings**

In `lang/en.json`, beside the other `FGT.Sheet.*` keys:

```json
  "FGT.Sheet.MasterRank": "Rank",
  "FGT.MasterRank.high": "High Rank — ZON +1, Sustainability +1◈, one Parameter step",
  "FGT.MasterRank.low": "Low Rank",
  "FGT.MasterRank.rankless": "— (Rankless)",
```

- [ ] **Step 12: Make the coin flip keep its answer**

In `module/rules/setup-rolls.mjs`, replace `baseAttackLine`'s `coinFlip` branch and add a rank line. Replace the whole `coinFlip` block with:

```js
  if (mode === "coinFlip") {
    // Ch. 14 §14.9: "Heads=High Rank, Tails=Low Rank." The coin decides the
    // RANK, and Base Attack (MAG) follows from it -- this used to map the 1d2
    // straight onto [125, 100] and throw the rank away, leaving a Master with
    // 125 who was Rankless for ZON, Sustainability, the parameter grant and
    // the Kill Yourself price.
    return {
      id: "rank", label: "Rank", base: 0,
      roll: { formula: "1d2", map: ["A", "C"] },
      note: "heads = High Rank",
    };
  }
```

and have `masterSetupPlan` derive the Base Attack line from the resolved rank rather than listing both. In `masterSetupPlan`, replace `baseAttackLine(sheet, mode)` with:

```js
      ...(mode === "coinFlip" ? [baseAttackLine(sheet, mode)] : [baseAttackLine(sheet, mode)]),
      ...(mode === "coinFlip" ? [] : []),
```

**No** — keep it simple and explicit instead. Replace the `lines` array entry with:

```js
      baseAttackLine(sheet, mode),
      ...(mode === "coinFlip" ? [rankLine()] : []),
```

and add:

```js
/**
 * The rank line, for the mode where a coin decides it.
 *
 * Ch. 14 §14.9: *"you can still determine High Rank or Low Rank Masters by
 * Flipping a Coin for each Master; Heads=High Rank, Tails=Low Rank."* `A` and
 * `C` are the representatives of the two tiers — the rulebook names the tier,
 * not the letter, and any A/B or C/D would do.
 *
 * @returns {object}
 */
function rankLine() {
  return { id: "rank", label: "Rank", base: null, roll: { formula: "1d2", map: ["A", "C"] } };
}
```

and change `baseAttackLine`'s `coinFlip` branch to read the rank the coin just produced instead of rolling its own:

```js
  if (mode === "coinFlip") {
    // Derived from the `rank` line above, so the two cannot disagree: a
    // Master with 125 and no rank is now unrepresentable.
    return { id: "baseAttackMag", label, base: 0, derivedFrom: "rank",
             map: { A: 125, B: 125, C: 100, D: 100 } };
  }
```

- [ ] **Step 13: Test the coin flip**

Append to `test/unit/master-rank.test.mjs`:

```js
import { masterSetupPlan } from "../../module/rules/setup-rolls.mjs";

describe("the coin flip keeps the rank it determines", () => {
  it("emits a rank line in coinFlip mode", () => {
    const plan = masterSetupPlan({}, { mode: "coinFlip" });
    const rank = plan.lines.find((l) => l.id === "rank");
    expect(rank).toBeDefined();
    expect(rank.roll.map).toEqual(["A", "C"]);
  });

  it("does not in the other two modes", () => {
    for (const mode of ["essences", "rankless"]) {
      expect(masterSetupPlan({}, { mode }).lines.find((l) => l.id === "rank")).toBeUndefined();
    }
  });

  it("derives Base Attack (MAG) from the rank rather than rolling it again", () => {
    const line = masterSetupPlan({}, { mode: "coinFlip" }).lines
      .find((l) => l.id === "baseAttackMag");
    expect(line.derivedFrom).toBe("rank");
    expect(line.map.A).toBe(125);
    expect(line.map.C).toBe(100);
  });
});
```

- [ ] **Step 14: Write the rolled rank to the actor**

In `module/engine/summon.mjs`'s `rollMasterSetup` (~line 219), after `resolveSetupPlan` produces `lines`, include the rank in the patch written to the actor. Find where the resolved lines become a document update and add:

```js
  // The rank the coin decided, kept. Base Attack (MAG) is derived from it by
  // `baseAttackLine`, so writing the rank writes both.
  const rankLine = lines.find((l) => l.id === "rank");
  if (rankLine) patch.rank = rankLine.value;
```

- [ ] **Step 15: Run every check**

Run: `npm run lint && npx vitest run && npm run validate:content && npm run check:templates && npm run check:manifest`

Expected: all pass.

- [ ] **Step 16: Verify live**

Reload (`node tools/fgt-reload.mjs`), open a Master's sheet, set the rank to `B`, and confirm:

```js
const m = game.actors.find(a => a.type === 'master');
const { tierOf } = await import('/systems/fgt/module/rules/master-rank.mjs');
return JSON.stringify({ rank: m.system.rank, tier: tierOf(m.system) });
```

Expected: `{"rank":"B","tier":"high"}`. Then set it to blank and confirm `rankless`.

- [ ] **Step 17: Commit**

```bash
git add module/rules/master-rank.mjs test/unit/master-rank.test.mjs module/rules/costs.mjs \
        module/rules/command-spells.mjs module/data/actor/master.mjs module/rules/setup-rolls.mjs \
        module/engine/summon.mjs module/apps/actor-sheet/context.mjs templates/actor/details.hbs \
        lang/en.json
git commit -m "Give a Master's rank a way to be set, and let the coin flip keep it

The pricing that reads the rank was already correct -- both cost readers
treat Rankless as paying the left column, which is Ch. 15 §15.4, and the
all-Rankless Kill Yourself rule is implemented and tested. What was
missing was everything around it.

Nothing could SET a rank: a free-form StringField with no choices and no
control on the sheet, so the only way to rank a Master was to hand-edit
the document, and a typo read as Rankless.

Worse, the coin flip that DETERMINES the rank threw it away.
\`setup-rolls.mjs\` mapped its 1d2 straight onto Base Attack (MAG)
125/100 with the note that \"the rank exists here only to select it\" --
but the rank also decides ZON, Sustainability, the parameter grant and
the Kill Yourself price, so a table that flipped Heads got a Master with
125 who was Rankless for every other rule in the game. The coin now
picks the rank and Base Attack derives from it, so the two cannot
disagree.

The two duplicated copies of \`isHighRankMaster\` collapse into
\`rules/master-rank.mjs\`. That move is behaviour-preserving and the
regression tests exist to prove it: \`paysHighColumn\` is the old
predicate exactly, and it is deliberately NOT \`isHighRank\` -- a Rankless
Master pays the cheap price and earns none of the benefits.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S"
```

---

## Task 3: The three grants, and Jack's Mist exemption

**Files:**
- Modify: `module/rules/zon.mjs` (`zonRadius`, line 65), `module/rules/snapshot.mjs` (unit projection ~line 131 and a new annotation pass registered near line 419), `module/rules/options.mjs` (the `add` function, ~line 199), `module/rules/bounded-fields.mjs` (`isExempt`), `module/apps/summon-dialog.mjs` (`grantRows`, line 84), `packs/_source/abilities/jack-the-mist.yml`
- Test: `test/unit/master-rank.test.mjs` (append), `test/unit/jack.test.mjs` (append)

**Interfaces:**
- Consumes: `tierOf`, `isHighRank`, `grantBudget` from Task 2.
- Produces:
  - `zonRadius(servant, master, config)` — unchanged signature, now adds `+1` for a High Rank Master
  - unit snapshot gains `masterTier: "high"|"low"|"rankless"|null`
  - roll options `(self|target):masterTier:<tier>`
  - `isExempt` accepts `{masterTier: "high"}`

- [ ] **Step 1: Write the failing ZON test**

Append to `test/unit/master-rank.test.mjs`:

```js
import { zonRadius } from "../../module/rules/zon.mjs";

describe("High Rank Master grants", () => {
  const saber = { id: "s", servantClasses: ["saber"], zonBonuses: [] };

  it("widens ZON by 1, stacking", () => {
    const low = zonRadius(saber, { id: "m", rank: "C", zon: 0 });
    const high = zonRadius(saber, { id: "m", rank: "A", zon: 0 });
    expect(high).toBe(low + 1);
  });

  it("does not widen it for a Rankless Master", () => {
    expect(zonRadius(saber, { id: "m", rank: null, zon: 0 }))
      .toBe(zonRadius(saber, { id: "m", rank: "C", zon: 0 }));
  });

  it("stacks with the Master's own stated ZON rather than being capped by it", () => {
    // The `Math.max(derived, master.zon)` floor exists so a Master sheet that
    // states a number is believed. A rank bonus is a different thing and must
    // land on `derived`, or a stated ZON would swallow it.
    const stated = zonRadius(saber, { id: "m", rank: "A", zon: 99 });
    expect(stated).toBe(99);
    const plain = zonRadius(saber, { id: "m", rank: "A", zon: 0 });
    expect(plain).toBeGreaterThan(zonRadius(saber, { id: "m", rank: "D", zon: 0 }));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: FAIL — "widens ZON by 1" gets equal values, because `zonRadius` has no rank term.

- [ ] **Step 3: Add the ZON term**

In `module/rules/zon.mjs`, import at the top:

```js
import { isHighRank } from "./master-rank.mjs";
```

and in `zonRadius`, change the `derived` line:

```js
  // "High Rank Masters additionally grant ZON +1" (Ch. 04 §4.5). A STACKING
  // bonus, as the formula in this file's own header says -- added to the
  // derived radius rather than folded into the `Math.max` floor below, because
  // that floor exists so a Master sheet stating a ZON is believed, and it would
  // otherwise swallow the rank bonus whole.
  const rankBonus = isHighRank(master) ? 1 : 0;

  const derived = radius + exclusive + stacking + rankBonus;
  return Math.max(derived, master?.zon ?? 0);
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write the failing Sustainability test**

Append to `test/unit/master-rank.test.mjs`:

```js
import { snapshotBoard } from "../../module/rules/snapshot.mjs";

describe("Sustainability +1◈ while the Master lives", () => {
  const build = (rank, masterHealth) => snapshotBoard({
    actors: [
      { actor: { id: "s1", type: "servant", name: "S", system: {
        sustainability: "2◈", masterId: "m1", contract: "contracted", health: { value: 100, max: 100 },
      }, items: [], effects: [] }, token: null },
      { actor: { id: "m1", type: "master", name: "M", system: {
        rank, health: { value: masterHealth, max: 250 },
      }, items: [], effects: [] }, token: null },
    ],
    settings: { turnsPerRound: 3 },
  });

  it("adds a turn for a living High Rank Master", () => {
    const high = build("A", 250).units.find((u) => u.id === "s1").sustainability;
    const low = build("C", 250).units.find((u) => u.id === "s1").sustainability;
    expect(high).toBe(low + 1);
  });

  it("lapses when the Master is dead", () => {
    const dead = build("A", 0).units.find((u) => u.id === "s1").sustainability;
    const low = build("C", 250).units.find((u) => u.id === "s1").sustainability;
    expect(dead).toBe(low);
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: FAIL — the two values are equal; there is no master-rank term in Sustainability.

- [ ] **Step 7: Add the annotation pass**

In `module/rules/snapshot.mjs`, add a new pass and register it beside the others (near line 419, after `annotateZon`):

```js
  annotateMasterRank(units, board);
```

and define it:

```js
/**
 * What a Servant's Master's rank gives it.
 *
 * A board pass rather than a per-unit projection because it needs the OTHER
 * unit: only the board knows whether the Master is alive, and *"High Rank
 * Masters: +1◈ while alive"* (Ch. 04 §4.5, Ch. 16) turns on exactly that. The
 * bonus therefore lapses at the same instant the Free-Servant clock starts,
 * which is the behaviour the two rules together describe.
 *
 * `masterTier` is recorded on every unit — including the Master itself, where
 * it is its own tier — because `rules/options.mjs` emits it as a predicate and
 * Jack's Mist exempts a High Rank Master from its contact Poison.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
function annotateMasterRank(units, board) {
  for (const u of units) {
    if (u.kind === "master") {
      u.masterTier = tierOf({ rank: u.rank });
      continue;
    }
    const master = u.masterId ? units.find((m) => m.id === u.masterId) : null;
    u.masterTier = master ? tierOf({ rank: master.rank }) : null;

    const alive = master ? currentHealth(master) > 0 : false;
    if (alive && u.masterTier === "high" && typeof u.sustainability === "number") {
      u.sustainability += 1;
    }
  }
}
```

Import `tierOf` at the top of `snapshot.mjs`:

```js
import { tierOf } from "./master-rank.mjs";
```

`currentHealth` is already imported from `../domain/health.mjs`; confirm and add it if not.

**Also project the Master's own `rank`** onto its snapshot so `annotateMasterRank` can read it — in `snapshotUnit`'s returned object, beside `alignment`:

```js
    // The stored letter. `masterTier` is derived from it by the board pass.
    rank: sys.rank ?? null,
```

- [ ] **Step 8: Run the test**

Run: `npx vitest run test/unit/master-rank.test.mjs`

Expected: PASS. If `snapshotBoard`'s fixture shape does not match, read `test/unit/snapshot.test.mjs` for the shape it actually takes and adjust the fixture — **not** the assertion.

- [ ] **Step 9: Emit the roll option**

In `module/rules/options.mjs`, inside `add(options, side, unit)`, beside the `free` option added for Jack:

```js
  // The rank of the Master this unit answers to — or its own, if it is one.
  // Jack's Mist exempts a High Rank Master from its contact Poison, which is
  // the first clause to ask.
  if (unit.masterTier) options.add(`${side}:masterTier:${unit.masterTier}`);
```

and add the pattern to `EMITTABLE`:

```js
  /^(self|target):masterTier:(high|low|rankless)$/,
```

- [ ] **Step 10: Teach `isExempt` about the tier**

In `module/rules/bounded-fields.mjs`, in `isExempt`, after the `categorizedAs` branch:

```js
  // Jack's Mist Advanced Note: *"High Rank Masters are not inflicted with
  // Poison upon contact with the Mist."* A property of the unit under test,
  // which for that clause is always a Master (`kinds: [master]`).
  if (spec.masterTier && unit?.masterTier === spec.masterTier) return true;
```

- [ ] **Step 11: Spend the grant budget in the summon dialog**

In `module/apps/summon-dialog.mjs`, import:

```js
import { grantBudget } from "../rules/master-rank.mjs";
```

In the context builder beside `grantRows` (line 84), add the allowance:

```js
      // *"High Rank Masters additionally grant a free `+` to one of their
      // Servant's Parameters."* The rows have always offered the CHOICE; the
      // allowance is what nothing enforced, so a GM could type any number
      // into any row and `prepareSummon` honoured it.
      grantBudget: grantBudget(game.actors.get(this.#form.masterId)?.system ?? null),
      grantSpent: Object.values(this.#form.grants).reduce((n, v) => n + Number(v || 0), 0),
```

and refuse a submission that overspends, in the same place the form is validated (~line 126):

```js
    const budget = grantBudget(game.actors.get(this.#form.masterId)?.system ?? null);
    const spent = Object.values(this.#form.grants).reduce((n, v) => n + Number(v || 0), 0);
    if (spent > budget) {
      ui.notifications.warn(game.i18n.format("FGT.Summon.GrantOverspent", { budget, spent }));
      return;
    }
```

Add to `lang/en.json`:

```json
  "FGT.Summon.GrantOverspent": "This Master may grant {budget} Parameter step(s); {spent} selected.",
```

- [ ] **Step 12: Author the Mist exemption**

In `packs/_source/abilities/jack-the-mist.yml`, on the `kinds: [master]` **contact** interior event, add the exemption and replace the note that said it was unmodelled:

```yaml
    # Effect 2, the contact half. Masters only -- a Servant is not a Human, and
    # "non-normal Humans" in this corpus is the Master category.
    #
    # The Advanced Note -- "High Rank Masters are not inflicted with Poison
    # upon contact with the Mist" -- is now modelled: `masterTier` reaches the
    # snapshot from `rules/master-rank.mjs` and `isExempt` reads it. Note it
    # exempts CONTACT only; the standing turn-end Poison below still applies,
    # which is exactly what "upon contact" qualifies.
    - event: contact
      kinds: [master]
      relations: [enemy]
      exemptIf: { masterTier: high }
      onFail:
        - { key: ApplyEffect, effect: { id: poison } }
```

- [ ] **Step 13: Test the exemption**

Append to `test/unit/jack.test.mjs`:

```js
describe("The Mist — the High Rank Master exemption", () => {
  const contactRule = { key: "ApplyEffect", exemptIf: { masterTier: "high" }, relations: ["enemy"] };

  it("spares a High Rank Master and poisons everyone else", () => {
    const high = unit({ kind: "master", masterTier: "high" });
    const low = unit({ kind: "master", masterTier: "low" });
    const none = unit({ kind: "master", masterTier: "rankless" });
    expect(isExempt(contactRule.exemptIf, high, board([high]))).toBe(true);
    expect(isExempt(contactRule.exemptIf, low, board([low]))).toBe(false);
    expect(isExempt(contactRule.exemptIf, none, board([none]))).toBe(false);
  });
});
```

- [ ] **Step 14: Rebuild content and run everything**

The world must be shut down first (`game.shutDown()` in the Foundry tab), or LevelDB throws `EBUSY`.

Run: `npm run build:packs && npm run lint && npx vitest run && npm run validate:content`

Expected: all pass; `build:packs` reports 0 warnings.

- [ ] **Step 15: Verify live**

Relaunch the world, then with Jack's Mist open and an enemy Master ranked `A` walking into it:

```js
const { currentBoard } = await import('/systems/fgt/module/engine/board.mjs');
const { runFieldEvents } = await import('/systems/fgt/module/engine/fields.mjs');
const m = game.actors.find(a => a.type === 'master' && a.system.rank === 'A');
const intents = await runFieldEvents('contact', { unitIds: [m.id], fieldIds: ['jack-the-mist'], assumeInside: true });
return JSON.stringify({ tier: currentBoard().units.find(u => u.id === m.id)?.masterTier, intents });
```

Expected: `tier: "high"` and `intents: []`. Set the rank to `C` and the same call yields a Poison intent.

- [ ] **Step 16: Commit**

```bash
git add module/rules/zon.mjs module/rules/snapshot.mjs module/rules/options.mjs \
        module/rules/bounded-fields.mjs module/apps/summon-dialog.mjs lang/en.json \
        packs/_source/abilities/jack-the-mist.yml test/unit/master-rank.test.mjs test/unit/jack.test.mjs
git commit -m "Wire the three things a High Rank Master is supposed to grant

Ch. 04 §4.5 gives a High Rank Master ZON +1, Sustainability +1◈ while
alive, and a free step to one of its Servant's Parameters. None of the
three were wired: \`zonRadius\` had no rank term at all despite its own
header listing one, \`relationships.mjs\` had no Sustainability term, and
\`masterGrants\` was whatever the caller passed \`prepareSummon\` -- so a
GM could type any number into any row and it was honoured.

ZON's bonus stacks onto the derived radius rather than the
\`Math.max(derived, master.zon)\` floor: that floor exists so a Master
sheet stating a ZON is believed, and it would otherwise swallow the rank
bonus whole.

Sustainability is a board pass, because it needs the other unit -- \"+1◈
WHILE ALIVE\" means the bonus lapses at the same instant the Free-Servant
clock starts.

With \`masterTier\` on the snapshot, Jack's Mist can finally state its
Advanced Note: High Rank Masters are not Poisoned on CONTACT. The
standing turn-end Poison still applies, which is what \"upon contact\"
qualifies.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S"
```

---

## Task 4: Painting a freeform field

**Files:**
- Modify: `module/rules/bounded-fields.mjs` (new `legalRepaint`, `mayReshape`), `module/data/actor/_shared.mjs` (`turnState`, line 204), `module/engine/fields.mjs` (new `repaintField`), `module/apps/canvas/targeting-layer.mjs` (mode E), `module/apps/hud/token-hud.mjs` (button), `module/engine/scheduler-hooks.mjs` (end-of-turn prompt), `lang/en.json`, `styles/src/_apps.scss`
- Test: `test/unit/field-painting.test.mjs` (append)

**Interfaces:**
- Consumes: `shapeOf` (Task 1), `chebyshev` from `module/domain/geometry.mjs`.
- Produces:
  - `legalRepaint(field, panels, anchorPanel) -> {ok: boolean, reason?: string}`
  - `mayReshape(field, unit) -> boolean`
  - `repaintField(fieldId, panels) -> Promise<boolean>`
  - `TargetingLayer#paintPanels({anchor, maxPanels, maxDistance, initial}) -> Promise<Array<{i,j}>|null>`

- [ ] **Step 1: Write the failing legality tests**

Append to `test/unit/field-painting.test.mjs`:

```js
import { legalRepaint, mayReshape } from "../../module/rules/bounded-fields.mjs";

const mist = (over = {}) => ({
  id: "jack-the-mist", ownerId: "jack",
  geometry: { kind: "freeform", maxPanels: 25, maxDistance: 4 },
  panels: [{ i: 5, j: 5 }],
  deactivation: { byOwner: true },
  ...over,
});
const at = (i, j) => ({ i, j });

describe("legalRepaint", () => {
  it("accepts a footprint within the cap and the leash", () => {
    const panels = [at(5, 5), at(5, 6), at(6, 5)];
    expect(legalRepaint(mist(), panels, at(5, 5))).toEqual({ ok: true });
  });

  it("refuses more panels than the cap", () => {
    const panels = Array.from({ length: 26 }, (_, n) => at(5, n));
    expect(legalRepaint(mist(), panels, at(5, 5)).ok).toBe(false);
    expect(legalRepaint(mist(), panels, at(5, 5)).reason).toBe("toManyPanels");
  });

  it("refuses a panel beyond the leash, measured from the anchor", () => {
    // "cannot expand past a distance of 4 panels from Jack (including
    // diagonal)" -- Chebyshev, so {10,10} is 5 away from {5,5}.
    expect(legalRepaint(mist(), [at(5, 5), at(10, 10)], at(5, 5)).reason).toBe("outsideLeash");
  });

  it("accepts a panel at exactly the leash distance", () => {
    expect(legalRepaint(mist(), [at(9, 9)], at(5, 5))).toEqual({ ok: true });
  });

  it("refuses an empty footprint", () => {
    // A field with no panels is a field that has been deleted by accident.
    expect(legalRepaint(mist(), [], at(5, 5)).reason).toBe("empty");
  });

  it("refuses a field that is not freeform", () => {
    const fixed = mist({ geometry: { kind: "fixedArea", shape: { kind: "square", size: 5 } } });
    expect(legalRepaint(fixed, [at(5, 5)], at(5, 5)).reason).toBe("notFreeform");
  });
});

describe("mayReshape", () => {
  const jack = (turnState = {}) => ({ id: "jack", turnState });

  it("lets the owner reshape a freeform field it has not reshaped this Turn", () => {
    expect(mayReshape(mist(), jack())).toBe(true);
  });

  it("refuses a second reshape in the same Turn", () => {
    expect(mayReshape(mist(), jack({ reshapedField: true }))).toBe(false);
  });

  it("refuses anyone who is not the owner", () => {
    expect(mayReshape(mist(), { id: "somebody-else", turnState: {} })).toBe(false);
  });

  it("refuses a fixed-area field even for its owner", () => {
    const fixed = mist({ geometry: { kind: "fixedArea" } });
    expect(mayReshape(fixed, jack())).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/field-painting.test.mjs`

Expected: FAIL — `legalRepaint` and `mayReshape` are not exported.

- [ ] **Step 3: Write both functions**

Append to `module/rules/bounded-fields.mjs`:

```js
/* -------------------------------------------------------------------------- */
/*  Redrawing a freeform field                                                */
/* -------------------------------------------------------------------------- */

/**
 * Is this a legal footprint for the field?
 *
 * The decision half of the paint tool. `apps/canvas/targeting-layer.mjs` draws
 * legality live so a player never paints something that will be refused, but
 * the layer decides nothing — this is checked again GM-side at commit, so a
 * hand-crafted socket payload cannot draw a forty-panel Mist across the board.
 *
 * The leash is measured from the ANCHOR to each panel, never from the field to
 * the anchor, which is what makes Jack's *"does not need to be within the
 * Mist"* true without a rule of its own.
 *
 * @param {object} field
 * @param {Array<{i: number, j: number}>} panels
 * @param {{i: number, j: number}} anchorPanel the owner's panel
 * @returns {{ok: boolean, reason?: string}}
 */
export function legalRepaint(field, panels, anchorPanel) {
  const geometry = field?.geometry ?? {};
  if (geometry.kind !== "freeform") return { ok: false, reason: "notFreeform" };
  if (!panels?.length) return { ok: false, reason: "empty" };

  const cap = geometry.maxPanels ?? Infinity;
  if (panels.length > cap) return { ok: false, reason: "toManyPanels" };

  const leash = geometry.maxDistance;
  if (typeof leash === "number" && anchorPanel) {
    const escaped = panels.some((p) => chebyshev(p, anchorPanel) > leash);
    if (escaped) return { ok: false, reason: "outsideLeash" };
  }
  return { ok: true };
}

/**
 * May this unit redraw this field right now?
 *
 * The sibling of `mayDeactivate`, which the token HUD's field switch already
 * uses, and it lives here for the same reason: the HUD asks and never decides.
 *
 * The once-per-Turn flag is `turnState.reshapedField`, which the schema clears
 * by the same tick-stamped staleness rule as the rest of that block — so a hook
 * that fails to fire cannot lock the ability out for the rest of the match.
 *
 * @param {object} field
 * @param {object} unit
 * @returns {boolean}
 */
export function mayReshape(field, unit) {
  if (field?.geometry?.kind !== "freeform") return false;
  if (field.ownerId !== unit?.id) return false;
  return !unit?.turnState?.reshapedField;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/field-painting.test.mjs`

Expected: PASS, 13 tests.

- [ ] **Step 5: Add the once-per-turn flag to the schema**

In `module/data/actor/_shared.mjs`, inside the `turnState` `SchemaField` (which starts at line 204), beside `usedRidingAttack`:

```js
      // Jack's Mist: *"she can Move the Mist and/or change the shape of the
      // Mist ONCE"* per Turn. Its own flag rather than `usedActiveSkill`,
      // because the same sentence says it "does not count as Moving a Unit and
      // is not an Attack" -- so it must not spend anything else.
      reshapedField: new fields.BooleanField({ initial: false }),
```

- [ ] **Step 6: Write `repaintField`**

Append to `module/engine/fields.mjs`:

```js
/**
 * Redraw a freeform field's footprint in place.
 *
 * In place is the whole point: the field keeps its id, its interior rules, its
 * `createdAt` and its upkeep clock. Closing it and casting it again would
 * restart the upkeep period and fire the owning ability's
 * `countFrom: "deactivation"` cooldown — which for Jack's Mist is 5◈ she has
 * not earned.
 *
 * Contact fires for whoever the NEW footprint closes over and not for anyone
 * the old one already covered, reusing the same entry set `runContactEvents`
 * takes. Painting the fog onto an enemy Master Poisons him; painting it off and
 * back on next Turn Poisons him again, which is what "upon contact" means.
 *
 * @param {string} fieldId
 * @param {Array<{i: number, j: number}>} panels
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function repaintField(fieldId, panels) {
  const board = currentBoard();
  const field = (board.fields ?? []).find((f) => f.id === fieldId);
  if (!field) return { ok: false, reason: "noField" };

  const owner = (board.units ?? []).find((u) => u.id === field.ownerId);
  const verdict = legalRepaint(field, panels, owner?.panel ?? null);
  if (!verdict.ok) return verdict;

  const region = canvas?.scene?.regions?.get(field.regionId);
  const behavior = region?.behaviors?.find(
    (b) => b.type === "npField" && b.system?.fieldId === fieldId,
  );
  if (!region || !behavior) return { ok: false, reason: "noRegion" };

  const before = new Set((field.panels ?? []).map((p) => `${p.i},${p.j}`));

  await region.update({ shapes: [shapeOf(panels, canvas.scene)] });
  await behavior.update({ "system.panels": panels.map((p) => ({ i: p.i, j: p.j })) });

  // Only the units the new footprint newly covers.
  const after = currentBoard();
  const caught = (after.units ?? [])
    .filter((u) => u.panel
      && panels.some((p) => p.i === u.panel.i && p.j === u.panel.j)
      && !before.has(`${u.panel.i},${u.panel.j}`))
    .map((u) => u.id);
  if (caught.length > 0) {
    const intents = await runFieldEvents("contact", {
      unitIds: caught, fieldIds: [fieldId], assumeInside: true,
    });
    if (intents.length > 0) await applyWorldIntents(intents, "field:contact");
  }

  if (owner) {
    await applyWorldIntents(
      [I.markTurn(owner.id, { reshapedField: true })],
      "field:repaint",
    );
  }
  return { ok: true };
}
```

Import `legalRepaint` at the top of `fields.mjs`:

```js
import { panelsOf, legalRepaint } from "../rules/bounded-fields.mjs";
```

- [ ] **Step 7a: Give `TargetingHUD` a settable label**

The painter needs a live `n/25` counter. `TargetingHUD#update(option)` takes a *placement option*
(`{legal, reasons, resolved}`) and renders a targeting preview from it — it cannot show a bare
string, and `#label` is private and set once at construction. So the class gains one small method
rather than the painter abusing `update`.

In `module/apps/canvas/targeting-hud.mjs`, after `update`:

```js
  /**
   * Replace the header text and redraw.
   *
   * `update(option)` renders a placement PREVIEW and has nothing to show when
   * there is no placement — which is every moment of a freeform paint session,
   * where the only status is how many panels are down. Mode E sets the count
   * here and calls `update(null)`, which renders the header plus the
   * choose-a-panel hint.
   *
   * @param {string} label
   * @returns {void}
   */
  setLabel(label) {
    this.#label = label;
    this.update(null);
  }
```

Verify: `npm run lint` — the private-field write must be inside the class or ESLint rejects it.

- [ ] **Step 7: Add mode E to the targeting layer**

In `module/apps/canvas/targeting-layer.mjs`, extend the mode table in the file header with a fifth row:

```
 * | `freeform` paint   | E | drag to add, shift-drag to erase, live cap and leash |
```

and add the entry point as a public method on `TargetingLayer`:

```js
  /**
   * Mode E — paint a freeform footprint.
   *
   * The fifth interaction, and the first outside Ch. 09's targeting grammar:
   * there is no anchor to place and no shape to resolve, only a set of panels a
   * player draws. Ch. 43 has called it "targeting mode E" since it was written.
   *
   * Legality is DRAWN, not enforced after the fact — a panel outside the leash
   * renders in the illegal tint and refuses paint, so the player never composes
   * something that will be rejected. The layer still decides nothing: the
   * verdict comes from `rules/bounded-fields.mjs#legalRepaint`, and the GM
   * checks it again at commit.
   *
   * @param {object} args
   * @param {{i: number, j: number}} args.anchor the owner's panel; the leash is measured from it
   * @param {number} args.maxPanels
   * @param {number} args.maxDistance
   * @param {Array<{i: number, j: number}>} [args.initial] the current footprint
   * @returns {Promise<Array<{i: number, j: number}>|null>} panels, or null on cancel
   */
  async paintPanels({ anchor, maxPanels, maxDistance, initial = [] }) {
    this.#cancel();
    this.activate();

    const key = (p) => `${p.i},${p.j}`;
    const painted = new Map(initial.map((p) => [key(p), { i: p.i, j: p.j }]));
    const legal = (p) => chebyshev(p, anchor) <= maxDistance;

    const hud = new TargetingHUD({ label: `0/${maxPanels}` });
    const redraw = () => {
      this.#graphics.clear();
      // Illegal panels first and underneath, so a painted panel that later
      // becomes illegal (the anchor moved) still reads as painted.
      this.#drawPanels([...painted.values()].filter((p) => !legal(p)), ILLEGAL, 0.35);
      this.#drawPanels([...painted.values()].filter(legal), LEGAL, 0.3);
      hud.setLabel(`${painted.size}/${maxPanels}`);
    };

    announce(game.i18n.localize("FGT.Paint.Announce"), "E");

    try {
      const panels = await this.#runPaint({ painted, legal, maxPanels, key, redraw });
      return panels;
    } finally {
      hud.close();
      this.#graphics?.clear();
      this.deactivate();
    }
  }
```

and the pointer loop, which owns the drag handling:

```js
  /**
   * The pointer loop for mode E.
   *
   * `pointerdown` starts a stroke, `pointermove` continues it while held, and
   * `pointerup` ends it — one stroke paints or erases uniformly, decided by
   * whether `shift` was down when it started. Deciding per-panel instead would
   * let a stroke that crosses its own path toggle a panel back off.
   *
   * @param {object} ctx
   * @returns {Promise<Array<{i: number, j: number}>|null>}
   */
  #runPaint({ painted, legal, maxPanels, key, redraw }) {
    return new Promise((resolve) => {
      let stroke = null;

      const panelAt = (event) => {
        const local = event.getLocalPosition(canvas.stage);
        const offset = canvas.grid.getOffset({ x: local.x, y: local.y });
        return { i: offset.i, j: offset.j };
      };

      const apply = (panel) => {
        const k = key(panel);
        if (stroke === "erase") painted.delete(k);
        else if (legal(panel) && painted.size < maxPanels) painted.set(k, panel);
        else if (legal(panel) && painted.has(k)) { /* already painted; no-op */ }
        redraw();
      };

      const onDown = (event) => {
        stroke = event.data?.originalEvent?.shiftKey ? "erase" : "paint";
        apply(panelAt(event));
      };
      const onMove = (event) => { if (stroke) apply(panelAt(event)); };
      const onUp = () => { stroke = null; };

      const onKey = (event) => {
        if (event.key === "Escape") finish(null);
        if (event.key === "Enter") finish([...painted.values()]);
      };

      const finish = (result) => {
        canvas.stage.off("pointerdown", onDown);
        canvas.stage.off("pointermove", onMove);
        canvas.stage.off("pointerup", onUp);
        window.removeEventListener("keydown", onKey);
        resolve(result);
      };

      canvas.stage.on("pointerdown", onDown);
      canvas.stage.on("pointermove", onMove);
      canvas.stage.on("pointerup", onUp);
      window.addEventListener("keydown", onKey);
      redraw();
    });
  }
```

Import `chebyshev` at the top of the file:

```js
import { chebyshev } from "../../domain/geometry.mjs";
```

- [ ] **Step 8: Add the HUD button**

In `module/apps/hud/token-hud.mjs`, import `mayReshape` beside `mayDeactivate`:

```js
import { mayDeactivate } from "../../engine/fields.mjs";
import { mayReshape } from "../../rules/bounded-fields.mjs";
```

and extend `fieldSwitches` to emit a reshape button too:

```js
function fieldSwitches(actor, board) {
  const unit = unitFrom(board, actor);
  const out = [];
  for (const field of board?.fields ?? []) {
    if (mayDeactivate(field, actor.id)) {
      out.push(button(`field-${field.id}`, "fa-solid fa-circle-xmark", null,
        async () => {
          const { deactivateField } = await import("../../engine/fields.mjs");
          await deactivateField(field.id, "owner");
        },
        game.i18n.format("FGT.HUD.EndField", { name: nameOfField(field, actor) })));
    }
    if (mayReshape(field, unit)) {
      out.push(button(`reshape-${field.id}`, "fa-solid fa-pen-nib", null,
        () => reshape(field, unit),
        game.i18n.format("FGT.HUD.ReshapeField", { name: nameOfField(field, actor) })));
    }
  }
  return out;
}

/**
 * Open the painter for a field, and commit what comes back.
 *
 * @param {object} field
 * @param {object} unit
 * @returns {Promise<void>}
 */
async function reshape(field, unit) {
  const { pickPaint } = await import("../canvas/targeting-layer.mjs");
  const panels = await pickPaint({
    anchor: unit.panel,
    maxPanels: field.geometry?.maxPanels ?? 25,
    maxDistance: field.geometry?.maxDistance ?? 4,
    initial: field.panels ?? [],
  });
  if (!panels) return;

  const { repaintField } = await import("../../engine/fields.mjs");
  const verdict = await repaintField(field.id, panels);
  if (!verdict.ok) ui.notifications.warn(game.i18n.localize(`FGT.Paint.${verdict.reason}`));
}
```

Add the module-level helper beside `pickTarget` in `targeting-layer.mjs`:

```js
/**
 * Open a freeform paint session on the canvas.
 * @param {object} args see `TargetingLayer#paintPanels`
 * @returns {Promise<Array<{i: number, j: number}>|null>}
 */
export function pickPaint(args) {
  const layer = canvas.fgtTargeting;
  if (!layer) throw new Error("FGT | The targeting layer is not on the canvas.");
  return layer.paintPanels(args);
}
```

- [ ] **Step 9: Add the end-of-turn prompt**

In `module/engine/scheduler-hooks.mjs`, after the `actedTurnEnd` field events (line 77):

```js
  // Jack's Mist: *"During Jack's Turn OR at the end of any Turn Jack Acts, she
  // can Move the Mist and/or change the shape once."* The second window is easy
  // to miss and only opens on a Turn she acted, so it is offered rather than
  // left as a button that quietly stops working.
  await fields.offerReshape(board);
```

and in `module/engine/fields.mjs`:

```js
/**
 * Offer a reshape to every owner whose Turn is ending and who acted in it.
 *
 * @param {object} board
 * @returns {Promise<void>}
 */
export async function offerReshape(board) {
  if (!game.users.activeGM?.isSelf) return;

  for (const field of board.fields ?? []) {
    const owner = (board.units ?? []).find((u) => u.id === field.ownerId);
    if (!owner?.acted || !mayReshape(field, owner)) continue;

    const doc = game.actors.get(owner.id);
    if (!doc) continue;
    const { FGTSocket } = await import("../net/socket.mjs");
    const user = game.users.find((u) => u.active && !u.isGM && doc.testUserPermission(u, "OWNER"))
      ?? game.user;
    const picked = await FGTSocket.ask(user.id, {
      kind: "choose",
      title: game.i18n.localize("FGT.Paint.OfferTitle"),
      hint: game.i18n.format("FGT.Paint.OfferHint", { name: doc.name }),
      min: 0,
      count: 1,
      options: [{ id: "reshape", name: game.i18n.localize("FGT.Paint.Offer") }],
    }).catch(() => null);
    if ((picked ?? []).includes("reshape")) {
      Hooks.callAll("fgtOfferReshape", { fieldId: field.id, unitId: owner.id });
    }
  }
}
```

and import `mayReshape` in `fields.mjs`:

```js
import { panelsOf, legalRepaint, mayReshape } from "../rules/bounded-fields.mjs";
```

Wire the hook to the painter in `module/apps/hud/token-hud.mjs`'s `attachTokenHUD`:

```js
  // The end-of-turn reshape window, raised by the scheduler.
  Hooks.on("fgtOfferReshape", async ({ fieldId, unitId }) => {
    const board = currentBoard();
    const field = (board.fields ?? []).find((f) => f.id === fieldId);
    const unit = (board.units ?? []).find((u) => u.id === unitId);
    if (field && unit) await reshape(field, unit);
  });
```

- [ ] **Step 10: Add the strings and the style**

In `lang/en.json`:

```json
  "FGT.HUD.ReshapeField": "Reshape {name}",
  "FGT.Paint.Announce": "Drag to paint · shift-drag to erase · Enter to confirm · Esc to cancel",
  "FGT.Paint.OfferTitle": "Reshape the field?",
  "FGT.Paint.OfferHint": "{name} acted this Turn and may Move or reshape the field once.",
  "FGT.Paint.Offer": "Reshape",
  "FGT.Paint.notFreeform": "That field's shape is fixed and cannot be redrawn.",
  "FGT.Paint.empty": "A field needs at least one panel.",
  "FGT.Paint.toManyPanels": "That is more panels than this field may cover.",
  "FGT.Paint.outsideLeash": "Some panels are further from the owner than the field may reach.",
  "FGT.Paint.noField": "That field is no longer open.",
  "FGT.Paint.noRegion": "That field's Region is missing.",
```

In `styles/src/_apps.scss`, inside the `.fgt-hud` block:

```scss
  &__reshape { cursor: crosshair; }
```

Then run `npm run build:styles`.

- [ ] **Step 11: Run every check**

Run: `npm run lint && npx vitest run && npm run validate:content && npm run check:templates && npm run check:manifest`

Expected: all pass.

- [ ] **Step 12: Verify live — the round trip, through the real commit path**

Reload, open Jack's Mist, then paint an L by calling the commit path directly (the pointer loop is exercised in step 13):

```js
const { repaintField } = await import('/systems/fgt/module/engine/fields.mjs');
const { currentBoard } = await import('/systems/fgt/module/engine/board.mjs');
const jack = game.actors.find(a => a.system?.contentId === 'jack-the-ripper');
const p = currentBoard().units.find(u => u.id === jack.id).panel;
const L = [{i:p.i,j:p.j},{i:p.i,j:p.j+1},{i:p.i+1,j:p.j}];
const verdict = await repaintField('jack-the-mist', L);
await new Promise(r => setTimeout(r, 1200));
const f = currentBoard().fields.find(x => x.id === 'jack-the-mist');
return JSON.stringify({ verdict, panels: f.panels, count: f.panels.length,
  createdAt: f.createdAt, upkeep: f.lastUpkeepAt });
```

Expected: `verdict: {ok: true}`, exactly **3** panels forming the L (not 4 — this is what Task 1 bought), and `createdAt`/`lastUpkeepAt` unchanged from before the repaint.

Then confirm the leash refuses:

```js
const far = [{i: p.i + 9, j: p.j + 9}];
return JSON.stringify(await repaintField('jack-the-mist', far));
```

Expected: `{ok: false, reason: "outsideLeash"}`.

- [ ] **Step 13: Verify the pointer loop by hand**

This is the step no harness covers. With the world open:

1. Select Jack, open the token HUD, click the pen-nib button.
2. Drag across several panels — they fill; the counter climbs.
3. Drag beyond 4 panels from her — those panels refuse and show the illegal tint.
4. Keep painting past 25 — further panels refuse.
5. Shift-drag over painted panels — they clear.
6. Press Escape — nothing changes.
7. Reopen, paint, press Enter — the Region updates to exactly what was drawn.
8. Try the button again the same Turn — it is gone.

**Ask the user to do this pass themselves before calling the task done.** Pointer capture and drag-versus-click are where canvas bugs hide and a scripted handler call does not exercise them.

- [ ] **Step 14: Commit**

```bash
git add module/rules/bounded-fields.mjs module/data/actor/_shared.mjs module/engine/fields.mjs \
        module/apps/canvas/targeting-layer.mjs module/apps/hud/token-hud.mjs \
        module/engine/scheduler-hooks.mjs lang/en.json styles/src/_apps.scss \
        test/unit/field-painting.test.mjs
git commit -m "Let a freeform bounded field be redrawn on the canvas

Ch. 43 has called this \"targeting mode E\" since it was written and
listed it as not built. It is the fifth interaction on the existing
TargetingLayer and the first outside Ch. 09's grammar: there is no
anchor to place and no shape to resolve, only a set of panels a player
draws.

Legality is DRAWN rather than enforced afterwards -- a panel outside the
leash refuses paint and shows the illegal tint, so nothing is composed
that will be rejected. The layer still decides nothing: the verdict is
\`rules/bounded-fields.mjs#legalRepaint\`, re-checked GM-side at commit so
a hand-crafted socket payload cannot draw a forty-panel Mist.

A repaint updates the Region and the stored panels together and touches
nothing else, so the field keeps its id, its interior rules, its
\`createdAt\` and its upkeep clock. Closing and recasting would restart the
upkeep period and fire a 5◈ cooldown Jack has not earned.

Contact fires only for whoever the NEW footprint newly covers, so
painting the fog onto a Master Poisons him once and painting it off and
back on next Turn Poisons him again -- which is what \"upon contact\"
means.

Both of the sheet's windows are wired: a HUD button during her Turn, and
an offered prompt at the end of any Turn she Acts, since a window that
closes silently is one players lose.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S"
```

---

## Task 5: Documentation

The standing rule for this repo: documentation changes with every commit, and Ch. 45 alone is not enough — the affected 00–44 chapter must change too.

**Files:**
- Modify: `docs/04-units.md`, `docs/06-stats-and-resources.md`, `docs/16-relationships.md`, `docs/28-targeting-implementation.md`, `docs/43-bounded-fields.md`, `docs/45-implementation-status.md`, `docs/D-servant-data-sheets.md`, `CHANGELOG.md`

- [ ] **Step 1: Chapter 04 — the rank and its grants**

In `docs/04-units.md`'s "Rank and essence" section (~line 348), add after the existing paragraph:

```markdown
> **Built (Ch. 45).** The rank is now settable from the Master's sheet (a four-grade selector plus
> a blank meaning Rankless) and the `coinFlip` setup mode **keeps** the rank it determines rather
> than folding it into Base Attack (MAG) and discarding it — which had left a Master who flipped
> Heads with 125 Base Attack and Rankless treatment for ZON, Sustainability, the parameter grant
> and the Kill Yourself price. `rules/master-rank.mjs` derives the `high｜low｜rankless` tier that
> every rule actually asks for.
>
> All three grants are wired: `ZON +1` (stacking, in `rules/zon.mjs`), `Sustainability +1◈` while
> the Master lives (a board pass, because it needs the other unit), and the parameter step, whose
> *choice* the summon dialog always offered but whose *allowance* nothing enforced.
>
> Note that **`paysHighColumn` and `isHighRank` are different questions.** A Rankless Master pays
> the cheaper Noble Phantasm price (Ch. 15 §15.4) and earns none of the benefits above.
```

- [ ] **Step 2: Chapters 06 and 16 — ZON and Sustainability**

In `docs/06-stats-and-resources.md` beside the ZON formula (~line 381), note that `highRankMasterBonus` is now implemented and stacks. In `docs/16-relationships.md` beside the Sustainability table (~line 398), note that the High Rank Master `+1◈` is implemented and lapses on the Master's death.

- [ ] **Step 3: Chapters 28 and 43 — mode E**

In `docs/28-targeting-implementation.md`, add mode E to the interaction table with a note that it is the first interaction outside Ch. 09's anchor/shape grammar. In `docs/43-bounded-fields.md`, replace the "still not built" line about the paint tool with what now exists, and record that a field's Region stores a **grid** shape so a non-rectangular footprint survives a board read.

- [ ] **Step 4: Chapter 45 and the data sheet**

Add a section to `docs/45-implementation-status.md` covering both features, in the style of the existing entries: what was wrong, what was actually missing versus what only appeared to be, and what was verified live. Update `docs/D-servant-data-sheets.md` §D.18 to remove the "High Rank Masters" clause from Jack's unmodelled list.

- [ ] **Step 5: CHANGELOG**

Add `Added` and `Fixed` entries under `[Unreleased]` for: the settable Master rank, the coin flip keeping it, the three grants, Jack's Mist exemption, freeform repainting, and the grid-shape storage fix.

- [ ] **Step 6: Verify and commit**

Run: `npm run lint && npx vitest run && npm run validate:content`

```bash
git add docs/ CHANGELOG.md
git commit -m "Document the Master rank work and the field painter

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S"
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: §2.1 → Task 2 steps 3, 9; §2.2 → Task 2 steps 5–8 (regression); §2.3 → Task 3 steps 1–11; §2.4 → Task 2 steps 10–14; §2.5 → no work needed, verified by the regression test; §3.1 → Task 1; §3.2 → Task 4 steps 1–3, 7; §3.3 → Task 4 step 6; §3.4 → Task 4 steps 5, 8, 9; §4 → tests throughout; §5 → task order; §6 → Task 4 step 13 makes the drag risk an explicit human check.

**Placeholders.** One was found and fixed during writing: Task 2 step 12 originally contained a nonsense spread expression, replaced with the explicit `rankLine()` helper. No `TBD`, no "add error handling", no "similar to Task N".

**Type consistency.** `tierOf`/`isHighRank`/`isRankless`/`paysHighColumn`/`grantBudget` are named identically in Task 2's definition and every later use. `legalRepaint` returns `{ok, reason}` in Task 4 step 3 and is destructured that way in step 6 and step 12. `mayReshape(field, unit)` takes a **unit snapshot** (it reads `turnState`), which is why Task 4 step 8's `fieldSwitches` resolves `unitFrom(board, actor)` before calling it — an actor document would have failed silently.

**One assumption checked and removed.** The first draft had mode E calling `hud.update({label})`. `TargetingHUD#update(option)` actually takes a placement option and renders a targeting preview from it, and `#label` is private and set once at construction — so that call would have rendered an empty preview under a stale header. Task 4 gained step 7a, which adds a three-line `setLabel` to the class rather than misusing `update`. Verified against `module/apps/canvas/targeting-hud.mjs:35-45`.
