# Kiritsugu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emiya Kiritsugu plays exactly as `char_orig_sheets/Copia de Kiritsugu.md` reads, proven clause by clause on a live board through the interface.

**Architecture:** Every task pairs **one engine addition with the clause that consumes it**, so nothing lands inert. Content is YAML under `packs/_source/`, compiled by `tools/build-packs.mjs`. Engine work obeys the layer rule — `domain` (1) ← `rules` (2) ← `engine` (3) ← `apps`/`documents` (4), enforced by `tools/check-layers.mjs`.

**Tech Stack:** Foundry VTT v14 system, vanilla ESM (no build step for `module/`), vitest, YAML content packs, `claude-in-chrome` for live verification.

**Spec:** `docs/superpowers/specs/2026-09-12-kiritsugu-design.md`

## Global Constraints

- **Three authorities for rule-element keys must agree.** A new key goes in `module/rules/elements.mjs` (`EXECUTORS`), `module/rules/authoring/elements.mjs`, and `tools/lib/content.mjs` (`RULE_ELEMENT_KEYS`). `test/unit/elements.test.mjs` holds them against each other in both directions.
- **Layer rule.** `module/rules/**` must not import from `module/engine/**` or reference Foundry globals (`game`, `ui`, `canvas`). Verified by `npm run lint`.
- **Predicate grammar.** `and`/`or`/`nand`/`nor` take statement objects; `anyOf` takes **bare option strings only**. Enforced by `anyOfHoldsOnlyOptions` in `tools/lib/content.mjs`.
- **Deferred predicates.** A predicate about the *attack* (range, target type) must be `deferred`, not answered at collection time — see `crit-up-hawkeye.yml`.
- **Every new roll option must be emittable.** Add its facet to `module/rules/facets.mjs` or `isEmittableOption` rejects it and `validate:content` fails.
- **Effect ids must not collide with Servant ids.** The NP2 mark is `kiritsuguMark` (spec R9).
- **Checks succeed on `total <= target`.** A `CheckModifier` with a positive `value` makes a check **harder** (spec R2/R3).
- **Gate before every commit:** `npm test && npm run lint && npm run validate:content && npm run check:manifest`.
- **World tooling:** `node tools/fgt-world.mjs status|launch`, `node tools/fgt-rebuild.mjs` (**Foundry must be fully closed** — the app holds the LevelDB, shutting the world down is not enough), `node tools/fgt-reload.mjs`.

---

## File Structure

**Content — created:**

| Path | Responsibility |
|---|---|
| `packs/_source/servants/kiritsugu.yml` | statline, attributes, two class-skill refs, nine ability refs |
| `packs/_source/abilities/kiritsugu-magecraft.yml` | the per-Turn Thaumaturgy limit + the Suppression extension |
| `packs/_source/abilities/kiritsugu-reinforcement.yml` | Spell: N.Atk Up 40% |
| `packs/_source/abilities/kiritsugu-penetration.yml` | Spell: Ignore Def + halved Invuln |
| `packs/_source/abilities/kiritsugu-familiars.yml` | Spell: Range Up + ranged Crit Up |
| `packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml` | passive (rank shift, aura, Skill Seal) + Active |
| `packs/_source/abilities/kiritsugu-scapegoat.yml` | Decoy on an ally at two windows |
| `packs/_source/abilities/kiritsugu-lethal-gunfire-suppression.yml` | the out-of-turn shot + the Active |
| `packs/_source/abilities/kiritsugu-chronos-rose.yml` | NP1 |
| `packs/_source/abilities/kiritsugu-mystery-bisection.yml` | NP2 |
| `packs/_source/effects/pierce.yml` | the Pierce attack property, as a buff |
| `packs/_source/effects/penetration.yml` | Ignore Def + halved Invuln |
| `packs/_source/effects/crit-up-familiar.yml` | range-conditional Crit Up |
| `packs/_source/effects/decoy-scapegoat.yml` | the Decoy variant LGS keys on |
| `packs/_source/effects/suppression.yml` | 5 uses, 1◈, the strip loop |
| `packs/_source/effects/kiritsugu-mark.yml` | both-component Base Attack halving |

**Engine — modified:**

| Path | Change |
|---|---|
| `module/rules/auras.mjs` | `ROUTES` gains a `checkModifier` entry (Task 2) |
| `module/rules/elements.mjs` | `AttackProperty`, `CategoryUseLimit`, `BaseAttackModifier`, `TriggeredAttack` executors |
| `module/rules/authoring/elements.mjs` | mirror the four new keys |
| `tools/lib/content.mjs` | mirror the four new keys in `RULE_ELEMENT_KEYS` |
| `module/rules/snapshot.mjs` | project `attackProperties`, `categoryUseLimits`; apply the Base Attack halving |
| `module/rules/costs.mjs` | the category per-Turn gate |
| `module/rules/damage/pipeline.mjs` | fractional Invuln; read attacker-borne Ignore Def |
| `module/engine/attack.mjs` | fold attacker attack-properties into the spec; the damage-step strip |
| `module/engine/skill-use.mjs` | `cooldownChanges` reaches the target |
| `module/rules/facets.mjs` | any new roll options |
| `lang/en.json` | every new player-visible string |

**Test — created:** `test/unit/kiritsugu.test.mjs`, one `describe` per clause.

---

## Task 1: The Servant, and proving the two class skills cost nothing

