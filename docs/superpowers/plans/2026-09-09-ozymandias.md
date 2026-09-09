# Ozymandias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ozymandias plays exactly as his sheet reads — three class skills, three active Skills, two Noble Phantasms, an 11×11 Complex with six clauses and four termination paths, a replaced Normal Attack inside it, three Sphinxes, and a once-per-game finisher.

**Architecture:** Every task pairs an **engine addition with the clause that consumes it**. Nothing lands inert — which is this project's dominant defect and the reason most of the work below exists at all.

**Tech Stack:** Foundry VTT v14, vanilla ESM, vitest, YAML content compiled by `tools/build-packs.mjs`.

**Spec:** [`docs/superpowers/specs/2026-09-09-ozymandias-design.md`](../specs/2026-09-09-ozymandias-design.md)

## Global Constraints

- **Layer rule.** `domain` (1) ← `rules` (2) ← `engine` (3) ← `apps`/`documents` (4). `rules/` and `domain/` never touch `game`, `canvas`, `ui`, `Hooks`. `npm run lint` runs `tools/check-layers.mjs`.
- **Closed vocabularies, all enforced at build time.** Before authoring, check the value exists:
  - anchors — `self`, `targetUnit`, `withinRange`, `selfEdgeAdjacent`, `fieldEdge`, `zone`, `movementPath`, `platform`, `global`, `sourceOfAttack`
  - shapes — `point`, `unit`, `square{size}`, `rect{w,h}`, `chebyshevRadius{r}`, `attackRange{r}`, `ring{r}`, `line{length,diagonalLength?,bidirectional?,width?}`, `orientedRect{short,long}`, `path`, `zone{zoneId}`, `banded{bands}`
  - `selection.chooser` — `all`, `nearest`, `random`, `chosen`
  - `modifierKey` — the closed set at `rules/damage/pipeline.mjs:784-789` (`atkUp`, `atkDwn`, `dmgUp`, `defUp`, `defDwn`, `flatDamage`, `dmgCut`, …)
  - roll options — every option a predicate names must match a pattern in `EMITTABLE` (`rules/options.mjs:421`), held by `test/unit/options.test.mjs`
  - requirement kinds — `REQUIREMENT_KINDS` (`rules/items.mjs:181`)
  - log kinds — `LOG_KINDS` (`rules/game-log.mjs:29`)
- **`actorSystem()` / `itemSystem()` in `tools/lib/content.mjs` are allowlists.** An authored field absent from them compiles to its schema default. `npm run validate:content` refuses it; it has caught six fields to date.
- **Rebuilding packs needs the world down**: `node tools/fgt-rebuild.mjs`, never a bare `build:packs`.
- **Bringing the world up**: open a tab over CDP first, then `launch`, then `join` — `fgt-world.mjs launch` fails silently with `pages: []`.
- Every commit updates the affected `docs/00-44` chapter **and** `docs/45`. Commit trailer:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
  ```
- **Rulings** (from the author, see spec §2): R1 he has all three Riding passives; R2 the Complex **clips** against an enemy Home Base; R3 a Sphinx adjacent to **Ozymandias or his Master** shields that unit; R4 Pyramid Drop reduces his **Skills**, not his NPs.

---

### Task 1: Ozymandias exists

**Files:**
- Modify: `module/rules/environment.mjs` (`REGION_ADJACENCY`, ~:385)
- Create: `packs/_source/servants/ozymandias.yml`
- Test: `test/unit/environment-rest.test.mjs`
- Modify: `docs/D-servant-data-sheets.md`, `docs/45-implementation-status.md`

**Interfaces:**
- Consumes: `class-riding`, `class-magic-resistance`, `divinity` (all parameterized).
- Produces: content id `ozymandias`, and `egypt` in the region graph.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/environment-rest.test.mjs`:

```js
describe("egypt", () => {
  it("is in the graph, because Ozymandias is from there", () => {
    expect(REGION_ADJACENCY.egypt).toBeDefined();
  });

  it("neighbours the Middle East, Mesopotamia and Greece, symmetrically", () => {
    // The existing "keeps the adjacency graph symmetric" test covers the
    // general rule; this names the edges, because a one-way edge makes
    // Semiramis's Construction counter depend on argument order.
    for (const other of ["middleEast", "mesopotamia", "greece"]) {
      expect(REGION_ADJACENCY.egypt.adjacent).toContain(other);
      expect(REGION_ADJACENCY[other].adjacent).toContain("egypt");
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/environment-rest.test.mjs`
Expected: FAIL — `REGION_ADJACENCY.egypt` is undefined.

- [ ] **Step 3: Add Egypt, and its edges both ways**

In `module/rules/environment.mjs`, replace the three affected entries and add the new one:

```js
  greece: { adjacent: ["europe", "middleEast", "mesopotamia", "egypt"] },
  ...
  middleEast: { adjacent: ["greece", "europe", "mesopotamia", "india", "egypt"] },
  mesopotamia: { adjacent: ["greece", "middleEast", "india", "egypt"] },
  // Ozymandias. Added with its neighbours in the same edit, because the graph
  // is symmetric and `test/unit/environment-rest.test.mjs` enforces it -- a
  // one-way edge would make Semiramis's Construction counter depend on which
  // way round the question is asked.
  egypt: { adjacent: ["middleEast", "mesopotamia", "greece"] },
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/unit/environment-rest.test.mjs`

- [ ] **Step 5: Author the Servant**

Create `packs/_source/servants/ozymandias.yml`:

```yaml
# packs/_source/servants/ozymandias.yml
# Conversion source: char_orig_sheets/Copia de Ozymandias.md
# Data sheet: docs/D-servant-data-sheets.md §D.24 · field: docs/43-bounded-fields.md
schema: 1
id: ozymandias
name: Ozymandias
type: servant

trueName: "Ozymandias, Ramesses II"
servantClasses: [rider]
classContainer: rider
alignment: { order: chaotic, morality: neutral }
region: [egypt]
# `[Sky]` and `King` are the sheet's; `divine` is NOT authored here -- his
# Divinity Skill grants it (`class-skills/divinity.yml`'s StatDelta), and
# authoring it in both places would leave the attribute standing if the Skill
# were ever Sealed. The same argument Karna's file records.
attributes: [male, servant, sky, king, humanoid]

parameters: { str: C, end: C, agi: B, mag: A, luc: "A+" }
baseHealth: 1000
mov: 6
range: { panels: 3, targets: 1 }
baseAttack: { str: 100, mag: 200 }
# Mesektet is "the source of Ozymandias' Normal Attacks. All Normal Attacks use
# Base Attack (MAG)". The element and the Dark bonus are on the NP document.
normalAttack: { mode: fixed, component: mag }
sustainability: "2◈"

abilities:
  # R1: he has all three Riding passives. The sheet lists two and Passive 2 says
  # "can be combined with Passenger Seat", which he could not do without it.
  - { ref: class-riding, rank: "A+", cooldown: "3◈-⅓◈" }
  - { ref: class-magic-resistance, rank: B }
  - { ref: divinity, rank: B }

notes: |
  Base Attack is DERIVED from STR and MAG (Ch. 41 Q50), and the table agrees
  with the sheet at C/A: 100 and 200.
```

- [ ] **Step 6: Validate, rebuild, and look at him**

```bash
npm run validate:content && node tools/fgt-rebuild.mjs
node tools/fgt-eval.mjs "
const { prepareSummon, commitSummon } = await import('/systems/fgt/module/engine/summon.mjs');
const board = await import('/systems/fgt/module/engine/board.mjs');
const a = await commitSummon(await prepareSummon({ contentId: 'ozymandias' }));
const u = board.unitSnapshot(a);
return JSON.stringify({ name: a.name, hp: a.system.health.max, ba: u.baseAttack, mov: u.mov,
  range: u.range, region: [...a.system.region], attrs: [...a.system.attributes],
  items: a.items.map(i => i.name) }, null, 1)"
```

Expected: `baseAttack {str: 100, mag: 200}`, `mov: 6`, `range: 3`, `region: ["egypt"]`, and three abilities. Keep the actor — later tasks use him.

- [ ] **Step 7: Document, then commit**

Add his row to `docs/D-servant-data-sheets.md` §D.24's status column, and a `docs/45` line. Run `npm run lint && npm test`.

```bash
git add module/rules/environment.mjs packs/_source/servants/ozymandias.yml \
        test/unit/environment-rest.test.mjs docs/D-servant-data-sheets.md docs/45-implementation-status.md
git commit -m "$(cat <<'EOF'
feat(ozymandias): the Servant, and Egypt

`egypt` was not in REGION_ADJACENCY at all — thirteen entries and his was not
one — so `region: [egypt]` would have matched no war and §19.3's parameter
grant would silently never have fired for him. Added with its neighbours in the
same edit, because the graph is symmetric and a test enforces it.

He has all three Riding passives (R1): the sheet lists two, and Passive 2 says
"can be combined with Passenger Seat", which he could not do without it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
)"
```

---

### Task 2: Mesektet — a Normal Attack with an element

**Files:**
- Modify: `module/data/actor/_shared.mjs` (`combatantCommon().normalAttack`)
- Modify: `module/rules/normal-attack.mjs`
- Modify: `module/engine/attack.mjs` (the normal-attack element source)
- Modify: `tools/lib/content.mjs` (allowlist, if `normalAttack` is filtered)
- Create: `packs/_source/abilities/ozymandias-mesektet.yml`
- Test: `test/unit/normal-attack.test.mjs`

