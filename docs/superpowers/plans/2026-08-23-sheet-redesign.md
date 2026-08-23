# Actor Sheet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the F/GT actor sheet from a five-field form into a four-tab sheet that shows everything an actor holds, and fix the ability editor's broken picker layout and missing fields.

**Architecture:** One `FGTActorSheet` class for all six actor types, using `ApplicationV2.TABS` with one `PART` per tab so partial re-render becomes possible. All presentation arithmetic moves into a pure module (`present.mjs`) that takes a snapshot and returns view objects, so it is unit-testable without a Foundry world. Ability state and cost come from `canUseAbility` / `npCost` — the same calls `engine/attack.mjs` makes — never from a second copy.

**Tech Stack:** Foundry VTT v14 (14.364), ApplicationV2 + HandlebarsApplicationMixin, native DOM (no jQuery), Sass, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-23-sheet-redesign-design.md`

## Global Constraints

- **No schema change.** Every field rendered already exists on a DataModel. If something is missing, stop and raise it — do not add a field.
- **Layer boundary** (`tools/check-layers.mjs`): `domain → rules → engine → apps`. Everything created here is layer 4 (`module/apps/`), which may import from all three below it. Never import `apps` from `rules` or `engine`.
- **Only helpers Foundry v14 registers** may appear in templates. The allowed set is in `tools/lib/templates.mjs` → `FOUNDRY_HELPERS`: `checked disabled concat editor formInput formGroup formField filePicker ifThen localize numberFormat numberInput object radioBoxes rangePicker selectOptions timeSince eq ne lt gt lte gte not and or`, plus Handlebars' built-ins. **`range`, `array` and `upper` do not exist and throw at render.** Anything else must be precomputed in the context.
- **Every literal `{{localize "KEY"}}` needs a key in `lang/en.json`** or `test/unit/i18n.test.mjs` fails. A missing key does not throw — Foundry renders the key itself, so the sheet reads `FGT.Tab.Effects` at players.
- **`{{selectOptions x}}` inside `{{#each}}`** must use `@root.x`, or `check:templates` fails.
- **No `<form>` element inside a part template.** ApplicationV2 renders the sheet frame *as* the form (`tag: "form"`); a nested form makes `FormDataExtended(outerForm)` collect nothing and no edit on the sheet ever saves.
- **Colour is never the only signal** (D29.7). Every colour-coded state also carries a shape, an icon, or text.
- **JSDoc on every exported function**, matching the house style in `module/` — eslint enforces it.
- Verification commands, run from the repo root:
  - `npm test` · `npm run lint` · `npm run typecheck` · `npm run check:templates` · `npm run build:styles`

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `module/apps/actor-sheet/present.mjs` | Pure presenters. Snapshot + plain objects in, view objects out. No `game`, no documents, no `canvas`. |
| `module/apps/actor-sheet/context.mjs` | Per-tab context builders. Reads documents, `game.settings`, the board; delegates all arithmetic to `present.mjs`. |
| `module/apps/actor-sheet/sheet.mjs` | The `FGTActorSheet` class: `DEFAULT_OPTIONS`, `PARTS`, `TABS`, action handlers. Moved from `index.mjs`. |
| `templates/actor/header.hbs` | Portrait, name, identity line, three bars, badges. |
| `templates/actor/nav.hbs` | The vertical icon tab rail. |
| `templates/actor/overview.hbs` | Parameters, combat, status, compulsions, budget, pools, actions, type-specific blocks. |
| `templates/actor/abilities.hbs` | Ability cards. |
| `templates/actor/effects.hbs` | Effect rows, immunities, auras, modifier table. |
| `templates/actor/details.hbs` | Identity editors, biography, notes, reference data. |
| `styles/src/_tokens.scss` | Every colour as a custom property, both themes. |
| `styles/src/_shell.scss` | Window, header, nav rail, tab panes. |
| `styles/src/_cards.scss` | Ability cards, stat tiles, pip rows, bars. |
| `styles/src/_effects.scss` | Effect rows, modifier table. |
| `styles/src/_editor.scss` | The ability editor. |
| `styles/src/_apps.scss` | Summon dialog, log viewer, HUD, chat — moved unchanged. |
| `test/unit/sheet-present.test.mjs` | Tests for `present.mjs`. |
| `test/unit/scheduler-periodic.test.mjs` | Test for the extracted `periodicDamageFor`. |

**Modify:**

| Path | Change |
|---|---|
| `module/apps/index.mjs` | Reduced to registration; re-exports `FGTActorSheet`, `FGTItemSheet`. |
| `module/engine/scheduler.mjs` | Extract `periodicDamageFor(instance, unit)` from `tickPeriodics`; export it. |
| `module/apps/ability-editor.mjs` | New fields, SVG schematics, typed phase editors. |
| `templates/apps/ability-editor.hbs` | Rewritten layout. |
| `module/fgt.mjs:126-131` | Drop the `fgt-master-panel` partial registration. |
| `styles/src/fgt.scss` | Becomes `@use` of the partials. |
| `lang/en.json` | Every new key. |
| `docs/29-user-interface.md`, `docs/45-implementation-status.md` | Documentation. |

**Delete:** `templates/actor/unit.hbs`, `templates/actor/master.hbs` (content moves into the tab templates).

---

## Task 1: `periodicDamageFor` — one implementation of periodic damage

The Effects tab must show Poison stage 3 as **80**, and as **160** when Deadly Poison is
also held. `tickPeriodics` computes this today with a module-private `amplify`, so a sheet
could only get the number by reimplementing it. Extract it first, so nothing downstream is
tempted to copy it.

**Files:**
- Modify: `module/engine/scheduler.mjs:820-850` (inside `tickPeriodics`), `module/engine/scheduler.mjs:870-882` (`amplify`)
- Test: `test/unit/scheduler-periodic.test.mjs`

**Interfaces:**
- Consumes: `PERIODICS`, `AMPLIFIERS` (both already in `scheduler.mjs`)
- Produces: `periodicDamageFor(instance, unit) → number|null` — `null` when the instance's
  `defId` has no periodic entry. Task 6 consumes it.

- [ ] **Step 1: Write the failing test**

```js
/**
 * @file Periodic damage is computed in one place.
 * @see docs/29-user-interface.md
 */

import { describe, it, expect } from "vitest";
import { periodicDamageFor } from "../../module/engine/scheduler.mjs";

describe("periodicDamageFor", () => {
  it("is null for an effect with no periodic tick", () => {
    expect(periodicDamageFor({ defId: "defUp", stage: 0 }, { effects: [] })).toBe(null);
  });

  it("doubles Poison per stage — the number D29.4 says players get wrong", () => {
    const unit = { effects: ["poison"] };
    expect(periodicDamageFor({ defId: "poison", stage: 1 }, unit)).toBe(20);
    expect(periodicDamageFor({ defId: "poison", stage: 3 }, unit)).toBe(80);
    expect(periodicDamageFor({ defId: "poison", stage: 4 }, unit)).toBe(160);
  });

  it("treats stage 0 as stage 1, as the tick does", () => {
    expect(periodicDamageFor({ defId: "poison", stage: 0 }, { effects: [] })).toBe(20);
  });

  it("applies Deadly Poison's amplifier, so Stage 4 reads 320 not 160", () => {
    const unit = { effects: ["poison", "deadlyPoison"] };
    expect(periodicDamageFor({ defId: "poison", stage: 4 }, unit)).toBe(320);
  });

  it("does not amplify an effect the amplifier does not name", () => {
    const unit = { effects: ["burn", "deadlyPoison"] };
    expect(periodicDamageFor({ defId: "burn", stage: 0 }, unit)).toBe(50);
  });

  it("scales Curse by stage", () => {
    expect(periodicDamageFor({ defId: "curse", stage: 3 }, { effects: [] })).toBe(75);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/scheduler-periodic.test.mjs`
Expected: FAIL — `periodicDamageFor is not a function`.

- [ ] **Step 3: Extract the function**

In `module/engine/scheduler.mjs`, add below `amplify` (which stays, now with one caller):

```js
/**
 * What one periodic effect instance deals to its bearer right now.
 *
 * The **only** implementation. `tickPeriodics` emits it and the Effects tab
 * displays it, because a sheet that recomputes "20 × 2^(stage−1), doubled if
 * Deadly Poison is held" is a second copy of Appendix A §A.12 — and the copy
 * is the one nobody updates when a stage curve changes.
 *
 * Pure, so the sheet may call it: it reads the instance and the bearer's
 * effect list and nothing else.
 *
 * @param {object} instance an entry from `unit.effectInstances`
 * @param {object} unit the bearer's snapshot, for the amplifier lookup
 * @returns {number|null} `null` when this effect has no periodic tick at all
 */
export function periodicDamageFor(instance, unit) {
  const spec = PERIODICS[instance?.defId];
  if (!spec) return null;
  return amplify(spec.amount(instance), instance.defId, unit ?? {});
}
```

Then replace the computation inside `tickPeriodics` so there is one implementation:

```js
      const amount = periodicDamageFor(e, u);
```

(the `const amount = amplify(spec.amount(e), e.defId, u);` line it replaces).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/scheduler-periodic.test.mjs test/unit/scheduler.test.mjs`
Expected: PASS, both files. The existing scheduler tests must be unaffected — this is a
pure extraction.

- [ ] **Step 5: Commit**

```bash
git add module/engine/scheduler.mjs test/unit/scheduler-periodic.test.mjs
git commit -m "Extract the one implementation of periodic damage"
```

---

## Task 2: `present.mjs` — the pure presenters

Everything the sheet computes, in one module with no globals. This is the whole reason the
sheet is being split: `canUseAbility`'s refusal reasons, tick arithmetic, effect grouping
and granted-step display are all rules a test can pin, and none of them need a world.

**Files:**
- Create: `module/apps/actor-sheet/present.mjs`
- Test: `test/unit/sheet-present.test.mjs`

**Interfaces:**
- Consumes: `periodicDamageFor` (Task 1); `resolveTicks`, `parseTick`, `formatTick` from
  `module/domain/tick.mjs`; `Rank` from `module/domain/rank.mjs`.
- Produces, all consumed by Task 4–7's `context.mjs`:
  - `resourceBar(resource) → {value, max, pct, label, undamageable}`
  - `parameterTiles(parameters, grantedSteps) → Array<{key, rank, authored, steps, granted}>`
  - `remainingTurns(expiryTick, currentTick) → number|null`
  - `abilityState(verdict, {turnsPerRound}) → {ok, label, detail}`
  - `abilityCost(cost, master) → {kind, amount, label, affordable}|null`
  - `groupEffects(instances, defs, unit) → {buffs, debuffs, statuses, unknown}`
  - `describeModifier(mod) → {key, value, source, predicate}`

- [ ] **Step 1: Write the failing test**

```js
/**
 * @file The sheet's arithmetic, held without a world.
 * @see docs/29-user-interface.md §29.2
 *
 * Every function here is pure by construction. The point of the split is that
 * "Cooldown 4◈ (12 turns)" and "Poison Stage 3 → 80" are rules with an answer,
 * and a rule with an answer belongs in a test rather than in a template.
 */

import { describe, it, expect } from "vitest";
import {
  resourceBar, parameterTiles, remainingTurns,
  abilityState, abilityCost, groupEffects, describeModifier,
} from "../../module/apps/actor-sheet/present.mjs";

describe("resourceBar", () => {
  it("computes a percentage", () => {
    expect(resourceBar({ value: 500, max: 1000 })).toMatchObject({ pct: 50, label: "500 / 1000" });
  });

  it("calls null max undamageable rather than drawing an empty bar", () => {
    // `null` health is intrinsic -- Pale Rider, the Kagome Spirits -- and a
    // zero-width bar reads as "about to die", which is the opposite.
    expect(resourceBar({ value: null, max: null })).toMatchObject({ undamageable: true, pct: 0 });
  });

  it("does not divide by zero", () => {
    expect(resourceBar({ value: 0, max: 0 })).toMatchObject({ pct: 0 });
  });

  it("clamps a value above its maximum", () => {
    expect(resourceBar({ value: 1200, max: 1000 })).toMatchObject({ pct: 100 });
  });
});

describe("parameterTiles", () => {
  it("shows authored and granted apart when a step was granted", () => {
    // §5.6: a sheet that shows "B" where the Servant was written "C" and
    // granted one step is a sheet nobody can check.
    const tiles = parameterTiles({ str: "B", end: "C" }, { str: 1, end: 0 });
    expect(tiles.find((t) => t.key === "str")).toMatchObject({
      rank: "B", authored: "C", steps: 1, granted: true,
    });
  });

  it("leaves an ungranted parameter with no arrow", () => {
    const tiles = parameterTiles({ end: "C" }, { end: 0 });
    expect(tiles[0]).toMatchObject({ key: "end", rank: "C", granted: false, authored: null });
  });

  it("renders an unset parameter as a dash rather than as empty", () => {
    expect(parameterTiles({ luc: "" }, {})[0]).toMatchObject({ key: "luc", rank: "—" });
  });
});

describe("remainingTurns", () => {
  it("is the difference between expiry and now", () => {
    expect(remainingTurns(24, 20)).toBe(4);
  });

  it("is null out of combat, where there is no tick to count from", () => {
    expect(remainingTurns(24, null)).toBe(null);
  });

  it("is null for an effect with no expiry", () => {
    expect(remainingTurns(null, 20)).toBe(null);
  });

  it("never goes negative", () => {
    expect(remainingTurns(18, 20)).toBe(0);
  });
});

describe("abilityState", () => {
  const ctx = { turnsPerRound: 3 };

  it("reports Ready when the gate allows it", () => {
    expect(abilityState({ ok: true }, ctx)).toMatchObject({ ok: true, label: "FGT.Ability.Ready" });
  });

  it("converts a cooldown to both notations", () => {
    // "12" tells a player nothing about when; "4◈ (12 turns)" tells them both.
    expect(abilityState({ ok: false, reason: "cooldown", detail: { remaining: 12 } }, ctx))
      .toMatchObject({ ok: false, label: "FGT.Ability.Cooldown", detail: { remaining: 12, ticks: "4◈" } });
  });

  it("keeps a part-round cooldown honest rather than rounding it to a tick", () => {
    expect(abilityState({ ok: false, reason: "cooldown", detail: { remaining: 4 } }, ctx))
      .toMatchObject({ detail: { remaining: 4, ticks: "1⅓◈" } });
  });

  it("reports an exhausted whole-match budget with both numbers", () => {
    expect(abilityState({ ok: false, reason: "exhausted", detail: { maxUses: 11, timesUsed: 11 } }, ctx))
      .toMatchObject({ ok: false, label: "FGT.Ability.Exhausted", detail: { maxUses: 11, timesUsed: 11 } });
  });

  it("reports a round gate with how far away it is", () => {
    expect(abilityState({ ok: false, reason: "round", detail: { requiresRound: 6, round: 4 } }, ctx))
      .toMatchObject({ label: "FGT.Ability.FromRound", detail: { requiresRound: 6, away: 2 } });
  });

  it("passes an unrecognised reason through rather than dropping it", () => {
    // A refusal with no label is a disabled button with no explanation, which
    // is the one thing D29.2 forbids.
    expect(abilityState({ ok: false, reason: "someNewGate" }, ctx))
      .toMatchObject({ ok: false, label: "FGT.Ability.Refused.someNewGate" });
  });
});

describe("abilityCost", () => {
  it("states affordability rather than implying it", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 53 }, { name: "Jinako", health: { value: 118 } }))
      .toMatchObject({ kind: "masterHealth", amount: 53, affordable: true });
  });

  it("marks an unaffordable cost", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 53 }, { name: "Jinako", health: { value: 40 } }))
      .toMatchObject({ affordable: false });
  });

  it("treats a Free Servant's Sustainability cost as its own", () => {
    expect(abilityCost({ kind: "sustainability", amount: 2 }, null))
      .toMatchObject({ kind: "sustainability", amount: 2 });
  });

  it("is null when there is no cost", () => {
    expect(abilityCost(null, null)).toBe(null);
  });

  it("is not affordable when a contracted Servant has no Master at all", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 53 }, null))
      .toMatchObject({ affordable: false });
  });
});