**Files:**
- Create: `packs/_source/servants/kiritsugu.yml`
- Create: `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Consumes: `lookup` from `module/domain/tables.mjs`; `resolveRef` from `tools/lib/content.mjs`.
- Produces: the content id `kiritsugu`, referenced by every later task.

- [ ] **Step 1: Write the failing test**

`test/unit/kiritsugu.test.mjs`:

```js
/**
 * @file Emiya Kiritsugu — the pure halves of his kit.
 * @see char_orig_sheets/Copia de Kiritsugu.md
 * @see docs/superpowers/specs/2026-09-12-kiritsugu-design.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Kiritsugu — the statline", () => {
  const k = src("servants", "kiritsugu.yml");

  it("is the sheet's statline exactly", () => {
    expect(k.parameters).toEqual({ str: "D", end: "C", agi: "A+", mag: "B", luc: "E" });
    expect(k.baseHealth).toBe(1000);
    expect(k.mov).toBe(7);
    expect(k.range).toEqual({ panels: 3, targets: 1 });
    expect(k.baseAttack).toEqual({ str: 65, mag: 175 });
    expect(k.sustainability).toBe("8◈");
  });

  it("writes LUC as E so the rank shift to EX is observable (spec R2)", () => {
    // Authoring `luc: EX` would make Affection's RankShift invisible and leave
    // Skill Seal with nothing to take away.
    expect(k.parameters.luc).toBe("E");
  });

  it("reproduces Base Attack (MAG) and Base Health from the tables", () => {
    expect(lookup("baseAttackMagByMag", "B")).toBe(175);
    expect(lookup("baseHealthByEnd", "C")).toBe(1000);
  });

  it("keeps the sheet's BA(STR) 65 over the table's 75, as Serenity does", () => {
    // Both Assassins in the set are STR D and both are authored at 65.
    expect(lookup("baseAttackStrByStr", "D")).toBe(75);
    expect(k.baseAttack.str).toBe(65);
    expect(src("servants", "serenity.yml").baseAttack.str).toBe(65);
  });
});

describe("Kiritsugu — the two class skills are a ref and nothing else", () => {
  const k = src("servants", "kiritsugu.yml");
  const ref = (id) => k.abilities.find((a) => a.ref === id);

  it("carries Presence Concealment at A+ and Independent Action at A", () => {
    expect(ref("class-presence-concealment")).toEqual(
      { ref: "class-presence-concealment", rank: "A+" },
    );
    expect(ref("class-independent-action")).toEqual(
      { ref: "class-independent-action", rank: "A" },
    );
  });

  it("gets all six of their numbers from the rank tables", () => {
    // Presence Concealment A+ — the sheet says 5%, +4, 2◈.
    expect(lookup("presenceConcealmentDiscover", "A+")).toBe(5);
    expect(lookup("presenceConcealmentEvade", "A+")).toBe(4);
    expect(lookup("presenceConcealmentCooldown", "A+")).toBe("2◈");
    // Independent Action A — the sheet says 8◈, 3 panels, 4 rolls.
    expect(lookup("independentActionSustainability", "A")).toBe(8);
    expect(lookup("independentActionZon", "A")).toBe(3);
    expect(lookup("independentActionContract", "A")).toBe(4);
  });

  it("states the Sustainability the table already gives", () => {
    expect(k.sustainability).toBe(`${lookup("independentActionSustainability", "A")}◈`);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs`
Expected: FAIL — `ENOENT` on `packs/_source/servants/kiritsugu.yml`.

- [ ] **Step 3: Write the Servant**

`packs/_source/servants/kiritsugu.yml`:

```yaml
# Emiya Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# The most REACTIVE Servant in the set. Every other Servant built so far acts on
# their own Turn or answers an attack aimed at themselves; his signature skill
# fires a Normal Attack on somebody else's Turn, triggered by a THIRD PARTY
# being attacked, and lets him cast a Spell inside the trigger.
#
# Three of his eleven sheet entries cost nothing but a `ref:` line. Presence
# Concealment A+ and Independent Action A between them supply eight numbers and
# not one is authored here -- see the spec §1.1.
schema: 1
id: kiritsugu
name: "Kiritsugu"
trueName: "Emiya Kiritsugu"
# Spec R8. He carries an Assassin class skill AND an Archer one, so this is a
# choice: Presence Concealment is eight clauses that rewrite targeting, the
# reaction ladder, the damage pipeline and movement legality, where Independent
# Action is three passives. `classContainer` is presentational and the setup
# wizard's slot -- no class bonus rests on it.
classContainer: assassin
region: japan
alignment: { order: chaotic, morality: evil }
attributes: [male, servant, man, humanoid, antiHero]
# LUC is written **E**, not EX. Affection of the Holy Grail contributes the
# RankShift, so that Skill Seal has something to take away (spec R2). Authoring
# EX here would make the whole clause unobservable.
parameters: { str: D, end: C, agi: "A+", mag: B, luc: E }
baseHealth: 1000
mov: 7
range: { panels: 3, targets: 1 }
# 65, not the STR D table's 75. The sheet's own figure, and Serenity -- also
# STR D, also a Presence Concealment user -- is authored at 65 too, so it is a
# consistent authorial choice for Assassins rather than a transcription slip.
baseAttack: { str: 65, mag: 175 }
# Spec R7. His sheet names no component; Semiramis is the precedent (STR 45 /
# MAG 200 and she still swings with STR because her sheet is silent). Both his
# NPs say "Base Attack (STR) is used", and Reinforcement and Lethal Gunfire
# Suppression are both about NORMAL Attacks -- a gunman's identity.
normalAttack: { mode: fixed, component: str }
# Independent Action A's own table value, stated here because the skill does not
# GRANT turns -- it is the reason the number is high.
sustainability: "8◈"

abilities:
  - { ref: class-presence-concealment, rank: "A+" }
  - { ref: class-independent-action, rank: A }
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/kiritsugu.test.mjs`
Expected: PASS, 6 tests.

If `lookup("presenceConcealmentDiscover", "A+")` does not return `5`, do **not** author an override — read `module/domain/tables.mjs` and report the discrepancy, because the spec's §1.1 claim is then wrong.

- [ ] **Step 5: Validate and commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/servants/kiritsugu.yml test/unit/kiritsugu.test.mjs
git commit -m "feat(content): Kiritsugu's statline, and two class skills that cost a ref line"
```

---

## Task 2: An aura that carries a check modifier — and Affection's passive

Spec §4.2, §8b, R2, R3.

**Files:**
- Modify: `module/rules/auras.mjs` (`ROUTES`)
- Create: `packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml` (passive half)
- Modify: `test/unit/kiritsugu.test.mjs`
- Modify: `packs/_source/servants/kiritsugu.yml` (add the ref)

**Interfaces:**
- Consumes: `collectAuras(unit, board, index)` and `annotateAuras(units, board, index)` from `module/rules/auras.mjs`; `checkPlan(unit, check, opts)` from `module/rules/checks.mjs`.
- Produces: aura contributions whose `key` is `checkModifier` land in `unit.checkModifiers`, where `checkPlan` reads them.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/kiritsugu.test.mjs`:

```js
import { annotateAuras } from "../../module/rules/auras.mjs";
import { checkPlan } from "../../module/rules/checks.mjs";

describe("Affection of the Holy Grail — the aura", () => {
  // Two allies and an enemy, all within 2 panels of Kiritsugu.
  const board = () => ({
    units: [
      {
        id: "kiritsugu", panel: { i: 5, j: 5 }, factionId: "red",
        auras: [{
          key: "checkModifier", check: "luck", value: 4,
          radius: 2, relations: ["ally", "enemy"], stacking: "highestOnly",
          source: "Affection of the Holy Grail",
        }],
      },
      { id: "ally", panel: { i: 5, j: 6 }, factionId: "red", auras: [] },
      { id: "enemy", panel: { i: 6, j: 6 }, factionId: "blue", auras: [] },
      { id: "distant", panel: { i: 5, j: 12 }, factionId: "red", auras: [] },
    ],
  });

  it("reaches an ALLY's checkModifiers, where checkPlan can read it", () => {
    const b = board();
    annotateAuras(b.units, b);
    const ally = b.units.find((u) => u.id === "ally");
    // The whole defect this task fixes: without the route the contribution
    // lands in `modifiers` and `checkPlan` never sees it.
    expect(ally.checkModifiers ?? []).toHaveLength(1);
    expect(checkPlan(ally, "luck").modifiers.map((m) => m.value)).toEqual([4]);
  });

  it("reaches an ENEMY too — the sheet says 'all Units'", () => {
    const b = board();
    annotateAuras(b.units, b);
    const enemy = b.units.find((u) => u.id === "enemy");
    expect(checkPlan(enemy, "luck").modifiers.map((m) => m.value)).toEqual([4]);
  });

  it("never reaches Kiritsugu himself — 'except himself'", () => {
    const b = board();
    annotateAuras(b.units, b);
    const self = b.units.find((u) => u.id === "kiritsugu");
    expect(checkPlan(self, "luck").modifiers).toEqual([]);
  });

  it("does not reach past 2 panels", () => {
    const b = board();
    annotateAuras(b.units, b);
    const far = b.units.find((u) => u.id === "distant");
    expect(checkPlan(far, "luck").modifiers).toEqual([]);
  });

  it("HINDERS the recipient — a check that passed at 10 now fails (spec R3)", () => {
    // `resolveCheck` succeeds on `total <= target`, so +4 moves a roll AWAY
    // from success. If this test ever reads as a benefit, the sign is inverted.
    const b = board();
    annotateAuras(b.units, b);
    const ally = b.units.find((u) => u.id === "ally");
    const mods = checkPlan(ally, "luck").modifiers;
    const total = 10 + mods.reduce((a, m) => a + m.value, 0);
    expect(total).toBe(14);
    expect(total <= 12).toBe(false);   // a Luck of 12: passed at 10, fails now
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "Affection"`
Expected: FAIL — the first test reports `ally.checkModifiers` is `undefined` or empty, because `ROUTES` has no `checkModifier` entry and the contribution went to `modifiers`.

- [ ] **Step 3: Add the route**

In `module/rules/auras.mjs`, extend `ROUTES`:

```js
const ROUTES = Object.freeze({
  ApplicationChance: "applicationChances",
  Compulsion: "compulsions",
  // Bašmu's protection (`TargetabilityModifier`, `rules/elements.mjs`) — read
  // by `rules/targeting/resolve.mjs`'s legality filter, not the damage
  // pipeline.
  untargetable: "untargetableBy",
  // A check modifier is read from `unit.checkModifiers` by `checks.mjs#checkPlan`,
  // so an aura carrying one landed in `modifiers` and was read by NOBODY —
  // collected correctly, consulted never. Exactly the failure `ApplicationChance`
  // above was given a route to fix.
  //
  // Kiritsugu's Affection of the Holy Grail is the first source: *"the Luck
  // Check rolls of all Units within a 2 panel area ... are increased by 4 except
  // himself"*, which this file's own header already cites as the reason an aura
  // may exclude its bearer.
  checkModifier: "checkModifiers",
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "Affection"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Author the passive half**

`packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# The passive half is three clauses that all hinge on ONE question -- is he
# under Skill Seal? -- and the spec's R2 answers it: Skill Seal is a HARD
# COUNTER, not a trade. Under it the rank shift stops, the aura stops, his
# Skills stay sealed, and he additionally takes +20 to his own Luck Checks.
#
# THE SIGN IS THE CLAUSE. `checks.mjs#resolveCheck` succeeds on `total <=
# target`, so a POSITIVE CheckModifier makes a check HARDER. "Luck Check rolls
# are increased by 4" is therefore a penalty on everyone standing near him,
# allies included -- the Grail's affection is not a blessing he shares.
schema: 1
id: kiritsugu-affection-of-the-holy-grail
name: "Affection of the Holy Grail"
rank: "A+"
kind: skill
slug: affectionOfTheHolyGrail
cooldown: "4◈-⅓◈"
timing: { window: ownTurn }
description: |
  (Passive) Kiritsugu's Luck is increased from Rank E to Rank EX; the Luck Check rolls of all
  Units within a 2 panel area of Kiritsugu are increased by 4 except himself.
  If Kiritsugu is inflicted with @effect[skillSeal]{Skill Seal}, instead of reducing his Max Luck, all of his
  Luck Check rolls are increased by 20; and the original effect is negated. These effects only
  last for the duration of Skill Seal.
  (Active) Applies @effect[pierce]{Pierce} for 1◈ Turns and @effect[critDmUp]{Crit DmUp} for 1◈ Turns (Crit Damage +50%); all Units
  within a 2 panel area except himself are inflicted with @effect[debuffResDwn]{Debuff ResDwn} for 1◈ Turns (+20%).
  Cooldown: 4◈-⅓◈ Turns.
passiveRules:
  # "Kiritsugu's Luck is increased from Rank E to Rank EX."
  #
  # `to:`, not `steps:` -- the sheet names the destination rank, and walking
  # the dense ladder from E would land on E+ / D- rather than EX.
  - key: RankShift
    parameter: luc
    to: EX
    predicate:
      - { not: "self:effect:skillSeal" }

  # "the Luck Check rolls of all Units within a 2 panel area ... except himself"
  #
  # `relations: [ally, enemy]` is the whole of "all Units", and `self` is
  # OMITTED rather than excluded -- the addressing `rules/auras.mjs` documents
  # in its own header, naming this skill.
  - key: Aura
    modifierKey: checkModifier
    check: luck
    radius: 2
    relations: [ally, enemy]
    value: 4
    stacking: highestOnly
    predicate:
      - { not: "self:effect:skillSeal" }

  # "all of his Luck Check rolls are increased by 20"
  #
  # A SUBSTITUTE PENALTY, not compensation (spec R2). +20 against a Luck pool
  # that tops out in the low twenties is close to a guaranteed failure, which
  # is what makes Skill Seal the designed answer to him.
  - key: CheckModifier
    check: luck
    value: 20
    predicate:
      - "self:effect:skillSeal"
```

- [ ] **Step 6: Add the ref and test the predicated shape**

In `packs/_source/servants/kiritsugu.yml`, extend `abilities:`:

```yaml
  - { ref: kiritsugu-affection-of-the-holy-grail }
```

Append to `test/unit/kiritsugu.test.mjs`:

```js
import { collectContributions } from "../../module/rules/elements.mjs";

describe("Affection of the Holy Grail — Skill Seal is a hard counter (R2)", () => {
  const a = src("abilities", "kiritsugu-affection-of-the-holy-grail.yml");
  const rule = (key) => a.passiveRules.filter((r) => r.key === key);

  it("shifts LUC to EX by naming the rank, not by stepping", () => {
    const [shift] = rule("RankShift");
    expect(shift.parameter).toBe("luc");
    expect(shift.to).toBe("EX");
    expect(shift.steps).toBeUndefined();
  });

  it("turns the rank shift AND the aura off under Skill Seal", () => {
    for (const r of [rule("RankShift")[0], rule("Aura")[0]]) {
      expect(r.predicate).toContainEqual({ not: "self:effect:skillSeal" });
    }
  });

  it("adds +20 to his own Luck Checks only under Skill Seal", () => {
    const twenty = rule("CheckModifier").find((r) => r.value === 20);
    expect(twenty.check).toBe("luck");
    expect(twenty.predicate).toEqual(["self:effect:skillSeal"]);
  });

  it("never negates Skill Seal's own lockout", () => {
    // R2: his Skills stay sealed. Nothing here may Suppress the skill/spell
    // prevention that `rules/budget.mjs` applies.
    const suppresses = a.passiveRules.some((r) => r.key === "Suppress");
    expect(suppresses).toBe(false);
  });

  it("addresses allies and enemies but omits self", () => {
    const [aura] = rule("Aura");
    expect(aura.relations).toEqual(["ally", "enemy"]);
    expect(aura.relations).not.toContain("self");
    expect(aura.radius).toBe(2);
  });
});
```

- [ ] **Step 7: Run the full gate**

Run: `npm test && npm run lint && npm run validate:content`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add module/rules/auras.mjs packs/_source/ test/unit/kiritsugu.test.mjs
git commit -m "feat(rules): an aura may carry a check modifier -- and Affection's passive"
```

---

## Task 3: Attacker-borne attack properties — `pierce`, and Affection's Active

Spec §4.3, §8d.

**Files:**
- Modify: `module/rules/elements.mjs`, `module/rules/authoring/elements.mjs`, `tools/lib/content.mjs`
- Modify: `module/rules/snapshot.mjs`, `module/engine/attack.mjs`
- Create: `packs/_source/effects/pierce.yml`
- Modify: `packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml` (the Active half)
- Modify: `lang/en.json`

**Interfaces:**
- Produces: rule element `AttackProperty` → `out.attackProperties: Array<{property: string, value: number|boolean, predicate: object[]|null, source: string}>`, projected onto `unit.attackProperties` by the snapshot, folded into the attack spec by `buildAttackSpec`.
- Consumed by: `module/rules/damage/pipeline.mjs` via `s.ctx.attack.pierce` and `s.ctx.attack.ignoresDefUp`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/kiritsugu.test.mjs`:

```js
describe("AttackProperty — a buff that grants Pierce", () => {
  it("collects onto attackProperties, not into modifiers", () => {
    const out = collectContributions({
      effects: [],
      rules: [{ key: "AttackProperty", property: "pierce", value: true }],
    }, { source: "Pierce" });
    expect(out.attackProperties).toEqual([
      expect.objectContaining({ property: "pierce", value: true }),
    ]);
    expect(out.modifiers).toEqual([]);
  });

  it("carries a fraction, for Penetration's halved Invuln", () => {
    const out = collectContributions({
      effects: [],
      rules: [{ key: "AttackProperty", property: "invulnFactor", value: 0.5 }],
    }, { source: "Penetration" });
    expect(out.attackProperties[0].value).toBe(0.5);
  });
});
```

Note: match `collectContributions`'s real signature — read it at `module/rules/elements.mjs` before writing this test and adapt the call shape. The **assertion** is what matters: the contribution lands in `attackProperties` and not in `modifiers`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "AttackProperty"`
Expected: FAIL — `out.attackProperties` is `undefined`; the key is unknown so the element lands in `out.unhandled`.

- [ ] **Step 3: Add the executor**

In `module/rules/elements.mjs`, add `attackProperties: []` to the `out` initialiser (beside `auras: []`, `applicationChances: []`), and add the executor in Group 2:

```js
  /**
   * A property of the ATTACK, contributed by a buff on the attacker.
   *
   * `attack.pierce` has always come from `resolvedDamage(ability, options)` —
   * the ability's OWN damage block — and `ignoresDefensiveBuffs` is set by the
   * Heel resolver. So an effect that grants one had no path at all, which is
   * why there is no `pierce` effect document in the corpus despite `Pierce`
   * being in Appendix A.
   *
   * Kiritsugu needs three of them: *"Applies Pierce to himself"* (Affection),
   * *"the Ignore Def effect and halves the effect of Invuln"* (Penetration),
   * and Chronos Rose's Ignore Def — which is the ability's own and could have
   * stayed in its damage block, but reads better beside the other two.
   *
   * `predicate` is deferred like `CheckModifier`'s: a property conditioned on
   * the attack cannot be answered when the buff is applied.
   */
  AttackProperty(el, { rank, source, out, ctx, deferred = null }) {
    out.attackProperties.push({
      property: el.property,
      value: el.value === undefined ? true : scalar(resolveValue(el, rank, ctx)) ?? el.value,
      predicate: deferred,
      source,
    });
  },