**Interfaces:**
- Produces: `normalAttackAt()` returns `element`; `ctx.attack.element` is populated for a Normal Attack.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/normal-attack.test.mjs`:

```js
describe("element", () => {
  it("carries the element a Normal Attack is authored with", () => {
    // Mesektet: "All Normal Attacks use Base Attack (MAG) ... Light damage."
    // Every element in the engine came from an ABILITY, and the damage
    // pipeline bails at stage 0 without one — so a Servant whose ordinary
    // swing has a type had nowhere to say it.
    const unit = { normalAttack: { mode: "fixed", component: "mag", element: "light" } };
    expect(normalAttackAt(unit, 1).element).toBe("light");
  });

  it("is null when unstated, rather than undefined", () => {
    expect(normalAttackAt({ normalAttack: { mode: "fixed", component: "str" } }, 1).element)
      .toBeNull();
  });

  it("lets a band override it", () => {
    const unit = { normalAttack: { mode: "rangeBanded", component: "str", element: "fire",
      bands: [{ from: 3, component: "mag", element: "light" }] } };
    expect(normalAttackAt(unit, 1).element).toBe("fire");
    expect(normalAttackAt(unit, 3).element).toBe("light");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/normal-attack.test.mjs`

- [ ] **Step 3: Declare the field**

In `module/data/actor/_shared.mjs`, inside `combatantCommon().normalAttack`'s `SchemaField`, after `component`:

```js
      // What a Normal Attack's damage IS. Every element in the engine is
      // sourced from an ability document (`engine/attack.mjs`), and the
      // pipeline's element stage returns immediately without one -- so a
      // Servant whose ordinary swing has a type had nowhere to state it.
      // Mesektet is the first: *"All Normal Attacks ... Light damage."*
      element: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
```

- [ ] **Step 4: Return it from the resolver**

In `module/rules/normal-attack.mjs`, add `element` to the `NormalAttackSpec` typedef, then to `flat`:

```js
  const flat = {
    sources: [{ unit: named, component, factor: 1 }],
    component,
    element: spec.element ?? null,
    ignoresMagicResistance: false,
  };
```

and to the banded return:

```js
    component: band.component ?? sources[0]?.component ?? component,
    // A band may retype the damage as well as re-source it.
    element: band.element ?? spec.element ?? null,
    ignoresMagicResistance: Boolean(band.ignoresMagicResistance),
```

- [ ] **Step 5: Let the attack context read it**

In `module/engine/attack.mjs`, at each of the three sites that resolve `element` (`~:555`, `~:2669`, `~:4747`), fall through to the normal attack's:

```js
    element: resolvedDamage(ability, options)?.element
      ?? ability?.system?.element
      // A Normal Attack has no ability document; its element is on the unit.
      ?? (ability ? null : normalAttackAt(attacker, range)?.element)
      ?? null,
```

Import `normalAttackAt` there if it is not already imported.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/unit/normal-attack.test.mjs && npm test`

- [ ] **Step 7: Author Mesektet**

Create `packs/_source/abilities/ozymandias-mesektet.yml`:

```yaml
# Ozymandias, char_orig_sheets/Copia de Ozymandias.md
#
# > "(Passive) The source of Ozymandias' Normal Attacks. All Normal Attacks use
# > Base Attack (MAG) and deal extra damage to Units with the 'Dark' Attribute,
# > damage dealt is increased by 100%. Light damage."
# > "(Active) Hits a 3x3 panel area within Range for 4x damage plus 100; deals
# > extra damage to Units with the 'Dark' Attribute, damage dealt is increased
# > by 100% (doubled). Light damage. Cooldown: 7◈+⅓◈ Turns."
#
# The passive's component and element are on the SERVANT (`normalAttack`); what
# lives here is the Dark bonus, as a `dealt` modifier predicated on the target.
# The active's doubling is folded into the MULTIPLIER via `damage.branches`,
# which is Jack's Maria the Ripper's argument: "damage dealt is doubled"
# multiplies this NP's own output, and a stage-5 modifier would instead be one
# more additive percentage among everyone else's.
schema: 1
id: ozymandias-mesektet
name: "Mesektet: The Solar Ship of the Dark Night"
isNP: true
rank: "A+"
npTags: [antiArmy]
kind: noblePhantasm
slug: mesektet
element: light
cooldown: { max: "7◈+⅓◈" }
description: |
  (Passive) The source of Ozymandias' Normal Attacks. All Normal Attacks use Base Attack (MAG) and
  deal extra damage to Units with the 'Dark' Attribute — damage dealt is increased by 100%.
  Light damage.
  (Active) Hits a 3x3 panel area within Range for 4x damage plus 100; deals extra damage to Units
  with the 'Dark' Attribute, damage dealt is increased by 100% (doubled). Light damage.
passiveRules:
  - key: DamageModifier
    modifierKey: atkUp
    direction: dealt
    value: 100
    npValue: 100
    predicate: ["attack:kind:normal", "target:attribute:dark"]
targeting:
  anchor: { kind: withinRange, range: 3, metric: chebyshev }
  shape: { kind: square, size: 3 }
  selection: { relations: [enemy, ally, neutral], chooser: all, includeSelf: false }
  limits: { requiresZon: true }
  isDamagingAoE: true
damage:
  component: mag
  multiplier: 4
  flatBonus: 100
  element: light
  branches:
    - predicate: ["target:attribute:dark"]
      multiplier: 8
      flatBonus: 100
      component: mag
    - predicate: [{ not: "target:attribute:dark" }]
      multiplier: 4
      flatBonus: 100
      component: mag
phases:
  - kind: damage
  - kind: cooldown
```

Add `- { ref: ozymandias-mesektet }` to his `abilities`.

- [ ] **Step 8: Validate, rebuild, and fire it live**

```bash
npm run validate:content && node tools/fgt-rebuild.mjs
```

Then in the world: place Ozymandias and a `Dark`-attributed enemy (Pale Rider carries none — use a summon or set `system.attributes` on a test actor), attack normally, and **read the chat card**: the element line says Light and the Dark bonus contributes +100%. Then fire Mesektet and confirm the multiplier is 8 against Dark and 4 otherwise.

- [ ] **Step 9: Document and commit**

Note in `docs/13-damage-pipeline.md` that a Normal Attack may now carry an element, and why it could not before.

```bash
git add module/data/actor/_shared.mjs module/rules/normal-attack.mjs module/engine/attack.mjs \
        packs/_source/abilities/ozymandias-mesektet.yml packs/_source/servants/ozymandias.yml \
        test/unit/normal-attack.test.mjs docs/13-damage-pipeline.md
git commit -m "feat(ozymandias): Mesektet, and an element on a Normal Attack

Every element in the engine came from an ability document and the pipeline's
element stage returns immediately without one — so a Servant whose ordinary
swing has a type had nowhere to state it. Mesektet is the first.

The active's doubling is folded into the multiplier rather than authored as a
modifier, which is Maria the Ripper's argument: it multiplies this NP's own
output, where a stage-5 modifier would be one more additive percentage.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN"
```

---

### Task 3: A day/night roll option, and Pharaoh of the Hot Sands

**Files:**
- Modify: `module/rules/options.mjs` (`add()`, `EMITTABLE`)
- Modify: `module/rules/snapshot.mjs` (stamp the per-panel phase)
- Create: `packs/_source/abilities/ozymandias-pharaoh-of-the-hot-sands.yml`
- Test: `test/unit/options.test.mjs`

**Interfaces:**
- Produces: roll options `self:phase:day` / `self:phase:night` / `target:phase:*`, computed **per panel** via `phaseAt`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/options.test.mjs`:

```js
describe("phase", () => {
  it("emits the phase at the unit's own panel", () => {
    // PER PANEL, not per Round: a unit standing in Quetzalcoatl's Sol — or in
    // Pyramid Drop's own daylight — is in Day while the Round is Night, and
    // Pharaoh's two conditional clauses must see that.
    const day = rollOptionsFor({ attacker: { phase: "day" }, defender: null });
    expect(day.has("self:phase:day")).toBe(true);
    expect(day.has("self:phase:night")).toBe(false);
  });

  it("emits nothing when the cycle is switched off", () => {
    expect(rollOptionsFor({ attacker: { phase: "none" }, defender: null }).has("self:phase:day"))
      .toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/options.test.mjs`

- [ ] **Step 3: Emit it**

In `module/rules/options.mjs`'s `add()`, beside the other board-derived options:

```js
  // Day or Night AT THIS UNIT'S PANEL. There was no day/night option at all,
  // so Ozymandias's *"If used during a Day Round"* clauses could not be
  // written. Per panel rather than per Round, because `phaseAt` already makes
  // it a positional question -- a unit inside Quetzalcoatl's `Sol`, or inside
  // Pyramid Drop's own daylight, is in Day while the Round is Night.
  // `"none"` is the cycle switched off, and emits nothing: there is no Day to
  // be in, and a clause gated on one should not fire.
  if (unit.phase === "day" || unit.phase === "night") options.add(`${side}:phase:${unit.phase}`);
```

and add to `EMITTABLE`:

```js
  /^(self|target):phase:(day|night)$/,
```

- [ ] **Step 4: Stamp it on the snapshot**

In `module/rules/snapshot.mjs`, inside `annotateEnvironment`'s per-unit loop (beside `u.inHomeBase`):

```js
    // The phase where this unit is standing, for `self:phase:day`. Read through
    // `phaseAt` rather than off `board.phase`, so a painted `sunlight` or
    // `darkness` area overrides the Round for whoever is inside it.
    u.phase = board.dayNightCycle === false ? "none" : phaseAt(u.panel ?? { i: -1, j: -1 }, board);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/unit/options.test.mjs && npm test`

- [ ] **Step 6: Author the Skill**

Create `packs/_source/abilities/ozymandias-pharaoh-of-the-hot-sands.yml`:

```yaml
# > "(Active) Used during your Turn. Affects all allied Units within a 2 panel
# > area of himself. 1. Applies Atk Up for 1◈ Turns, all damage dealt is
# > increased by 20%; if NP, 10%. 2. If used during a Day Round, applies Crit Up
# > for ⅓◈ Turns, Crit Chance +10%. 3. If used during a Day Round, applies Crit
# > DmUp for 1◈ Turns, Crit Damage +30%. Cooldown: 4◈ Turns.
# > This Skill is categorized as 'Charisma'."
#
# `applyEffects`, not an `Aura`: the ally keeps the buff after walking out of
# the 2-panel area, which is the distinction Penthesilea's own file spells out.
# Two of the three clauses are gated on the DAY, per phase, which is what
# `self:phase:day` was added for.
schema: 1
id: ozymandias-pharaoh-of-the-hot-sands
name: "Pharaoh of the Hot Sands"
rank: A
kind: skill
categorizedAs: [charisma]
cooldown: { max: "4◈" }
timing: { window: ownTurn }
description: |
  (Active) Affects all allied Units within a 2 panel area of himself.
  1. @effect[atkUp]{Atk Up} for 1◈ Turns: all damage dealt is increased by 20%; if NP, 10%.
  2. If used during a Day Round, @effect[critUp]{Crit Up} for ⅓◈ Turns: Crit Chance +10%.
  3. If used during a Day Round, @effect[critDmUp]{Crit DmUp} for 1◈ Turns: Crit Damage +30%.
targeting:
  anchor: { kind: self }
  shape: { kind: square, size: 5 }
  selection: { relations: [ally, self], chooser: all, includeSelf: true }
phases:
  - kind: applyEffects
    target: reuse
    effects:
      - { id: atkUp, magnitude: 20, npMagnitude: 10, duration: "1◈" }
  # The two Day clauses. A phase-level predicate, tested against the CASTER's
  # own options -- `runPhases` builds `selfOptions` from the caster -- which is
  # right: the sheet asks whether HE used it during a Day Round.
  - kind: applyEffects
    target: reuse
    predicate: ["self:phase:day"]
    effects:
      - { id: critUp, magnitude: 10, duration: "⅓◈" }
      - { id: critDmUp, magnitude: 30, duration: "1◈" }
  - kind: cooldown
```

Add the ref to his `abilities`.

- [ ] **Step 7: Rebuild and test both phases live**

```bash
npm run validate:content && node tools/fgt-rebuild.mjs
node tools/fgt-eval.mjs "await game.combat.update({'system.phase':'day'}); return 'day'"
```

Use the Skill with an ally within 2 panels; confirm on the ally's sheet that **three** effects landed. Set the phase to `night`, wait out the cooldown (or clear it), use it again, and confirm **only** `atkUp` lands.

- [ ] **Step 8: Document and commit**

Note the new option in `docs/24-rules-engine.md`'s option vocabulary and in `docs/19-environment.md` §19.2.

---

### Task 4: Imperial Privilege

**Files:**
- Create: `packs/_source/abilities/ozymandias-imperial-privilege.yml`

**Interfaces:** consumes only built machinery (`percentOfMax` heal, per-effect `chance`).

- [ ] **Step 1: Author it**

```yaml
# > "(Active) 1. Restores his Health by 30% of its maximum value. 2. 60% chance
# > of applying Atk Up for 1◈ Turns, damage dealt +40%; if NP, 20%. 3. 60%
# > chance of applying Def Up for 1◈ Turns, damage received -40%; if NP, 20%.
# > Cooldown: 4◈ Turns."
#
# The two chances are INDEPENDENT -- each entry rolls separately
# (`effect-applier.mjs`), so 36% of uses give both and 16% give neither.
schema: 1
id: ozymandias-imperial-privilege
name: "Imperial Privilege"
rank: A
kind: skill
cooldown: { max: "4◈" }
timing: { window: ownTurn }
description: |
  (Active) Restores his Health by 30% of its maximum value.
  60% chance of @effect[atkUp]{Atk Up} for 1◈ Turns: damage dealt +40%; if NP, 20%.
  60% chance of @effect[defUp]{Def Up} for 1◈ Turns: damage received -40%; if NP, 20%.
phases:
  - kind: heal
    target: self
    percentOfMax: 30
  - kind: applyEffects
    target: self
    effects:
      - { id: atkUp, magnitude: 40, npMagnitude: 20, duration: "1◈", chance: 60 }
      - { id: defUp, magnitude: 40, npMagnitude: 20, duration: "1◈", chance: 60 }
  - kind: cooldown
```

Add the ref to his `abilities`.

- [ ] **Step 2: Rebuild, damage him, and use it**

Reduce him to half, use the Skill, and confirm on the sheet: Health rises by exactly 30% of **maximum** (300), and zero, one or both buffs appear. Repeat three times to see the chance vary.

- [ ] **Step 3: Commit**

---

### Task 5: Protection from Ra — Buff ChUp, and a cooldown reduction that reaches allies

**Files:**
- Create: `packs/_source/effects/buff-ch-up.yml`
- Modify: `module/engine/effect-applier.mjs` (`chanceContribution`, the `friendly` branch)
- Modify: `module/engine/skill-use.mjs` (`CASTER_PHASES`, `cooldownChanges`)
- Create: `packs/_source/abilities/ozymandias-protection-from-ra.yml`
- Test: `test/unit/effect-applier.test.mjs`, `test/unit/skill-use.test.mjs` (or the nearest existing)

**Interfaces:**
- Produces: `cooldownChanges(phase, doc, board, self)` writes to a **target** actor; `chanceContribution` accepts buffs when the contribution says so.

- [ ] **Step 1: Write the failing tests**

```js
describe("buff chance", () => {
  it("lets a contribution raise the chance of a BUFF landing", () => {
    // `chanceContribution` refused every non-debuff, with the comment
    // "nothing anywhere modifies how likely a buff is to land". Protection
    // from Ra is the first thing that does.
    const unit = { applicationChances: [{ direction: "outgoing", value: 40, polarity: "buff" }] };
    expect(inflictBonusOf(unit, { id: "atkUp", polarity: "buff", severity: "normal" })).toBe(40);
  });

  it("still refuses a generic debuff contribution against a buff", () => {
    // Serenity's Silent Dance must not raise her own self-buffs' chance, which
    // is the defect the filter was added for.
    const unit = { applicationChances: [{ direction: "outgoing", value: 40 }] };
    expect(inflictBonusOf(unit, { id: "atkUp", polarity: "buff", severity: "normal" })).toBe(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Let a contribution opt in to buffs**

In `module/engine/effect-applier.mjs#chanceContribution`, replace the polarity filter:

```js
    // DEBUFFS, unless the contribution NAMES a polarity. Every clause of this
    // shape in the corpus is about a debuff -- and the unqualified default must
    // stay debuff-only, because Serenity's Silent Dance would otherwise raise
    // the application chance of her own self-buffs.
    //
    // `Buff ChUp` is the first that says otherwise, and it says so explicitly:
    // Protection from Ra is *"chance of applying buffs is increased by 40%"*.
    const wants = c.polarity ?? "debuff";
    if (def.polarity !== wants) continue;
```

- [ ] **Step 4: Let a friendly application keep an OUTGOING bonus**

Still in `effect-applier.mjs`, the `friendly` branch zeroes `inflictBonus`. Narrow it:

```js
    // `friendly` skips the target's RESISTANCE (§11.2), which is what the
    // clause is about. It must not also discard the applier's own outgoing
    // bonus: Buff ChUp is applied by an ally, to an ally, and zeroing it here
    // would make the only buff-chance effect in the game inert in exactly the
    // case it is for.
    inflictBonus: bypassChanceModifiers ? 0 : (ctx.inflictBonus ?? 0),
```

- [ ] **Step 5: Author the effect**

Create `packs/_source/effects/buff-ch-up.yml`:

```yaml
# docs/A-effect-catalogue.md:120 — "Buff ChUp | Chance of applying buffs to
# others +X%." Catalogued from the beginning with no document and no reader;
# Ozymandias's Protection from Ra is the first thing that applies it.
schema: 1
id: buffChUp
name: "Buff ChUp"
description: "The chance of buffs this Unit applies landing is increased by @magnitude%."
polarity: buff
volatility: nonVolatile
valence: supportive
stacking: magnitudeStacks
baseChance: 100
rules:
  - key: ApplicationChance
    direction: outgoing
    polarity: buff
    value: "@magnitude"
```

- [ ] **Step 6: Make the cooldown phase reach its targets**

In `module/engine/skill-use.mjs`, remove `"cooldown"` from `CASTER_PHASES` and record why:

```js
const CASTER_PHASES = new Set([
  "resource", "statChange", "removeEffect", "summon", "createField", "choose", "heal",
  "summonPlatform",
  // `cooldown` was here, and it made every cooldown change self-directed:
  // the phase never fanned out, and `cooldownChanges` wrote
  // `I.cooldown(doc.id, ...)` with `doc` always the caster. Protection from Ra
  // is *"Affects all allied Units within a 2 panel area ... Reduce their NP
  // Cooldown by ⅔◈ Turns"*, the first that names somebody else.
  "zone",
]);
```

Then in `cooldownChanges`, take the target actor rather than assuming the caster. Its signature already receives `doc`; the fan-out passes the resolved unit, so the only change is at its call site — confirm `runPhases` hands the per-target actor in, and add a `target: self` escape so Medea's and Karna's existing self-directed changes keep working:

```js
function cooldownChanges(phase, doc, board = null, self = null) {
  // `target: self` keeps a self-directed change on the CASTER even now the
  // phase fans out. Medea's High-Speed Divine Words resets "all of Medea's
  // Spells" and must not reset an ally's.
  const subject = phase.target === "self" ? (self ?? doc) : doc;
  ...
      out.push(I.cooldown(subject.id, item.id, change.set, "set"));
```

and replace the two `doc.id` writes with `subject.id`, and `selectAbilities(change, doc, self)` with `selectAbilities(change, subject, self)`.

- [ ] **Step 7: Author the Skill**

```yaml
# > "(Active) Affects all allied Units within a 2 panel area of Ozymandias.
# > Reduce their NP Cooldown by ⅔◈ Turns; then apply Buff ChUp for 1◈ Turns,
# > chance of applying buffs is increased by 40%. Cooldown: 4◈-⅓◈ Turns."
schema: 1
id: ozymandias-protection-from-ra
name: "Protection from Ra"
rank: "A+"
kind: skill
cooldown: { max: "4◈-⅓◈" }
timing: { window: ownTurn }
description: |
  (Active) Affects all allied Units within a 2 panel area. Reduces their Noble Phantasm Cooldown by
  ⅔◈ Turns, then applies @effect[buffChUp]{Buff ChUp} for 1◈ Turns: the chance of applying buffs is
  increased by 40%.
targeting:
  anchor: { kind: self }
  shape: { kind: square, size: 5 }
  selection: { relations: [ally, self], chooser: all, includeSelf: true }
phases:
  - kind: cooldown
    changes:
      - { category: noblePhantasm, ticks: "⅔◈", direction: down }
  - kind: applyEffects
    target: reuse
    effects:
      - { id: buffChUp, magnitude: 40, duration: "1◈" }
  - kind: cooldown
    target: self
    changes:
      - { self: true, set: null }
```

If the trailing self-cooldown entry is awkward, rely on the ability's own `cooldown.max` instead and drop that phase — check how `medea-golden-fleece.yml` ends.

- [ ] **Step 8: Rebuild and verify live**

Put an ally with a Noble Phantasm on cooldown within 2 panels. Use Protection from Ra and confirm on the **ally's** sheet that the NP cooldown fell by ⅔◈ and Buff ChUp is present. Then have that ally apply a buff and confirm its chance is raised.

- [ ] **Step 9: Document and commit**

Record in `docs/A-effect-catalogue.md` that `Buff ChUp` now exists, and in `docs/15-abilities.md` that a `cooldown` phase reaches its targets.

---

### Task 6: The two summon-budget defects, and the three Sphinxes

**Files:**
- Modify: `module/rules/snapshot.mjs` (project `actsOncePerTurn`, `countsTowardBudget`)
- Modify: `module/rules/budget.mjs` (read `countsTowardBudget`)
- Modify: `module/rules/elements.mjs` (`TargetabilityModifier` gains `scope`)
- Modify: `module/rules/auras.mjs` (honour the scope)
- Create: `packs/_source/summons/sphinx.yml`, `sphinx-queen.yml`, `sphinx-wehem-mesut.yml`
- Test: `test/unit/budget.test.mjs`, `test/unit/targeting.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
describe("summons and the Unit budget", () => {
  it("does not spend a pool slot for a summon that says it does not", () => {
    // `countsTowardBudget` was declared, authored on Bašmu and stamped by the
    // summoner — and `budget.mjs` never read it. Every summon in the game has
    // been spending its controller's Unit budget since summons shipped.
    const budget = { servantMoves: 0, servantAttacks: 0, masterMoves: 0 };
    const summon = { kind: "summon", countsTowardBudget: false, turnState: {} };
    expect(canConsume(budget, summon, "move").ok).toBe(true);
  });

  it("still limits it to one action per Turn", () => {
    const summon = { kind: "summon", countsTowardBudget: false, actsOncePerTurn: true,
      turnState: { moved: true } };
    expect(canConsume({ servantMoves: 4 }, summon, "move").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Project both fields**

In `module/rules/snapshot.mjs`, beside `summonerId`:

```js
    // Both halves of a summon's action economy, neither of which was ever
    // projected. `budget.mjs:203` tests `actsOncePerTurn` on the BOARD unit, so
    // it read `undefined` for every summon in every world and the once-per-Turn
    // limit has never applied. `countsTowardBudget` had no reader at all.
    actsOncePerTurn: Boolean(sys.actsOncePerTurn),
    countsTowardBudget: sys.countsTowardBudget !== false,
```

- [ ] **Step 4: Read `countsTowardBudget`**

In `module/rules/budget.mjs#canConsume`, extend the platform branch:

```js
  // A platform, or a summon its own sheet exempts. Bašmu: *"do not count
  // towards the number of Units who Move/Attack in a Turn. A Bašmu can only
  // Move/Attack once per Turn."* Two clauses, and the second is the reason
  // this is not simply `free: true` -- exempt from the POOL, still capped
  // per Unit.
  if (unit?.kind === "platform" || unit?.actsOncePerTurn || unit?.countsTowardBudget === false) {
```

- [ ] **Step 5: Narrow `TargetabilityModifier` (R3)**

In `module/rules/elements.mjs`:

```js
  TargetabilityModifier(el, { source, out }) {
    out.auras.push({
      key: "untargetable", radius: el.radius ?? 1,
      relations: el.relations ?? ["ally", "self"],
      // WHO exactly, when the relation is too wide. Bašmu shields *"Semiramis
      // or her allied Units"* and `relations` says that exactly; Ozymandias's
      // Sphinxes shield *"Ozymandias or his Master"* and nothing narrower than
      // "ally" existed. Named roles rather than ids, because content cannot
      // know a document id.
      scope: el.scope ?? null,
      value: true, stacking: "noneRefresh", source,
    });
  },
```

In `module/rules/auras.mjs`, where an `untargetable` aura is expanded onto recipients, filter by scope:

```js
      // `scope: [summoner, summonerMaster]` -- the recipient must BE one of
      // those, relative to the aura's own source.
      if (aura.scope && !inScope(aura.scope, source, recipient, board)) continue;
```

with a small helper beside it:

```js
/**
 * Is the recipient one of the roles this aura names, relative to its source?
 *
 * @param {string[]} scope
 * @param {object} source the unit the aura radiates from
 * @param {object} recipient
 * @param {object} board
 * @returns {boolean}
 */
function inScope(scope, source, recipient, board) {
  const summonerId = source?.summonerId ?? null;
  const summoner = summonerId ? (board?.units ?? []).find((u) => u.id === summonerId) : null;
  for (const role of scope) {
    if (role === "summoner" && recipient.id === summonerId) return true;
    if (role === "summonerMaster" && summoner && recipient.id === summoner.masterId) return true;
    if (role === "self" && recipient.id === source?.id) return true;
  }
  return false;
}
```

- [ ] **Step 6: Author the three Sphinxes**

`packs/_source/summons/sphinx.yml`:

```yaml
# > "Sphinx — Health 1000, Agility 14, Luck: Same as Ozymandias', MOV 5,
# > Range 1 panel 1 target, Base Attack (STR) 125, Attributes Male [Earth]
# > Divinity, Detect 2 panels."
schema: 1
id: sphinx
name: "Sphinx"
type: summon
attributes: [summon, male, earth, divine]
baseHealth: 1000
agility: 14
# "Same as Ozymandias'" — inherited at summon time, the shape kagome-beast uses.
inherit:
  luck: { from: summoner }
mov: 5
range: { panels: 1, targets: 1 }
baseAttack: { str: 125, mag: 0 }
normalAttack: { mode: fixed, component: str }
detect: 2
# "The Sphinxes do not count towards the number of Units that Move/Attack in a
# Turn. The same Sphinx can only Move/Attack once per Turn."
countsTowardBudget: false
actsOncePerTurn: true
passiveRules:
  # "Enemy Units cannot Attack Ozymandias or his Master if any Sphinxes are next
  # to them" (R3: next to Ozymandias or his Master). Bašmu's element, scoped to
  # two units instead of every ally.
  - key: TargetabilityModifier
    radius: 1
    relations: [ally, self]
    scope: [summoner, summonerMaster]
```

`sphinx-queen.yml` — the same with `id: sphinx-queen`, `name: "Sphinx Queen"`, `attributes: [summon, female, earth, divine]`, `baseHealth: 1500`, `agility: 16`, `mov: 6`, `baseAttack: { str: 150, mag: 0 }`.

`sphinx-wehem-mesut.yml` — `id: sphinx-wehem-mesut`, `name: "Sphinx Wehem-Mesut"`, `attributes: [summon, male, sky, divine, large]`, `baseHealth: 2000`, `agility: 12`, `mov: 4`, `range: { panels: 3, targets: 1 }`, `detect: 3`, and:

```yaml
# > "Base Attack (STR/MAG): 200 (At a Range of 2 or higher, Attack deals MAG
# > damage)" — EMIYA's `rangeBanded`, which exists and is the only mode that
# > can say "this attack changes component with distance".
baseAttack: { str: 200, mag: 200 }
normalAttack:
  mode: rangeBanded
  component: str
  bands:
    - from: 2
      component: mag
```

- [ ] **Step 7: Run the tests, rebuild, and place one live**

Summon a Sphinx beside Ozymandias, and confirm: an enemy cannot target Ozymandias or his Master while it stands adjacent to them; an enemy **can** target another ally; the Sphinx moves and attacks without spending the faction's Unit budget; and it refuses a second action in one Turn.

- [ ] **Step 8: Document and commit**

Record both defects in `docs/18-action-economy.md` and `docs/45`.

---

### Task 7: The Complex opens — geometry, the clip, and the cost

**Files:**
- Modify: `module/rules/bounded-fields.mjs` (`panelsOf` — `cannotIntersect`)
- Modify: `module/engine/board.mjs` (`boundedFieldsOf` — project `onEnd`)
- Create: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml` (first cut: geometry, cost, gate, deactivation)
- Test: `test/unit/bounded-fields.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
describe("cannotIntersect", () => {
  const zones = { r: { faction: "red", panels: [{ i: 0, j: 0 }, { i: 0, j: 1 }] } };

  it("clips the panels that fall in an enemy Home Base", () => {
    // R2: the Complex "cannot intersect the Home Base of enemy Players", and
    // the ruling is to CLIP rather than refuse. Free, because `shapeOf`
    // already emits a grid shape rather than a bounding rectangle.
    const field = { ownerFaction: "blue",
      geometry: { kind: "fixedArea", anchor: { i: 0, j: 0 }, shape: { size: 3 },
        cannotIntersect: "enemyHomeBase" } };
    const panels = panelsOf(field, { zones, alliances: {} });
    expect(panels.some((p) => p.i === 0 && p.j === 0)).toBe(false);
    expect(panels.some((p) => p.i === 1 && p.j === 1)).toBe(true);
  });

  it("leaves an ALLIED base alone — only enemy bases are excluded", () => {
    const field = { ownerFaction: "red",
      geometry: { kind: "fixedArea", anchor: { i: 0, j: 0 }, shape: { size: 3 },
        cannotIntersect: "enemyHomeBase" } };
    expect(panelsOf(field, { zones, alliances: {} }).some((p) => p.i === 0 && p.j === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Clip in `panelsOf`**

In `module/rules/bounded-fields.mjs`, wrap the `fixedArea` return:

```js
    case "fixedArea":
      return clip(square(geometry.anchor, geometry.shape?.size ?? 1), field, board);
```

and add the helper:

```js
/**
 * Remove the panels a field is forbidden to cover.
 *
 * > *"The Complex cannot intersect the Home Base of enemy Players."*
 *
 * CLIPPED rather than refused (the author's ruling): the Complex opens as its
 * full square minus whatever falls inside an enemy base, so casting near one
 * gives a smaller Complex rather than nothing. Free, because a field's Region
 * is a grid shape and has never been a bounding rectangle.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @param {object} field
 * @param {object} board
 * @returns {Array<{i: number, j: number}>}
 */
function clip(panels, field, board) {
  if (field.geometry?.cannotIntersect !== "enemyHomeBase") return panels;

  const owner = field.ownerFaction ?? null;
  const allied = new Set(board?.alliances?.[owner] ?? (owner ? [owner] : []));
  const forbidden = new Set();
  for (const zone of Object.values(board?.zones ?? {})) {
    if (zone.faction && allied.has(zone.faction)) continue;
    for (const p of zone.panels ?? []) forbidden.add(`${p.i},${p.j}`);
  }
  return panels.filter((p) => !forbidden.has(`${p.i},${p.j}`));
}
```

- [ ] **Step 4: Project `onEnd`**

In `module/engine/board.mjs#boundedFieldsOf`, beside `vulnerabilities`:

```js
        // Written by `openField` and read by `deactivateField`, and NEVER
        // projected -- so every field's on-end actions were silently empty.
        onEnd: sys.onEnd ?? [],
```

- [ ] **Step 5: Author the field's first cut**

```yaml
# > "Used during your Turn. Can only be used after 7 full Rounds have passed.
# > First, the Master's Health is reduced by 50% of its maximum value (cannot be
# > used if his Master's Health is less than that), then the NP affects an 11x11
# > panel area around Ozymandias."
schema: 1
id: ozymandias-ramesseum-tentyris
name: "Ramesseum Tentyris: The Shining Great Temple Complex"
isNP: true
rank: EX
npTags: [antiFortress, fortress, antiUnit]
kind: noblePhantasm
slug: ramesseumTentyris
# Ch. 44 §44.6: a per-ability gate composing with the global one by max().
# "After 7 full Rounds have passed" is Round 8.
npGateRound: 8
timing: { window: ownTurn }
cooldown: { max: "8◈", countFrom: deactivation }
requirements:
  - { kind: masterHealthAbove, amount: 0, fraction: 0.5 }
description: |
  (Active) Usable after 7 full Rounds. The Master's Health is reduced by 50% of its maximum value,
  then an 11x11 panel area around Ozymandias becomes the Complex.
additionalCosts:
  - id: ramesseumMasterHealth
    kind: masterHealthFraction
    fraction: 0.5
field:
  geometry:
    kind: fixedArea
    shape: { kind: square, size: 11 }
    # R2. The Complex is clipped where it would cover an enemy Home Base.
    cannotIntersect: enemyHomeBase
  # "Remains constantly Active" — no duration; it ends only by its four paths.
  duration: null
  deactivation: { byOwner: true, window: any }
  membership: { enemyEntry: free, enemyExit: free }
  isolation:
    outsideCanTargetInside: true
    insideCanTargetOutside: true
    outsideCanApplyEffectsInside: true
    visibilityAcrossBoundary: full
  vulnerabilities:
    - { kind: ownerDefeat, result: end }
phases:
  - kind: createField
    target: self
```

Check `additionalCosts`'s `kind` against the existing vocabulary; if `masterHealthFraction` does not exist, add it beside `masterHealth` in `rules/costs.mjs` with a test.

- [ ] **Step 6: Rebuild and open it beside an enemy base**

Set the Round past 8, stand Ozymandias three panels from an enemy Home Base, activate. Confirm: his Master loses exactly 50% of max; `board.fields` has one entry; and its panel count is **fewer than 121** with none inside the enemy base. Screenshot the canvas and **look at the clipped shape**.

- [ ] **Step 7: Document and commit**

---

### Task 8: The Complex's interior

**Files:**
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`

**Interfaces:** consumes only built elements (`DamageModifier`, `CheckModifier`, `Suppress`, `exemptIf`).

- [ ] **Step 1: Add the interior block**

```yaml
  interior:
    # 2. Divine Protection. "All damage received by Ozymandias and his allied
    # Units while within the Complex is reduced by 50% including NP."
    # POSITIVE on the `taken` side is a REDUCTION -- Doomsday Come's file
    # records that a -50 here would have increased the damage.
    - key: DamageModifier
      modifierKey: defUp
      direction: taken
      value: 50
      npValue: 50
      relations: [self, ally]

    # 3a. "All damage dealt is reduced by 20% including Noble Phantasm."
    - key: DamageModifier
      modifierKey: atkDwn
      direction: dealt
      value: 20
      npValue: 20
      relations: [enemy]

    # 3b. "All damage received is increased by 20%."
    - key: DamageModifier
      modifierKey: defDwn
      direction: taken
      value: 20
      npValue: 20
      relations: [enemy]

    # 3c. "When performing Evade and Luck Check Rolls, the number rolled is
    # increased by 2." A POSITIVE value makes the check harder, which is the
    # sheet's phrasing (`rules/checks.mjs`).
    - key: CheckModifier
      check: evade
      direction: outgoing
      value: 2
      relations: [enemy]
    - key: CheckModifier
      check: luck
      direction: outgoing
      value: 2
      relations: [enemy]

    # 4. God's Curse. "Servants cannot use their Noble Phantasms. Units with
    # Divinity equal to Ozymandias or higher ignore this effect."
    #
    # A standing SUPPRESSION rather than an applied NP Seal, which is what makes
    # it unremovable for free: it is present exactly while the Unit stands
    # inside and there is nothing for Dispel to find.
    #
    # "Does not affect Attacks/Skills/Spells that are only *Categorized as*
    # Noble Phantasms" is free too -- `abilityKind` returns "np" only for a real
    # Noble Phantasm. Recorded in the spec §7 as a dependency: if NP Seal's
    # general handling of `categorizedAsNP` is ever fixed, he needs an opt-out.
    #
    # `minRank: B` is literal, because that is his Divinity and nothing in the
    # corpus can change a Servant's Divinity rank.
    - key: Suppress
      scope: npSeal
      relations: [enemy]
      kinds: [servant]
      exemptIf: { categorizedAs: divinity, minRank: B }
```

- [ ] **Step 2: Rebuild and exercise every clause live**

Inside the Complex, with an enemy Servant and an ally:
- the ally takes half damage from a hit that would otherwise land in full;
- the enemy's damage output drops 20% and its damage taken rises 20% — read both off the chat card's contribution list;
- the enemy's Evade and Luck rolls each show a `+2`;
- the enemy Servant's Noble Phantasm is **refused**, with the reason naming the seal;
- a unit carrying Divinity B or higher may still use one;
- something merely `categorizedAsNP` (a Master's Magic Crest) is unaffected.

- [ ] **Step 3: Document and commit**

---

### Task 9: The Curse that leaves when he does

**Files:**
- Modify: `module/data/misc.mjs` (`EffectData.sourceFieldId`)
- Modify: `module/engine/intents.mjs` / `module/engine/io.mjs` (carry it through `applyEffect`)
- Modify: `module/rules/bounded-fields.mjs` (`annotateFields` — the sweep)
- Modify: `module/engine/fields.mjs` (an entry timestamp for the Normal Human clause)
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`
- Test: `test/unit/bounded-fields.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
describe("effects tied to a field", () => {
  it("strips an effect whose field the bearer has left", () => {
    // "It is automatically removed after leaving the Complex." Swept on
    // MEMBERSHIP rather than fired on an exit event: a unit teleported out,
    // knocked back out, or standing still while the field closes under it
    // would otherwise keep the Curse for ever.
    const unit = { id: "u", panel: { i: 9, j: 9 },
      effectInstances: [{ defId: "curse", sourceFieldId: "tentyris" }] };
    annotateFields([unit], { fields: [{ id: "tentyris", geometry: { kind: "fixedArea",
      anchor: { i: 0, j: 0 }, shape: { size: 3 } } }] });
    expect(unit.effectInstances).toHaveLength(0);
  });

  it("keeps it while the bearer is still inside", () => {
    const unit = { id: "u", panel: { i: 0, j: 0 },
      effectInstances: [{ defId: "curse", sourceFieldId: "tentyris" }] };
    annotateFields([unit], { fields: [{ id: "tentyris", geometry: { kind: "fixedArea",
      anchor: { i: 0, j: 0 }, shape: { size: 3 } } }] });
    expect(unit.effectInstances).toHaveLength(1);
  });

  it("strips it when the field no longer exists at all", () => {
    const unit = { id: "u", panel: { i: 0, j: 0 },
      effectInstances: [{ defId: "curse", sourceFieldId: "gone" }] };
    annotateFields([unit], { fields: [] });
    expect(unit.effectInstances).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Declare the field**

In `module/data/misc.mjs`'s `EffectData`, beside `sourceUnitId`:

```js
      // The bounded field this instance belongs to, if any. Ozymandias's
      // Complex is *"permanent Stage 1 Curse as long as they are within ...
      // automatically removed after leaving"*, and the removal is swept on
      // MEMBERSHIP rather than fired on an exit event -- a unit teleported out,
      // knocked back out, or standing still while the field closes under it
      // would otherwise keep it for ever.
      sourceFieldId: new fields.StringField({ required: false, nullable: true, initial: null }),
```

Carry it through the `applyEffect` intent and `io`'s writer the same way `sourceUnitId` is.

- [ ] **Step 4: Sweep in `annotateFields`**

At the end of `annotateFields`'s per-unit loop, after `u.fields` is settled:

```js
    // An effect that belongs to a field the bearer is no longer inside -- or to
    // one that no longer exists -- goes now. Membership is the test, so
    // departure by any route is covered.
    const instances = u.effectInstances ?? [];
    const kept = instances.filter((e) => !e?.sourceFieldId || u.fields.includes(e.sourceFieldId));
    if (kept.length !== instances.length) {
      u.effectInstances = kept;
      u.effects = kept.map((e) => e.defId ?? e);
    }
```

The snapshot sweep makes it invisible immediately; add the matching **document** deletion in `engine/fields.mjs#endField` and in the movement hook so storage does not accumulate.

- [ ] **Step 5: Record when a unit entered, for the Normal Human clause**

> *"Normal Human: Dies at the end of the Turn **after** entering the Complex."*

In `engine/fields.mjs`, on the `contact` path, stamp the tick:

```js
  // "…at the end of the Turn AFTER entering", which needs to know WHEN. No
  // field has ever recorded a per-unit entry time; `turnEnd` alone fires every
  // Turn and would kill on the first.
  await behaviorFor(field.fieldId)?.update({
    [`system.state.enteredAt.${unitId}`]: game.combat?.system?.globalTurn ?? 0,
  });
```

and gate the `turnEnd` `Defeat` action on `spec.afterTurnsInside`:

```js
      // A tier that waits. `enteredAt` is the field's own record; one Turn
      // after it is the sheet's "the Turn after entering".
      if (spec.afterTurnsInside) {
        const since = (game.combat?.system?.globalTurn ?? 0) - (field.state?.enteredAt?.[unit.id] ?? 0);
        if (since < spec.afterTurnsInside) continue;
      }
```

- [ ] **Step 6: Author both clauses**

```yaml
  interiorEvents:
    # 3d. The Curse, applied on contact and swept when they leave.
    - event: contact
      relations: [enemy]
      onFail:
        - key: ApplyEffect
          effect: { id: curse, stage: 1 }
          tiedToField: true

    # 3. Divine Curse, Normal Human tier: "Dies at the end of the Turn after
    # entering the Complex."
    - event: turnEnd
      relations: [neutral, ally, enemy, self]
      kinds: [civilian]
      afterTurnsInside: 1
      onFail:
        - { key: Defeat, cause: divineCurse, creditOwner: true }
```

`tiedToField: true` is what makes the applier stamp `sourceFieldId`.

- [ ] **Step 7: Rebuild and verify live**

Walk an enemy in — Curse Stage 1 appears. Walk it out — the Curse is gone. Teleport one out (via a Command Spell or a direct token move) — also gone. Close the field with someone inside — gone. Walk a Civilian in and end two Turns: it survives the first, dies at the end of the second.

- [ ] **Step 8: Document and commit**

---

### Task 10: A second Home Base, frozen Sustainability, and ZON ignored

**Files:**
- Modify: `module/rules/environment.mjs` (`ownBaseOf` — third branch)
- Modify: `module/rules/snapshot.mjs` (pass order)
- Modify: `module/rules/damage/pipeline.mjs` (`stage9ZonPenalty`)
- Modify: `module/engine/scheduler.mjs` (`checkRemovals`)
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`
- Test: `test/unit/environment.test.mjs`, `test/unit/scheduler.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
describe("a field that is a Home Base", () => {
  const board = () => ({
    zones: {},
    fields: [{ id: "tentyris", ownerId: "ozy", ownerMasterId: "m",
      countsAsHomeBase: { units: ["owner", "ownerMaster"] },
      geometry: { kind: "fixedArea", anchor: { i: 5, j: 5 }, shape: { size: 3 } } }],
    units: [],
  });

  it("is a Home Base for its owner", () => {
    expect(ownBaseOf({ id: "ozy", panel: { i: 5, j: 5 } }, board())).not.toBeNull();
  });

  it("...and for his Master", () => {
    expect(ownBaseOf({ id: "m", panel: { i: 5, j: 5 } }, board())).not.toBeNull();
  });

  it("but not for a mere ally — the clause names two units, not a faction", () => {
    // "The Complex functions as a second Home Base for Ozymandias and his
    // Master ONLY." Narrower than any faction, and narrower than the existing
    // reader could say: Semiramis's platform version is faction-scoped.
    expect(ownBaseOf({ id: "ally", faction: "red", panel: { i: 5, j: 5 } }, board())).toBeNull();
  });
});
```

- [ ] **Step 2: Add the third branch**

In `module/rules/environment.mjs#ownBaseOf`, before the final `return null`:

```js
  // ...and a FIELD that is one.
  //
  // > *"The Complex functions as a second Home Base for Ozymandias and his
  // > Master only."*
  //
  // UNIT-scoped, not faction-scoped, which is the difference from the platform
  // branch above: an allied Servant sheltering in the Complex gets none of the
  // five home-base effects, because the sheet says "only".
  for (const field of board?.fields ?? []) {
    const spec = field.countsAsHomeBase;
    if (!spec || !(field.panels ?? []).some((p) => chebyshev(p, unit.panel) === 0)) continue;
    const roles = spec.units ?? ["owner"];
    const isOwner = roles.includes("owner") && unit?.id === field.ownerId;
    const isMaster = roles.includes("ownerMaster") && unit?.id === field.ownerMasterId;
    if (isOwner || isMaster) {
      return { faction: unit.faction, panels: field.panels ?? [], secondary: true, fieldId: field.id };
    }
  }
  return null;
```

Project `countsAsHomeBase` in `boundedFieldsOf` beside `onEnd`.

- [ ] **Step 3: Fix the pass order**

`annotateFields` runs at `snapshot.mjs:663` and `annotateEnvironment` at `:656` — so a field-derived home base would be computed after the environment pass that reads it. Move `annotateFields` **above** `annotateEnvironment`, and record why:

```js
  // BEFORE `annotateEnvironment`, because one of the Home Bases is a FIELD:
  // *"The Complex functions as a second Home Base."* `ownBaseOf` reads
  // `board.fields` and each unit's membership, which this pass settles — run
  // the other way round it reads an empty list for everybody and the clause is
  // silently dead. The same ordering argument `annotatePlatforms` already
  // carries two lines below, for the same reason.
  annotateFields(units, board);
  annotateEnvironment(units, board);
```

Check that nothing `annotateFields` needs is produced by `annotateEnvironment`; `annotateControl` runs earlier and is what it depends on.

- [ ] **Step 4: The narrow ZON exemption**

> *"His Master's ZON is ignored when he Attacks (no damage reduction)."*

Not `zonExempt`, which would also lift the `requiresZon` gate his own Noble Phantasms honour. Gate the penalty instead, in `rules/damage/pipeline.mjs#stage9ZonPenalty`:

```js
function stage9ZonPenalty(s) {
  s.begin(9);
  // A field may waive the PENALTY without waiving the ZON requirement itself.
  // Ozymandias's clause is *"ZON is ignored when he Attacks (no damage
  // reduction)"* -- about damage, not about whether an NP may be declared, and
  // `zonExempt` is the blunt instrument that would lift both.
  const waived = (s.ctx.attacker?.suppressions ?? []).some((x) => x.scope === "zonPenalty");
  if (s.ctx.attacker?.outsideZon && !waived) {
    ...
```

Authored as `- { key: Suppress, scope: zonPenalty, relations: [self] }` in the interior.

- [ ] **Step 5: Frozen Sustainability**

In `module/engine/scheduler.mjs#checkRemovals`:

```js
    if (u.sustainability === null || u.sustainability === undefined) continue;
    // *"Ozymandias' Sustainability does not decrease while he is within the
    // Complex."* A standing suppression, like the ZON waiver beside it -- the
    // clock is paused rather than refunded, so leaving resumes it where it was
    // rather than showing as churn every Turn he stands inside.
    if ((u.suppressions ?? []).some((x) => x.scope === "sustainabilityDecay")) continue;
```

Authored as `- { key: Suppress, scope: sustainabilityDecay, relations: [self] }`.

- [ ] **Step 6: Author all three clauses, rebuild, verify live**

Add to the field's `interior`, plus `countsAsHomeBase: { units: [owner, ownerMaster] }` beside `geometry`.

Live: with the Complex open away from his ground base, confirm `inHomeBase: true` for Ozymandias and his Master and `false` for an ally standing beside them; make him a Free Servant and end two Turns without his Sustainability dropping; and attack from outside his Master's ZON and confirm the chat card shows **no** `zonPenalty` line while an NP still refuses if he is outside ZON.

- [ ] **Step 7: Document and commit**

---

### Task 11: Revival inside the Complex

**Files:**
- Modify: `module/rules/bounded-fields.mjs` (`annotateFields` merge list)
- Modify: `module/rules/elements.mjs` (`RevivalSource` takes `deferred`)
- Modify: `module/rules/revival.mjs` (`isAvailable` tests the predicate)
- Modify: `module/rules/items.mjs` (`fieldOpen` returns a boolean)
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`
- Test: `test/unit/revival.test.mjs`, `test/unit/items.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
describe("fieldOpen", () => {
  it("returns a BOOLEAN, so a closed field actually refuses", () => {
    // It returned `{ok:false, reason}` from a function consumed as a boolean —
    // and an object is truthy, so `fieldOpen` has always passed.
    expect(meetsRequirement({ kind: "fieldOpen", field: "nope" }, { board: { fields: [] } }))
      .toBe(false);
    expect(meetsRequirement({ kind: "fieldOpen", field: "x" }, { board: { fields: [{ id: "x" }] } }))
      .toBe(true);
  });
});

describe("a revival conditioned on where you died", () => {
  it("is unavailable when its predicate fails", () => {
    const unit = { id: "u", fields: [],
      revivals: [{ id: "r", priority: 100, percentOfMax: 20, predicate: ["self:inField:tentyris"] }] };
    expect(availableRevivals(unit)).toHaveLength(0);
  });

  it("is available inside the field", () => {
    const unit = { id: "u", fields: ["tentyris"],
      revivals: [{ id: "r", priority: 100, percentOfMax: 20, predicate: ["self:inField:tentyris"] }] };
    expect(availableRevivals(unit)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Fix `fieldOpen`**

```js
    case "fieldOpen":
      // A BOOLEAN. This returned `{ok:true}` / `{ok:false, reason}` from a
      // function whose every caller treats the result as a boolean -- and both
      // objects are truthy, so the gate has always passed. Doomsday Come's
      // drag-in was offered whether or not the area stood.
      return (board?.fields ?? []).some((f) => f.id === req.field);
```

- [ ] **Step 4: Carry the predicate onto a revival**

In `module/rules/elements.mjs`'s `RevivalSource` executor, take `deferred` and store it:

```js
  RevivalSource(el, { rank, source, ability, out, ctx, deferred = null }) {
    out.revivals.push({
      ...
      // A revival conditioned on something this pass cannot answer -- *"whenever
      // Ozymandias is defeated WHILE WITHIN the Complex"*. Field membership is a
      // board annotation, so the clause travels and `isAvailable` tests it.
      predicate: deferred ?? el.predicate ?? null,
```

and in `module/rules/revival.mjs#isAvailable`:

```js
  // A clause about where the bearer is standing, answered against the unit's
  // own options at the moment of defeat.
  if (source.predicate && !test(source.predicate, { options: rollOptionsFor({ attacker: unit }) })) {
    return false;
  }
```

- [ ] **Step 5: Merge `revivals` in `annotateFields`**

```js
    // An interior `RevivalSource` was collected by the executor and then
    // DROPPED -- this merge listed eight buckets and not this one, the same
    // defect the `checkModifiers` comment above records. Ozymandias's Divine
    // Protection is the first field to grant one.
    if (out.revivals.length > 0) u.revivals = [...(u.revivals ?? []), ...out.revivals];
```

- [ ] **Step 6: Author both revivals**

```yaml
    # 2. "Whenever Ozymandias is defeated while within the Complex, he is
    # revived with 20% of his Max Health. When any of the Sphinxes are defeated
    # within the Complex, it is revived with 10% of its Max Health."
    - key: RevivalSource
      id: divineProtection
      revivalPriority: 50
      percentOfMax: 20
      charges: null
      relations: [self]
    - key: RevivalSource
      id: divineProtectionSphinx
      revivalPriority: 50
      percentOfMax: 10
      charges: null
      relations: [ally]
      kinds: [summon]
```

- [ ] **Step 7: Rebuild and kill him inside**

Reduce Ozymandias to zero inside the Complex — he revives at 200 (20% of 1000). Kill a Sphinx inside — it revives at 10%. Kill him **outside** — he stays down.

- [ ] **Step 8: Document and commit**

---

### Task 12: The Sphinxes spawn with the Complex, and remember their Health

**Files:**
- Modify: `module/engine/fields.mjs` (`openField` — an `onOpen` summon list; `endField` — persist stats)
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`
- Test: `test/unit/bounded-fields.test.mjs`

- [ ] **Step 1: Spawn on open**

In `openField`, after the contact pass:

```js
  // *"When Ramesseum Tentyris is activated, three additional Units allied with
  // Ozymandias are spawned within the Complex."* A flat list on the field
  // itself: `SummonBound` is per-contacting-enemy (Kagome Kagome) and cannot
  // say "these three, when it opens".
  for (const entry of spec.onOpen ?? []) {
    if (entry.key !== "Summon") continue;
    const { placeSummons, freePanels } = await import("./summoning.mjs");
    const restored = actor.system?.fieldSummonStats?.[entry.contentId] ?? null;
    await placeSummons([entry.contentId], freePanels(self, entry.placement ?? { adjacentTo: "self" }, 1),
      actor, scene, {}, {
        boundToFieldId: field.fieldId,
        factionId: actor.system?.factionId ?? null,
        // *"...but with the same Stats as when they disappeared."*
        ...(restored ? { health: restored.health, agility: restored.agility } : {}),
      });
  }
```

- [ ] **Step 2: Remember them on close**

In `endField`, before deleting each bound summon:

```js
  for (const summon of game.actors?.filter?.((a) => a.system?.boundToFieldId === fieldId) ?? []) {
    // *"When Ramesseum Tentyris ends or is deactivated, all Sphinxes disappear
    // regardless of position. Then if reactivated, the Sphinxes respawn within
    // the Complex, but with the same Stats as when they disappeared."*
    //
    // Written on the OWNER, which is where the memory has to live: the field is
    // about to stop existing, and `summonAssignments` already sets the
    // precedent for a summon fact that outlives its area.
    const owner = game.actors.get(summon.system?.summonerId);
    if (owner && summon.system?.contentId) {
      await owner.update({
        [`system.fieldSummonStats.${summon.system.contentId}`]: {
          health: summon.system.health, agility: summon.system.agility,
        },
      });
    }
    ...
```

Declare `fieldSummonStats: new fields.ObjectField({ required: false, initial: () => ({}) })` on `ServantData`, and add it to `actorSystem()`'s allowlist only if it is ever authored (it is not — it is runtime state).

- [ ] **Step 3: Author the list**

```yaml
  onOpen:
    - { key: Summon, contentId: sphinx, placement: { adjacentTo: self } }
    - { key: Summon, contentId: sphinx-queen, placement: { adjacentTo: self } }
    - { key: Summon, contentId: sphinx-wehem-mesut, placement: { adjacentTo: self } }
```

- [ ] **Step 4: Rebuild and verify the round trip live**

Open the Complex — three Sphinxes appear inside. Damage the Queen to 900. Deactivate. Reactivate. The Queen comes back **at 900**, not 1500.

- [ ] **Step 5: Document and commit**

---

### Task 13: Breaking the Complex

**Files:**
- Modify: `module/engine/fields.mjs` (per-Round accumulator, reset)
- Modify: `module/engine/attack.mjs` (`closeFieldsPiercedBy` — emit `npUsed` and `damage`)
- Modify: `module/rules/bounded-fields.mjs` (`endPermanently`)
- Modify: `module/engine/scheduler-hooks.mjs` (reset at the Round boundary)
- Modify: `module/rules/ability-use.mjs` or `rules/costs.mjs` (enforce the lock-out)
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`
- Test: `test/unit/bounded-fields.test.mjs`

- [ ] **Step 1: Write the failing tests**

The two `tentyris` fixtures at `test/unit/bounded-fields.test.mjs:382-402` already exercise the pure predicate. Add the enforcement:

```js
describe("endPermanently", () => {
  it("locks the ability out for the rest of the game", () => {
    // `result: "endPermanently"` appeared nowhere outside this test file:
    // `attack.mjs` tested `=== "end"` and dropped everything else.
    expect(lockoutFor({ result: "endPermanently" })).toBe(true);
    expect(lockoutFor({ result: "end" })).toBe(false);
  });
});
```

- [ ] **Step 2: Accumulate per Round**

In `module/engine/fields.mjs`, a writer:

```js
/**
 * Tally an NP use or a chunk of damage against a field, for this Round.
 *
 * The window is a property of the MATCH, which is why the pure predicate takes
 * the count rather than keeping it: *"Two [Anti-Fortress] or higher Noble
 * Phantasms in the same Round … or more than 3000 damage in one Round."*
 *
 * Dotted writes, like `banished` -- `stampUpkeep`'s whole-object spread would
 * clobber a sibling key.
 *
 * @param {string} fieldId
 * @param {{npTags?: string[], damage?: number}} event
 * @returns {Promise<{nps: number, damage: number}>}
 */
export async function tallyAgainstField(fieldId, { npTags = [], damage = 0 } = {}) {
  const behavior = behaviorFor(fieldId);
  if (!behavior) return { nps: 0, damage: 0 };

  const round = game.combat?.round ?? 0;
  const window = behavior.system?.state?.window ?? {};
  // A window from an earlier Round is not this Round's. Compared rather than
  // cleared on a hook, for the reason every expiry in this system is absolute:
  // a reset that fails to fire would leave a stale count that eventually
  // crosses the threshold on its own.
  const fresh = window.round === round ? window : { round, nps: 0, damage: 0 };

  // Only an NP that MEETS the threshold is worth counting -- but the threshold
  // belongs to the vulnerability, not to the tally, so every NP is counted and
  // `vulnerabilityTriggered` does the comparison. Counting only qualifying ones
  // here would silently hard-code one field's tag into the accumulator.
  const next = {
    round,
    nps: fresh.nps + (npTags.length > 0 ? 1 : 0),
    damage: fresh.damage + Math.max(0, damage),
    // Kept so `vulnerabilityTriggered` can compare tags without re-reading the
    // attack: "two [Anti-Fortress] or higher" counts qualifying uses, and the
    // caller passes this Round's list back in.
    tags: [...(fresh.tags ?? []), ...(npTags.length > 0 ? [npTags] : [])],
  };
  await behavior.update({ "system.state.window": next });

  return {
    // How many of this Round's NPs met the tag threshold is answered by the
    // caller, which knows which vulnerability it is testing.
    nps: next.tags.length,
    damage: next.damage,
    tags: next.tags,
  };
}

/**
 * Clear every field's Round window.
 *
 * @returns {Promise<void>}
 */
export async function resetFieldWindows() {
  for (const field of currentBoard().fields ?? []) {
    await behaviorFor(field.id)?.update({ "system.state.window": { round: game.combat?.round ?? 0, nps: 0, damage: 0, tags: [] } });
  }
}
```

`closeFieldsPiercedBy` then counts the qualifying uses itself, because the tag
threshold is the vulnerability's rather than the accumulator's:

```js
    // How many of this Round's Noble Phantasms met THIS vulnerability's tag.
    const qualifying = (v) => tally.tags.filter((t) => meetsTagThreshold(t, v.tag)).length;
```

Reset in `scheduler-hooks.mjs#onRoundChange`, beside the Grail advance:

```js
  // The field vulnerability windows. "In the same Round" is a window, and a
  // counter nobody clears is a threshold every field eventually crosses.
  await resetFieldWindows();
```

- [ ] **Step 3: Emit both events**

Extend `closeFieldsPiercedBy` to tally and to honour `endPermanently`:

```js
    const tally = await tallyAgainstField(field.id, { npTags, damage: state.result?.total ?? 0 });

    for (const event of [
      { kind: "npUsedOn", npTags },
      { kind: "npUsed", npTags, countThisWindow: tally.nps },
      { kind: "damage", damageThisWindow: tally.damage },
    ]) {
      const hit = vulnerabilityTriggered(field, event);
      if (!hit.triggered) continue;
      if (hit.result === "endPermanently") await lockOutField(field, "vulnerability");
      await deactivateField(field.id, "vulnerability");
      break;
    }
```

`lockOutField` writes `system.expended` on the owning ability — and the enforcement is the other half:

- [ ] **Step 4: Enforce `expended`**

`expended` is written in two places and read only by `rules/reactions.mjs`. Add it to the ordinary use gate in `rules/costs.mjs#canAfford` (or `ability-use.mjs`'s validator):

```js
  // Spent for the rest of the game. `expended` has been written since NP
  // choice existed and read only by the reaction path, so the ordinary
  // `canUseAbility` route never refused one.
  if (ability?.expended) return { ok: false, reason: "expended", cost };
```

and project `expended` onto the ability list in `snapshot.mjs`.

- [ ] **Step 5: Author both vulnerabilities**

```yaml
  vulnerabilities:
    - { kind: ownerDefeat, result: end }
    # "It is Attacked with 2 [Anti-Fortress] or higher Noble Phantasms in the
    # same Round from outside, or they are used by enemy Units within the
    # Complex" — `closeFieldsPiercedBy` already reads "used on or within".
    - { kind: npCount, tag: antiFortress, threshold: 2, window: round, result: endPermanently }
    # "…or would receive more than 3000 damage on the same round."
    - { kind: damageThreshold, threshold: 3000, window: round, result: endPermanently }
```

- [ ] **Step 6: Rebuild and break it live**

Fire two `[Anti-Fortress]` NPs at the Complex in one Round — Quetzalcoatl's **Xiuhcoatl** is one (`npTags: [antiUnit, antiFortress]`). Confirm the Complex closes and that a second activation is **refused** with the reason naming it spent. In a fresh match, deal 3001 damage inside in one Round and confirm the same.

Then confirm the reverse: one `[Anti-Fortress]` NP in a Round does **not** break it, and two in *different* Rounds do not either.

- [ ] **Step 7: Document and commit**

This is the task that also unblocks **Xiuhcoatl's `[Fortress]` clause** — note it in `docs/45` against Quetzalcoatl's entry.

---

### Task 14: The end that arrives two Turns late

**Files:**
- Modify: `module/rules/bounded-fields.mjs` (`vulnerabilityTriggered` — `masterDefeat`)
- Modify: `module/engine/fields.mjs` (`shouldClose`, the `forcedEnd` tick)
- Modify: `packs/_source/abilities/ozymandias-ramesseum-tentyris.yml`
- Test: `test/unit/bounded-fields.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
describe("masterDefeat", () => {
  it("triggers on the owner's Master falling, with a delay", () => {
    const field = { vulnerabilities: [{ kind: "masterDefeat", delay: "2◈", result: "end" }] };
    const hit = vulnerabilityTriggered(field, { kind: "masterDefeat" });
    expect(hit.triggered).toBe(true);
    expect(hit.delay).toBe("2◈");
  });
});
```

- [ ] **Step 2: Add the kind**

```js
      // *"When Ozymandias' Master is defeated, Ramesseum Tentyris will be
      // forcefully ended after 2◈ Turns, at the end of the Turn."* The delay
      // travels with the verdict; the caller resolves it to an absolute tick,
      // because a countdown needs a hook that can fail to fire.
      case "masterDefeat":
        if (event.kind === "masterDefeat") {
          return { triggered: true, result: v.result ?? "end", delay: v.delay ?? null };
        }
        break;
```

- [ ] **Step 3: Record and honour the tick**

Where a Master's defeat is handled (`rules/relationships.mjs`'s caller in `engine/`), ask every open field and stamp `system.state.forcedEnd`. Then in `shouldClose`:

```js
  // A forced end that was scheduled rather than immediate.
  const forced = field.state?.forcedEnd ?? null;
  if (forced !== null && forced <= tick) return true;
```

- [ ] **Step 4: Author it, rebuild, verify live**

```yaml
    - { kind: masterDefeat, delay: "2◈", result: end }
```

Kill his Master with the Complex open. Confirm it stays open for exactly 2◈ and closes at the end of that Turn — not immediately, and not never.

- [ ] **Step 5: Document and commit**

---

### Task 15: Dendera Electric Bulb

**Files:**
- Modify: `module/rules/platforms.mjs` (`actionSourceFor` — a second source)
- Modify: `module/rules/normal-attack.mjs`
- Modify: `module/data/item/ability.mjs` (`replacesNormalAttack`)
- Create: `packs/_source/abilities/ozymandias-dendera-electric-bulb.yml`
- Test: `test/unit/platforms.test.mjs`, `test/unit/normal-attack.test.mjs`

- [ ] **Step 1: Generalize the replacement**

```js
export function actionSourceFor(unit, board) {
  const none = { unit, platform: null, ability: null, movesAsPlatform: false, attacksAsPlatform: false };

  // An ABILITY the unit carries that replaces its own Normal Attack, gated on a
  // predicate. Dendera Electric Bulb is *"can be used by Ozymandias as his
  // Normal Attack WHILE WITHIN Ramesseum Tentyris"* -- the same substitution a
  // driven mount performs, minus the mount and plus a condition.
  const replacing = (unit?.abilities ?? []).find((a) => a.replacesNormalAttack
    && (!a.replacesNormalAttack.predicate
      || testPredicate(a.replacesNormalAttack.predicate, { options: rollOptionsFor({ attacker: unit }) })));
  if (replacing) return { ...none, ability: replacing };

  if (!unit?.platformId) return none;
  ...
```

`normalAttackAt` then reads the ability's own spec when one is present.

- [ ] **Step 2: Author it**

```yaml
# > "Can be used by Ozymandias as his Normal Attack while within Ramesseum
# > Tentyris. Base Attack (MAG) is used. Range is any panel within Ramesseum
# > Tentyris, and also 4 panels away from the border (if diagonal, 3). Can be
# > used in 2 methods: 1. Hits 1 Unit within Range for 2x damage. 2. Hits a 2x2
# > panel area within Range for 1.5x damage. Counts as Ozymandias' Attack for
# > the Turn. Damage dealt is not affected by Atk Up or other damage increasing
# > effects on Ozymandias. Every time it is used, his Master's Health is reduced
# > by 10. Cannot be used if his Master's Health is less than 10."
schema: 1
id: ozymandias-dendera-electric-bulb
name: "Ramesseum Tentyris: Dendera Electric Bulb"
kind: skill
countsAsAttack: true
replacesNormalAttack:
  predicate: ["self:inField:ozymandias-ramesseum-tentyris"]
requirements:
  - { kind: masterHealthAbove, amount: 9 }
additionalCosts:
  - { id: denderaMasterHealth, kind: masterHealth, amount: 10 }
description: |
  Ozymandias' Normal Attack while within Ramesseum Tentyris. Two methods: one Unit for 2x damage,
  or a 2x2 panel area for 1.5x damage. Not affected by Atk Up or other damage increasing effects
  on Ozymandias. His Master loses 10 Health per use.
targeting:
  anchor: { kind: fieldEdge, fieldId: ozymandias-ramesseum-tentyris, range: 4, diagonalRange: 3 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: chosen, includeSelf: false }
damage:
  component: mag
  multiplier: 2
  # "Not affected by Atk Up or other damage increasing effects on Ozymandias."
  bypassModifiers: attacker
phases:
  - kind: choose
    options:
      - { id: single, name: "One Unit, 2x" }
      - { id: area, name: "2x2 area, 1.5x" }
  - kind: damage
```

If `anchor: fieldEdge` does not take a range, extend it — `fieldEdge` exists and Doomsday Come measures from it.

- [ ] **Step 3: Rebuild and verify live**

Inside the Complex, his Normal Attack **is** Dendera: both methods offered, MAG used, his Master drops 10 per use, and an Atk Up on him does **not** raise the damage. Outside, his ordinary Mesektet-sourced Normal Attack returns.

- [ ] **Step 4: Document and commit**

---

### Task 16: Pyramid Drop

**Files:**
- Modify: `module/engine/skill-use.mjs` (`zone` phase — `shape: reuse`)
- Create: `packs/_source/abilities/ozymandias-pyramid-drop.yml`
- Modify: `packs/_source/servants/ozymandias.yml`

- [ ] **Step 1: Let a zone reuse the NP's own area**

`zoneRadius` reads `spec.shape.size`; `shape: reuse` means "the panels this attack just resolved against". Add it, with the placement note from `docs/42-terrain.md:499`.

- [ ] **Step 2: Author it**

```yaml
# > "Base Attack (MAG) is used. Range=5. Hits a 5x5 panel area within Range for
# > 5x damage; then inflicts NP Seal for 3◈ Turns; and inflicts Def Dwn for 3◈
# > Turns, all damage received is increased by 50%. After that, the NP area
# > becomes 'Day' for 2◈ Turns and Ozymandias' Skill Cooldown is reduced by 1◈
# > Turns. Can only be used once during the entire game. After this NP is used,
# > Ramesseum Tentyris can no longer be used for the rest of the game."
schema: 1
id: ozymandias-pyramid-drop
name: "Ramesseum Tentyris: Pyramid Drop"
isNP: true
rank: EX
npTags: [antiFortress]
kind: noblePhantasm
slug: pyramidDrop
maxUses: 1
expendsPermanently: true
description: |
  (Active) Range 5. Hits a 5x5 panel area for 5x damage, inflicts @effect[npSeal]{NP Seal} for 3◈
  Turns and @effect[defDwn]{Def Dwn} for 3◈ Turns (damage received +50%). The area then becomes Day
  for 2◈ Turns, and Ozymandias' Skill Cooldowns are reduced by 1◈ Turns.
  Usable once per game. Ramesseum Tentyris can no longer be used afterwards.
targeting:
  anchor: { kind: withinRange, range: 5, metric: chebyshev }
  shape: { kind: square, size: 5 }
  selection: { relations: [enemy, ally, neutral], chooser: all, includeSelf: false }
  isDamagingAoE: true
damage: { component: mag, multiplier: 5 }
phases:
  - kind: damage
  - kind: applyEffects
    target: reuse
    effects:
      - { id: npSeal, duration: "3◈" }
      - { id: defDwn, magnitude: 50, duration: "3◈" }
  # docs/42-terrain.md §42.5 prints this clause with his name on it.
  - kind: zone
    spec:
      terrain: [sunlight]
      shape: reuse
      duration: "2◈"
      followsSource: false
      tag: "pyramidDrop:@self.id"
  # R4: his SKILLS, not his Noble Phantasms.
  - kind: cooldown
    target: self
    changes:
      - { kind: skill, ticks: "1◈", direction: down }
```

Ending Ramesseum first, and locking it out, is authored as an `onEnd`-adjacent phase or handled in the same `lockOutField` path Task 13 built — reuse it rather than writing a second lock.

- [ ] **Step 3: Rebuild and fire it live**

Confirm: 5×5 at 5×; NP Seal and Def Dwn land for 3◈; **the blast area reads Day for 2◈** (check `phaseAt` at a panel inside it while the Round is Night); his three Skills each drop 1◈; Mesektet does **not**; and both Pyramid Drop and Ramesseum Tentyris are refused thereafter.

- [ ] **Step 4: Document and commit**

---

### Task 17: The whole kit, in one match

**Files:** `docs/45-implementation-status.md`, `docs/44-case-expanded-roster.md`, `docs/D-servant-data-sheets.md`, `docs/40-roadmap.md`

No new code. Green tests are not evidence for any of this.

- [ ] **Step 1: Bring the world up**

```bash
node -e "fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent('http://localhost:30000/'),{method:'PUT'})"
node tools/fgt-world.mjs launch && node tools/fgt-world.mjs join && node tools/fgt-world.mjs status
```

- [ ] **Step 2: Run the spec's eight acceptance scenarios end to end**

1. The Complex clips against an enemy Home Base; his Master pays 50% of max.
2. A Normal Human inside dies at the end of the Turn **after** entering.
3. An enemy Servant inside cannot use its NP; a Divinity-B unit can; a `categorizedAsNP` Skill is unaffected.
4. He is defeated inside and revives at 20%; a Sphinx at 10%.
5. Two `[Anti-Fortress]` NPs in one Round end it **permanently**; it cannot be recast.
6. Deactivate and reactivate: the Sphinxes return on the same Health.
7. His Master dies: it ends 2◈ later, at the end of the Turn.
8. Pyramid Drop turns its blast area Day for 2◈.

- [ ] **Step 3: Fire Xiuhcoatl's `[Fortress]` clause**

With the Complex open, have Quetzalcoatl use Xiuhcoatl within or beside it. Confirm the clause fires — it has **never had a live referent**, and `quetz-xiuhcoatl.yml:116` says so.

- [ ] **Step 4: Look at it**

Screenshot the board with the Complex painted, the three Sphinxes inside, and his sheet open. Read it.

- [ ] **Step 5: Record what was observed, then commit**

Write the §45.4 entry in the style of the other **built** entries — naming what was measured live rather than what the tests assert — and update Quetzalcoatl's entry to remove the "not demonstrable" note.
