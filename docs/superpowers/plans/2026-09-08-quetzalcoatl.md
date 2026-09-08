# Quetzalcoatl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Servant Quetzalcoatl so that every clause on
`char_orig_sheets/Copia de Quetzalcoatl.md` is live in the game, along with the seven engine
mechanisms her sheet needs and the codebase does not have.

**Architecture:** Four layers, and the layer a change belongs in is not negotiable.
`module/domain/` is pure maths and tables. `module/rules/` is pure functions over a board
*snapshot* — it may not touch a Foundry document and may not produce intents. `module/engine/` is
layer 3: it reads documents, calls layer 2, and writes through **intents** (`engine/intents.mjs`
→ `engine/applier.mjs`). `packs/_source/**.yml` is content, compiled by `tools/build-packs.mjs`.
The overwhelming majority of this Servant is content; the engine tasks exist only because ten
clauses have no vocabulary to be authored in yet. `node tools/check-layers.mjs` enforces the
boundary and runs as part of `npm run lint`.

**Tech Stack:** Foundry VTT v14 system, plain ESM JavaScript (no TypeScript, no build step for
`module/`), JSDoc types checked by `tsc -p jsconfig.json`, Vitest for tests, YAML content compiled
to LevelDB packs, ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-09-08-quetzalcoatl-design.md`

## Global Constraints

- **Layer discipline.** `module/rules/**` must not import from `module/engine/**` or touch
  `game`, `canvas`, `Actor`, `Hooks`. `node tools/check-layers.mjs` fails the build otherwise.
- **Writes go through intents.** Layer 3 never calls `actor.update()` for game state directly; it
  builds intents with `engine/intents.mjs` and applies them with
  `applyWorldIntents(intents, "<source>")`.
- **Ticks, not turns.** Every duration and period on a sheet is written in ◈ notation
  (`"1◈"`, `"⅓◈"`, `"4◈-⅓◈"`) and resolved with `resolveTicks(parseTick(x), { turnsPerRound })`
  from `module/domain/tick.mjs`. Never hard-code a turn count.
- **New authored keys must be allowlisted twice.** `tools/lib/content.mjs` (the compiler — an
  un-allowlisted key compiles to its schema default and is silently lost) and
  `tools/validate-content.mjs` (the validator). This has silently dropped an authored field five
  times in this codebase's history; `unitKeyCoverage` in the validator exists because of it.
- **No inert rules.** A rule that computes the right answer with no caller is treated as a defect,
  not as progress. Every task that adds a rule wires a reader in the same task.
- **Content ids are kebab-case; slugs and predicate names are camelCase.**
- **Verification commands:** `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run validate:content`. All four must pass before any commit.
- **Rebuilding packs requires Foundry fully closed** — the application holds the LevelDB open;
  shutting the *world* down does not release it.
- **Commit trailers.** Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Fx9Epmzq6EeLDcqo9rJ3oX
  ```

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `module/engine/terrain.mjs` | Layer 3. Creates, repaints and removes `fgt.terrain` Regions. The write half of Ch. 42. |
| `test/unit/quetzalcoatl.test.mjs` | Her sheet's own arithmetic and gating. |
| `packs/_source/servants/quetzalcoatl.yml` | The Servant document. |
| `packs/_source/platforms/quetzalcoatlus.yml` | The mount. |
| `packs/_source/structures/piedra-del-sol.yml` | The stone. |
| `packs/_source/effects/sap.yml`, `sol.yml` | Two missing effect documents. |
| `packs/_source/abilities/quetz-*.yml` (10 files) | Her Skills, Noble Phantasms and Spells. |

**Modified — layer 2 (pure)**

| File | Change |
|---|---|
| `module/rules/movement.mjs` | `sharesPanel` on the *mover* side; structure-vs-structure blocking. |
| `module/rules/terrain.mjs` | Three phase-override entries; `burning`'s per-field damage override. |
| `module/rules/environment.mjs` | `phaseAt(panel, board)`. |
| `module/rules/damage/pipeline.mjs` | Element-scoped modifier buckets; `elementFraction`. |
| `module/rules/platforms.mjs` | `replacesRiderAction`; `sharesPanel` on platform movement. |
| `module/rules/normal-attack.mjs` | A rider's Normal Attack resolves to its mount's. |
| `module/rules/budget.mjs` | A substituted action is charged once. |
| `module/rules/snapshot.mjs` | Project `sharesPanel`; `darkModifiers` reads `phaseAt`. |
| `module/rules/items.mjs` | The phase requirement reads `phaseAt`. |

**Modified — layer 3 and tooling**

| File | Change |
|---|---|
| `module/engine/skill-use.mjs` | `zone` phase kind; `selectAbilities` by contentId. |
| `module/engine/attack.mjs` | `aftermath` second resolution; `terrainConversions` caller. |
| `module/engine/fields.mjs` | `runUpkeep` sweeps platforms; `mayDeactivate` honours `lockout`. |
| `module/engine/summoning.mjs` | A sharing unit's panel counts as free. |
| `module/engine/token-footprint.mjs` | A sharing token draws above. |
| `module/data/actor/_shared.mjs` | `sharesPanel` on `unitCommon()`. |
| `tools/lib/content.mjs` | Allowlist `sharesPanel`, `replacesRiderAction`, `aftermath`, `elementFraction`. |
| `tools/validate-content.mjs` | Validate the same four, plus the `zone` phase kind. |

---

## Task ordering

Tasks 1–8 are independent engine work and may be done in any order. Tasks 9–11 depend on nothing
but each other's absence. Tasks 12–15 are content and depend on the engine tasks named in their
**Consumes** blocks. Task 16 is documentation. Task 17 is the live verification and must be last.

---

### Task 1: `sharesPanel` — the mover side

**Files:**
- Modify: `module/data/actor/_shared.mjs` (inside `unitCommon()`)
- Modify: `module/rules/snapshot.mjs:285`
- Modify: `module/rules/movement.mjs:302-353` (`canPassThrough`, `canStopOn`)
- Modify: `module/engine/summoning.mjs:111-116`
- Modify: `tools/lib/content.mjs` (`actorSystem`)
- Test: `test/unit/movement.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the authored key `sharesPanel: true` on any unit document; the snapshot field
  `unit.sharesPanel` (boolean); no new exported functions.

**Context the implementer needs.** The spec's §3 describes the gap slightly wider than it is.
`canPassThrough` (line 308) and `canStopOn` (line 351) **already** treat `platform` and
`structure` occupants as non-blocking, so an ordinary Servant can already walk onto Piedra Del
Sol's panel. Two things are actually missing:

1. A **structure or platform moving onto an occupied panel**. `canStopOn` asks
   `ignoresBlocking(unit)` for the mover, which is Bašmu's knock-back capability, so the
   Quetzalcoatlus cannot land on a Servant.
2. **Structure-vs-structure blocking.** Because both are unconditionally non-blocking today, two
   Bloodmarks may already occupy one panel. The rule is that they must not.

`ignoresBlocking` must not be reused: it means *"displace whoever is there"* and is read by
`engine/movement-hooks.mjs:220` to actually knock units back. A `sharesPanel` unit displaces
nobody.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/movement.test.mjs`:

```js
describe("sharesPanel — co-location without displacement", () => {
  const stone = (over = {}) => mover({
    id: "stone", kind: "structure", factionId: "a", sharesPanel: true, mov: 0, ...over,
  });

  it("lets a sharing unit stop on a panel a Servant occupies", () => {
    const b = board([other("enemy", 6, 7)]);
    expect(canStopOn(at(6, 7), stone(), b)).toBe(true);
  });

  it("does not let an ordinary unit stop on a Servant, sharing or not", () => {
    const b = board([other("enemy", 6, 7)]);
    expect(canStopOn(at(6, 7), mover(), b)).toBe(false);
  });

  it("refuses a sharing unit a panel another structure occupies", () => {
    const mark = other("mark", 6, 7, { kind: "structure" });
    expect(canStopOn(at(6, 7), stone(), board([mark]))).toBe(false);
  });

  it("refuses a sharing unit a panel a platform occupies", () => {
    const pad = other("pad", 6, 7, { kind: "platform" });
    expect(canStopOn(at(6, 7), stone(), board([pad]))).toBe(false);
  });

  it("still lets an ordinary unit walk onto a structure — unchanged", () => {
    const mark = other("mark", 6, 7, { kind: "structure" });
    expect(canStopOn(at(6, 7), mover(), board([mark]))).toBe(true);
  });

  it("does not displace: a sharing mover is not an ignoresBlocking mover", () => {
    const b = board([other("enemy", 6, 7)]);
    // Passing *through* an enemy is still refused; only stopping is permitted.
    expect(canPassThrough(at(6, 7), stone(), b)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/unit/movement.test.mjs -t "sharesPanel"`
Expected: FAIL — the first, third and fourth assertions are wrong today (`canStopOn` returns
`false`, `true`, `true` respectively).

- [ ] **Step 3: Add the schema field**

In `module/data/actor/_shared.mjs`, inside the object returned by `unitCommon()`, beside
`undamageable`:

```js
    // Quetzalcoatl's Piedra Del Sol and her Quetzalcoatlus: *"the panel occupied
    // by Piedra Del Sol can still be Moved onto (replace the Piedra Del Sol on
    // top of any Units which Move onto that panel)"*.
    //
    // NOT `movesOntoOccupiedPanels`, which is Bašmu's and Kingprotea's and means
    // *"all Units occupying said panels will be knocked back"*. That one
    // DISPLACES; this one co-locates and displaces nobody. Two sheets, two
    // sentences, two capabilities — `engine/movement-hooks.mjs` knocks units
    // back off the first flag and must never see this one.
    sharesPanel: new fields.BooleanField({ initial: false }),
```

- [ ] **Step 4: Project it into the snapshot**

In `module/rules/snapshot.mjs`, immediately after line 285's
`ignoresOccupancy: Boolean(sys.movesOntoOccupiedPanels),`:

```js
    sharesPanel: Boolean(sys.sharesPanel),
```

- [ ] **Step 5: Allowlist it in the compiler**

In `tools/lib/content.mjs`, in `actorSystem()`, immediately after the
`movesOntoOccupiedPanels` line:

```js
    // Co-location, as opposed to displacement. See `data/actor/_shared.mjs`.
    sharesPanel: Boolean(doc.sharesPanel),
```

- [ ] **Step 6: Implement the movement rule**

In `module/rules/movement.mjs`, replace the body of `canStopOn` (lines 346-353) with:

```js
export function canStopOn(panel, unit, board) {
  if (!canPassThrough(panel, unit, board)) return false;
  const here = occupantsAt(panel, board, unit.level);
  if (here.length === 0) return true;

  // Objects are stood on, not blocked by: a Platform is terrain and a Structure
  // is a thing lying on the ground. Unchanged, and the reason an ordinary
  // Servant can already walk under Piedra Del Sol.
  const solid = here.filter((u) => u.id !== unit.id && !OBJECT_KINDS.has(u.kind));

  // A unit that shares panels is stopped only by ANOTHER OBJECT. Two figurines
  // cannot stand on the same square; a figurine and a Servant can.
  if (unit?.sharesPanel) {
    return !here.some((u) => u.id !== unit.id && OBJECT_KINDS.has(u.kind));
  }

  if (solid.length === 0) return true;
  return ignoresBlocking(unit);
}
```

And add beside `IGNORES_BLOCKING` near the top of the file (after line 21):

```js
/**
 * Unit kinds that are scenery rather than combatants for occupancy.
 *
 * Clause 3 of §8.3 is about *Units*: a Platform is stood on and a Structure is
 * an object lying on the panel, so neither blocks a step. Two of them on one
 * panel is a different question, and `canStopOn` answers it.
 */
const OBJECT_KINDS = new Set(["platform", "structure"]);
```

Then in `canPassThrough`, replace line 308's inline array with the shared set so the two cannot
drift:

```js
  const blocking = occupant && !OBJECT_KINDS.has(occupant.kind);
```

- [ ] **Step 7: Let a sharing unit be summoned onto an occupied panel**

In `module/engine/summoning.mjs`, the free-panel search at lines 111-116 collects occupied panels.
Replace the `occupied` set construction so a sharing unit is not counted:

```js
  const occupied = new Set(
    (board.units ?? [])
      // A unit that shares panels does not make a panel unavailable — that is
      // what sharing means, and a summon refused the only free square because
      // Piedra Del Sol was standing on it would be the same defect from the
      // other side.
      .filter((u) => !u.sharesPanel)
      .flatMap((u) => (u.panels ?? (u.panel ? [u.panel] : [])))
      .map((p) => `${p.i},${p.j}`),
  );
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run test/unit/movement.test.mjs test/unit/bloodmarks.test.mjs`
Expected: PASS, including every pre-existing movement and Bloodmark test. Bloodmark does **not**
carry `sharesPanel`, so nothing about Medusa changes.

- [ ] **Step 9: Draw a sharing token above the unit it covers**

In `module/engine/token-footprint.mjs`, where token creation data is assembled, add `sort` so the
figurine renders on top — *"place the Piedra Del Sol on top of any Units which Move onto that
panel"* is literally a z-order instruction:

```js
    // A sharing token co-occupies a panel, so it must draw ABOVE whoever is
    // under it or the sheet's own parenthetical is invisible.
    ...(unit?.sharesPanel ? { sort: 100 } : {}),
```

- [ ] **Step 10: Full verification**

Run: `npm test && npm run lint && npm run typecheck && npm run validate:content`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add module/data/actor/_shared.mjs module/rules/snapshot.mjs module/rules/movement.mjs \
        module/engine/summoning.mjs module/engine/token-footprint.mjs \
        tools/lib/content.mjs test/unit/movement.test.mjs
git commit -m "feat(movement): sharesPanel, co-location without displacement"
```

---

### Task 2: The two missing effect documents

**Files:**
- Create: `packs/_source/effects/sap.yml`
- Create: `packs/_source/effects/sol.yml`
- Test: `test/unit/content.test.mjs` (existing suite validates every effect document)

**Interfaces:**
- Consumes: nothing.
- Produces: effect ids `sap` and `sol`, referenceable as `{ id: sap }` from any `applyEffects`
  rule.

**Context.** `module/engine/scheduler.mjs:1267` already carries
`sap: { when: "turnEnd", amount: () => 50, actedOnly: true }` — the damage-over-time half has
existed since the scheduler was written, and **no effect document has ever existed to carry it**,
so every sheet that inflicts Sap has been inflicting nothing. `docs/A-effect-catalogue.md:206`
gives its semantics, shared with `Bleed`. Copy `packs/_source/effects/bleed.yml`'s shape exactly.

`Sol` has a catalogue row (`docs/A-effect-catalogue.md` §A.17.1) and no document. Its terrain
behaviour is Task 5's; this document is only the marker the buff applies.

- [ ] **Step 1: Read the model document**

Run: `cat packs/_source/effects/bleed.yml`
Copy its field set — `schema`, `id`, `name`, `polarity`, `valence`, `stacking`, `description` —
rather than inventing one.

- [ ] **Step 2: Write `sap.yml`**

```yaml
# docs/A-effect-catalogue.md §A.7: "Sap / Bleed — −50 Health at the end of the
# unit's turn AND at the end of any turn it Acts. Chance of inflicting on
# `Mechanical` units −50%."
#
# The DoT half has existed since `engine/scheduler.mjs` was written
# (`sap: { when: "turnEnd", amount: () => 50, actedOnly: true }`) and this
# document has not, so every sheet in the corpus that inflicts Sap has been
# inflicting nothing at all. Quetzalcoatl's *Ehecatle* is what noticed.
#
# Identical to `bleed.yml` in every field: the catalogue files them as one row
# because they are one rule with two names.
schema: 1
id: sap
name: "Sap"
polarity: debuff
valence: neutral
stacking: nonRefreshing
description: |
  −50 Health at the end of the Unit's Turn and at the end of any Turn it Acts.
  Chance of being inflicted is reduced by 50% for Units with the 'Mechanical' Attribute.
```

Cross-check the four vocabulary values (`polarity`, `valence`, `stacking`) against `bleed.yml`
and copy whatever it actually uses; the values above are the catalogue's `nnr` row expanded, and
`bleed.yml` is the authority on their spelling.

- [ ] **Step 3: Write `sol.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md, Charisma of the Sun
# clause 3. Catalogue row: docs/A-effect-catalogue.md §A.17.1.
#
#   "Applies the 'Sol' buff to herself for 1◈ Turns, its effects are as
#    follows- The 5x5 panel area around Quetz is 'Day', even if it is during a
#    Night Round."
#
# The document is only the MARKER. The daylight itself is a `sunlight` terrain
# area painted by the ability's `zone` phase with `followsSource: true`, which
# is the one flag `data/regions.mjs` declared specifically for this clause
# (*"Quetzalcoatl's Sol is one of the few that does"*). Putting the area on the
# effect instead would make it an aura, and Ch. 42 §42.1 is explicit that
# terrain is not an effect.
schema: 1
id: sol
name: "Sol"
polarity: buff
valence: neutral
stacking: nonRefreshing
description: |
  The 5x5 panel area around the bearer counts as 'Day' regardless of the Round's phase.
```