describe("groupEffects", () => {
  const defs = {
    defUp: { id: "defUp", name: "Def Up", valence: "buff" },
    poison: { id: "poison", name: "Poison", valence: "debuff" },
    madEnhancement: { id: "madEnhancement", name: "Mad Enhancement", valence: "neither", unremovable: true },
  };
  const lookup = (id) => defs[id] ?? null;

  it("groups by the definition's valence", () => {
    const out = groupEffects(
      [{ defId: "defUp" }, { defId: "poison" }, { defId: "madEnhancement" }],
      lookup, { effects: [] },
    );
    expect(out.buffs.map((e) => e.defId)).toEqual(["defUp"]);
    expect(out.debuffs.map((e) => e.defId)).toEqual(["poison"]);
    expect(out.statuses.map((e) => e.defId)).toEqual(["madEnhancement"]);
  });

  it("surfaces an instance with no definition rather than dropping it", () => {
    // A silently dropped effect is the failure mode this project keeps
    // finding: it loads, it does nothing, and nothing reports it.
    const out = groupEffects([{ defId: "notInRegistry" }], lookup, { effects: [] });
    expect(out.unknown.map((e) => e.defId)).toEqual(["notInRegistry"]);
  });

  it("carries the computed periodic damage on the row", () => {
    const out = groupEffects([{ defId: "poison", stage: 3 }], lookup, { effects: ["poison"] });
    expect(out.debuffs[0]).toMatchObject({ stage: 3, periodic: 80 });
  });

  it("marks an unremovable effect so no [x] is offered for it", () => {
    const out = groupEffects([{ defId: "madEnhancement" }], lookup, { effects: [] });
    expect(out.statuses[0]).toMatchObject({ removable: false });
  });
});