```

If `scalar(resolveValue(...))` returns `null` for a boolean `true`, take `el.value` directly — the intent is that `value: true` stays boolean and `value: 0.5` stays numeric.

Mirror the key `"AttackProperty"` into `module/rules/authoring/elements.mjs` and into `RULE_ELEMENT_KEYS` in `tools/lib/content.mjs` (Group 2, beside `DamageModifier`).

- [ ] **Step 4: Run the element tests**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "AttackProperty" && npx vitest run test/unit/elements.test.mjs`
Expected: both PASS. `elements.test.mjs` is the drift test that holds the three key lists against each other — if it fails, one of the three mirrors was missed.

- [ ] **Step 5: Project and consume**

In `module/rules/snapshot.mjs`, beside `checkModifiers: contributions.checkModifiers,`:

```js
    // Attack properties the ATTACKER's own buffs contribute — folded into the
    // attack spec by `engine/attack.mjs#buildAttackSpec`. Projected here
    // because a contribution the snapshot does not carry is a contribution the
    // engine cannot read, which is how `system.concealed` sat unanswered
    // through four subsystems.
    attackProperties: contributions.attackProperties ?? [],
```

In `module/engine/attack.mjs#buildAttackSpec`, fold the attacker's properties into the spec beside the existing `pierce:` read. Find the line `pierce: Boolean(resolvedDamage(ability, options)?.pierce),` and make it consult both sources:

```js
      // The ability's own damage block OR a buff on the attacker. Kiritsugu's
      // Penetration and Affection of the Holy Grail are the first buffs in the
      // game to grant an attack property.
      //
      // Read off the SNAPSHOT (`attacker.attackProperties`), not off the
      // document — the same mix-up that made `normalAttackAt` return a null
      // element for every Servant in the game, eight lines from here.
      pierce: Boolean(resolvedDamage(ability, options)?.pierce)
        || attackerGrants(attacker, "pierce"),
      ignoresDefUp: Boolean(resolvedDamage(ability, options)?.ignoresDefUp)
        || attackerGrants(attacker, "ignoresDefUp"),
      invulnFactor: attackerProperty(attacker, "invulnFactor", 0),
```

and add the two helpers near the bottom of the file:

```js
/**
 * Does a buff on the attacker grant this boolean attack property?
 *
 * @param {object} attacker a unit SNAPSHOT
 * @param {string} property
 * @returns {boolean}
 */
function attackerGrants(attacker, property) {
  return (attacker?.attackProperties ?? []).some(
    (p) => p.property === property && p.value !== false && p.value !== 0,
  );
}

/**
 * The strongest numeric value any buff contributes for this property.
 *
 * `Math.max`, because these are all "how much of the defence gets through" and
 * two sources should not multiply into near-total bypass by accident.
 *
 * @param {object} attacker
 * @param {string} property
 * @param {number} fallback
 * @returns {number}
 */
function attackerProperty(attacker, property, fallback) {
  const values = (attacker?.attackProperties ?? [])
    .filter((p) => p.property === property && typeof p.value === "number")
    .map((p) => p.value);
  return values.length > 0 ? Math.max(...values) : fallback;
}
```

- [ ] **Step 6: Author the `pierce` effect**

`packs/_source/effects/pierce.yml`:

```yaml
# Appendix A — and the first Pierce DOCUMENT in the corpus.
#
# `Pierce` has been read by the damage pipeline since it was written
# (`bypassesDefence`, the `invuln` branch, the `Dmg Cut` exception) and has
# always arrived from an ABILITY's own damage block. Nothing could grant it as
# a buff, so there was no effect to grant. Kiritsugu's Affection of the Holy
# Grail is the first clause that needs one: *"Applies Pierce to himself for 1◈
# Turns."*
schema: 1
id: pierce
name: "Pierce"
description: "This Unit's Attacks ignore Invuln and Block. Does not bypass Dmg Cut."
polarity: buff
volatility: nonVolatile
valence: offensive
stacking: noneRefresh
baseChance: 100
rules:
  - key: AttackProperty
    property: pierce
    value: true
```

- [ ] **Step 7: Author Affection's Active half**

Append to `packs/_source/abilities/kiritsugu-affection-of-the-holy-grail.yml`:

```yaml
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: pierce, duration: "1◈" }
      - { id: critDmUp, magnitude: 50, duration: "1◈" }

  # "all Units within a 2 panel area of Kiritsugu EXCEPT HIMSELF are inflicted
  # with Debuff ResDwn" -- an inflicted debuff on a radius, so it is a targeted
  # phase rather than an aura: the sheet says "are inflicted with", which is a
  # one-off application that survives him walking away.
  - kind: applyEffects
    target: area
    area: { radius: 2, relations: [ally, enemy], includeSelf: false }
    effects:
      - { id: debuffResDwn, magnitude: 20, duration: "1◈" }
```

Check `module/rules/authoring/phases.mjs` for the exact `area` spec shape before writing this; adapt to whatever the corpus already uses for a radius-targeted `applyEffects` (Penthesilea's Charisma and EMIYA's Eye of the Mind both apply to allies in a radius).

- [ ] **Step 8: Add the language strings**

Add to `lang/en.json` any `FGT.*` key referenced above. If none were introduced, skip.

- [ ] **Step 9: Run the gate and commit**

```bash
npm test && npm run lint && npm run validate:content && npm run check:manifest
git add module/ tools/ packs/_source/ lang/en.json test/
git commit -m "feat(rules): a buff may grant an attack property -- the corpus gets a Pierce"
```

---

## Task 4: Reinforcement and Familiars — two Spells that need no engine

Spec §5, §7.

**Files:**
- Create: `packs/_source/abilities/kiritsugu-reinforcement.yml`, `packs/_source/abilities/kiritsugu-familiars.yml`, `packs/_source/effects/crit-up-familiar.yml`
- Modify: `packs/_source/servants/kiritsugu.yml`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Consumes: the `thaumaturgy` category and `isSpell: true`, both already routed.
- Produces: content ids `kiritsugu-reinforcement`, `kiritsugu-familiars`, effect id `critUpFamiliar` — all three consumed by Task 5's per-Turn limit.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/kiritsugu.test.mjs`:

```js
describe("The three Thaumaturgy Spells share a shape", () => {
  const ids = ["kiritsugu-reinforcement", "kiritsugu-familiars"];

  it.each(ids)("%s is a Spell of category thaumaturgy that is not an Attack", (id) => {
    const a = src("abilities", `${id}.yml`);
    expect(a.category).toBe("thaumaturgy");
    expect(a.isSpell).toBe(true);
    // `isSpell` is one of the three things that make an ability count as an
    // Attack, so leaving this unset would spend his Attack for the Turn.
    expect(a.countsAsAttack).toBe(false);
    expect(a.negatedBy).toContain("silence");
  });

  it("Reinforcement buffs NORMAL attacks only, for one Combat Phase", () => {
    const a = src("abilities", "kiritsugu-reinforcement.yml");
    const [eff] = a.phases[0].effects;
    // nAtkUp, not atkUp -- "Normal Attack damage" is explicit and a blanket
    // Atk Up would quietly buff both his Noble Phantasms.
    expect(eff.id).toBe("nAtkUp");
    expect(eff.magnitude).toBe(40);
    expect(eff.duration).toBe("⅓◈");
    expect(a.cooldown).toBe("2◈");
    expect(a.timing.window).toContain("combatPhaseStart");
  });

  it("Familiars grants both its buffs for 1◈", () => {
    const a = src("abilities", "kiritsugu-familiars.yml");
    const byId = Object.fromEntries(a.phases[0].effects.map((e) => [e.id, e]));
    expect(byId.rangeUp.magnitude).toBe(2);
    expect(byId.critUpFamiliar.magnitude).toBe(30);
    expect(byId.rangeUp.duration).toBe("1◈");
    expect(byId.critUpFamiliar.duration).toBe("1◈");
    expect(a.cooldown).toBe("4◈");
  });

  it("Crit Up (Familiar) is range-conditional and DEFERRED", () => {
    const e = src("effects", "crit-up-familiar.yml");
    const [rule] = e.rules;
    expect(rule.check).toBe("crit");
    // The distance does not exist when the buff is applied, so answering the
    // predicate at collection time answers it wrong and drops the modifier.
    expect(rule.predicate).toEqual(["attack:range:gte:3"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "Thaumaturgy"`
Expected: FAIL — `ENOENT` on the three new files.

- [ ] **Step 3: Write the three files**

`packs/_source/abilities/kiritsugu-reinforcement.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# EMIYA's Reinforcement at a higher number (40% vs 30%) and a longer cooldown
# (2◈ vs 1◈). Same father, same spell.
schema: 1
id: kiritsugu-reinforcement
name: "Thaumaturgy: Reinforcement"
rank: null
kind: skill
slug: reinforcement
category: thaumaturgy
isSpell: true
cooldown: "2◈"
timing: { window: [ownTurn, combatPhaseStart] }
countsAsAttack: false
negatedBy: [silence]
requirements:
  - { kind: notHasEffect, effectId: silence }
description: |
  Spell. Used at the start of a Combat Phase. During this Combat Phase, Normal Attack damage
  dealt is increased by 40%. Cooldown: 2◈ Turns.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    target: self
    effects:
      # "During this Combat Phase" is one exchange, and ⅓◈ -- one Turn -- is the
      # shortest the tick grammar has.
      - { id: nAtkUp, magnitude: 40, duration: "⅓◈" }
```

`packs/_source/effects/crit-up-familiar.yml`:

```yaml
# Kiritsugu's Thaumaturgy: Familiars.
#
# The same shape as EMIYA's `critUpHawkeye` and its own document for the same
# reason: a plain `critUp` would raise his crit rate in melee, where the clause
# gives him nothing at all. The whole clause is "at a Range of 3 or higher" --
# which is exactly his own Range, so the familiars scout for shots he could
# already take and sharpen only those.
schema: 1
id: critUpFamiliar
name: "Crit Up (Familiar)"
description: "Crit Chance is increased by X% for Attacks at a Range of 3 or higher."
polarity: buff
volatility: nonVolatile
valence: offensive
stacking: magnitudeStacks
baseChance: 100
rules:
  - key: CheckModifier
    check: crit
    value: "@magnitude"
    # DEFERRED. The distance does not exist when the buff is applied, so
    # answering it at collection time answers it wrong and drops the modifier
    # for ever. `critChance` re-tests it with the attack in scope.
    predicate: ["attack:range:gte:3"]
```

`packs/_source/abilities/kiritsugu-familiars.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# Two buffs that only make sense together: +2 Range takes him from 3 to 5, and
# the Crit Up applies at Range 3 or higher -- so the spell widens the band AND
# sharpens everything inside it.
schema: 1
id: kiritsugu-familiars
name: "Thaumaturgy: Familiars"
rank: null
kind: skill
slug: familiars
category: thaumaturgy
isSpell: true
cooldown: "4◈"
timing: { window: ownTurn }
countsAsAttack: false
negatedBy: [silence]
requirements:
  - { kind: notHasEffect, effectId: silence }
description: |
  Spell. Used during your Turn. Applies @effect[rangeUp]{Range Up} for 1◈ Turns, Range is increased by 2
  panels; and applies @effect[critUpFamiliar]{Crit Up (Familiar)} for 1◈ Turns, Crit Chance for Attacks at a Range of
  3 or higher is increased by 30%. Cooldown: 4◈ Turns.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: rangeUp, magnitude: 2, duration: "1◈" }
      - { id: critUpFamiliar, magnitude: 30, duration: "1◈" }
```

