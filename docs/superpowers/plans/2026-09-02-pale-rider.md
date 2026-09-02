# Pale Rider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author Pale Rider completely — every clause of `char_orig_sheets/Copia de Pale Rider.md` either runs in `fgt2026` or is documented as unmodelled with the reason — by adding the six general engine pieces the spec names rather than a Pale Rider special case.

**Architecture:** Everything area-shaped is a bounded field (Ch. 43): Contagion is a *passive* field whose geometry reads the board, Doomsday Come is a cast field whose axes gain a rolled radius, a paid extension runner, an isolation exception and a new vulnerability kind, and Innocent World is six predicated interior rules on it. Kagome Spirits are summons with per-enemy memory, a pursuit constraint on the mover, and a defender-side `attacked` event. Every new piece is a rules-layer function with a pure test and an engine-layer caller.

**Tech Stack:** Foundry VTT v14 (Regions + `npField` behaviour), ESM, vitest, YAML content compiled by `npm run build:packs`, SCSS via `npm run build:styles`.

**Spec:** `docs/superpowers/specs/2026-09-02-pale-rider-design.md`

## Global Constraints

- Layered architecture enforced by `tools/check-layers.mjs`: `domain/` → `rules/` (pure, no Foundry globals, no `game`/`canvas`/`Roll`) → `engine/` → `apps/`. Every board-reading rule lives in `rules/`; every Foundry write lives in `engine/`.
- Every engine `token.update()` touching `x`, `y`, `elevation`, `width`, `height`, `depth`, `shape`, `level` **must** pass `{ fgtForced: true }` or `onPreMove` silently refuses it.
- `Rank.parseOrNull` **throws** on unparseable input; only `null`/blank/dash return `null`.
- `turnStateAt` in `rules/snapshot.mjs` copies a **fixed key list** — a new `turnState` flag must be added there or no snapshot reader sees it.
- New roll options must be added to `EMITTABLE` in `rules/options.mjs` (line ~310) or `test/unit/options.test.mjs` fails the build.
- `tools/lib/content.mjs#actorSystem` is an **allowlist** (line ~790): a new unit-level content field compiles to its schema default unless named there.
- Every commit updates `/docs`: the affected 00–44 chapter **and** Ch. 45 + `CHANGELOG.md`. Ch. D §D.26 is Pale Rider's data sheet.
- Checks before every commit: `npm run lint && npx vitest run && npm run validate:content && npm run check:templates && npm run check:manifest`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014hZGmjdxHK6gCyudTcXi3S
  ```
- Live testing in world `fgt2026` (GM user, no password) requires `npm run build:packs` with the world **shut down** (`game.shutDown()` from the client, or the LevelDB throws `EBUSY`), then relaunch and `node tools/fgt-reload.mjs`. The scratchpad `ev.mjs` harness evaluates a `.js` file in the client over CDP (port 9222).
- Test naming: `test/unit/<subject>.test.mjs`, vitest `describe`/`it`, fixtures built inline (see `test/unit/bounded-fields.test.mjs` lines 1–46 for the field fixture style and `test/unit/jack.test.mjs` for the content-file style).

---

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `module/data/actor/_shared.mjs` | `undamageable` on `unitCommon()`; `summonAssignments`, `pursuitTargetId`, `boundToFieldId` | 1, 7 |
| `module/data/actor/servant.mjs`, `simple.mjs` | `prepareBaseData` stands aside for `undamageable` | 1 |
| `module/rules/granted.mjs` | `noNormalAttack`, `noReactions` grants | 1 |
| `module/rules/zon.mjs` | `fromStat` bonuses | 1 |
| `module/rules/elements.mjs` | `ZonBonus.fromStat`, `DamageNegation.consumesUse`, `VulnerabilityAmplifier.polarity`, `Suppress` unchanged | 1, 5 |
| `module/engine/attack.mjs` | grant refusals; `attacked` event; `npScaleUsedOn` at Process end; consume Dmg Cut uses | 1, 4, 7 |
| `module/rules/bounded-fields.mjs` | geometry `overrides`, `piercedBy`, interior `predicate`, `extensionFor` minimum, `vulnerabilityTriggered npScaleUsedOn` | 2, 4, 5 |
| `module/engine/fields.mjs` | `ensurePassiveFields`, `HealthLoss`/`chance`/`branches`/`requiresEffect`/`RemoveEffect`/`SummonBound`/`Banish` actions, `radiusRoll`, extension runner, `unitTurnEnd` dispatcher, banish return, bound-summon teardown | 2, 3, 6, 7 |
| `module/engine/scheduler-hooks.mjs` | `unitTurnEnd` field dispatch | 2 |
| `module/rules/options.mjs` | `withinOfOwnerMaster`, `npScale:gte`, `highestParameter`, `npAboveAllParameters`, `stableDie`, `vsAttribute` | 2, 4, 5, 7 |
| `module/rules/targeting/{vocabulary,resolve}.mjs` | `fieldEdge` anchor; `ForceTarget` reader; proxy reader | 4, 7, 8 |
| `module/engine/skill-use.mjs` | `dragInto` phase | 4 |
| `module/rules/budget.mjs` | `npSeal` suppression scope | 5 |
| `module/engine/summoning.mjs` | `inherit`, `pursuitTargetId`, `boundToFieldId` stamping, exported `placeSummons` | 7 |
| `module/engine/movement-hooks.mjs` | pursuit constraint | 7 |
| `module/rules/movement.mjs` | proxy reader in `inEnemyMasterProtection` | 8 |
| `module/rules/items.mjs` | `fieldOpen` requirement kind | 4 |
| `module/data/regions.mjs` | `passive`, `lastExtendedAt` on `NPFieldBehavior` | 2, 3 |
| `tools/lib/content.mjs` | allowlist entries; `REQUIREMENT_KINDS` | 1, 4, 7 |
| `packs/_source/effects/{charm,regen,dmg-cut,gotn,contagion-expanded}.yml` | new effects | 1, 2, 6 |
| `packs/_source/class-skills/riding-pale-rider.yml` | Riding EX variant | 1 |
| `packs/_source/abilities/pale-rider-{contagion,innocent-world,guidance-of-the-netherworld,doomsday-come,doomsday-drag,kagome-kagome}.yml` | Pale Rider's abilities | 2–7 |
| `packs/_source/summons/kagome-{sword,famine,death,beast}.yml` | the four Spirits | 7 |
| `packs/_source/servants/pale-rider.yml` | the Servant | 8 |
| `lang/en.json` | new UI strings | 3, 4, 7 |
| `docs/04, 06, 09, 16, 24, 43, 44, 45, A, D, E`, `CHANGELOG.md` | documentation | every task |

---

### Task 1: Effects and the unit shape

**Files:**
- Modify: `module/data/actor/_shared.mjs:15-36` (`unitCommon`)
- Modify: `module/data/actor/servant.mjs:93-101` (`prepareBaseData`)
- Modify: `module/data/actor/simple.mjs:56` (`SummonData#prepareBaseData`)
- Modify: `module/rules/granted.mjs:29-36`
- Modify: `module/engine/attack.mjs:122-123` and `:2684-2692`
- Modify: `module/rules/elements.mjs:672-681` (`DamageNegation`), `:784-790` (`ZonBonus`)
- Modify: `module/rules/zon.mjs:80-87`
- Modify: `tools/lib/content.mjs:799`
- Create: `packs/_source/effects/charm.yml`, `regen.yml`, `dmg-cut.yml`
- Create: `packs/_source/class-skills/riding-pale-rider.yml`
- Test: `test/unit/pale-rider.test.mjs` (new), `test/unit/zon.test.mjs` (add cases)

**Interfaces:**
- Produces: `GRANTS.noNormalAttack === "noNormalAttack"`, `GRANTS.noReactions === "noReactions"` (`rules/granted.mjs`); `zonBonuses[].fromStat: string|null`; `damageNegation[].consumesUse: boolean`; `system.undamageable: boolean` on every unit type.

- [ ] **Step 1: Write the failing tests**

```js
// test/unit/pale-rider.test.mjs
/**
 * Pale Rider — the clauses that needed engine.
 * @see packs/_source/servants/pale-rider.yml, docs/D-servant-data-sheets.md §D.26
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { GRANTS, hasGranted } from "../../module/rules/granted.mjs";
import { zonRadius } from "../../module/rules/zon.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";

const effect = (name) => parse(readFileSync(`packs/_source/effects/${name}.yml`, "utf8"));

describe("Riding EX — the four passives", () => {
  it("names two grants no other Servant carries", () => {
    expect(GRANTS.noNormalAttack).toBe("noNormalAttack");
    expect(GRANTS.noReactions).toBe("noReactions");
    const unit = { grantedAbilities: ["noNormalAttack", "noReactions"] };
    expect(hasGranted(unit, GRANTS.noNormalAttack)).toBe(true);
    expect(hasGranted(unit, GRANTS.noReactions)).toBe(true);
  });

  it("swells the Master's ZON by the Servant's MOV, and by six more on Riding's Turn", () => {
    const master = { zon: 0, rank: null };
    const servant = { servantClasses: ["rider"], mov: 6, zonBonuses: [{ fromStat: "mov", stacks: true, source: "riding" }] };
    const base = zonRadius(master, servant);
    const ridden = zonRadius(master, { ...servant, mov: 12 });
    expect(ridden - base).toBe(6);
    expect(base - zonRadius(master, { ...servant, zonBonuses: [] })).toBe(6);
  });
});

describe("the three new effects", () => {
  it("Charm is the id control.mjs already looks for", () => {
    expect(effect("charm").id).toBe("charm");
    expect(effect("charm").polarity).toBe("debuff");
  });
  it("Regen heals 10% of max on three boundaries", () => {
    const rules = effect("regen").rules;
    const events = rules.flatMap((r) => r.events ?? [r.event]);
    expect(events).toEqual(expect.arrayContaining(["turnEnd", "actedTurnEnd", "roundEnd"]));
    expect(rules[0].then[0]).toMatchObject({ key: "Heal", percentOfMax: 10 });
  });
  it("Dmg Cut is a flat −100 negation that spends one of three uses", () => {
    const def = effect("dmg-cut");
    expect(def.uses).toBe(3);
    const out = collectContributions([{ id: "dmgCut", rules: def.rules, magnitude: 100 }], {});
    expect(out.damageNegation[0]).toMatchObject({ mode: "flat", consumesUse: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/unit/pale-rider.test.mjs`
Expected: FAIL — `GRANTS.noNormalAttack` is undefined; `charm.yml` not found.

- [ ] **Step 3: Schema flag and the backfill stand-aside**

In `module/data/actor/_shared.mjs`, inside `unitCommon()` directly after the `baseHealth` field:

```js
    // Pale Rider and the Kagome Spirits: "Base Health: —", "cannot take
    // damage". `null` Health has been the convention since Ch. 04 and the
    // pipeline already halts at stage 0 on it; what this flag does is keep
    // each type's `prepareBaseData` from BACKFILLING the null from an
    // END-rank table, which is exactly what it did to a Servant with no
    // Health.
    undamageable: new fields.BooleanField({ initial: false }),
```

In `module/data/actor/servant.mjs#prepareBaseData` (line ~93), before the `baseHealthByEnd` backfill:

```js
    if (this.undamageable) {
      this.health.value = null;
      this.health.max = null;
      return;
    }
```

Same four lines at the top of `SummonData#prepareBaseData` in `module/data/actor/simple.mjs` (line ~56).

In `tools/lib/content.mjs#actorSystem` after `movesOntoOccupiedPanels:` (line ~800):

```js
    undamageable: Boolean(doc.undamageable),
```

- [ ] **Step 4: The two grants and their readers**

`module/rules/granted.mjs`, inside `GRANTS`:

```js
  /** Pale Rider: "cannot perform Normal Attacks". Read by `engine/attack.mjs#resolveAttack`. */
  noNormalAttack: "noNormalAttack",
  /** Pale Rider, Kagome Spirits: "cannot Evade, Block, or Counter". Read by `offeredReactions`. */
  noReactions: "noReactions",
```

`module/engine/attack.mjs`, directly after line 123 (`if (!usage.ok && !overridden) throw …`). `ability` is `null` for a bare Normal Attack on this path (confirm at the top of `resolveAttack`; the variable that holds the declared ability item is what `abilityUsageSpec(ability)` receives):

```js
  // Riding EX passive 3: "Pale Rider cannot perform Normal Attacks." A grant
  // rather than a range of 0, because he has a MAG Base Attack the sheet
  // prints and a Spell could still use it.
  if (!ability && hasGranted(self, GRANTS.noNormalAttack)) {
    throw new Error(`FGT | ${self.name} cannot perform Normal Attacks.`);
  }
```

Add `import { GRANTS, hasGranted } from "../rules/granted.mjs";` to attack.mjs's imports if absent.

In `offeredReactions(defenderId, attack)` (line ~2684), after `if (!actor) return [];`:

```js
  // Riding EX passive 4: "cannot Evade, Block, or Counter." The rung still
  // exists -- the Process asks the defender -- and the only answer is nothing.
  if (hasGranted(unitSnapshot(actor), GRANTS.noReactions)) return [];
```

- [ ] **Step 5: `ZonBonus fromStat` and `DamageNegation consumesUse`**

`module/rules/elements.mjs` `ZonBonus` executor:

```js
  ZonBonus(el, { rank, source, out, ctx }) {
    out.zonBonuses.push({
      value: scalar(resolveValue(el, rank, ctx)),
      // "Master's ZON is increased by X, X = Pale Rider's MOV" -- a stat the
      // zone reader resolves off the Servant snapshot, not a number.
      fromStat: el.fromStat ?? null,
      stacks: el.stacks === true,
      source,
    });
  },
```

`DamageNegation` executor — add one line to the pushed object:

```js
      // Dmg Cut: "3 times". Spent by `engine/attack.mjs` through the same
      // `consumeUse` path `AutoSucceed` uses; the effect declares `uses`.
      consumesUse: el.consumesUse === true,
```

`module/rules/zon.mjs` — replace the `equivalent`/`stacking` bonus reads (lines ~80–87) with a resolver:

```js
  // A bonus may name a STAT rather than a number (Pale Rider's Riding EX:
  // "increased by X panels, X = Pale Rider's MOV"). Read off the same snapshot
  // the rest of this function already has, so Riding's own +6 MOV Active
  // swells the zone for that Turn -- the sheet gives no cap and none is added.
  const valueOf = (b) => (b.fromStat ? (Number(servant?.[b.fromStat]) || 0) : (b.value ?? 0));
  const equivalent = [
    ...classes.map((c) => classBonus[c] ?? 0),
    ...(servant.zonBonuses ?? []).filter((b) => b.stacks !== true).map(valueOf),
  ];
  const exclusive = equivalent.length > 0 ? Math.max(...equivalent) : 0;

  const stacking = (servant.zonBonuses ?? [])
    .filter((b) => b.stacks === true)
    .reduce((sum, b) => sum + valueOf(b), 0);
```

Spending the use: in `module/engine/attack.mjs`, where the defender's `damageNegation` contributions are folded into the damage step (search `damageNegation` near `rollNegation` at line ~1754; the step that assembles the pipeline's negation input), after the damage result is known to have been reduced, emit for every consuming entry:

```js
  for (const n of defender.damageNegation ?? []) {
    if (n.consumesUse) await applyBatch([I.consumeUse(defender.id, n.source)], "damageNegation");
  }
```

`n.source` for an effect-borne rule is the effect's defId — confirm in `rules/snapshot.mjs#contributionsOf` (search `source:` in the effect branch); if it is the instance id instead, stamp `defId: ctx.defId` in the executor and pass `n.defId`.

- [ ] **Step 6: The three effects and the Riding variant**

`packs/_source/effects/charm.yml`:

```yaml
# Appendix A -- a mental debuff that hands the Unit's actions to the inflicter
# for the duration. `rules/control.mjs#isCharmed` has read this id since it was
# written; this is the definition that lets something inflict it. First
# inflicter: Pale Rider's Contagion.
schema: 1
id: charm
name: "Charm"
description: "The Unit is controlled by the inflicter's faction for the duration."
polarity: debuff
volatility: volatile
valence: offensive
stacking: noneRefresh
baseChance: 100
severity: mental
defaultDuration: "1◈"
rules: []
```

`packs/_source/effects/regen.yml`:

```yaml
# Guidance of the Netherworld effect 2: "Health is restored by 10% of its
# maximum value at the end of the Unit's Turn, the end of any Turn the Unit
# Acts, and at the end of the Round."
schema: 1
id: regen
name: "Regen"
description: "Restores 10% of maximum Health at the end of the Unit's Turn, any Turn it Acts, and the Round."
polarity: buff
volatility: nonVolatile
valence: defensive
stacking: noneRefresh
baseChance: 100
rules:
  - key: OnEvent
    events: [turnEnd, actedTurnEnd, roundEnd]
    automatic: true
    then:
      - { key: Heal, percentOfMax: 10 }
```

`Heal` gains `percentOfMax` in `module/engine/scheduler.mjs` `ACTIONS.Heal` (line ~468):

```js
  Heal: (a, u, h, c) => {
    // Regen: "10% of its maximum value". Of MAXIMUM, the same reading
    // `skill-use.mjs`'s `heal` phase already makes.
    if (typeof a.percentOfMax === "number") {
      const max = u.healthMax ?? u.health?.max ?? 0;
      const amount = Math.floor(max * (a.percentOfMax / 100));
      return amount > 0 ? [I.heal(u.id, amount, h.source)] : [];
    }
    const amount = rolled(a, c);
    return amount === null ? [] : [I.heal(u.id, amount, h.source)];
  },
```

Confirm the snapshot's max-Health key (`grep -n "healthMax\|health: " module/rules/snapshot.mjs`) and use that name.

`packs/_source/effects/dmg-cut.yml`:

```yaml
# Guidance of the Netherworld effect 3: "Applies Dmg Cut for 1◈ Turns, 3 times;
# all damage taken is reduced by 100."
schema: 1
id: dmgCut
name: "Dmg Cut"
description: "All damage taken is reduced by X, a limited number of times."
polarity: buff
volatility: nonVolatile
valence: defensive
stacking: noneRefresh
baseChance: 100
uses: 3
rules:
  - key: DamageNegation
    mode: flat
    value: "@magnitude"
    includesNP: true
    consumesUse: true
```

`packs/_source/class-skills/riding-pale-rider.yml`:

```yaml
# Pale Rider's Riding EX. The same Active as `class-riding.yml`; the passives
# are his own four, none of which is Double Move / Riding Attack / Passenger
# Seat. A variant file rather than a rank row because the PASSIVE SET differs,
# which a table cannot express. `undamageable` (passive 1) is a unit flag on
# the Servant file, not a rule.
schema: 1
id: pale-rider-riding
name: "Riding"
source: class
slug: riding
rank: EX
cooldown: "3◈"
description: |
  (Passive) 1. Pale Rider cannot take damage. 2. Pale Rider's Master's ZON is increased by X
  panels, X = Pale Rider's MOV. 3. Pale Rider cannot perform Normal Attacks. 4. Pale Rider
  cannot Evade, Block, or Counter.
  (Active) Used during your Turn. Increases MOV by 6 panels for this Turn. Cooldown: 3◈ Turns.
  The MOV Up is not a buff.
passiveRules:
  - key: GrantedAbility
    abilities: [noNormalAttack, noReactions]
  - key: ZonBonus
    fromStat: mov
    stacks: true
activeRules:
  - key: MovDelta
    value: 6
    duration: "this turn"
    isBuff: false
```

- [ ] **Step 7: Run the tests and the checks**

Run: `npx vitest run test/unit/pale-rider.test.mjs test/unit/zon.test.mjs && npm run lint && npm run validate:content`
Expected: PASS. If `validate:content` rejects `fromStat`, `consumesUse`, `uses` on an effect, or `percentOfMax` on `Heal`, add them to the corresponding key list in `tools/validate-content.mjs` / `tools/lib/content.mjs` (search the rejected key's neighbour, e.g. `npDiceDoubled`).

- [ ] **Step 8: Docs and commit**

- `docs/04-units.md`: under the Health section, a paragraph "Undamageable units" naming the flag and the two grants.
- `docs/A-effect-catalogue.md`: rows for Charm, Regen, Dmg Cut (built).
- `docs/45-implementation-status.md` §45.4: `ZonBonus fromStat`, `DamageNegation consumesUse` rows; a new "Pale Rider" subsection under §45.4 opened with commit 1.
- `CHANGELOG.md` entry.

```bash
git add module/data/actor/_shared.mjs module/data/actor/servant.mjs module/data/actor/simple.mjs module/rules/granted.mjs module/rules/zon.mjs module/rules/elements.mjs module/engine/attack.mjs module/engine/scheduler.mjs tools/lib/content.mjs packs/_source/effects/charm.yml packs/_source/effects/regen.yml packs/_source/effects/dmg-cut.yml packs/_source/class-skills/riding-pale-rider.yml test/unit/pale-rider.test.mjs docs CHANGELOG.md
git commit -m "Add the undamageable unit shape, two Riding EX grants, ZON-from-MOV and three effects for Pale Rider"
```

---

### Task 2: Passive fields, geometry overrides, and Contagion

**Files:**
- Modify: `module/data/regions.mjs:65-116` (`NPFieldBehavior` schema)
- Modify: `module/rules/bounded-fields.mjs:90-118` (`panelsOf`)
- Modify: `module/engine/fields.mjs` (`createField` 77–232; `runFieldEvent` 404–527; new `ensurePassiveFields`)
- Modify: `module/engine/scheduler-hooks.mjs:77-93` and `:136-137`
- Modify: `module/engine/fgt.mjs` (ready hook)
- Modify: `module/rules/options.mjs:213` and `EMITTABLE`
- Create: `packs/_source/effects/contagion-expanded.yml`, `packs/_source/abilities/pale-rider-contagion.yml`
- Test: `test/unit/bounded-fields.test.mjs` (geometry overrides), `test/unit/pale-rider.test.mjs` (Contagion content), `test/unit/field-events.test.mjs` (new — pure branch selection)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `field.passive: boolean`; `geometry.overrides: [{whileOwnerHas?: string, whileFieldOpen?: string, shape?: object, sameAs?: string}]` read by `panelsOf(field, board)`; `ensurePassiveFields()` (engine, GM-only, idempotent); field event actions `HealthLoss {amount}`, `ApplyEffect {chance, duration}`; `spec.branches: [{predicate, onFail}]` selected per unit; the field event name `unitTurnEnd`; the option `self:withinOfOwnerMaster:<n>` (n = 1..6); pure `selectBranch(spec, options)` exported from `rules/bounded-fields.mjs`.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/bounded-fields.test.mjs`:

```js
describe("geometry overrides — Contagion (Ch. 43 §43.3)", () => {
  const contagion = (over = {}) => ({
    id: "pale-rider-contagion", ownerId: "pale", passive: true,
    geometry: {
      kind: "followsUnit",
      shape: { kind: "square", size: 5 },
      overrides: [
        { whileOwnerHas: "contagionExpanded", shape: { kind: "square", size: 9 } },
        { whileFieldOpen: "pale-rider-doomsday-come", sameAs: "pale-rider-doomsday-come" },
      ],
    },
    ...over,
  });
  const pale = (over = {}) => ({ id: "pale", faction: "a", panel: at(10, 10), effects: [], ...over });

  it("is the 5×5 around the owner by default", () => {
    expect(panelsOf(contagion(), { units: [pale()], fields: [] })).toHaveLength(25);
  });
  it("becomes 9×9 while the owner carries the marker", () => {
    expect(panelsOf(contagion(), { units: [pale({ effects: ["contagionExpanded"] })], fields: [] })).toHaveLength(81);
  });
  it("borrows Doomsday's panels while Doomsday is open, marker or not", () => {
    const doomsday = { id: "pale-rider-doomsday-come", ownerId: "pale", geometry: { kind: "freeform" }, panels: [at(0, 0), at(0, 1), at(0, 2)] };
    const board = { units: [pale({ effects: ["contagionExpanded"] })], fields: [doomsday] };
    // First match wins, so the ORDER in the file is the precedence: the
    // marker is listed first and still applies. Doomsday's "instead" clause
    // is therefore authored first in the real file; this test pins the rule.
    expect(panelsOf(contagion(), board)).toHaveLength(81);
    const swapped = contagion({ geometry: { ...contagion().geometry, overrides: [...contagion().geometry.overrides].reverse() } });
    expect(panelsOf(swapped, board)).toEqual(doomsday.panels);
  });
});
```

Create `test/unit/field-events.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { selectBranch } from "../../module/rules/bounded-fields.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

describe("field event branches", () => {
  const spec = {
    event: "turnEnd",
    branches: [
      { predicate: ["self:inField:pale-rider-doomsday-come", "self:withinOfOwnerMaster:3"], onFail: [{ key: "HealthLoss", amount: 150 }] },
      { predicate: ["self:inField:pale-rider-doomsday-come"], onFail: [{ key: "HealthLoss", amount: 100 }] },
    ],
    onFail: [{ key: "HealthLoss", amount: 100 }, { key: "ApplyEffect", effect: { id: "poison" }, chance: 50 }],
  };
  it("takes the first branch whose predicate holds", () => {
    const options = new Set(["self:inField:pale-rider-doomsday-come", "self:withinOfOwnerMaster:3"]);
    expect(selectBranch(spec, options).onFail[0].amount).toBe(150);
  });
  it("falls back to the base actions when no branch matches", () => {
    expect(selectBranch(spec, new Set()).onFail).toBe(spec.onFail);
  });
});

describe("self:withinOfOwnerMaster", () => {
  it("is emitted for every radius the unit is within, 1..6", () => {
    const unit = { id: "u", panel: { i: 0, j: 0 }, ownerMasterPanel: { i: 0, j: 2 } };
    const options = rollOptionsFor({ attacker: unit });
    expect(options.has("self:withinOfOwnerMaster:2")).toBe(true);
    expect(options.has("self:withinOfOwnerMaster:3")).toBe(true);
    expect(options.has("self:withinOfOwnerMaster:1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/bounded-fields.test.mjs test/unit/field-events.test.mjs`
Expected: FAIL — override shapes ignored (25 panels every time); `selectBranch` not exported.

- [ ] **Step 3: `panelsOf` overrides and `selectBranch` (rules layer)**

In `module/rules/bounded-fields.mjs#panelsOf`, replace the `followsUnit` case and add a helper:

```js
    case "followsUnit": {
      const anchorId = geometry.unitRef === "ownerMaster" ? field.ownerMasterId : field.ownerId;
      const anchor = (board?.units ?? []).find((u) => u.id === anchorId);
      if (!anchor?.panel) return [];
      // Contagion: "Increases the Contagion area ... from 5x5 to 9x9 for 1◈
      // Turns" and "when Doomsday Come is Active, Contagion constantly
      // affects all enemy Units within the NP area INSTEAD of its usual
      // Range". A geometry that reads the board -- the owner's effects, or
      // another open field -- rather than one the engine rewrites in place.
      // Tested in file order; the first match wins.
      const override = (geometry.overrides ?? []).find((o) => overrideApplies(o, field, board));
      if (override?.sameAs) {
        const other = (board?.fields ?? []).find((f) => f.id === override.sameAs);
        return other ? panelsOf(other, board) : [];
      }
      const shape = override?.shape ?? geometry.shape;
      return square(anchor.panel, shape?.size ?? 1);
    }
```

```js
/**
 * @param {object} override
 * @param {object} field
 * @param {object} board
 * @returns {boolean}
 */
function overrideApplies(override, field, board) {
  if (override.whileOwnerHas) {
    const owner = (board?.units ?? []).find((u) => u.id === field.ownerId);
    const held = (owner?.effects ?? []).map((e) => e?.defId ?? e);
    if (!held.includes(override.whileOwnerHas)) return false;
  }
  if (override.whileFieldOpen) {
    if (!(board?.fields ?? []).some((f) => f.id === override.whileFieldOpen)) return false;
  }
  return Boolean(override.whileOwnerHas || override.whileFieldOpen);
}
```

Export the branch selector next to `interiorModifiers`:

```js
/**
 * Which of an interior event's `branches` applies to THIS unit -- the same
 * first-match shape `damage.branches` and `field.branches` use. Contagion
 * under Doomsday: "the chance ... is 75% ... and if the enemy Unit is within
 * a 3 panel area of Pale Rider's Master, Health is reduced by 150 instead".
 *
 * @param {object} spec the interior event
 * @param {Set<string>} options the unit's own roll options
 * @returns {{onFail: object[]}} the branch, or the spec itself
 */
export function selectBranch(spec, options) {
  const branch = (spec.branches ?? []).find((b) => testPredicate(b.predicate, { options }));
  return branch ?? spec;
}
```

Import `test as testPredicate` from `./predicate.mjs` at the top of `bounded-fields.mjs` if not already imported.

- [ ] **Step 4: The option and the snapshot field**

`module/rules/options.mjs`, after the `inField` loop (line ~213):

```js
  // Distance to the Master of whoever owns the field the unit stands in --
  // Contagion under Doomsday: "if the enemy Unit is within a 3 panel area of
  // Pale Rider's Master". A ladder, like `attack:range:gte`, so `:3` implies
  // `:4`. `ownerMasterPanel` is stamped by `annotateFields`.
  if (unit.panel && unit.ownerMasterPanel) {
    const d = Math.max(Math.abs(unit.panel.i - unit.ownerMasterPanel.i), Math.abs(unit.panel.j - unit.ownerMasterPanel.j));
    for (let n = Math.max(1, d); n <= 6; n++) options.add(`${side}:withinOfOwnerMaster:${n}`);
  }
```

Add `/^(self|target):withinOfOwnerMaster:[1-6]$/,` to `EMITTABLE`.

In `rules/bounded-fields.mjs#annotateFields`, inside the `for (const field of fields)` loop after `u.fields.push(field.id)`:

```js
      // The first field's owner's Master, for `withinOfOwnerMaster`.
      if (!u.ownerMasterPanel && field.ownerMasterId) {
        const master = (board.units ?? []).find((x) => x.id === field.ownerMasterId);
        if (master?.panel) u.ownerMasterPanel = { ...master.panel };
      }
```

- [ ] **Step 5: Schema, passive fields, and the new actions (engine)**

`module/data/regions.mjs` `NPFieldBehavior.defineSchema`, after `deactivation`:

```js
      // A field that is neither cast nor ended -- Pale Rider's Contagion,
      // "the 2 panel area around Pale Rider". `ensurePassiveFields` opens
      // one per placed owner and closes it when the owner leaves the board.
      passive: new fields.BooleanField({ initial: false }),
```

`module/engine/fields.mjs` — refactor `createField` so the field-record construction can be reused: extract everything from `const spec = ability?.system?.field` through the `createEmbeddedDocuments("RegionBehavior")` call into `async function openField(ability, actor, snapshot, spec)` and have `createField` call it (behaviour-preserving; `createField` keeps its signature). Then add:

```js
/**
 * Open every passive field whose owner stands on the board, and close every
 * passive field whose owner has left it. Idempotent: run at `ready` and at
 * every Turn start.
 *
 * Contagion is the first: "(Passive) The 2 panel area around Pale Rider is
 * the Contagion area." Nothing casts it and nothing ends it.
 *
 * @returns {Promise<void>}
 */
export async function ensurePassiveFields() {
  if (!game.users.activeGM?.isSelf) return;
  const scene = canvas?.scene ?? null;
  if (!scene) return;
  const board = currentBoard();
  const open = new Set((board.fields ?? []).map((f) => f.id));

  for (const unit of board.units ?? []) {
    const actor = game.actors.get(unit.id);
    if (!actor) continue;
    for (const ability of actor.items ?? []) {
      const spec = ability.system?.field ?? null;
      if (!spec?.passive) continue;
      const fieldId = ability.system?.contentId ?? ability.id;
      if (open.has(fieldId)) continue;
      if (!unit.panel || unit.defeated) continue;
      await openField(ability, actor, board, spec);
    }
  }

  for (const field of board.fields ?? []) {
    if (!field.passive) continue;
    const owner = (board.units ?? []).find((u) => u.id === field.ownerId);
    if (!owner?.panel || owner.defeated) await endField(field.id);
  }
}
```

`openField` must copy `passive: Boolean(spec.passive)` into the field record (beside `upkeep`/`deactivation`), and `board.mjs#boundedFieldsOf` must project `passive` (search `upkeep:` there and add `passive: sys.passive ?? false` beside it).

In `module/fgt.mjs`'s `ready` hook, after `TokenRotation.lockExisting()`: `await Fields.ensurePassiveFields();` (import `* as Fields from "./engine/fields.mjs"` if not present). In `scheduler-hooks.mjs`, before line 136's `expireFields(nextTick)`: `await fields.ensurePassiveFields();`.

`runFieldEvent` — replace `for (const action of spec.onFail ?? [])` with branch selection and add the actions:

```js
    // Contagion under Doomsday rewrites its own numbers per unit. The branch
    // is picked against the UNIT's options, so "within 3 of the Master"
    // and "inside Doomsday" are both the unit's facts.
    const chosen = selectBranch(spec, rollOptionsFor({ attacker: unit }));
    for (const action of chosen.onFail ?? []) {
      // Contagion effect 1: "Health is reduced by 100. Not affected by
      // effects that modify damage taken (does not count as 'damage')." A
      // stat write, never the pipeline and never `fgt.damageTaken`; it still
      // reaches zero and `resolveDefeat` still notices.
      if (action.key === "HealthLoss") {
        const amount = Math.abs(action.amount ?? 0);
        if (amount > 0) out.push(I.statDelta(unit.id, "health.value", -amount));
        continue;
      }
```

and in the existing `ApplyEffect` branch, roll the chance and honour a duration:

```js
      if (action.key === "ApplyEffect") {
        // "Has a 50% chance of being inflicted with Poison." The same helper
        // every other chance in the system reads.
        if (typeof action.chance === "number") {
          const roll = await new Roll("1d100").evaluate();
          if (!chance(roll.total, action.chance)) continue;
        }
        const ticks = action.duration
          ? resolveTicks(parseTick(action.duration), { turnsPerRound: game.settings.get("fgt", "turnsPerRound") })
          : null;
        out.push(I.applyEffect(unit.id, {
          defId: action.effect?.id ?? action.effect?.defId,
          magnitude: action.effect?.magnitude ?? 0,
          npMagnitude: action.effect?.npMagnitude ?? undefined,
          uses: action.effect?.uses ?? undefined,
          expiry: ticks === null ? null : (game.combat?.system?.globalTurn ?? 0) + ticks,
          sourceUnitId: field.ownerId,
        }, field.ownerId));
      }
```

Import `chance` from `../rules/checks.mjs` and `selectBranch` from `../rules/bounded-fields.mjs`.

- [ ] **Step 6: The `unitTurnEnd` dispatcher**

`runFieldEvents` already takes `fieldIds`. In `scheduler-hooks.mjs` after the `turnEnd` dispatch (line 83):

```js
  // A field's OWNER's Turn ending -- Contagion trigger 1: "At the end of
  // Pale Rider's Turn: affects all enemy Units within the Contagion area."
  // §E lists `unitTurnEnd` and nothing dispatched it. Scoped to the fields
  // whose owner belongs to the faction whose Turn just ended.
  const owned = (board.fields ?? [])
    .filter((f) => activeUnits.some((u) => u.id === f.ownerId))
    .map((f) => f.id);
  if (owned.length > 0) {
    await run(await fields.runFieldEvents("unitTurnEnd", { fieldIds: owned }), "field:unitTurnEnd");
  }
```

- [ ] **Step 7: Content**

`packs/_source/effects/contagion-expanded.yml`:

```yaml
# Contagion's Active: "Increases the Contagion area by a Range of 2 panels for
# 1◈ Turns". A marker the field's geometry reads (`whileOwnerHas`); no rules.
schema: 1
id: contagionExpanded
name: "Contagion (Expanded)"
description: "Contagion covers a 9×9 area instead of 5×5."
polarity: status
volatility: nonVolatile
valence: neutral
stacking: noneRefresh
baseChance: 500
defaultDuration: "1◈"
rules: []
```

`packs/_source/abilities/pale-rider-contagion.yml`:

```yaml
# Pale Rider, char_orig_sheets/Copia de Pale Rider.md -- Contagion, Rank A.
# Data sheet: docs/D-servant-data-sheets.md §D.26 · bounded field: Ch. 43
schema: 1
id: pale-rider-contagion
name: "Contagion"
rank: A
kind: skill
slug: contagion
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Passive) The 2 panel area around Pale Rider is the Contagion area. Triggers at the end of
  Pale Rider's Turn for all enemy Units within; and for an enemy Unit that ended its Turn
  within, or Acted and ended that Turn within. Health −100 (not damage); 50% Poison; 10% Charm
  for 1◈. (Active) 9×9 for 1◈ Turns. Cooldown: 4◈ Turns. Under Doomsday Come: affects the NP
  area instead; 75% Poison, 25% Charm; −150 within 3 panels of Pale Rider's Master.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: contagionExpanded, duration: "1◈" }
field:
  passive: true
  geometry:
    kind: followsUnit
    shape: { kind: square, size: 5 }
    overrides:
      # "Instead of its usual Range" -- Doomsday's area wins over the marker.
      - { whileFieldOpen: pale-rider-doomsday-come, sameAs: pale-rider-doomsday-come }
      - { whileOwnerHas: contagionExpanded, shape: { kind: square, size: 9 } }
  membership: { enemyEntry: free, enemyExit: free, allyEntry: free, allyExit: free }
  isolation: null
  interior: []
  interiorEvents:
    - event: unitTurnEnd
      relations: [enemy]
      branches: &contagionBranches
        - predicate: ["self:inField:pale-rider-doomsday-come", "self:withinOfOwnerMaster:3"]
          onFail:
            - { key: HealthLoss, amount: 150 }
            - { key: ApplyEffect, effect: { id: poison }, chance: 75 }
            - { key: ApplyEffect, effect: { id: charm }, duration: "1◈", chance: 25 }
        - predicate: ["self:inField:pale-rider-doomsday-come"]
          onFail:
            - { key: HealthLoss, amount: 100 }
            - { key: ApplyEffect, effect: { id: poison }, chance: 75 }
            - { key: ApplyEffect, effect: { id: charm }, duration: "1◈", chance: 25 }
      onFail:
        - { key: HealthLoss, amount: 100 }
        - { key: ApplyEffect, effect: { id: poison }, chance: 50 }
        - { key: ApplyEffect, effect: { id: charm }, duration: "1◈", chance: 10 }
    - event: turnEnd
      relations: [enemy]
      branches: *contagionBranches
      onFail:
        - { key: HealthLoss, amount: 100 }
        - { key: ApplyEffect, effect: { id: poison }, chance: 50 }
        - { key: ApplyEffect, effect: { id: charm }, duration: "1◈", chance: 10 }
    - event: actedTurnEnd
      relations: [enemy]
      requiresActed: true
      branches: *contagionBranches
      onFail:
        - { key: HealthLoss, amount: 100 }
        - { key: ApplyEffect, effect: { id: poison }, chance: 50 }
        - { key: ApplyEffect, effect: { id: charm }, duration: "1◈", chance: 10 }
  vulnerabilities: []
  onEnd: []
```

If the YAML parser used by `tools/lib/content.mjs` rejects anchors, inline the branches three times.

Add to `test/unit/pale-rider.test.mjs`:

```js
describe("Contagion — the passive field", () => {
  const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));
  it("is passive, follows Pale Rider, and answers three boundaries", () => {
    const f = ability("pale-rider-contagion").field;
    expect(f.passive).toBe(true);
    expect(f.geometry.kind).toBe("followsUnit");
    expect(f.interiorEvents.map((e) => e.event)).toEqual(["unitTurnEnd", "turnEnd", "actedTurnEnd"]);
    for (const e of f.interiorEvents) expect(e.onFail[0]).toEqual({ key: "HealthLoss", amount: 100 });
  });
});
```

- [ ] **Step 8: Run the tests and checks**

Run: `npx vitest run && npm run lint && npm run validate:content`
Expected: PASS. Add `HealthLoss` to the field-action key list in the validator if it rejects it, and `passive`/`overrides`/`branches`/`requiresEffect` to the field-spec keys.

- [ ] **Step 9: Live check, docs, commit**

Live: shut the world down, `npm run build:packs`, relaunch, place a Pale Rider stand-in (any Servant actor given `pale-rider-contagion` and the flag; the real Servant file lands in Task 8) — confirm a Region opens at ready, tints 5×5, tints 9×9 after the Active, and a foe ending its Turn inside loses exactly 100 with Def Up standing.

Docs: `docs/43-bounded-fields.md` §43.3 (a "Geometry that reads the board" paragraph: `overrides`), §43.6 ("Interior events" gains `HealthLoss`, `chance`, `branches`, `unitTurnEnd`), a new §43.9a "Passive fields"; `docs/E-event-reference.md` `fgt.unitTurnEnd` marked dispatched; `docs/45` Pale Rider subsection; CHANGELOG.

```bash
git add -A module/rules module/engine module/data module/fgt.mjs packs/_source test/unit docs CHANGELOG.md
git commit -m "Add passive bounded fields, board-reading geometry and Health-loss field events; author Contagion"
```

---

### Task 3: Doomsday Come's axes, `radiusRoll`, and the extension runner

**Files:**
- Modify: `module/engine/fields.mjs` (`openField` geometry; `expireFields` 329–350)
- Modify: `module/rules/bounded-fields.mjs:496-506` (`extensionFor`)
- Modify: `module/data/regions.mjs` (`lastExtendedAt`)
- Modify: `lang/en.json`
- Create: `packs/_source/abilities/pale-rider-doomsday-come.yml` (axes only; drag-in, Innocent World, Kagome and GotN are added in Tasks 4–7)
- Test: `test/unit/bounded-fields.test.mjs` (`extensionFor` minimum), `test/unit/pale-rider.test.mjs`

**Interfaces:**
- Produces: `geometry.shape.radiusRoll: string` → stored `geometry.radius: number`, `geometry.shape.size = 2*radius+1`; `extension.cost.payer: "owner"|"ownerMaster"`, `extension.cost.minimum: number`; `extensionFor(field, payer)` returns `{ok:false, reason:"belowMinimum"}` when Health < minimum; `field.lastExtendedAt: number|null`.

- [ ] **Step 1: Failing tests**

Append to `test/unit/bounded-fields.test.mjs` in `describe("extensionFor")`:

```js
  it("refuses below the stated minimum even when the amount is affordable", () => {
    const field = labyrinth({ extension: { cost: { kind: "health", amount: 100, payer: "ownerMaster", minimum: 100 }, grants: "1◈", repeatable: true } });
    expect(extensionFor(field, { health: 99 })).toMatchObject({ ok: false, reason: "belowMinimum" });
    expect(extensionFor(field, { health: 100 })).toMatchObject({ ok: true, amount: 100, payer: "ownerMaster" });
  });
```

Append to `test/unit/pale-rider.test.mjs`:

```js
describe("Doomsday Come — the six axes", () => {
  const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));
  it("is a rolled-radius prison around the Master", () => {
    const f = ability("pale-rider-doomsday-come").field;
    expect(f.geometry).toMatchObject({ kind: "followsUnit", unitRef: "ownerMaster", shape: { kind: "square", radiusRoll: "2+1d4" } });
    expect(f.membership).toMatchObject({ enemyExit: "sealed", enemyEntry: "free", allyEntry: "free", allyExit: "free" });
    expect(f.isolation).toMatchObject({ outsideCanTargetInside: false, insideCanTargetOutside: false });
    expect(f.extension.cost).toEqual({ kind: "health", amount: 100, payer: "ownerMaster", minimum: 100 });
    expect(ability("pale-rider-doomsday-come").cooldown).toEqual({ max: "8◈", countFrom: "deactivation" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/bounded-fields.test.mjs test/unit/pale-rider.test.mjs`
Expected: FAIL — `belowMinimum` never returned; file missing.

- [ ] **Step 3: `extensionFor` and the schema**

`module/rules/bounded-fields.mjs#extensionFor`:

```js
export function extensionFor(field, payer) {
  const spec = field.extension;
  if (!spec) return { ok: false, reason: "notExtendable" };

  const amount = spec.cost?.amount ?? 0;
  // Doomsday Come: "cannot be used if the Master's Health is less than 100"
  // -- a floor stated separately from the price, so a payer at exactly 100
  // may pay and one at 99 is never asked.
  const minimum = spec.cost?.minimum ?? amount;
  if (currentHealth(payer) < minimum) return { ok: false, reason: "belowMinimum", amount, minimum };
  if (currentHealth(payer) < amount) return { ok: false, reason: "cannotAfford", amount };

  return { ok: true, amount, payer: spec.cost?.payer ?? "owner", grants: spec.grants, repeatable: Boolean(spec.repeatable) };
}
```

`module/data/regions.mjs` after `expiry`:

```js
      // The tick of the last paid extension: `repeatable: false` is "once",
      // and once needs a record.
      lastExtendedAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
```

Project it in `board.mjs#boundedFieldsOf` beside `expiry`.

- [ ] **Step 4: `radiusRoll` at cast**

In `openField` (fields.mjs), before `const geometry = { ...(specGeometry ?? {}), shape: regionSizedShape(...) }`:

```js
  // Doomsday Come: "an X panel area around Pale Rider's Master ... X = (2 +
  // number rolled on a four-sided die)". Rolled ONCE, here, and the radius is
  // stored: a field whose size re-rolled on every read would breathe.
  let rolledShape = specGeometry?.shape ?? null;
  if (specGeometry?.shape?.radiusRoll) {
    const roll = await new Roll(String(specGeometry.shape.radiusRoll)).evaluate();
    const radius = Math.max(0, roll.total);
    rolledShape = { kind: "square", size: radius * 2 + 1, radius, rolled: roll.total, formula: roll.formula };
  }
  const geometry = {
    ...(specGeometry ?? {}),
    shape: regionSizedShape({ ...(specGeometry ?? {}), shape: rolledShape }, snapshot.warRegion),
    anchor: { ...anchor },
  };
```

- [ ] **Step 5: The extension runner**

`module/engine/fields.mjs#expireFields`:

```js
export async function expireFields(tick) {
  const scene = canvas?.scene ?? null;
  if (!scene) return [];

  /** @type {string[]} */
  const closed = [];
  for (const field of currentBoard().fields ?? []) {
    if (!shouldClose(field, tick)) continue;
    // Axis 5's other half. "After the initial NP period, Pale Rider's Master
    // can extend the NP duration by 1◈ more Turns by reducing its Health by
    // 100 ... and can be repeatedly extended." Chaos Labyrinthos authored the
    // same axis at the start and nothing ever ran it; this is the runner.
    if (field.extension && field.expiry !== null && field.expiry <= tick && await offerExtension(field, tick)) continue;
    if (await endField(field.id)) {
      closed.push(field.id);
      await setCooldownOnDeactivation(field);
    }
  }
  return closed;
}

/**
 * Ask the payer, charge, and push the expiry. `false` when nobody paid.
 *
 * @param {object} field
 * @param {number} tick
 * @returns {Promise<boolean>}
 */
async function offerExtension(field, tick) {
  const spec = field.extension;
  if (!spec.repeatable && field.lastExtendedAt !== null && field.lastExtendedAt !== undefined) return false;
  const payerId = (spec.cost?.payer ?? "owner") === "ownerMaster" ? field.ownerMasterId : field.ownerId;
  const doc = payerId ? game.actors.get(payerId) : null;
  if (!doc) return false;
  const verdict = extensionFor(field, unitSnapshot(doc));
  // Refused OUTRIGHT below the floor: a Master is never asked a question
  // whose answer would kill them.
  if (!verdict.ok) return false;

  const user = game.users.find((u) => u.active && !u.isGM && doc.testUserPermission(u, "OWNER")) ?? game.user;
  const { FGTSocket } = await import("../net/socket.mjs");
  const picked = await FGTSocket.ask(user.id, {
    kind: "choose",
    title: game.i18n.localize("FGT.Field.ExtendTitle"),
    hint: game.i18n.format("FGT.Field.ExtendHint", { name: doc.name, amount: verdict.amount, grants: spec.grants }),
    min: 0,
    count: 1,
    options: [{ id: "extend", name: game.i18n.localize("FGT.Field.Extend") }],
  }).catch(() => null);
  if (!(picked ?? []).includes("extend")) return false;

  const ticks = resolveTicks(parseTick(String(spec.grants)), { turnsPerRound: game.settings.get("fgt", "turnsPerRound") });
  await applyWorldIntents([I.statDelta(doc.id, "health.value", -verdict.amount)], `field:${field.id}:extend`);
  const behavior = behaviorFor(field.id);
  await behavior?.update({ "system.expiry": field.expiry + ticks, "system.lastExtendedAt": tick });
  return true;
}
```

Import `extensionFor` from `../rules/bounded-fields.mjs`. `behaviorFor(fieldId)` exists at line ~593.

`lang/en.json` (beside the `FGT.Paint.*` keys):

```json
  "FGT.Field.ExtendTitle": "Extend the field?",
  "FGT.Field.ExtendHint": "{name} may pay {amount} Health to keep it open for {grants} more.",
  "FGT.Field.Extend": "Pay and extend",
```

- [ ] **Step 6: Content — the axes**

`packs/_source/abilities/pale-rider-doomsday-come.yml`:

```yaml
# Pale Rider -- Doomsday Come: Come to Me, Realm of the Dead, Come to Me.
# Rank EX (NP) [Anti-World]. Data sheet: docs/D-servant-data-sheets.md §D.26.
schema: 1
id: pale-rider-doomsday-come
name: "Doomsday Come: Come to Me, Realm of the Dead, Come to Me"
rank: EX
kind: noblePhantasm
isNP: true
npTags: [antiWorld]
nonDamaging: true
cooldown: { max: "8◈", countFrom: deactivation }
timing: { window: ownTurn }
description: |
  (Non-damaging) An X panel area around Pale Rider's Master becomes the Doomsday Come area,
  X = 2 + 1d4, for 2◈ Turns; it Moves with the Master. Enemy Units within cannot leave; enemy
  Units outside can enter; allied Units Move freely. Units outside cannot Attack Units within
  and vice versa. After the initial period the Master may extend by 1◈ for 100 Health,
  repeatedly (not below 100). An [Anti-World] or higher NP may be used on or within it; the
  area then ends at the end of that Combat Process and its damage inside is halved.
  Cooldown: 8◈ Turns after Doomsday Come ends.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: createField
    target: self
field:
  geometry:
    kind: followsUnit
    unitRef: ownerMaster
    shape: { kind: square, radiusRoll: "2+1d4" }
  membership: { enemyEntry: free, enemyExit: sealed, allyEntry: free, allyExit: free }
  isolation:
    outsideCanTargetInside: false
    insideCanTargetOutside: false
    outsideCanApplyEffectsInside: false
    visibilityAcrossBoundary: full
  duration: "2◈"
  extension:
    cost: { kind: health, amount: 100, payer: ownerMaster, minimum: 100 }
    grants: "1◈"
    repeatable: true
  interior: []
  interiorEvents: []
  vulnerabilities:
    - { kind: ownerDefeat, result: end }
  onEnd: []
```

Check `packs/_source/abilities/asterios-chaos-labyrinthos.yml` for the exact key names of `kind`/`isNP`/`nonDamaging` on an NP and mirror them; the membership vocabulary (`sealed`) must match `membershipVerdict` — use whatever value that function reads for "cannot leave" (`grep -n "sealed\|rollRequired\|trapped" module/rules/bounded-fields.mjs`).

- [ ] **Step 7: Run tests, checks, live**

Run: `npx vitest run && npm run lint && npm run validate:content`
Expected: PASS.

Live: rebuild packs; give the stand-in `pale-rider-doomsday-come` with a Master contracted; cast — a 7×7…13×13 Region around the **Master**; advance to its expiry with the Master at 150 HP — prompt appears, accept, Master at 50, `system.expiry` +1◈ ticks; at 99 HP — no prompt, field closes.

- [ ] **Step 8: Docs and commit**

`docs/43-bounded-fields.md` §43.3 (`radiusRoll`), §43.7 ("Extension" — the runner exists; `payer`, `minimum`, `lastExtendedAt`; Chaos Labyrinthos' extension now works); `docs/45` (Asterios extension row → repaired); CHANGELOG.

```bash
git add -A module packs/_source lang test/unit docs CHANGELOG.md
git commit -m "Run bounded-field extensions and roll a field's radius at cast; author Doomsday Come's axes"
```

---

### Task 4: The Anti-World escape and the drag-in

**Files:**
- Modify: `module/rules/bounded-fields.mjs:307-327` (`isolationBlocks`), `:517-560` (`vulnerabilityTriggered`)
- Modify: `module/rules/options.mjs` (attack options), `module/engine/attack.mjs` (`attackFacts`; Process-end vulnerability check)
- Modify: `module/rules/targeting/vocabulary.mjs:149-150`, `module/rules/targeting/resolve.mjs:348-420`
- Modify: `module/rules/items.mjs` (`fieldOpen` requirement), `tools/lib/content.mjs:76`
- Modify: `module/engine/skill-use.mjs:412` (new `dragInto` phase), `:1199` (`CASTER_PHASES` — no; `dragInto` is per-target)
- Modify: `module/engine/fields.mjs` (export `randomFreePanelIn(field, board)`)
- Modify: `packs/_source/abilities/pale-rider-doomsday-come.yml` (interior −50% rule, `npScaleUsedOn` vulnerability)
- Create: `packs/_source/abilities/pale-rider-doomsday-drag.yml`
- Test: `test/unit/bounded-fields.test.mjs`, `test/unit/options.test.mjs`, `test/unit/targeting.test.mjs` (or the file that tests `resolveAnchor`), `test/unit/pale-rider.test.mjs`

**Interfaces:**
- Produces: `isolation.piercedBy: {npScale: string}`; `attack:npScale:gte:<tag>` options (ladder); `vulnerabilities[].kind === "npScaleUsedOn"` with `scale`, `result`, `when: "combatProcessEnd"`; anchor `{kind: "fieldEdge", fieldId, range}`; phase `{kind: "dragInto", fieldId}`; requirement `{kind: "fieldOpen", field}`; `randomFreePanelIn(field, board) → panel|null` (pure, exported from `rules/bounded-fields.mjs`, takes a `random` callback).

- [ ] **Step 1: Failing tests**

`test/unit/bounded-fields.test.mjs`:

```js
describe("isolation — piercedBy", () => {
  const doomsday = () => labyrinth({
    id: "doomsday", isolation: { outsideCanTargetInside: false, insideCanTargetOutside: false, piercedBy: { npScale: "antiWorld" } },
  });
  it("opens for an Anti-World NP from outside, and not for an Anti-Army one", () => {
    const board = { units: [inside(), outside()] };
    expect(isolationBlocks(doomsday(), outside(), inside(), board, { npTags: ["antiWorld"] })).toEqual({ blocked: false });
    expect(isolationBlocks(doomsday(), outside(), inside(), board, { npTags: ["antiArmy"] }).blocked).toBe(true);
    expect(isolationBlocks(doomsday(), outside(), inside(), board, {}).blocked).toBe(true);
  });
});

describe("vulnerability — npScaleUsedOn", () => {
  it("ends the field when an NP of the scale or above is used on it", () => {
    const field = labyrinth({ vulnerabilities: [{ kind: "npScaleUsedOn", scale: "antiWorld", result: "end", when: "combatProcessEnd" }] });
    expect(vulnerabilityTriggered(field, { kind: "npUsedOn", npTags: ["antiWorld"] })).toEqual({ triggered: true, result: "end" });
    expect(vulnerabilityTriggered(field, { kind: "npUsedOn", npTags: ["antiArmy"] }).triggered).toBe(false);
  });
});

describe("randomFreePanelIn", () => {
  it("returns an unoccupied panel of the field, chosen by the supplied random", () => {
    const field = labyrinth({ geometry: { kind: "fixedArea", shape: { kind: "square", size: 3 }, anchor: at(1, 1) } });
    const board = { units: [inside({ panel: at(0, 0) })] };
    const picked = randomFreePanelIn(field, board, () => 0);
    expect(picked).toEqual(at(0, 1));
  });
});
```

`test/unit/options.test.mjs` — add:

```js
it("attack:npScale:gte is a ladder up the NP scale", () => {
  const o = rollOptionsFor({ attacker: { id: "a" }, defender: { id: "b" }, attack: { kind: "np", npTags: ["antiArmy"] } });
  expect(o.has("attack:npScale:gte:antiUnit")).toBe(true);
  expect(o.has("attack:npScale:gte:antiArmy")).toBe(true);
  expect(o.has("attack:npScale:gte:antiWorld")).toBe(false);
});
```

Resolver test (add to the file that already tests `resolveAnchor` — `grep -l "withinRange" test/unit/*.test.mjs`):

```js
it("fieldEdge measures from the nearest panel of the field, not the caster", () => {
  const field = { id: "doomsday", geometry: { kind: "fixedArea", shape: { kind: "square", size: 3 }, anchor: { i: 10, j: 10 } } };
  const foe = { id: "foe", faction: "b", panel: { i: 10, j: 13 } };          // 2 from the edge (j=11)
  const far = { id: "far", faction: "b", panel: { i: 10, j: 14 } };          // 3 from the edge
  const caster = { id: "pale", faction: "a", panel: { i: 0, j: 0 }, range: 1 };
  const board = { units: [caster, foe, far], fields: [field] };
  const spec = { kind: "fieldEdge", fieldId: "doomsday", range: 2 };
  const errors = [];
  expect(resolveAnchor(spec, caster, board, { unitId: "foe" }, errors).unitId).toBe("foe");
  expect(errors).toEqual([]);
  resolveAnchor(spec, caster, board, { unitId: "far" }, errors);
  expect(errors[0]).toMatch(/3 panels from/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/bounded-fields.test.mjs test/unit/options.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Rules — `piercedBy`, `npScaleUsedOn`, `randomFreePanelIn`, options**

`isolationBlocks`, after the command-spell branch:

```js
  // Doomsday Come: "A Noble Phantasm of [Anti-World] or higher can be used on
  // Doomsday Come (from outside) or within Doomsday Come." The one hole in
  // an otherwise sealed boundary, keyed on the NP scale ladder.
  if (rules.piercedBy?.npScale && meetsTagThreshold(ctx.npTags ?? [], rules.piercedBy.npScale)) {
    return { blocked: false };
  }
```

`vulnerabilityTriggered`, a new case:

```js
      case "npScaleUsedOn":
        // "If used in this way, Doomsday Come is forcibly ended at the end of
        // that Combat Process." The caller fires `npUsedOn` at Process end.
        if (event.kind === "npUsedOn" && meetsTagThreshold(event.npTags ?? [], v.scale)) {
          return { triggered: true, result: v.result ?? "end" };
        }
        break;
```

New export in `bounded-fields.mjs`:

```js
/**
 * A random unoccupied panel of the field. Doomsday's drag-in "placed on a
 * random panel within" and a banished Spirit's return both need one.
 *
 * @param {object} field
 * @param {object} board
 * @param {() => number} random `[0, 1)`; injected so the rule stays pure
 * @returns {{i: number, j: number}|null}
 */
export function randomFreePanelIn(field, board, random = Math.random) {
  const taken = new Set((board?.units ?? []).filter((u) => u.panel && !u.defeated).map((u) => `${u.panel.i},${u.panel.j}`));
  const free = panelsOf(field, board).filter((p) => !taken.has(`${p.i},${p.j}`));
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))];
}
```

`module/rules/options.mjs` — in the `attack:` block, after `attack:element`:

```js
  // The NP scale, as a ladder: an [Anti-Army] NP is also "[Anti-Unit] or
  // higher". Doomsday Come's boundary and its −50% both ask this.
  const scale = scaleOf(attack.npTags ?? []);
  if (scale) {
    for (const tag of NP_TAG_SCALE) {
      options.add(`attack:npScale:gte:${tag}`);
      if (tag === scale) break;
    }
  }
```

Import `scaleOf, NP_TAG_SCALE` from `./bounded-fields.mjs` (check `scaleOf` returns the tag id; if it returns an index, compare indices). Add `/^attack:npScale:gte:[A-Za-z]+$/,` to `EMITTABLE`. In `attack.mjs#attackFacts` add `npTags: ability?.system?.npTags ?? []` to the returned object.

- [ ] **Step 4: The `fieldEdge` anchor and the `fieldOpen` requirement**

`module/rules/targeting/vocabulary.mjs` `TARGET_ANCHORS`: add

```js
  {
    id: "fieldEdge",
    label: "A unit within N panels of a bounded field's edge",
    args: ["fieldId", "range"],
  },
```

and `fieldEdge` to `ANCHOR_IDS` if it is a separate list.

`resolveAnchor` — new case after `targetUnit`:

```js
    case "fieldEdge": {
      // Doomsday Come's drag-in: "if there are any enemy Units within a 2
      // panel area of the Doomsday Come area". Measured from the NEAREST
      // panel of the field, which is why `targetUnit` -- measured from the
      // caster -- cannot say it.
      const field = (board.fields ?? []).find((f) => f.id === spec.fieldId);
      if (!field) {
        errors.push("That field is not open.");
        return { ...base, panel: casterPanel };
      }
      const unit = (board.units ?? []).find((u) => u.id === placement.unitId);
      if (!unit?.panel) {
        errors.push("Choose a target.");
        return { ...base, panel: casterPanel };
      }
      const edge = Math.min(...panelsOf(field, board).map((p) => geo.chebyshev(p, unit.panel)));
      const r = spec.range ?? 1;
      if (edge === 0) errors.push(`${unit.name ?? "Target"} is already inside.`);
      else if (edge > r) errors.push(`${unit.name ?? "Target"} is ${edge} panels from the field; Range is ${r}.`);
      return { ...base, panel: unit.panel, panels: unit.panels ?? [unit.panel], unitId: unit.id };
    }
```

Import `panelsOf` from `../bounded-fields.mjs`. Isolation step 5 must **not** refuse this anchor (the caster is outside targeting an outsider, so it already passes).

`module/rules/items.mjs#meetsRequirement` — new kind:

```js
    case "fieldOpen":
      // Doomsday Drag exists only while Doomsday Come stands.
      return (ctx.board?.fields ?? []).some((f) => f.id === req.field)
        ? { ok: true }
        : { ok: false, reason: `${req.field} is not open` };
```

Add `"fieldOpen"` to `REQUIREMENT_KINDS` in `tools/lib/content.mjs:76` and to the `REQUIREMENT_KINDS` export in `rules/items.mjs` (the same list `emiya.test.mjs` imports).

- [ ] **Step 5: The `dragInto` phase and the Process-end check (engine)**

`module/engine/skill-use.mjs`, a new case beside `createField`:

```js
        case "dragInto": {
          // Doomsday Come: "that target has to perform an Evade roll. If the
          // Evade failed, the DU is forcibly dragged into the Doomsday Come
          // area and placed on a random panel within." An attack in every
          // structural sense except damage (Ch. 43): it spends the attack
          // budget and marks `acted`, and never opens a Combat Process.
          const field = board.fields.find((f) => f.id === phase.fieldId);
          if (!field) break;
          const roll = await new Roll("1d20").evaluate();
          const plan = checkPlan(snapshot, "evade");
          const outcome = evade({
            roll: roll.total, agility: snapshot.agility,
            hasDodge: (snapshot.effects ?? []).includes("dodge"),
            forceUnfavourable: plan.forceTable === "unfavourable",
            autoSucceed: plan.autoSucceed, modifiers: plan.modifiers,
          });
          if (outcome.success) {
            applied.push({ summary: { id: "dragInto", name: doc.name, outcome: "resisted", reason: `Evade ${roll.total}` } });
            break;
          }
          const panel = randomFreePanelIn(field, board);
          if (!panel) {
            applied.push({ summary: { id: "dragInto", name: doc.name, outcome: "failed", reason: "noRoom" } });
            break;
          }
          const token = doc.getActiveTokens?.()[0]?.document ?? null;
          if (!token) break;
          await token.update({ x: panel.j * canvas.scene.grid.size, y: panel.i * canvas.scene.grid.size }, { fgtForced: true });
          await runContactEvents([doc.id], [field.id]);
          applied.push({ summary: { id: "dragInto", name: doc.name, outcome: "applied", reason: `Evade ${roll.total}` } });
          break;
        }
```

Import `evade, checkPlan` from `../rules/checks.mjs`, `randomFreePanelIn` from `../rules/bounded-fields.mjs`, and export `runContactEvents` from `movement-hooks.mjs` (it is module-private at line ~380; make it `export`). The ability's `countsAsAttack` must be true so the budget/`acted` path runs — check `rules/ability-use.mjs#countsAsAttack` and add `phases.some(p => p.kind === "dragInto")` to its test.

`module/engine/attack.mjs` — at the Process completion point (where `resumeDeferredAttack` lives / the function that runs after `fireDamageDealt`; search `Presence Concealment clause 5` at line ~650 and add beside that end-of-Process step):

```js
/**
 * Doomsday Come: "If used in this way, Doomsday Come is forcibly ended at the
 * end of that Combat Process." Every open field's own vulnerability list is
 * asked; the first field that answers `end` is closed.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function closeFieldsPiercedBy(state) {
  const npTags = state.attack?.npTags ?? [];
  if (state.attack?.kind !== "np" || npTags.length === 0) return;
  const { vulnerabilityTriggered } = await import("../rules/bounded-fields.mjs");
  const { deactivateField } = await import("./fields.mjs");
  for (const field of currentBoard().fields ?? []) {
    const hit = vulnerabilityTriggered(field, { kind: "npUsedOn", npTags });
    if (hit.triggered && hit.result === "end") await deactivateField(field.id, "vulnerability");
  }
}
```

Call `await closeFieldsPiercedBy(state);` at the end of the Process, after the damage step and riders. Confirm `state.attack.npTags` is populated (the same `attackFacts` addition from Step 3 — if `state.attack` is built elsewhere, stamp `npTags` there too).

- [ ] **Step 6: Content**

Add to `pale-rider-doomsday-come.yml`:

```yaml
  isolation:
    outsideCanTargetInside: false
    insideCanTargetOutside: false
    outsideCanApplyEffectsInside: false
    visibilityAcrossBoundary: full
    piercedBy: { npScale: antiWorld }
  interior:
    # "all Units within it receive the damage from that NP, but its Total
    # Damage is reduced by 50%." Everyone inside, ally or enemy.
    - key: DamageModifier
      direction: taken
      value: -50
      relations: [ally, enemy, self]
      predicate: ["attack:npScale:gte:antiWorld"]
  vulnerabilities:
    - { kind: ownerDefeat, result: end }
    - { kind: npScaleUsedOn, scale: antiWorld, result: end, when: combatProcessEnd }
passiveRules: []
```

Interior `predicate` is honoured from Task 5; until then the −50% applies to every attack inside — Task 5 lands before live-testing this clause, and the plan's test table pins it there.

`packs/_source/abilities/pale-rider-doomsday-drag.yml`:

```yaml
# Doomsday Come's drag-in, as its own ability so the HUD can offer it and the
# once-per-Turn gate has something to count.
schema: 1
id: pale-rider-doomsday-drag
name: "Doomsday Come: Drag"
kind: skill
slug: doomsdayDrag
countsAsAttack: true
oncePerTurn: true
timing: { window: ownTurn }
requirements:
  - { kind: fieldOpen, field: pale-rider-doomsday-come }
description: |
  During Pale Rider's Turn, if there are any enemy Units within a 2 panel area of the
  Doomsday Come area, Pale Rider can target one; it performs an Evade roll. If failed, it is
  dragged into Doomsday Come and placed on a random panel within. Once per Turn.
targeting:
  anchor: { kind: fieldEdge, fieldId: pale-rider-doomsday-come, range: 2 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: caster }
phases:
  - kind: dragInto
    target: reuse
    fieldId: pale-rider-doomsday-come
```

Mirror the exact `oncePerTurn`/`countsAsAttack` key names from an existing skill that has them (`grep -rn "oncePerTurn\|countsAsAttack" packs/_source/abilities | head`).

- [ ] **Step 7: Run tests, checks, live**

Run: `npx vitest run && npm run lint && npm run validate:content`
Expected: PASS (add `dragInto` to the validator's phase kinds, `fieldEdge` to its anchor kinds, `piercedBy`/`npScaleUsedOn` to the field keys as needed).

Live: with Doomsday open and a foe 2 panels from its edge — Drag refused beyond 2, offered at 2; a failed Evade lands the foe on a free panel inside and `contact` fires (visible in the log). Chaos Labyrinthos-scale NP from outside refused by isolation; an `antiWorld`-tagged NP allowed, damage inside −50%, field closes at Process end and the cooldown starts.

- [ ] **Step 8: Docs and commit**

`docs/09-targeting.md` (the `fieldEdge` anchor); `docs/43` §43.5 (`piercedBy`), §43.8 (`npScaleUsedOn`), §43.11a (drag-in as a non-damaging attack); `docs/24-rules-engine.md` (`attack:npScale:gte`, `fieldOpen` requirement); `docs/45`; CHANGELOG.

```bash
git add -A module packs/_source tools test/unit docs CHANGELOG.md
git commit -m "Let an Anti-World NP pierce and end Doomsday Come, and drag enemies into it from its edge"
```

---

### Task 5: Innocent World

**Files:**
- Modify: `module/rules/options.mjs` (three unit-side option families; `EMITTABLE`)
- Modify: `module/rules/bounded-fields.mjs:341-354` (`interiorModifiers` predicate)
- Modify: `module/rules/elements.mjs:653-660` (`VulnerabilityAmplifier.polarity`)
- Modify: `module/engine/scheduler.mjs:1004-1008` (amplifier consumer, polarity)
- Modify: `module/rules/budget.mjs:146-158` (`preventedBy`)
- Create: `packs/_source/abilities/pale-rider-innocent-world.yml`
- Modify: `packs/_source/abilities/pale-rider-doomsday-come.yml` (interior rules)
- Test: `test/unit/options.test.mjs`, `test/unit/bounded-fields.test.mjs`, `test/unit/budget.test.mjs`, `test/unit/pale-rider.test.mjs`

**Interfaces:**
- Produces: `self:highestParameter:<str|end|agi|mag|luc>` (one per tie), `self:npAboveAllParameters`, `self:stableDie:d6:<1-6>`; interior rules honour `predicate`; `vulnerabilityAmplifiers[].polarity: "debuff"|null`; `preventedBy(unit, action)` reads `unit.suppressions[].scope === "npSeal"`.

- [ ] **Step 1: Failing tests**

`test/unit/options.test.mjs`:

```js
describe("Innocent World's option families", () => {
  const unit = (parameters, abilities = []) => ({ id: "u", parameters, abilities });
  it("emits every Parameter tied for highest", () => {
    const o = rollOptionsFor({ attacker: unit({ str: "A", end: "A", agi: "B", mag: "C", luc: "E" }) });
    expect(o.has("self:highestParameter:str")).toBe(true);
    expect(o.has("self:highestParameter:end")).toBe(true);
    expect(o.has("self:highestParameter:agi")).toBe(false);
  });
  it("says when an NP outranks every Parameter", () => {
    const o = rollOptionsFor({ attacker: unit({ str: "C", end: "C", agi: "C", mag: "C", luc: "C" }, [{ isNP: true, rank: "A" }]) });
    expect(o.has("self:npAboveAllParameters")).toBe(true);
    const tie = rollOptionsFor({ attacker: unit({ str: "A", end: "C", agi: "C", mag: "C", luc: "C" }, [{ isNP: true, rank: "A" }]) });
    expect(tie.has("self:npAboveAllParameters")).toBe(false);
  });
  it("gives a unit with no Parameters one stable die face", () => {
    const a = rollOptionsFor({ attacker: { id: "master-1", parameters: {} } });
    const b = rollOptionsFor({ attacker: { id: "master-1", parameters: {} } });
    const faces = [...a].filter((x) => x.startsWith("self:stableDie:d6:"));
    expect(faces).toHaveLength(1);
    expect([...b]).toContain(faces[0]);
    expect(Number(faces[0].split(":").pop())).toBeGreaterThanOrEqual(1);
    expect(Number(faces[0].split(":").pop())).toBeLessThanOrEqual(6);
    expect(rollOptionsFor({ attacker: unit({ str: "C" }) }).has(faces[0])).toBe(false);
  });
});
```

`test/unit/bounded-fields.test.mjs`:

```js
describe("interior rules with a predicate", () => {
  it("lands only on units whose own options satisfy it", () => {
    const field = labyrinth({ interior: [{ key: "CheckModifier", check: "evade", direction: "outgoing", value: 4, relations: ["enemy"], predicate: ["self:highestParameter:agi"] }] });
    const agile = inside({ parameters: { str: "C", agi: "A" } });
    const slow = inside({ parameters: { str: "A", agi: "C" } });
    expect(interiorModifiers(field, agile, { units: [agile] })).toHaveLength(1);
    expect(interiorModifiers(field, slow, { units: [slow] })).toHaveLength(0);
  });
});
```

`test/unit/budget.test.mjs`:

```js
it("a standing npSeal suppression refuses a Noble Phantasm the way the effect does", () => {
  const unit = { effects: [], suppressions: [{ scope: "npSeal", source: "doomsday" }] };
  expect(preventedBy(unit, "np")).toEqual({ prevented: true, by: "npSeal" });
  expect(preventedBy(unit, "skill").prevented).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/unit/options.test.mjs test/unit/bounded-fields.test.mjs test/unit/budget.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Options**

`module/rules/options.mjs`, in the unit-side builder after the `rank:` loop (line ~10 of the excerpt at ~line 200; the loop that emits `${side}:rank:${parameter}:gte:${grade}`):

```js
  // Innocent World keys on WHICH Parameter is highest. Emitted once per
  // Parameter tied for the top -- "if the Unit has two or more Parameters of
  // the same Rank, it is affected by all related effects" -- so a tie is set
  // membership, not a special case.
  const params = Object.entries(unit.parameters ?? {})
    .map(([p, r]) => [p, rankOrNull(r)])
    .filter(([, r]) => r);
  if (params.length > 0) {
    const top = params.reduce((best, [, r]) => (best === null || Rank.compare(r, best) > 0 ? r : best), null);
    for (const [p, r] of params) if (Rank.equals(r, top)) options.add(`${side}:highestParameter:${p}`);
    // "If the Unit has any NP whose Rank is higher than all its Parameters."
    const npRanks = (unit.abilities ?? []).filter((a) => a.isNP).map((a) => rankOrNull(a.rank)).filter(Boolean);
    if (npRanks.some((r) => Rank.compare(r, top) > 0)) options.add(`${side}:npAboveAllParameters`);
  } else if (unit.id) {
    // "If a Unit has no Parameters, roll a six-sided die ... that Unit will
    // receive the same effect every time." A hash of the id folded to 1–6:
    // random-looking, identical on every read, no state to store.
    options.add(`${side}:stableDie:d6:${stableDie(unit.id, 6)}`);
  }
```

Helpers at the bottom of the file:

```js
/** @param {unknown} r @returns {Rank|null} */
function rankOrNull(r) {
  try { return r instanceof Rank ? r : Rank.parseOrNull(r == null ? null : String(r)); } catch { return null; }
}

/**
 * A stable die face for an id. FNV-1a, folded.
 * @param {string} id
 * @param {number} faces
 * @returns {number} 1..faces
 */
function stableDie(id, faces) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % faces) + 1;
}
```

Import `Rank` from `../domain/rank.mjs`. `unit.parameters` on a snapshot is the output of `applyGrantedSteps(parseParameters(...))` — confirm whether values are `Rank` instances or strings and adapt `rankOrNull`. `unit.abilities[]` carries `isNP`/`rank` from `collectAbilities` (snapshot.mjs:174) — confirm the key names with `grep -n "isNP\|rank:" module/rules/snapshot.mjs` in `collectAbilities`.

Add to `EMITTABLE`:

```js
  /^(self|target):highestParameter:(str|end|agi|mag|luc)$/,
  /^(self|target):npAboveAllParameters$/,
  /^(self|target):stableDie:d6:[1-6]$/,
```

- [ ] **Step 4: Interior predicates, amplifier polarity, npSeal scope**

`interiorModifiers`:

```js
export function interiorModifiers(field, unit, board) {
  if (!contains(field, unit?.panel, board)) return [];
  const relation = relationTo(field, unit, board);
  // Innocent World: six rules on one field, each for a different kind of
  // unit. A rule's `predicate` was authored, collected and dropped --
  // executors receive `ctx: {}` and no `deferred` -- so it is tested here,
  // against the unit's OWN options, before the rule is handed on.
  let options = null;
  const holds = (rule) => {
    if (!rule.predicate) return true;
    options ??= rollOptionsFor({ attacker: unit });
    return testPredicate(rule.predicate, { options });
  };

  return (field.interior ?? [])
    .filter((rule) => (rule.relations ?? ["ally", "enemy"]).includes(relation))
    .filter((rule) => !rule.kinds || rule.kinds.includes(unit?.kind))
    .filter((rule) => !isExempt(rule.exemptIf, unit, board))
    .filter(holds)
    .map(({ predicate, ...rule }) => ({ ...rule, field: field.id, source: field.id }));
}
```

Import `rollOptionsFor` from `./options.mjs` — **check for an import cycle** (`options.mjs` must not import `bounded-fields.mjs` at module top; Task 4 imported `scaleOf`/`NP_TAG_SCALE` from it — move those two constants/functions into `module/rules/np-scale.mjs` and import from there in both files if `check-layers`/vitest reports a cycle). The `predicate` is stripped from the forwarded rule so `annotateFields`' executor pass does not defer it a second time.

`elements.mjs#VulnerabilityAmplifier` — push `polarity: el.polarity ?? null` beside `effectId`. `scheduler.mjs` amplifier consumer (line ~1004):

```js
  for (const amp of unit?.vulnerabilityAmplifiers ?? []) {
    // Innocent World MAG: "Total Debuff Damage taken is increased by 50%" --
    // every debuff, keyed on polarity rather than on one effect id.
    const byPolarity = amp.polarity && ctx.effectDef?.(defId)?.polarity === amp.polarity;
    if (!byPolarity && amp.effectId !== defId) continue;
    if (byPolarity || isWeakTo(unit, defId)) out *= amp.factor;
  }
```

Confirm the function's signature has `ctx` (it is the periodic-damage helper; if it receives only `(unit, defId, amount)`, thread `ctx.effectDef` from its caller at line ~947).