describe("describeModifier", () => {
  it("renders a predicate as text rather than as [object Object]", () => {
    expect(describeModifier({ key: "atkUp", value: 50, source: "Mana Burst", predicate: ["attack:kind:np"] }))
      .toMatchObject({ key: "atkUp", value: 50, source: "Mana Burst", predicate: "attack:kind:np" });
  });

  it("has no predicate text when the modifier is unconditional", () => {
    expect(describeModifier({ key: "atkUp", value: 50 })).toMatchObject({ predicate: null });
  });

  it("flattens a nested predicate clause to something readable", () => {
    expect(describeModifier({ key: "x", value: 1, predicate: [{ not: "attack:component:str" }] }))
      .toMatchObject({ predicate: 'not attack:component:str' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/sheet-present.test.mjs`
Expected: FAIL — cannot resolve `module/apps/actor-sheet/present.mjs`.

- [ ] **Step 3: Write `present.mjs`**

Create `module/apps/actor-sheet/present.mjs`. Header:

```js
/**
 * @file The sheet's arithmetic, with no world in it.
 * @see docs/29-user-interface.md §29.2
 *
 * Layer 4, but deliberately **pure**: no `game`, no documents, no `canvas`.
 * Everything here is a question with an answer -- what percentage that bar is,
 * how many turns are left on that effect, why that button is disabled -- and a
 * question with an answer belongs in a test rather than in a template that can
 * only be checked by opening it.
 *
 * `context.mjs` is the impure half: it fetches, and hands the results here.
 */
```

Implementations, each with its own JSDoc block:

```js
export function resourceBar(resource) {
  const max = resource?.max ?? null;
  const value = resource?.value ?? null;
  // `null` max is intrinsically undamageable, not "zero left".
  if (max === null) return { value, max, pct: 0, label: "—", undamageable: true };
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(((value ?? 0) / max) * 100))) : 0;
  return { value: value ?? 0, max, pct, label: `${value ?? 0} / ${max}`, undamageable: false };
}

export function parameterTiles(parameters, grantedSteps = {}) {
  return Object.entries(parameters ?? {}).map(([key, value]) => {
    const steps = grantedSteps?.[key] ?? 0;
    const rank = value ? String(value) : "—";
    return {
      key,
      rank,
      steps,
      granted: steps > 0,
      // The rank it was WRITTEN with, recovered by stepping back down.
      authored: steps > 0 ? (Rank.parseOrNull(rank)?.shift(-steps)?.toString() ?? null) : null,
    };
  });
}

export function remainingTurns(expiry, tick) {
  if (expiry === null || expiry === undefined) return null;
  if (tick === null || tick === undefined) return null;
  return Math.max(0, expiry - tick);
}
```

`abilityState` maps each `canUseAbility` reason to a localization key and enriches the
detail. The reasons `canUseAbility` can return are `cooldown`, `exhausted`, `round`,
`oncePerTurn`, plus the exclusion and requirement reasons — read `module/rules/costs.mjs`
and cover every `return { ok: false, reason: … }` in it. The unknown-reason fallback
(`FGT.Ability.Refused.${reason}`) is required: a new gate must never produce a silent
disabled button.

```js
export function abilityState(verdict, { turnsPerRound = 3 } = {}) {
  if (verdict?.ok !== false) return { ok: true, label: "FGT.Ability.Ready", detail: {} };
  const detail = { ...(verdict.detail ?? {}) };
  switch (verdict.reason) {
    case "cooldown":
      // Both notations: ◈ is what the sheet is authored in, turns is what the
      // player counts down.
      detail.ticks = ticksLabel(detail.remaining ?? 0, turnsPerRound);
      return { ok: false, label: "FGT.Ability.Cooldown", detail };
    case "exhausted":
      return { ok: false, label: "FGT.Ability.Exhausted", detail };
    case "round":
      detail.away = Math.max(0, (detail.requiresRound ?? 0) - (detail.round ?? 0));
      return { ok: false, label: "FGT.Ability.FromRound", detail };
    default:
      return { ok: false, label: `FGT.Ability.Refused.${verdict.reason}`, detail };
  }
}
```

`ticksLabel(turns, turnsPerRound)` is a local helper rendering `12, 3 → "4◈"` and
`4, 3 → "1⅓◈"`. Use the vulgar fractions `⅓ ⅔ ¼ ½ ¾` for the exact cases and fall back to
`n/d◈`; whole rounds get no fraction. Do **not** reach for `formatTick` — it renders a
parsed expression, and what is in hand is a turn count.

`abilityCost` mirrors `npCost`'s two `kind`s (`masterHealth`, `sustainability`), sets
`affordable` from the payer's current value, and returns `null` for no cost. A
`masterHealth` cost with no master is `affordable: false` — a contracted Servant whose
Master is gone cannot pay.

`groupEffects(instances, lookup, unit)` takes a **lookup function** rather than a registry
object, which is what keeps the module pure — `context.mjs` passes
`(id) => EffectRegistry.get(id)`. Each row carries `defId`, `name` (the definition's, or
the raw `defId` when unknown), `magnitude`, `stage`, `uses`, `expiry`, `sourceUnitId`,
`sourceAbilityId`, `suppressed`, `removable` (`!def.unremovable`), and
`periodic: periodicDamageFor(instance, unit)`. Valence `buff` → `buffs`, `debuff` →
`debuffs`, anything else → `statuses`; no definition → `unknown`.

`describeModifier` renders a predicate array to a readable string: a bare string stays as
is, `{not: "x"}` becomes `not x`, other objects become their single `key value` pair, and
clauses join with `" · "`. Empty or absent → `null`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/sheet-present.test.mjs`
Expected: PASS, all cases.

- [ ] **Step 5: Check the layer boundary and types**

Run: `npm run lint && npm run typecheck`
Expected: clean. If `check-layers` complains, `present.mjs` has imported something above
its layer — it may only import from `domain`, `rules` and `engine`.

- [ ] **Step 6: Commit**

```bash
git add module/apps/actor-sheet/present.mjs test/unit/sheet-present.test.mjs
git commit -m "Give the sheet's arithmetic somewhere testable to live"
```

---

## Task 3: The style token layer

Do this before any template, so every template written after it has tokens to use rather
than hex codes to inline.

**Files:**
- Create: `styles/src/_tokens.scss`, `_shell.scss`, `_cards.scss`, `_effects.scss`, `_editor.scss`, `_apps.scss`
- Modify: `styles/src/fgt.scss`

**Interfaces:**
- Produces: the custom-property names Tasks 4–9's templates use. Name them once here and
  do not invent variants later:
  `--fgt-bg --fgt-bg-raised --fgt-bg-sunken --fgt-ink --fgt-ink-dim --fgt-line
   --fgt-gold --fgt-crimson --fgt-ok --fgt-warn --fgt-danger
   --fgt-health --fgt-agility --fgt-luck --fgt-faction`

- [ ] **Step 1: Write `_tokens.scss`**

Every colour currently hardcoded at its use site in `fgt.scss` (`#7a7971`, `#b07`, `#3a3`,
`#c80`, `#b33`, `#666`) becomes a token. §29.9 requires both themes; Foundry v14 puts
`.theme-light` / `.theme-dark` on the application root.

```scss
// Colour, in one place, for both themes.
//
// §29.9 asks for exactly this and the file it replaced hardcoded six hex
// values at their use sites -- so "the system respects Foundry's light/dark
// themes" was true of the frame and false of everything inside it.
.fgt {
  --fgt-bg: #17161c;
  --fgt-bg-raised: #21202a;
  --fgt-bg-sunken: #100f14;
  --fgt-ink: #e8e3d8;
  --fgt-ink-dim: #a09a8e;
  --fgt-line: #3a3644;
  --fgt-gold: #c9a227;
  --fgt-crimson: #9b2226;
  --fgt-ok: #4c9a5b;
  --fgt-warn: #c8860d;
  --fgt-danger: #c0392b;
  --fgt-health: #a03030;
  --fgt-agility: #2f7d6d;
  --fgt-luck: #7a5ea8;
  --fgt-faction: var(--fgt-gold);
}

.theme-light .fgt,
.fgt.theme-light {
  --fgt-bg: #f4f1e8;
  --fgt-bg-raised: #fffdf7;
  --fgt-bg-sunken: #e6e1d3;
  --fgt-ink: #23201a;
  --fgt-ink-dim: #6a6458;
  --fgt-line: #c9c1ad;
}
```

- [ ] **Step 2: Split the existing file**

Move the existing rules out of `styles/src/fgt.scss` by area, changing nothing but the
hardcoded colours, which become tokens:
- `.fgt-editor` → `_editor.scss`
- `.fgt-summon`, `.fgt-hud`, `.fgt-card__waiting`, log viewer, chat → `_apps.scss`
- `.fgt-list`, `.fgt-resource`, `.fgt-parameter` → `_cards.scss`
- `.application.fgt.sheet`, `.fgt-sheet` → `_shell.scss`

`styles/src/fgt.scss` becomes:

```scss
// F/GT — Fate/Grail Tactics
// Compiled to styles/fgt.css. See docs/29-user-interface.md.
@use "tokens";
@use "shell";
@use "cards";
@use "effects";
@use "editor";
@use "apps";
```

- [ ] **Step 3: Build and confirm nothing was lost**

```bash
npm run build:styles
```

Expected: no Sass error. `styles/fgt.css` should still contain every selector it did
before — check with `grep -c '^\.' styles/fgt.css` before and after; the count must not
drop.

- [ ] **Step 4: Commit**

```bash
git add styles/
git commit -m "Put colour in one place, for both themes"
```

---

## Task 4: The sheet shell — parts, tabs, header, nav

The structural move. At the end of this task the sheet has four working tabs, a real
header, and Overview showing what `unit.hbs` showed — no new fields yet, so a regression
is visible as a regression rather than lost among new content.

**Files:**
- Create: `module/apps/actor-sheet/sheet.mjs`, `module/apps/actor-sheet/context.mjs`,
  `templates/actor/header.hbs`, `templates/actor/nav.hbs`, `templates/actor/overview.hbs`,
  `templates/actor/abilities.hbs`, `templates/actor/effects.hbs`, `templates/actor/details.hbs`
- Modify: `module/apps/index.mjs`, `module/fgt.mjs:126-131`, `lang/en.json`, `styles/src/_shell.scss`
- Delete: `templates/actor/unit.hbs`

**Interfaces:**
- Consumes: `present.mjs` (Task 2), the tokens (Task 3).
- Produces: `FGTActorSheet` (re-exported from `module/apps/index.mjs` so
  `module/apps/hud/token-hud.mjs`'s `FGTActorSheet.declareAttack` keeps resolving), and
  `buildContext(actor, sheet)` in `context.mjs`, which Tasks 5–7 extend.

- [ ] **Step 1: Move the class**

Move `FGTActorSheet` from `module/apps/index.mjs` into
`module/apps/actor-sheet/sheet.mjs` **unchanged first**, with `index.mjs` re-exporting it.
Run `npm run lint && npm run typecheck` and confirm clean before changing behaviour. A move
and a rewrite in one commit is two failures wearing one hat.

- [ ] **Step 2: Declare parts and tabs**

In `sheet.mjs`:

```js
  static DEFAULT_OPTIONS = {
    classes: ["fgt", "sheet", "actor"],
    position: { width: 780, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { /* unchanged, plus: */ removeEffect: FGTActorSheet.#onRemoveEffect },
  };

  static PARTS = {
    header:    { template: "systems/fgt/templates/actor/header.hbs" },
    nav:       { template: "systems/fgt/templates/actor/nav.hbs" },
    overview:  { template: "systems/fgt/templates/actor/overview.hbs",  scrollable: [""] },
    abilities: { template: "systems/fgt/templates/actor/abilities.hbs", scrollable: [""] },
    effects:   { template: "systems/fgt/templates/actor/effects.hbs",   scrollable: [""] },
    details:   { template: "systems/fgt/templates/actor/details.hbs",   scrollable: [""] },
  };

  // §29.3's Master block was a PARTIAL inside one body part, because two parts
  // meant two scroll containers on one visible page and the scroll position
  // ApplicationV2 preserves is per part -- so a Master editing a stat watched
  // its Command Spell tracker jump.
  //
  // That reasoning is about two panels visible AT ONCE. With tabs one is
  // visible at a time, so per-part scroll is the behaviour we want rather than
  // the defect, and the Master block becomes Overview content.
  static TABS = {
    primary: {
      initial: "overview",
      labelPrefix: "FGT.Tab",
      tabs: [
        { id: "overview",  icon: "fa-solid fa-address-card" },
        { id: "abilities", icon: "fa-solid fa-bolt" },
        { id: "effects",   icon: "fa-solid fa-person-rays" },
        { id: "details",   icon: "fa-solid fa-book-open" },
      ],
    },
  };

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    const part = await super._preparePartContext(partId, context, options);
    // The framework prepares `context.tabs`; a tab PART needs its own entry so
    // the template can set `data-tab` and the active class.
    if (partId in (context.tabs ?? {})) part.tab = context.tabs[partId];
    return part;
  }
```

- [ ] **Step 3: Write `context.mjs` with what the old sheet had**

`buildContext` returns exactly the keys `_prepareContext` returned before —
`system`, `fields`, `abilities`, `noblePhantasms`, `factionChoices`, `hasFactions`,
`hasFaction`, `isEditable`, `canContract`, `canRollSetup`, `setupLocked`, `isMaster`, and
the Master spread — plus:

```js
    isGM: game.user.isGM,
    actorType: actor.type,
    // One snapshot per render, shared by every tab. Built here because it
    // reaches for the canvas and the combat, which `present.mjs` may not.
    snapshot: unitSnapshot(actor),
    tick: currentTick(),
    round: currentRound(),
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    header: headerContext(actor, snapshot),
```

`masterContext` and `describeServant` move here from `index.mjs` unchanged.

- [ ] **Step 4: Write `header.hbs` and `nav.hbs`**

`header.hbs`: portrait (`data-edit="img"`), name input, the identity line
(`classContainer` · alignment · region), true name when `identityRevealed` or `isGM`,
the faction `<select>` with its existing `NoFactionHint` / `NoFactionsAtAll` hints, three
bars, and badges for `defeated` / `concealed` / `modesLocked`.

A bar is a `<div>` with `style="width: {{pct}}%"` and the `label` printed **on** it —
never colour alone (D29.7). An `undamageable` bar renders the word, not an empty track.

`nav.hbs`:

```hbs
<nav class="fgt-nav" data-group="primary" role="tablist">
  {{#each tabs as |tab|}}
    <a class="fgt-nav__item {{tab.cssClass}}" data-action="tab" data-group="{{tab.group}}"
       data-tab="{{tab.id}}" role="tab" data-tooltip="{{localize tab.label}}"
       aria-label="{{localize tab.label}}" aria-selected="{{tab.active}}">
      <i class="{{tab.icon}}"></i>
    </a>
  {{/each}}
</nav>
```

`data-action="tab"` is ApplicationV2's built-in tab action — do not write a click handler.

- [ ] **Step 5: Move `unit.hbs`'s content into `overview.hbs`, stub the other three**

Each tab template's root carries the tab plumbing:

```hbs
<section class="fgt-tab {{tab.cssClass}}" data-tab="{{tab.id}}" data-group="{{tab.group}}">
```

`abilities.hbs` gets the ability lists from `unit.hbs` for now; `effects.hbs` and
`details.hbs` get a localized empty state. Delete `unit.hbs`.

- [ ] **Step 6: Drop the partial registration**

In `module/fgt.mjs`, remove the `loadTemplates({"fgt-master-panel": …})` call and the
`Hooks.once("setup")` block around it **only if nothing else in that block remains** — the
effect registry load lives there too, so keep the hook and delete the two lines.

- [ ] **Step 7: Add the keys**

`lang/en.json` needs `FGT.Tab.overview`, `FGT.Tab.abilities`, `FGT.Tab.effects`,
`FGT.Tab.details`, and every other new literal. `labelPrefix: "FGT.Tab"` produces
`FGT.Tab.<id>`, so the ids are lowercase and the keys must match exactly.

- [ ] **Step 8: Verify**

```bash
npm run check:templates && npm test && npm run lint && npm run typecheck && npm run build:styles
```

Expected: all clean. The i18n test names any key you forgot.

- [ ] **Step 9: Verify live**

In world `FGT_2026` as GM, open EMIYA. Confirm: four tabs, each clickable; the header shows
name, bars and identity; Overview shows what the old sheet showed; the console has no
render error. Screenshot it.

- [ ] **Step 10: Commit**

```bash
git add module/apps templates/actor module/fgt.mjs lang/en.json styles/
git commit -m "Give the sheet somewhere to put the other forty fields"
```

---

## Task 5: The Overview tab

**Files:**
- Modify: `templates/actor/overview.hbs`, `module/apps/actor-sheet/context.mjs`,
  `styles/src/_cards.scss`, `lang/en.json`
- Delete: `templates/actor/master.hbs` (its content moves into `overview.hbs`)

**Interfaces:**
- Consumes: `parameterTiles`, `resourceBar` (Task 2); `zonStatus` from `module/rules/zon.mjs`.
- Produces: `overviewContext(actor, snapshot, ctx)` in `context.mjs`.

- [ ] **Step 1: Build the context**

`overviewContext` returns:

```js
{
  parameters: parameterTiles(sys.parameters, sys.grantedSteps),
  combat: {
    baseAttack: sys.baseAttack,
    normalAttack: sys.normalAttack,          // mode, component, bands
    mov: sys.mov, range: sys.range,
    detect: { value: snapshot.detect, derived: sys.detect === null },
    sustainability: { max: sys.sustainability, remaining: sys.sustainabilityRemaining },
    facing: sys.facing,
  },
  // Documented as being "here so a sheet can explain the number", and unread
  // by any sheet until now.
  deltas: snapshot.statDeltas ?? [],
  status: { contract, masterName, zon, outsideZon, zonDistance, penalty, zonExempt, boundToPlatformId },
  compulsions: snapshot.compulsionRules ?? [],
  budget: { acted, moved, attacked, movedPanels, mov, moveSegments, usedActiveSkill, itemTransfers },
  pools: Object.entries(sys.resources ?? {}).map(([key, r]) => ({ key, ...r })),
}
```

Plus the type-specific blocks, each guarded by `actorType`: the Master spread (unchanged),
platform (`footprint`, `capacity`, `level`, `ownerId`, `upkeep`, `crossLevel`), summon
(`summonerId`, `expiresAt`, `countsTowardBudget`, `actsOncePerTurn`).

Pip strings are built **here**, not in the template — Foundry registers no `range` helper
and a template that invents one throws at render. The existing `masterContext` already does
this for Command Spells; follow it.

- [ ] **Step 2: Write the template**

Sections in this order: Parameters · Combat · Status · Compulsions · Budget · Pools ·
Actions · type-specific. A granted parameter tile reads `C ▸ B` with `(+1)` beneath. Each
`deltas` entry renders under the value it moved. A compulsion renders as an amber band with
its text — a warning that does not block (§29.9).

- [ ] **Step 3: Verify**

```bash
npm run check:templates && npm test && npm run lint
```

- [ ] **Step 4: Verify live**

Open EMIYA (check `rangeBanded` bands are listed), Our Master (Command Spell tracker,
contracted Servants, Unbound warning), and a Dragon Tooth Warrior (summon block).
Screenshot each; console clean.

- [ ] **Step 5: Commit**

```bash
git add templates/actor module/apps styles lang
git rm templates/actor/master.hbs
git commit -m "Show the numbers that decide every action"
```

---

## Task 6: The Abilities tab

**Files:**
- Modify: `templates/actor/abilities.hbs`, `module/apps/actor-sheet/context.mjs`,
  `styles/src/_cards.scss`, `lang/en.json`

**Interfaces:**
- Consumes: `abilityState`, `abilityCost` (Task 2); `classifyAbility`, `usageSpecFor`
  (`module/rules/ability-use.mjs`); `canUseAbility`, `npCost` (`module/rules/costs.mjs`);
  `currentBoard` (`module/engine/board.mjs`).

- [ ] **Step 1: Build one card per ability**

```js
/**
 * One ability, as the tab shows it.
 *
 * The state line comes from `canUseAbility` -- the SAME call `resolveAttack`
 * makes -- rather than from a second reading of the cooldown fields. A card
 * that computed its own answer would be a second implementation of §15.10, and
 * the copy is the one nobody updates.
 */
function abilityCard(item, { unit, master, round, turnsPerRound, board }) {
  const use = classifyAbility(item);
  const verdict = canUseAbility({ ability: usageSpecFor(item), unit, master, round, board });
  return {
    id: item.id,
    name: item.name,
    img: item.img,
    rank: item.system.rank,
    kind: item.system.kind ?? "skill",
    isNP: item.type === "noblePhantasm",
    use,
    active: Boolean(item.system.active),
    locked: Boolean(item.system.active && item.system.cannotDeactivate),
    state: abilityState(verdict, { turnsPerRound }),
    cost: abilityCost(verdict.cost, master),
    alsoTriggers: [...(item.system.alsoTriggers ?? [])],
    sameTurnExclusive: [...(item.system.sameTurnExclusive ?? [])],
    sameRoundExclusive: [...(item.system.sameRoundExclusive ?? [])],
    // Before the click, not after (D29.2).
    irreversible: (item.system.permanentConsequence ?? []).length > 0,
    description: item.system.description ?? "",
  };
}
```

Group into `classSkills` / `skills` / `noblePhantasms` by `system.kind`, in that order.
Content uses exactly `classSkill`, `skill` and `noblePhantasm`; anything else falls into
`skills` rather than disappearing.

Resolve `alsoTriggers` and the exclusion lists to **names** where the id matches another
item on this actor — an id on screen is a thing the reader has to look up.

- [ ] **Step 2: Write the template**

A card per ability. `use.clickable` decides button versus plain text — `classifyAbility`
already makes that call and the current list already honours it, so do not re-derive it.
Disabled buttons carry `data-tooltip` with the state's reason, never a bare grey control.
The `USE` button keeps `data-action="{{use.action}}"` and the row keeps `data-item-id`, so
the existing handlers bind unchanged.

- [ ] **Step 3: Verify**

```bash
npm run check:templates && npm test && npm run lint
```

- [ ] **Step 4: Verify live**

Open Medea (13 items — the scroll case Chapter 29 names) and EMIYA. Put an ability on
cooldown and confirm the card reads "Cooldown N◈ (M turns)" rather than going blank.
Screenshot; console clean.

- [ ] **Step 5: Commit**

```bash
git add templates/actor module/apps styles lang
git commit -m "Say why the button is disabled, on the button"
```

---

## Task 7: The Effects tab

**Files:**
- Modify: `templates/actor/effects.hbs`, `module/apps/actor-sheet/context.mjs`,
  `module/apps/actor-sheet/sheet.mjs` (the `removeEffect` action), `styles/src/_effects.scss`,
  `lang/en.json`

**Interfaces:**
- Consumes: `groupEffects`, `describeModifier`, `remainingTurns` (Task 2);
  `periodicDamageFor` (Task 1); `EffectRegistry` (`module/rules/registry.mjs`).

- [ ] **Step 1: Build the context**

```js
  const groups = groupEffects(
    snapshot.effectInstances ?? [],
    (id) => EffectRegistry.get(id),   // the lookup, so `present.mjs` stays pure
    snapshot,
  );
```

Then decorate each row in `context.mjs` — the impure half — with what needs the world:
`remaining: remainingTurns(row.expiry, tick)`, `sourceName` from
`game.actors.get(row.sourceUnitId)?.name`, and `sourceAbility` from the source actor's
item. An unresolvable source renders as "unknown source", not as a raw id.

Also collect `immunities`, `auras`, and `modifiers: snapshot.modifiers.map(describeModifier)`.

- [ ] **Step 2: Add the remove action**

```js
  /**
   * Remove one effect instance.
   *
   * GM only, and refused for an `unremovable` definition -- the template does
   * not offer the control, and this refuses anyway, because a control that is
   * only hidden is not a rule.
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveEffect(_event, target) {
    if (!game.user.isGM) return;
    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.document.effects.get(id);
    if (!effect) return;
    const def = EffectRegistry.get(effect.system?.defId ?? effect.name);
    if (def?.unremovable) {
      ui.notifications.warn(game.i18n.format("FGT.Effect.Unremovable", { name: effect.name }));
      return;
    }
    await effect.delete();
  }
```

- [ ] **Step 3: Write the template**

Three groups — BUFFS / DEBUFFS / STATUSES — then `unknown` under a "no definition" heading,
then Immunities, Auras, and the modifier table in a `<details>`. A row with a `periodic`
value prints it: `Poison  Stage 3  ·  80 damage at end of Round`.

- [ ] **Step 4: Verify**

```bash
npm run check:templates && npm test && npm run lint
```

- [ ] **Step 5: Verify live**

EMIYA carries live `dodge` and `defUp` instances in `FGT_2026` — confirm both appear with
their magnitude, source ability and remaining turns. Apply Poison at stage 3 to a Test
Dummy from the console and confirm the row reads 80. Screenshot; console clean.

- [ ] **Step 6: Commit**

```bash
git add templates/actor module/apps styles lang
git commit -m "Show what is on the unit, and what it is doing"
```

---

## Task 8: The Details tab

**Files:**
- Modify: `templates/actor/details.hbs`, `module/apps/actor-sheet/context.mjs`,
  `styles/src/_cards.scss`, `lang/en.json`

- [ ] **Step 1: Build the context**

`SetField`s arrive as `Set`s. Spread them to arrays in the context — a template calling
`.includes` on a `Set` gets nothing and reports nothing:

```js
    servantClasses: [...(sys.servantClasses ?? [])],
    region: [...(sys.region ?? [])],
    attributes: [...(sys.attributes ?? [])],
    essences: [...(sys.essences ?? [])],
```

Also: `hiddenDamage` as `{cause, amount}` rows, `healthWatermarks` as `{fraction, tick}`
rows, `turnState` and `roundState` as label/value rows, and non-ability items.

- [ ] **Step 2: Write the template**

Identity editors first (GM-editable, styled as text until focused), then `biography` and
`notes` through `{{editor}}`, then the reference block. `notes` is currently emitted as raw
`{{{system.notes}}}` — replace it with the editor helper.

- [ ] **Step 3: Verify**

```bash
npm run check:templates && npm test && npm run lint
```

- [ ] **Step 4: Verify live**

Edit EMIYA's alignment and confirm it saves and re-renders. Confirm biography accepts and
persists text. Screenshot; console clean.

- [ ] **Step 5: Commit**

```bash
git add templates/actor module/apps styles lang
git commit -m "Render the half of the schema nothing has ever shown"
```

---

## Task 9: The ability editor — layout and SVG schematics

The reported defect: `&__picker` is `display: flex; flex-wrap: wrap` over `<pre>`
schematics with no width constraint, so diagrams overflow their buttons and collide with
the labels of the row beneath.

**Files:**
- Modify: `templates/apps/ability-editor.hbs`, `module/apps/ability-editor.mjs`,
  `styles/src/_editor.scss`

- [ ] **Step 1: Build the SVG in the app, not the template**

`module/rules/targeting/vocabulary.mjs` stores each schematic as rows of `.` (empty),
`#` (covered) and `@` (the caster). Convert **those same rows** — inventing a second
diagram source would break the drift test that holds the picker against `expand()`.

```js
/**
 * One schematic, as an SVG grid.
 *
 * §29.6: "a GM should never have to know that `selfEdgeAdjacent` is the
 * internal name -- they should see four little diagrams and click one." The
 * diagrams were `<pre>` blocks with no width constraint, so they overflowed
 * their buttons and collided with the row beneath.
 *
 * Built from the vocabulary's OWN rows, so the drift test that holds the
 * picker against `expand()` still covers what is drawn.
 *
 * @param {string[]} rows `.` empty, `#` covered, `@` the caster
 * @returns {string} an SVG fragment
 */
function schematicSvg(rows) { /* one <rect> per cell, three fills, 8px cells */ }
```

Pass it to the template as a marked-safe string and render with `{{{a.svg}}}`.

- [ ] **Step 2: Grid the picker**

```scss
  &__picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 0.5rem;
  }
  &__option {
    display: grid;
    grid-template-rows: 4.5rem auto;   // fixed diagram box, label wraps below
    align-items: center;
    justify-items: center;
    overflow: hidden;
  }
```

- [ ] **Step 3: Verify live**

Open the editor on one of EMIYA's Noble Phantasms. Confirm no overlap at the default width
**and** at a narrowed window — the reported bug is a reflow bug, so one width proves
nothing. Screenshot both.

- [ ] **Step 4: Commit**

```bash
git add module/apps/ability-editor.mjs templates/apps/ability-editor.hbs styles
git commit -m "Stop the targeting diagrams landing on their own labels"
```

---

## Task 10: The ability editor — fields and typed phases

**Files:**
- Modify: `module/apps/ability-editor.mjs`, `templates/apps/ability-editor.hbs`, `lang/en.json`

- [ ] **Step 1: Add the missing fields**

The editor cannot currently set an ability's **name** or **description**. Add: `name`,
`img`, `description` (rich editor), `kind` (`classSkill` / `skill` / `noblePhantasm`),
`cost`, `cooldown.max` (validated through `parseTick`, with the resolved turn count shown
beside it as the duration field already does), `maxUses`, `oncePerTurn`, `requiresRound`,
`category`, `isPassive`, `isAttackSkill`, `isMode`.

- [ ] **Step 2: Type the phase editors**

Content uses these phase kinds: `applyEffects`, `damage`, `heal`, `resource`, `statChange`,
`modifyDamage`, `cooldown`, `cooldownDelta`, `removeEffect`, `teleport`,
`overrideValidation`. Give each a form over its own fields; `applyEffects` picks effect ids
from `EffectRegistry.all()` by name.

**The JSON fallback is required, not a convenience.** Phases are an `ObjectField`, a module
may add a kind (§21.4), and an editor that silently dropped a kind it could not type would
corrupt the ability on save. An unknown kind renders as a JSON textarea with parse
validation, and round-trips byte-for-byte.

- [ ] **Step 3: Verify**

```bash
npm run check:templates && npm test && npm run lint && npm run typecheck
```

- [ ] **Step 4: Verify live**

Open the editor on an EMIYA Noble Phantasm with phases. Confirm each phase renders typed,
an unknown kind falls back to JSON, and Save writes without loss — reopen and compare.

- [ ] **Step 5: Commit**

```bash
git add module/apps/ability-editor.mjs templates/apps/ability-editor.hbs lang
git commit -m "Let the ability editor set an ability's name"
```

---

## Task 11: Documentation

Per the project's standing rule, Chapter 45 alone is not enough — the affected 00–44
chapter changes too.

**Files:**
- Modify: `docs/29-user-interface.md`, `docs/45-implementation-status.md`

- [ ] **Step 1: Rewrite Chapter 29's stale claims**

Three things in it are now false:
1. The header note still lists the Master sheet, the token HUD and the ability editor as
   *"still missing"* — all three exist.
2. The same note argues §29.3's Master block is a partial *"rather than a second part"*
   because of the two-scroll-containers problem. Explain why tabs dissolve that argument
   rather than deleting the paragraph — the reasoning was right for the layout it described.
3. §29.2 specifies **five** tabs; the sheet has four, with the header carrying the values
   §29.3 says gate an action. Amend the section rather than leaving it disagreeing with
   the code.

Add the decisions from the spec to §29.12's table.

- [ ] **Step 2: Record what is still missing**

§29.6's dropdown predicate builder stays unbuilt. Say so in the chapter, in the same
"one deviation, stated plainly" voice the section already uses for the validator.

- [ ] **Step 3: Update Chapter 45**

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "Correct what Chapter 29 says the interface is"
```

---

## Self-Review

**Spec coverage.** §3.1 files → Tasks 2, 4. §3.2 parts/tabs → Task 4. §3.3 layout → Tasks
3, 4. §4.1 header → Task 4. §4.2 Overview → Task 5. §4.3 Abilities → Task 6. §4.4 Effects →
Tasks 1, 7. §4.5 Details → Task 8. §5 styles → Task 3. §6 editor → Tasks 9, 10. §7 testing
→ Tasks 1, 2 plus a live step in every task. §8 docs → Task 11.

One spec correction found while planning and carried into Task 1: §4.4 says the periodic
damage is computed "from `def.periodic`". It is not — `tickPeriodics` reads the scheduler's
own `PERIODICS` table, and the registry's `periodic` field is not what ticks. The sheet must
read the same table the scheduler does, which is why `periodicDamageFor` is extracted first.

**Type consistency.** `abilityState(verdict, {turnsPerRound})` and
`abilityCost(cost, master)` are used with those signatures in Task 6.
`groupEffects(instances, lookup, unit)` takes a lookup **function** in both Task 2 and Task
7. `periodicDamageFor(instance, unit)` is defined in Task 1 and consumed in Tasks 2 and 7.
`remainingTurns(expiry, tick)` is defined in Task 2 and consumed in Task 7. Token names are
fixed in Task 3 and not re-invented afterwards.