- [ ] **Step 4: Add the refs**

In `packs/_source/servants/kiritsugu.yml`:

```yaml
  - { ref: kiritsugu-reinforcement }
  - { ref: kiritsugu-familiars }
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run test/unit/kiritsugu.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/ test/unit/kiritsugu.test.mjs
git commit -m "feat(content): Reinforcement and Familiars -- two Spells the engine already had"
```

---

## Task 5: A per-Turn limit scoped to a category — and Magecraft

Spec §4.1, §4, §4b.

**Files:**
- Modify: `module/rules/elements.mjs`, `module/rules/authoring/elements.mjs`, `tools/lib/content.mjs`
- Modify: `module/rules/costs.mjs`, `module/rules/snapshot.mjs`
- Create: `packs/_source/abilities/kiritsugu-magecraft.yml`
- Modify: `lang/en.json`, `packs/_source/servants/kiritsugu.yml`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Produces: rule element `CategoryUseLimit` → `out.categoryUseLimits: Array<{category: string, perTurn: number, source: string}>`, projected onto `unit.categoryUseLimits`.
- Produces: `canUseAbility` returns `{ok: false, reason: "categoryUseLimit", detail: {category, perTurn}}` when the limit is spent.
- Produces: an ability carrying `bypassesCategoryLimit: true` is exempt.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/kiritsugu.test.mjs`:

```js
import { canUseAbility } from "../../module/rules/costs.mjs";

describe("Magecraft — one Thaumaturgy Spell per Turn", () => {
  const unit = (used) => ({
    id: "kiritsugu",
    categoryUseLimits: [{ category: "thaumaturgy", perTurn: 1, source: "Magecraft" }],
    turnState: { abilitiesUsed: used },
    effects: [], modifiers: [], suppressions: [],
  });
  const spell = (id, extra = {}) => ({
    id, contentId: id, category: "thaumaturgy", isSpell: true, ...extra,
  });

  it("allows the first Spell of the Turn", () => {
    const r = canUseAbility(spell("kiritsugu-reinforcement"), unit([]));
    expect(r.ok).toBe(true);
  });

  it("refuses the SECOND, naming the category", () => {
    const r = canUseAbility(
      spell("kiritsugu-familiars"), unit(["kiritsugu-reinforcement"]),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("categoryUseLimit");
    expect(r.detail.category).toBe("thaumaturgy");
  });

  it("does not refuse an ability of a DIFFERENT category", () => {
    const r = canUseAbility(
      { id: "kiritsugu-scapegoat", contentId: "kiritsugu-scapegoat" },
      unit(["kiritsugu-reinforcement"]),
    );
    expect(r.ok).toBe(true);
  });

  it("exempts a use flagged bypassesCategoryLimit — the LGS free Spell", () => {
    // "This does not count towards the one Thaumaturgy Spell usage per Turn,
    // but it will still enter Cooldown." The exemption is why this cannot be
    // `sameTurnExclusive`, which has no way to say it.
    const r = canUseAbility(
      spell("kiritsugu-penetration", { bypassesCategoryLimit: true }),
      unit(["kiritsugu-reinforcement"]),
    );
    expect(r.ok).toBe(true);
  });

  it("does not limit a unit with no such limit declared", () => {
    const r = canUseAbility(spell("emiya-reinforcement"), {
      id: "emiya", turnState: { abilitiesUsed: ["emiya-tracing"] },
      effects: [], modifiers: [], suppressions: [],
    });
    expect(r.ok).toBe(true);
  });
});
```

Adapt the `unit` shape to whatever `canUseAbility` actually requires — read its signature and the shapes the existing `costs` tests build. The **assertions** are the contract.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "Magecraft"`
Expected: FAIL — the second Spell is allowed, because no gate exists.

- [ ] **Step 3: Add the executor**

In `module/rules/elements.mjs`, add `categoryUseLimits: []` to the `out` initialiser and the executor in Group 6:

```js
  /**
   * A cap on how many abilities of one CATEGORY may be used per Turn.
   *
   * Kiritsugu's Magecraft: *"Only one Thaumaturgy Spell can be used per Turn."*
   *
   * Not `sameTurnExclusive`, for two reasons. It names ability IDS, so three
   * Spells need six cross-references that go stale the moment a fourth is
   * authored. And — decisively — it has no way to express an EXEMPTION, which
   * this sheet states outright: Lethal Gunfire Suppression lets him cast one
   * *"[which] does not count towards the one Thaumaturgy Spell usage per
   * Turn, but it will still enter Cooldown."*
   *
   * Declared by the skill that STATES the rule, rather than by each ability the
   * rule happens to catch — so a fourth Spell is caught by being a Spell.
   */
  CategoryUseLimit(el, { source, out }) {
    out.categoryUseLimits.push({
      category: el.category,
      perTurn: el.perTurn ?? 1,
      source,
    });
  },
```

Mirror `"CategoryUseLimit"` into `module/rules/authoring/elements.mjs` and `RULE_ELEMENT_KEYS`.

- [ ] **Step 4: Project it**

In `module/rules/snapshot.mjs`, beside `attackProperties`:

```js
    // Per-category Turn caps, read by `rules/costs.mjs#canUseAbility`.
    categoryUseLimits: contributions.categoryUseLimits ?? [],
```

- [ ] **Step 5: Add the gate**

In `module/rules/costs.mjs`, immediately **after** the existing `oncePerTurn` block:

```js
  // The same question one scale WIDER: a cap on a whole category rather than on
  // one ability. Kiritsugu's Magecraft is *"Only one Thaumaturgy Spell can be
  // used per Turn"*, which no per-ability field can say — and which
  // `sameTurnExclusive` cannot say either, because the sheet grants an
  // exemption from it and an id list has nowhere to put one.
  //
  // Refused HERE rather than at resolution, so the button greys out with a
  // reason: a player who presses a Spell and watches nothing happen has not
  // been told the rule.
  const categoryLimit = categoryLimitFor(ability, unit);
  if (categoryLimit) {
    return { ok: false, reason: "categoryUseLimit", detail: categoryLimit, cost };
  }
```

and the helper beside `firstUsed`:

```js
/**
 * The category cap this use would break, if any.
 *
 * `bypassesCategoryLimit` is the sheet's stated exemption and is checked FIRST:
 * the free Spell inside Lethal Gunfire Suppression's trigger still enters
 * Cooldown, so it is exempt from the count and not from the consequence.
 *
 * The count is over abilities ALREADY used this Turn that share the category,
 * which is why the Turn record has to carry enough to identify them — a bare
 * id list is matched against the unit's own abilities by the caller.
 *
 * @param {object} ability
 * @param {object} unit
 * @returns {{category: string, perTurn: number, source: string}|null}
 */
function categoryLimitFor(ability, unit) {
  if (!ability?.category || ability.bypassesCategoryLimit) return null;
  const limit = (unit?.categoryUseLimits ?? []).find((l) => l.category === ability.category);
  if (!limit) return null;

  const used = usedThisTurn(unit).filter((entry) => {
    // The record may hold plain ids or `{id, category}` entries; both shapes
    // appear because `intents.mjs` stamps the record from two call sites.
    if (typeof entry === "object") return entry.category === ability.category;
    return (unit?.abilityCategories ?? {})[entry] === ability.category;
  });

  return used.length >= limit.perTurn ? limit : null;
}
```

If the Turn record carries only bare ids and the snapshot has no `abilityCategories` map, add one in `snapshot.mjs` (`{[contentId]: category}` over the unit's abilities) — a map the gate can consult is cheaper and more honest than widening the record's shape.

- [ ] **Step 6: Add the refusal string**

In `lang/en.json`:

```json
"FGT.Cost.CategoryUseLimit": "Only {perTurn} {category} ability may be used per Turn ({source}).",
```

Wire it wherever `oncePerTurn`'s refusal string is rendered — grep `FGT.Cost.OncePerTurn` to find the site.

- [ ] **Step 7: Author Magecraft**

`packs/_source/abilities/kiritsugu-magecraft.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# EMIYA's Magecraft is the same skill one rank lower with a different second
# passive. Both allow Thaumaturgy; his father's also RATIONS it.
schema: 1
id: kiritsugu-magecraft
name: "Magecraft"
rank: B
kind: skill
passive: true
slug: magecraft
description: |
  (Passive 1) Allows the use of Thaumaturgy. Only one Thaumaturgy Spell can be used per Turn.
  (Passive 2) Whenever a Thaumaturgy Spell is used, extend the duration of the
  @effect[suppression]{Suppression} buff by 1◈ Turns.
passiveRules:
  # Passive 1's SECOND half. The first half -- "allows the use of Thaumaturgy"
  # -- is not a rule element: `isSpell` on each Thaumaturgy document is what
  # routes it, and a grant that added nothing would be a second, quieter place
  # for the same fact to be wrong. That is EMIYA's Magecraft's own reasoning.
  - key: CategoryUseLimit
    category: thaumaturgy
    perTurn: 1

  # Passive 2 lands in Task 9, WITH the `suppression` effect it names. Authoring
  # it here would be a `DurationExtension` pointing at an effect id that does
  # not exist yet -- `validate:content` would refuse it, and if it did not, the
  # rule would sit in the compendium extending nothing.
```

Leave the `description` above complete (it describes both passives) but author only the
`CategoryUseLimit` rule in this task.

- [ ] **Step 8: Add the ref, run, commit**

Add `- { ref: kiritsugu-magecraft }` to the Servant.

```bash
npm test && npm run lint && npm run validate:content
git add module/ tools/ packs/_source/ lang/en.json test/
git commit -m "feat(rules): a per-Turn cap on a category, and an exemption an id list cannot express"
```

---

## Task 6: Penetration — Ignore Def, and an Invuln that halves

Spec §6, §4.3.

**Files:**
- Modify: `module/rules/damage/pipeline.mjs`
- Create: `packs/_source/effects/penetration.yml`, `packs/_source/abilities/kiritsugu-penetration.yml`
- Modify: `packs/_source/servants/kiritsugu.yml`, `test/unit/kiritsugu.test.mjs`, `test/golden/damage.test.mjs`

**Interfaces:**
- Consumes: `attack.invulnFactor` from Task 3's `attackerProperty(attacker, "invulnFactor", 0)`.
- Produces: a defender's `invuln` reduces damage to `total * invulnFactor` instead of to zero, when the attack carries a factor.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/kiritsugu.test.mjs`:

```js
describe("Penetration — Invuln halves instead of negating", () => {
  const effect = () => src("effects", "penetration.yml");

  it("grants both properties the sheet names", () => {
    const props = Object.fromEntries(
      effect().rules.filter((r) => r.key === "AttackProperty")
        .map((r) => [r.property, r.value]),
    );
    expect(props.ignoresDefUp).toBe(true);
    // "halves the effect of Invuln" -- half the damage gets through, so the
    // factor is what SURVIVES, not what is removed.
    expect(props.invulnFactor).toBe(0.5);
  });

  it("lasts ⅓◈ and costs 3◈", () => {
    const a = src("abilities", "kiritsugu-penetration.yml");
    expect(a.phases[0].effects[0]).toEqual(
      expect.objectContaining({ id: "penetration", duration: "⅓◈" }),
    );
    expect(a.cooldown).toBe("3◈");
  });
});
```

Then the pipeline test, in `test/golden/damage.test.mjs` — that is where the pipeline harness
(`unit()`, `baseCtx()`, `mk()`) already lives, and where the existing Invuln golden sits. Add it
immediately after `"Invuln zeroes a normal attack but not one with Pierce"`:

```js
  it("Penetration leaves exactly half standing where Invuln would zero it", () => {
    // The existing golden above: Invuln is total negation, Pierce is total
    // bypass. Penetration is the first clause that sits BETWEEN them.
    expect(computeDamage(mk(unit({ effects: ["invuln"] }))).total).toBe(0);

    const halved = mk(unit({ effects: ["invuln"] }));
    halved.attack.invulnFactor = 0.5;
    expect(computeDamage(halved).total).toBe(150);

    // Pierce still bypasses entirely — the two are different clauses and must
    // not collapse into each other.
    const pierced = mk(unit({ effects: ["invuln"] }));
    pierced.attack.pierce = true;
    expect(computeDamage(pierced).total).toBe(300);
  });

  it("a halved Invuln did not NEGATE, and the card must not say it did", () => {
    const halved = mk(unit({ effects: ["invuln"] }));
    halved.attack.invulnFactor = 0.5;
    expect(computeDamage(halved).flags.negatedBy).not.toBe("Invuln");
    expect(computeDamage(mk(unit({ effects: ["invuln"] }))).flags.negatedBy).toBe("Invuln");
  });
```

The `300` and `150` are the harness's own default attack total — confirm against the neighbouring
golden and use whatever `mk()` actually produces.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "Penetration"`
Expected: FAIL — `ENOENT`, then the pipeline test fails because `invulnFactor` is ignored.

- [ ] **Step 3: Teach the pipeline to halve**

In `module/rules/damage/pipeline.mjs`, at the `invuln` branch (in `stage16AbsorptionAndClamp`, near line 946):

```js
  if (has(d, "invuln") && !s.ctx.attack?.pierce) {
    // Ordinarily total negation. Kiritsugu's Penetration is the first clause in
    // the game that WEAKENS Invuln rather than bypassing it outright --
    // *"halves the effect of Invuln"* -- so the factor is how much damage
    // survives, and 0 (the default) reproduces the old behaviour exactly.
    const survives = s.ctx.attack?.invulnFactor ?? 0;
    const removed = -s.total * (1 - survives);
    s.contribute("invuln", removed, survives > 0 ? "Invuln (halved)" : "Invuln", "defender");
    if (survives === 0) s.flags.negatedBy = "Invuln";
  }
```

Preserve whatever the surrounding lines do with `s.flags.negatedBy` — only set it when the negation is total, because a halved Invuln did not negate anything and a chat card saying it did would be a lie.

- [ ] **Step 4: Author the effect and the Spell**

`packs/_source/effects/penetration.yml`:

```yaml
# Kiritsugu's Thaumaturgy: Penetration.
#
# Two attack properties on one buff, and the pairing is the clause: Ignore Def
# gets him past the ordinary defensive buffs, and the halved Invuln gets him
# half-way past the one defence that ordinarily cannot be got past at all.
#
# `invulnFactor` is what SURVIVES, not what is removed -- 0.5 leaves half the
# damage standing, and the pipeline's default of 0 reproduces total negation.
schema: 1
id: penetration
name: "Penetration"
description: |
  When this Unit deals damage with an Attack, it has the Ignore Def effect and halves the
  effect of Invuln.
polarity: buff
volatility: nonVolatile
valence: offensive
stacking: noneRefresh
baseChance: 100
rules:
  - key: AttackProperty
    property: ignoresDefUp
    value: true
  - key: AttackProperty
    property: invulnFactor
    value: 0.5
```

`packs/_source/abilities/kiritsugu-penetration.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# ⅓◈ -- one Turn -- for a 3◈ cooldown. The shortest buff he has, and the
# reason Lethal Gunfire Suppression's free Spell matters: cast on his own Turn
# it covers his own attack, cast inside the trigger it covers the shot.
schema: 1
id: kiritsugu-penetration
name: "Thaumaturgy: Penetration"
rank: null
kind: skill
slug: penetration
category: thaumaturgy
isSpell: true
cooldown: "3◈"
timing: { window: ownTurn }
countsAsAttack: false
negatedBy: [silence]
requirements:
  - { kind: notHasEffect, effectId: silence }
description: |
  Spell. Used during your Turn. Applies the @effect[penetration]{Penetration} buff to Kiritsugu for ⅓◈ Turns: when
  Kiritsugu deals damage with an Attack, it has the Ignore Def effect and halves the effect of
  Invuln. Cooldown: 3◈ Turns.
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: penetration, duration: "⅓◈" }
```

- [ ] **Step 5: Add the ref, run, commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/ packs/_source/ test/
git commit -m "feat(rules): an Invuln that halves -- Penetration"
```