`budget.mjs#preventedBy`:

```js
export function preventedBy(unit, action) {
  const held = unit?.effects ?? [];
  const blanket = PREVENT_ALL.find((id) => held.includes(id));
  if (blanket) return { prevented: true, by: blanket };

  for (const [id, actions] of Object.entries(PREVENTS)) {
    if (!held.includes(id)) continue;
    if (actions.includes(action)) return { prevented: true, by: id };
  }
  // A STANDING seal -- Innocent World clause 6, "affected with NP Seal ...
  // cannot be prevented or removed as long as a Unit is within Doomsday
  // Come". An interior annotation rather than an applied effect: present
  // exactly while the unit stands inside, gone when it leaves, nothing for
  // Dispel to find. Same table, same answer.
  for (const s of unit?.suppressions ?? []) {
    if (s.scope in PREVENTS && PREVENTS[s.scope].includes(action)) return { prevented: true, by: s.scope };
  }
  return { prevented: false, by: null };
}
```

- [ ] **Step 5: Content**

`packs/_source/abilities/pale-rider-innocent-world.yml` — a passive whose rules live on Doomsday's field (this file is the sheet entry and the description; it carries no rules):

```yaml
# Pale Rider -- Innocent World, Rank EX. Its six clauses are INTERIOR RULES
# of Doomsday Come (`pale-rider-doomsday-come.yml`), because they are facts
# about standing inside that area and nothing else; this file is the sheet
# entry the actor shows.
schema: 1
id: pale-rider-innocent-world
name: "Innocent World"
rank: EX
kind: skill
slug: innocentWorld
passive: true
description: |
  (Passive) Constantly affects all enemy Units within Doomsday Come, by their highest
  Parameter: STR — damage dealt −50% (NP −25%); END — damage taken +50% (NP +25%); AGI —
  Evade rolls +4; MAG — debuff chance +50% and Total Debuff Damage +50%; LUC — Luck Check
  rolls +4; any NP ranked above every Parameter — NP Seal. No Parameters: a stable d6. Ties
  apply every matching effect. Cannot be prevented or removed while inside.
passiveRules: []
```

Doomsday's `interior:` list gains, after the −50% rule:

```yaml
    - { key: DamageModifier, direction: dealt, value: -50, npValue: -25, relations: [enemy],
        predicate: [{ or: ["self:highestParameter:str", "self:stableDie:d6:1"] }] }
    - { key: DamageModifier, direction: taken, value: 50, npValue: 25, relations: [enemy],
        predicate: [{ or: ["self:highestParameter:end", "self:stableDie:d6:2"] }] }
    - { key: CheckModifier, check: evade, direction: outgoing, value: 4, relations: [enemy],
        predicate: [{ or: ["self:highestParameter:agi", "self:stableDie:d6:3"] }] }
    - { key: ApplicationChance, direction: incoming, severity: normal, value: 50, relations: [enemy],
        predicate: [{ or: ["self:highestParameter:mag", "self:stableDie:d6:4"] }] }
    - { key: VulnerabilityAmplifier, polarity: debuff, factor: 1.5, relations: [enemy],
        predicate: [{ or: ["self:highestParameter:mag", "self:stableDie:d6:4"] }] }
    - { key: CheckModifier, check: luck, direction: outgoing, value: 4, relations: [enemy],
        predicate: [{ or: ["self:highestParameter:luc", "self:stableDie:d6:5"] }] }
    - { key: Suppress, scope: npSeal, relations: [enemy],
        predicate: [{ or: ["self:npAboveAllParameters", "self:stableDie:d6:6"] }] }
```

Mirror the exact `CheckModifier`/`ApplicationChance` argument names from `jack-the-mist.yml` (its Evade +3 clause) and `class-skills/magic-resistance.yml`.

Add to `pale-rider.test.mjs`:

```js
describe("Innocent World — six interior rules", () => {
  it("lands the AGI clause on an agile enemy inside and nothing on a strong one", () => {
    const f = ability("pale-rider-doomsday-come").field;
    const field = { id: "pale-rider-doomsday-come", ownerId: "pale", ownerFaction: "a", geometry: { kind: "freeform" }, panels: [{ i: 0, j: 0 }], interior: f.interior };
    const agile = { id: "e", kind: "servant", faction: "b", panel: { i: 0, j: 0 }, parameters: { str: "C", end: "C", agi: "A", mag: "C", luc: "C" }, abilities: [], effects: [] };
    const rules = interiorModifiers(field, agile, { units: [agile], alliances: {} });
    expect(rules.map((r) => r.key)).toEqual(["CheckModifier"]);
    expect(rules[0].check).toBe("evade");
  });
});
```

(import `interiorModifiers` from `bounded-fields.mjs` and define `ability` at the top of the file.)

- [ ] **Step 6: Run tests, checks, live**

Run: `npx vitest run && npm run lint && npm run validate:content && node tools/check-layers.mjs`
Expected: PASS.

Live: EMIYA (AGI A) inside Doomsday — Evade roll shows +4; a Master inside shows exactly one clause (check `unitSnapshot(master).checkModifiers/modifiers/suppressions`); a Servant with an EX NP and A Parameters inside — NP use refused "npSeal"; step out — allowed.

- [ ] **Step 7: Docs and commit**

`docs/24-rules-engine.md` (three option families; interior `predicate`); `docs/43` §43.6 ("Interior rules carry predicates"); `docs/06-stats-and-resources.md` (highest-Parameter ties); `docs/45`; CHANGELOG.

```bash
git add -A module packs/_source test/unit docs CHANGELOG.md
git commit -m "Predicate interior rules on the unit they land on, and author Innocent World"
```

---

### Task 6: Guidance of the Netherworld and the GotN discharge

**Files:**
- Modify: `module/engine/fields.mjs#runFieldEvent` (`requiresEffect` filter, `RemoveEffect` action)
- Create: `packs/_source/effects/gotn.yml`, `packs/_source/abilities/pale-rider-guidance-of-the-netherworld.yml`
- Modify: `packs/_source/abilities/pale-rider-doomsday-come.yml` (`interiorEvents` contact clause)
- Test: `test/unit/pale-rider.test.mjs`

**Interfaces:**
- Produces: interior event `requiresEffect: <effectId>`; action `{key: "RemoveEffect", effect: {id}}`.

- [ ] **Step 1: Failing test**

```js
describe("Guidance of the Netherworld", () => {
  it("applies three buffs to allies within 2 and then marks everyone but Pale Rider", () => {
    const a = ability("pale-rider-guidance-of-the-netherworld");
    expect(a.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    const [buffs, mark] = a.phases;
    expect(buffs.effects.map((e) => e.id)).toEqual(["atkUp", "regen", "dmgCut"]);
    expect(buffs.effects[2]).toMatchObject({ magnitude: 100, uses: 3, duration: "1◈" });
    expect(mark).toMatchObject({ kind: "applyEffects", includeSelf: false, effects: [{ id: "gotn" }] });
  });
  it("discharges on contact with Doomsday for a bearer, then removes the marker", () => {
    const contact = ability("pale-rider-doomsday-come").field.interiorEvents.find((e) => e.requiresEffect === "gotn");
    expect(contact).toMatchObject({ event: "contact", relations: ["ally"] });
    expect(contact.onFail.at(-1)).toEqual({ key: "RemoveEffect", effect: { id: "gotn" } });
  });
  it("GotN is neither buff nor debuff and unremovable", () => {
    expect(effect("gotn")).toMatchObject({ polarity: "status", valence: "neither", unremovable: true, rules: [] });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run test/unit/pale-rider.test.mjs` → FAIL (files missing).

- [ ] **Step 3: Engine**

In `runFieldEvent`'s `inside` filter, after the `kinds` line:

```js
    // Guidance of the Netherworld: "When a Unit with the 'GotN' effect enters
    // the area of Doomsday Come" -- the mirror of `kinds`, on the effects the
    // unit carries.
    && (!spec.requiresEffect || (u.effects ?? []).map((e) => e?.defId ?? e).includes(spec.requiresEffect))
```

In the `onFail` loop, before `ApplyEffect`:

```js
      // "... then remove the 'GotN' effect from that Unit."
      if (action.key === "RemoveEffect") {
        out.push(I.removeEffect(unit.id, action.effect?.id ?? action.effect?.defId ?? action.effect, "field"));
        continue;
      }
```

`includeSelf: false` on an `applyEffects` phase: confirm `applyPhaseEffects`/`phaseTargets` (skill-use.mjs:610 and the `phaseTargets` helper) already honours `includeSelf` on a phase; if only the targeting `selection` does, add `if (phase.includeSelf === false && target.unitId === actor.id) continue;` at the top of the per-target loop in `useSkill`.

- [ ] **Step 4: Content**

`packs/_source/effects/gotn.yml`:

```yaml
# Guidance of the Netherworld's marker. "Neither a buff or a debuff and is
# Unremovable." Stores nothing: the bundle it discharges is authored on the
# one field that will ever discharge it (Doomsday Come's contact clause).
schema: 1
id: gotn
name: "GotN"
description: "On entering Doomsday Come, receives Guidance of the Netherworld's three effects; then removed."
polarity: status
volatility: nonVolatile
valence: neither
stacking: noneRefresh
baseChance: 500
unremovable: true
rules: []
```

`packs/_source/abilities/pale-rider-guidance-of-the-netherworld.yml`:

```yaml
# Pale Rider -- Guidance of the Netherworld, Rank EX.
schema: 1
id: pale-rider-guidance-of-the-netherworld
name: "Guidance of the Netherworld"
rank: EX
kind: skill
slug: guidanceOfTheNetherworld
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Affects all allied Units within a 2 panel area of itself:
  1. Atk Up for 1◈ Turns, +20% damage dealt (NP +10%). 2. Regen for 1◈ Turns, 10% of max
  Health at the end of the Unit's Turn, any Turn it Acts, and the Round. 3. Dmg Cut for 1◈
  Turns, 3 times; damage taken −100. Then applies GotN to all affected Units except itself.
  Cooldown: 4◈ Turns.
targeting:
  anchor: { kind: self }
  shape: { kind: chebyshevRadius, r: 2 }
  selection: { relations: [ally, self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    target: reuse
    effects:
      - { id: atkUp, magnitude: 20, npMagnitude: 10, duration: "1◈" }
      - { id: regen, duration: "1◈" }
      - { id: dmgCut, magnitude: 100, uses: 3, duration: "1◈" }
  - kind: applyEffects
    target: reuse
    includeSelf: false
    effects:
      - { id: gotn }
```

Doomsday's `interiorEvents:` gains:

```yaml
    - event: contact
      relations: [ally]
      requiresEffect: gotn
      onFail:
        - { key: ApplyEffect, effect: { id: atkUp, magnitude: 20, npMagnitude: 10 }, duration: "1◈" }
        - { key: ApplyEffect, effect: { id: regen }, duration: "1◈" }
        - { key: ApplyEffect, effect: { id: dmgCut, magnitude: 100, uses: 3 }, duration: "1◈" }
        - { key: RemoveEffect, effect: { id: gotn } }
```

`uses` on an applied effect instance: confirm `effect-applier.mjs` copies `uses` from the instance onto the ActiveEffect (search `uses` there); if it reads only the definition's `uses`, the `dmg-cut.yml` `uses: 3` covers it and the instance key is harmless.

- [ ] **Step 5: Run tests, checks, live**

`npx vitest run && npm run lint && npm run validate:content` → PASS.

Live: Guidance on Pale Rider with an ally within 2 — ally has Atk Up 20, Regen, Dmg Cut (3 uses), GotN; Pale Rider has the three and no GotN. Ally hit twice for 300 → takes 200 each time, Dmg Cut uses 3→1. Ally walks into Doomsday — three effects refreshed, GotN gone.

- [ ] **Step 6: Docs and commit**

`docs/43` §43.6 (`requiresEffect`, `RemoveEffect`); `docs/A` (GotN); `docs/45`; CHANGELOG.

```bash
git add -A module packs/_source test/unit docs CHANGELOG.md
git commit -m "Author Guidance of the Netherworld, with GotN discharging on contact with Doomsday Come"
```

---

### Task 7: Kagome Kagome — bound summons, pursuit, banishment