- [ ] **Step 4: Validate**

Run: `npm run validate:content && npx vitest run test/unit/content.test.mjs`
Expected: PASS. If the validator rejects a vocabulary value, correct it against `bleed.yml` — do
not add a new vocabulary entry.

- [ ] **Step 5: Commit**

```bash
git add packs/_source/effects/sap.yml packs/_source/effects/sol.yml
git commit -m "feat(effects): Sap and Sol, two documents the engine was waiting for"
```

---

### Task 3: Element-scoped modifiers become readable, and `elementFraction`

**Files:**
- Modify: `module/rules/damage/pipeline.mjs:695-703` (bucket constants), stage 4, stage 0, stage 16
- Modify: `tools/lib/content.mjs` (allowlist `elementFraction` on a damage spec)
- Modify: `packs/_source/abilities/karna-mana-burst-flames.yml`
- Test: `test/unit/elements.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the authored key `damage.elementFraction` (number, default `1`); the modifier keys
  `elementAtkUp`, `elementDefUp`, `elementDefDwn` become live members of `MODIFIER_KEYS`.

**Context — the gap is wider than "half".** `module/rules/terrain.mjs` emits `elementAtkUp`,
`elementDefUp` and `elementDefDwn` modifiers from six terrain types (Waterside, Forest, Snowfield,
Burning, Lava). **None of those keys is in any bucket in `pipeline.mjs`.** `ATTACKER_BUCKET_KEYS`
is `["atkUp", "atkDwn", "dmgUp", "npDmUp", "npDmDwn"]` and `DEFENDER_BUCKET_KEYS` is
`["defUp", "defDwn", "ward"]`. Per that file's own comment, *"a modifier whose key is not in one
is collected onto the unit, carried through the snapshot, and never read"*. So terrain's element
interactions have been inert since terrain shipped.

Making `(half)` mean anything therefore requires making elements mean anything first. Both halves
belong in this task, because a fraction of nothing is nothing.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/elements.test.mjs` (match the file's existing helpers for building a
`computeDamage` context; read the top of the file first and reuse them rather than writing new
ones):

```js
describe("element-scoped modifiers", () => {
  it("applies elementDefUp only to an attack of that element", () => {
    const soaked = { key: "elementDefUp", element: "water", value: 50, source: "Burning" };
    const fire = damageWith({ attack: { element: "fire" }, defenderMods: [soaked] });
    const water = damageWith({ attack: { element: "water" }, defenderMods: [soaked] });
    expect(fire.total).toBeGreaterThan(water.total);
  });

  it("ignores an element modifier on an attack with no element", () => {
    const soaked = { key: "elementDefUp", element: "water", value: 50, source: "Burning" };
    const none = damageWith({ attack: { element: null }, defenderMods: [soaked] });
    const bare = damageWith({ attack: { element: null }, defenderMods: [] });
    expect(none.total).toBe(bare.total);
  });
});

describe("elementFraction — 'Fire damage (half)'", () => {
  it("applies an element modifier to only the stated fraction", () => {
    const resist = { key: "elementDefUp", element: "fire", value: 50, source: "Snowfield" };
    const full = damageWith({ attack: { element: "fire", elementFraction: 1 }, defenderMods: [resist] });
    const half = damageWith({ attack: { element: "fire", elementFraction: 0.5 }, defenderMods: [resist] });
    const none = damageWith({ attack: { element: "fire" }, defenderMods: [] });
    // Half the damage is Fire-typed, so half the resistance lands.
    expect(half.total).toBeGreaterThan(full.total);
    expect(half.total).toBeLessThan(none.total);
  });

  it("defaults to 1 so every existing ability is unchanged", () => {
    const resist = { key: "elementDefUp", element: "fire", value: 50, source: "Snowfield" };
    const implicit = damageWith({ attack: { element: "fire" }, defenderMods: [resist] });
    const explicit = damageWith({ attack: { element: "fire", elementFraction: 1 }, defenderMods: [resist] });
    expect(implicit.total).toBe(explicit.total);
  });

  it("converts only the fraction to healing for a matching heal effect", () => {
    // "Fire damage (half)" against flamHeal: half heals, half still hurts.
    const out = damageWith({
      attack: { element: "burn", elementFraction: 0.5 },
      defender: { effects: ["flamHeal"] },
    });
    expect(out.total).toBeGreaterThan(0);
    expect(out.healed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/unit/elements.test.mjs -t "element"`
Expected: FAIL — element modifiers are not read at all, so the first test's two totals are equal.

- [ ] **Step 3: Add the element buckets**

In `module/rules/damage/pipeline.mjs`, after line 702:

```js
/**
 * Element-scoped percentage keys.
 *
 * `rules/terrain.mjs` has emitted all three since terrain shipped — Waterside's
 * water offence and lightning vulnerability, Snowfield's ice vulnerability and
 * fire resistance, Burning's water resistance — and **none of them was in a
 * bucket**, so every one was collected onto the unit, carried through the
 * snapshot, and never read. Same defect shape this file's own comment above
 * describes for `doomsdayShelter`.
 *
 * Scoped rather than shared: they apply only when the attack's element matches,
 * and only to the fraction of the attack that carries that element.
 */
const ELEMENT_ATTACK_KEYS = new Set(["elementAtkUp", "elementAtkDwn"]);
const ELEMENT_DEFENCE_KEYS = new Set(["elementDefUp", "elementDefDwn"]);
```

Extend the exported list at line 717 so the content validator accepts them:

```js
export const MODIFIER_KEYS = Object.freeze([
  ...ATTACKER_BUCKET_KEYS, ...DEFENDER_BUCKET_KEYS,
  ...FLAT_ATTACK_KEYS, ...FLAT_REDUCTION_KEYS,
  ...ELEMENT_ATTACK_KEYS, ...ELEMENT_DEFENCE_KEYS,
  // Read by their own single-key lookups rather than through a bucket.
  "critDmUp", "critDmDwn", "critResUp", "critResDwn", "blockUp", "defCrk",
]);
```

- [ ] **Step 4: Read them in stage 4, scaled by the fraction**

Add a stage function immediately after `stage4Buckets` (find it by the `s.begin(4)` call) and call
it from `computeDamage` between stages 4 and 5:

```js
/**
 * Stage 4b — element-scoped percentages, applied to the element's own share.
 *
 * *"Fire damage (half)"* on Karna, Dioscuri, Raikou and Quetzalcoatl means half
 * the damage carries the element. A defender resisting Fire resists that half
 * and not the rest, which is the difference between the rule as written and the
 * simplification `karna-mana-burst-flames.yml` recorded.
 *
 * @param {PipelineState} s
 */
function stage4bElements(s) {
  const element = s.ctx.attack?.element ?? null;
  if (!element) return;
  const fraction = elementFractionOf(s);
  if (fraction <= 0) return;

  s.begin(4.5);
  let pct = 0;
  for (const m of activeMods(s, s.ctx.attacker, ELEMENT_ATTACK_KEYS)) {
    if (m.element !== element) continue;
    const v = magnitudeOf(m, s.isNP, s.ctx) * (m.key === "elementAtkDwn" ? -1 : 1);
    pct += v;
    s.contribute(m.key, v, `${m.source} (${element})`, "attacker");
  }
  for (const m of activeMods(s, s.ctx.defender, ELEMENT_DEFENCE_KEYS)) {
    if (m.element !== element) continue;
    // `elementDefUp` REDUCES damage taken; `elementDefDwn` increases it.
    const v = magnitudeOf(m, s.isNP, s.ctx) * (m.key === "elementDefUp" ? -1 : 1);
    pct += v;
    s.contribute(m.key, v, `${m.source} (${element})`, "defender");
  }

  // Only the element's share is moved. At fraction 1 this is the ordinary
  // whole-attack percentage; at 0.5 the untyped half is untouched.
  if (pct !== 0) s.applyPercent(pct * fraction);
  s.end(4.5);
}

/**
 * How much of this attack carries its element. `1` unless the sheet says
 * "(half)".
 *
 * @param {PipelineState} s
 * @returns {number}
 */
function elementFractionOf(s) {
  const f = s.ctx.attack?.elementFraction;
  return typeof f === "number" && f >= 0 && f <= 1 ? f : 1;
}
```

`s.applyPercent` may not exist under that name — read `stage4Buckets`'s own tail to find how it
folds its accumulated `bucket` into the running total, and use the same mechanism. Do not invent a
second way to apply a percentage.

- [ ] **Step 5: Make the heal conversion partial**

In `stage0Precondition`, the element-to-heal branch currently sets `s.converted = true` for the
whole attack. Change it to record the fraction so stage 16 can split it:

```js
  // Element-to-heal conversion happens before anything reduces the number.
  const heal = { poison: "poisHeal", curse: "cursHeal", burn: "flamHeal" }[attack?.element ?? ""];
  if (heal && has(defender, heal)) {
    // "(half)" converts HALF. A whole-attack conversion would let a Servant with
    // `flamHeal` heal from the untyped half of Xiuhcoatl as well, which is the
    // exact error `karna-mana-burst-flames.yml` recorded as a known simplification.
    s.convertedFraction = elementFractionOf(s);
    s.converted = s.convertedFraction >= 1;
    s.note("conversion", `${attack.element} converted to healing by ${heal}`, "defender");
  }
```

Then in `stage16AbsorptionAndClamp`, where `s.converted` is consumed, split the total: the healed
amount is `total * s.convertedFraction` and the damage is the remainder. Read that stage before
editing and follow whatever field it already reports healing through; if `s.converted` is the only
signal today, add the partial branch beside it rather than replacing it, so a fraction of `1`
takes the existing path byte-for-byte.

- [ ] **Step 6: Allowlist `elementFraction`**

In `tools/lib/content.mjs`, find where a damage spec is compiled (search for `multiplier` beside
`element`) and add:

```js
    // "Fire damage (half)" — how much of the total carries the element.
    elementFraction: doc.damage?.elementFraction ?? undefined,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/unit/elements.test.mjs test/golden/damage.test.mjs`
Expected: PASS. The golden suite is the guard that no existing damage number moved — if a golden
figure changed, the fraction default is not `1` somewhere and that is a bug, not a golden to
update.

- [ ] **Step 8: Retrofit Karna**

In `packs/_source/abilities/karna-mana-burst-flames.yml`, delete the six-line `KNOWN
SIMPLIFICATION` comment (lines ~46-51) and replace it with:

```yaml
  # "Fire Damage (half)." Half the total carries the element, so a defender
  # resisting Fire resists that half and a defender with `flamHeal` heals from
  # that half. Modelled since Quetzalcoatl; this file previously recorded the
  # whole-attack approximation as a known simplification.
  element: fire
  elementFraction: 0.5
```

- [ ] **Step 9: Full verification**

Run: `npm test && npm run lint && npm run typecheck && npm run validate:content`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add module/rules/damage/pipeline.mjs tools/lib/content.mjs \
        packs/_source/abilities/karna-mana-burst-flames.yml test/unit/elements.test.mjs
git commit -m "feat(damage): element-scoped modifiers, and elementFraction for '(half)'"
```

---

### Task 4: `phaseAt` — Day and Night become per-panel

**Files:**
- Modify: `module/rules/terrain.mjs` (`TERRAIN`)
- Modify: `module/rules/environment.mjs` (new export `phaseAt`)
- Modify: `module/rules/snapshot.mjs:783`
- Modify: `module/rules/items.mjs:242`
- Test: `test/unit/terrain.test.mjs`, `test/unit/environment.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `phaseAt(panel, board) -> "day"|"night"|"none"` exported from
  `module/rules/environment.mjs`; terrain types `sunlight`, `darkness`, `indoors`.

**Context.** `docs/42-terrain.md` §42.6 **already writes this function out**, names Quetzalcoatl's
Sol as its motivating case, and records decision **Q43**: day/night is evaluated at the
*defender's* panel for damage-taken modifiers and at the *attacker's* panel for damage-dealt
modifiers. Build the chapter's version, not a near-miss of it.

`darkModifiers(unit, current)` in `environment.mjs` returns both a dealt and a taken modifier from
one phase value, and `snapshot.mjs:783` calls it per unit. Reading the phase at **that unit's own
panel** satisfies Q43 in both directions at once, because the dealt modifier belongs to the dark
unit as attacker and the taken modifier to the same unit as defender.

There are only three positional readers of `board.phase` in the codebase:
`snapshot.mjs:783`, `items.mjs:242`, and `attack.mjs:4156`. The third —
`requiresLuckCheckIn` — is a property of the **Round**, not of a panel, and **keeps
`board.phase`**.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/terrain.test.mjs`:

```js
import { phaseAt } from "../../module/rules/environment.mjs";