---

## Task 7: Scapegoat — a Decoy on an ally, offered at two windows

Spec §9.

**Files:**
- Create: `packs/_source/effects/decoy-scapegoat.yml`, `packs/_source/abilities/kiritsugu-scapegoat.yml`
- Modify: `packs/_source/servants/kiritsugu.yml`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Produces: effect id `decoyScapegoat`, which Task 8's trigger predicate names.
- Consumes: `ALLY_WINDOW` (`whenAllyAttacked`) from `module/rules/windows.mjs`.

- [ ] **Step 1: Write the failing test**

```js
import { ALLY_WINDOW } from "../../module/rules/windows.mjs";

describe("Scapegoat", () => {
  const a = () => src("abilities", "kiritsugu-scapegoat.yml");

  it("is offered on his own Turn AND when an ally is attacked", () => {
    expect(a().timing.window).toContain("ownTurn");
    expect(a().timing.window).toContain(ALLY_WINDOW);
  });

  it("applies its own Decoy variant, not the shared one", () => {
    // Lethal Gunfire Suppression triggers on THIS decoy specifically, so a
    // shared `decoy` would make Mannanán's self-applied Decoy fire his gun.
    const [phase] = a().phases;
    expect(phase.effects[0].id).toBe("decoyScapegoat");
    expect(phase.effects[0].duration).toBe("1◈");
  });

  it("bypasses resistance, because it is applied to an ALLY", () => {
    const e = src("effects", "decoy-scapegoat.yml");
    expect(e.allySelfBypassesResistance).toBe(true);
  });

  it("grants S.Crit Up around Kiritsugu OR the target, for ⅓◈", () => {
    const crit = a().phases.find((p) =>
      (p.effects ?? []).some((e) => e.id === "sCritUp"));
    const eff = crit.effects.find((e) => e.id === "sCritUp");
    expect(eff.magnitude).toBe(15);
    expect(eff.duration).toBe("⅓◈");
    // "all allied Units within a 2 panel area of Kiritsugu OR THE TARGET" --
    // a union of two radii, so both anchors must appear.
    expect(JSON.stringify(crit)).toMatch(/target/);
  });

  it("costs 3◈", () => expect(a().cooldown).toBe("3◈"));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/kiritsugu.test.mjs -t "Scapegoat"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Author both files**

`packs/_source/effects/decoy-scapegoat.yml`:

```yaml
# Kiritsugu's Scapegoat.
#
# Its OWN document rather than the shared `decoy`, because Lethal Gunfire
# Suppression triggers on THIS one specifically. Sharing `decoy` would make
# Mannanán's self-applied Decoy fire Kiritsugu's gun from across the board.
#
# A debuff applied to an ALLY, which is the whole point of the name: the ally
# is bait. `allySelfBypassesResistance` is what stops your own side's debuff
# machinery from refusing it (Ch. 10 §10.6).
schema: 1
id: decoyScapegoat
name: "Decoy (Scapegoat)"
description: |
  Enemy Units within 3 panels (or their own Range, whichever is greater) cannot Move away from
  this Unit, may only Attack and target this Unit, and must Attack it if able. While this Unit is
  Attacked, Kiritsugu may answer with a Normal Attack.
polarity: debuff
volatility: nonVolatile
valence: defensive
stacking: noneRefresh
baseChance: 100
allySelfBypassesResistance: true
rules:
  - key: Decoy
    radius: 3
```

`packs/_source/abilities/kiritsugu-scapegoat.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# Offered at TWO windows, and the second is what makes it a Skill rather than a
# setup: *"Used during your Turn OR when an allied Unit within a 2 panel area of
# Kiritsugu is Attacked."* So it can be played as a save -- the attack is
# already declared and he moves the target onto somebody else.
schema: 1
id: kiritsugu-scapegoat
name: "Scapegoat"
rank: C
kind: skill
slug: scapegoat
cooldown: "3◈"
timing: { window: [ownTurn, whenAllyAttacked] }
countsAsAttack: false
description: |
  (Active) Used during your Turn or when an allied Unit within a 2 panel area of Kiritsugu is
  Attacked. Used on an allied Unit within a 2 panel area of Kiritsugu. Applies
  @effect[decoyScapegoat]{Decoy (Scapegoat)} to that Unit for 1◈ Turns, then applies @effect[sCritUp]{S.Crit Up} for ⅓◈ Turns to all
  allied Units within a 2 panel area of Kiritsugu or the target, Crit Chance is increased by 15%.
  Cooldown: 3◈ Turns.
targeting:
  anchor: { kind: targetUnit, range: 2 }
  shape: { kind: unit }
  selection: { relations: [ally], chooser: all, count: 1 }
phases:
  - kind: applyEffects
    target: reuse
    effects:
      - { id: decoyScapegoat, duration: "1◈" }

  # "to all allied Units within a 2 panel area of Kiritsugu OR THE TARGET" --
  # a UNION of two radii, not an intersection and not a choice. S.Crit Up is
  # unpreventable and unremovable by its own definition, which is right for a
  # buff your own side hands out.
  - kind: applyEffects
    target: area
    area:
      radius: 2
      anchors: [self, reuse]
      relations: [ally]
      includeSelf: true
    effects:
      - { id: sCritUp, magnitude: 15, duration: "⅓◈" }
```

Check `module/rules/authoring/phases.mjs` for the real `area` shape and whether multi-anchor is supported; if it is not, this task gains a step adding `anchors` to the area resolver, with the union tested explicitly.

- [ ] **Step 4: Add the ref, run, commit**

```bash
npm test && npm run lint && npm run validate:content
git add packs/_source/ test/
git commit -m "feat(content): Scapegoat -- a Decoy on an ally, offered as a save"
```

---

## Task 8: The out-of-turn shot

Spec §4.7, §10, R1. **The widest gap.**

**Files:**
- Modify: `module/rules/elements.mjs`, `module/rules/authoring/elements.mjs`, `tools/lib/content.mjs`
- Modify: `module/rules/concealment.mjs` (export the rank comparison), `module/rules/snapshot.mjs`
- Modify: `module/engine/attack.mjs` (dispatch the offer), `module/engine/scheduler.mjs` if the window needs it
- Create: `packs/_source/abilities/kiritsugu-lethal-gunfire-suppression.yml` (passive half)
- Modify: `lang/en.json`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Produces: rule element `TriggeredAttack` → `out.triggeredAttacks: Array<{on: string[], predicate: object[], kind: string, free: boolean, offerSpellCategory: string|null, source: string}>`.
- Produces: `reactionRefusedByAgility(attacker, defender)` exported from `module/rules/concealment.mjs`, returning `string[]`.

- [ ] **Step 1: Write the failing test for the rank comparison**

```js
import { reactionsRefused, reactionRefusedByAgility }
  from "../../module/rules/concealment.mjs";

describe("Lethal Gunfire Suppression — the reaction boundary", () => {
  const u = (agi) => ({ parameters: { agi }, effects: [] });

  it("refuses reactions unless the AU's AGI is STRICTLY higher", () => {
    // Kiritsugu is AGI A+. The sheet: "cannot be Reacted to unless the AU's
    // AGI Rank is HIGHER than Kiritsugu's."
    expect(reactionRefusedByAgility(u("A+"), u("A"))).toEqual(["block", "counter", "evade"]);
    expect(reactionRefusedByAgility(u("A+"), u("A+"))).toEqual(["block", "counter", "evade"]);
    expect(reactionRefusedByAgility(u("A+"), u("EX"))).toEqual([]);
  });

  it("is one boundary apart from Presence Concealment's", () => {
    // PC escapes on "equal to or higher"; this one only on "higher". An equal
    // defender keeps its reactions against PC and loses them against the shot.
    const attacker = { ...u("A+"), effects: ["presenceConcealment"] };
    expect(reactionsRefused(attacker, u("A+"))).toEqual([]);
    expect(reactionRefusedByAgility(u("A+"), u("A+"))).not.toEqual([]);
  });
});
```

Confirm against the sheet whether `evade` is refused too. The sheet says *"cannot be Reacted to"*, which is the whole ladder — unlike Presence Concealment's clause 2, which names Block and Counter only and explicitly leaves Evade available at +4. **Refuse all three**, and note the difference in the file's comment.

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — `reactionRefusedByAgility` is not exported.

- [ ] **Step 3: Add the comparison**

In `module/rules/concealment.mjs`:

```js
/**
 * Reactions refused against an attack that lands before the ladder opens.
 *
 * Kiritsugu's Lethal Gunfire Suppression: *"which cannot be Reacted to unless
 * the AU's AGI Rank is higher than Kiritsugu's."*
 *
 * **One boundary apart from `reactionsRefused` above**, and deliberately in
 * this file rather than in a second one: Presence Concealment escapes on
 * *"equal to or higher"*, this escapes only on *"higher"*, and two copies of
 * rank arithmetic that must disagree by exactly one step is how they end up
 * disagreeing by two.
 *
 * The whole ladder, not Block and Counter — the sheet says *"cannot be Reacted
 * to"* without qualification, where clause 2 of Presence Concealment names its
 * two rungs and leaves Evade open at +4.
 *
 * @param {object} attacker
 * @param {object} defender
 * @returns {string[]}
 */