**Files:**
- Modify: `module/data/actor/_shared.mjs` (`unitCommon`: `pursuitTargetId`, `boundToFieldId`; `combatantCommon`/servant: `summonAssignments`)
- Modify: `tools/lib/content.mjs` (allowlist: `inherit`, `normalAttack.shape` passthrough)
- Modify: `module/engine/summoning.mjs` (`place` → exported `placeSummons`; `inherit`; stamps)
- Modify: `module/engine/fields.mjs` (`SummonBound`, `Banish` actions; teardown in `endField`; banish return in `ensurePassiveFields`' Turn-start pass or a new `returnBanished(tick)`)
- Modify: `module/rules/targeting/resolve.mjs` (`forceTarget` reader)
- Modify: `module/engine/movement-hooks.mjs:105` (pursuit)
- Modify: `module/engine/attack.mjs` (`fireAttacked`)
- Modify: `module/rules/options.mjs` (`attack:vsAttribute`)
- Modify: `module/data/regions.mjs` (`state.banished` is inside the existing `state` object — no schema change)
- Create: `packs/_source/summons/kagome-{sword,famine,death,beast}.yml`, `packs/_source/abilities/pale-rider-kagome-kagome.yml`
- Modify: `packs/_source/abilities/pale-rider-doomsday-come.yml` (contact → `SummonBound`; `onEnd`)
- Test: `test/unit/pale-rider.test.mjs`, `test/unit/options.test.mjs`, `test/unit/movement.test.mjs`, the targeting test file

**Interfaces:**
- Produces: `system.summonAssignments: Record<enemyId, contentId>` on Servants; `system.pursuitTargetId`, `system.boundToFieldId` on summons (projected to snapshots as the same names); pure `pursuitVerdict(unit, path, board) → {ok, reason?}` in `rules/movement.mjs`; event `attacked` fired on the defender; option `attack:vsAttribute:<a>`; `resolveTargets` honours `suppressions[].forceTarget` (a unit id) by dropping every other unit; `placeSummons(contentIds, panels, summoner, scene, spec, stamps)`; field actions `SummonBound {typeRoll, types, rememberOn}`, `Banish {coin: {heads, tails}}`; `field.state.banished: Record<unitId, untilTick>`.

- [ ] **Step 1: Failing tests**

`test/unit/pale-rider.test.mjs`:

```js
describe("Kagome Spirits", () => {
  const summon = (name) => parse(readFileSync(`packs/_source/summons/${name}.yml`, "utf8"));
  it.each([
    ["kagome-sword", 2, 5, 150, 5], ["kagome-famine", -1, 4, 100, 10],
    ["kagome-death", 0, 5, 125, 25], ["kagome-beast", 1, 6, 125, 10],
  ])("%s inherits Agility with a delta, Luck as-is, and rides a Death chance", (id, delta, mov, mag, pct) => {
    const s = summon(id);
    expect(s.undamageable).toBe(true);
    expect(s.inherit).toEqual({ agility: { from: "summoner", delta }, luck: { from: "summoner" } });
    expect(s.mov).toBe(mov);
    expect(s.baseAttack.mag).toBe(mag);
    expect(s.attributes).toEqual(expect.arrayContaining(["dark", "spirit"]));
    const rider = s.passiveRules.find((r) => r.key === "OnEvent" && r.event === "damageDealt");
    expect(rider.then[0]).toMatchObject({ key: "ApplyEffect", target: "victim", effect: { id: "death" }, chance: pct });
    const banish = s.passiveRules.find((r) => r.event === "attacked");
    expect(banish.then[0]).toEqual({ key: "Banish", coin: { heads: "2◈", tails: "1◈" } });
  });
  it("Famine's Normal Attack is a 3×3 area", () => {
    expect(summon("kagome-famine").normalAttack.shape).toEqual({ kind: "square", size: 3 });
  });
  it("Doomsday summons one per enemy on contact, remembering the type on Pale Rider", () => {
    const ev = ability("pale-rider-doomsday-come").field.interiorEvents.find((e) => e.onFail.some((a) => a.key === "SummonBound"));
    expect(ev).toMatchObject({ event: "contact", relations: ["enemy"] });
    expect(ev.onFail[0]).toMatchObject({ key: "SummonBound", typeRoll: "1d4", rememberOn: "owner" });
    expect(Object.values(ev.onFail[0].types)).toEqual(["kagome-sword", "kagome-famine", "kagome-death", "kagome-beast"]);
  });
});
```

`test/unit/movement.test.mjs`:

```js
describe("pursuit", () => {
  const prey = { id: "prey", faction: "b", panel: { i: 0, j: 5 }, fields: ["doomsday"] };
  const spirit = { id: "s", faction: "a", panel: { i: 0, j: 0 }, pursuitTargetId: "prey", boundToFieldId: "doomsday" };
  const board = { units: [prey, spirit] };
  it("refuses a step that ends further from the target", () => {
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 2, j: 0 }], board).ok).toBe(false);
  });
  it("allows a step that closes, or holds, the distance", () => {
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 0, j: 1 }], board).ok).toBe(true);
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 1, j: 1 }], board).ok).toBe(true);
  });
  it("is lifted when the target is no longer inside the bound field", () => {
    const outside = { ...prey, fields: [] };
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 1, j: 0 }], { units: [outside, spirit] }).ok).toBe(true);
  });
});
```

`test/unit/options.test.mjs`:

```js
it("attack:vsAttribute names the attributes the attacker's active modifiers single out", () => {
  const attacker = { id: "a", modifiers: [{ key: "DamageModifier", direction: "dealt", value: 50, predicate: ["target:attribute:dark"] }] };
  const o = rollOptionsFor({ attacker, defender: { id: "b" }, attack: { kind: "normal" } });
  expect(o.has("attack:vsAttribute:dark")).toBe(true);
});
```

Targeting test (same file as Task 4's anchor test):

```js
it("a forceTarget suppression leaves only that unit selectable", () => {
  const caster = { id: "s", faction: "a", panel: { i: 0, j: 0 }, range: 1, suppressions: [{ scope: "targeting", forceTarget: "prey" }] };
  const prey = { id: "prey", faction: "b", panel: { i: 0, j: 1 } };
  const bystander = { id: "by", faction: "b", panel: { i: 1, j: 0 } };
  const out = resolveTargets({ anchor: { kind: "self" }, shape: { kind: "chebyshevRadius", r: 1 }, selection: { relations: ["enemy"], chooser: "caster" } }, caster, { units: [caster, prey, bystander], fields: [] }, {});
  expect(out.candidates.map((u) => u.id)).toEqual(["prey"]);
});
```

(Use whatever the resolver's entry point and result shape are — `grep -n "^export function" module/rules/targeting/resolve.mjs`.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run test/unit/pale-rider.test.mjs test/unit/movement.test.mjs test/unit/options.test.mjs` → FAIL.

- [ ] **Step 3: Schema and content allowlist**

`_shared.mjs#unitCommon()` after `undamageable`:

```js
    // A summon that hunts one enemy (Kagome Spirits: "will constantly Move
    // towards that Unit and Attack it") and lives only while a field stands
    // (Bašmu's `boundToPlatformId`, generalised). Both are Foundry document
    // ids stamped at placement, never authored.
    pursuitTargetId: new fields.StringField({ required: false, nullable: true, initial: null }),
    boundToFieldId: new fields.StringField({ required: false, nullable: true, initial: null }),
```

In `ServantData`'s own schema (servant.mjs, beside `masterId`):

```js
      // "The same Kagome Spirit will be summoned for the same enemy Unit":
      // which summon type is bound to which enemy, by enemy id.
      summonAssignments: new fields.ObjectField({ required: false, initial: () => ({}) }),
```

`content.mjs#actorSystem` allowlist: `inherit: doc.inherit ?? null,` and make sure `normalAttack` is spread whole (`normalAttack: doc.normalAttack ?? undefined` — check the existing line keeps `shape`). Add `inherit` to `SummonData`'s schema as `new fields.ObjectField({ required: false, nullable: true, initial: null })`.

`rules/snapshot.mjs` unit projection (beside `summonerId`): `pursuitTargetId: sys.pursuitTargetId ?? null, boundToFieldId: sys.boundToFieldId ?? null, summonAssignments: sys.summonAssignments ?? {},`.

- [ ] **Step 4: Summoning with memory (engine)**

`module/engine/summoning.mjs`: rename `place` → `export async function placeSummons(contentIds, panels, summoner, scene, spec, stamps = {})` (update `summonPhase`'s call). Inside the loop after `data.system.actsOncePerTurn = …`:

```js
    // Kagome Spirits: "Agility: Pale Rider's plus 2 / Luck: Same as Pale
    // Rider's" -- stats RELATIVE to the summoner, resolved from its live
    // values at placement.
    for (const [stat, rule] of Object.entries(data.system.inherit ?? {})) {
      if (rule?.from !== "summoner") continue;
      const base = summoner.system?.[stat]?.max ?? summoner.system?.[stat]?.value ?? 0;
      const value = Math.max(0, base + (rule.delta ?? 0));
      data.system[stat] = { value, max: value };
    }
    Object.assign(data.system, stamps);
```

`module/engine/fields.mjs#runFieldEvent`, a new action:

```js
      // Kagome Kagome: "roll a four-sided die for each enemy Unit within
      // Doomsday Come, and summon a Kagome Spirit corresponding to the number
      // rolled ... If Doomsday Come is activated again, the same Kagome
      // Spirit will be summoned for the same enemy Unit." The memory lives on
      // the OWNER (`rememberOn: owner` → `system.summonAssignments`), because
      // the field is gone between activations and the Servant is not.
      if (action.key === "SummonBound") {
        const ownerDoc = game.actors.get(field.ownerId);
        if (!ownerDoc) continue;
        const already = game.actors.some((a) => a.system?.pursuitTargetId === unit.id && a.system?.boundToFieldId === field.id && !a.system?.defeated);
        if (already) continue;
        const remembered = ownerDoc.system?.summonAssignments?.[unit.id] ?? null;
        let contentId = remembered;
        if (!contentId) {
          const roll = await new Roll(String(action.typeRoll ?? "1")).evaluate();
          contentId = action.types?.[roll.total] ?? action.types?.[String(roll.total)] ?? null;
          if (contentId && action.rememberOn === "owner") {
            await ownerDoc.update({ [`system.summonAssignments.${unit.id}`]: contentId });
          }
        }
        if (!contentId) continue;
        const { placeSummons, freePanels } = await import("./summoning.mjs");
        const panels = freePanels(unit, { adjacentTo: "self" }, 1);
        await placeSummons([contentId], panels, ownerDoc, canvas.scene, {}, {
          pursuitTargetId: unit.id, boundToFieldId: field.id,
        });
        continue;
      }
```

Export `freePanels` from summoning.mjs and confirm the placement-spec key for "next to this unit" (`grep -n "placement" module/engine/summoning.mjs`); the Spirit appears beside its prey, which is inside, so it is inside too.

Teardown — in `endField(fieldId)` before `region.delete()`:

```js
  // "When Doomsday Come ends, all Kagome Spirits immediately disappear." The
  // same shape as a platform taking its bound summons with it
  // (`scene-levels.mjs`), keyed on the field.
  for (const summon of game.actors.filter((a) => a.system?.boundToFieldId === fieldId)) {
    const token = summon.getActiveTokens?.()[0];
    if (token) await token.document.delete();
    await summon.delete();
  }
```

- [ ] **Step 5: Pursuit and forced targeting (rules + engine)**

`module/rules/movement.mjs`:

```js
/**
 * Kagome Spirits: "will constantly Move towards that Unit and Attack it." A
 * CONSTRAINT rather than an automaton -- the player moves the Spirit, and a
 * step that ends further from its prey than it began is refused. Lifted when
 * the prey is no longer inside the field the Spirit is bound to.
 *
 * @param {object} unit
 * @param {Array<{i: number, j: number}>} path
 * @param {object} board
 * @returns {{ok: boolean, reason?: string}}
 */
export function pursuitVerdict(unit, path, board) {
  if (!unit?.pursuitTargetId || path.length < 2) return { ok: true };
  const prey = (board?.units ?? []).find((u) => u.id === unit.pursuitTargetId);
  if (!prey?.panel) return { ok: true };
  if (unit.boundToFieldId && !(prey.fields ?? []).includes(unit.boundToFieldId)) return { ok: true };
  const before = geo.chebyshev(path[0], prey.panel);
  const after = geo.chebyshev(path[path.length - 1], prey.panel);
  return after <= before
    ? { ok: true }
    : { ok: false, reason: `${unit.name ?? "This Spirit"} must move towards ${prey.name ?? "its target"}.` };
}
```

`movement-hooks.mjs#onPreMove`, after the `validatePath` verdict block (line ~109):

```js
  const pursuit = pursuitVerdict(unit, path, board);
  if (!pursuit.ok) {
    ui.notifications.warn(`FGT | ${pursuit.reason}`);
    return false;
  }
```

`rules/targeting/resolve.mjs` — `ForceTarget` is emitted (`elements.mjs:951`) and read by nothing. In the selection step where candidates are filtered by relation (the step before `isProtectedMaster` at line ~202), add:

```js
  // `ForceTarget` (Decoy's pull, Kagome's prey, Karna's Fated Rivals): only
  // that unit is selectable. Emitted since the executor was written; this is
  // its first reader.
  const forced = (caster.suppressions ?? []).find((s) => s.scope === "targeting" && s.forceTarget);
  if (forced) candidates = candidates.filter((u) => u.id === forced.forceTarget || drop(u, `forced to target ${forced.forceTarget}`));
```

Adapt `candidates`/`drop` to the local names. The Spirit's own rule element that emits it: `{ key: ForceTarget, target: "@pursuitTargetId" }` — `resolveValue` does not read a unit field, so instead make the executor accept `targetFrom: "pursuitTargetId"` and have `annotateFields`-style post-processing… simpler: in `rules/snapshot.mjs`, after `suppressions:` is projected, add

```js
  if (sys.pursuitTargetId) unit.suppressions.push({ scope: "targeting", forceTarget: sys.pursuitTargetId, source: "pursuit" });
```

(inside the unit builder where `unit` is the object being returned — adapt to its shape).

- [ ] **Step 6: `attacked`, `vsAttribute`, and `Banish`**

`attack.mjs` beside `fireAttackDeclared`:

```js
/**
 * The DEFENDER-side declaration event. `attackDeclared` fires on the attacker;
 * nothing ever told the target it was about to be hit, so a clause like the
 * Kagome Spirits' "if a Light attack ... is used on a Kagome Spirit" had no
 * handler slot. Fired once per defender with the attack in its option set.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireAttacked(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;
  const intents = fireEvent("attacked", [defender], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: rollOptions(attacker, defender, state),
    attackerId: attacker.id,
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "attacked");
}
```

Call it directly after `fireAttackDeclared(state)` wherever that is awaited. Note in the docs that `self:` in this option set is the **attacker** (it is `rollOptions(attacker, defender, …)`); handlers on the defender predicate on `attack:` options.

`options.mjs` attack block:

```js
  // "An Attack that deals extra damage to Units with the 'Dark' or 'Spirit'
  // Attribute" IS an attacker whose active damage-dealt modifiers single an
  // attribute out. Read off the predicates those modifiers carry.
  for (const m of attacker?.modifiers ?? []) {
    if (m.direction !== "dealt" || !m.predicate || (m.value ?? 0) <= 0) continue;
    for (const ref of referencedOptions(m.predicate)) {
      const hit = /^target:attribute:([A-Za-z][\w-]*)$/.exec(ref);
      if (hit) options.add(`attack:vsAttribute:${hit[1]}`);
    }
  }
```

Import `referencedOptions` from `./predicate.mjs`; add `/^attack:vsAttribute:[A-Za-z][\w-]*$/,` to `EMITTABLE`.

`scheduler.mjs` `ACTIONS` — a new action that emits a log intent the engine turns into a token write (the scheduler is pure; the hide is a world effect):

```js
  /**
   * Kagome Spirits: "Flip a Coin; that Kagome Spirit disappears for 1◈ Turns
   * if Tails, 2◈ if Heads; then reappears on a random panel within Doomsday
   * Come." The coin is `ctx.rolls.coin` (the caller rolls); the intent names
   * the tick to return on and `engine/fields.mjs` does the hiding.
   */
  Banish: (a, u, h, c) => {
    const heads = (c.rolls?.[`coin:${u.id}`] ?? 1) === 2;
    const span = heads ? a.coin?.heads : a.coin?.tails;
    if (!span) return [];
    const ticks = resolveTicks(parseTick(String(span)), c);
    return [I.log({ kind: "banish", unitId: u.id, untilTick: (c.tick ?? 0) + ticks, fieldId: u.boundToFieldId ?? null, source: h.source })];
  },
```

`gatherRolls` in `attack.mjs`/`scheduler-hooks.mjs` rolls a table per handler `roll.key`; for the coin, in `fireAttacked` roll `1d2` per defender before firing and pass `rolls: { [`coin:${defender.id}`]: total }`. In `engine/applier.mjs` (where `log` intents of known kinds are handled — `grep -n "kind === \"defeat\"\|case \"log\"" module/engine/applier.mjs`) handle `kind: "banish"`:

```js
    if (intent.payload?.kind === "banish") {
      const actor = game.actors.get(intent.payload.unitId);
      const token = actor?.getActiveTokens?.()[0]?.document;
      if (token) await token.update({ hidden: true });
      const { behaviorFor } = await import("./fields.mjs");
      const behavior = intent.payload.fieldId ? behaviorFor(intent.payload.fieldId) : null;
      if (behavior) await behavior.update({ [`system.state.banished.${intent.payload.unitId}`]: intent.payload.untilTick });
    }
```

Export `behaviorFor` from fields.mjs. Return at Turn start — in `fields.mjs`:

```js
/**
 * Bring back every banished unit whose tick has come, on a random free panel
 * of the field that holds it.
 * @param {number} tick
 * @returns {Promise<void>}
 */
export async function returnBanished(tick) {
  const board = currentBoard();
  for (const field of board.fields ?? []) {
    for (const [unitId, until] of Object.entries(field.state?.banished ?? {})) {
      if (until > tick) continue;
      const actor = game.actors.get(unitId);
      const token = actor?.getActiveTokens?.()[0]?.document;
      const panel = randomFreePanelIn(field, board);
      if (token && panel) {
        await token.update({ hidden: false, x: panel.j * canvas.scene.grid.size, y: panel.i * canvas.scene.grid.size }, { fgtForced: true });
      }
      await behaviorFor(field.id)?.update({ [`system.state.banished.-=${unitId}`]: null });
    }
  }
}
```

Call `await fields.returnBanished(nextTick);` in `scheduler-hooks.mjs` after `expireFields`. A hidden token must not count as occupying or acting: `currentBoard()` should skip `hidden` tokens for a unit that is banished (check `board.mjs`'s token loop; add `if (token.hidden && fieldBanished(token.actor)) continue;` — or simplest, exclude any hidden token whose actor's `boundToFieldId` is set).

- [ ] **Step 7: Content**

`packs/_source/summons/kagome-sword.yml` (the other three differ only in the numbers the test table states):

```yaml
# Pale Rider -- Kagome Kagome: Sword. char_orig_sheets/Copia de Pale Rider.md.
schema: 1
id: kagome-sword
name: "Kagome: Sword"
type: summon
attributes: [summon, dark, spirit]
undamageable: true
inherit:
  agility: { from: summoner, delta: 2 }
  luck: { from: summoner }
mov: 5
range: { panels: 1, targets: 1 }
baseAttack: { str: 0, mag: 150 }
normalAttack: { mode: fixed, component: mag }
countsTowardBudget: false
actsOncePerTurn: true
passiveRules:
  - key: GrantedAbility
    abilities: [noReactions]
  # "Normal Attacks have a 5% chance of inflicting Death."
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: ["attack:kind:normal"]
    then:
      - { key: ApplyEffect, target: victim, effect: { id: death }, chance: 5 }
  # "If a damage-dealing NP or Attack that deals Light damage, or ... extra
  # damage to Units with the 'Dark' or 'Spirit' Attribute, is used on a Kagome
  # Spirit, Flip a Coin; disappears for 1◈ if Tails, 2◈ if Heads."
  - key: OnEvent
    event: attacked
    automatic: true
    predicate: [{ or: ["attack:element:light", "attack:vsAttribute:dark", "attack:vsAttribute:spirit"] }]
    then:
      - { key: Banish, coin: { heads: "2◈", tails: "1◈" } }
```

Famine: `delta: -1`, `mov: 4`, `range: { panels: 3, targets: 1 }`, `normalAttack: { mode: fixed, component: mag, shape: { kind: square, size: 3 } }`, `mag: 100`, `chance: 10`. Death: `delta: 0`, `mov: 5`, `mag: 125`, `chance: 25`. Beast: `delta: 1`, `mov: 6`, `range: { panels: 2, targets: 1 }`, `mag: 125`, `chance: 10`.

`normalAttack.shape` must be honoured by the Normal Attack's targeting — find where a Normal Attack's `shape` defaults to `{kind: "unit"}` (`grep -n "normalAttack" module/rules/ability-use.mjs module/engine/attack.mjs`) and read `unit.normalAttack?.shape ?? { kind: "unit" }` there; project `normalAttack` on the snapshot if it is not already.

`packs/_source/abilities/pale-rider-kagome-kagome.yml` — the sheet entry (passive; its rules are Doomsday's contact clause):

```yaml
schema: 1
id: pale-rider-kagome-kagome
name: "Kagome Kagome: Sword, Famine, Death, Beast"
rank: A
kind: noblePhantasm
isNP: true
npTags: [antiWorld]
passive: true
description: |
  (Passive) When Doomsday Come is activated, roll 1d4 for each enemy Unit within and summon the
  corresponding Kagome Spirit, which constantly Moves towards that Unit and Attacks it. A new
  enemy entering Doomsday Come gets one too. Light attacks and anti-Dark/Spirit attacks banish
  a Spirit for 1◈ (Tails) or 2◈ (Heads); it returns on a random panel within. Spirits do not
  count towards the Move/Attack budget and act once per Turn. When Doomsday Come ends, all
  Spirits disappear; on reactivation the same Spirit is summoned for the same enemy.
passiveRules: []
```

Doomsday's `interiorEvents:` gains (first in the list):

```yaml
    - event: contact
      relations: [enemy]
      onFail:
        - key: SummonBound
          typeRoll: "1d4"
          types: { 1: kagome-sword, 2: kagome-famine, 3: kagome-death, 4: kagome-beast }
          rememberOn: owner
```

- [ ] **Step 8: Run tests, checks, live**

`npx vitest run && npm run lint && npm run validate:content && node tools/check-layers.mjs` → PASS (validator: `SummonBound`, `Banish` action keys; `attacked` event name; `inherit`, `undamageable` on summons).

Live: cast Doomsday with two foes inside — two Spirits appear beside their prey, `summonAssignments` on Pale Rider has two entries; Sword's move away from its prey refused by name; its attack on a bystander refused (only the prey selectable); a Light-element attack on Sword hides it and writes `state.banished`; advancing past the tick returns it inside; ending Doomsday deletes all Spirits; recasting yields the same types.

- [ ] **Step 9: Docs and commit**

`docs/04-units.md` (summons: `inherit`, `pursuitTargetId`, `boundToFieldId`, `normalAttack.shape`); `docs/E-event-reference.md` (`fgt.attacked`); `docs/24` (`attack:vsAttribute`, `ForceTarget` now read); `docs/43` §43.6 (`SummonBound`, `Banish`), §43.11 (`state.banished`); `docs/45`; CHANGELOG.

```bash
git add -A module packs/_source tools test/unit docs CHANGELOG.md
git commit -m "Summon Kagome Spirits bound to their prey, constrain their pursuit, and banish them on Light"
```

---

### Task 8: The relationship proxy, the Servant file, and the documentation

**Files:**
- Modify: `module/rules/targeting/resolve.mjs:611-622` (`isProtectedMaster`)
- Modify: `module/rules/movement.mjs` (`inEnemyMasterProtection`)
- Modify: `module/engine/items.mjs` (`giveItem` refusal)
- Create: `packs/_source/servants/pale-rider.yml`
- Modify: `docs/D-servant-data-sheets.md` §D.26, `docs/44-case-expanded-roster.md`, `docs/16-relationships.md`, `docs/45`, `CHANGELOG.md`
- Test: `test/unit/pale-rider.test.mjs`, the targeting test file, `test/unit/movement.test.mjs`

**Interfaces:**
- Consumes: `suppressions[].scope === "relationship"` with `proxy: "summons"` (already emitted by `RelationshipProxy`); `boundToFieldId`/`summonerId` from Task 7.
- Produces: pure `guardsOf(master, board) → unit[]` in `rules/relations.mjs` — the units that count as "this Master's Servant" for the two protection rules.

- [ ] **Step 1: Failing tests**

```js
// targeting test file
it("a Servant with a relationship proxy does not protect its Master; its bound summons do", () => {
  const master = { id: "m", kind: "master", faction: "a", panel: { i: 5, j: 5 } };
  const pale = { id: "pale", kind: "servant", faction: "a", panel: { i: 5, j: 6 }, masterId: "m", canAct: true, suppressions: [{ scope: "relationship", proxy: "summons" }] };
  const caster = { id: "foe", kind: "servant", faction: "b", panel: { i: 5, j: 3 } };
  expect(isProtectedMaster(master, caster, { units: [master, pale, caster], alliances: {} })).toBe(false);
  const spirit = { id: "s", kind: "summon", faction: "a", panel: { i: 6, j: 6 }, summonerId: "pale", boundToFieldId: "doomsday" };
  expect(isProtectedMaster(master, caster, { units: [master, pale, caster, spirit], alliances: {} })).toBe(true);
});
```

```js
// movement.test.mjs
it("zone denial around a Master asks the proxied summons, not the Servant", () => {
  const master = { id: "m", kind: "master", factionId: "a", faction: "a", panel: { i: 5, j: 5 } };
  const pale = { id: "pale", kind: "servant", factionId: "a", faction: "a", panel: { i: 5, j: 6 }, masterId: "m", suppressions: [{ scope: "relationship", proxy: "summons" }] };
  const foe = { id: "foe", kind: "servant", factionId: "b", faction: "b", panel: { i: 3, j: 5 } };
  expect(inEnemyMasterProtection({ i: 4, j: 5 }, foe, { units: [master, pale, foe], alliances: {} })).toBe(false);
});
```

```js
// pale-rider.test.mjs
describe("the Servant file", () => {
  const pale = parse(readFileSync("packs/_source/servants/pale-rider.yml", "utf8"));
  it("has no Health, carries the proxy, and lists every ability", () => {
    expect(pale.baseHealth).toBeNull();
    expect(pale.undamageable).toBe(true);
    expect(pale.rules.find((r) => r.key === "RelationshipProxy")).toMatchObject({ proxy: "summons" });
    expect(pale.abilities.map((a) => a.ref)).toEqual([
      "pale-rider-riding", "class-magic-resistance", "pale-rider-contagion", "pale-rider-innocent-world",
      "pale-rider-guidance-of-the-netherworld", "pale-rider-doomsday-come", "pale-rider-doomsday-drag", "pale-rider-kagome-kagome",
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: `guardsOf` and the two readers**

`module/rules/relations.mjs`:

```js
/**
 * The units that stand as "this Master's Servant" for the Servant–Master
 * relationship rules. Ordinarily the Master's own Servants; for a Servant
 * carrying a `RelationshipProxy`, its live bound summons instead -- Pale
 * Rider: "apply between Kagome Spirits and Pale Rider's Master". Emitted
 * since the element was written; this is its first reader.
 *
 * @param {object} master
 * @param {object} board
 * @returns {object[]}
 */
export function guardsOf(master, board) {
  const units = board?.units ?? [];
  /** @type {object[]} */
  const out = [];
  for (const u of units) {
    if (u.kind !== "servant" || (u.factionId ?? u.faction) !== (master.factionId ?? master.faction)) continue;
    const proxy = (u.suppressions ?? []).find((s) => s.scope === "relationship")?.proxy ?? null;
    if (!proxy) { out.push(u); continue; }
    if (proxy === "summons") {
      out.push(...units.filter((s) => s.summonerId === u.id && s.boundToFieldId && !s.defeated));
    }
  }
  return out;
}
```

`isProtectedMaster` (resolve.mjs):

```js
function isProtectedMaster(unit, caster, board) {
  if (unit.kind !== "master") return false;
  if (relationOf(caster, unit, board) !== "enemy") return false;
  return guardsOf(unit, board).some(
    (u) => u.canAct !== false && u.panel && geo.chebyshev(u.panel, unit.panel) <= 1,
  );
}
```

`inEnemyMasterProtection` (movement.mjs) — replace the inner `guard` lookup with `const guard = guardsOf(other, board).find((u) => u.panel && geo.chebyshev(u.panel, other.panel) <= 2);`.

`engine/items.mjs#giveItem` — at the top: `if (actor.system?.undamageable && actor.type === "servant") throw new Error(\`FGT | ${actor.name} cannot hold Items.\`);` (Pale Rider is the only undamageable Servant; the sheet's redirect to the Master is documented as unmodelled because no acquisition flow exists — see §8 of the spec).

- [ ] **Step 4: The Servant file**

`packs/_source/servants/pale-rider.yml`:

```yaml
# packs/_source/servants/pale-rider.yml
# Conversion source: char_orig_sheets/Copia de Pale Rider.md
# Data sheet: docs/D-servant-data-sheets.md §D.26 · bounded fields: Ch. 43
schema: 1
id: pale-rider
name: "Pale Rider"
type: servant

trueName: "Pale Rider"
servantClasses: [rider]
classContainer: rider
alignment: { order: neutral, morality: neutral }
region: []
# "Servant, [-]": one attribute and an empty bracket.
attributes: [servant]

parameters: { str: E, end: A, agi: B, mag: A, luc: C }
# "Base Health: —", "cannot take damage". The flag keeps `prepareBaseData`
# from backfilling the null from the END table.
baseHealth: null
undamageable: true
mov: 6
# "Range: — (See 'Contagion')". He cannot perform Normal Attacks (Riding EX),
# so the number is never asked; 0 says so.
range: { panels: 0, targets: 1 }
baseAttack: { str: 50, mag: 200 }
normalAttack: { mode: fixed, component: mag }
sustainability: "2◈"

abilities:
  - { ref: pale-rider-riding }
  - { ref: class-magic-resistance, rank: C }
  - { ref: pale-rider-contagion }
  - { ref: pale-rider-innocent-world }
  - { ref: pale-rider-guidance-of-the-netherworld }
  - { ref: pale-rider-doomsday-come }
  - { ref: pale-rider-doomsday-drag }
  - { ref: pale-rider-kagome-kagome }

# "The following Servant-Master Relationship Rules have no effect between Pale
# Rider and its Master; but apply between Kagome Spirits and Pale Rider's
# Master." Read by `rules/relations.mjs#guardsOf`.
rules:
  - key: RelationshipProxy
    proxy: summons

notes: |
  Unmodelled, with reasons (docs/D-servant-data-sheets.md §D.26): the NP-cover relationship
  rule ("the Master is unharmed while the Servant's damage is doubled") is implemented for no
  Servant, so there is nothing to redirect; Items obtained by Pale Rider going to his Master
  presuppose an item-acquisition flow that does not exist (`giveItem` refuses him).
```

Check `servantClasses`/`classContainer` values for Rider and the `alignment` vocabulary in an existing Rider (`grep -l "rider" packs/_source/servants/*.yml`).

- [ ] **Step 5: Run everything**

`npm run lint && npx vitest run && npm run validate:content && npm run check:templates && npm run check:manifest && node tools/check-layers.mjs` → PASS.

- [ ] **Step 6: Full live pass**

Rebuild packs (world down), relaunch, drag Pale Rider from the compendium, contract him to a Master, and run the spec §9 live column top to bottom. Record each measured number in `docs/45`'s Pale Rider subsection, the way the Jack subsection does (clause → what was measured → result).

- [ ] **Step 7: Docs and commit**

- `docs/D-servant-data-sheets.md` §D.26: rewrite from "analysis" to "built", clause by clause, with the unmodelled list.
- `docs/44-case-expanded-roster.md`: Pale Rider's row → built.
- `docs/16-relationships.md`: the proxy (`guardsOf`), read by both relationship rules; the NP-cover rule unimplemented for everyone.
- `docs/45`: Pale Rider subsection completed with the live measurements; §45.4 rows for `RelationshipProxy` (now consumed), `ForceTarget` (now consumed), `Script` (still unused — Innocent World did not need it).
- `CHANGELOG.md`.

```bash
git add -A module packs/_source test/unit docs CHANGELOG.md
git commit -m "Author Pale Rider completely, with Kagome Spirits standing in for him in the relationship rules"
```

---

## Self-review

**Spec coverage.** §2.1 flag → T1; §2.2 grants → T1; §2.3 ZON → T1; §2.4 class skills → T1 (variant) + T8 (MR C on the file); §2.5 effects → T1 (charm, regen, dmgCut), T2 (contagionExpanded), T6 (gotn); §3.1 passive → T2; §3.2 overrides → T2; §3.3 triggers, `HealthLoss`, `chance`, `unitTurnEnd` → T2; §3.4 branches + `withinOfOwnerMaster` → T2; §4 → T6; §5.1 axes + `radiusRoll` → T3; §5.2 runner → T3; §5.3 escape → T4; §5.4 drag-in → T4; §6 → T5; §7.1 statlines/`inherit`/shape → T7; §7.2 `SummonBound` + memory → T7; §7.3 pursuit + `ForceTarget` reader → T7; §7.4 `attacked`/`vsAttribute`/`Banish` → T7; §8 proxy + items → T8; §9 test table → each task's Step "live"; §10 order kept.

**Deviations from the spec, stated.** (a) Doomsday Drag is an ordinary ability gated by a new `fieldOpen` requirement rather than a `GrantedAbility` predicated on the field, because Pale Rider need not stand inside and a requirement is what the engine already uses to gate an ability on board state. (b) `ForceTarget` turned out to have **no reader** (spec §7.3 said "exists"); T7 adds one. (c) The Riding EX variant lives in `class-skills/` as `pale-rider-riding`, and `undamageable` is a unit flag rather than a rule the variant carries. (d) `vulnerabilityTriggered` is called by nothing today; T4 adds the caller (`closeFieldsPiercedBy`).

**Placeholder scan.** Every "confirm X" is a bounded lookup with a grep given; no step defers its own content. The four Kagome files share one template with the differing numbers enumerated.

**Type consistency.** `selectBranch(spec, options: Set)` (T2) used in `runFieldEvent` (T2); `randomFreePanelIn(field, board, random)` (T4) used in `dragInto` (T4) and `returnBanished` (T7); `placeSummons(contentIds, panels, summoner, scene, spec, stamps)` (T7) used by `SummonBound` (T7); `guardsOf(master, board)` (T8) used by both readers (T8); `extensionFor` return gains `payer` (T3) read by `offerExtension` (T3); `GRANTS.noReactions` (T1) authored on the Spirits (T7); `behaviorFor` exported (T7) used by the applier (T7).