describe("phaseAt — the per-panel day/night override (§42.6)", () => {
  const night = { ...boardWith("sunlight", [at(1, 1), at(1, 2)]), phase: "night" };

  it("reports Day inside a sunlight area during a Night round", () => {
    expect(phaseAt(at(1, 1), night)).toBe("day");
  });

  it("reports the round's phase outside the area", () => {
    expect(phaseAt(at(9, 9), night)).toBe("night");
  });

  it("reports Night inside a darkness area during a Day round", () => {
    const day = { ...boardWith("darkness", [at(2, 2)]), phase: "day" };
    expect(phaseAt(at(2, 2), day)).toBe("night");
  });

  it("reports neither when Indoors, and Indoors wins over Sunlight", () => {
    const both = {
      ...boardWith("indoors", [at(3, 3)]), phase: "day",
      terrain: { areas: [
        { id: "a", type: "sunlight", panels: [at(3, 3)] },
        { id: "b", type: "indoors", panels: [at(3, 3)] },
      ] },
    };
    expect(phaseAt(at(3, 3), both)).toBe("none");
  });

  it("defaults to day for a board with no phase at all", () => {
    expect(phaseAt(at(0, 0), { terrain: { areas: [] } })).toBe("day");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/unit/terrain.test.mjs -t "phaseAt"`
Expected: FAIL with `phaseAt is not a function`.

- [ ] **Step 3: Add the three terrain entries**

In `module/rules/terrain.mjs`, inside `TERRAIN`, after `labyrinth`:

```js
  // §42.6's three phase-override types. They carry NO standing effects: they do
  // not modify anything, they change which phase the panel is in, and every
  // Day/Night clause in the game then reads that instead of the Round's.
  //
  // Authored as a set of three because the chapter defines them as one
  // mechanism. Sol needs only `sunlight`; building that branch alone would
  // leave `phaseAt` a partial copy of a function §42.6 already wrote out whole.
  sunlight: { name: "Sunlight", effects: [] },
  darkness: { name: "Darkness", effects: [] },
  indoors: { name: "Indoors", effects: [] },
```

- [ ] **Step 4: Implement `phaseAt`**

In `module/rules/environment.mjs`, add the import and the function beside `phase`:

```js
import { terrainAt } from "./terrain.mjs";

/**
 * Which phase a PANEL is in — §42.6, verbatim.
 *
 * Ch. 19 §19.2 treated the phase as a global property of the Round.
 * Quetzalcoatl's `Sol` (*"the 5x5 panel area around Quetz is 'Day', even if it
 * is during a Night Round"*) makes it a property of the panel, and Ozymandias's
 * *Pyramid Drop* leaves its blast area as Day for the same reason.
 *
 * Precedence is the chapter's: Indoors first, because *"there is no Day or Night
 * when Indoors"* is an absence rather than a value and must beat both overrides.
 *
 * **Decision Q43** governs which panel a caller passes: the DEFENDER's for
 * damage-taken modifiers, the ATTACKER's for damage-dealt. `darkModifiers`
 * returns both from one unit's own panel, which satisfies both halves at once.
 *
 * @param {{i: number, j: number}} panel
 * @param {object} board
 * @returns {"day"|"night"|"none"}
 */
export function phaseAt(panel, board) {
  const here = terrainAt(panel, board);
  if (here.includes("indoors")) return "none";
  if (here.includes("sunlight")) return "day";
  if (here.includes("darkness")) return "night";
  return board?.phase ?? "day";
}
```

If `check-layers.mjs` objects to `environment.mjs` importing `terrain.mjs`, both are layer 2 and
the import is legal; if it reports a *cycle*, move `phaseAt` into `terrain.mjs` instead and
re-export it from `environment.mjs`.

- [ ] **Step 5: Repoint the two positional readers**

In `module/rules/snapshot.mjs`, line 783:

```js
    const mods = [...darkModifiers(u, phaseAt(u.panel, board)), ...homeBaseModifiers(u, board)];
```

Add `phaseAt` to that file's existing `environment.mjs` import.

In `module/rules/items.mjs`, line 242:

```js
      // The panel the unit is standing on, not the Round: a Servant inside Sol
      // is in daylight while the board is at Night (§42.6).
      return phaseAt(unit?.panel ?? { i: -1, j: -1 }, board) === (req.is ?? "night");
```

Leave `module/engine/attack.mjs:4156` alone and add a one-line comment there saying why:

```js
    // `board.phase`, not `phaseAt`: `requiresLuckCheckIn` names ROUND phases,
    // which a 5x5 patch of daylight does not change (§42.6).
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/unit/terrain.test.mjs test/unit/environment.test.mjs test/unit/items.test.mjs`
Expected: PASS.

- [ ] **Step 7: Full verification**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add module/rules/terrain.mjs module/rules/environment.mjs module/rules/snapshot.mjs \
        module/rules/items.mjs module/engine/attack.mjs test/unit/terrain.test.mjs
git commit -m "feat(terrain): phaseAt, the per-panel day/night override from 42.6"
```

---

### Task 5: `engine/terrain.mjs` and the `zone` phase kind

**Files:**
- Create: `module/engine/terrain.mjs`
- Modify: `module/engine/skill-use.mjs` (phase switch, beside `case "createField"`)
- Modify: `tools/validate-content.mjs` (accept `kind: zone`)
- Test: `test/unit/terrain-events.test.mjs`

**Interfaces:**
- Consumes: Task 4's terrain types.
- Produces:
  ```js
  // module/engine/terrain.mjs
  export async function paintTerrain({ types, panels, duration, sourceUnitId, followsSource, tag })
    // -> Promise<{ok: boolean, regionId?: string, reason?: string}>
  export async function clearTerrain(tag)          // -> Promise<{ok: boolean, removed: number}>
  export function terrainRegionsFor(tag)           // -> RegionDocument[]
  ```
  and the authored phase kind `zone` with a `spec` payload.

**Context.** `rules/terrain.mjs` is complete, tested and **read-only**. `board.terrain.areas` is
built exclusively from a scene's hand-placed `fgt.terrain` Regions
(`engine/board.mjs#terrainAreasOf`, line 322). Nothing has ever created one. `TerrainBehavior`
(`module/data/regions.mjs:25`) already declares `types`, `duration`, `sourceUnitId`,
`followsSource` and `createdOnTurn`; all five have been inert since the model was written.

`docs/42-terrain.md` §42.7 already names the authored shape: a `zone` phase with a `terrain`
payload, worked through Ozymandias's *Pyramid Drop*. Use that spelling.

`tag` is how an area is found again. Without it, an expiring buff could not find the ground it
painted. Format: `"<source>:<id>"` — `sol:<unitId>`, `piedra:<fieldId>`, `xiuhcoatl:<fieldId>`.

- [ ] **Step 1: Write `module/engine/terrain.mjs`**

```js
/**
 * @file Creating, finding and removing terrain areas.
 * @see docs/42-terrain.md §42.7
 *
 * Layer 3. `rules/terrain.mjs` is the read half — the catalogue, the standing
 * effects, the periodics and `phaseAt` — and has been complete and tested since
 * C1. This is the write half, which did not exist: every terrain area in the
 * game had to be drawn by hand as a Region, and `terrainConversions` had no
 * caller at all.
 *
 * Areas are `RegionDocument`s carrying an `fgt.terrain` behaviour, which is
 * exactly what `engine/board.mjs#terrainAreasOf` already reads — so nothing on
 * the read side changes and a painted area is indistinguishable from a
 * hand-drawn one the moment it exists.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * The Regions this tag created.
 *
 * A `tag` is what makes a painted area findable again: `sol:<unitId>` is erased
 * when the buff expires, `piedra:<fieldId>` when the field closes. Without one,
 * an effect could paint the ground and never find it.
 *
 * @param {string} tag
 * @returns {object[]}
 */
export function terrainRegionsFor(tag) {
  const out = [];
  for (const region of canvas?.scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      if (behavior.system?.tag === tag) { out.push(region); break; }
    }
  }
  return out;
}

/**
 * Paint an area of terrain.
 *
 * @param {object} args
 * @param {string[]} args.types one or more entries of `rules/terrain.mjs`'s TERRAIN
 * @param {Array<{i: number, j: number}>} args.panels
 * @param {string|null} [args.duration] a ◈ expression; `null` is permanent
 * @param {string|null} [args.sourceUnitId]
 * @param {boolean} [args.followsSource] repaint around the source when it moves
 * @param {string} args.tag how this area is found again
 * @returns {Promise<{ok: boolean, regionId?: string, reason?: string}>}
 */
export async function paintTerrain({
  types, panels, duration = null, sourceUnitId = null, followsSource = false, tag,
}) {
  const scene = canvas?.scene;
  if (!scene) return { ok: false, reason: "noScene" };
  if (!Array.isArray(panels) || panels.length === 0) return { ok: false, reason: "noPanels" };

  // Re-painting an existing tag MOVES it rather than adding a second area. A
  // following area moves every time its source does, and accumulating one
  // Region per step would leave a comet trail of daylight behind Quetzalcoatl.
  await clearTerrain(tag);

  const size = scene.grid.size;
  const shapes = panels.map((p) => ({
    type: "rectangle",
    x: p.j * size, y: p.i * size, width: size, height: size,
    rotation: 0, hole: false,
  }));

  const tick = game.combat?.system?.globalTurn ?? 0;
  const created = await scene.createEmbeddedDocuments("Region", [{
    name: `${types.join("/")} (${tag})`,
    shapes,
    behaviors: [{
      type: "terrain",
      system: {
        types, duration, sourceUnitId, followsSource,
        createdOnTurn: tick,
        tag,
        expiry: duration
          ? tick + resolveTicks(parseTick(duration), {
            turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          })
          : null,
      },
    }],
  }]);

  return { ok: true, regionId: created[0]?.id };
}

/**
 * Erase every area a tag created.
 *
 * @param {string} tag
 * @returns {Promise<{ok: boolean, removed: number}>}
 */
export async function clearTerrain(tag) {
  const scene = canvas?.scene;
  if (!scene) return { ok: false, removed: 0 };
  const ids = terrainRegionsFor(tag).map((r) => r.id);
  if (ids.length === 0) return { ok: true, removed: 0 };
  await scene.deleteEmbeddedDocuments("Region", ids);
  return { ok: true, removed: ids.length };
}
```

- [ ] **Step 2: Extend `TerrainBehavior` with `tag` and `expiry`**

In `module/data/regions.mjs`, inside `TerrainBehavior.defineSchema()`:

```js
      // How a painted area is found again — `sol:<unitId>`, `piedra:<fieldId>`.
      // A hand-drawn Region has none, which is what keeps the GM's own terrain
      // out of every automatic sweep.
      tag: new fields.StringField({ required: false, nullable: true, initial: null }),
      // The ABSOLUTE tick it disappears on, resolved at paint time. Durations
      // are stored as expiry ticks everywhere else in this system (§7.5) for
      // the same reason: a countdown needs a hook that can fail to fire, and an
      // expiry cannot.
      expiry: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
```

- [ ] **Step 3: Add the `zone` phase kind**

In `module/engine/skill-use.mjs`, in the phase switch, immediately after the `case "createField"`
block closes:

```js
        case "zone": {
          // Once per use, from the caster: an area is one area, and looping it
          // over a target list would paint one per Unit caught. Same reason
          // `createField` guards this way.
          if (target.unitId !== actor.id) break;
          const spec = phase.spec ?? {};
          const self = board.units.find((u) => u.id === actor.id);
          const panels = zonePanels(spec, self, board, placement);
          const painted = await paintTerrain({
            types: spec.terrain ?? [],
            panels,
            duration: spec.duration ?? null,
            sourceUnitId: actor.id,
            followsSource: Boolean(spec.followsSource),
            tag: spec.tag ?? `${ability.system?.contentId ?? ability.id}:${actor.id}`,
          });
          applied.push({
            summary: {
              id: "zone", name: (spec.terrain ?? []).join("/"),
              outcome: painted.ok ? "applied" : "failed",
              reason: painted.ok ? null : painted.reason,
            },
          });
          break;
        }
```

Add the import at the top of the file:

```js
import { paintTerrain } from "./terrain.mjs";
```

- [ ] **Step 4: Implement `zonePanels`**

Add near `skill-use.mjs`'s other private helpers:

```js
/**
 * The panels a `zone` phase covers.
 *
 * Two forms, both from §42.7: an explicit `shape` anchored somewhere, and
 * `shape: "reuse"` — *"the NP's own blast area"* — which is what Ozymandias's
 * Pyramid Drop and Quetzalcoatl's Xiuhcoatl both want.
 *
 * @param {object} spec the phase's `spec` block
 * @param {object} self the caster's snapshot
 * @param {object} board
 * @param {object|null} placement the resolved placement of the ability itself
 * @returns {Array<{i: number, j: number}>}
 */
function zonePanels(spec, self, board, placement) {
  if (spec.shape === "reuse") return placement?.panels ?? [];
  const anchor = spec.anchor?.kind === "placement"
    ? (placement?.panel ?? self?.panel)
    : self?.panel;
  if (!anchor) return [];
  return panelsForShape(spec.shape, anchor, board);
}
```

`panelsForShape` is the existing shape expander — find it by searching `skill-use.mjs` and
`rules/targeting/shapes.mjs` for how `createField` turns `{ kind: square, size: N }` into panels,
and call **that** function rather than writing a second expander.

- [ ] **Step 5: Allow `kind: zone` in the validator**

In `tools/validate-content.mjs`, find the list of legal phase kinds (search for `createField`) and
add `"zone"` beside it, with a check that `spec.terrain` names only keys of
`rules/terrain.mjs`'s `TERRAIN`.

- [ ] **Step 6: Write the test**

Append to `test/unit/terrain-events.test.mjs` a pure test of `zonePanels`' behaviour through the
shape expander it calls — the document-touching half of `paintTerrain` has no unit test by design
(that is what Task 17 is for), but the panel arithmetic must be covered:

```js
describe("zone phase — panel selection", () => {
  it("a square 5 around the caster is 25 panels centred on her", () => {
    const panels = panelsForShape({ kind: "square", size: 5 }, at(6, 6), boardWith("forest", []));
    expect(panels).toHaveLength(25);
    expect(panels).toContainEqual(at(4, 4));
    expect(panels).toContainEqual(at(8, 8));
    expect(panels).not.toContainEqual(at(3, 6));
  });
});
```

Import `panelsForShape` from wherever Step 4 found it.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run test/unit/terrain-events.test.mjs`
Expected: PASS.

- [ ] **Step 8: Full verification**

Run: `npm test && npm run lint && npm run typecheck && npm run validate:content`
Expected: all pass. `check-layers.mjs` must be clean — `engine/terrain.mjs` may import from
`domain/` and `rules/`, never the reverse.

- [ ] **Step 9: Commit**

```bash
git add module/engine/terrain.mjs module/data/regions.mjs module/engine/skill-use.mjs \
        tools/validate-content.mjs test/unit/terrain-events.test.mjs
git commit -m "feat(terrain): the write half — paintTerrain and the zone phase"
```

---

### Task 6: `followsSource` and terrain expiry

**Files:**
- Modify: `module/engine/terrain.mjs` (add `repaintFollowing`, `expireTerrain`)
- Modify: `module/engine/movement-hooks.mjs` (repaint after a move)
- Modify: `module/engine/scheduler-hooks.mjs` (sweep at each tick)
- Modify: `module/engine/effect-applier.mjs` or `module/engine/scheduler.mjs` (clear on removal)
- Test: covered live in Task 17; add a pure test of the panel maths only

**Interfaces:**
- Consumes: Task 5's `paintTerrain`, `clearTerrain`, `terrainRegionsFor`.
- Produces:
  ```js
  export async function repaintFollowing(unitId)  // -> Promise<number> areas moved
  export async function expireTerrain(tick)       // -> Promise<number> areas removed
  ```

**Context.** `TerrainBehavior.followsSource` defaults to `false` and its own comment says why:
*"the created Terrain Effect area will not follow its user unless stated. Quetzalcoatl's `Sol` is
one of the few that does."* Sol is the first content to set it, so this is the reader it has been
waiting for.

- [ ] **Step 1: Add `repaintFollowing` to `module/engine/terrain.mjs`**

```js
/**
 * Move every following area whose source is this unit.
 *
 * *"The created Terrain Effect area will not follow its user unless stated"* —
 * `followsSource` is the exception, and Quetzalcoatl's `Sol` is what it was
 * declared for. Called after a move commits, so the daylight arrives with her
 * rather than a step behind.
 *
 * @param {string} unitId
 * @returns {Promise<number>} how many areas moved
 */
export async function repaintFollowing(unitId) {
  const scene = canvas?.scene;
  if (!scene) return 0;
  const unit = game.actors.get(unitId);
  const panel = panelOf(unit);
  if (!panel) return 0;

  let moved = 0;
  for (const region of scene.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      const sys = behavior.system ?? {};
      if (!sys.followsSource || sys.sourceUnitId !== unitId || !sys.tag) continue;
      await paintTerrain({
        types: sys.types ?? [],
        panels: squareAround(panel, sys.radius ?? 2),
        duration: sys.duration ?? null,
        sourceUnitId: unitId,
        followsSource: true,
        tag: sys.tag,
      });
      moved += 1;
    }
  }
  return moved;
}
```

This needs the area's own radius preserved, so add `radius` to `TerrainBehavior`'s schema
alongside `tag` (`new fields.NumberField({ required: false, nullable: true, initial: null,
integer: true })`) and have `paintTerrain` accept and store it. Add `squareAround(centre, r)` as a
local helper returning the `(2r+1)²` block — `rules/terrain.mjs` has a private one of the same
name; copy its four lines rather than exporting a layer-2 private.

`panelOf(unit)` — reuse whatever `engine/board.mjs` uses to derive a unit's panel from its token;
do not recompute grid arithmetic here.

- [ ] **Step 2: Add `expireTerrain`**

```js
/**
 * Remove every painted area whose expiry tick has passed.
 *
 * Hand-drawn Regions carry no `tag` and no `expiry`, so the GM's own terrain is
 * never swept — which is the whole reason painted areas are tagged.
 *
 * @param {number} tick
 * @returns {Promise<number>} how many areas were removed
 */
export async function expireTerrain(tick) {
  const scene = canvas?.scene;
  if (!scene) return 0;
  const doomed = [];
  for (const region of scene.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      const expiry = behavior.system?.expiry;
      if (typeof expiry === "number" && expiry <= tick) { doomed.push(region.id); break; }
    }
  }
  if (doomed.length > 0) await scene.deleteEmbeddedDocuments("Region", doomed);
  return doomed.length;
}
```

- [ ] **Step 3: Call `repaintFollowing` after a move**

In `module/engine/movement-hooks.mjs`, in the same place `knockBackOccupants` is awaited
(around line 220), after the move has committed:

```js
  // A following terrain area arrives WITH its source, not a step behind
  // (§42.7). Quetzalcoatl's Sol is the only content that sets the flag.
  await repaintFollowing(actor.id);
```

- [ ] **Step 4: Call `expireTerrain` from the scheduler**

In `module/engine/scheduler-hooks.mjs`, wherever the per-tick sweep already calls
`expireFields(tick)` (or the nearest equivalent), add:

```js
  await expireTerrain(tick);
```

- [ ] **Step 5: Clear a following area when its effect ends**

Find where an effect's removal is finalized (`engine/scheduler.mjs`'s expiry sweep, or
`engine/effect-applier.mjs`'s removal path — search for where an expired effect is deleted) and
add:

```js
  // A terrain area an effect painted dies with it. `Sol`'s daylight is the
  // first, and a patch of Day outliving the buff that made it would be
  // permanent, because nothing else knows to remove it.
  if (defId) await clearTerrain(`${defId}:${unitId}`);
```

The tag format must match what the ability's `zone` phase authored — Task 12 authors Sol's zone
with `tag: "sol:@self.id"`, so confirm the two agree and adjust one to the other before moving on.

- [ ] **Step 6: Verification**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all pass. This task's real proof is Task 17 step 1.

- [ ] **Step 7: Commit**

```bash
git add module/engine/terrain.mjs module/data/regions.mjs module/engine/movement-hooks.mjs \
        module/engine/scheduler-hooks.mjs module/engine/scheduler.mjs
git commit -m "feat(terrain): followsSource repaint and the expiry sweep"
```

---

### Task 7: Give `terrainConversions` its caller

**Files:**
- Modify: `module/engine/attack.mjs` (damage step)
- Test: `test/unit/terrain.test.mjs` (the pure half is already covered)

**Interfaces:**
- Consumes: Task 5's `paintTerrain`; `rules/terrain.mjs`'s existing `terrainConversions`.
- Produces: nothing new.

**Context.** `terrainConversions({ defender, board, element, coin, areaPanels })` has existed since
terrain shipped and **has no caller anywhere in the codebase**. It returns
`{kind: "convertTerrain", from, to, panels, duration, reverts}` and
`{kind: "removeTerrain", type, panels}` descriptors. This is not Quetzalcoatl's clause; it is
included because a function that computes the right answer with nobody asking is the defect shape
this project has recorded five times, and the writer is now one import away.

- [ ] **Step 1: Find the damage-step site**

Run: `grep -n "damageStepEnd\|coin\b" module/engine/attack.mjs | head -20`
The call belongs where the Damage Step finishes for a defender and other coin flips already
happen. Read 40 lines around the best candidate before editing.

- [ ] **Step 2: Call it**

```js
  // Terrain the attack itself changes (§42.2). Fire in a Forest makes Burning
  // on Tails; a Meadow is consumed. `rules/terrain.mjs#terrainConversions` has
  // computed both since terrain shipped and nothing has ever asked it.
  const element = attack?.element ?? null;
  if (element === "fire") {
    const coin = (await new Roll("1d2").evaluate()).total === 1 ? "heads" : "tails";
    for (const change of terrainConversions({
      defender, board, element, coin, areaPanels: attack?.areaPanels ?? null,
    })) {
      if (change.kind === "convertTerrain") {
        await paintTerrain({
          types: [change.to], panels: change.panels,
          duration: change.reverts ? change.duration : null,
          sourceUnitId: null, followsSource: false,
          tag: `conversion:${change.to}:${defender.id}:${tick}`,
        });
      } else if (change.kind === "removeTerrain") {
        // A Meadow is consumed by the attack that used it. Hand-drawn, so it
        // has no tag; removing it is a Region edit rather than a clearTerrain.
        await removeTerrainType(change.type, change.panels);
      }
    }
  }
```

- [ ] **Step 3: Add `removeTerrainType` to `module/engine/terrain.mjs`**

```js
/**
 * Strip one terrain type from a set of panels, whoever drew them.
 *
 * The Meadow clause — *"the panel reverts to normal at the end of the Damage
 * Step"* — acts on map terrain a GM placed, which carries no tag. So this is
 * addressed by type and panel rather than by tag, and it is the only function
 * here that touches a Region it did not create.
 *
 * @param {string} type
 * @param {Array<{i: number, j: number}>} panels
 * @returns {Promise<number>}
 */
export async function removeTerrainType(type, panels) {
  const scene = canvas?.scene;
  if (!scene) return 0;
  const size = scene.grid.size;
  const wanted = new Set(panels.map((p) => `${p.i},${p.j}`));
  let touched = 0;

  for (const region of scene.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      const types = behavior.system?.types ?? [];
      if (!types.includes(type)) continue;
      const covers = (region.shapes ?? []).some(
        (s) => wanted.has(`${Math.floor(s.y / size)},${Math.floor(s.x / size)}`),
      );
      if (!covers) continue;
      const rest = types.filter((t) => t !== type);
      if (rest.length === 0) await region.delete();
      else await behavior.update({ "system.types": rest });
      touched += 1;
    }
  }
  return touched;
}
```

- [ ] **Step 4: Verification**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add module/engine/attack.mjs module/engine/terrain.mjs
git commit -m "feat(terrain): terrainConversions gets the caller it never had"
```

---

### Task 8: `selectAbilities` by content id

**Files:**
- Modify: `module/engine/skill-use.mjs:1121-1139` (`selectAbilities`)
- Test: `test/unit/cooldown.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the authored key `abilityIds: [<contentId>, ...]` on a `cooldown` phase's `changes`
  entry.

**Context.** `selectAbilities`'s final branch is
`return [doc.items.get(change.abilityId)].filter(Boolean).filter(notSelf);` — `doc.items.get()`
takes a **Foundry embedded item id**, which no content file can know. Every other ability selector
in the system (`abilityOffCooldown`'s `abilityIds`, `sameTurnExclusive`, the turn-use record in
`engine/io.mjs:497`) keys on **contentId**. Lucha Libre is the first content to name one ability
by name; left alone it would compile, validate, resolve to nothing, and silently reduce no
cooldown at all.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/cooldown.test.mjs` (reuse the file's existing fixture helpers):

```js
describe("selectAbilities — naming one ability by content id", () => {
  it("matches on system.contentId, not on the embedded item id", () => {
    const doc = fakeActor({ items: [
      { id: "AbCdEf123", type: "noblePhantasm", system: { contentId: "quetz-xiuhcoatl" } },
      { id: "GhIjKl456", type: "ability", system: { contentId: "quetz-lucha-libre" } },
    ] });
    const picked = selectAbilities({ abilityIds: ["quetz-xiuhcoatl"] }, doc, null);
    expect(picked.map((i) => i.system.contentId)).toEqual(["quetz-xiuhcoatl"]);
  });

  it("returns nothing for a name no item carries", () => {
    const doc = fakeActor({ items: [
      { id: "AbCdEf123", type: "noblePhantasm", system: { contentId: "quetz-xiuhcoatl" } },
    ] });
    expect(selectAbilities({ abilityIds: ["not-a-thing"] }, doc, null)).toEqual([]);
  });
});
```

`selectAbilities` is currently private. Export it for the test with a note saying why:

```js
/** Exported for `test/unit/cooldown.test.mjs`; not part of any public flow. */
export function selectAbilities(change, doc, self = null) {
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/unit/cooldown.test.mjs -t "content id"`
Expected: FAIL — `selectAbilities` is not exported, then once exported, the first assertion
returns `[]`.

- [ ] **Step 3: Implement**

Replace the final return of `selectAbilities` with:

```js
  // By CONTENT id, which is what every other ability selector in the system
  // names — `abilityOffCooldown`, `sameTurnExclusive`, and the turn-use record
  // in `engine/io.mjs`. `change.abilityId` took an embedded Foundry item id,
  // which no content file can know: it compiled, validated, matched nothing and
  // reduced no cooldown. Quetzalcoatl's *Lucha Libre* is the first content to
  // name one ability by name and is what found it.
  const wanted = new Set(change.abilityIds ?? (change.abilityId ? [change.abilityId] : []));
  if (wanted.size === 0) return [];
  return doc.items.filter(
    (i) => (wanted.has(i.system?.contentId) || wanted.has(i.id)) && notSelf(i),
  );
```

`wanted.has(i.id)` is kept so any caller that really did hold an embedded id still works.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/unit/cooldown.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verification and commit**

```bash
npm test && npm run lint && npm run typecheck
git add module/engine/skill-use.mjs test/unit/cooldown.test.mjs
git commit -m "fix(cooldown): select a named ability by content id, not item id"
```

---

### Task 9: Platform upkeep, deactivation lockout, and `countFrom: destroyed`

**Files:**
- Modify: `module/engine/fields.mjs:1034` (`runUpkeep`), `:1151` (`mayDeactivate`)
- Modify: `module/rules/platforms.mjs` (a pure `deactivationVerdict`)
- Test: `test/unit/platforms.test.mjs`, `test/unit/bounded-fields.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```js
  // module/rules/platforms.mjs
  export function deactivationVerdict(spec, { createdAt, tick, unitId, ownerId, turnsPerRound })
    // -> {ok: boolean, reason?: "notOwner"|"notAllowed"|"locked", unlocksAt?: number}
  ```
  and the authored keys `deactivation.lockout` (a ◈ expression) and
  `cooldown.countFrom: "destroyed"`.

**Context.** `runUpkeep` (line 1034) sweeps `board.fields` only. A platform's `upkeep` is read in
exactly one place — `engine/attack.mjs:1959`, as an **NP cost replacement**, which is a different
rule. `mayDeactivate` (line 1151) is two lines and knows nothing about time.

Both of Quetzalcoatl's Noble Phantasms charge her Master on a period, and one of them cannot be
switched off for 2◈ after activation. Building the lockout only for the platform would leave two
deactivation specs meaning different things.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/platforms.test.mjs`:

```js
import { deactivationVerdict } from "../../module/rules/platforms.mjs";

describe("deactivationVerdict — the lockout axis", () => {
  const spec = { byOwner: true, window: "any", lockout: "2◈" };
  const base = { createdAt: 0, unitId: "quetz", ownerId: "quetz", turnsPerRound: 3 };

  it("refuses the owner inside the lockout", () => {
    const v = deactivationVerdict(spec, { ...base, tick: 3 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("locked");
    expect(v.unlocksAt).toBe(6);
  });

  it("allows the owner once the lockout has passed", () => {
    expect(deactivationVerdict(spec, { ...base, tick: 6 }).ok).toBe(true);
  });

  it("refuses anyone who is not the owner", () => {
    const v = deactivationVerdict(spec, { ...base, tick: 99, unitId: "someone-else" });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("notOwner");
  });

  it("allows the owner immediately when there is no lockout", () => {
    const v = deactivationVerdict({ byOwner: true, window: "any" }, { ...base, tick: 0 });
    expect(v.ok).toBe(true);
  });

  it("refuses when the spec forbids owner deactivation at all", () => {
    const v = deactivationVerdict({ byOwner: false }, { ...base, tick: 99 });
    expect(v.reason).toBe("notAllowed");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/platforms.test.mjs -t "deactivationVerdict"`
Expected: FAIL with `deactivationVerdict is not a function`.

- [ ] **Step 3: Implement the pure rule**

In `module/rules/platforms.mjs`:

```js
import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * May this unit switch the thing off, and if not, why not.
 *
 * Shared by bounded fields and platform Noble Phantasms because they carry the
 * same authored block. Quetzalcoatl is the reason the `lockout` axis exists:
 *
 * > *"This NP can be deactivated during Quetz's Turn or at the start or end of
 * > any Round or Turn, **but cannot be deactivated for 2◈ Turns after it was
 * > activated**."* — Quetzalcoatl: Winged Serpent
 *
 * Her Piedra Del Sol carries the identical block **without** a lockout, which
 * is exactly the difference between the two sheets' final paragraphs — so the
 * absence has to be expressible, and `lockout` is therefore optional rather
 * than a number that defaults to something.
 *
 * @param {object|null} spec the authored `deactivation` block
 * @param {object} ctx
 * @param {number} ctx.createdAt the tick it opened on
 * @param {number} ctx.tick now
 * @param {string} ctx.unitId who is asking
 * @param {string} ctx.ownerId
 * @param {number} ctx.turnsPerRound
 * @returns {{ok: boolean, reason?: string, unlocksAt?: number}}
 */
export function deactivationVerdict(spec, { createdAt, tick, unitId, ownerId, turnsPerRound }) {
  if (!spec?.byOwner) return { ok: false, reason: "notAllowed" };
  if (unitId !== ownerId) return { ok: false, reason: "notOwner" };
  if (!spec.lockout) return { ok: true };

  const unlocksAt = (createdAt ?? 0) + resolveTicks(parseTick(spec.lockout), { turnsPerRound });
  if (tick < unlocksAt) return { ok: false, reason: "locked", unlocksAt };
  return { ok: true };
}
```

- [ ] **Step 4: Route `mayDeactivate` through it**

In `module/engine/fields.mjs`, replace `mayDeactivate` (line 1151):

```js
export function mayDeactivate(field, unitId) {
  return deactivationVerdict(field?.deactivation, {
    createdAt: field?.createdAt ?? 0,
    tick: game.combat?.system?.globalTurn ?? 0,
    unitId,
    ownerId: field?.ownerId,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  }).ok;
}
```

Import `deactivationVerdict` from `../rules/platforms.mjs`. Then find every caller of
`mayDeactivate` and make at least the user-facing one report the reason, so a player told "no"
learns that it unlocks in N turns rather than that the button is broken.

- [ ] **Step 5: Generalize `runUpkeep` to sweep platforms**

In `module/engine/fields.mjs`, in `runUpkeep(tick)`, change the loop header so it walks both
collections. Keep the body exactly as it is — the payer resolution, the unaffordable branch and
`stampUpkeep` are all correct already:

```js
  // Fields AND platforms. A platform's `upkeep` was read in exactly one place —
  // `engine/attack.mjs`, as an NP COST REPLACEMENT, which is a different rule
  // from a recurring toll. Quetzalcoatl's Quetzalcoatlus charges her Master 25
  // Health per 1◈ exactly the way Jack's Mist charges 15, so it is the same
  // sweep and not a second one.
  const upkept = [
    ...(board.fields ?? []),
    ...(board.units ?? []).filter((u) => u.kind === "platform" && u.upkeep),
  ];

  for (const field of upkept) {
```

`stampUpkeep` writes to a Region behaviour, so give it a platform branch:

```js
async function stampUpkeep(field, tick) {
  if (field.kind === "platform") {
    const actor = game.actors.get(field.id);
    await actor?.update({ "system.lastUpkeepAt": tick });
    return;
  }
  const behavior = behaviorFor(field.id);
  if (!behavior) return;
  await behavior.update({ "system.state": { ...(behavior.system?.state ?? {}), lastUpkeepAt: tick } });
}
```

Add `lastUpkeepAt` and `activatedAt` to `PlatformData`'s schema in
`module/data/actor/simple.mjs` (both nullable integers), and project both onto the snapshot in
`module/rules/snapshot.mjs` beside the existing `upkeep`. `deactivateField` also needs a platform
branch — for a platform it dismisses the mount rather than deleting a Region; route it to
`engine/platforms.mjs#destroyPlatform`.

- [ ] **Step 6: Add `countFrom: destroyed`**

Find `setCooldownOnDeactivation` in `module/engine/fields.mjs` (named in `jack-the-mist.yml`'s
comment) and add the sibling path. Then hook it: in `module/engine/platforms.mjs#destroyPlatform`,
after the destruction sequence resolves, start the owning ability's cooldown when its authored
`cooldown.countFrom === "destroyed"`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/unit/platforms.test.mjs test/unit/bounded-fields.test.mjs`
Expected: PASS, including every pre-existing Jack's Mist upkeep test.

- [ ] **Step 8: Full verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add module/rules/platforms.mjs module/engine/fields.mjs module/engine/platforms.mjs \
        module/data/actor/simple.mjs module/rules/snapshot.mjs test/unit/platforms.test.mjs
git commit -m "feat(platforms): recurring upkeep, deactivation lockout, countFrom destroyed"
```

---

### Task 10: `replacesRiderAction` — a mount that substitutes its rider's action

**Files:**
- Modify: `module/rules/platforms.mjs` (new pure `actionSourceFor`)
- Modify: `module/rules/movement.mjs` (`effectiveMov`, `planMovement` entry)
- Modify: `module/rules/normal-attack.mjs`
- Modify: `module/rules/budget.mjs`
- Modify: `tools/lib/content.mjs`, `tools/validate-content.mjs`
- Test: `test/unit/platforms.test.mjs`, `test/unit/normal-attack.test.mjs`

**Interfaces:**
- Consumes: Task 1's `sharesPanel`.
- Produces:
  ```js
  // module/rules/platforms.mjs
  export function actionSourceFor(unit, board)
    // -> {unit, platform: object|null, movesAsPlatform: boolean, attacksAsPlatform: boolean}
  ```
  and the authored key `replacesRiderAction: { roles: string[], move: boolean, normalAttack: boolean }`.

**Context.**

> *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is replaced with
> Quetzalcoatlus'."*

Not a buff and not a stat override. While she is aboard, her Move **is** the mount's move and her
Normal Attack **is** the mount's attack, spending *her* action. Existing platform passengers ride
along passively; nothing today lets a passenger drive.

`roles` exists because the substitution is the **owner's** only — her Master rides as cargo.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/platforms.test.mjs`:

```js
import { actionSourceFor } from "../../module/rules/platforms.mjs";

describe("replacesRiderAction", () => {
  const mount = {
    id: "mount", kind: "platform", ownerId: "quetz", panel: { i: 5, j: 5 },
    mov: 7, baseAttack: { str: 150, mag: 0 }, range: { panels: 2, targets: 1 },
    replacesRiderAction: { roles: ["owner"], move: true, normalAttack: true },
  };
  const quetz = { id: "quetz", kind: "servant", mov: 7, platformId: "mount", panel: { i: 5, j: 5 } };
  const master = { id: "master", kind: "master", mov: 5, platformId: "mount", panel: { i: 5, j: 5 } };
  const b = { units: [mount, quetz, master], bounds: { rows: 13, columns: 13 } };

  it("gives the owner the mount as her action source", () => {
    const src = actionSourceFor(quetz, b);
    expect(src.movesAsPlatform).toBe(true);
    expect(src.attacksAsPlatform).toBe(true);
    expect(src.platform.id).toBe("mount");
  });

  it("does not give the Master the mount's action", () => {
    const src = actionSourceFor(master, b);
    expect(src.movesAsPlatform).toBe(false);
    expect(src.attacksAsPlatform).toBe(false);
  });

  it("gives a unit on no platform its own action", () => {
    const afoot = { id: "x", kind: "servant", mov: 6, panel: { i: 0, j: 0 } };
    const src = actionSourceFor(afoot, { units: [afoot] });
    expect(src.movesAsPlatform).toBe(false);
    expect(src.platform).toBe(null);
  });

  it("is inert on a platform that does not declare it", () => {
    const plain = { ...mount, replacesRiderAction: undefined };
    const src = actionSourceFor(quetz, { units: [plain, quetz] });
    expect(src.movesAsPlatform).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/platforms.test.mjs -t "replacesRiderAction"`
Expected: FAIL with `actionSourceFor is not a function`.

- [ ] **Step 3: Implement the pure rule**

In `module/rules/platforms.mjs`:

```js
/**
 * Whose Move and Normal Attack this unit actually uses.
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack
 * > is replaced with Quetzalcoatlus'."*
 *
 * Every other platform in the set carries its passengers: they ride, and their
 * own action is unchanged. Quetzalcoatlus is the first that a passenger DRIVES,
 * and the substitution is the owner's alone — her Master is cargo, which is
 * what `roles` says.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {{unit: object, platform: object|null,
 *            movesAsPlatform: boolean, attacksAsPlatform: boolean}}
 */
export function actionSourceFor(unit, board) {
  const none = { unit, platform: null, movesAsPlatform: false, attacksAsPlatform: false };
  if (!unit?.platformId) return none;

  const platform = (board?.units ?? []).find((u) => u.id === unit.platformId) ?? null;
  const spec = platform?.replacesRiderAction;
  if (!platform || !spec) return { ...none, platform };

  const role = platform.ownerId === unit.id ? "owner" : unit.kind;
  if (!(spec.roles ?? ["owner"]).includes(role)) return { ...none, platform };

  return {
    unit, platform,
    movesAsPlatform: Boolean(spec.move),
    attacksAsPlatform: Boolean(spec.normalAttack),
  };
}
```

- [ ] **Step 4: Read it in movement**

In `module/rules/movement.mjs#planMovement`, before computing `budget` and `bounds`:

```js
  // A rider whose mount replaces her Move plans from the MOUNT: its MOV, its
  // footprint, and its own obstacle rules — "the Quetzalcoatlus ignores
  // obstacles while Moving, and can Move onto occupied panels".
  const source = actionSourceFor(unit, board);
  const mover = source.movesAsPlatform ? { ...source.platform, turnState: unit.turnState } : unit;
```

Then use `mover` in place of `unit` for the rest of the function body. Import `actionSourceFor`
from `./platforms.mjs`; both are layer 2, so the import is legal. If `check-layers.mjs` reports a
cycle (`platforms.mjs` may already import `movement.mjs`), move `actionSourceFor` into a small
new `module/rules/riding-source.mjs` that both import, rather than breaking the layer rule.

- [ ] **Step 5: Read it in the normal attack**

In `module/rules/normal-attack.mjs`, at the point the attacker's base attack and range are
selected:

```js
  // The mount's attack, not hers, while she is riding one that replaces it.
  const source = actionSourceFor(unit, board);
  const from = source.attacksAsPlatform ? source.platform : unit;
```

and read `from.baseAttack` and `from.range` thereafter.

- [ ] **Step 6: Charge the action once**

In `module/rules/budget.mjs`, wherever a platform's `actsOncePerTurn` is consumed
(`canConsume`), add:

```js
    // A substituted action is ONE action. The rider spends hers; the platform
    // must not also spend its own, or Quetzalcoatl's Turn would cost two.
    if (actionSourceFor(unit, board).movesAsPlatform) return true;
```

Read the surrounding function first and place the guard where it means *"this platform's own
per-turn cap does not apply, because the rider already paid"*.

- [ ] **Step 7: Allowlist the key**

`tools/lib/content.mjs` `actorSystem()`:

```js
    // A mount whose rider drives it. See `rules/platforms.mjs#actionSourceFor`.
    replacesRiderAction: doc.replacesRiderAction ?? null,
```

Add the matching schema field to `PlatformData` in `module/data/actor/simple.mjs`
(`new fields.ObjectField({ required: false, nullable: true, initial: null })`), project it in
`module/rules/snapshot.mjs`, and add it to `tools/validate-content.mjs`'s unit-key coverage.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run test/unit/platforms.test.mjs test/unit/normal-attack.test.mjs test/unit/budget.test.mjs test/unit/movement.test.mjs`
Expected: PASS, with every pre-existing Hanging Gardens and Golden Hind test unchanged — neither
declares `replacesRiderAction`, so `actionSourceFor` returns the inert result for both.

- [ ] **Step 9: Full verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add module/rules/platforms.mjs module/rules/movement.mjs module/rules/normal-attack.mjs \
        module/rules/budget.mjs module/rules/snapshot.mjs module/data/actor/simple.mjs \
        tools/lib/content.mjs tools/validate-content.mjs \
        test/unit/platforms.test.mjs test/unit/normal-attack.test.mjs
git commit -m "feat(platforms): replacesRiderAction, a mount its rider drives"
```

---

### Task 11: `aftermath` — a second, unconditional resolution

**Files:**
- Modify: `module/engine/attack.mjs` (after the primary fan-out resolves)
- Modify: `module/rules/targeting/resolve.mjs` (`excludePrimaryTarget`)
- Modify: `tools/lib/content.mjs`, `tools/validate-content.mjs`
- Test: `test/unit/aoe.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the authored block `aftermath: { unconditional, targeting, damage, effects }`, and the
  selection filter `excludePrimaryTarget: true`.

**Context.**

> *"Then (regardless of whether the NP hits the DU or not), deals normal damage to all Units
> within a 2 panel area of Quetzalcoatl except herself and the previously targeted Unit (Base
> Attack (MAG) is used)..."*

This is **not** an area attack with a hole in it. It is a separate resolution, from a different
anchor (her, not the target), on a different base attack (MAG alone, not the combined 250), at a
different multiplier (1×, not 4×), with a different rider set (Burn 1◈ and NP Seal at **25%**,
against the primary's Burn 2◈ and NP Seal unconditionally). An ability carries one `damage` block
today.

The fan-out machinery already exists — `declareProcesses` in `engine/attack.mjs:552` builds one
process per defender through `process.beginFanOut`. It has simply never been asked for twice.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/aoe.test.mjs` a pure test of the selection filter (the fan-out itself is a
layer-3 flow verified in Task 17):

```js
describe("excludePrimaryTarget", () => {
  it("drops the anchor of the first resolution from the second", () => {
    const board = {
      bounds: { rows: 13, columns: 13 },
      units: [
        { id: "quetz", kind: "servant", factionId: "a", panel: { i: 6, j: 6 } },
        { id: "primary", kind: "servant", factionId: "b", panel: { i: 6, j: 7 } },
        { id: "bystander", kind: "servant", factionId: "b", panel: { i: 5, j: 6 } },
      ],
      alliances: { a: ["a"], b: ["b"] },
    };
    const picked = resolveTargets({
      anchor: { kind: "self" },
      shape: { kind: "square", size: 5 },
      selection: {
        relations: ["enemy", "ally", "neutral"],
        includeSelf: false,
        excludePrimaryTarget: true,
      },
    }, { self: board.units[0], board, primaryTargetId: "primary" });

    expect(picked.map((t) => t.unitId)).toEqual(["bystander"]);
  });

  it("keeps the primary when the filter is absent", () => {
    // ...same board, selection without excludePrimaryTarget
    // expect both "primary" and "bystander"
  });
});
```

Write the second test out in full against the same board — do not leave it as a comment.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/aoe.test.mjs -t "excludePrimaryTarget"`
Expected: FAIL — the primary is still in the list.

- [ ] **Step 3: Implement the filter**

In `module/rules/targeting/resolve.mjs`, where `includeSelf` is honoured:

```js
  // "except herself and the PREVIOUSLY TARGETED Unit" — Xiuhcoatl's splash.
  // `includeSelf: false` removes the caster; this removes the anchor of the
  // resolution that came first, which only a second resolution has.
  if (selection.excludePrimaryTarget && ctx.primaryTargetId) {
    candidates = candidates.filter((u) => u.id !== ctx.primaryTargetId);
  }
```

- [ ] **Step 4: Fire the second resolution**

In `module/engine/attack.mjs`, after the primary group's processes have all resolved (find where
`fireCombatPhaseEnd` counts unfinished siblings by group — the aftermath must fire **before** the
phase ends, or it will be a separate Combat Phase):

```js
  // "Then (regardless of whether the NP hits the DU or not)" — a SECOND
  // resolution, not an area with a hole. Different anchor, different base
  // attack, different multiplier, different riders; the sheet gives four
  // numbers and none of them matches the primary's.
  //
  // `unconditional` is the load-bearing word: it fires on a miss, on an Evade
  // and on a Block, so it is sequenced off the primary group COMPLETING rather
  // than off anything the primary achieved.
  const aftermath = ability?.system?.aftermath;
  if (aftermath?.unconditional) {
    const spec = { ...attackSpec, ...aftermath.damage, isAftermath: true };
    const targets = resolveTargets(aftermath.targeting, {
      self, board: currentBoard(), primaryTargetId: placement?.unitId ?? targetIds[0] ?? null,
    });
    if (targets.length > 0) {
      await declareProcesses({
        attackerId, attacker, ability, attackSpec: spec,
        targetIds: targets.map((t) => t.unitId), targets,
        placement: null, board: currentBoard(), groupId,
      });
    }
  }
```

Read `declareProcesses`'s signature at line 552 and pass exactly the arguments it declares.
Reusing `groupId` keeps the aftermath inside the same Combat Phase, which is what *"then"* means.

- [ ] **Step 5: Allowlist `aftermath`**

`tools/lib/content.mjs`, in the ability compiler (search for where `damage` and `targeting` are
emitted):

```js
    // Xiuhcoatl's unconditional splash. A whole second resolution, so it
    // carries its own targeting, damage and riders rather than patching the
    // first one's.
    aftermath: doc.aftermath ?? null,
```

Add validation in `tools/validate-content.mjs` that an `aftermath` block carries `targeting` and
`damage`, and that its `damage.component` is one of `str`/`mag`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/unit/aoe.test.mjs`
Expected: PASS.

- [ ] **Step 7: Full verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add module/engine/attack.mjs module/rules/targeting/resolve.mjs \
        tools/lib/content.mjs tools/validate-content.mjs test/unit/aoe.test.mjs
git commit -m "feat(attack): aftermath, an unconditional second resolution"
```

---

### Task 12: The Servant, her three passives and her three Actives

**Files:**
- Create: `packs/_source/servants/quetzalcoatl.yml`
- Create: `packs/_source/abilities/quetz-goddesses-divine-core.yml`
- Create: `packs/_source/abilities/quetz-charisma-of-the-sun.yml`
- Create: `packs/_source/abilities/quetz-good-gods-wisdom.yml`
- Create: `packs/_source/abilities/quetz-lucha-libre.yml`
- Create: `test/unit/quetzalcoatl.test.mjs`

**Interfaces:**
- Consumes: Task 2 (`sol`), Task 5 (the `zone` phase), Task 8 (`abilityIds`).
- Produces: content ids `quetzalcoatl`, `quetz-goddesses-divine-core`,
  `quetz-charisma-of-the-sun`, `quetz-good-gods-wisdom`, `quetz-lucha-libre`.

**Context.** Her Riding and Magic Resistance are **verbatim** the shared class documents and must
be referenced, not copied: `{ ref: class-riding, rank: EX, cooldown: "3◈" }` and
`{ ref: class-magic-resistance, rank: A }`. `ridingMov` already gives `EX → 6`,
`magicResistancePercent` gives `A → 50`, `magicResistanceDebuffResist` gives `A → 25`. Four
numbers her sheet prints and none of them is authored.

Her Divine Core gets **her own file** rather than sharing Kingprotea's: the corpus convention for
a named (non-class) Skill is one file per Servant — `asterios-monstrous-strength.yml` and
`kingprotea-monstrous-strength.yml` are the precedent.

- [ ] **Step 1: Write `quetz-goddesses-divine-core.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
# Data sheet: docs/D-servant-data-sheets.md §D.28
#
# Kingprotea's file is the shape and this is the second instantiation, at EX
# instead of A. A per-Servant file rather than a shared parameterized document,
# following the corpus convention for named Skills (`asterios-monstrous-
# strength` / `kingprotea-monstrous-strength`).
#
# `divineCore` is EXACTLY twice `divinity` at every observed rank and the table
# is derived from it, so EX => 120, which is what her sheet prints.
schema: 1
id: quetz-goddesses-divine-core
name: "Goddess's Divine Core"
rank: EX
kind: skill
slug: goddessesDivineCore
passive: true
categorizedAs: [divinity]
description: |
  (Passive 1) All damage dealt is increased by 120 including NP.
  (Passive 2) Chance of being inflicted by debuffs is decreased by 50%.
  This Skill counts as '@ability[divinity]{Divinity}'.
passiveRules:
  - key: FlatDamage
    table: divineCore
    includesNP: true

  # An `ApplicationChance`, NOT a `CheckModifier`: the effect applier reads
  # resistance off `applicationChances` and a `CheckModifier` lands in a bucket
  # it never consults. Magic Resistance's own clause 2 records the same defect.
  - key: ApplicationChance
    direction: incoming
    value: 50

  # "Counts as Divinity" — the ATTRIBUTE half, which an `attribute:divine`
  # predicate reads. Karna's Vasavi Shakti and Scáthach's God Slayer both ask.
  - key: StatDelta
    stat: attributes
    add: [divine]
```

- [ ] **Step 2: Write `quetz-charisma-of-the-sun.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
#
# The first content to paint terrain (§42.7's `zone` phase) and the first to set
# `followsSource`, which `data/regions.mjs` declared for this clause by name.
schema: 1
id: quetz-charisma-of-the-sun
name: "Charisma of the Sun"
rank: EX
kind: skill
slug: charismaOfTheSun
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Applies @effect[atkUp]{Atk Up} for 1◈ Turns to all allied Units within a 2 panel area of herself, all
     damage dealt is increased by 30%; if NP, 15%.
  2. Applies @effect[sCritUp]{S.Crit Up} for ⅓◈ Turns to all allied Units within a 2 panel area of herself,
     Crit Chance is increased by 25%.
  3. Applies the @effect[sol]{Sol} buff to herself for 1◈ Turns, its effects are as follows- The 5x5 panel
     area around Quetz is 'Day', even if it is during a Night Round.
  Cooldown: 4◈ Turns.
targeting:
  anchor: { kind: self }
  # "within a 2 panel area of herself" — a 5x5 block, which is how every other
  # 2-panel area in the corpus is expressed.
  shape: { kind: square, size: 5 }
  # `includeSelf: true` because in F/GT "all allied Units" includes the caster
  # unless the text says otherwise (the aura relations decision, Ch. 45 A5).
  selection: { relations: [ally, self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    effects:
      - { id: atkUp, magnitude: 30, npMagnitude: 15, duration: "1◈" }
      - { id: sCritUp, magnitude: 25, duration: "⅓◈" }
  # Clause 3 is HERS ALONE, so it is a separate phase targeting self rather than
  # a third entry in the list above, which would hand every ally in range a
  # personal patch of daylight.
  - kind: applyEffects
    target: self
    effects:
      - { id: sol, duration: "1◈" }
  # The daylight itself. Terrain is not an effect (§42.1), so it is painted
  # rather than applied — and it FOLLOWS her, which almost no created area does.
  - kind: zone
    target: self
    spec:
      terrain: [sunlight]
      shape: { kind: square, size: 5 }
      anchor: { kind: self }
      followsSource: true
      duration: "1◈"
      tag: "sol:@self.id"
```

Confirm `tag: "sol:@self.id"` matches the tag Task 6 step 5 clears on effect removal; if the
`@self.id` expression is not resolved for a `zone` spec, resolve it in `skill-use.mjs`'s `zone`
case or change both sides to agree.

- [ ] **Step 3: Write `quetz-good-gods-wisdom.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
schema: 1
id: quetz-good-gods-wisdom
name: "Good God's Wisdom"
rank: "A+"
kind: skill
slug: goodGodsWisdom
cooldown: "4◈-⅓◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Used on an allied Unit within a 2 panel area of Quetz. Has the
  following effects-
  1. Applies @effect[guts]{Guts} for 1◈ Turns, when the Unit is defeated it is revived with 10% of its Max
     Health.
  2. Applies @effect[atkUp]{Atk Up} for 1◈ Turns, all damage dealt is increased by 40%; if NP, 30%.
  Cooldown: 4◈-⅓◈ Turns.
targeting:
  anchor: { kind: self }
  shape: { kind: square, size: 5 }
  # "Used on AN allied Unit" — one, chosen, and it may be herself: the sheet
  # says "allied", which in this corpus includes the caster unless excluded.
  selection: { relations: [ally, self], includeSelf: true, chooser: caster, count: 1 }
phases:
  - kind: applyEffects
    effects:
      # "revived with 10% of its Max Health" — a fraction, not a number, because
      # the Unit it lands on is chosen at cast time and every Servant's maximum
      # is different.
      - { id: guts, magnitude: 10, magnitudeKind: percentOfMax, duration: "1◈" }
      - { id: atkUp, magnitude: 40, npMagnitude: 30, duration: "1◈" }
```

Check `packs/_source/effects/guts.yml` for how its magnitude is expressed and match it; if `guts`
already means "percent of max" by definition, drop `magnitudeKind` and say so in a comment.

- [ ] **Step 4: Write `quetz-lucha-libre.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
#
# The first content in the corpus to name ONE ability by name for a cooldown
# reduction. `selectAbilities`' single-ability branch took an embedded Foundry
# item id, which no content file can know, so this would have compiled,
# validated and reduced nothing; `abilityIds` is the contentId form every other
# ability selector in the system already uses.
schema: 1
id: quetz-lucha-libre
name: "Lucha Libre"
rank: EX
kind: skill
slug: luchaLibre
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Applies @effect[critUp]{Crit Up} for ⅓◈, Crit Chance is increased by 60%.
  2. Applies @effect[critDmUp]{Crit DmUp} for ⅓◈, Crit Damage dealt is increased by 50%.
  3. Reduces the Cooldown of @ability[quetz-xiuhcoatl]{Xiuhcoatl} by 1◈ Turns.
  Cooldown: 4◈ Turns.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all, count: 1 }
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: critUp, magnitude: 60, duration: "⅓◈" }
      - { id: critDmUp, magnitude: 50, duration: "⅓◈" }
  - kind: cooldown
    target: self
    changes:
      - { abilityIds: [quetz-xiuhcoatl], ticks: "1◈", direction: down }
```

- [ ] **Step 5: Write `quetzalcoatl.yml`**

```yaml
# packs/_source/servants/quetzalcoatl.yml
# Conversion source: char_orig_sheets/Copia de Quetzalcoatl.md
# Discussed: docs/D-servant-data-sheets.md §D.28, docs/44-case-expanded-roster.md §44.2
#
# The reference set's acceptance test for THE FIELD. Karna is the benchmark for
# predicates, Kingprotea for stack economies and Achilles for gating; almost
# everything on Quetzalcoatl's sheet is about the panels themselves — three
# separate routes to changing the ground a unit stands on, a mount that
# substitutes her whole action set, and a levitating object that shares a panel
# with whoever walks under it.
schema: 1
id: quetzalcoatl
name: Quetzalcoatl
type: servant

# ─── Identity ──────────────────────────────────────────────────────────
trueName: Quetzalcoatl
# "True Name: Quetzalcoatl, Kukulkan" — the second name is an alias rather than
# a second identity, and nothing in the rules reads one.
servantClasses: [rider]
classContainer: rider
alignment: { order: lawful, morality: good }
region: [centralAmerica, southAmerica]
attributes: [female, servant, king, sky, humanoid]

# ─── Parameters and stats ──────────────────────────────────────────────
parameters: { str: B, end: B, agi: "B+", mag: EX, luc: "A+" }
# B => 125 and B => 1250; EX => 250, the highest BA(MAG) in either roster and
# the first MAG: EX outside Mannanán. All three straight off `domain/tables.mjs`.
baseHealth: 1250
mov: 7
range: { panels: 2, targets: 1 }
baseAttack: { str: 125, mag: 250 }
normalAttack: { mode: fixed, component: str }
sustainability: "2◈"

# ─── Abilities ─────────────────────────────────────────────────────────
abilities:
  # The SHARED Riding document, unchanged: her three passives and her Active are
  # word-for-word `class-riding.yml`, and `ridingMov` already gives EX => +6.
  - { ref: class-riding, rank: EX, cooldown: "3◈" }
  # Likewise unchanged, including the Instakill/Death/Erase paragraph, which the
  # shared document already carries verbatim.
  - { ref: class-magic-resistance, rank: A }
  - { ref: quetz-goddesses-divine-core }
  - { ref: quetz-charisma-of-the-sun }
  - { ref: quetz-good-gods-wisdom }
  - { ref: quetz-lucha-libre }
  - { ref: quetz-xiuhcoatl }
  - { ref: quetz-winged-serpent }
  - { ref: quetz-tlahuitequiliztli }
  - { ref: quetz-ehecatle }
  - { ref: quetz-tlaelquiyahuitl }
  - { ref: quetz-piedra-del-sol }

notes: |
  The sixteenth Servant, and §D.28's exercise list in one sheet: per-panel day overrides from a
  buff, splash damage decoupled from the primary resolution, NPs that create terrain conditioned
  on *another* NP being present, a mount that substitutes a unit's whole action set, three-tier
  AoE protection, and a field that occupies a level above the board.

  **Three routes to the same outcome.** `Sol`, Xiuhcoatl's Burning conversion and Piedra Del Sol
  all change what terrain a panel has, by three different mechanisms. Ch. 42's overlap matrix is
  what keeps them from contradicting one another when two of them cover the same panel.

  **Her two Noble Phantasms that cost Health both charge her Master**, at 25 and 50 per 1◈, and
  neither can run while the other's Spells are up. She is the first Servant whose Master is a
  resource she spends rather than a liability she protects.
```

- [ ] **Step 6: Write the arithmetic test**

Create `test/unit/quetzalcoatl.test.mjs`:

```js
/**
 * @file Quetzalcoatl — the numbers her sheet prints, checked against the tables.
 * @see char_orig_sheets/Copia de Quetzalcoatl.md, docs/D-servant-data-sheets.md §D.28
 */

import { describe, it, expect } from "vitest";
import { valueFrom } from "../../module/domain/tables.mjs";

describe("Quetzalcoatl — statline reproduces from the tables", () => {
  it("BA(STR) 125 from STR B", () => {
    expect(valueFrom("baseAttackStr", "B")).toBe(125);
  });

  it("BA(MAG) 250 from MAG EX — the highest in either roster", () => {
    expect(valueFrom("baseAttackMag", "EX")).toBe(250);
  });

  it("Base Health 1250 from END B", () => {
    expect(valueFrom("baseHealth", "B")).toBe(1250);
  });

  it("Riding EX gives MOV +6, which her sheet prints", () => {
    expect(valueFrom("ridingMov", "EX")).toBe(6);
  });

  it("Divine Core EX gives +120, which her sheet prints", () => {
    expect(valueFrom("divineCore", "EX")).toBe(120);
  });

  it("Magic Resistance A negates up to A and reduces the rest by 50%", () => {
    expect(valueFrom("magicResistancePercent", "A")).toBe(50);
  });

  it("Magic Resistance A reduces debuff chance by 25%", () => {
    expect(valueFrom("magicResistanceDebuffResist", "A")).toBe(25);
  });

  it("Xiuhcoatl's combined base attack is BA(STR) + half BA(MAG) = 250", () => {
    expect(valueFrom("baseAttackStr", "B") + valueFrom("baseAttackMag", "EX") / 2).toBe(250);
  });
});
```

`valueFrom` is a guess at the tables module's accessor. Read `module/domain/tables.mjs`'s exports
and `test/unit/tables.test.mjs` first, and use whatever those actually name.

- [ ] **Step 7: Validate and test**

Run: `npm run validate:content && npx vitest run test/unit/quetzalcoatl.test.mjs test/unit/content.test.mjs`
Expected: PASS. The validator will refuse the four `{ ref: quetz-* }` entries that Tasks 13-15
have not written yet — comment those four lines out of `quetzalcoatl.yml` for now and uncomment
each as its task lands. Note this in the commit message so it is not mistaken for a slip.

- [ ] **Step 8: Full verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add packs/_source/servants/quetzalcoatl.yml packs/_source/abilities/quetz-goddesses-divine-core.yml \
        packs/_source/abilities/quetz-charisma-of-the-sun.yml \
        packs/_source/abilities/quetz-good-gods-wisdom.yml \
        packs/_source/abilities/quetz-lucha-libre.yml test/unit/quetzalcoatl.test.mjs
git commit -m "feat(quetzalcoatl): the Servant, her passives and her three Actives"
```

---

### Task 13: Xiuhcoatl

**Files:**
- Create: `packs/_source/abilities/quetz-xiuhcoatl.yml`
- Modify: `module/engine/attack.mjs` (the `[Fortress]` clause)
- Modify: `packs/_source/servants/quetzalcoatl.yml` (uncomment the ref)
- Test: `test/unit/quetzalcoatl.test.mjs`

**Interfaces:**
- Consumes: Task 3 (`elementFraction`), Task 5 (`paintTerrain`), Task 11 (`aftermath`).
- Produces: content id `quetz-xiuhcoatl`.

- [ ] **Step 1: Write the ability**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
# Data sheet: docs/D-servant-data-sheets.md §D.28
#
# Two resolutions and a fraction. The splash is NOT an area attack with a hole
# in it: different anchor, different base attack, different multiplier and a
# different rider set — the sheet gives four numbers and none matches the
# primary's. See `aftermath` below.
schema: 1
id: quetz-xiuhcoatl
name: "Xiuhcoatl: O Flame, Burn the Gods Themselves"
isNP: true
rank: A
npTags: [antiUnit, antiFortress]
kind: noblePhantasm
slug: xiuhcoatl
category: quetzNP
cooldown: "7◈"
element: fire
timing: { window: ownTurn }
# "Xiuhcoatl cannot be used if Quetz is Riding the Quetzalcoatlus." Declared on
# BOTH sides, the way Karna's two Brahmastras do, so neither reads as a rule
# with a missing half.
requirements:
  - { kind: predicate, predicate: [{ not: "self:onPlatform:quetzalcoatlus" }] }
description: |
  Base Attack (STR) and half of Base Attack (MAG) is used (BA=250), not affected by Magic
  Resistance. Deals 4x damage and inflicts @effect[npSeal]{NP Seal} for 1◈ Turns, and inflicts
  @effect[burn]{Burn} for 2◈ Turns. Fire damage (half).
  Then (regardless of whether the NP hits the DU or not), deals normal damage to all Units within
  a 2 panel area of Quetzalcoatl except herself and the previously targeted Unit (Base Attack
  (MAG) is used) with a 25% chance of inflicting NP Seal for 1◈ Turns and inflicts Burn for 1◈
  Turns. Fire damage.
  Xiuhcoatl cannot be used if Quetz is Riding the Quetzalcoatlus.
  If this NP is used within or directly next to a [Fortress] NP (regardless of ally's or enemy's),
  that NP area and the panels directly outside/next to the NP area are now 'Burning' until the
  Fortress NP is deactivated.
  Cooldown: 7◈ Turns.
targeting:
  anchor: { kind: withinRange, range: 2, metric: chebyshev }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: caster, count: 1 }
  limits: { requiresZon: true }
damage:
  # "Base Attack (STR) and half of Base Attack (MAG) is used (BA=250)" —
  # 125 + (250 / 2). Authored as two sources so a later buff to either
  # Parameter moves the right half, rather than as the literal 250.
  sources:
    - { component: str, factor: 1 }
    - { component: mag, factor: 0.5 }
  multiplier: 4
  ignoresMagicResistance: true
  element: fire
  # "Fire damage (half)." Half the total carries the element, so a defender
  # resisting Fire resists that half and a defender with `flamHeal` heals from
  # that half. Modelled rather than approximated — see Ch. 13.
  elementFraction: 0.5
aftermath:
  # "regardless of whether the NP hits the DU or not" — it fires on a miss, on
  # an Evade and on a Block, so it is sequenced off the primary group COMPLETING
  # rather than off anything the primary achieved.
  unconditional: true
  targeting:
    anchor: { kind: self }
    shape: { kind: square, size: 5 }
    selection:
      relations: [enemy, ally, neutral]
      includeSelf: false
      excludePrimaryTarget: true
      chooser: all
  damage:
    # "Base Attack (MAG) is used" — MAG ALONE, not the combined figure, and at
    # "normal damage", which is 1x.
    sources:
      - { component: mag, factor: 1 }
    multiplier: 1
    element: fire
    # Plain "Fire damage." here, with no "(half)": the sheet distinguishes the
    # two sentences and so does this.
  effects:
    - { id: npSeal, duration: "1◈", chance: 25 }
    - { id: burn, duration: "1◈" }
phases:
  - kind: damage
  - kind: applyEffects
    rules:
      # The PRIMARY's riders: NP Seal unconditionally and Burn for 2◈, against
      # the aftermath's 25% and 1◈. Four numbers, all different.
      - key: OnEvent
        event: damageDealt
        effect: { id: npSeal }
        duration: "1◈"
      - key: OnEvent
        event: damageDealt
        effect: { id: burn }
        duration: "2◈"
  # "That NP area and the panels directly outside/next to the NP area are now
  # 'Burning' until the Fortress NP is deactivated."
  - kind: zone
    target: self
    spec:
      terrain: [burning]
      shape: fortressNearby
      duration: null
```

- [ ] **Step 2: Implement `shape: fortressNearby`**

In `module/engine/skill-use.mjs`'s `zonePanels`, add the branch:

```js
  // "within or directly next to a [Fortress] NP (regardless of ally's or
  // enemy's)". `rules/np-scale.mjs` has held the `fortress` qualifier and the
  // `antiFortress` scale comparison since it was written; this is the first
  // reader for either.
  //
  // NO LIVE REFERENT: the only [Fortress] NP in the roster is Ozymandias's
  // Ramesseum Tentyris, which is unauthored. Unit-tested against a synthetic
  // field and NOT demonstrable in a live world until he exists. Recorded here
  // rather than left to look exercised.
  if (spec.shape === "fortressNearby") {
    const out = [];
    for (const field of board?.fields ?? []) {
      const tags = field.npTags ?? [];
      if (!tags.includes("fortress") && !tags.includes("antiFortress")) continue;
      const panels = panelsOf(field, board);
      const near = panels.some((p) => chebyshev(p, self.panel) <= 1);
      if (!near) continue;
      out.push(...panels, ...borderOf(panels));
    }
    return dedupePanels(out);
  }
```

`panelsOf` is exported from `module/rules/bounded-fields.mjs`. Write `borderOf(panels)` and
`dedupePanels(panels)` as local helpers: the border is every orthogonally-and-diagonally adjacent
panel not already in the set (*"directly outside/next to"*), and the dedupe is by `${i},${j}` key.

- [ ] **Step 3: Write the tests**

Append to `test/unit/quetzalcoatl.test.mjs`:

```js
describe("Xiuhcoatl", () => {
  it("the primary and the splash use different base attacks", () => {
    // BA(STR) + half BA(MAG) = 250 for the primary; BA(MAG) = 250 for the
    // splash. The same NUMBER by coincidence, from two different sources — so a
    // buff to STR moves one and not the other.
    const str = valueFrom("baseAttackStr", "B");
    const mag = valueFrom("baseAttackMag", "EX");
    expect(str + mag / 2).toBe(250);
    expect(mag).toBe(250);
  });

  it("the primary deals 4x and the splash 1x", () => {
    const np = loadAbility("quetz-xiuhcoatl");
    expect(np.damage.multiplier).toBe(4);
    expect(np.aftermath.damage.multiplier).toBe(1);
  });

  it("the splash's riders are weaker than the primary's", () => {
    const np = loadAbility("quetz-xiuhcoatl");
    const seal = np.aftermath.effects.find((e) => e.id === "npSeal");
    const burn = np.aftermath.effects.find((e) => e.id === "burn");
    expect(seal.chance).toBe(25);
    expect(burn.duration).toBe("1◈");
  });

  it("fires the splash unconditionally", () => {
    expect(loadAbility("quetz-xiuhcoatl").aftermath.unconditional).toBe(true);
  });

  it("carries elementFraction 0.5 for 'Fire damage (half)'", () => {
    expect(loadAbility("quetz-xiuhcoatl").damage.elementFraction).toBe(0.5);
  });
});
```

`loadAbility` is a YAML-reading helper — check whether `test/unit/content.test.mjs` already has
one and reuse it; if not, write a four-line one at the top of this file using the `yaml` package
that is already a devDependency.

- [ ] **Step 4: Verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add packs/_source/abilities/quetz-xiuhcoatl.yml module/engine/skill-use.mjs \
        packs/_source/servants/quetzalcoatl.yml test/unit/quetzalcoatl.test.mjs
git commit -m "feat(quetzalcoatl): Xiuhcoatl, two resolutions and a fraction"
```

---

### Task 14: The Quetzalcoatlus, Winged Serpent and the three Spells

**Files:**
- Create: `packs/_source/platforms/quetzalcoatlus.yml`
- Create: `packs/_source/abilities/quetz-winged-serpent.yml`
- Create: `packs/_source/abilities/quetz-tlahuitequiliztli.yml`
- Create: `packs/_source/abilities/quetz-ehecatle.yml`
- Create: `packs/_source/abilities/quetz-tlaelquiyahuitl.yml`
- Modify: `packs/_source/servants/quetzalcoatl.yml`
- Test: `test/unit/quetzalcoatl.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`sharesPanel`), Task 2 (`sap`), Task 9 (upkeep, lockout,
  `countFrom: destroyed`), Task 10 (`replacesRiderAction`).
- Produces: content ids `quetzalcoatlus`, `quetz-winged-serpent`, and the three Spells.

- [ ] **Step 1: Write `quetzalcoatlus.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
# Platform model: docs/20-platforms-and-levels.md §20.7
#
# §20.7 built the per-role AoE axis specifically because this mount is *"the
# first platform in the set where the mount itself takes full AoE damage while
# its riders are partially shielded"*. It has been waiting for her: the three
# tiers her sheet states fall straight out of `aoePassengerFactor` unchanged —
# the function returns 1 when the unit IS the platform, 0 for a Master when
# `aoeMastersImmune`, and 0.5 otherwise.
schema: 1
id: quetzalcoatlus
name: "Quetzalcoatlus"
type: platform
attributes: [giant, beast]
baseHealth: 1000
agility: 16
# "Luck: Shared with Quetz's" — a number that is not a number, resolved at
# placement from the summoner's live value, the way the Kagome Spirits' are.
inherit:
  luck: { from: summoner }
mov: 7
range: { panels: 2, targets: 1 }
baseAttack: { str: 150, mag: 0 }
normalAttack: { mode: fixed, component: str }
footprint: { w: 1, h: 1 }
# Quetz and her Master, and nobody else.
capacity: 2
level: 1
# "The Quetzalcoatlus ignores obstacles while Moving, and can Move onto occupied
# panels (place the Quetzalcoatlus on top of anything occupying said panels)."
#
# `sharesPanel`, NOT `movesOntoOccupiedPanels`: the second is Bašmu's and means
# "all Units occupying said panels will be knocked back". This one co-locates
# and displaces nobody, which is what "place it on top of" says.
sharesPanel: true
# "While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is
# replaced with Quetzalcoatlus'." Her Master rides as cargo, which is what
# `roles: [owner]` says.
replacesRiderAction: { roles: [owner], move: true, normalAttack: true }
# "After every 1◈ Turns, Quetz's Master's Health is reduced by 25 at the end of
# the Turn... If her Master's Health is 25 or less, this NP is forcefully
# deactivated." The same block Jack's Mist carries at 15, swept by the same
# `runUpkeep`.
upkeep:
  every: "1◈"
  cost: { kind: health, amount: 25, payer: ownerMaster }
  endWhenUnaffordable: true
# "This NP can be deactivated during Quetz's Turn or at the start or end of any
# Round or Turn, BUT CANNOT BE DEACTIVATED FOR 2◈ TURNS after it was activated."
# Piedra Del Sol carries the identical block WITHOUT the lockout, which is
# exactly the difference between the two sheets' final paragraphs.
deactivation: { byOwner: true, window: any, lockout: "2◈" }
crossLevel:
  # "Quetz or her Master cannot be targeted for an Attack while they are Riding."
  occupantTargeting: forbidden
  requiresBoarding: true
  # "If they are hit with an AoE Attack, the Quetzalcoatlus receives full damage,
  # Quetz receives 50% Total Damage while her Master receives no damage and
  # effects." Three tiers, two authored values, and the third is the function's
  # own `unit.id === platform.id` branch.
  aoePassengerFactor: 0.5
  aoeMastersImmune: true
  # Nothing stops her Spells reaching the ground, and they are her whole reason
  # to be up there.
  outboundTargeting: free
  forbidDirectlyBelow: false
```

- [ ] **Step 2: Write `quetz-winged-serpent.yml`**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
schema: 1
id: quetz-winged-serpent
name: "Quetzalcoatl: Winged Serpent"
isNP: true
rank: A
npTags: [antiUnit, antiArmy]
kind: noblePhantasm
slug: wingedSerpent
category: quetzNP
# "Cooldown: 7◈ Turns AFTER Quetzalcoatlus is defeated" — the clock starts on
# the mount's death, not on the cast and not on a dismissal.
cooldown: { max: "7◈", countFrom: destroyed }
timing: { window: ownTurn }
description: |
  (Non-damaging) When this NP is used, Quetz summons a Quetzalcoatlus at her position, and she is
  Moved onto the Quetzalcoatlus together with her Master (if her Master is next to the
  Quetzalcoatlus; otherwise her Master can get on the Quetzalcoatlus at any time).
  While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is replaced with
  Quetzalcoatlus'. Quetz or her Master cannot be targeted for an Attack while they are Riding the
  Quetzalcoatlus. If they are hit with an AoE Attack, the Quetzalcoatlus receives full damage,
  Quetz receives 50% Total Damage while her Master receives no damage and effects.
  The Quetzalcoatlus ignores obstacles while Moving, and can Move onto occupied panels.
  After every 1◈ Turns, Quetz's Master's Health is reduced by 25 at the end of the Turn if this NP
  is Active. If her Master's Health is 25 or less, this NP is forcefully deactivated at the end of
  the Round. This NP can be deactivated during Quetz's Turn or at the start or end of any Round or
  Turn, but cannot be deactivated for 2◈ Turns after it was activated.
  Cooldown: 7◈ Turns after Quetzalcoatlus is defeated.
# "(Non-damaging)". An ability with phases and no `damage` phase deals none —
# the hole five authored Noble Phantasms shipped with.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all, count: 1 }
  limits: { requiresZon: true }
phases:
  - kind: summonPlatform
    target: self
    platformId: quetzalcoatlus
    # "at her position", and she boards it, and so does her Master if he is
    # adjacent — `boardingTarget`'s existing adjacency path, with no roll.
    at: caster
    board: [owner, ownerMaster]
    boardMasterIfAdjacent: true
```

- [ ] **Step 3: Implement the `summonPlatform` phase**

Add a `case "summonPlatform"` to `module/engine/skill-use.mjs`'s phase switch. It is
`engine/hgob.mjs#activateHangingGardens` with the Semiramis-specific parts removed — read that
function (lines 50-90) and generalize it: load the platform document from the compendium by
`platformId`, stamp `ownerId` and `factionId`, create the Actor, create its token at the caster's
panel with its authored footprint, then call
`activatePlatform({ platformId, initialUnitIds })`. Resolve `inherit` from the summoner exactly
the way `engine/summon.mjs` does — do not write a second resolver.

`engine/hgob.mjs` stays as it is: it carries Semiramis's one-shot owner buff, `zonExempt` and
Sustainability writes, which are hers and not general.

- [ ] **Step 4: Write the three Spells**

`quetz-tlahuitequiliztli.yml`:

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
#
# One of three identical Spells that differ only in element and rider. They
# share ONE cooldown — "when one is used the other 2 cannot be used until
# Cooldown ends" — which is an `exclusionSet`, the mechanism `engine/copy.mjs`
# and the `abilityOffCooldown` requirement already share.
schema: 1
id: quetz-tlahuitequiliztli
name: "Tlahuitequiliztli"
kind: spell
slug: tlahuitequiliztli
cooldown: "2◈"
exclusionSet: quetzalcoatlusSpells
element: lightning
timing: { window: ownTurn }
# "Counts as Quetz's & Quetzalcoatlus' Attack for the Turn."
countsAsAttack: true
# "Cannot be used as a Counter" — `timing.window: ownTurn` already refuses a
# reaction window, and this is the sentence it enforces.
requirements:
  # "Can only be used while Riding Quetzalcoatlus."
  - { kind: predicate, predicate: ["self:onPlatform:quetzalcoatlus"] }
  # "Quetzalcoatlus Spells cannot be used if Piedra Del Sol is Active."
  - { kind: predicate, predicate: [{ not: "self:fieldActive:piedra-del-sol" }] }
description: |
  Damage Spell. Can only be used while Riding Quetzalcoatlus. Range=4. Hits a 3x3 panel area
  within Range for 2x damage and inflicts @effect[shock]{Shock} for 2◈ Turns. Lightning damage.
  Counts as Quetz's & Quetzalcoatlus' Attack for the Turn. Cannot be used as a Counter.
targeting:
  anchor: { kind: withinRange, range: 4, metric: chebyshev }
  shape: { kind: square, size: 3 }
  selection: { relations: [enemy, ally, neutral], chooser: all, includeSelf: false }
  isDamagingAoE: true
damage:
  component: mag
  multiplier: 2
  element: lightning
phases:
  - kind: damage
  - kind: applyEffects
    rules:
      - key: OnEvent
        event: damageDealt
        effect: { id: shock }
        duration: "2◈"
```

`quetz-ehecatle.yml` and `quetz-tlaelquiyahuitl.yml` are byte-identical apart from:

| File | `id` | `name` | `slug` | `element` | rider | duration |
|---|---|---|---|---|---|---|
| `quetz-ehecatle.yml` | `quetz-ehecatle` | `Ehecatle` | `ehecatle` | `wind` | `sap` | `1◈` |
| `quetz-tlaelquiyahuitl.yml` | `quetz-tlaelquiyahuitl` | `Tlaelquiyahuitl` | `tlaelquiyahuitl` | `water` | `slow` | `2◈` |

Write each out in full — do not write a file that says "as Tlahuitequiliztli but".

- [ ] **Step 5: Implement the `self:fieldActive:` predicate**

Check `module/rules/predicate.mjs` and the roll-option emitter in `module/rules/snapshot.mjs` for
whether an option of this shape already exists (search for `onPlatform` and copy its emitter). If
not, emit `self:fieldActive:<fieldContentId>` for each active field the unit owns, beside
`self:onPlatform:`.

- [ ] **Step 6: Write the tests**

Append to `test/unit/quetzalcoatl.test.mjs`:

```js
describe("Quetzalcoatlus", () => {
  it("shares panels rather than displacing — not Bašmu's flag", () => {
    const mount = loadUnit("quetzalcoatlus");
    expect(mount.sharesPanel).toBe(true);
    expect(mount.movesOntoOccupiedPanels).toBeFalsy();
  });

  it("gives the three AoE tiers her sheet states", () => {
    const mount = loadUnit("quetzalcoatlus");
    const platform = { id: "m", ...mount };
    expect(aoePassengerFactor({ id: "m", kind: "platform" }, platform)).toBe(1);
    expect(aoePassengerFactor({ id: "q", kind: "servant" }, platform)).toBe(0.5);
    expect(aoePassengerFactor({ id: "k", kind: "master" }, platform)).toBe(0);
  });

  it("cannot be switched off for 2 rounds' worth of turns", () => {
    const mount = loadUnit("quetzalcoatlus");
    expect(mount.deactivation.lockout).toBe("2◈");
  });

  it("charges her Master 25 per period, and closes rather than overdrawing", () => {
    const mount = loadUnit("quetzalcoatlus");
    expect(mount.upkeep.cost.amount).toBe(25);
    expect(mount.upkeep.cost.payer).toBe("ownerMaster");
    expect(mount.upkeep.endWhenUnaffordable).toBe(true);
  });
});

describe("the three Quetzalcoatlus Spells", () => {
  const ids = ["quetz-tlahuitequiliztli", "quetz-ehecatle", "quetz-tlaelquiyahuitl"];

  it("share one cooldown", () => {
    for (const id of ids) expect(loadAbility(id).exclusionSet).toBe("quetzalcoatlusSpells");
  });

  it("each hits a 3x3 at range 4 for 2x", () => {
    for (const id of ids) {
      const s = loadAbility(id);
      expect(s.targeting.anchor.range).toBe(4);
      expect(s.targeting.shape).toEqual({ kind: "square", size: 3 });
      expect(s.damage.multiplier).toBe(2);
    }
  });

  it("carry three different elements and three different riders", () => {
    expect(ids.map((id) => loadAbility(id).element)).toEqual(["lightning", "wind", "water"]);
  });
});
```

- [ ] **Step 7: Verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add packs/_source/platforms/quetzalcoatlus.yml packs/_source/abilities/quetz-winged-serpent.yml \
        packs/_source/abilities/quetz-tlahuitequiliztli.yml packs/_source/abilities/quetz-ehecatle.yml \
        packs/_source/abilities/quetz-tlaelquiyahuitl.yml module/engine/skill-use.mjs \
        packs/_source/servants/quetzalcoatl.yml test/unit/quetzalcoatl.test.mjs
git commit -m "feat(quetzalcoatl): the Quetzalcoatlus, and the three Spells it unlocks"
```

---

### Task 15: Piedra Del Sol

**Files:**
- Create: `packs/_source/structures/piedra-del-sol.yml`
- Create: `packs/_source/abilities/quetz-piedra-del-sol.yml`
- Modify: `module/engine/fields.mjs` (`anchorRef: structure`)
- Modify: `packs/_source/servants/quetzalcoatl.yml`
- Test: `test/unit/quetzalcoatl.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`sharesPanel`), Task 5 (`paintTerrain`), Task 9 (upkeep, deactivation).
- Produces: content ids `piedra-del-sol`, `quetz-piedra-del-sol`.

- [ ] **Step 1: Write the structure**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
# Discussed: docs/43-bounded-fields.md §43.10 — "fields that are objects"
#
# The SECOND `Structure` actor, after Medusa's Bloodmark, and the first that
# levitates. §43.10's decision is the reason it is a unit at all: modelling it
# as one gives targeting, destruction, visibility and Health for free.
#
# `undamageable`, not Bloodmark's 1 Health. Bloodmark got a single point because
# its own sheet says *"only Masters can destroy a Bloodmark, and it is done by
# simply Attacking it"* — a destruction clause needs something to spend. This
# sheet contains NO destruction clause at all: the stone ends on her word, on
# the upkeep going unpaid, and on nothing else. Giving it Health would invent a
# way to remove it that her sheet does not offer.
schema: 1
id: piedra-del-sol
name: "Piedra Del Sol"
type: structure
attributes: [structure, levitating]
baseHealth: null
undamageable: true
mov: 0
range: { panels: 0, targets: 0 }
baseAttack: { str: 0, mag: 0 }
# "The panel occupied by Piedra Del Sol can still be Moved onto (replace the
# Piedra Del Sol on top of any Units which Move onto that panel)."
sharesPanel: true
```

- [ ] **Step 2: Write the Noble Phantasm**

```yaml
# Quetzalcoatl, char_orig_sheets/Copia de Quetzalcoatl.md
# The bounded-field model is Ch. 43; this is a point in its six axes, and it is
# Jack's Mist with a different anchor.
schema: 1
id: quetz-piedra-del-sol
name: "Piedra Del Sol: The Sun Stone"
isNP: true
rank: EX
npTags: [antiArmy, antiFortress, boundedField]
kind: noblePhantasm
slug: piedraDelSol
category: quetzNP
cooldown: { max: "8◈", countFrom: deactivation }
timing: { window: ownTurn }
description: |
  (Non-damaging) When this NP is used, the Piedra Del Sol appears where Quetz is. While the Piedra
  Del Sol is above the field, it has the following effects-
  1. Goddess' Divine Core: All damage dealt is increased by 180; and all damage taken by Quetz is
     reduced by 50% including NP.
  2. When an enemy Unit ends its Turn within the 7x7 panel area around the Piedra Del Sol, it
     receives 50 Fire damage and is inflicted with @effect[burn]{Burn}; this Burn debuff is permanent as long
     as the Unit is within the Piedra Del Sol area.
  Quetz can Move out of the Piedra Del Sol area, and the panel occupied by Piedra Del Sol can
  still be Moved onto.
  After every 1◈ Turns, Quetz's Master's Health is reduced by 50 at the end of the Turn if this NP
  is Active. If her Master's Health drops to/is 50 or less at any time, this NP is forcefully
  deactivated at the end of the Turn. This NP can be deactivated during Quetz's Turn or at the
  start or end of any Round or Turn.
  Cooldown: 8◈ Turns after Piedra Del Sol was deactivated.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all, count: 1 }
  limits: { requiresZon: true }
field:
  # Axis 1 — geometry. Anchored to the PLACED OBJECT, not to her: she may walk
  # out of her own area and the stone stays where it was put.
  geometry:
    kind: fixedArea
    shape: { kind: square, size: 7 }
    anchorRef: structure
    structureId: piedra-del-sol
  # Axis 2 — membership. Free both ways; it is a hazard, not a prison.
  membership: { allyEntry: free, allyExit: free, enemyEntry: free, enemyExit: free }
  # Axis 3 — isolation. None.
  isolation:
    outsideCanTargetInside: true
    insideCanTargetOutside: true
    outsideCanApplyEffectsInside: true
    visibilityAcrossBoundary: full
  # Axis 4 — interior rules. Clause 1, and both halves are HERS: `relations:
  # [self]` on both, because the sheet's subject throughout clause 1 is Quetz.
  interior:
    # "Goddess' Divine Core: All damage dealt is increased by 180."
    #
    # DECISION (spec §9.1): this OVERRIDES her Skill's +120 rather than stacking
    # to +300. The clause is headed with the Skill's own name and gives a
    # different number, which reads as the stone raising the Skill's value while
    # it stands. `supersedes` is the mechanism §15.4 built for exactly this, so
    # the two cannot both apply and the reason is legible at the call site.
    - key: FlatDamage
      value: 180
      includesNP: true
      relations: [self]
      supersedes: [quetz-goddesses-divine-core]
    # "All damage taken by Quetz is reduced by 50% including NP."
    - key: DamageTaken
      percent: -50
      includesNP: true
      relations: [self]
  # Clause 2. The generic Burning terrain entry inflicts an unremovable,
  # non-expiring Burn at turn end and deals 25 fixed Fire damage; this area
  # differs in two ways only — 50 rather than 25, and enemies rather than
  # everyone — so it is stated here and the terrain does the rest.
  interiorEvents:
    - event: turnEnd
      relations: [enemy]
      onFail:
        - { key: Damage, amount: 50, element: fire, fixed: true }
        # "Permanent as long as the Unit is within the area": no duration, and
        # unremovable, which is what the Burning terrain's own clause says too.
        - { key: ApplyEffect, effect: { id: burn }, duration: null, unremovable: true }
  # Axis 5 — duration. There is none; the upkeep is what limits it.
  upkeep:
    every: "1◈"
    cost: { kind: health, amount: 50, payer: ownerMaster }
    endWhenUnaffordable: true
  # Axis 6 — vulnerability.
  vulnerabilities:
    - { kind: ownerDefeat, result: end }
  # NO `lockout`, unlike the Quetzalcoatlus. That is the difference between the
  # two sheets' final paragraphs and it is authored rather than inferred.
  deactivation: { byOwner: true, window: any }
  onEnd:
    # The ground it painted goes with it.
    - { key: ClearTerrain, tag: "piedra:@field.id" }
phases:
  - kind: createStructure
    target: self
    structureId: piedra-del-sol
    at: caster
  - kind: createField
    target: self
  # "(The Piedra Del Sol area is categorized as 'Burning'.)"
  - kind: zone
    target: self
    spec:
      terrain: [burning]
      shape: { kind: square, size: 7 }
      anchor: { kind: self }
      followsSource: false
      duration: null
      tag: "piedra:@field.id"
```

- [ ] **Step 3: Implement `createStructure` and `anchorRef: structure`**

Add a `case "createStructure"` to `module/engine/skill-use.mjs`. `module/engine/marks.mjs#placeMark`
(line 53) already creates a Structure actor and its token from a content id — read it and factor
the creation out into a shared helper both call, rather than writing a second one. Stamp
`system.ownerId` and, after the field opens, `system.fieldId`.

In `module/engine/fields.mjs#createField`, add the `anchorRef: "structure"` branch: the field's
centre is the structure's panel rather than the owner's. Follow how `anchorRef: owner` resolves
today.

- [ ] **Step 4: Implement the `ClearTerrain` onEnd element**

In `module/engine/fields.mjs#endField`, handle an `onEnd` entry with `key: ClearTerrain` by calling
`clearTerrain(tag)` with `@field.id` resolved. Also delete the structure actor the field is
anchored to — `endField` already tears down Bloodmarks by `fieldId`, so extend that sweep rather
than adding a parallel one.

- [ ] **Step 5: Write the tests**

```js
describe("Piedra Del Sol", () => {
  it("is undamageable — her sheet gives it no destruction clause", () => {
    const stone = loadUnit("piedra-del-sol");
    expect(stone.undamageable).toBe(true);
    expect(stone.baseHealth).toBe(null);
  });

  it("shares its panel", () => {
    expect(loadUnit("piedra-del-sol").sharesPanel).toBe(true);
  });

  it("overrides the Divine Core rather than stacking with it", () => {
    const np = loadAbility("quetz-piedra-del-sol");
    const flat = np.field.interior.find((r) => r.key === "FlatDamage");
    expect(flat.value).toBe(180);
    expect(flat.supersedes).toContain("quetz-goddesses-divine-core");
  });

  it("charges her Master 50 — twice the mount's toll", () => {
    expect(loadAbility("quetz-piedra-del-sol").field.upkeep.cost.amount).toBe(50);
  });

  it("has NO deactivation lockout, unlike the Quetzalcoatlus", () => {
    const np = loadAbility("quetz-piedra-del-sol");
    expect(np.field.deactivation.byOwner).toBe(true);
    expect(np.field.deactivation.lockout).toBeUndefined();
  });

  it("anchors to the structure, so Quetz may walk out of her own area", () => {
    expect(loadAbility("quetz-piedra-del-sol").field.geometry.anchorRef).toBe("structure");
  });
});
```

- [ ] **Step 6: Verification and commit**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content
git add packs/_source/structures/piedra-del-sol.yml packs/_source/abilities/quetz-piedra-del-sol.yml \
        module/engine/skill-use.mjs module/engine/fields.mjs \
        packs/_source/servants/quetzalcoatl.yml test/unit/quetzalcoatl.test.mjs
git commit -m "feat(quetzalcoatl): Piedra Del Sol, a field anchored to an object"
```

---

### Task 16: Documentation

**Files:**
- Modify: `docs/08-board-and-geometry.md`, `docs/13-damage-pipeline.md`,
  `docs/20-platforms-and-levels.md`, `docs/42-terrain.md`, `docs/43-bounded-fields.md`,
  `docs/45-implementation-status.md`, `docs/A-effect-catalogue.md`,
  `docs/D-servant-data-sheets.md`, `CHANGELOG.md`

**Interfaces:** Consumes every prior task. Produces nothing code reads.

**Context.** The standing rule in this project is that `docs/45` alone is not enough — the
affected chapter in 00–44 must change too, because 45 is a status audit and the chapters are the
specification. A reader who finds a mechanism in 45 and not in its chapter has found a
contradiction.

- [ ] **Step 1: Ch. 08 — panel sharing**

Add a subsection to the occupancy discussion distinguishing `sharesPanel` (co-location) from
`ignoresOccupancy` (displacement), with the table from the spec's §3 and the structure-vs-structure
rule. Note that `canPassThrough`/`canStopOn` already treated objects as non-blocking and that the
new capability is the *mover* side.

- [ ] **Step 2: Ch. 13 — `elementFraction`**

Record that element-scoped modifiers were collected and unread until now, and that
`elementFraction` splits an attack's element share. Name the four sheets that use "(half)" and
state that Karna is retrofitted while Dioscuri and Raikou are unauthored.

- [ ] **Step 3: Ch. 20 — the three new platform axes**

`replacesRiderAction`, recurring platform upkeep, `deactivation.lockout`, and
`cooldown.countFrom: destroyed`. Update the §20.7 platform table's Quetzalcoatlus row from a
prediction to a built row.

- [ ] **Step 4: Ch. 42 — the write half**

§42.7 currently describes the `zone` phase as a design. Mark it built, document
`engine/terrain.mjs`'s four exports, the `tag` convention, and that `terrainConversions` now has a
caller. Mark `phaseAt` (§42.6) built. Add a decision row to §42.8's table for the `tag`/`expiry`
schema addition.

- [ ] **Step 5: Ch. 43 §43.10 — Piedra Del Sol built**

Change *"Two fields are anchored to a placed object"* from a description to a record of two built
things, and note `anchorRef: structure` and the `undamageable`-versus-Bloodmark's-1-Health
distinction.

- [ ] **Step 6: Appendix A and §D.28**

Add `Sap` to the catalogue with a note that its document was missing while the scheduler entry
existed. Mark `Sol` built. In §D.28, change the mapping table's **RE+** entries from predictions to
built rows and update **Scripts: 0** if any task added a script (it should still read 0 —
every clause of hers is authored content over general engine).

- [ ] **Step 7: Ch. 45**

Add Quetzalcoatl to the status tables. Record the four *collected-and-inert* defects this work
closed — element-scoped modifiers, `terrainConversions`, `TerrainBehavior`'s five unwritten fields,
and `selectAbilities`' unusable single-ability branch — in the same register as the five already
listed there.

- [ ] **Step 8: CHANGELOG**

Add an Unreleased entry covering all fifteen prior tasks, following the existing entries' style.

- [ ] **Step 9: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs(quetzalcoatl): the sixteenth Servant, and four inert rules made live"
```

---

### Task 17: Live verification in the debug Chrome

**Files:** none — this task changes nothing and proves everything.

**Interfaces:** Consumes every prior task.

**Context.** Green tests are not evidence for the layers that touch documents, and most of this
work is in those layers. `tools/fgt-eval.mjs` attaches to the running Foundry page over CDP
(`node tools/fgt-eval.mjs "game.actors.size"`, or piped stdin for a multi-line body); the
`claude-in-chrome` tools drive the interface and take the screenshots.

**Rebuilding packs requires Foundry fully closed.** The application holds the LevelDB open;
shutting the *world* down does not release it. Getting this wrong corrupts the pack.

- [ ] **Step 1: Build the packs**

Ask the user to close Foundry completely, then:

```bash
npm run build:packs && npm run check:manifest
```

Expected: a clean build naming the new documents. Then ask the user to reopen Foundry and the
test world.

- [ ] **Step 2: Confirm the content loaded**

```bash
node tools/fgt-eval.mjs "game.packs.get('fgt.servants').index.filter(e => e.name.match(/Quetz|Piedra/)).map(e => e.name)"
```

Expected: `Quetzalcoatl`, `Quetzalcoatlus`, `Piedra Del Sol`.

- [ ] **Step 3: Place the cast**

Import Quetzalcoatl, a Master for her, and two enemy Servants onto the test scene. Verify her
derived statline in the live world:

```bash
node tools/fgt-eval.mjs "const q = game.actors.getName('Quetzalcoatl'); return {hp: q.system.health, ba: q.system.baseAttack, mov: q.system.mov, abilities: q.items.size}"
```

Expected: `health.max` 1250, `baseAttack` `{str: 125, mag: 250}`, `mov` 7, twelve abilities.

- [ ] **Step 4: Sol**

Set the round to Night. Use Charisma of the Sun. Screenshot the canvas.

Expected: a 5×5 Region appears centred on her. Then:

```bash
node tools/fgt-eval.mjs "const {phaseAt} = await import('/systems/fgt/module/rules/environment.mjs'); const b = game.fgt.board(); const q = b.units.find(u => u.name === 'Quetzalcoatl'); return {here: phaseAt(q.panel, b), away: phaseAt({i: 0, j: 0}, b), round: b.phase}"
```

Expected: `{here: "day", away: "night", round: "night"}`.

Move her three panels. Screenshot again — the patch must have moved with her, and there must be
**one** Region, not four.

- [ ] **Step 5: The mount**

Use Quetzalcoatl: Winged Serpent with her Master adjacent.

Expected, by screenshot: the Quetzalcoatlus token appears at her panel with both aboard. Then
verify the three things a screenshot cannot show:

```bash
node tools/fgt-eval.mjs "const b = game.fgt.board(); const q = b.units.find(u => u.name === 'Quetzalcoatl'); const m = b.units.find(u => u.kind === 'platform'); const {actionSourceFor, aoePassengerFactor} = await import('/systems/fgt/module/rules/platforms.mjs'); return {drives: actionSourceFor(q, b).movesAsPlatform, quetzAoe: aoePassengerFactor(q, m), mountAoe: aoePassengerFactor(m, m), level: q.level}"
```

Expected: `{drives: true, quetzAoe: 0.5, mountAoe: 1, level: 1}`.

Target her with an enemy attack. Expected: refused, with a reason naming the platform.

Move her. Expected: the mount moves, both riders move with it, and it may end on a panel an enemy
occupies without knocking anyone back.

- [ ] **Step 6: A Spell, and the effect that never existed**

Use Ehecatle on two enemies.

```bash
node tools/fgt-eval.mjs "return game.actors.getName('<enemy>').effects.map(e => ({id: e.system?.defId, until: e.system?.expiry}))"
```

Expected: a `sap` effect present. Advance a turn and confirm 50 Health is lost at turn end — the
scheduler entry that has had no document to act on since it was written.

Then try Tlahuitequiliztli in the same window. Expected: refused, shared cooldown.

- [ ] **Step 7: Xiuhcoatl**

Dismount (the lockout means this needs 2◈ of turns to pass first — confirm the refusal *before*
that, and that the refusal names when it unlocks). Then use Xiuhcoatl on one enemy with a second
enemy within 2 panels of Quetz.

Expected: **two** chat cards. The first at 4× against the named target; the second at 1× against
the bystander and **not** against the primary. Confirm the aftermath fires on a miss by repeating
with an enemy that Evades.

- [ ] **Step 8: Piedra Del Sol**

Use it. Screenshot.

Expected: the stone's token at her panel, a 7×7 Region, and Quetz free to walk out of it. Walk an
enemy **onto the stone's panel** — it must be allowed, and the stone must draw on top. Then end
that enemy's turn inside the area and confirm 50 Fire damage plus a `burn` with no expiry.

Advance to the upkeep tick and confirm her Master loses 50.

```bash
node tools/fgt-eval.mjs "const m = game.actors.getName('<her Master>'); return m.system.health"
```

- [ ] **Step 9: Report honestly**

Write up what was observed, with screenshots. Any clause that did not behave as its sheet says is
a defect to fix, not a note to file — go back to the task that owns it. State explicitly that
Xiuhcoatl's `[Fortress]` clause was **not** demonstrated, and why (no `[Fortress]` NP exists in the
roster; Ozymandias is unauthored).

- [ ] **Step 10: Final verification**

```bash
npm test && npm run lint && npm run typecheck && npm run validate:content && npm run check:smoke
```

Expected: all pass.

---

## Self-Review

**Spec coverage.** Every section of the design maps to a task: §2's reuse is Task 12's `ref`
entries; §3 is Task 1; §4 is Tasks 5–7; §5 is Task 4; §6 is Tasks 8 and 12; §7.1 is Task 11, §7.2
is Task 3, §7.3 is Task 13; §8 is Tasks 9, 10 and 14; §9 is Task 15; §10's exclusions are recorded
in Tasks 13 and 16; §11 is Tasks 12–15 and 17; §12's file list is the File Structure table.

**One spec correction, carried into Task 1.** The design's §3 says a unit could not walk onto
Piedra Del Sol's panel. It could: `movement.mjs:308` and `:351` already exempt `platform` and
`structure` occupants. The real gaps are the *mover* side and structure-vs-structure blocking, and
Task 1 says so at its head. Fold this back into the spec when convenient.

**One scope growth, carried into Task 3.** The design treats `elementFraction` as a fraction
applied to element-scoped modifiers. Those modifiers are not in any bucket in `pipeline.mjs`, so
terrain has emitted them into a void since terrain shipped. Task 3 therefore makes them readable
*and* fractional — a fraction of nothing is nothing.

**Type consistency.** `sharesPanel` (boolean) is authored, compiled, schema'd, projected and read
under one name throughout. `actionSourceFor` returns `{unit, platform, movesAsPlatform,
attacksAsPlatform}` in Task 10 and is destructured under those exact names in Tasks 10 and 17.
`deactivationVerdict` returns `{ok, reason, unlocksAt}` in Task 9 and is read as `.ok` in
`mayDeactivate`. `paintTerrain`/`clearTerrain`/`terrainRegionsFor` are defined in Task 5 and used
under those names in Tasks 6, 7, 13 and 15. The `tag` format `"<source>:<id>"` is fixed in Task 5
and Tasks 6, 12 and 15 each carry an explicit check that both ends agree.

**Known plan-time uncertainties**, each with an instruction to resolve by reading rather than
guessing: `s.applyPercent` (Task 3 step 4), `panelsForShape`'s real name and home (Task 5 step 4),
`valueFrom` (Task 12 step 6), `loadAbility`/`loadUnit` helpers (Task 13 step 3), and whether
`environment.mjs → terrain.mjs` creates an import cycle (Task 4 step 4). Each step names the file
to read and what to do if the guess is wrong.