export function reactionRefusedByAgility(attacker, defender) {
  const theirs = rankOf(defender, "agi");
  const ours = rankOf(attacker, "agi");
  if (ours === null) return [];
  if (theirs !== null && Rank.gt(theirs, ours)) return [];
  return ["block", "counter", "evade"];
}
```

If `Rank.gt` does not exist, use `Rank.gte(theirs, ours, true) && !Rank.eq(theirs, ours)` or whatever the `Rank` API offers — read `module/domain/rank.mjs` and use its own vocabulary rather than inventing a comparison.

- [ ] **Step 4: Add the `TriggeredAttack` executor**

In `module/rules/elements.mjs`, add `triggeredAttacks: []` to `out` and:

```js
  /**
   * A free Attack this Unit may take when something happens to SOMEBODY ELSE.
   *
   * Kiritsugu's Lethal Gunfire Suppression: *"Whenever a Unit inflicted with
   * Decoy (Scapegoat) is Attacked, if that AU is within Kiritsugu's Range,
   * Kiritsugu can instantly perform a Normal Attack on that AU."*
   *
   * **Not `AutoCounter`**, and the difference is the subject. `AutoCounter`
   * fires on its BEARER being attacked; here the bearer of the trigger is the
   * decoy, the responder is Kiritsugu, and they are different units — nothing
   * in the corpus had that shape.
   *
   * **Not automatic.** *"Can"* makes it an offer, and it is offered at
   * `whenAllyAttacked`, which already exists as a window with a dispatcher.
   *
   * `free: true` is spec R1: it does not spend his Attack, does not mark him as
   * having Acted, and has no per-Turn cap. The clause is limited by its trigger
   * — Decoy (Scapegoat) lasts 1◈ behind a 3◈ cooldown — and that is the cost,
   * paid in advance.
   */
  TriggeredAttack(el, { source, out }) {
    out.triggeredAttacks.push({
      on: [el.on ?? "allyAttacked"].flat(),
      predicate: el.predicate ?? [],
      kind: el.kind ?? "normal",
      free: el.free !== false,
      refuseReactionsUnlessFasterThanSelf: Boolean(el.refuseReactionsUnlessFasterThanSelf),
      // "Kiritsugu can use a Thaumaturgy Spell once before performing this
      // Normal Attack" — the category is named so the offer can filter, and
      // the exemption travels with it (Task 5).
      offerSpellCategory: el.offerSpellCategory ?? null,
      source,
    });
  },
```

Mirror `"TriggeredAttack"` into the other two key lists. Project `triggeredAttacks: contributions.triggeredAttacks ?? []` in `snapshot.mjs`.

- [ ] **Step 5: Author the passive half**

`packs/_source/abilities/kiritsugu-lethal-gunfire-suppression.yml` (passive only for now — the Active lands in Task 9):

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# The passive is the most REACTIVE clause in the reference set: an attack he
# takes on somebody else's Turn, triggered by a third party being attacked,
# with an optional Spell cast inside the trigger.
#
# Free and uncapped (spec R1). The cost was paid when Scapegoat was spent --
# Decoy (Scapegoat) lasts 1◈ behind a 3◈ cooldown, and the AU has to be inside
# his Range. That is the limiter; a budget would be a second one.
schema: 1
id: kiritsugu-lethal-gunfire-suppression
name: "Lethal Gunfire Suppression"
rank: "B+"
kind: skill
slug: lethalGunfireSuppression
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Passive) Whenever a Unit inflicted with @effect[decoyScapegoat]{Decoy (Scapegoat)} is Attacked, if that Attacking Unit
  is within Kiritsugu's Range, Kiritsugu can instantly perform a Normal Attack on it which cannot
  be Reacted to unless that Unit's AGI Rank is higher than Kiritsugu's. Kiritsugu may use one
  Thaumaturgy Spell before this Normal Attack; it does not count towards his one Spell per Turn,
  but it still enters Cooldown.
passiveRules:
  - key: TriggeredAttack
    on: [allyAttacked]
    kind: normal
    # R1 -- costs him nothing, no per-Turn cap.
    free: true
    refuseReactionsUnlessFasterThanSelf: true
    offerSpellCategory: thaumaturgy
    predicate:
      # The unit being attacked must carry HIS decoy...
      - "target:effect:decoyScapegoat"
      # ...and the attacker must be somewhere he can shoot.
      - "attacker:withinRangeOf:self"
```

Both roll options must exist and be emittable. Check `module/rules/facets.mjs`; add facets for any that do not, and assert emittability in the test — a predicate naming an unemittable option is answered `false` for ever, which is the *"right and inert"* failure this spec's Method section warns about.

- [ ] **Step 6: Write the emittability test**

```js
import { rollOptionsFor, isEmittableOption } from "../../module/rules/options.mjs";

describe("Lethal Gunfire Suppression — its predicate can actually be answered", () => {
  it("names only emittable roll options", () => {
    const a = src("abilities", "kiritsugu-lethal-gunfire-suppression.yml");
    const [rule] = a.passiveRules.filter((r) => r.key === "TriggeredAttack");
    for (const option of rule.predicate) {
      expect(isEmittableOption(option), `${option} is not emittable`).toBe(true);
    }
  });
});
```

- [ ] **Step 7: Dispatch the offer**

In `module/engine/attack.mjs`, where the `whenAllyAttacked` window is already dispatched, extend the offer to include `triggeredAttacks` whose `on` includes `allyAttacked` and whose predicate holds. Grep `ALLY_WINDOW` to find the dispatcher.

