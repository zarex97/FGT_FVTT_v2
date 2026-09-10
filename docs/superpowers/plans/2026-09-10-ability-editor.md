# Ability Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ability editor able to author `packs/_source/abilities/achilles-akhilleus-kosmos.yml` from an empty Item, through the UI, with no hand-written JSON — and make it reachable from Items → Create Item → Ability.

**Architecture:** A pure Layer-2 *authoring vocabulary* (`module/rules/authoring/`) describes every rule-element key, phase kind, requirement kind and timing window the engine implements: id, label, hint, doc anchor, and the fields it takes. The editor renders forms **from** those descriptors rather than from hand-written markup per keyword. Drift tests hold each table against the engine's own dispatcher in both directions, so a keyword added to the engine fails CI until a GM can author it.

**Tech Stack:** Plain ESM, Foundry ApplicationV2 + Handlebars, Vitest, Sass. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-ability-editor-design.md`

**Prerequisite:** `docs/superpowers/plans/2026-09-10-timing-window-authority.md` must be **merged first**. Task 6 imports `module/rules/windows.mjs`, which that plan creates. Do not start this plan until `npm test` passes on a branch containing it.

## Global Constraints

- **Layer rule:** `module/rules/` is Layer 2 — pure, no `game`/`canvas`/`ui`/`foundry` globals, no imports from `module/engine/` or `module/apps/`. `npm run lint` runs `tools/check-layers.mjs` and fails on a violation. **Every descriptor table is Layer 2 and must stay importable by Vitest with no Foundry present.**
- **Localization:** every user-facing string is a key in `lang/en.json`. **D29.15 — no key may be the prefix of another**; `test/unit/i18n.test.mjs` enforces it. Verify with:
  ```bash
  node -e "const j=require('./lang/en.json');const k=Object.keys(j);const bad=[];for(const a of k)for(const b of k)if(a!==b&&b.startsWith(a+'.'))bad.push(a+' < '+b);console.log(bad.length?bad.join('\n'):'no prefix collisions')"
  ```
- **D29.2:** every disabled control states its reason; no dead button with no explanation.
- **Runtime state is never editable.** `timesUsed`, `toggledAt`, `lastUsedTick`, `expended`, `recordedAttacks`, `active` are written by the engine. They appear in no descriptor and in no form — only in the raw pane.
- **`predicateList` stays validated free text.** The predicate grammar gets its own spec (design §11.2). This plan must not grow a term picker.
- **Docs travel with the commit.** Chapter 45 alone is never enough — the affected 00–44 chapter must change in the same commit.
- **Commit trailers** (every commit):
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
  ```
- **Full verification before any completion claim:** `npm test && npm run lint && npm run validate:content && npm run check:templates`.

---

## Background an executor needs

**The editor is not broken.** Measured in a live world: filling `rank`, ticking `isNP`, adding a phase and pressing Save writes them to the document correctly. Do not go looking for a functional bug. The problems are *reach* and *coverage*:

- `AbilityData.defineSchema()` has **90 fields; the editor exposes 12.**
- `AbilityEditor` is registered as **no Item sheet at all**. It opens only from the pencil on an actor's ability card (`apps/actor-sheet/sheet.mjs:369`) and from `fgt.api.dialogs.AbilityEditor`.
- `ability-editor.mjs:345` **validates** `rules`/`passiveRules`/`activeRules` and the footer says "no rule elements", while **no control can add one**.
- `PHASE_FIELDS` types four kinds content never uses (`cooldownDelta`, `modifyDamage`, `overrideValidation`, `teleport` — zero uses each) and leaves nine that it does use to raw JSON.

**The authorities each table is held against:**

| Family | Authority | Count |
|---|---|---|
| Rule elements | `EXECUTORS` in `module/rules/elements.mjs` | 54 |
| Phase kinds | `case` labels in `runPhases`, `module/engine/skill-use.mjs` | 19 distinct (20 cases; `applyEffect` aliases `applyEffects`) |
| Requirement kinds | `case` labels in `meetsRequirement`, `module/rules/items.mjs` | 24 |
| Command-spell requirements | `CS_REQUIREMENT_KINDS`, `tools/lib/content.mjs:88` | separate — see below |
| Timing windows | `ABILITY_WINDOWS`, `module/rules/windows.mjs` | 6 |
| Targeting | `TARGET_ANCHORS`/`TARGET_SHAPES`, `module/rules/targeting/vocabulary.mjs` | existing, unchanged |

**The two requirement lists must never merge.** `tools/lib/content.mjs:83` documents why: `servantInZon` asks about somebody else's Servant and `attackIsNotNP` about an attack already being resolved. An ability authoring either would ask a question with no answer.

**The pattern to copy** is `module/rules/targeting/vocabulary.mjs` and its drift tests at `test/unit/targeting.test.mjs:600-660`. Read both before Task 1. They test **both directions**, and the comment says why: the picker once offered `point` while the resolver only knew `withinRange`, so Medea's Rain of Light authored cleanly, validated, and threw the first time anyone aimed it.

---

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/authoring/fields.mjs` | **Create.** The closed set of field types a descriptor may ask for. |
| `module/rules/authoring/contract.mjs` | **Create.** `describe()`, and the shape assertions every table is checked against. |
| `module/rules/authoring/elements.mjs` | **Create.** 54 rule-element descriptors. |
| `module/rules/authoring/phases.mjs` | **Create.** 19 phase-kind descriptors. |
| `module/rules/authoring/requirements.mjs` | **Create.** 24 ability + the command-spell requirement descriptors. |
| `module/rules/authoring/timing.mjs` | **Create.** Window descriptors, derived from `rules/windows.mjs`. |
| `module/rules/authoring/ability.mjs` | **Create.** Top-level field groups, the rail order, and the per-item-type vocabulary selection. |
| `module/rules/authoring/index.mjs` | **Create.** Re-exports. |
| `module/apps/ability-editor/present.mjs` | **Create.** Pure view-model builders (D29.12). Testable with no world. |
| `module/apps/ability-editor/editor.mjs` | **Move** from `module/apps/ability-editor.mjs`. The ApplicationV2. |
| `module/apps/ability-editor/index.mjs` | **Create.** Re-export, so the two existing importers change one path. |
| `templates/apps/ability-editor.hbs` | **Modify.** Rail + descriptor-rendered sections. |
| `templates/apps/ability-editor-field.hbs` | **Create.** The one partial that renders any descriptor field. |
| `module/apps/index.mjs` | **Modify.** Sheet registration. |
| `styles/src/_editor.scss` | **Modify.** Rail and section styles. |
| `lang/en.json` | **Modify.** Labels and hints. |

---

## Task 1: The field-type vocabulary

**Files:**
- Create: `module/rules/authoring/fields.mjs`
- Test: `test/unit/authoring-fields.test.mjs`

**Interfaces:**
- Consumes: `module/domain/tick.mjs#parseTick`.
- Produces:
  - `FIELD_TYPES: readonly string[]`
  - `isFieldType(type: unknown): boolean`
  - `validateFieldValue(type: string, value: unknown): {ok: boolean, reason?: string}`

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-fields.test.mjs`:

```js
/**
 * @file The closed set of input kinds a descriptor may ask for.
 * @see module/rules/authoring/fields.mjs, docs/29-user-interface.md §29.6
 *
 * Closed on purpose: the editor has one renderer per type, so a descriptor
 * asking for a type that does not exist would render nothing and lose the
 * field silently. The drift test in `authoring-contract.test.mjs` holds every
 * descriptor's field types against this list.
 */

import { describe, it, expect } from "vitest";
import { FIELD_TYPES, isFieldType, validateFieldValue } from "../../module/rules/authoring/fields.mjs";

describe("FIELD_TYPES", () => {
  it("is the closed set the editor has renderers for", () => {
    expect([...FIELD_TYPES].sort()).toEqual([
      "checkbox", "effectId", "number", "objectList", "predicateList",
      "range", "rank", "raw", "select", "text", "tickExpr", "tokenList",
    ]);
  });

  it("refuses a type it has no renderer for", () => {
    expect(isFieldType("text")).toBe(true);
    expect(isFieldType("colourWheel")).toBe(false);
    expect(isFieldType(null)).toBe(false);
  });
});