The shot must:
1. offer the Spell first (Task 5's `bypassesCategoryLimit: true` on that use),
2. then resolve a Normal Attack from Kiritsugu at the attacking unit,
3. apply `reactionRefusedByAgility` to the ladder,
4. and **not** record an Attack against his Turn (R1).

- [ ] **Step 8: Run the gate and commit**

```bash
npm test && npm run lint && npm run validate:content && npm run check:manifest
git add module/ tools/ packs/_source/ lang/en.json test/
git commit -m "feat(engine): an attack triggered by somebody ELSE being attacked"
```

---

## Task 9: The Suppression strip — ordered, automatic, result-gating

Spec §4.6, §10b, R5, R6.

**Files:**
- Modify: `module/engine/attack.mjs` (the damage-step hook)
- Create: `packs/_source/effects/suppression.yml`
- Modify: `packs/_source/abilities/kiritsugu-lethal-gunfire-suppression.yml` (the Active half)
- Modify: `lang/en.json`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Consumes: `removalPlan({candidates, bearer, rolls, ignoresProtection})` from `module/rules/removal.mjs`.
- Produces: the strip runs at the start of the Damage Step, before any modifier is read.

- [ ] **Step 1: Write the failing test**

```js
describe("Suppression — 5 uses, and a use is a SUCCESSFUL strip (R5)", () => {
  const e = () => src("effects", "suppression.yml");

  it("carries both a use count and a duration", () => {
    expect(e().uses).toBe(5);
    expect(e().defaultDuration).toBe("1◈");
  });

  it("spends a use only when a buff actually came off", () => {
    const [rule] = e().rules;
    // "SUCCESSFUL Normal Attacks remove 1 buff" -- an attack against a target
    // with no buffs left strips nothing and therefore spends nothing.
    expect(rule.spendsUseOn).toBe("removalSucceeded");
  });

  it("fires at the START of the damage step, not the end", () => {
    // R6. If the strip lands late, a Def Up that should have been torn off
    // still reduces the hit -- and a test asserting only "a buff was removed"
    // passes anyway. The ordering IS the clause.
    const [rule] = e().rules;
    expect(rule.when).toBe("damageStepStart");
  });

  it("applies its follow-on Atk Up only on a successful strip", () => {
    const [rule] = e().rules;
    const follow = rule.then.find((t) => t.key === "ApplyEffect");
    expect(follow.effect.id).toBe("atkUp");
    expect(follow.effect.magnitude).toBe(15);
    expect(follow.effect.npMagnitude).toBe(5);
    expect(follow.requiresRemoval).toBe(true);
  });

  it("is restricted to NORMAL attacks", () => {
    expect(e().rules[0].predicate).toContain("attack:kind:normal");
  });
});

describe("Lethal Gunfire Suppression — the Active", () => {
  const a = () => src("abilities", "kiritsugu-lethal-gunfire-suppression.yml");

  it("restores 4 Luck without exceeding the maximum", () => {
    const phase = a().phases.find((p) => p.kind === "resource");
    const [change] = phase.changes;
    expect(change.key).toBe("luck");
    expect(change.delta).toBe(4);
    // "Restore", not "grant" -- it cannot push him above what he rolled.
    expect(change.clampToMax).toBe(true);
  });

  it("applies Atk Up at 40%, or 30% for an NP", () => {
    const eff = a().phases.flatMap((p) => p.effects ?? [])
      .find((e) => e.id === "atkUp");
    expect(eff.magnitude).toBe(40);
    expect(eff.npMagnitude).toBe(30);
  });

  it("costs 4◈", () => expect(a().cooldown).toBe("4◈"));
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — `ENOENT` on `suppression.yml`.

- [ ] **Step 3: Author the effect**

`packs/_source/effects/suppression.yml`:

```yaml
# Kiritsugu's Lethal Gunfire Suppression.
#
# TWO clocks, and they are not the same clock. `uses: 5` is the sheet's "5
# times" (spec R5 -- "N times" is a use count everywhere in this corpus), and
# `defaultDuration` is its 1◈. It ends on whichever runs out first, and
# Magecraft's `DurationExtension` extends ONLY the duration: a reapplication
# would refill the uses, which is why that passive extends rather than reapplies.
#
# A use is spent by a SUCCESSFUL strip, not by every Normal Attack. The sheet
# reads "Successful Normal Attacks remove 1 buff", so swinging at a target with
# nothing left to take costs nothing.
#
# `when: damageStepStart` is load-bearing (spec R6). The buff it tears off may
# be the Def Up that would otherwise reduce this very hit, so a strip that
# lands after the damage is computed is a strip that did nothing -- and a test
# asserting only that a buff was removed would pass anyway.
schema: 1
id: suppression
name: "Suppression"
description: |
  Successful Normal Attacks remove 1 buff from the Defending Unit at the start of the Damage
  Step; if a buff was removed, Kiritsugu gains @effect[atkUp]{Atk Up} for 1◈ Turns, all damage dealt increased by
  15% (5% for a Noble Phantasm).
polarity: buff
volatility: nonVolatile
valence: offensive
stacking: noneExtend
baseChance: 100
uses: 5
defaultDuration: "1◈"
rules:
  - key: OnEvent
    event: damageStepStart
    automatic: true
    when: damageStepStart
    spendsUseOn: removalSucceeded
    predicate:
      - "attack:kind:normal"
    then:
      - key: RemoveEffect
        target: defender
        polarity: buff
        count: 1
      - key: ApplyEffect
        target: self
        requiresRemoval: true
        effect: { id: atkUp, magnitude: 15, npMagnitude: 5 }
        duration: "1◈"
```

`RemoveEffect` is **not** in `RULE_ELEMENT_KEYS` — check whether an `OnEvent`'s `then:` list uses a different vocabulary (it is the *interior* action list, not the top-level element list). Read the `OnEvent` executor and an existing `then:` in the corpus, and use the vocabulary already there. If a removal action does not exist inside `then:`, add one, mirrored into `module/rules/authoring/` and held by a drift test.

- [ ] **Step 4: Add the damage-step hook**

In `module/engine/attack.mjs`, at `case "damage":` — **before** `offerAttackerWindow` and before anything computes damage — run the automatic `damageStepStart` handlers:

```js
    case "damage": {
      // Automatic handlers first, THEN the offer. Kiritsugu's Suppression
      // strips a buff off the defender here, and the ordering is the clause:
      // the buff it takes may be the Def Up that would otherwise reduce this
      // hit, so running it after the offer -- or worse, after the damage --
      // would leave it correct-looking and inert.
      state = await runDamageStepStartHandlers(state, message);
      state = await offerAttackerWindow(state, DAMAGE_STEP_WINDOW, message);
```

Implement `runDamageStepStartHandlers` to: read the attacker's `eventHandlers` for `damageStepStart`, test each predicate against the live attack's roll options, run `removalPlan` for a removal action, apply the intents, and fire the `requiresRemoval` follow-on **only if** at least one effect actually came off — spending a `uses` charge in the same branch.

- [ ] **Step 5: Author the Active half**

Append to `packs/_source/abilities/kiritsugu-lethal-gunfire-suppression.yml`:

```yaml
targeting:
  anchor: { kind: self }
  shape: { kind: unit }
  selection: { relations: [self], includeSelf: true, chooser: all }
phases:
  - kind: resource
    changes:
      # "Restore", not "grant" -- `clampToMax` is the difference, and it is why
      # Golden Fleece cannot push a Servant above what it rolled at summon.
      - { key: luck, delta: 4, clampToMax: true }
  - kind: applyEffects
    target: self
    effects:
      - { id: atkUp, magnitude: 40, npMagnitude: 30, duration: "1◈" }
      - { id: suppression, duration: "1◈" }
```

- [ ] **Step 6: Close Magecraft's second passive**

`suppression` now exists, so the rule Task 5 deliberately deferred can be authored. Append to
`packs/_source/abilities/kiritsugu-magecraft.yml`:

```yaml
  # Passive 2. `ofCategory` rather than a list of the three Spell ids, for the
  # same reason the limit above is declared on the category: a fourth Spell
  # should be caught by being a Spell.
  #
  # Extends a DURATION rather than reapplying, and the distinction is the whole
  # reason `DurationExtension` exists: Suppression carries a use count (5) as
  # well as a clock, and reapplying it would refill the uses. The sheet extends
  # the clock only.
  - key: OnEvent
    event: abilityUsed
    automatic: true
    ofCategory: thaumaturgy
    then:
      - key: DurationExtension
        effect: suppression
        ticks: "1◈"
```

Add the test:

```js
describe("Magecraft — Passive 2 extends Suppression's clock, not its uses", () => {
  it("extends rather than reapplies", () => {
    const a = src("abilities", "kiritsugu-magecraft.yml");
    const ev = a.passiveRules.find((r) => r.key === "OnEvent");
    expect(ev.ofCategory).toBe("thaumaturgy");
    const [then] = ev.then;
    // A reapplication would refill the 5 uses. The sheet extends the DURATION.
    expect(then.key).toBe("DurationExtension");
    expect(then.effect).toBe("suppression");
    expect(then.ticks).toBe("1◈");
    expect(ev.then.some((t) => t.key === "ApplyEffect")).toBe(false);
  });
});
```

- [ ] **Step 7: Run the gate and commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/ packs/_source/ lang/en.json test/
git commit -m "feat(engine): a buff strip at the START of the Damage Step, and the use it spends"
```

---

## Task 10: Chronos Rose — and a cooldown that reaches the target

Spec §4.5, §11.

**Files:**
- Modify: `module/engine/skill-use.mjs` (`cooldownChanges`)
- Create: `packs/_source/abilities/kiritsugu-chronos-rose.yml`
- Modify: `packs/_source/servants/kiritsugu.yml`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Produces: a `cooldown` phase change carrying `unit: "target"` emits `I.cooldown(targetId, …)` instead of `I.cooldown(doc.id, …)`.

- [ ] **Step 1: Write the failing test**

```js
import { cooldownChanges } from "../../module/engine/skill-use.mjs";

describe("Chronos Rose — the cooldown it imposes is the DEFENDER's", () => {
  it("emits the change against the target, not the caster", () => {
    const phase = {
      kind: "cooldown",
      changes: [{ unit: "target", scope: "np", ticks: "1◈", direction: "up" }],
    };
    const caster = { id: "kiritsugu", items: [] };
    const target = {
      unitId: "victim",
      items: [{ id: "np1", system: { isNP: true } }],
    };
    const out = cooldownChanges(phase, caster, null, null, target);
    expect(out).toHaveLength(1);
    expect(out[0].unitId ?? out[0].actorId).toBe("victim");
  });
});
```

Adapt to `cooldownChanges`'s real signature and the real shape of `I.cooldown`'s intent — read both before writing. The **contract** is: the emitted intent names the target's id.

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — the intent names `kiritsugu`, because the subject is hard-wired to `doc.id`.

- [ ] **Step 3: Let the change name its subject**

In `module/engine/skill-use.mjs#cooldownChanges`, accept the phase target and resolve the subject per change:

```js
    // Whose abilities this change reaches. `doc` — the caster — for everything
    // authored so far, and the TARGET for Kiritsugu's Chronos Rose: *"increase
    // the DU's NP Cooldown by 1◈ Turns."*
    //
    // `selectAbilities`'s own comment has anticipated this since it was
    // written — *"what a sheet means by 'its NP Cooldown' when the Unit it is
    // aimed at is somebody else's and may have two"* — so the SELECTOR was
    // ready and only the subject was hard-wired.
    const subject = change.unit === "target" ? (target ?? doc) : doc;
    const subjectId = subject.unitId ?? subject.id;
```

and replace each `I.cooldown(doc.id, …)` with `I.cooldown(subjectId, …)`, threading `target` in from the `case "cooldown"` call site.

- [ ] **Step 4: Author the Noble Phantasm**

`packs/_source/abilities/kiritsugu-chronos-rose.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# Time Alter. The only Noble Phantasm in the corpus that attacks somebody
# else's CLOCK: 1◈ added to the defender's NP Cooldown is a Turn of a Noble
# Phantasm they were about to have and now do not.
schema: 1
id: kiritsugu-chronos-rose
name: "Chronos Rose: Pick Ye Rosebuds While Ye May"
rank: "B+"
isNP: true
npTags: [antiUnit]
cooldown: "6◈+⅓◈"
timing: { window: ownTurn }
description: |
  Time Alter. Range 3. Base Attack (STR) is used. Deals 3.5x damage plus 100 that has the Ignore
  Def effect, then inflicts @effect[critDwn]{Crit Dwn} for 1◈ Turns (Crit Chance reduced by 30%), and increases the
  Defending Unit's NP Cooldown by 1◈ Turns. Cooldown: 6◈+⅓◈ Turns.
targeting:
  anchor: { kind: targetUnit, range: 3 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: all, count: 1 }
damage:
  multiplier: 3.5
  flatBonus: 100
  component: str
  ignoresDefUp: true
phases:
  - kind: applyEffects
    target: reuse
    effects:
      - { id: critDwn, magnitude: 30, duration: "1◈" }
  # "increase the DU's NP Cooldown by 1◈ Turns" -- the DEFENDER's, and `scope:
  # np` reaches every Noble Phantasm they have, because a sheet saying "its NP
  # Cooldown" about somebody else cannot know how many they carry.
  - kind: cooldown
    changes:
      - { unit: target, scope: np, ticks: "1◈", direction: up }
```

- [ ] **Step 5: Add the ref, run, commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/ packs/_source/ test/
git commit -m "feat(engine): a cooldown phase that reaches the DEFENDER -- Chronos Rose"
```

---

## Task 11: Mystery Bisection — and a Base Attack that halves, both components

Spec §4.4, §4.8, §12, R4, R9.

**Files:**
- Modify: `module/rules/elements.mjs`, `module/rules/authoring/elements.mjs`, `tools/lib/content.mjs`
- Modify: `module/rules/snapshot.mjs`
- Create: `packs/_source/effects/kiritsugu-mark.yml`, `packs/_source/abilities/kiritsugu-mystery-bisection.yml`
- Modify: `packs/_source/servants/kiritsugu.yml`, `test/unit/kiritsugu.test.mjs`

**Interfaces:**
- Produces: rule element `BaseAttackModifier` → `out.baseAttackModifiers: Array<{factor: number, components: string[], source: string}>`.
- Produces: `applyBaseAttackModifiers(unit)` in `module/rules/snapshot.mjs`, mutating `unit.baseAttack` — called from the same pass as `applyRegionBonus`.

- [ ] **Step 1: Write the failing test**

```js
import { applyBaseAttackModifiers } from "../../module/rules/snapshot.mjs";

describe("The Kiritsugu mark — both Base Attack components (R4)", () => {
  const marked = () => ({
    id: "medea",
    baseAttack: { str: 50, mag: 210 },
    baseAttackModifiers: [
      { factor: 0.5, components: ["str", "mag"], source: "Kiritsugu" },
    ],
  });

  it("halves BOTH components, not just the one the attack uses", () => {
    const u = marked();
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 25, mag: 105 });
  });

  it("hurts a MAG attacker far more, which is the sheet's design", () => {
    const u = marked();
    applyBaseAttackModifiers(u);
    // Medea loses 105 off the number she actually attacks with; a STR
    // attacker loses the smaller half of theirs. That asymmetry is what makes
    // this a cripple rather than a finisher.
    expect(210 - u.baseAttack.mag).toBe(105);
    expect(50 - u.baseAttack.str).toBe(25);
  });

  it("is idempotent — 'half of their ORIGINAL value', and it does not stack", () => {
    const u = marked();
    applyBaseAttackModifiers(u);
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 25, mag: 105 });
  });

  it("leaves an unmarked unit alone", () => {
    const u = { id: "x", baseAttack: { str: 65, mag: 175 }, baseAttackModifiers: [] };
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 65, mag: 175 });
  });
});

describe("Mystery Bisection", () => {
  const a = () => src("abilities", "kiritsugu-mystery-bisection.yml");

  it("deals 3x + 100 with BA(STR) at Range 1", () => {
    expect(a().damage).toEqual(expect.objectContaining({
      multiplier: 3, flatBonus: 100, component: "str",
    }));
    expect(a().targeting.anchor.range).toBe(1);
  });

  it("rolls Instakill at 35% only AFTER damage was dealt", () => {
    const phase = a().phases.find((p) =>
      (p.effects ?? []).some((e) => e.id === "instakill"));
    // "with a 35% chance of inflicting Instakill IF DAMAGE WAS DEALT" -- so it
    // is an afterDamage phase, unlike Scáthach's, which resolves first and
    // suppresses the damage.
    expect(phase.when ?? "afterDamage").toBe("afterDamage");
    expect(phase.effects.find((e) => e.id === "instakill").chance).toBe(35);
    expect(phase.requiresDamage).toBe(true);
  });

  it("marks with kiritsuguMark — never `kiritsugu` (R9)", () => {
    const e = src("effects", "kiritsugu-mark.yml");
    // An effect sharing a content id with its Servant is a build-breaking
    // collision; `raikou` hit it last pass.
    expect(e.id).toBe("kiritsuguMark");
    expect(e.id).not.toBe("kiritsugu");
  });

  it("makes the mark unremovable, non-stacking, and unresistable", () => {
    const e = src("effects", "kiritsugu-mark.yml");
    expect(e.unremovable).toBe(true);
    expect(e.stacking).toBe("noneNoRefresh");
    expect(e.bypassesImmunity).toBe(true);
  });

  it("halves both components in the effect's own rule", () => {
    const [rule] = src("effects", "kiritsugu-mark.yml").rules;
    expect(rule.key).toBe("BaseAttackModifier");
    expect(rule.factor).toBe(0.5);
    expect(rule.components).toEqual(["str", "mag"]);
  });

  it("costs 5◈+⅓◈", () => expect(a().cooldown).toBe("5◈+⅓◈"));
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: FAIL — `applyBaseAttackModifiers` is not exported; the content files do not exist.

- [ ] **Step 3: Add the executor and the projection**

In `module/rules/elements.mjs`, add `baseAttackModifiers: []` to `out` and:

```js
  /**
   * A multiplier on a Unit's Base Attack, per component.
   *
   * Kiritsugu's Mystery Bisection: *"the Unit's Base Attack (both STR and MAG)
   * are reduced by half of their original value."*
   *
   * **Both components, which is why this cannot live in the damage pipeline.**
   * Stage 1 reads `unit.baseAttack[src.component]` — the one component the
   * current attack happens to use — so a hook there would never apply the MAG
   * half against a STR attacker or the STR half against a MAG one, and would
   * look completely correct in every single-attack test.
   *
   * Applied in the SNAPSHOT instead, beside `applyRegionBonus`, which already
   * adjusts both components at once. Three things follow: the pipeline reads
   * the snapshot so damage is covered for free; `present.mjs#baseAttackTiles`
   * already renders written-vs-effective so the victim SEES `175 → 87` on
   * their own sheet; and there is one site rather than two.
   */
  BaseAttackModifier(el, { source, out }) {
    out.baseAttackModifiers.push({
      factor: el.factor ?? 1,
      components: el.components ?? ["str", "mag"],
      source,
    });
  },
```

Mirror `"BaseAttackModifier"` into the other two lists. Project `baseAttackModifiers: contributions.baseAttackModifiers ?? []` in `snapshot.mjs`.

- [ ] **Step 4: Apply it in the projection**

In `module/rules/snapshot.mjs`, beside `applyRegionBonus`:

```js
/**
 * Fold every Base Attack multiplier into the projection.
 *
 * Idempotent, for the same reason `applyRegionBonus` is and with the same
 * guard: two callers legitimately project the same unit — the actor sheet
 * before any board exists, and the board pass for units nobody pre-projected —
 * and without the flag a marked Servant would be halved twice. The sheet also
 * says so outright: *"reduced by half of their ORIGINAL value"*, and *"the
 * 'Kiritsugu' debuff does not stack."*
 *
 * @param {object} unit
 * @returns {object} the same unit, mutated
 */
export function applyBaseAttackModifiers(unit) {
  const mods = unit?.baseAttackModifiers ?? [];
  if (mods.length === 0 || unit.baseAttackModifiersApplied) return unit;

  for (const m of mods) {
    for (const c of m.components) {
      if (typeof unit.baseAttack?.[c] !== "number") continue;
      unit.baseAttack[c] = Math.floor(unit.baseAttack[c] * m.factor);
    }
  }
  unit.baseAttackModifiersApplied = true;
  return unit;
}
```

Call it from wherever `applyRegionBonus` is called, **after** it — the Region's ±10 is part of the "original value" the mark halves.

- [ ] **Step 5: Author the mark and the Noble Phantasm**

`packs/_source/effects/kiritsugu-mark.yml`:

```yaml
# Kiritsugu's Phantasm Punishment: Mystery Bisection.
#
# The id is `kiritsuguMark`, NOT `kiritsugu` -- an effect sharing a content id
# with its Servant is a build-breaking collision, and `raikou` hit exactly that
# last pass and had to become `raikouBuff`.
#
# Halves BOTH Base Attack components, which makes it strictly worse for a
# Caster than for a Saber: Medea (50/210) loses 105 off the number she actually
# attacks with. That asymmetry is the design -- it is what makes this a cripple
# rather than a finisher.
#
# Three protections at once, all stated: unremovable, non-stacking, and past
# both Debuff Resist and Debuff Immune. There is no way out of it.
schema: 1
id: kiritsuguMark
name: "Kiritsugu"
description: |
  This Unit's Base Attack (STR and MAG) are reduced by half of their original value. Ignores
  Debuff Resist and Debuff Immune. Unremovable, and does not stack.
polarity: debuff
volatility: nonVolatile
valence: offensive
stacking: noneNoRefresh
baseChance: 100
unremovable: true
bypassesImmunity: true
rules:
  - key: BaseAttackModifier
    factor: 0.5
    components: [str, mag]
```

`packs/_source/abilities/kiritsugu-mystery-bisection.yml`:

```yaml
# Kiritsugu, char_orig_sheets/Copia de Kiritsugu.md
#
# Range 1 -- the only melee thing he does, and the shortest reach on his sheet
# by two panels. A gunman's execution, taken standing over them.
#
# The Instakill fires AFTER the damage and is gated on damage having been
# dealt, which is the opposite of Scáthach's Gáe Bolg Alternative: hers rolls
# first and a success SUPPRESSES the damage. Here the damage is the
# precondition.
schema: 1
id: kiritsugu-mystery-bisection
name: "Phantasm Punishment: Mystery Bisection"
rank: "C+"
isNP: true
npTags: [antiUnit]
cooldown: "5◈+⅓◈"
timing: { window: ownTurn }
description: |
  Range 1. Base Attack (STR) is used. Deals 3x damage plus 100 with a 35% chance of inflicting
  @effect[instakill]{Instakill} if damage was dealt. Then applies the @effect[kiritsuguMark]{Kiritsugu} debuff to the Defending Unit,
  halving its Base Attack (STR and MAG); this ignores Debuff Resist and Debuff Immune, is
  Unremovable, and does not stack. Cooldown: 5◈+⅓◈ Turns.
targeting:
  anchor: { kind: targetUnit, range: 1 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: all, count: 1 }
damage:
  multiplier: 3
  flatBonus: 100
  component: str
phases:
  - kind: applyEffects
    when: afterDamage
    target: reuse
    requiresDamage: true
    # "ignores Debuff Resist and Debuff Immune effects" -- the mark only; the
    # Instakill is resisted normally, including by Magic Resistance if the
    # source were MAG (it is not; `component: str` exempts it).
    ignoresResistanceFrom: [debuffResUp]
    effects:
      - { id: instakill, chance: 35 }
      - { id: kiritsuguMark, duration: permanent }
```

Confirm `requiresDamage` is the real field name on an `applyEffects` phase — grep `requiresDamagedThisPhase` and the phase authoring schema, and use whatever exists rather than inventing a synonym.

- [ ] **Step 6: Run the gate and commit**

```bash
npm test && npm run lint && npm run validate:content && npm run check:manifest
git add module/ tools/ packs/_source/ test/
git commit -m "feat(rules): a Base Attack that halves in the projection, so the victim can see it"
```

---

## Task 12: The live pass

Spec §5.2. **This is the deliverable, not a formality.**

**Files:** none necessarily — this task produces evidence, and whatever fixes the evidence demands.

- [ ] **Step 1: Bring the world up**

```bash
node tools/fgt-world.mjs status
```

If Foundry is not running, **close it fully** (the app holds the LevelDB even with the world down), then:

```bash
node tools/fgt-rebuild.mjs
node tools/fgt-world.mjs launch
```

Launch fails with no Foundry tab open — open one over CDP first, then launch, then join.

- [ ] **Step 2: Place the cast**

Kiritsugu, a Master, one ally to carry the decoy, and **two enemies: one STR-based and one MAG-based** (R4 needs a MAG attacker specifically). Give one enemy `Def Up` for the Suppression ordering check and one `Debuff Immune` + `Debuff ResUp` for §4.8.

- [ ] **Step 3: Drive every row of the spec's §5.2 table**

Each through the **interface** — his sheet's toggles, the action bar, the reaction prompt, End Turn — never the console. Screenshot each result.

| Clause | Measurement |
|---|---|
| §4.6 strip ordering (R6) | same attack, with and without `Suppression`, vs a `Def Up` holder — totals must differ by that buff's contribution |
| §4.4 the mark (R4) | the **MAG** enemy's own sheet reading `210 → 105`, **and** its next attack's damage falling accordingly |
| §4.2 the aura (R3) | a nearby **ally's** Luck Check roll going **up** by 4 — if it reads as a benefit, the sign is inverted |
| R2 Skill Seal | LUC falling to **E**, the aura stopping, Skills **still** refused, his own rolls at **+20** — all four at once |
| §4.7 the shot (R1) | fired on an **enemy's** Turn, **and** his own Attack still available on his next |
| §4.1 the exemption | a Spell cast inside the trigger, the Turn's own Thaumaturgy **still** available, and that Spell **on cooldown** |
| §4.5 NP1 | the **defender's** NP cooldown rising by 1◈, his own unchanged |
| §4.8 | the mark landing on a target holding both `debuffImmune` and `debuffResUp` |
| R5 uses | `Suppression` ending after the **5th** successful strip; a no-buff target spending nothing |
| §4.3 Pierce | Affection's Active, then an attack against an `invuln` holder — damage must be non-zero |
| §6 Penetration | against the same `invuln` holder — exactly **half** |
| §7 Familiars | crit rate up at Range 3+, unchanged at Range 2 |
| PC A+ | untargetable; the AoE coin; the +4 Evade; deactivating after an attack |
| IA A | Master's ZON +3 on the board; 8◈ Sustainability on his sheet |

- [ ] **Step 4: Fix what the pass finds, each with a test**

Every defect gets a regression test in `test/unit/kiritsugu.test.mjs` **and** a re-drive through the interface. A defect found live and fixed without a test is a defect that comes back.

- [ ] **Step 5: Commit the fixes**

```bash
npm test && npm run lint && npm run validate:content && npm run check:manifest
git add -A
git commit -m "fix: what the Kiritsugu live pass found"
```

---

## Task 13: Documentation

- [ ] **Step 1: Ch. 45** — the pass, every defect it found, and what was verified. Follow the Raikou section's shape: a numbered defect list with the *mechanism* of each, then a "what the pass saw working" table with real figures.

- [ ] **Step 2: The affected structural chapters** — Ch. 11 (the aura route), Ch. 13 (Base Attack modifiers, attacker-borne Pierce, fractional Invuln), Ch. 14 (the check-modifier sign), Ch. 15 (category use limits, the triggered-attack window), Ch. 24 (the four new rule elements). **Ch. 45 alone is not enough** — the chapter that owns each rule must change too.

- [ ] **Step 3: Ch. 36 §36.2** — rewrite from sketch into what was built, the way §36.1 records Karna's `modes:` decision. Name every place the sketch guessed wrong (`key: Attack` is not a rule element; `OfferAbilityUse` has a different shape; the Skill Seal reading).

- [ ] **Step 4: Appendix D** — his data sheet.

- [ ] **Step 5: Appendix A** — the six new effects.

- [ ] **Step 6: Commit**

```bash
npm test && npm run lint && npm run validate:content && npm run check:manifest
git add docs/
git commit -m "docs: Kiritsugu -- the pass, and the chapters his additions changed"
```

---

## Notes for the implementer

**The failure this project actually produces.** Not wrong arithmetic — *a rule that is right and inert*. Collected but not projected; authored but unreadable; predicated on an option answered too early. Six of the Raikou pass's ten defects were that shape, and two of this plan's eight gaps (Tasks 2 and 11) are that shape found in advance. So for every element you add, **name its reader and then go and look at the reader**.

**A green test is not evidence.** The Raikou pass produced a unit test that passed the whole time while its clause did nothing, because it asserted the authored YAML shape rather than the behaviour. The tests in this plan that assert shape are there to catch *drift*; the tests that assert behaviour, and Task 12, are the ones that prove anything.

**Where the plan guesses.** Several steps say *"read X before writing this and adapt"* — `collectContributions`'s signature, the `area` phase shape, the `OnEvent` interior vocabulary, `cooldownChanges`'s parameters, `requiresDamage`'s real name. Those are real uncertainties, marked honestly rather than papered over. Adapt to what the corpus does; do **not** invent a synonym for a field that already exists under another name.