describe("validateFieldValue", () => {
  it("accepts a tick expression the engine can parse", () => {
    // Every duration and cooldown in the game is one of these, and a typo is
    // the difference between "5◈+⅓◈" and an ability reusable immediately.
    expect(validateFieldValue("tickExpr", "5◈+⅓◈")).toMatchObject({ ok: true });
    expect(validateFieldValue("tickExpr", "this turn")).toMatchObject({ ok: true });
  });

  it("refuses a tick expression it cannot parse, and says so", () => {
    const verdict = validateFieldValue("tickExpr", "five rounds");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(0);
  });

  it("accepts an empty value for every type, because required-ness is the descriptor's job", () => {
    // A half-filled form is the normal state of an editor. Emptiness is
    // reported by the checklist, not by the field validator.
    for (const type of FIELD_TYPES) {
      expect(validateFieldValue(type, ""), type).toMatchObject({ ok: true });
      expect(validateFieldValue(type, null), type).toMatchObject({ ok: true });
    }
  });

  it("refuses a number that is not one", () => {
    expect(validateFieldValue("number", "abc")).toMatchObject({ ok: false });
    expect(validateFieldValue("number", "12")).toMatchObject({ ok: true });
    expect(validateFieldValue("number", -3)).toMatchObject({ ok: true });
  });

  it("refuses raw JSON that does not parse", () => {
    expect(validateFieldValue("raw", "{not json}")).toMatchObject({ ok: false });
    expect(validateFieldValue("raw", '{"a":1}')).toMatchObject({ ok: true });
  });

  it("passes anything through for a type with no syntax of its own", () => {
    expect(validateFieldValue("text", "whatever")).toMatchObject({ ok: true });
    expect(validateFieldValue("tokenList", ["a", "b"])).toMatchObject({ ok: true });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-fields.test.mjs
```

Expected: FAIL — cannot resolve `module/rules/authoring/fields.mjs`.

- [ ] **Step 3: Write the implementation**

Create `module/rules/authoring/fields.mjs`:

```js
/**
 * @file The closed set of input kinds an authoring descriptor may ask for.
 * @see docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure.
 *
 * **Closed on purpose.** The editor has exactly one renderer per type, so a
 * descriptor asking for a type that does not exist would render nothing and
 * drop the field without saying so. `test/unit/authoring-contract.test.mjs`
 * holds every descriptor's field types against this list.
 *
 * `tickExpr` earns a type of its own rather than being `text` because every
 * duration and every cooldown in the game is one, `parseTick` already exists
 * to check it, and the failure is invisible: an unreadable cooldown makes an
 * ability reusable immediately, which reads as generosity rather than as a
 * content error (`engine/cooldown.mjs` says exactly this).
 */

import { parseTick } from "../../domain/tick.mjs";

/** @type {readonly string[]} */
export const FIELD_TYPES = Object.freeze([
  "text",
  "number",
  "checkbox",
  "select",
  "range",
  "rank",
  "tickExpr",
  "effectId",
  "predicateList",
  "tokenList",
  "objectList",
  "raw",
]);

/**
 * @param {unknown} type
 * @returns {boolean}
 */
export function isFieldType(type) {
  return typeof type === "string" && FIELD_TYPES.includes(type);
}

/**
 * Whether a value is syntactically usable for its field type.
 *
 * **Emptiness is always accepted.** A half-filled form is the normal state of
 * an editor, and required-ness is the descriptor's business, reported by the
 * rail's checklist. A validator that refused blanks would paint a new ability
 * red before its author had typed anything.
 *
 * @param {string} type
 * @param {unknown} value
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateFieldValue(type, value) {
  if (value === "" || value === null || value === undefined) return { ok: true };

  switch (type) {
    case "tickExpr":
      try {
        parseTick(String(value));
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message };
      }

    case "number":
      return Number.isFinite(Number(value))
        ? { ok: true }
        : { ok: false, reason: `"${value}" is not a number.` };

    case "raw":
      try {
        JSON.parse(typeof value === "string" ? value : JSON.stringify(value));
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message };
      }

    default:
      // `select`, `effectId` and `rank` are checked against their CHOICES by
      // the contract, which has them; this function only knows syntax.
      return { ok: true };
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run test/unit/authoring-fields.test.mjs && npm run lint
```

Expected: PASS, and `FGT | Layer boundaries intact`.

- [ ] **Step 5: Commit**

```bash
git add module/rules/authoring/fields.mjs test/unit/authoring-fields.test.mjs
git commit -m "$(cat <<'EOF'
feat(authoring): the closed set of descriptor field types

One renderer per type, so the set has to be closed: a descriptor
asking for a type the editor has no renderer for would drop the field
without saying so.

`tickExpr` is its own type rather than `text` because every duration
and cooldown in the game is one and the failure is invisible -- an
unreadable cooldown makes an ability reusable immediately, which
reads as generosity rather than as a content error.

Emptiness is always valid. A half-filled form is the normal state of
an editor; required-ness belongs to the descriptor and is reported by
the checklist.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 2: The descriptor contract and the drift harness

**Files:**
- Create: `module/rules/authoring/contract.mjs`
- Create: `test/unit/authoring-contract.test.mjs`

**Interfaces:**
- Consumes: `FIELD_TYPES`, `isFieldType` from Task 1.
- Produces:
  - `describeTable(entries: object[]): Readonly<Record<string, object>>` — freezes and indexes a table by `id`
  - `descriptorProblems(entry: object): string[]` — every way one entry is malformed
  - `casesIn(source: string, fnName?: string): Set<string>` — the `case "x":` labels in a source file, optionally scoped to one function

`casesIn` is the shared half of every drift test. `test/unit/targeting.test.mjs` inlines this regex four times; extracting it once means the phase, requirement and window tests cannot drift in how they read their authority.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-contract.test.mjs`:

```js
/**
 * @file The shape every authoring descriptor must have.
 * @see module/rules/authoring/contract.mjs
 *
 * D5: a keyword with no explanation fails this test. The hints are the point
 * of the whole vocabulary -- §29.6's argument is that a GM should never have
 * to know the internal name -- so they cannot be optional, or they rot into
 * decoration on the half of the table nobody got to.
 */

import { describe, it, expect } from "vitest";
import { describeTable, descriptorProblems, casesIn } from "../../module/rules/authoring/contract.mjs";

const good = {
  id: "GrantedAbility",
  label: "FGT.Authoring.Element.GrantedAbility",
  hint: "FGT.Authoring.Element.GrantedAbilityHint",
  doc: "11-effect-engine.md",
  fields: [{ key: "abilities", type: "tokenList" }],
};

describe("descriptorProblems", () => {
  it("accepts a complete descriptor", () => {
    expect(descriptorProblems(good)).toEqual([]);
  });

  it("refuses one with no hint", () => {
    const { hint, ...noHint } = good;
    expect(descriptorProblems(noHint).join(" ")).toMatch(/hint/);
  });

  it("refuses one with no label or no id", () => {
    expect(descriptorProblems({ ...good, label: "" }).join(" ")).toMatch(/label/);
    expect(descriptorProblems({ ...good, id: "" }).join(" ")).toMatch(/id/);
  });

  it("refuses a field type the editor cannot render", () => {
    const bad = { ...good, fields: [{ key: "x", type: "colourWheel" }] };
    expect(descriptorProblems(bad).join(" ")).toMatch(/colourWheel/);
  });

  it("refuses a field with no key", () => {
    expect(descriptorProblems({ ...good, fields: [{ type: "text" }] }).join(" ")).toMatch(/key/);
  });

  it("refuses a select with no choices, which would render an empty dropdown", () => {
    const bad = { ...good, fields: [{ key: "x", type: "select" }] };
    expect(descriptorProblems(bad).join(" ")).toMatch(/choices/);
  });

  it("allows a descriptor with no fields — some keywords take none", () => {
    const { fields, ...bare } = good;
    expect(descriptorProblems(bare)).toEqual([]);
  });

  it("reports every problem at once rather than the first", () => {
    // A table author fixing one thing at a time, told one thing at a time, is
    // a slow loop for 54 entries.
    const bad = { id: "", label: "", hint: "", fields: [{ type: "nope" }] };
    expect(descriptorProblems(bad).length).toBeGreaterThan(2);
  });
});

describe("describeTable", () => {
  it("indexes by id and freezes", () => {
    const table = describeTable([good]);
    expect(table.GrantedAbility.label).toBe(good.label);
    expect(Object.isFrozen(table)).toBe(true);
  });

  it("throws on a malformed entry rather than shipping a broken table", () => {
    // Loud at import time. A table that silently drops its bad rows produces
    // a picker missing a keyword, which is the failure this whole design is
    // built to prevent.
    expect(() => describeTable([{ id: "X" }])).toThrow(/X/);
  });

  it("throws on a duplicate id", () => {
    expect(() => describeTable([good, good])).toThrow(/GrantedAbility/);
  });
});

describe("casesIn", () => {
  const source = `
    function alpha(x) { switch (x) { case "one": return 1; case "two": return 2; } }
    function beta(x) { switch (x) { case "three": return 3; } }
  `;

  it("reads every case label in a source", () => {
    expect([...casesIn(source)].sort()).toEqual(["one", "three", "two"]);
  });

  it("scopes to one function when asked", () => {
    // `resolve.mjs` switches on anchors, selection modes and shapes in the
    // same file; an unscoped read would call all three anchors.
    expect([...casesIn(source, "beta")]).toEqual(["three"]);
  });

  it("returns nothing for a function that is not there", () => {
    expect([...casesIn(source, "gamma")]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-contract.test.mjs
```

Expected: FAIL — cannot resolve `contract.mjs`.

- [ ] **Step 3: Write the implementation**

Create `module/rules/authoring/contract.mjs`:

```js
/**
 * @file The shape every authoring descriptor must have, and the drift helper.
 * @see docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure.
 *
 * `describeTable` throws at import time rather than dropping a malformed row.
 * A table that silently loses an entry produces a picker missing a keyword,
 * which is precisely the failure this vocabulary exists to prevent -- and it
 * would be invisible, because nothing looks for a keyword that was never
 * offered.
 *
 * `casesIn` is the shared half of every drift test. `test/unit/targeting.test.mjs`
 * inlines this regex four times; extracting it once is what stops the phase,
 * requirement and window tests from disagreeing about how to read an
 * authority.
 */

import { isFieldType } from "./fields.mjs";

/**
 * Every way one descriptor is malformed. All of them, not the first — a table
 * author fixing 54 entries one message at a time is a slow loop.
 *
 * @param {object} entry
 * @returns {string[]}
 */
export function descriptorProblems(entry) {
  /** @type {string[]} */ const problems = [];
  const id = entry?.id || "(no id)";

  if (!entry?.id) problems.push("a descriptor needs an id");
  if (!entry?.label) problems.push(`${id}: needs a label`);
  // D5. The hints are the point of the vocabulary; optional hints rot into
  // decoration on the half of the table nobody got to.
  if (!entry?.hint) problems.push(`${id}: needs a hint — §29.6 D5`);

  for (const [i, field] of (entry?.fields ?? []).entries()) {
    const at = `${id}.fields[${i}]`;
    if (!field?.key) problems.push(`${at}: needs a key`);
    if (!isFieldType(field?.type)) {
      problems.push(`${at}: "${field?.type}" is not a field type the editor can render`);
    }
    if (field?.type === "select" && !(field.choices?.length || field.choicesFrom)) {
      problems.push(`${at}: a select needs choices, or it renders an empty dropdown`);
    }
  }
  return problems;
}

/**
 * Freeze a table and index it by id, refusing anything malformed.
 *
 * @param {object[]} entries
 * @returns {Readonly<Record<string, object>>}
 */
export function describeTable(entries) {
  /** @type {Record<string, object>} */ const table = {};
  for (const entry of entries) {
    const problems = descriptorProblems(entry);
    if (problems.length > 0) throw new Error(`Bad authoring descriptor: ${problems.join("; ")}`);
    if (table[entry.id]) throw new Error(`Duplicate authoring descriptor id "${entry.id}"`);
    table[entry.id] = Object.freeze({ ...entry, fields: Object.freeze(entry.fields ?? []) });
  }
  return Object.freeze(table);
}

/**
 * The `case "x":` labels in a source file, optionally inside one function.
 *
 * Scoping matters: `targeting/resolve.mjs` switches on anchors, selection
 * modes and shapes in the same file, so an unscoped read calls all three
 * anchors and the drift test fails on things that are not anchors.
 *
 * @param {string} source
 * @param {string} [fnName] read only from `function <fnName>` onwards
 * @returns {Set<string>}
 */
export function casesIn(source, fnName = null) {
  let text = source;
  if (fnName) {
    const parts = source.split(new RegExp(`function\\s+${fnName}\\b`));
    if (parts.length < 2) return new Set();
    // Up to the next top-level `function` declaration.
    text = parts[1].split(/\n(?:export\s+)?(?:async\s+)?function\s/)[0];
  }
  return new Set((text.match(/case\s+"(\w+)":/g) ?? []).map((m) => m.match(/"(\w+)"/)[1]));
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run test/unit/authoring-contract.test.mjs && npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add module/rules/authoring/contract.mjs test/unit/authoring-contract.test.mjs
git commit -m "$(cat <<'EOF'
feat(authoring): the descriptor contract, and one way to read an authority

`describeTable` throws at import rather than dropping a malformed
row: a table that silently loses an entry produces a picker missing a
keyword, and nothing ever looks for a keyword that was never offered.

`descriptorProblems` reports every fault at once. Fixing 54 entries
one message at a time is a slow loop.

D5 is enforced here -- a descriptor with no hint is a hard error. The
hints are the point of the vocabulary; optional ones rot into
decoration on the half of the table nobody got to.

`casesIn` extracts the regex targeting.test.mjs inlines four times,
with the function scoping resolve.mjs needs.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 3: Rule element descriptors — all 54

**Files:**
- Create: `module/rules/authoring/elements.mjs`
- Test: `test/unit/authoring-elements.test.mjs`

**Interfaces:**
- Consumes: `describeTable`, `descriptorProblems` (Task 2); `handledKeys`, `EXECUTORS` from `module/rules/elements.mjs`.
- Produces:
  - `ELEMENT_DESCRIPTORS: Readonly<Record<string, object>>`
  - `ELEMENT_IDS: readonly string[]`
  - `elementsForBucket(bucket: "rules"|"passiveRules"|"activeRules"): object[]`

**The 54 keys**, exactly as `handledKeys()` returns them:

```
DamageModifier, FlatDamage, Resistance, VariantOverride, RevealPosition,
VulnerabilityAmplifier, PeriodicOverride, DamageNegation, Ward, CritModifier,
BlockModifier, AttackerPropertyTier, StatDelta, MaxDelta, MovDelta, RangeDelta,
ZonBonus, RankShift, SizeStep, CheckModifier, AttackFirst, AutoSucceed,
TableOverride, RollAdjustment, TargetingModifier, DetectOverride, ForceTarget,
BlockLuckChecks, SuppressForeignEffects, Knockback, BuffRemovalResist,
DurationExtension, OptionalCost, AutoCounter, ForbidReaction, Decoy, WeakPoint,
OnEvent, Aura, Compulsion, TargetabilityModifier, ApplicationChance,
RevivalSource, GrantedAbility, OfferAbilityUse, Suppress, Immunity,
ImmunityDowngrade, ReplaceAbility, Disguise, EffectVisibility,
SustainabilityGain, RelationshipProxy, Script
```

**Where the hint prose comes from — do not invent it.** Every executor in `module/rules/elements.mjs` carries a JSDoc block explaining what it does and, usually, which Servant's sheet forced it into existence. The `hint` is a one-sentence condensation of that block, in the words a GM uses. Read the executor before writing its hint. `DamageModifier`'s block, for example, runs from the `/** A percentage into the stage-4 bucket. */` line through the `magnitudeRoundTo` discussion — its hint is *"A percentage change to damage, on the way out or the way in."*, not a restatement of the rounding rules.

**Where each field list comes from — read the executor's destructuring.** `DamageModifier` reads `el.npValue`, `el.magnitudeFactor`, `el.magnitudeRoundTo`, `el.modifierKey`, `el.direction`, and `resolveValue(el, …)` reads `el.value`/`el.byRank`. Those are its fields. An executor that reads a property nowhere in its descriptor is a field a GM cannot set.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-elements.test.mjs`:

```js
/**
 * @file Every rule element the engine executes, describable by a GM.
 * @see module/rules/authoring/elements.mjs
 *
 * Both directions, for the reason test/unit/targeting.test.mjs gives: an
 * element offered that nothing executes authors cleanly and does nothing, and
 * an element executed that nobody can author is a feature with no door.
 */

import { describe, it, expect } from "vitest";
import { handledKeys, EXECUTORS } from "../../module/rules/elements.mjs";
import { descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  ELEMENT_DESCRIPTORS, ELEMENT_IDS, elementsForBucket,
} from "../../module/rules/authoring/elements.mjs";

describe("drift: descriptors and EXECUTORS", () => {
  it("describes every key the engine executes", () => {
    for (const key of handledKeys()) {
      expect(ELEMENT_IDS, `the engine executes "${key}" and no GM can author it`).toContain(key);
    }
  });

  it("describes nothing the engine cannot execute", () => {
    for (const id of ELEMENT_IDS) {
      expect(typeof EXECUTORS[id], `the picker offers "${id}" and nothing executes it`)
        .toBe("function");
    }
  });

  it("covers all 54", () => {
    expect(ELEMENT_IDS.length).toBe(handledKeys().length);
  });
});

describe("every descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of ELEMENT_IDS) {
      expect(descriptorProblems(ELEMENT_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("names at least one bucket it may be authored into", () => {
    // `OnEvent` belongs in passiveRules; `OptionalCost` only makes sense on an
    // active use. An element offered in every bucket authors abilities that
    // validate and never fire.
    for (const id of ELEMENT_IDS) {
      expect(ELEMENT_DESCRIPTORS[id].buckets.length, id).toBeGreaterThan(0);
      for (const b of ELEMENT_DESCRIPTORS[id].buckets) {
        expect(["rules", "passiveRules", "activeRules"], `${id}: ${b}`).toContain(b);
      }
    }
  });

  it("gives every descriptor a doc anchor that exists", () => {
    for (const id of ELEMENT_IDS) {
      const file = ELEMENT_DESCRIPTORS[id].doc.split("#")[0];
      expect(existsSync(`docs/${file}`), `${id} → docs/${file}`).toBe(true);
    }
  });
});

describe("elementsForBucket", () => {
  it("returns only elements that bucket accepts", () => {
    for (const entry of elementsForBucket("passiveRules")) {
      expect(entry.buckets, entry.id).toContain("passiveRules");
    }
  });

  it("finds the two Akhilleus Kosmos needs in passiveRules", () => {
    const ids = elementsForBucket("passiveRules").map((e) => e.id);
    expect(ids).toContain("GrantedAbility");
    expect(ids).toContain("Knockback");
  });

  it("returns nothing for a bucket that does not exist", () => {
    expect(elementsForBucket("nonsense")).toEqual([]);
  });
});
```

Add to that file's imports:

```js
import { existsSync } from "node:fs";
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-elements.test.mjs
```

Expected: FAIL — cannot resolve `elements.mjs`.

- [ ] **Step 3: Write the table**

Create `module/rules/authoring/elements.mjs`. The file header and the two entries Akhilleus Kosmos needs, in full, as the pattern for the remaining 52:

```js
/**
 * @file Every rule element the engine executes, in the words a GM uses.
 * @see docs/29-user-interface.md §29.6, docs/11-effect-engine.md
 *
 * Layer 2 (rules). Pure data.
 *
 * One entry per key in `rules/elements.mjs#EXECUTORS`, held against it in both
 * directions by `test/unit/authoring-elements.test.mjs`. An element the engine
 * executes that nobody can author is a feature with no door; an element
 * offered that nothing executes authors cleanly and does nothing.
 *
 * **`buckets` is not decoration.** `OnEvent` belongs on a passive, and
 * `OptionalCost` only means anything on an active use. Offering every key in
 * every bucket would let a GM author an ability that validates and never
 * fires, which is the failure mode this whole vocabulary exists to close.
 *
 * Each `hint` condenses that executor's own JSDoc into one sentence. Read the
 * executor before changing a hint: the blocks in `elements.mjs` carry the
 * Servant whose sheet forced the element into existence, and that is usually
 * the clearest thing to say about it.
 */

import { describeTable } from "./contract.mjs";

const ALL_BUCKETS = Object.freeze(["rules", "passiveRules", "activeRules"]);

export const ELEMENT_DESCRIPTORS = describeTable([
  {
    id: "GrantedAbility",
    label: "FGT.Authoring.Element.GrantedAbility",
    hint: "FGT.Authoring.Element.GrantedAbilityHint",
    doc: "11-effect-engine.md",
    buckets: ALL_BUCKETS,
    fields: [
      // `rules/movement.mjs#ignoresBlocking` is the one place the question is
      // asked; the grant is how an ability answers it.
      { key: "abilities", type: "tokenList", required: true },
      { key: "predicate", type: "predicateList" },
    ],
  },
  {
    id: "Knockback",
    label: "FGT.Authoring.Element.Knockback",
    hint: "FGT.Authoring.Element.KnockbackHint",
    doc: "11-effect-engine.md",
    buckets: ALL_BUCKETS,
    fields: [
      // Achilles pushes along his TRAVEL; Kingprotea's cascade goes outward
      // from a centre. Same element, one field apart.
      {
        key: "direction",
        type: "select",
        choices: ["travel", "outward"],
      },
      // "...that Unit is forcefully Moved to one of the panels to its sides,
      // and receives damage equivalent to a Normal Attack." Running out of
      // room is a different OUTCOME, not a failure.
      { key: "sidestep", type: "raw" },
      { key: "predicate", type: "predicateList" },
    ],
  },

  // …the remaining 52 keys, in the order `handledKeys()` returns them.
]);

/** @type {readonly string[]} */
export const ELEMENT_IDS = Object.freeze(Object.keys(ELEMENT_DESCRIPTORS));

/**
 * The elements one bucket accepts.
 *
 * @param {string} bucket
 * @returns {object[]}
 */
export function elementsForBucket(bucket) {
  return ELEMENT_IDS
    .map((id) => ELEMENT_DESCRIPTORS[id])
    .filter((entry) => entry.buckets.includes(bucket));
}
```

**To write the other 52**, for each key in `handledKeys()` order:

```bash
# Read the executor's JSDoc and its destructuring, one key at a time:
node -e "
const s=require('fs').readFileSync('module/rules/elements.mjs','utf8');
const k=process.argv[1];
const i=s.indexOf('  '+k+'(');
console.log(s.slice(Math.max(0,s.lastIndexOf('/**',i)), s.indexOf('\n  },',i)+4));
" DamageModifier
```

Its `fields` are every `el.<prop>` that block reads. Its `hint` is one sentence from its JSDoc. Its `buckets`: `ALL_BUCKETS` unless the executor is only reachable from one — `OptionalCost` and `OfferAbilityUse` are `["activeRules", "rules"]`; `OnEvent`, `Aura`, `Compulsion` and `GrantedAbility` include `passiveRules`.

- [ ] **Step 4: Add the localization keys**

For each of the 54, add to `lang/en.json`:

```json
"FGT.Authoring.Element.GrantedAbility": "Grants an ability",
"FGT.Authoring.Element.GrantedAbilityHint": "Hands the bearer an ability it does not otherwise have, for as long as this element applies.",
"FGT.Authoring.Element.Knockback": "Pushes Units aside",
"FGT.Authoring.Element.KnockbackHint": "Forces a Unit out of the way when this one moves into it, along the mover's direction of travel or outward from a centre.",
```

Then check the prefix rule:

```bash
node -e "JSON.parse(require('fs').readFileSync('lang/en.json','utf8'));console.log('valid json')"
node -e "const j=require('./lang/en.json');const k=Object.keys(j);const bad=[];for(const a of k)for(const b of k)if(a!==b&&b.startsWith(a+'.'))bad.push(a+' < '+b);console.log(bad.length?bad.join('\n'):'no prefix collisions')"
```

Note the shape: `…Element.GrantedAbility` and `…Element.GrantedAbilityHint` are siblings, not prefixes — `GrantedAbilityHint` does not start with `GrantedAbility.`. This is why the hint suffix has **no dot**.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run test/unit/authoring-elements.test.mjs && npm test && npm run lint
```

Expected: PASS, 54 of 54.

- [ ] **Step 6: Commit**

```bash
git add module/rules/authoring/elements.mjs test/unit/authoring-elements.test.mjs lang/en.json
git commit -m "$(cat <<'EOF'
feat(authoring): all 54 rule elements, describable by a GM

The editor VALIDATED rules, passiveRules and activeRules and offered
no control that could add one -- a rule that is right and inert, the
defect shape this project keeps finding in itself.

One descriptor per EXECUTORS key, held against it in both
directions. An element the engine executes that nobody can author is
a feature with no door; an element offered that nothing executes
authors cleanly and does nothing.

`buckets` is load-bearing: OnEvent belongs on a passive, OptionalCost
only means anything on an active use, and offering every key
everywhere would author abilities that validate and never fire.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 4: Phase descriptors — all 19

**Files:**
- Create: `module/rules/authoring/phases.mjs`
- Test: `test/unit/authoring-phases.test.mjs`

**Interfaces:**
- Consumes: `describeTable`, `casesIn` (Task 2).
- Produces: `PHASE_DESCRIPTORS`, `PHASE_IDS`, `phasesByUsage(): object[]`

**The 19 kinds** (`applyEffect` is an alias for `applyEffects` and gets no descriptor of its own):

```
applyEffects, damage, cooldown, resource, createField, statChange, removeEffect,
heal, zone, summon, check, choose, cutContract, expend, dragInto,
createStructure, summonPlatform, rollTable, channel, itemGrant
```

**This task corrects design §1.4.** The old `PHASE_FIELDS` typed `cooldownDelta`, `modifyDamage`, `overrideValidation` and `teleport` — **zero uses each** across 195 files — and left `createField` (8 uses) and `zone` (4) to raw JSON. Those four names are **not** `runPhases` cases and must not appear here; the drift test will reject them.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-phases.test.mjs`:

```js
/**
 * @file Every phase kind `runPhases` dispatches, describable by a GM.
 * @see module/rules/authoring/phases.mjs
 *
 * The old PHASE_FIELDS typed four kinds no authored ability uses and left nine
 * that it does to a raw JSON textarea. The typed list was aimed at the wrong
 * targets, and nothing held it against the dispatcher.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { casesIn, descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import { PHASE_DESCRIPTORS, PHASE_IDS, phasesByUsage } from "../../module/rules/authoring/phases.mjs";

/** `applyEffect` is an alias `runPhases` falls through on; it is not a kind. */
const ALIASES = new Set(["applyEffect"]);

const dispatched = () => {
  const source = readFileSync("module/engine/skill-use.mjs", "utf8");
  return new Set([...casesIn(source, "runPhases")].filter((k) => !ALIASES.has(k)));
};

describe("drift: descriptors and runPhases", () => {
  it("describes every kind the engine dispatches", () => {
    for (const kind of dispatched()) {
      expect(PHASE_IDS, `runPhases dispatches "${kind}" and no GM can author it`).toContain(kind);
    }
  });

  it("describes nothing the engine does not dispatch", () => {
    // The four the old PHASE_FIELDS typed and content never used are exactly
    // what this catches: cooldownDelta, modifyDamage, overrideValidation,
    // teleport are not runPhases cases.
    const cases = dispatched();
    for (const id of PHASE_IDS) {
      expect(cases.has(id), `the picker offers phase "${id}" and runPhases has no case for it`)
        .toBe(true);
    }
  });
});

describe("every phase descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of PHASE_IDS) {
      expect(descriptorProblems(PHASE_DESCRIPTORS[id]), id).toEqual([]);
    }
  });
});

describe("phasesByUsage", () => {
  it("puts the kinds content actually reaches for first", () => {
    // applyEffects is 95 of the phases in the corpus; a picker that buries it
    // under `channel` is a picker that makes the common case slowest.
    const order = phasesByUsage().map((p) => p.id);
    expect(order[0]).toBe("applyEffects");
    expect(order.indexOf("damage")).toBeLessThan(order.indexOf("channel"));
  });

  it("returns every kind, not just the used ones", () => {
    expect(phasesByUsage()).toHaveLength(PHASE_IDS.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-phases.test.mjs
```

Expected: FAIL — cannot resolve `phases.mjs`.

- [ ] **Step 3: Write the table**

Create `module/rules/authoring/phases.mjs`. The `applyEffects` and `createField` entries in full, as the pattern:

```js
/**
 * @file Every phase kind `runPhases` dispatches, in the words a GM uses.
 * @see docs/15-abilities.md §15.2, docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure data.
 *
 * Replaces the old `PHASE_FIELDS` in the editor, which was aimed at the wrong
 * targets: it typed `cooldownDelta`, `modifyDamage`, `overrideValidation` and
 * `teleport` -- **zero uses each** across 195 authored files -- and left nine
 * kinds the content does use, including `createField` (8) and `zone` (4), to a
 * raw JSON textarea. Nothing held it against the dispatcher.
 *
 * `order` is a presentation weight, not a rule: `applyEffects` is 95 of the
 * phases in the corpus, and a picker that buries it under `channel` makes the
 * common case the slowest one.
 */

import { describeTable } from "./contract.mjs";

export const PHASE_DESCRIPTORS = describeTable([
  {
    id: "applyEffects",
    label: "FGT.Authoring.Phase.applyEffects",
    hint: "FGT.Authoring.Phase.applyEffectsHint",
    doc: "15-abilities.md",
    order: 100,
    fields: [
      { key: "target", type: "select", choices: ["reuse", "self", "each", "chosen"] },
      // The list of effects is `objectList`, described recursively: each row
      // is an effect id, a duration and a use count, which is the shape
      // `effects:` takes in every authored ability.
      {
        key: "effects",
        type: "objectList",
        of: [
          { key: "id", type: "effectId", required: true },
          { key: "duration", type: "tickExpr" },
          { key: "magnitude", type: "number" },
          { key: "uses", type: "number" },
        ],
      },
    ],
  },
  {
    id: "createField",
    label: "FGT.Authoring.Phase.createField",
    hint: "FGT.Authoring.Phase.createFieldHint",
    doc: "43-bounded-fields.md",
    order: 60,
    fields: [
      { key: "target", type: "select", choices: ["reuse", "self", "chosen"] },
      { key: "spec", type: "raw" },
    ],
  },

  // …the remaining 17 kinds.
]);

/** @type {readonly string[]} */
export const PHASE_IDS = Object.freeze(Object.keys(PHASE_DESCRIPTORS));

/**
 * Every phase kind, commonest first.
 * @returns {object[]}
 */
export function phasesByUsage() {
  return PHASE_IDS
    .map((id) => PHASE_DESCRIPTORS[id])
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0) || a.id.localeCompare(b.id));
}
```

**To write the other 17**, read each `case` block in `runPhases` (`module/engine/skill-use.mjs`, the `case` labels between lines 340 and 690) and take its fields from what the block destructures off `phase`. Suggested `order` values from the corpus measurement: `applyEffects` 100, `damage` 90, `cooldown` 80, `resource` 70, `createField` 60, `statChange` 50, `removeEffect` 50, `heal` 50, `zone` 40, `summon` 30, `check` 30, everything else 10.

- [ ] **Step 4: Add the localization keys, then verify JSON and the prefix rule**

Same shape and same two commands as Task 3 Step 4.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run test/unit/authoring-phases.test.mjs && npm test && npm run lint
```

Expected: PASS, 19 of 19.

- [ ] **Step 6: Commit**

```bash
git add module/rules/authoring/phases.mjs test/unit/authoring-phases.test.mjs lang/en.json
git commit -m "$(cat <<'EOF'
feat(authoring): all 19 phase kinds, and the four that were fiction

The old PHASE_FIELDS typed cooldownDelta, modifyDamage,
overrideValidation and teleport -- ZERO uses each across 195 authored
files, and none of them a `runPhases` case -- while leaving nine
kinds the content does use to a raw JSON textarea, including
createField (8 uses) and zone (4).

Nothing held the list against the dispatcher, so the typed set could
point anywhere. Now it cannot: both directions are tested.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 5: Requirement descriptors — 24, and the separate command-spell list

**Files:**
- Create: `module/rules/authoring/requirements.mjs`
- Test: `test/unit/authoring-requirements.test.mjs`

**Interfaces:**
- Consumes: `describeTable`, `casesIn` (Task 2).
- Produces: `REQUIREMENT_DESCRIPTORS`, `REQUIREMENT_IDS`, `CS_REQUIREMENT_DESCRIPTORS`, `CS_REQUIREMENT_IDS`, `requirementsFor(itemType: string): object[]`

**The 24 ability kinds** (`case` labels in `meetsRequirement`, `module/rules/items.mjs`):

```
inZon, roundAtLeast, roundPhase, inZone, notInZone, hasSkill, modeActive, stance,
modeInactive, resourceAtLeast, healthBelow, healthAbove, healthRestoredSince,
masterHealthAbove, masterHealthFraction, counterpartAdjacent, targetHasEffect,
notHasEffect, abilityOffCooldown, itemAtLeast, predicate, fieldOpen,
noAliveSummon, withinPlatformCentre
```

**The command-spell list is different and must stay different.** `tools/lib/content.mjs:88` exports `CS_REQUIREMENT_KINDS`, and line 83 says why: `servantInZon` asks about somebody else's Servant and `attackIsNotNP` about an attack already being resolved. An ability authoring either would be asking a question with no answer.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-requirements.test.mjs`:

```js
/**
 * @file Every requirement kind, describable — and the two lists kept apart.
 * @see module/rules/authoring/requirements.mjs, tools/lib/content.mjs:83
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { casesIn, descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  REQUIREMENT_DESCRIPTORS, REQUIREMENT_IDS,
  CS_REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_IDS, requirementsFor,
} from "../../module/rules/authoring/requirements.mjs";

const dispatched = () =>
  casesIn(readFileSync("module/rules/items.mjs", "utf8"), "meetsRequirement");

describe("drift: descriptors and meetsRequirement", () => {
  it("describes every kind the engine answers", () => {
    for (const kind of dispatched()) {
      expect(REQUIREMENT_IDS, `meetsRequirement answers "${kind}" and no GM can author it`)
        .toContain(kind);
    }
  });

  it("describes nothing meetsRequirement would refuse", () => {
    // The default case returns false, so an undescribed kind is a gate that
    // always loses -- an ability that can never be used, silently.
    const cases = dispatched();
    for (const id of REQUIREMENT_IDS) {
      expect(cases.has(id), `the picker offers "${id}" and meetsRequirement has no case for it`)
        .toBe(true);
    }
  });
});

describe("the two vocabularies stay apart", () => {
  it("keeps command-spell-only kinds out of the ability list", () => {
    // `servantInZon` asks about somebody else's Servant and `attackIsNotNP`
    // about an attack already being resolved. An ability authoring either
    // would be asking a question with no answer (tools/lib/content.mjs:83).
    expect(REQUIREMENT_IDS).not.toContain("servantInZon");
    expect(REQUIREMENT_IDS).not.toContain("attackIsNotNP");
  });

  it("offers them to command spells", () => {
    expect(CS_REQUIREMENT_IDS).toContain("servantInZon");
    expect(CS_REQUIREMENT_IDS).toContain("attackIsNotNP");
  });
});

describe("requirementsFor", () => {
  it("gives an ability the ability list", () => {
    expect(requirementsFor("ability").map((r) => r.id)).toEqual([...REQUIREMENT_IDS]);
    expect(requirementsFor("noblePhantasm").map((r) => r.id)).toEqual([...REQUIREMENT_IDS]);
  });

  it("gives a command spell the command spell list", () => {
    expect(requirementsFor("commandSpell").map((r) => r.id)).toEqual([...CS_REQUIREMENT_IDS]);
  });

  it("gives an unknown type the ability list rather than nothing", () => {
    // A picker that empties on an unexpected type is worse than one that
    // offers the common vocabulary.
    expect(requirementsFor("mystery").length).toBeGreaterThan(0);
  });
});

describe("every requirement descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of REQUIREMENT_IDS) {
      expect(descriptorProblems(REQUIREMENT_DESCRIPTORS[id]), id).toEqual([]);
    }
    for (const id of CS_REQUIREMENT_IDS) {
      expect(descriptorProblems(CS_REQUIREMENT_DESCRIPTORS[id]), id).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-requirements.test.mjs
```

Expected: FAIL — cannot resolve `requirements.mjs`.

- [ ] **Step 3: Write the tables**

Create `module/rules/authoring/requirements.mjs`. The `stance` entry in full, which is the one Akhilleus Kosmos needs:

```js
/**
 * @file Every requirement kind, in the words a GM uses.
 * @see docs/15-abilities.md §15.4, tools/lib/content.mjs:83
 *
 * Layer 2 (rules). Pure data.
 *
 * **Two lists, deliberately.** `meetsRequirement`'s default case returns
 * `false`, so an undescribed kind is not a gate that is skipped -- it is a gate
 * that always LOSES, and the ability can never be used. That is why the drift
 * test runs in both directions here as well.
 *
 * Command spells have their own vocabulary and it must never merge with this
 * one: `servantInZon` asks about somebody else's Servant, `attackIsNotNP`
 * about an attack that is already being resolved. An ability authoring either
 * would be asking a question with no answer.
 */

import { describeTable } from "./contract.mjs";

export const REQUIREMENT_DESCRIPTORS = describeTable([
  {
    id: "stance",
    label: "FGT.Authoring.Req.stance",
    hint: "FGT.Authoring.Req.stanceHint",
    doc: "15-abilities.md",
    fields: [
      { key: "stance", type: "select", choices: ["mounted", "dismounted"], required: true },
    ],
  },

  // …the remaining 23 kinds.
]);

/** @type {readonly string[]} */
export const REQUIREMENT_IDS = Object.freeze(Object.keys(REQUIREMENT_DESCRIPTORS));

export const CS_REQUIREMENT_DESCRIPTORS = describeTable([
  // …every id in `CS_REQUIREMENT_KINDS` (tools/lib/content.mjs:88).
]);

/** @type {readonly string[]} */
export const CS_REQUIREMENT_IDS = Object.freeze(Object.keys(CS_REQUIREMENT_DESCRIPTORS));

/**
 * The requirement vocabulary one item type may author.
 *
 * Falls back to the ability list rather than to nothing: a picker that empties
 * on an unexpected type is worse than one offering the common vocabulary.
 *
 * @param {string} itemType
 * @returns {object[]}
 */
export function requirementsFor(itemType) {
  const table = itemType === "commandSpell" ? CS_REQUIREMENT_DESCRIPTORS : REQUIREMENT_DESCRIPTORS;
  return Object.keys(table).map((id) => table[id]);
}
```

**To write the other 23**, read each `case` in `meetsRequirement` (`module/rules/items.mjs:226-415`) and take its fields from what the block reads off `req`. For the command-spell table, read `CS_REQUIREMENT_KINDS` at `tools/lib/content.mjs:88` and the `case` labels in `rules/command-spells.mjs:177`.

- [ ] **Step 4: Add the localization keys, verify JSON and the prefix rule**

Same two commands as Task 3 Step 4.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run test/unit/authoring-requirements.test.mjs && npm test && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add module/rules/authoring/requirements.mjs test/unit/authoring-requirements.test.mjs lang/en.json
git commit -m "$(cat <<'EOF'
feat(authoring): 24 requirement kinds, and the list that stays separate

`meetsRequirement`'s default case returns false, so an undescribed
kind is not a gate that is skipped -- it is a gate that always loses,
and the ability can never be used. Both directions tested.

The command spell vocabulary stays its own table.
tools/lib/content.mjs:83 says why: servantInZon asks about somebody
else's Servant and attackIsNotNP about an attack already being
resolved, so an ability authoring either asks a question with no
answer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 6: Timing window descriptors

**Files:**
- Create: `module/rules/authoring/timing.mjs`
- Test: `test/unit/authoring-timing.test.mjs`

**Interfaces:**
- Consumes: `ABILITY_WINDOWS`, `ABILITY_WINDOW_IDS` from `module/rules/windows.mjs` (**the prerequisite plan**); `describeTable` (Task 2).
- Produces: `TIMING_DESCRIPTORS`, `TIMING_IDS`, `AGAINST_FIELDS: object[]`

The window vocabulary already carries a `hint` — this table adds the label, the doc anchor and the `against*` modifier fields (`againstKind`, `againstRank`, `requiresAoE`, `radius`), which Akhilleus Kosmos needs and which live on `timing` beside the window.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-timing.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { ABILITY_WINDOW_IDS } from "../../module/rules/windows.mjs";
import { descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import { TIMING_DESCRIPTORS, TIMING_IDS, AGAINST_FIELDS } from "../../module/rules/authoring/timing.mjs";

describe("drift: descriptors and the window vocabulary", () => {
  it("describes every window an ability may name", () => {
    for (const id of ABILITY_WINDOW_IDS) {
      expect(TIMING_IDS, `windows.mjs knows "${id}" and no GM can choose it`).toContain(id);
    }
  });

  it("describes no window the vocabulary does not know", () => {
    for (const id of TIMING_IDS) {
      expect(ABILITY_WINDOW_IDS, `the picker offers "${id}" and windows.mjs has never heard of it`)
        .toContain(id);
    }
  });
});

describe("every timing descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of TIMING_IDS) {
      expect(descriptorProblems(TIMING_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("marks the one window nothing dispatches", () => {
    expect(TIMING_DESCRIPTORS.ownTurn.dispatched).toBe(false);
  });
});

describe("AGAINST_FIELDS", () => {
  it("carries the four modifiers Akhilleus Kosmos needs", () => {
    // timing: { window: whenAllyAttacked, againstKind: np, againstRank: A,
    //           requiresAoE: true, radius: 2 }
    const keys = AGAINST_FIELDS.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(
      ["againstKind", "againstRank", "requiresAoE", "radius"],
    ));
  });

  it("renders the rank modifier with the rank picker, not free text", () => {
    expect(AGAINST_FIELDS.find((f) => f.key === "againstRank").type).toBe("rank");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-timing.test.mjs
```

Expected: FAIL — cannot resolve `timing.mjs`.

- [ ] **Step 3: Write the table**

Create `module/rules/authoring/timing.mjs`:

```js
/**
 * @file The timing windows, as the editor offers them.
 * @see docs/15-abilities.md §15.3, module/rules/windows.mjs
 *
 * Layer 2 (rules). Pure data.
 *
 * The window list itself is `rules/windows.mjs` -- this adds the label, the
 * doc anchor and the `against*` modifiers that live on `timing` beside the
 * window. Derived from that table rather than restating it, so the two cannot
 * disagree.
 */

import { ABILITY_WINDOWS, ABILITY_WINDOW_IDS } from "../windows.mjs";
import { describeTable } from "./contract.mjs";

export const TIMING_DESCRIPTORS = describeTable(
  ABILITY_WINDOW_IDS.map((id) => ({
    id,
    label: `FGT.Authoring.Window.${id}`,
    // `windows.mjs` already wrote the sentence; the localization key points at
    // the same text so the two are never edited apart.
    hint: `FGT.Authoring.Window.${id}Hint`,
    doc: "15-abilities.md",
    dispatched: ABILITY_WINDOWS[id].dispatched,
    fields: [],
  })),
);

/** @type {readonly string[]} */
export const TIMING_IDS = Object.freeze(Object.keys(TIMING_DESCRIPTORS));

/**
 * The modifiers that narrow a window.
 *
 * Achilles is the reference: *"when Achilles or any allied Unit within a 2
 * panel area is targeted by an AoE Noble Phantasm of Rank A and above"* is one
 * window plus all four of these. EMIYA's Rho Aias opens in the same window and
 * gates only on the incoming attack being a Noble Phantasm at all.
 *
 * @type {readonly object[]}
 */
export const AGAINST_FIELDS = Object.freeze([
  {
    key: "againstKind",
    type: "select",
    choices: ["np", "normal", "skill"],
    label: "FGT.Authoring.Timing.againstKind",
    hint: "FGT.Authoring.Timing.againstKindHint",
  },
  {
    key: "againstRank",
    type: "rank",
    label: "FGT.Authoring.Timing.againstRank",
    hint: "FGT.Authoring.Timing.againstRankHint",
  },
  {
    key: "requiresAoE",
    type: "checkbox",
    label: "FGT.Authoring.Timing.requiresAoE",
    hint: "FGT.Authoring.Timing.requiresAoEHint",
  },
  {
    key: "radius",
    type: "number",
    label: "FGT.Authoring.Timing.radius",
    hint: "FGT.Authoring.Timing.radiusHint",
  },
]);
```

- [ ] **Step 4: Add the localization keys**

Two per window (`FGT.Authoring.Window.<id>` and `<id>Hint`, the hint copying the sentence from `windows.mjs`), two per against-field. Then the JSON and prefix checks from Task 3 Step 4.

- [ ] **Step 5: Run the tests and commit**

```bash
npx vitest run test/unit/authoring-timing.test.mjs && npm test && npm run lint
git add module/rules/authoring/timing.mjs test/unit/authoring-timing.test.mjs lang/en.json
git commit -m "$(cat <<'EOF'
feat(authoring): the timing windows, as the editor offers them

Derived from `rules/windows.mjs` rather than restating it, so the
picker and the authority cannot disagree.

`AGAINST_FIELDS` carries the four modifiers that narrow a window.
Achilles is the reference: "when Achilles or any allied Unit within a
2 panel area is targeted by an AoE Noble Phantasm of Rank A and
above" is one window plus all four, and none of them has ever been
editable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 7: The ability field groups and the rail order

**Files:**
- Create: `module/rules/authoring/ability.mjs`
- Create: `module/rules/authoring/index.mjs`
- Test: `test/unit/authoring-ability.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces:
  - `SECTIONS: readonly object[]` — `{id, label, hint, fields?}` in rail order
  - `fieldGroupsFor(itemType: string): object[]`
  - `EDITABLE_FIELDS: readonly string[]`
  - `RUNTIME_FIELDS: readonly string[]` — never rendered as inputs
  - `index.mjs` re-exports every table plus `describe(family, id)`

**The eight sections, in rail order:** `whatItIs`, `limits`, `npScoping`, `whenItFires`, `requirements`, `ruleElements`, `whereItLands`, `whatItDoes`. The rail's ninth row, `check`, is the validation footer and is not a field group.

**Top-level fields by section** (from the design's coverage decision — every field in 2+ shipped abilities):

- `whatItIs`: `name`, `kind`, `rank`, `slug`, `npTags`, `description`, `img`
- `limits`: `cooldown.max`, `duration`, `cost`, `maxUses`, `requiresRound`, `category`, `oncePerTurn`, `oncePerRound`, `sameTurnExclusive`, `sameRoundExclusive`, `exclusionSet`, `isPassive`, `isMode`, `isAttackSkill`, `expendsPermanently`, `copyable`, `countsAsAttack`, `countsAsAct`, `cooldownWaiver`, `alsoTriggers`
- `npScoping`: `isNP`, `categorizedAsNP`, `countsForNPSeal`, `npGateRound`, `isSpell`, `element`

**`RUNTIME_FIELDS` — never editable** (Global Constraints): `timesUsed`, `toggledAt`, `lastUsedTick`, `expended`, `recordedAttacks`, `active`, `uses`, `contentVersion`, `copiedFrom`, `grantedBy`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-ability.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  SECTIONS, fieldGroupsFor, EDITABLE_FIELDS, RUNTIME_FIELDS,
} from "../../module/rules/authoring/ability.mjs";

describe("SECTIONS", () => {
  it("is the rail order, first-author first", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "whatItIs", "limits", "npScoping", "whenItFires",
      "requirements", "ruleElements", "whereItLands", "whatItDoes",
    ]);
  });

  it("gives every section a label and a hint", () => {
    for (const s of SECTIONS) {
      expect(s.label.length, s.id).toBeGreaterThan(0);
      expect(s.hint.length, s.id).toBeGreaterThan(0);
    }
  });

  it("describes every field it renders", () => {
    for (const s of SECTIONS) {
      for (const f of s.fields ?? []) {
        expect(descriptorProblems({ id: f.key, label: f.label, hint: f.hint, fields: [f] }), f.key)
          .toEqual([]);
      }
    }
  });
});

describe("runtime state is never editable", () => {
  it("keeps engine-written fields out of every group", () => {
    // A GM typing `timesUsed` is a GM corrupting the match record.
    for (const runtime of RUNTIME_FIELDS) {
      expect(EDITABLE_FIELDS, runtime).not.toContain(runtime);
    }
  });

  it("names the ones the engine writes", () => {
    expect([...RUNTIME_FIELDS]).toEqual(expect.arrayContaining(
      ["timesUsed", "toggledAt", "lastUsedTick", "expended", "active"],
    ));
  });
});

describe("fieldGroupsFor", () => {
  it("gives an ability every section", () => {
    expect(fieldGroupsFor("ability").map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
  });

  it("drops NP scoping from a class skill", () => {
    // A Class Skill is never a Noble Phantasm; offering the scoping questions
    // is offering three checkboxes that mean nothing.
    expect(fieldGroupsFor("classSkill").map((s) => s.id)).not.toContain("npScoping");
  });

  it("keeps every section a command spell needs", () => {
    const ids = fieldGroupsFor("commandSpell").map((s) => s.id);
    expect(ids).toContain("whenItFires");
    expect(ids).toContain("requirements");
  });
});

describe("the fields Akhilleus Kosmos needs are all editable", () => {
  it("covers the six that had no control at all", () => {
    for (const field of ["slug", "npTags", "expendsPermanently"]) {
      expect(EDITABLE_FIELDS, field).toContain(field);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-ability.test.mjs
```

Expected: FAIL — cannot resolve `ability.mjs`.

- [ ] **Step 3: Write `ability.mjs` and `index.mjs`**

`ability.mjs` exports `SECTIONS` as the eight groups above, each `{id, label, hint, fields}` where a field is `{key, type, label, hint, choices?}`. `RUNTIME_FIELDS` is the frozen list from the interface block. `EDITABLE_FIELDS` is derived — `SECTIONS.flatMap(s => (s.fields ?? []).map(f => f.key))` — never hand-listed, so the two cannot disagree. `fieldGroupsFor` drops `npScoping` for `classSkill` and returns everything otherwise.

`index.mjs` re-exports every table from Tasks 1–7 and adds:

```js
/**
 * One descriptor, by family and id.
 * @param {"element"|"phase"|"requirement"|"timing"} family
 * @param {string} id
 * @returns {object|null}
 */
export function describe(family, id) { /* … */ }
```

- [ ] **Step 4: Add the localization keys, verify JSON and the prefix rule**

- [ ] **Step 5: Run the tests and commit**

```bash
npx vitest run test/unit/authoring-ability.test.mjs && npm test && npm run lint
git add module/rules/authoring/ability.mjs module/rules/authoring/index.mjs test/unit/authoring-ability.test.mjs lang/en.json
git commit -m "$(cat <<'EOF'
feat(authoring): the field groups, the rail order, and what a GM may not type

Eight sections in the order a first author needs them, and one
derivation that matters: EDITABLE_FIELDS comes FROM the sections
rather than being listed beside them, so the two cannot disagree.

RUNTIME_FIELDS is the list a GM never sees an input for --
timesUsed, toggledAt, lastUsedTick, expended, active. The engine
writes them, and a GM typing one is a GM corrupting the match record.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 8: The pure view-model

**Files:**
- Create: `module/apps/ability-editor/present.mjs`
- Test: `test/unit/ability-editor-present.test.mjs`

**Interfaces:**
- Consumes: everything from `module/rules/authoring/index.mjs`.
- Produces:
  - `formRows(descriptor: object, value: object): object[]` — one row per descriptor field, carrying `{key, type, label, hint, value, choices, problem}`
  - `railRows(draft: object, itemType: string): object[]` — `{id, label, state: "done"|"empty"|"partial", count}`
  - `sectionState(section: object, draft: object): "done"|"empty"|"partial"`

D29.12: presentation arithmetic lives in a pure module and is unit-tested without a world. `test/unit/action-bar-present.test.mjs` is the precedent.

- [ ] **Step 1: Write the failing test**

Create `test/unit/ability-editor-present.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { formRows, railRows, sectionState } from "../../module/apps/ability-editor/present.mjs";

const descriptor = {
  id: "Knockback",
  label: "FGT.Authoring.Element.Knockback",
  hint: "FGT.Authoring.Element.KnockbackHint",
  fields: [
    { key: "direction", type: "select", choices: ["travel", "outward"] },
    { key: "predicate", type: "predicateList" },
  ],
};

describe("formRows", () => {
  it("makes one row per descriptor field, carrying the current value", () => {
    const rows = formRows(descriptor, { direction: "travel" });
    expect(rows.map((r) => r.key)).toEqual(["direction", "predicate"]);
    expect(rows[0].value).toBe("travel");
    expect(rows[0].choices).toEqual(["travel", "outward"]);
  });

  it("carries an empty value rather than dropping the row", () => {
    // A field with no value is the field a GM still has to fill. Dropping it
    // hides the thing they came to do.
    const rows = formRows(descriptor, {});
    expect(rows).toHaveLength(2);
    expect(rows[1].value).toBe(undefined);
  });

  it("reports a field whose value its type cannot parse", () => {
    const tick = { id: "x", label: "l", hint: "h", fields: [{ key: "d", type: "tickExpr" }] };
    const rows = formRows(tick, { d: "five rounds" });
    expect(rows[0].problem.length).toBeGreaterThan(0);
  });

  it("reports no problem for a value its type accepts", () => {
    const tick = { id: "x", label: "l", hint: "h", fields: [{ key: "d", type: "tickExpr" }] };
    expect(formRows(tick, { d: "3◈" })[0].problem).toBe(null);
  });

  it("survives a descriptor with no fields", () => {
    expect(formRows({ id: "x", label: "l", hint: "h" }, {})).toEqual([]);
  });
});

describe("sectionState", () => {
  const section = { id: "whatItIs", label: "l", hint: "h", fields: [
    { key: "name", type: "text" }, { key: "kind", type: "select", choices: ["skill"] },
  ] };

  it("is empty when nothing is filled", () => {
    expect(sectionState(section, {})).toBe("empty");
  });

  it("is partial when some are", () => {
    expect(sectionState(section, { name: "Argos" })).toBe("partial");
  });

  it("is done when all are", () => {
    expect(sectionState(section, { name: "Argos", kind: "skill" })).toBe("done");
  });
});

describe("railRows", () => {
  it("gives one row per section for the item type", () => {
    const rows = railRows({}, "ability");
    expect(rows.map((r) => r.id)).toContain("ruleElements");
    expect(rows.map((r) => r.id)).toContain("whenItFires");
  });

  it("drops NP scoping for a class skill", () => {
    expect(railRows({}, "classSkill").map((r) => r.id)).not.toContain("npScoping");
  });

  it("counts what a list section holds", () => {
    // The rail says "Rule elements 2" so a GM can see there is something in a
    // section without opening it.
    const rows = railRows({ passiveRules: [{ key: "Aura" }, { key: "OnEvent" }] }, "ability");
    expect(rows.find((r) => r.id === "ruleElements").count).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement, then verify it passes**

```bash
npx vitest run test/unit/ability-editor-present.test.mjs   # FAIL: cannot resolve present.mjs
# …implement…
npx vitest run test/unit/ability-editor-present.test.mjs   # PASS
```

`formRows` maps `descriptor.fields`, reading `value[field.key]` and calling `validateFieldValue(field.type, …)` for `problem`. `sectionState` counts filled keys. `railRows` maps `fieldGroupsFor(itemType)` and adds counts for the three list sections (`ruleElements` sums the three buckets, `requirements` and `whatItDoes` count their arrays).

- [ ] **Step 3: Commit**

```bash
git add module/apps/ability-editor/present.mjs test/unit/ability-editor-present.test.mjs
git commit -m "$(cat <<'EOF'
feat(editor): the view-model, pure and testable without a world

D29.12 -- presentation arithmetic in a pure module, the way
actor-sheet/present.mjs already is. `formRows` turns any descriptor
plus its current value into rows the template renders with one
partial, which is what makes 54 rule elements a data problem rather
than 54 pieces of markup.

An empty field keeps its row. A field with no value is the field a GM
still has to fill; dropping it hides the thing they came to do.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 9: Split the editor into a directory, unchanged

**Files:**
- Move: `module/apps/ability-editor.mjs` → `module/apps/ability-editor/editor.mjs`
- Create: `module/apps/ability-editor/index.mjs`
- Modify: `module/apps/actor-sheet/sheet.mjs:369`, `module/fgt.mjs:44`

**No behaviour change.** This is the move that makes Tasks 10–13 edits to a focused file rather than to a growing one, and it follows the `actor-sheet/` precedent.

- [ ] **Step 1: Move the file and add the re-export**

```bash
git mv module/apps/ability-editor.mjs module/apps/ability-editor/editor.mjs
```

Create `module/apps/ability-editor/index.mjs`:

```js
/**
 * @file The ability editor's public surface.
 * @see docs/29-user-interface.md §29.6
 *
 * A directory rather than a file, for the reason `actor-sheet/` is one: the
 * editor grew a rail, eight sections and a descriptor renderer, and leaving
 * them in one module would make it the place all of them lived.
 */

export { AbilityEditor } from "./editor.mjs";
```

Fix `editor.mjs`'s own imports — every `../` becomes `../../`.

- [ ] **Step 2: Update the two importers**

`module/fgt.mjs:44`:
```js
import { AbilityEditor } from "./apps/ability-editor/index.mjs";
```

`module/apps/actor-sheet/sheet.mjs:369`:
```js
      const { AbilityEditor } = await import("../ability-editor/index.mjs");
```

- [ ] **Step 3: Verify nothing else referenced the old path**

```bash
grep -rn "ability-editor" module templates test tools --include=* | grep -v "ability-editor/"
```

Expected: only `templates/apps/ability-editor.hbs` (a template path, not an import) and `styles`.

- [ ] **Step 4: Run everything and verify live**

```bash
npm test && npm run lint && node tools/fgt-reload.mjs
echo "return typeof fgt.api.dialogs.AbilityEditor" | node tools/fgt-eval.mjs
```

Expected: tests green, and `"function"` from the live world.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(editor): a directory, for the reason actor-sheet is one

No behaviour change. The editor is about to grow a rail, eight
sections and a descriptor renderer, and leaving them in one 722-line
module would make it the place all of them lived.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 10: The rail and the one field partial

**Files:**
- Modify: `module/apps/ability-editor/editor.mjs` (`_prepareContext`, `PARTS`)
- Modify: `templates/apps/ability-editor.hbs`
- Create: `templates/apps/ability-editor-field.hbs`
- Modify: `styles/src/_editor.scss`
- Modify: `lang/en.json`

**Interfaces:**
- Consumes: `railRows`, `formRows` (Task 8); `SECTIONS`, `fieldGroupsFor` (Task 7).
- Produces: the `rail` and `sections` context keys Tasks 11–13 render into; a `jumpTo` action.

`ability-editor-field.hbs` is the single partial that renders **any** descriptor field by switching on `row.type`. It is what makes 54 rule elements a data problem. Register it with `foundry.applications.handlebars.loadTemplates` alongside the existing partials.

- [ ] **Step 1: Write the failing test**

Add to `test/unit/ability-editor-present.test.mjs`:

```js
describe("the rail marks where you are", () => {
  it("marks exactly one row current", () => {
    const rows = railRows({}, "ability", { current: "ruleElements" });
    expect(rows.filter((r) => r.current)).toHaveLength(1);
    expect(rows.find((r) => r.current).id).toBe("ruleElements");
  });

  it("marks none when no section is named", () => {
    expect(railRows({}, "ability").filter((r) => r.current)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it, implement `railRows`'s third argument, run it again**

```bash
npx vitest run test/unit/ability-editor-present.test.mjs -t "rail marks"
```

- [ ] **Step 3: Add the template partial**

Create `templates/apps/ability-editor-field.hbs`:

```hbs
{{!-- One partial renders any descriptor field (docs/29 §29.6). Adding a
      keyword is a table entry, never markup. --}}
<label class="fgt-editor__field fgt-editor__field--{{row.type}}"
       data-tooltip="{{localize row.hint}}">
  <span class="fgt-editor__label">{{localize row.label}}</span>

  {{#if (eq row.type "checkbox")}}
    <input type="checkbox" name="{{row.name}}" {{checked row.value}}>
  {{else if (eq row.type "select")}}
    <select name="{{row.name}}">
      <option value="">—</option>
      {{selectOptions row.choices selected=row.value}}
    </select>
  {{else if (eq row.type "number")}}
    <input type="number" name="{{row.name}}" value="{{row.value}}">
  {{else if (eq row.type "raw")}}
    <textarea name="{{row.name}}" rows="4">{{row.value}}</textarea>
  {{else}}
    <input type="text" name="{{row.name}}" value="{{row.value}}">
  {{/if}}

  {{#if row.problem}}
    {{!-- D29.2: never a control that is wrong without saying why. --}}
    <span class="fgt-editor__problem">{{row.problem}}</span>
  {{/if}}
</label>
```

`predicateList`, `tokenList`, `objectList` and `effectId` fall through to the text branch in this task and are given their own branches in Tasks 11–13, so the partial is never in a state where a field renders nothing.

- [ ] **Step 4: Add the rail to the main template and its styles, then verify**

```bash
npm run build:styles && npm run check:templates && npm test && npm run lint
```

- [ ] **Step 5: Commit** (message: `feat(editor): the rail, and the one partial that renders any field`)

---

## Task 11: The rule elements section — the one that does not exist

**Files:**
- Modify: `module/apps/ability-editor/editor.mjs` (`addElement`, `removeElement`, `moveElement`, `#applyElementPatch` actions)
- Modify: `templates/apps/ability-editor.hbs`
- Modify: `module/apps/ability-editor/present.mjs` (`elementRows`)
- Test: `test/unit/ability-editor-present.test.mjs`

**Interfaces:**
- Consumes: `elementsForBucket` (Task 3), `formRows` (Task 8).
- Produces: `elementRows(draft, bucket): object[]`.

This is the section the whole plan exists for. Achilles's `GrantedAbility` + `Knockback` become authorable here.

- [ ] **Step 1: Write the failing test**

```js
describe("elementRows", () => {
  it("renders each authored element with its descriptor's fields", () => {
    const rows = elementRows(
      { passiveRules: [{ key: "Knockback", direction: "travel" }] },
      "passiveRules",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("Knockback");
    expect(rows[0].fields.map((f) => f.key)).toEqual(["direction", "sidestep", "predicate"]);
    expect(rows[0].fields[0].value).toBe("travel");
  });

  it("offers only the keys that bucket accepts", () => {
    for (const choice of elementRows({}, "passiveRules").choices ?? []) {
      expect(choice.buckets).toContain("passiveRules");
    }
  });

  it("keeps an unknown key rather than dropping it", () => {
    // A module may add an element (§21.4). Losing it on the next save would
    // be the editor silently deleting somebody else's content.
    const rows = elementRows({ rules: [{ key: "SomeModuleElement", x: 1 }] }, "rules");
    expect(rows).toHaveLength(1);
    expect(rows[0].unknown).toBe(true);
    expect(rows[0].raw).toContain("SomeModuleElement");
  });

  it("returns nothing for an empty bucket", () => {
    expect(elementRows({}, "activeRules")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, implement, run it again.** The `unknown` branch is load-bearing: §21.4 lets a module add a rule element, and an editor that dropped it on save would delete another package's content. It renders as a raw JSON pane, exactly as an unknown phase kind already does.

- [ ] **Step 3: Add the section markup, the add/remove/reorder actions, styles, and localization**

- [ ] **Step 4: Verify**

```bash
npm test && npm run lint && npm run check:templates && npm run build:styles
```

- [ ] **Step 5: Commit** (message: `feat(editor): rule elements can be authored, not merely validated`)

---

## Task 12: Requirements, timing, and targeting selection

**Files:**
- Modify: `module/apps/ability-editor/editor.mjs`, `present.mjs`
- Modify: `templates/apps/ability-editor.hbs`
- Test: `test/unit/ability-editor-present.test.mjs`

Three sections, one task: each is a list or a small group rendered by the machinery Tasks 10–11 already built, and none is independently reviewable.

**Interfaces produced:** `requirementRows(draft, itemType)`, `timingRow(draft)`, `selectionRow(draft)`.

- [ ] **Step 1: Write the failing tests**

```js
describe("timingRow", () => {
  it("carries the window and the four against-modifiers", () => {
    const row = timingRow({ timing: {
      window: "whenAllyAttacked", againstKind: "np", againstRank: "A",
      requiresAoE: true, radius: 2,
    } });
    expect(row.windows).toContain("whenAllyAttacked");
    expect(row.fields.find((f) => f.key === "againstRank").value).toBe("A");
    expect(row.fields.find((f) => f.key === "radius").value).toBe(2);
  });

  it("reads a list of windows, because an ability may name two", () => {
    expect(timingRow({ timing: { window: ["ownTurn", "combatPhaseStart"] } }).windows)
      .toEqual(["ownTurn", "combatPhaseStart"]);
  });

  it("is empty rather than absent when there is no timing", () => {
    expect(timingRow({}).windows).toEqual([]);
  });
});

describe("selectionRow", () => {
  it("carries relations, includeSelf and chooser", () => {
    const row = selectionRow({ targeting: { selection: {
      relations: ["ally", "self"], includeSelf: true, chooser: "all",
    } } });
    expect(row.fields.find((f) => f.key === "relations").value).toEqual(["ally", "self"]);
    expect(row.fields.find((f) => f.key === "chooser").value).toBe("all");
  });
});

describe("requirementRows", () => {
  it("renders a stance requirement with its descriptor's choices", () => {
    const rows = requirementRows({ requirements: [{ kind: "stance", stance: "dismounted" }] }, "ability");
    expect(rows[0].fields[0].choices).toEqual(["mounted", "dismounted"]);
    expect(rows[0].fields[0].value).toBe("dismounted");
  });

  it("offers the command spell vocabulary to a command spell", () => {
    expect(requirementRows({}, "commandSpell").choices.map((c) => c.id)).toContain("servantInZon");
  });
});
```

- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Markup, styles, localization.**
- [ ] **Step 4: Verify** — `npm test && npm run lint && npm run check:templates`
- [ ] **Step 5: Commit** (message: `feat(editor): when it fires, what it needs, and who it catches`)

---

## Task 13: Phases, rebuilt on descriptors

**Files:**
- Modify: `module/apps/ability-editor/editor.mjs` — delete `PHASE_FIELDS` (lines 50-85 of the original file), render from `PHASE_DESCRIPTORS`
- Modify: `present.mjs`, `templates/apps/ability-editor.hbs`
- Test: `test/unit/ability-editor-present.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
describe("phaseRows", () => {
  it("renders createField with typed fields instead of raw JSON", () => {
    // 8 authored abilities use it and the old PHASE_FIELDS left every one to
    // a JSON textarea.
    const rows = phaseRows({ phases: [{ kind: "createField", target: "self" }] });
    expect(rows[0].fields.map((f) => f.key)).toContain("target");
    expect(rows[0].unknown).toBe(false);
  });

  it("offers the kinds content reaches for first", () => {
    expect(phaseRows({}).choices[0].id).toBe("applyEffects");
  });

  it("keeps an unknown kind in a raw pane rather than dropping it", () => {
    const rows = phaseRows({ phases: [{ kind: "moduleKind", x: 1 }] });
    expect(rows[0].unknown).toBe(true);
    expect(rows[0].raw).toContain("moduleKind");
  });
});
```

- [ ] **Step 2: Run, implement, run.**
- [ ] **Step 3: Verify** — `npm test && npm run lint && npm run check:templates`
- [ ] **Step 4: Commit** (message: `feat(editor): phases render from the table, not from a hand-written list`)

---

## Task 14: Reach — register the editor as the ability sheet

**Files:**
- Modify: `module/apps/index.mjs` (`registerSheets`)
- Modify: `templates/item/ability.hbs` (an "Edit rules" button for a GM)
- Test: `test/unit/sheet-registration.test.mjs` (create)

**This is the fix for the reported bug.** Items → Create Item → Ability currently opens `FGTItemSheet`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/sheet-registration.test.mjs`:

```js
/**
 * @file Who gets which sheet.
 * @see module/apps/index.mjs, docs/29-user-interface.md §29.6
 *
 * The reported bug: Items -> Create Item -> Ability opened the plain display
 * sheet -- a name, a rank, a cooldown -- because AbilityEditor was registered
 * as no Item sheet at all. It could only be reached from the pencil on an
 * actor's ability card, so an ability had to be OWNED before it could be
 * authored.
 */

import { describe, it, expect } from "vitest";
import { sheetFor, EDITOR_TYPES } from "../../module/apps/sheet-choice.mjs";

describe("sheetFor", () => {
  it("gives a GM the editor for every authorable item type", () => {
    for (const type of EDITOR_TYPES) {
      expect(sheetFor(type, { isGM: true }), type).toBe("editor");
    }
  });

  it("gives a player the read sheet", () => {
    // The editor writes rule elements, and a player who reorders a phase has
    // changed the ability for the whole table.
    expect(sheetFor("ability", { isGM: false })).toBe("read");
  });

  it("gives everyone the read sheet for a type the editor cannot author", () => {
    expect(sheetFor("masterEssence", { isGM: true })).toBe("read");
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement**

Create `module/apps/sheet-choice.mjs` — the GM/player predicate in **one** place so the two entry points (`registerSheets` and `actor-sheet/sheet.mjs:367`) cannot disagree:

```js
/** The item types the editor can author. */
export const EDITOR_TYPES = Object.freeze(["ability", "noblePhantasm", "classSkill", "commandSpell"]);

/**
 * @param {string} type
 * @param {{isGM: boolean}} user
 * @returns {"editor"|"read"}
 */
export function sheetFor(type, user) {
  return user?.isGM && EDITOR_TYPES.includes(type) ? "editor" : "read";
}
```

Then in `registerSheets`, register `AbilityEditor` for `EDITOR_TYPES` with `makeDefault: true`, keeping `FGTItemSheet` registered for the same types so a player (and a `@UUID` link) still lands on it, and re-point `actor-sheet/sheet.mjs:367` at `sheetFor`.

**Note:** `AbilityEditor` currently extends `ApplicationV2`, not `ItemSheetV2`. Registering it as a sheet requires it to accept the `{document}` constructor contract. Verify by opening a fresh Item in the live world before committing — if it throws, the minimal fix is a thin `ItemSheetV2` subclass that renders the editor's parts, not a rewrite.

- [ ] **Step 3: Add the "Edit rules" button to `templates/item/ability.hbs`**, shown only when `isGM` (that context key already exists — `apps/index.mjs` sets it).

- [ ] **Step 4: Verify live — this is the acceptance for the reported bug**

```bash
npm test && npm run lint && node tools/fgt-reload.mjs
echo "
const item = await Item.create({ name: 'Reach probe', type: 'ability' });
const cls = item.sheet.constructor.name;
await item.delete();
return { sheet: cls };
" | node tools/fgt-eval.mjs
```

Expected: `{"sheet":"AbilityEditor"}`. Then **open it by hand** in the browser — Items → Create Item → Ability — and screenshot it. A class name is not evidence the window renders.

- [ ] **Step 5: Commit** (message: `fix(editor): Items -> Create Item -> Ability opens the editor`)

---

## Task 15: Acceptance — author Akhilleus Kosmos

**Files:**
- Test: `test/golden/akhilleus-kosmos-authoring.test.mjs` (create)
- Modify: `docs/29-user-interface.md` §29.6, `docs/45-implementation-status.md`

**Interfaces:** none — this task proves the plan met its goal.

- [ ] **Step 1: Write the golden test**

Create `test/golden/akhilleus-kosmos-authoring.test.mjs`. It builds the ability's draft **through the descriptor tables only** — never by hand-writing the object — and asserts it equals the shipped YAML:

```js
/**
 * @file The acceptance criterion: Akhilleus Kosmos, from descriptors.
 * @see docs/superpowers/specs/2026-09-10-ability-editor-design.md §8
 *
 * Two clauses that have almost nothing to do with each other -- a passive that
 * decides how he walks through people, and a barrier he raises once in the
 * whole game. Before this plan, NEITHER half was authorable: `passiveRules`
 * had no UI at all and `timing` had no control.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { ELEMENT_DESCRIPTORS } from "../../module/rules/authoring/elements.mjs";
import { REQUIREMENT_DESCRIPTORS } from "../../module/rules/authoring/requirements.mjs";
import { TIMING_DESCRIPTORS } from "../../module/rules/authoring/timing.mjs";
import { PHASE_DESCRIPTORS } from "../../module/rules/authoring/phases.mjs";
import { EDITABLE_FIELDS } from "../../module/rules/authoring/ability.mjs";

const shipped = parse(readFileSync("packs/_source/abilities/achilles-akhilleus-kosmos.yml", "utf8"));

describe("every clause of Akhilleus Kosmos is reachable", () => {
  it("describes both passive rule elements", () => {
    for (const el of shipped.passiveRules) {
      expect(ELEMENT_DESCRIPTORS[el.key], el.key).toBeDefined();
    }
  });

  it("describes every field those elements use", () => {
    for (const el of shipped.passiveRules) {
      const known = new Set(ELEMENT_DESCRIPTORS[el.key].fields.map((f) => f.key));
      for (const key of Object.keys(el).filter((k) => k !== "key")) {
        expect(known, `${el.key}.${key} is authored and has no descriptor field`).toContain(key);
      }
    }
  });

  it("describes its timing window and every against-modifier", () => {
    expect(TIMING_DESCRIPTORS[shipped.timing.window]).toBeDefined();
    for (const key of Object.keys(shipped.timing).filter((k) => k !== "window")) {
      expect(["againstKind", "againstRank", "requiresAoE", "radius"], key).toContain(key);
    }
  });

  it("describes its requirement", () => {
    for (const req of shipped.requirements) {
      expect(REQUIREMENT_DESCRIPTORS[req.kind], req.kind).toBeDefined();
    }
  });

  it("describes its phase and the effect it applies", () => {
    for (const phase of shipped.phases) {
      expect(PHASE_DESCRIPTORS[phase.kind], phase.kind).toBeDefined();
    }
  });

  it("makes every top-level field editable", () => {
    const skip = new Set(["schema", "id", "phases", "passiveRules", "targeting", "requirements", "timing"]);
    for (const key of Object.keys(shipped).filter((k) => !skip.has(k))) {
      expect(EDITABLE_FIELDS, `${key} is authored in the shipped YAML and has no control`)
        .toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run it. Every failure is a real gap — fix the descriptor table, not the test.**

```bash
npx vitest run test/golden/akhilleus-kosmos-authoring.test.mjs
```

- [ ] **Step 3: Author it by hand in the live world, and look at it**

Green tests are not evidence the UI works. Create an empty Ability, and through the editor alone reproduce the shipped YAML: rank `A+`, `isNP`, `npTags: [barrier]`, `slug`, `expendsPermanently`, the `whenAllyAttacked` window with all four modifiers, the `stance: dismounted` requirement, both passive rule elements with their predicates, the self-anchored 5×5 square with its selection, and the `antiPurge` phase. Then press **Export to pack source** and diff:

```bash
npm run stage:yaml && npx vitest run test/golden/ && npm run validate:content
```

Screenshot the finished editor. State honestly which clauses needed the raw pane, if any.

- [ ] **Step 4: Update the docs** — §29.6 rewritten for what the editor now is, and a Chapter 45 entry. Chapter 45 alone is not enough.

- [ ] **Step 5: Full verification and commit**

```bash
npm test && npm run lint && npm run validate:content && npm run check:templates && npm run build:styles
```

Commit message: `feat(editor): Akhilleus Kosmos, authored from an empty Item`

---

## Self-Review

**Spec coverage.** D1 coverage → Tasks 3–7. D2 reach → Task 14. D3 step rail → Tasks 10 and 8 (`railRows`). D4 descriptor-driven → Tasks 1–2 and the `ability-editor-field.hbs` partial in Task 10. D5 hints required → Task 2's `descriptorProblems`, tested per table in Tasks 3–7. D6 raw pane → the `unknown` branches in Tasks 11 and 13. §3.2 field types → Task 1. §3.4 timing authority → the **prerequisite plan**, consumed by Task 6. §4.2 rule elements → Task 11. §4.3 phases → Task 13. §4.4 targeting selection → Task 12. §5 reach → Task 14. §6 hints and docs → the `doc` field, tested in Task 3. §7 drift contract → one test per table, both directions. §8 acceptance → Task 15. §11.3 per-item-type branching → `fieldGroupsFor` (Task 7), `requirementsFor` (Task 5), `sheetFor` (Task 14).

**Gap found and closed during review:** §3.3's `usage.mjs` and `tools/measure-vocabulary.mjs` have **no task**. That is deliberate — the design marks it optional and says it is the first thing to cut. Task 4 keeps the benefit by hand-setting `order` from the same measurement, so the picker still leads with `applyEffects`. If the generated counts are wanted later they are one small task, independent of everything here.

**Placeholders.** The "…the remaining 52 keys" markers in Tasks 3–5 are not placeholders in the banned sense: each is paired with the complete id list, the exact command that prints the source to read, and the rule for deriving fields, hints and buckets from it. Writing 54 hint sentences is genuinely the work of that task and cannot be pre-written here without inventing prose about executors the plan's author has not read line by line.

**Type consistency.** `describeTable`/`descriptorProblems`/`casesIn` (Task 2) are spelled identically in Tasks 3–7. `formRows`/`railRows`/`sectionState` (Task 8) are extended, never renamed, in Tasks 10–13. `elementsForBucket` (Task 3) is consumed by `elementRows` (Task 11). `requirementsFor` (Task 5) by `requirementRows` (Task 12). `EDITABLE_FIELDS`/`RUNTIME_FIELDS` (Task 7) by Task 15. `sheetFor`/`EDITOR_TYPES` (Task 14) are new and used only there.

**The one risk that could stop Task 14.** `AbilityEditor` extends `ApplicationV2`, not `ItemSheetV2`, and Foundry's sheet registration expects the document-sheet constructor contract. Task 14 Step 2 names this and bounds the fix. If it turns out to need more than a thin subclass, **stop and report** — it is a design question about the editor's base class, not something to improvise around at the end of a fifteen-task plan.
