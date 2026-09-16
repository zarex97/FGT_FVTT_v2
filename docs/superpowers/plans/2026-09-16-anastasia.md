# Anastasia & Viy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author Anastasia & Viy so that all ~60 clauses of `char_orig_sheets/Copia de Anastasia & Viy.md` are live on a real board, building the two engine mechanisms her sheet needs and the five catalogued-but-unauthored effects she reaches for.

**Architecture:** Four phases, each ending in working software. Phase 1 builds the only two engine changes she needs — a `Suppress { scope: "miss" }` that `missChance` honours, and a distance-scaled chance. Phase 2 authors five effects, two of which (`Freeze`, `Invuln`) already have their entire damage behaviour in the pipeline and change the game for the whole roster. Phase 3 authors her eleven content files. Phase 4 documents and verifies on a live board.

**Tech Stack:** Foundry VTT v14, ES modules, JSDoc typing, Vitest, YAML content compiled to LevelDB packs. Layer discipline `domain → rules → engine → apps` is enforced by ESLint; `module/domain` and `module/rules` must never reference a Foundry global.

**Spec:** `docs/superpowers/specs/2026-09-16-anastasia-design.md` — read it before Task 1, **including the correction block at the head of §5**, which withdraws three of the six engine changes the spec originally named. Every task below cites the ruling (R1–R8) or clause id (N1–N4, W1, I1–I4, F1–F2, K1–K2, M1–M6, B1–B10, and the two Noble Phantasms) it implements; those ids are defined in the spec's §3 and §4 and are the acceptance criteria.

## Global Constraints

- **Layer boundaries.** `module/domain` and `module/rules` are pure and may not touch Foundry globals. `npm run lint` runs `tools/check-layers.mjs` and will fail on a violation.
- **Every rule lands with its reader in the same task.** Ch. 45 classifies a rule that is implemented and never consulted as **Collected**, and names it this project's dominant defect. A task that adds a field without a consumer is not done.
- **Both allowlists are load-bearing.** An authored field that `actorSystem()` or `itemSystem()` in `tools/lib/content.mjs` does not name compiles to its schema default, **silently**. That has now happened six times. `module/content/authored-fields.mjs` holds the vocabulary and `test/unit/authored-fields.test.mjs` holds the two together — add any new authored key to **both**.
- **`npm test` must pass at every commit.** Baseline is green at **4,385**; confirm with `npm test` before Task 1.
- **`npm run validate:content` must pass after any YAML edit.**
- **Her printed figures are all correct** (R1). STR `D++` → 95, MAG `C` → 150, END `E` → 500, and the Note's `BA=110` is 95 + 15. Unlike Pollux, **nothing here is overruled by a rank table** — if `validate:content` reports a Base Attack deviation for her, something is wrong with the authoring, not with the sheet.
- **Rebuilding packs needs the Foundry world shut down.** `node tools/fgt-world.mjs shutdown` → `npm run build:packs` → `launch` → rejoin.
- **Docs change with the code.** Updating `docs/45-implementation-status.md` alone is not enough — the affected chapter among 00–44 and the affected appendix must change in the same commit.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
  ```

---

# Phase 1 — the two engine changes

---

### Task 1: `Suppress { scope: "miss" }`, honoured by `missChance` (M1)

**Files:**
- Modify: `module/rules/miss.mjs`
- Test: `test/unit/miss.test.mjs`

**Interfaces:**
- Consumes: `missChance(attacker, options)` as built on 2026-09-16.
- Produces: `missChance` returns `0` when the attacker carries a suppression whose `scope` is `"miss"` and whose predicate passes against the supplied options.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/miss.test.mjs`:

```js
describe("M1 — a suppression may switch the Miss check off", () => {
  // Anastasia's Watermelon Splitting Master: *"When Anastasia performs a Normal
  // Attack at a Range of 1 to 2 while inflicted with Blind, it does not have a
  // chance of Missing."* A Servant who blinds herself on purpose.
  const suppressed = (predicate) => ({
    id: "anastasia", kind: "servant", effects: ["blind"],
    suppressions: [{ scope: "miss", predicate, source: "Watermelon Splitting Master" }],
  });

  it("returns zero when the suppression's predicate passes", () => {
    const opts = new Set(["self:effect:blind", "attack:range:lte:2"]);
    expect(missChance(suppressed(["self:effect:blind", "attack:range:lte:2"]), opts)).toBe(0);
  });

  it("still misses at a range the suppression does not cover (R5)", () => {
    // Her ranged band gains nothing from Watermelon, and her Note has her
    // swinging a different Base Attack there anyway.
    const opts = new Set(["self:effect:blind", "attack:range:3", "attack:range:gte:3"]);
    expect(missChance(suppressed(["self:effect:blind", "attack:range:lte:2"]), opts)).toBe(80);
  });

  it("ignores a suppression with some other scope", () => {
    const other = { id: "u", kind: "servant", effects: ["blind"], suppressions: [{ scope: "mysticEye" }] };
    expect(missChance(other, new Set())).toBe(80);
  });

  it("honours an unconditional suppression", () => {
    const always = { id: "u", kind: "servant", effects: ["blind"], suppressions: [{ scope: "miss" }] };
    expect(always.suppressions.length).toBe(1);
    expect(missChance(always, new Set())).toBe(0);
  });

  it("leaves a Blinded unit with no suppression missing at 80%", () => {
    expect(missChance({ id: "u", kind: "servant", effects: ["blind"], suppressions: [] }, new Set()))
      .toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/miss.test.mjs -t "suppression may switch"`
Expected: FAIL — the first test returns `80` where `0` is expected.

- [ ] **Step 3: Read the suppression in `missChance`**

In `module/rules/miss.mjs`, add the import at the top:

```js
import { test as testPredicate } from "./predicate.mjs";
```

and insert into `missChance`, immediately after the `source` lookup and **before** the Eye of the Mind check:

```js
  // A suppression that switches the check off outright.
  //
  // Anastasia's *Watermelon Splitting Master*: *"When Anastasia performs a
  // Normal Attack at a Range of 1 to 2 while inflicted with Blind, it does not
  // have a chance of Missing."* A Servant who inflicts Blind on herself to
  // convert it into an offensive buff — the shape Ch. 44 §44.3 calls
  // "self-harm as a resource", and Van Gogh's Curse economy is the precedent.
  //
  // The SAME `Suppress` element Blind's own clause 3 uses, rather than a second
  // way to switch a rule off. The predicate is evaluated here rather than at
  // collection time because it asks about the ATTACK — `attack:range:lte:2` —
  // and the range is not known when contributions are gathered.
  //
  // Checked BEFORE the Eye of the Mind exemption only for readability; the two
  // cannot disagree, since both return 0.
  const suppressed = (attacker?.suppressions ?? []).some(
    (s) => s.scope === "miss" && (!s.predicate || testPredicate(s.predicate, { options })),
  );
  if (suppressed) return 0;
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/miss.test.mjs`
Expected: PASS — 21 existing plus 5 new.

- [ ] **Step 5: Run the full suite and the layer check**

Run: `npm test && npm run lint`
Expected: PASS. `rules/miss.mjs` importing `rules/predicate.mjs` is same-layer.

- [ ] **Step 6: Commit**

```bash
git add module/rules/miss.mjs test/unit/miss.test.mjs
git commit -m "feat(rules): an attacker may suppress its own Miss check

Anastasia blinds herself on purpose -- Watermelon Splitting Master turns
Blind's first clause off in her melee band and takes Pierce and Ignore Def
instead. The same Suppress element Blind's own clause 3 uses, rather than a
second way to switch a rule off.

The predicate is evaluated at the check rather than at collection, because it
asks about the ATTACK's range, which contributions cannot know.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 2: A distance-scaled chance (`chancePerPanel`)

**Files:**
- Modify: `module/engine/attack.mjs` (the rider-chance resolution in `applyAbilityEffects`)
- Modify: `module/rules/authoring/` (register the field), `tools/lib/content.mjs`
- Test: `test/unit/anastasia.test.mjs` (create)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: an `applyEffects` rider may carry `chancePerPanel: N` instead of `chance: N`. The chance resolves to `N × <Chebyshev distance between attacker and defender>`, capped at 100.

- [ ] **Step 1: Write the failing test**

Create `test/unit/anastasia.test.mjs`:

```js
/**
 * @file Anastasia & Viy, against her sheet.
 * @see char_orig_sheets/Copia de Anastasia & Viy.md
 *
 * Pinned to the SHEET and to the documentation rather than to the
 * implementation. Every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { chanceFromDistance } from "../../module/rules/miss.mjs";

describe("a distance-scaled chance (R3)", () => {
  // *"a 5% chance of inflicting Instakill for each panel between Anastasia and
  // the DU."* The corpus's only other use of "panels between" is the Dioscuri
  // sheet's *"the maximum distance between the two is 2 panels between them"*,
  // which means Chebyshev 2 and is implemented as such -- so this is the
  // DISTANCE, not the gap.
  it("scales with the distance", () => {
    expect(chanceFromDistance(5, 1)).toBe(5);
    expect(chanceFromDistance(5, 3)).toBe(15);
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("caps at her reach -- Range 3 plus the NP's +3 is 30%", () => {
    // Not a clamp in the function; a fact about her. Recorded so a later reach
    // change is visible as a test failure rather than as a silent buff.
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("is zero at no distance at all", () => {
    expect(chanceFromDistance(5, 0)).toBe(0);
  });

  it("never exceeds 100", () => {
    expect(chanceFromDistance(5, 40)).toBe(100);
  });

  it("answers zero when the distance is unknown", () => {
    // A snapshot taken off the board has no panel. Guessing would be worse
    // than declining -- the same reading `normalAttackAt` takes of an unknown
    // range when it falls back to the flat band.
    expect(chanceFromDistance(5, null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/anastasia.test.mjs`
Expected: FAIL — `chanceFromDistance is not a function`.

- [ ] **Step 3: Write the pure function**

Append to `module/rules/miss.mjs` (it is the module about *whether an attack connects*, which is the same question):

```js
/**
 * A chance stated per panel of separation.
 *
 * Anastasia's *Ice Block Launcher* is the only clause of this shape: *"a 5%
 * chance of inflicting Instakill for each panel between Anastasia and the DU."*
 *
 * **"Panels between" is the distance, not the gap.** The corpus's only other
 * use of the phrase is the Dioscuri sheet's *"the maximum distance between the
 * two is 2 panels between them"*, which means Chebyshev 2 and is implemented as
 * a Chebyshev 2 leash. Reading it as the gap would make her adjacent shot a 0%
 * Instakill and her longest one 25% rather than 30%.
 *
 * An unknown distance answers **zero** rather than guessing — the same reading
 * `normalAttackAt` takes when it cannot tell what band it is in.
 *
 * @param {number} perPanel percentage points per panel
 * @param {number|null} distance Chebyshev panels between the two units
 * @returns {number} 0–100
 */
export function chanceFromDistance(perPanel, distance) {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return 0;
  return Math.min(100, Math.max(0, perPanel * distance));
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/anastasia.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it to the rider**

In `module/engine/attack.mjs`, in the rider loop inside `applyAbilityEffects` (the block that reads `rider.chance ?? null` when calling `applyEffect`), resolve the distance form first:

```js
        // *"a 5% chance ... for each panel between Anastasia and the DU."* The
        // distance is the one the Combat Process already measured; recomputing
        // it from panels here could disagree with the range the attack was
        // declared at.
        chance: rider.chancePerPanel !== undefined
          ? chanceFromDistance(rider.chancePerPanel, state.attack?.range ?? null)
          : (rider.chance ?? null),
```

Add `chanceFromDistance` to the module's import from `../rules/miss.mjs`.

Confirm the distance field: `grep -n "range" module/engine/attack.mjs | grep -n "facts.range\|attack.range"` — use whichever the surrounding code already treats as the attacker-to-defender distance, and if it is `facts.range`, use that instead of `state.attack?.range`.

- [ ] **Step 6: Register the field**

Add `chancePerPanel` beside `chance` in `module/rules/authoring/phases.mjs`'s `applyEffects` entry, and to `tools/lib/content.mjs` wherever a rider's accepted keys are listed. Run `npm run validate:content` to confirm the validator accepts it.

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run lint && npm run validate:content`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add module/rules/miss.mjs module/engine/attack.mjs module/rules/authoring/ tools/lib/content.mjs test/unit/anastasia.test.mjs
git commit -m "feat(rules): a rider's chance may be stated per panel of separation

Anastasia's Ice Block Launcher is the only clause of this shape. \"Panels
between\" is the DISTANCE and not the gap: the corpus's only other use of the
phrase is the Dioscuri sheet's \"maximum distance between the two is 2 panels
between them\", which the leash implements as Chebyshev 2.

An unknown distance answers zero rather than guessing, the same reading
normalAttackAt takes of an unknown range.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

**Phase 1 checkpoint.** Run `npm test && npm run lint`. Both engine mechanisms exist with their readers. Nothing Anastasia-specific is authored yet.

---

# Phase 2 — the five effects

`Freeze` and `Invuln` are **not hers**. They are two of the most load-bearing statuses in Appendix A, their damage behaviour has been in the pipeline since it was written, and nothing could apply either. Authoring them makes live behaviour the whole roster is subject to — so they are tested against the **existing readers**, not against the new documents alone.

---

### Task 3: `freeze.yml` and `invuln.yml`

**Files:**
- Create: `packs/_source/effects/freeze.yml`, `packs/_source/effects/invuln.yml`
- Modify: `docs/A-effect-catalogue.md`
- Test: `test/unit/anastasia.test.mjs`

**Interfaces:**
- Produces: effect ids `freeze` and `invuln`, resolvable by `validate:content`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/anastasia.test.mjs`:

```js
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));

const hit = (over = {}) => computeDamage({
  attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [] },
  defender: { id: "d", health: 9999, modifiers: [], effects: [] },
  attack: { kind: "normal", component: "str" },
  base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
  rolls: { attackMinus: 0 },
  crit: { isCrit: false },
  options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  ...over,
});

describe("Freeze — the pipeline has carried its behaviour unexercised", () => {
  it("is authored at all", () => {
    expect(effect("freeze").id).toBe("freeze");
  });

  it("prevents the bearer acting", () => {
    // Appendix A: "Cannot Act." `rules/budget.mjs#preventedBy` reads `freeze`
    // in its blanket list, and has since it was written.
    expect(effect("freeze").preventsAction).toBeTruthy();
  });

  it("absorbs an attack under 150 entirely", () => {
    const out = hit({ defender: { id: "d", health: 9999, modifiers: [], effects: ["freeze"] },
      base: { fixedValue: 120 } });
    expect(out.total).toBe(0);
    expect(out.flags.negatedBy).toBe("Freeze");
  });

  it("passes the excess of an attack at or over 150, and breaks", () => {
    const out = hit({ defender: { id: "d", health: 9999, modifiers: [], effects: ["freeze"] },
      base: { fixedValue: 200 } });
    expect(out.total).toBe(200);
    expect(out.flags.removeFreeze).toBe(true);
  });

  it("is broken by ANY Fire damage, with no damage and no effects", () => {
    const out = hit({
      defender: { id: "d", health: 9999, modifiers: [], effects: ["freeze"] },
      attack: { kind: "normal", component: "str", element: "fire" },
      base: { fixedValue: 500 },
    });
    expect(out.total).toBe(0);
    expect(out.flags.removeFreeze).toBe(true);
  });
});

describe("Invuln — likewise", () => {
  it("is authored at all", () => {
    expect(effect("invuln").id).toBe("invuln");
  });

  it("negates an ordinary attack", () => {
    const out = hit({ defender: { id: "d", health: 9999, modifiers: [], effects: ["invuln"] },
      base: { fixedValue: 300 } });
    expect(out.total).toBe(0);
  });

  it("is ignored by Pierce", () => {
    const out = hit({
      defender: { id: "d", health: 9999, modifiers: [], effects: ["invuln"] },
      attack: { kind: "normal", component: "str", pierce: true },
      base: { fixedValue: 300 },
    });
    expect(out.total).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "Freeze"`
Expected: FAIL — `ENOENT` on `packs/_source/effects/freeze.yml`.

If any of the *pipeline* assertions fail once the files exist, that is a finding about the existing readers, not about the new documents — record it and fix the reader.

- [ ] **Step 3: Write `freeze.yml`**

```yaml
# Appendix A §A — a status the pipeline has been able to resolve since it was
# written, with no way for a Unit to receive it.
#
# Everything about how Freeze meets DAMAGE is already in
# `rules/damage/pipeline.mjs`: stage 0 halts on *"Freeze broken by Fire"*, and
# stage 16 holds the `<150` absorption and the excess pass-through. This file is
# the other half -- the document that lets one arrive.
#
# `preventsAction` is likewise already read: `rules/budget.mjs#preventedBy`
# carries `freeze` in its blanket PREVENT_ALL list.
schema: 1
id: freeze
name: "Freeze"
description: |
  Cannot Act. Attacks dealing less than 150 damage do nothing at all; 150 or more removes Freeze
  and passes the excess through. Any Fire damage removes Freeze with no damage or effects.
  100 Ice damage at the end of each Round.
polarity: debuff
volatility: volatile
valence: defensive
stacking: noneRefresh
baseChance: 100
severity: normal
preventsAction: true
rules:
  # "100 Ice damage at Round end." A periodic, on the bearer. The absorption
  # and the Fire escape are NOT authored here -- they are pipeline stages, and
  # restating them as rules would be a second implementation that could drift
  # from the first.
  - key: OnEvent
    event: roundEnd
    automatic: true
    then:
      - { key: StatDelta, stat: "health.value", delta: -100 }
```

- [ ] **Step 4: Write `invuln.yml`**

```yaml
# Appendix A §A — the second status whose whole damage behaviour was already in
# the pipeline with no document to arrive by.
#
# Stage 16 negates an ordinary attack and honours `Pierce`; stage 15 already
# halves a Noble Phantasm. None of that is restated here for the reason
# `freeze.yml` gives: a second implementation is a second thing to drift.
schema: 1
id: invuln
name: "Invuln"
description: |
  No damage is taken. Against a Noble Phantasm, damage is reduced by 50% instead. An effect that
  would "reduce Health to 0" instead halves current Health. The Unit cannot Block. @effect[pierce]{Pierce} ignores
  it. Does not prevent rider debuffs. A Master with Invuln cannot be Overpowered.
polarity: buff
volatility: nonVolatile
valence: defensive
stacking: noneRefresh
baseChance: 100
rules:
  # "Cannot Block" -- the one clause with no pipeline reader, and the reaction
  # ladder is where it belongs. `ForbidReaction` is the element Presence
  # Concealment already uses to take a rung away.
  - key: ForbidReaction
    reactions: [block]
```

- [ ] **Step 5: Validate, test, document**

Run: `npm run validate:content && npx vitest run test/unit/anastasia.test.mjs`

Add a note to `docs/A-effect-catalogue.md` under both rows, in the voice the `Blind` and `Deafen` notes use, recording that the pipeline carried the behaviour and this is the document that lets it arrive.

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run lint`
Expected: PASS. **If any existing test moves, stop and read it** — these two effects are now reachable by every Servant in the corpus.

- [ ] **Step 7: Commit**

```bash
git add packs/_source/effects/freeze.yml packs/_source/effects/invuln.yml docs/A-effect-catalogue.md test/unit/anastasia.test.mjs
git commit -m "feat(content): Freeze and Invuln, whose behaviour the pipeline already had

Two of the most load-bearing statuses in Appendix A, catalogued since it was
written, and no Unit could receive either. Stage 0 halts on \"Freeze broken by
Fire\"; stage 16 holds the <150 absorption, the excess pass-through, Invuln's
negation and its Pierce bypass; stage 15 already halves Invuln for an NP.

Neither file restates any of that. A second implementation is a second thing
to drift, so these documents carry only what had no reader: Freeze's Round-end
Ice tick and Invuln's \"cannot Block\".

These are not Anastasia's. They are live for the whole roster now.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 4: `soaked.yml` (B5–B9, R2)

**Files:**
- Create: `packs/_source/effects/soaked.yml`
- Test: `test/unit/anastasia.test.mjs`

**Interfaces:**
- Consumes: `freeze` from Task 3.
- Produces: effect id `soaked`.

- [ ] **Step 1: Write the failing test**

```js
describe("Soaked (B6–B9)", () => {
  const soaked = () => effect("soaked");

  it("B9 — is neither a buff nor a debuff, and is Unremovable", () => {
    expect(soaked().polarity).toBe("status");
    expect(soaked().unremovable).toBe(true);
  });

  it("B6 — raises the Freeze chance of an Ice attack by 25, additively", () => {
    // `applicationChance` computes `base + inflictBonus - resist`, so a
    // NEGATIVE incoming contribution is a vulnerability. Scoped to `freeze` by
    // `effectId` and to Ice by an attack-time predicate, both of which
    // `chanceContribution` already honours.
    const rule = soaked().rules.find((r) => r.key === "ApplicationChance");
    expect(rule.direction).toBe("incoming");
    expect(rule.effectId).toBe("freeze");
    expect(rule.value).toBe(-25);
    expect(rule.predicate).toContain("attack:element:ice");
  });

  it("B7 — halves Total Fire Damage taken", () => {
    const ward = soaked().rules.find((r) => r.key === "Ward");
    expect(ward.value).toBe(50);
    expect(ward.predicate).toContain("attack:element:fire");
  });

  it("B7/R2 — removes itself on ANY Fire attack, even one Freeze negated", () => {
    // `fireDamageTaken` fires `damageTaken` once the Damage Step has resolved,
    // INCLUDING at a total of zero -- so it fires even when stage 0 halted on
    // "Freeze broken by Fire". A unit that is both Soaked and Frozen loses both
    // to one Fire attack without taking a point, which is the user's ruling,
    // and it needs no carve-out at all.
    const rule = soaked().rules.find(
      (r) => r.key === "OnEvent" && r.event === "damageTaken",
    );
    expect(rule.predicate).toContain("attack:element:fire");
    expect(rule.then[0]).toMatchObject({ key: "RemoveEffect" });
    expect(rule.then[0].effects).toContain("soaked");
  });

  it("B8 — is removed at the end of a Day Round", () => {
    const rule = soaked().rules.find(
      (r) => r.key === "OnEvent" && r.event === "roundEnd",
    );
    expect(rule.predicate).toContain("self:phase:day");
    expect(rule.then[0].effects).toContain("soaked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "Soaked"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# Applied by Ice Bucket Challenge. Three clauses, and not one of them needed a
# new mechanism -- which was not obvious until the seams were read.
schema: 1
id: soaked
name: "Soaked"
description: |
  (a) When this Unit receives Ice damage, it has a 25% chance of being inflicted with @effect[freeze]{Freeze};
  this is additive to any Freeze chance the Attack might have.
  (b) When this Unit receives Fire damage, Total Fire Damage taken is reduced by 50%, then 'Soaked'
  is removed from the Unit.
  (c) At the end of a Day Round, 'Soaked' is removed from all affected Units.
  (d) This effect is neither a buff nor a debuff, and is Unremovable.
# Clause (d). `status` is the third polarity, and it is what keeps this out of
# every Debuff Resist and every buff-removal effect in the game.
polarity: status
volatility: nonVolatile
valence: defensive
stacking: noneRefresh
baseChance: 100
unremovable: true
rules:
  # Clause (a). A NEGATIVE incoming ApplicationChance is a vulnerability:
  # `applicationChance` computes `base + inflictBonus - resist`, so -25 raises
  # the chance by 25 -- and it lands on the total the attack already carried,
  # which is exactly what "additive to any Freeze chance the Attack might have"
  # asks for.
  #
  # Scoped by `effectId` so it raises nothing but Freeze, and by an attack-time
  # predicate so it is the ICE that does it. `chanceContribution` honours both.
  - key: ApplicationChance
    direction: incoming
    effectId: freeze
    value: -25
    predicate: ["attack:element:ice"]

  # Clause (b), first half. An element-scoped Ward, the same shape Karna's fire
  # resistance uses. `npValue` matches `value` because the sheet says "Total
  # Fire Damage" without an NP carve-out.
  - key: Ward
    value: 50
    npValue: 50
    predicate: ["attack:element:fire"]

  # Clause (b), second half -- and the user's ruling on Freeze.
  #
  # `damageTaken` fires once the Damage Step has RESOLVED, including at a total
  # of zero (Appendix E). So it fires even when stage 0 halted on "Freeze broken
  # by Fire" -- and a Unit that is both Soaked and Frozen therefore loses both
  # to one Fire attack without taking a point of damage. No carve-out anywhere.
  - key: OnEvent
    event: damageTaken
    automatic: true
    predicate: ["attack:element:fire"]
    then:
      - { key: RemoveEffect, effects: [soaked] }

  # Clause (c). `self:phase:day` is emitted PER PANEL rather than per Round,
  # because `rules/environment.mjs#phaseAt` is positional -- a Unit standing in
  # `sunlight` terrain reads `day` at night, and dries off.
  - key: OnEvent
    event: roundEnd
    automatic: true
    predicate: ["self:phase:day"]
    then:
      - { key: RemoveEffect, effects: [soaked] }
```

- [ ] **Step 4: Validate and test**

Run: `npm run validate:content && npx vitest run test/unit/anastasia.test.mjs && npm test && npm run lint`

If `validate:content` rejects `unremovable`, `effectId` or `status`, check `tools/lib/content.mjs`'s effect key list and the `POLARITIES` enum in `module/domain/enums.mjs` — `status` is declared there.

- [ ] **Step 5: Commit**

```bash
git add packs/_source/effects/soaked.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): Soaked, and three clauses that each turned out to be free

The additive Freeze chance is a NEGATIVE incoming ApplicationChance:
applicationChance computes base + inflictBonus - resist, so -25 raises the
chance by 25 and lands on whatever the attack already carried.

The Fire clause removes itself through damageTaken, which fires once the
Damage Step has resolved INCLUDING at a total of zero -- so it fires even when
stage 0 halted on \"Freeze broken by Fire\". A Unit that is both Soaked and
Frozen loses both to one Fire attack without taking a point, which is the
user's ruling, and it needs no carve-out.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 5: `buff-removal-res-up.yml` and `crit-up-viy.yml`

**Files:**
- Create: `packs/_source/effects/buff-removal-res-up.yml`, `packs/_source/effects/crit-up-viy.yml`
- Test: `test/unit/anastasia.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
describe("her two bespoke buffs", () => {
  it("BuffRemoval ResUp reduces the chance of having buffs removed", () => {
    // `BuffRemovalResist` is an existing contribution bucket with an existing
    // executor; this is the first effect that writes to it.
    const rule = effect("buff-removal-res-up").rules[0];
    expect(rule.key).toBe("BuffRemovalResist");
    expect(rule.value).toBe("@magnitude");
  });

  it("Crit Up (Viy) raises crit on BA(MAG) attacks only, with its own NP figure", () => {
    // *"Crit Chance of Attacks which use Base Attack (MAG) is increased by 50%;
    // if NP, 20%."* CritModifier already carries npValue.
    const rule = effect("crit-up-viy").rules[0];
    expect(rule.key).toBe("CritModifier");
    expect(rule.aspect).toBe("chance");
    expect(rule.value).toBe("@magnitude");
    expect(rule.npValue).toBe("@npMagnitude");
    expect(rule.predicate).toContain("attack:component:mag");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "bespoke buffs"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `buff-removal-res-up.yml`**

```yaml
# Appendix A §A.9. The first content to write to `buffRemovalResist`, which has
# been a contribution bucket with an executor and no writer since rule elements
# were written.
schema: 1
id: buffRemovalResUp
name: "BuffRemoval ResUp"
description: "The chance of having buffs removed from this Unit is reduced by X%."
polarity: buff
volatility: nonVolatile
valence: defensive
stacking: magnitudeStacks
baseChance: 100
rules:
  - key: BuffRemovalResist
    value: "@magnitude"
```

- [ ] **Step 4: Write `crit-up-viy.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# A named Crit Up scoped to ONE COMPONENT: *"Crit Chance of Attacks which use
# Base Attack (MAG) is increased by 50%; if NP, 20%."* Named rather than folded
# into `crit-up`, for the reason every named variant in this catalogue is: a
# clause that removes "one Crit Up" must not be able to take this instead.
schema: 1
id: critUpViy
name: "Crit Up (Viy)"
description: "Crit Chance of Attacks which use Base Attack (MAG) is increased by X%; if NP, a lower figure."
polarity: buff
volatility: nonVolatile
valence: offensive
stacking: magnitudeStacks
baseChance: 100
families: [critUp]
rules:
  # `npValue` because the sheet states BOTH numbers and 20 is not half of 50.
  # `CritModifier` has carried an NP variant since it was written.
  - key: CritModifier
    aspect: chance
    value: "@magnitude"
    npValue: "@npMagnitude"
    predicate: ["attack:component:mag"]
```

- [ ] **Step 5: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/effects/buff-removal-res-up.yml packs/_source/effects/crit-up-viy.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): BuffRemoval ResUp and Crit Up (Viy)

BuffRemovalResist has been a contribution bucket with an executor and no
writer since rule elements were written. This is the writer.

Crit Up (Viy) is scoped to one component -- \"Attacks which use Base Attack
(MAG)\" -- and carries its own NP figure, because the sheet states both and 20
is not half of 50.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

**Phase 2 checkpoint.** Run `npm test && npm run lint && npm run validate:content`. Five effects exist; two of them changed the game for everybody.

---

# Phase 3 — her content

---

### Task 6: `independent-action-viy.yml` (I1–I4, R6)

**Files:**
- Create: `packs/_source/class-skills/independent-action-viy.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("Independent Action with Viy EX (I1–I4, R6)", () => {
  const skill = () => parse(readFileSync("packs/_source/class-skills/independent-action-viy.yml", "utf8"));

  it("keeps the shared slug, so contract.mjs still finds it", () => {
    // `rules/contract.mjs#rollsRequired` matches on the camelCase slug. A
    // variant that renamed it would make her as easy to steal as a Servant
    // with no class skill at all -- which is the exact defect the shared
    // template's own header records.
    expect(skill().slug).toBe("independentAction");
  });

  it("I2 — takes ZON from the table, which gives EX the 3 her sheet prints", () => {
    expect(skill().passiveRules.some((r) => r.key === "ZonBonus" && r.table === "independentActionZon"))
      .toBe(true);
    expect(lookup("independentActionZon", Rank.parse("EX"))).toBe(3);
  });

  it("I1 — EX has no Sustainability clock at all", () => {
    expect(lookup("independentActionSustainability", Rank.parse("EX"))).toBeNull();
  });

  it("I4 — adds the passive that is hers alone", () => {
    const crit = skill().passiveRules.filter((r) => r.key === "CritModifier");
    expect(crit.find((r) => r.aspect === "chance").value).toBe(10);
    expect(crit.find((r) => r.aspect === "damage").value).toBe(10);
  });

  it("is a variant document, not a ref override", () => {
    // `ref:` replaces a key wholesale, so adding one passive through it would
    // mean restating the whole rule list -- and the skill is differently NAMED
    // besides.
    expect(skill().name).toBe("Independent Action with Viy");
    expect(skill().id).toBe("class-independent-action-viy");
  });
});
```

with `import { lookup } from "../../module/domain/tables.mjs";` and `import { Rank } from "../../module/domain/rank.mjs";` added to the file's imports.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "Independent Action with Viy"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# A VARIANT of `class-independent-action`, the way `riding-medusa` is a variant
# of `class-riding`: differently named on the sheet, and carrying a fourth
# passive the shared template does not have.
#
# Not a `ref:` override. A `ref:` entry replaces a key wholesale, so adding one
# passive through it would mean restating the whole rule list here anyway -- and
# then there would be two copies of the ZON rule to drift apart.
#
# The SLUG stays `independentAction`. `rules/contract.mjs#rollsRequired` matches
# on it, and the shared template's own header records what happened the last
# time that slug was wrong: the Servant became as easy to steal as one with no
# class skill at all. At EX it is an absolute prohibition (Ch. 44 Q48), which is
# passive 3 of her sheet.
schema: 1
id: class-independent-action-viy
name: "Independent Action with Viy"
source: class
slug: independentAction
kind: classSkill
passive: true
copyable: { allowed: false, reason: classSkill }
parameterized: [rank]
rank: "@rank"
description: |
  (Passive 1) Sustainability does not apply.
  (Passive 2) Master's ZON is increased by 3 panels.
  (Passive 3) Cannot be contracted by enemy Casters and Masters.
  (Passive 4) Crit Chance is increased by 10%. Crit Damage dealt is increased by 10%.
passiveRules:
  # Passive 2, from the table -- EX gives 3, which is her sheet's number.
  # `stacks` is false by omission, and that is load-bearing: §6.9 says
  # Independent Action and the Caster/Assassin class bonus are the same effect
  # and take the HIGHEST rather than the sum.
  - key: ZonBonus
    table: independentActionZon

  # Passive 4, and the only thing this file adds to the shared template.
  - key: CritModifier
    aspect: chance
    value: 10
  - key: CritModifier
    aspect: damage
    value: 10

  # Passive 1 is her sheet's own `sustainability: null`, not a rule.
  # `independentActionSustainability` answers null at EX, and authoring a
  # `SustainabilityGain` here would pay out on top of a clock that does not run.
  #
  # Passive 3 is `rules/contract.mjs`, which reads this skill's RANK off the
  # unit rather than taking a contribution -- at EX a prohibition, not a
  # difficulty.
```

- [ ] **Step 4: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/class-skills/independent-action-viy.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): Independent Action with Viy

A variant of the class template, the way riding-medusa is one: differently
named on the sheet, carrying a fourth passive the template does not have, and
keeping the shared SLUG so contract.mjs still finds it -- the template's own
header records what happened the last time that slug was wrong.

Passives 1 to 3 are the tables and rules/contract.mjs, unchanged. EX gives her
sheet's ZON 3 and its null Sustainability outright.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 7: The four passive abilities (W1, F1–F2, K1–K2, M1–M6)

**Files:**
- Create: `packs/_source/abilities/anastasia-swimsuit.yml`, `-fae-contract.yml`, `-rock-snowball.yml`, `-watermelon.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("her passive abilities", () => {
  const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

  it("W1 — Swimsuit! halves Water damage taken, including NP", () => {
    const ward = ability("anastasia-swimsuit").passiveRules.find((r) => r.key === "Ward");
    expect(ward).toMatchObject({ value: 50, npValue: 50 });
    expect(ward.predicate).toContain("attack:element:water");
  });

  it("F1/F2 — Fae Contract moves debuff chance in both directions by 5", () => {
    const rules = ability("anastasia-fae-contract").passiveRules;
    expect(rules.find((r) => r.direction === "incoming").value).toBe(5);
    expect(rules.find((r) => r.direction === "outgoing").value).toBe(5);
  });

  it("K1 — Rock Snowball rides the ranged band only (R8)", () => {
    const rule = ability("anastasia-rock-snowball").passiveRules[0];
    expect(rule.chance).toBe(10);
    expect(rule.effect.id).toBe("bleed");
    expect(rule.duration).toBe("½◈");
    // The SAME boundary her Note draws, so the two clauses cannot disagree
    // about where her stance changes.
    expect(rule.predicate).toContain("attack:range:gte:3");
  });

  it("M1–M4 — Watermelon converts Blind into an offensive buff at Range 1–2", () => {
    const rules = ability("anastasia-watermelon").passiveRules;
    const band = ["self:effect:blind", "attack:range:lte:2"];

    const suppress = rules.find((r) => r.key === "Suppress");
    expect(suppress.scope).toBe("miss");
    expect(suppress.predicate).toEqual(band);

    const props = rules.filter((r) => r.key === "AttackProperty").map((r) => r.property);
    expect(props).toContain("pierce");
    expect(props).toContain("ignoreDef");

    // M4 -- the attacker raising the DEFENDER's roll. `direction: imposed` is
    // the axis `attack.mjs:2515` already merges into the defender's plan for
    // EMIYA's Clairvoyance.
    const evade = rules.find((r) => r.key === "CheckModifier");
    expect(evade).toMatchObject({ check: "evade", direction: "imposed", value: 4 });
    expect(evade.predicate).toEqual(band);
  });

  it("M5 — the Active blinds her until the end of the Combat Process", () => {
    const phase = ability("anastasia-watermelon").phases[0];
    expect(phase.target).toBe("self");
    expect(phase.effects[0]).toMatchObject({ id: "blind", duration: "until combatProcessEnd" });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "passive abilities"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `anastasia-swimsuit.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia-swimsuit
name: "Swimsuit!"
kind: skill
slug: swimsuit
passive: true
description: |
  (Passive) All Total Water Damage taken is reduced by 50% including NP.
passiveRules:
  # A `Ward`, not a Def Up: a Ward is the category-predicated reduction (§24.3
  # Group 2) and lands in the same stage-4 bucket, which keeps it additive
  # against Atk Up the way §13.4 requires. Karna's fire resistance is the same
  # rule with a different element, and `attack:element` became a roll option
  # when he was authored.
  #
  # `npValue` equals `value` because the sheet says "including NP" rather than
  # giving a reduced NP figure.
  - key: Ward
    value: 50
    npValue: 50
    predicate: ["attack:element:water"]
```

- [ ] **Step 4: Write `anastasia-fae-contract.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia-fae-contract
name: "Fae Contract"
rank: "B+"
kind: skill
slug: faeContract
passive: true
description: |
  (Passive) Debuff Resist is increased by 5%. Chance of inflicting debuffs is increased by 5%.
passiveRules:
  # Both directions of the same bucket. `ApplicationChance` rather than a
  # `CheckModifier`, for the reason Magic Resistance's own clause 2 records: the
  # effect applier reads resistance off `applicationChances`, and a
  # `CheckModifier` lands somewhere it never consults.
  - key: ApplicationChance
    direction: incoming
    value: 5
  - key: ApplicationChance
    direction: outgoing
    value: 5
```

- [ ] **Step 5: Write `anastasia-rock-snowball.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia-rock-snowball
name: "Rock Snowball"
kind: skill
slug: rockSnowball
passive: true
description: |
  (Passive) Anastasia's Normal Attacks at a Range of 3 or higher have a 10% chance of inflicting
  @effect[bleed]{Bleed} for ½◈ Turns.
  *Remember kids, don't throw snowballs with rocks in them!*
passiveRules:
  # The SAME boundary her Note draws (`attack:range:gte:3`), so the two clauses
  # cannot disagree about where her stance changes -- at 3 she stops swinging
  # and starts throwing, and that is where the rocks go in.
  #
  # `damageDealt` fires on the attacker with the victim in `ctx.victim`, which
  # is the rung every "Normal Attacks inflict X on the DU" clause hangs from.
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: ["attack:kind:normal", "attack:range:gte:3"]
    target: victim
    effect: { id: bleed }
    chance: 10
    duration: "½◈"
```

- [ ] **Step 6: Write `anastasia-watermelon.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# A Servant who inflicts a debuff on HERSELF to convert it into an offensive
# buff -- Ch. 44 §44.3 calls the shape "self-harm as a resource", with Van
# Gogh's Curse economy as the precedent. The difference is that Gogh CONSUMES
# her debuff and Anastasia REINTERPRETS hers.
#
# She keeps Blind's other clauses. The sheet exempts *"a chance of Missing"*,
# singular, so her own Evade rolls stay at +3 for as long as the Blind lasts --
# and her Active deliberately holds it through the whole Combat Process, which
# is a window the defender may Counter in. That is the price of the trick.
schema: 1
id: anastasia-watermelon
name: "Watermelon Splitting Master"
kind: skill
slug: watermelonSplitting
cooldown: "2◈"
timing: { window: combatPhaseStart }
description: |
  (Passive) When Anastasia performs a Normal Attack at a Range of 1 to 2 while inflicted with
  @effect[blind]{Blind}, it does not have a chance of Missing; and instead it gains the @effect[pierce]{Pierce} &
  @effect[ignoreDef]{Ignore Def} effects, also the DU's @effect[evade]{Evade} roll is increased by 4 if it Evades the Attack.
  (Active) Used at the start of a Combat Phase when initiating an Attack. Anastasia gains Blind
  until the end of the Combat Process. Cooldown: 2◈ Turns.
passiveRules:
  # M1. The Miss check is Combat Process step 1.5; this switches it off for her,
  # in this band only. The same `Suppress` element Blind's own clause 3 uses.
  - key: Suppress
    scope: miss
    predicate: ["self:effect:blind", "attack:range:lte:2"]

  # M2 and M3 -- what she gets INSTEAD.
  - key: AttackProperty
    property: pierce
    predicate: ["self:effect:blind", "attack:range:lte:2"]
  - key: AttackProperty
    property: ignoreDef
    predicate: ["self:effect:blind", "attack:range:lte:2"]

  # M4. `direction: imposed` is the axis `engine/attack.mjs` already merges into
  # the DEFENDER's evade plan -- EMIYA's Clairvoyance forces the unfavourable
  # table the same way, and the comment there says why it can never come from
  # the defender's own plan.
  - key: CheckModifier
    check: evade
    direction: imposed
    value: 4
    predicate: ["self:effect:blind", "attack:range:lte:2"]
phases:
  # M5. She blinds herself, on purpose, for the length of one Combat Process.
  - kind: applyEffects
    target: self
    effects:
      # `until <event>` is the tick vocabulary's form for a duration bounded
      # by something happening, and `combatProcessEnd` is fired on both
      # combatants once per Process (`engine/attack.mjs`).
      - { id: blind, duration: "until combatProcessEnd" }
```

`"until combatProcessEnd"` is the tick vocabulary's `until <event>` form, and `combatProcessEnd` is fired on both combatants once per Process (`engine/attack.mjs:1474`). A bare `"combatProcess"` would throw at parse.

- [ ] **Step 7: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/anastasia-swimsuit.yml packs/_source/abilities/anastasia-fae-contract.yml packs/_source/abilities/anastasia-rock-snowball.yml packs/_source/abilities/anastasia-watermelon.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): her four passives, and Blind as a resource

Watermelon Splitting Master is the point: a Servant who blinds herself to turn
off her own Miss check and take Pierce, Ignore Def and a +4 on the defender's
Evade roll instead. Ch. 44 s44.3 calls the shape self-harm as a resource; the
difference from Van Gogh is that Gogh CONSUMES her debuff and Anastasia
REINTERPRETS hers.

She keeps Blind's other clauses -- the sheet exempts \"a chance of Missing\",
singular -- so her own Evade rolls stay at +3 through a window the defender
may Counter in.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 8: The three active skills

**Files:**
- Create: `packs/_source/abilities/anastasia-shvibzik.yml`, `-freezing-summertime.yml`, `-spirit-eyes.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("her three active skills", () => {
  const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

  it("Shvibzik restores 3 Luck, buffs, and turns the NP clock by 1◈+⅔◈", () => {
    const a = ability("anastasia-shvibzik");
    expect(a.cooldown).toBe("4◈-⅓◈");
    const stat = a.phases.find((p) => p.kind === "statChange");
    expect(stat.changes[0]).toMatchObject({ stat: "luck", delta: 3, clamp: true });
    const buff = a.phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(buff).toMatchObject({ id: "atkUp", magnitude: 30, npMagnitude: 20, duration: "1◈" });
    const cd = a.phases.at(-1).rules[0];
    expect(cd).toMatchObject({ key: "CooldownDelta", scope: "np", ticks: "1◈+⅔◈" });
  });

  it("Freezing Summertime applies Invuln, BuffRemoval ResUp, and an ally S.Crit Up", () => {
    const a = ability("anastasia-freezing-summertime");
    expect(a.cooldown).toBe("3◈");
    const self = a.phases.find((p) => p.target === "self").effects.map((e) => e.id);
    expect(self).toContain("invuln");
    expect(self).toContain("buffRemovalResUp");
    const allies = a.phases.find((p) => p.targeting);
    expect(allies.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(allies.effects[0]).toMatchObject({ id: "sCritUp", magnitude: 20, duration: "⅓◈" });
  });

  it("Spirit Eyes applies all four of its buffs", () => {
    const a = ability("anastasia-spirit-eyes");
    expect(a.cooldown).toBe("4◈");
    const e = a.phases[0].effects;
    expect(e.find((x) => x.id === "aim")).toMatchObject({ duration: "1◈" });
    expect(e.find((x) => x.id === "critUpViy")).toMatchObject({ magnitude: 50, npMagnitude: 20 });
    expect(e.find((x) => x.id === "critDmUp")).toMatchObject({ magnitude: 30 });
    expect(e.find((x) => x.id === "npDmUp")).toMatchObject({ magnitude: 20 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "three active skills"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `anastasia-shvibzik.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia-shvibzik
name: "Shvibzik (Summer)"
rank: "B+"
kind: skill
slug: shvibzik
cooldown: "4◈-⅓◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Restores 3 Luck.
  2. Applies @effect[atkUp]{Atk Up} for 1◈ Turns, all damage dealt is increased by 30%; if NP, 20%.
  3. NP Cooldown is reduced by 1◈+⅔◈ Turns.
  Cooldown: 4◈-⅓◈ Turns.
phases:
  - kind: statChange
    target: self
    changes:
      - { stat: luck, delta: 3, clamp: true }
  - kind: applyEffects
    target: self
    effects:
      # "increased by 30%; if NP, 20%" -- an ABSOLUTE NP figure, because the
      # sheet states both and 20 is not half of 30.
      - { id: atkUp, duration: "1◈", magnitude: 30, npMagnitude: 20 }
  - kind: applyEffects
    target: self
    rules:
      # `ticks`, not `delta`: "1◈+⅔◈" is a ◈ expression, and the tick parser
      # takes the `a◈ ± b/c◈` family natively.
      - { key: CooldownDelta, scope: np, ticks: "1◈+⅔◈" }
```

- [ ] **Step 4: Write `anastasia-freezing-summertime.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia-freezing-summertime
name: "Freezing Summertime"
rank: A
kind: skill
slug: freezingSummertime
cooldown: "3◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Applies @effect[invuln]{Invuln} for ⅓◈ Turns.
  2. Applies @effect[buffRemovalResUp]{BuffRemoval ResUp} for ⅓◈ Turns, the chance of having buffs removed from herself
     is reduced by 100%.
  3. Applies @effect[sCritUp]{S.Crit Up} for ⅓◈ Turns to all allied Units within a 2 panel area of herself,
     Crit Chance is increased by 20%.
  Cooldown: 3◈ Turns.
phases:
  # Effects 1 and 2 -- hers alone.
  - kind: applyEffects
    target: self
    effects:
      - { id: invuln, duration: "⅓◈" }
      - { id: buffRemovalResUp, duration: "⅓◈", magnitude: 100 }
  # Effect 3 -- a DIFFERENT reach, so it states its own targeting rather than
  # reusing the ability's. `includeSelf` because "all allied Units" includes the
  # speaker unless the text says otherwise (rules/relations.mjs#isFriendly).
  - kind: applyEffects
    targeting:
      anchor: { kind: self }
      shape: { kind: chebyshevRadius, r: 2 }
      selection: { relations: [ally, self], includeSelf: true, chooser: all }
    effects:
      - { id: sCritUp, duration: "⅓◈", magnitude: 20 }
```

- [ ] **Step 5: Write `anastasia-spirit-eyes.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia-spirit-eyes
name: "Full Acceleration: Spirit Eyes"
rank: B
kind: skill
slug: spiritEyes
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Applies @effect[aim]{Aim} for 1◈ Turns.
  2. Applies @effect[critUpViy]{Crit Up (Viy)} for 1◈ Turns, Crit Chance of Attacks which use Base Attack (MAG)
     is increased by 50%; if NP, 20%.
  3. Applies @effect[critDmUp]{Crit DmUp} for 1◈ Turns, Crit Damage dealt is increased by 30%.
  4. Applies @effect[npDmUp]{NP DmUp} for 1◈ Turns, NP Damage dealt is increased by 20%.
  Cooldown: 4◈ Turns.
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: aim, duration: "1◈" }
      # Her ranged Normal Attack and her Snegleta both use BA(MAG), so this
      # buff is scoped to exactly the half of her kit that throws.
      - { id: critUpViy, duration: "1◈", magnitude: 50, npMagnitude: 20 }
      - { id: critDmUp, duration: "1◈", magnitude: 30 }
      - { id: npDmUp, duration: "1◈", magnitude: 20 }
```

- [ ] **Step 6: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/anastasia-shvibzik.yml packs/_source/abilities/anastasia-freezing-summertime.yml packs/_source/abilities/anastasia-spirit-eyes.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): her three active skills

Crit Up (Viy) is scoped to BA(MAG) attacks, which is exactly the half of her
kit that throws -- her ranged Normal Attack and Snegleta both use it, and her
melee swing does not.

Freezing Summertime's third effect states its own targeting rather than
reusing the ability's: two of its clauses are hers alone and the third reaches
2 panels, and defaulting to reuse would have put Invuln on her whole team.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 9: Ice Bucket Challenge (B1–B10)

**Files:**
- Create: `packs/_source/abilities/anastasia-ice-bucket-challenge.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("Ice Bucket Challenge (B1–B10)", () => {
  const a = () => parse(readFileSync("packs/_source/abilities/anastasia-ice-bucket-challenge.yml", "utf8"));

  it("B1/B2/B3 — an Attack Skill at Range 2, off BA(MAG), dealing Water", () => {
    expect(a().isAttackSkill).toBe(true);
    expect(a().targeting.anchor).toMatchObject({ kind: "targetUnit", range: 2 });
    expect(a().damage.base.sources).toEqual([{ unit: "self", component: "mag", factor: 1 }]);
    expect(a().damage.component).toBe("mag");
    expect(a().damage.element).toBe("water");
  });

  it("B4/B5 — 20% Slow, and Soaked with no chance at all", () => {
    const e = a().phases.find((p) => p.kind === "applyEffects").effects;
    expect(e.find((x) => x.id === "slow")).toMatchObject({ chance: 20, duration: "1◈" });
    // "Applies the 'Soaked' effect" -- stated flatly, so it lands.
    expect(e.find((x) => x.id === "soaked").chance).toBeUndefined();
  });

  it("B10 — carries the cooldown her sheet prints", () => {
    expect(a().cooldown).toBe("3◈");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "Ice Bucket"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# The setup half of her kit: Soaked makes the next Ice attack far more likely
# to Freeze, and her own ranged Normal Attack is Ice.
schema: 1
id: anastasia-ice-bucket-challenge
name: "Ice Bucket Challenge for You"
kind: skill
slug: iceBucketChallenge
# An ATTACK SKILL: it performs an Attack, so it opens a Combat Process and
# spends her Attack for the Turn (§15.1).
isAttackSkill: true
element: water
cooldown: "3◈"
timing: { window: ownTurn }
description: |
  Attack Skill. Range=2. Base Attack (MAG) is used. Deals Water damage. Then, has the following
  effects-
  1. Has a 20% chance of inflicting @effect[slow]{Slow} for 1◈ Turns.
  2. Applies the '@effect[soaked]{Soaked}' effect.
  Cooldown: 3◈ Turns.
targeting:
  anchor: { kind: targetUnit, range: 2 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: chosen, count: 1 }
damage:
  base:
    sources:
      - { unit: self, component: mag, factor: 1 }
  component: mag
  # The whole attack is Water, so no `elementFraction`: her Swimsuit! clause
  # and Soaked's own Fire clause both read a whole element, and a fraction here
  # would be inventing one the sheet does not state.
  element: water
phases:
  - kind: damage
  - kind: applyEffects
    target: reuse
    effects:
      - { id: slow, duration: "1◈", chance: 20 }
      # No `chance`. "Applies the 'Soaked' effect" is stated flatly, so it
      # lands -- and Soaked is `polarity: status`, which keeps it clear of
      # every Debuff Resist in the game besides.
      - { id: soaked }
```

- [ ] **Step 4: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/anastasia-ice-bucket-challenge.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): Ice Bucket Challenge

The setup half of her kit: Soaked makes the next Ice attack far likelier to
Freeze, and her own ranged Normal Attack is Ice. Slow is chanced at 20 and
Soaked is not chanced at all, because the sheet states it flatly.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 10: The two Noble Phantasms

**Files:**
- Create: `packs/_source/abilities/anastasia-snegleta.yml`, `packs/_source/abilities/anastasia-ice-block-launcher.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("her two Noble Phantasms", () => {
  const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

  it("Snegleta: BA(MAG), Range+1, Def Dwn (A) then 3.5x and Skill Seal", () => {
    const np = ability("anastasia-snegleta");
    expect(np.rank).toBe("B");
    expect(np.isNP).toBe(true);
    expect(np.npTags).toEqual(["antiUnit"]);
    expect(np.cooldown).toBe("6◈");
    expect(np.targeting.anchor.rangeBonus).toBe(1);
    expect(np.damage.component).toBe("mag");
    expect(np.damage.multiplier).toBe(3.5);

    // ORDER matters: the sheet says "First, inflict Def Dwn (A) ... Then, deals
    // 3.5x damage", and Def Dwn (A) raises damage taken by 30% -- so applying
    // it first is worth 30% of this very attack.
    const kinds = np.phases.map((p) => p.kind);
    expect(kinds.indexOf("applyEffects")).toBeLessThan(kinds.indexOf("damage"));

    const first = np.phases[0].effects[0];
    expect(first).toMatchObject({ id: "defDwnA", magnitude: 30, duration: "⅓◈" });
    const after = np.phases.at(-1).effects[0];
    expect(after).toMatchObject({ id: "skillSeal", duration: "⅓◈" });
  });

  it("Ice Block Launcher: BA(STR), Range+3, Aim, 3x, Ice, Instakill per panel", () => {
    const np = ability("anastasia-ice-block-launcher");
    expect(np.rank).toBe("C");
    expect(np.cooldown).toBe("5◈");
    expect(np.targeting.anchor.rangeBonus).toBe(3);
    expect(np.damage.component).toBe("str");
    expect(np.damage.multiplier).toBe(3);
    expect(np.damage.element).toBe("ice");
    expect(np.damage.aim).toBe(true);

    // R3 -- the distance, not the gap. 5% per panel, so 30% at her maximum
    // reach of 6.
    const rider = np.phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(rider).toMatchObject({ id: "instakill", chancePerPanel: 5 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "Noble Phantasms"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `anastasia-snegleta.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# Her stronger Noble Phantasm: 3.5x off BA(MAG) 150 against 3x off BA(STR) 95,
# which is what Ch. 33's "strongest NP" ranking records.
schema: 1
id: anastasia-snegleta
name: "Snegleta・Snegurochka: Summer Snow, Beautiful Drops of Hoarfrost"
rank: B
isNP: true
categorizedAsNP: true
npTags: [antiUnit]
kind: noblePhantasm
cooldown: "6◈"
timing: { window: ownTurn }
description: |
  Dreaming Crater・Snow Maiden. Base Attack (MAG) is used. Range+1 for the Combat Process. First,
  inflict @effect[defDwnA]{Def Dwn (A)} for ⅓◈ Turns, all damage taken is increased by 30%, and Luck is reduced by 1
  whenever damage is received from an Attack. Then, deals 3.5x damage and inflicts @effect[skillSeal]{Skill Seal} for
  ⅓◈ Turns. Cooldown: 6◈ Turns.
targeting:
  # "Range+1 for the Combat Process" -- `rangeBonus` on the anchor, the same
  # field Kingprotea's Earth Mother's Wail uses.
  anchor: { kind: targetUnit, range: 3, rangeBonus: 1 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: chosen, count: 1 }
damage:
  base:
    sources:
      - { unit: self, component: mag, factor: 1 }
  component: mag
  multiplier: 3.5
phases:
  # ORDER IS THE CLAUSE. "First, inflict Def Dwn (A) ... Then, deals 3.5x
  # damage" -- and Def Dwn (A) raises damage taken by 30%, so applying it first
  # is worth 30% of this very attack. Authored after the damage it would be
  # worth 30% of the NEXT one, which is a different Noble Phantasm.
  - kind: applyEffects
    target: reuse
    effects:
      - { id: defDwnA, duration: "⅓◈", magnitude: 30 }
  - kind: damage
  - kind: applyEffects
    target: reuse
    effects:
      - { id: skillSeal, duration: "⅓◈" }
```

- [ ] **Step 4: Write `anastasia-ice-block-launcher.yml`**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
#
# The only clause in either roster whose chance scales with distance, and the
# reason `chancePerPanel` exists.
schema: 1
id: anastasia-ice-block-launcher
name: "Ice Block Launcher・Absolute Killer Baseball: Underthrow Freeze Sinker"
rank: C
isNP: true
categorizedAsNP: true
npTags: [antiUnit]
kind: noblePhantasm
cooldown: "5◈"
timing: { window: ownTurn }
description: |
  Base Attack (STR) is used. Range+3 for the Combat Process. Has the @effect[aim]{Aim} effect. Deals 3x damage
  with a 5% chance of inflicting @effect[instakill]{Instakill} for each panel between Anastasia and the DU.
  Ice damage. Cooldown: 5◈ Turns.
targeting:
  # Range 3 + 3 = 6, which is what caps the Instakill chance at 30%.
  anchor: { kind: targetUnit, range: 3, rangeBonus: 3 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: chosen, count: 1 }
damage:
  base:
    sources:
      - { unit: self, component: str, factor: 1 }
  component: str
  multiplier: 3
  element: ice
  # "Has the Aim effect" -- a property of the attack, read by the evade check.
  aim: true
phases:
  - kind: damage
  - kind: applyEffects
    target: reuse
    effects:
      # *"a 5% chance ... for each panel between Anastasia and the DU."*
      #
      # "Panels between" is the DISTANCE, not the gap: the corpus's only other
      # use of the phrase is the Dioscuri sheet's "the maximum distance between
      # the two is 2 panels between them", which the leash implements as
      # Chebyshev 2. So this is 5% at one panel and 30% at her maximum reach.
      #
      # Instakill is severity-gated: Magic Resistance's own clause covers it,
      # and this attack is STR-component and does not claim to bypass MR, so a
      # defender with Magic Resistance resists it. That is the sheet's silence
      # honoured rather than overridden.
      - { id: instakill, chancePerPanel: 5 }
```

- [ ] **Step 5: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/anastasia-snegleta.yml packs/_source/abilities/anastasia-ice-block-launcher.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): both Noble Phantasms

Snegleta's phase ORDER is the clause: \"First, inflict Def Dwn (A) ... Then,
deals 3.5x damage\", and Def Dwn (A) raises damage taken by 30% -- so applying
it first is worth 30% of this very attack. Authored after the damage it would
be worth 30% of the next one, which is a different Noble Phantasm.

Ice Block Launcher is the only clause in either roster whose chance scales
with distance. Its Instakill is not MR-exempt, because the sheet does not say
it is.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 11: `anastasia.yml`, and the first pack build

**Files:**
- Create: `packs/_source/servants/anastasia.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("the Servant document", () => {
  const a = () => parse(readFileSync("packs/_source/servants/anastasia.yml", "utf8"));

  it("R1 — her printed figures all agree with the rank tables", () => {
    // Unlike Pollux, nothing here is overruled. STR D++ -> 75 + 2x10 = 95;
    // MAG C -> 150; END E -> 500.
    expect(baseAttackFor(a())).toEqual({ str: 95, mag: 150 });
    expect(a().baseHealth).toBe(500);
  });

  it("N1–N4 — the banded Normal Attack, EMIYA's idiom at 10%", () => {
    const na = a().normalAttack;
    expect(na.mode).toBe("rangeBanded");
    expect(na.component).toBe("str");
    const band = na.bands.find((b) => b.from === 3);
    expect(band.ignoresMagicResistance).toBe(true);
    expect(band.element).toBe("ice");
    expect(band.sources).toEqual([
      { component: "str", factor: 1 },
      { component: "mag", factor: 0.1 },
    ]);
  });

  it("N2 — the ranged band totals the 110 her sheet prints", () => {
    const ba = baseAttackFor(a());
    expect(ba.str + ba.mag * 0.1).toBe(110);
  });

  it("I1 — has no Sustainability clock at all", () => {
    expect(a().sustainability).toBeNull();
  });

  it("R7 — carries both Noble Phantasms, and neither is stored as the stronger", () => {
    const refs = a().abilities.map((x) => x.ref);
    expect(refs).toContain("anastasia-snegleta");
    expect(refs).toContain("anastasia-ice-block-launcher");
    // Ch. 33 §33.4 REJECTED storing the ranking: `rules/np-strength.mjs`
    // computes it against a synthetic neutral defender, because that "belongs
    // in rules/np-strength.mjs -- pure, testable -- rather than inside a
    // registered function content cannot inspect."
    expect(a().strongestNP).toBeUndefined();
  });

  it("R7 — and np-strength ranks Snegleta above Ice Block Launcher", () => {
    const np = (id) => ({ ...parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8")), id });
    const ranked = rankNoblePhantasms(
      [np("anastasia-snegleta"), np("anastasia-ice-block-launcher")],
      { baseAttack: { str: 95, mag: 150 }, modifiers: [] },
    );
    expect(ranked[0].id).toBe("anastasia-snegleta");
  });

  it("carries the alignment the rulebook does not list", () => {
    expect(a().alignment.morality).toBe("summer");
  });
});
```

with `import { baseAttackFor } from "../../module/domain/base-attack.mjs";` and
`import { rankNoblePhantasms } from "../../module/rules/np-strength.mjs";` added.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/anastasia.test.mjs -t "Servant document"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Anastasia & Viy, char_orig_sheets/Copia de Anastasia & Viy.md
schema: 1
id: anastasia
name: "Anastasia & Viy"
type: servant
trueName: "Anastasia Nikolaevna Romanova"
# Independent Action is her ONLY class skill, and Independent Action does not
# identify a class -- Appendix D marks her class with a dash for exactly this
# reason. `classContainer` is presentational and has to say something, so it
# says what her opponents would call her.
servantClasses: [caster]
classContainer: caster
region: [russia, europe]
# *"Chaotic Summer"* -- a value the rulebook does not list. Ch. 44 §44.1 made
# `alignment.morality` an open string rather than a closed enum for this one
# sheet, calling it "a one-line schema change that would have been an expensive
# one to discover after content authoring began."
alignment: { order: chaotic, morality: summer }
attributes: [female, servant, man, humanoid]
parameters: { str: "D++", end: E, agi: B, mag: C, luc: C }
baseHealth: 500
mov: 6
range: { panels: 3, targets: 1 }
baseAttack: { str: 95, mag: 150 }
# *"Sustainability: N/A"* -- Independent Action EX, and one of only two Servants
# in either roster with no upkeep clock at all. `null` is not zero: the
# scheduler tolerates it and the sheet guards for it.
sustainability: null

# ─── The banded Normal Attack (the sheet's Note) ───────────────────────
# *"Normal Attacks at a Range of 1 to 2 use Base Attack (STR). Normal Attacks at
# a Range of 3 or higher use Base Attack (STR) and 10% of Base Attack (MAG)
# combined (e.g. BA=110) and deal Ice damage, not affected by Magic
# Resistance."*
#
# EMIYA's clause with 10% in place of 20%, and `rules/normal-attack.mjs` exists
# for it -- its docstring quotes his. Three things change at the band edge and
# all three are stated: the sources, what the attack COUNTS AS, and whether
# Magic Resistance sees it. `component: str` in the band is not decoration --
# her ranged shot would otherwise be a MAG attack a Rank D Magic Resistance
# negates outright, which is the opposite of what "not affected by Magic
# Resistance" asks for.
normalAttack:
  mode: rangeBanded
  component: str
  bands:
    - from: 3
      component: str
      element: ice
      ignoresMagicResistance: true
      sources:
        - { component: str, factor: 1 }
        - { component: mag, factor: 0.1 }

# NO `strongestNP`. Ch. 33 §33.4 rejected storing the ranking outright --
# `rules/np-strength.mjs#rankNoblePhantasms` computes it against a synthetic
# neutral defender, "pure, testable, and rankable ... rather than inside a
# registered function content cannot inspect." 3.5x off BA(MAG) 150 beats 3x
# off BA(STR) 95, and the engine works that out for itself.

abilities:
  - { ref: class-independent-action-viy, rank: EX }
  - { ref: anastasia-swimsuit }
  - { ref: anastasia-fae-contract }
  - { ref: anastasia-shvibzik }
  - { ref: anastasia-freezing-summertime }
  - { ref: anastasia-spirit-eyes }
  - { ref: anastasia-watermelon }
  - { ref: anastasia-rock-snowball }
  - { ref: anastasia-ice-bucket-challenge }
  - { ref: anastasia-snegleta }
  - { ref: anastasia-ice-block-launcher }
```

Do **not** add a `strongestNP` key. Ch. 33 §33.4 settled this in favour of computation, and storing it would be a second answer to a question `rules/np-strength.mjs` already answers.

- [ ] **Step 4: Validate, test, build**

```bash
npm run validate:content
npm test
npm run lint
node tools/fgt-world.mjs shutdown
npm run build:packs
```

`validate:content` must report **no Base Attack deviation** for her (R1). If it does, the authoring is wrong.

- [ ] **Step 5: Commit**

```bash
git add packs/_source/servants/anastasia.yml test/unit/anastasia.test.mjs
git commit -m "feat(content): Anastasia & Viy

Her Note is EMIYA's clause with 10% where he has 20%, and normal-attack.mjs
exists for it -- the docstring quotes his version. component: str inside the
band is load-bearing: her ranged shot would otherwise be a MAG attack that a
Rank D Magic Resistance negates outright, which is the opposite of what \"not
affected by Magic Resistance\" asks for.

Every printed figure agrees with the tables, which is worth saying because the
last Servant's did not.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

# Phase 4 — documentation and the live board

---

### Task 12: Documentation

**Files:**
- Modify: `docs/44-case-expanded-roster.md`, `docs/A-effect-catalogue.md`, `docs/D-servant-data-sheets.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Correct Ch. 44 §44.3**

Its Anastasia section says *"No new machinery: a passive with `predicate: ["self:effect:blind", "attack:range:lte:2"]` that suppresses Blind's miss clause."* That was written when **nothing could make an attack miss at all**. Add a note recording that the Miss check arrived at Combat Process step 1.5 in the meantime, that the chapter's predicted predicate is **exactly** what shipped, and that the one new piece was teaching `missChance` to read a suppression.

- [ ] **Step 2: Mark the effects built in Appendix A**

Notes under `Freeze`, `Invuln` and the new `Soaked` row, in the voice the `Blind` and `Deafen` notes use — recording for the first two that the pipeline carried their behaviour unexercised, and for Soaked that all three of its clauses turned out to need no new mechanism.

- [ ] **Step 3: Rewrite Appendix D's Anastasia row**

Replace the forward-looking entry with what was built. Record: every figure agreeing with the tables; `sustainability: null` as one of two in the corpus; `rangeBanded` as EMIYA's idiom reused; and both Noble Phantasms with Snegleta as the stronger.

- [ ] **Step 4: The rest**

- Ch. 45 — move her to authored, raise the Servant count from 11 to 12, and record `Freeze`/`Invuln` as now-live statuses.
- `CHANGELOG.md` — a full entry under `## [Unreleased]`, naming the five discoveries and the two rulings.
- `README.md` — the authored-Servant count and the test count.

- [ ] **Step 5: Commit**

```bash
git add docs/ CHANGELOG.md README.md
git commit -m "docs: Anastasia is built, and Ch. 44 predicted her exactly

s44.3 said her Blind trick needed \"no new machinery: a passive with
predicate: [self:effect:blind, attack:range:lte:2]\". That is exactly what
shipped -- except the chapter was written when nothing could make an attack
miss at all, so the suppression had nothing to suppress until step 1.5 arrived.

Freeze and Invuln are recorded as live for the whole roster, not as hers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

### Task 13: Live-world verification

Green tests are not evidence that a Servant works. Ch. 45 §45.1 records Asterios and Karna both sitting on the authored list while six of one's clauses had no reader and nine of the other's abilities did not exist — and the Dioscuri pass found two defects that 4,384 passing tests could not see, both of them fields silently dropped by an allowlist.

- [ ] **Step 1: Bring the world up**

```bash
node tools/fgt-world.mjs shutdown
npm run build:packs
node tools/fgt-world.mjs launch
```

Then join as Gamemaster over CDP. Launch fails with no Foundry tab open — open one first.

- [ ] **Step 2: Confirm she compiled with her fields intact**

Read her out of the compendium and check `normalAttack.bands`, `sustainability`, `strongestNP` and all eleven abilities survived the build. **This is where the last two allowlist defects were caught** — a field in the schema and in the YAML that `actorSystem()`/`itemSystem()` did not name compiles to its default, silently.

- [ ] **Step 3: Walk the inventory**

Every clause gets an observation, not an inference.

- [ ] **N1/N2** — a Normal Attack at range 2 versus one at range 3 producing **different Base Attacks** on the card: 95 against 110.
- [ ] **N3/N4** — the range-3 shot showing Ice, and a Magic Resistance defender not reducing it.
- [ ] **I1** — her sheet rendering `Sustainability: N/A` without falling over.
- [ ] **I2** — her Master's ZON ring drawn 3 panels wider.
- [ ] **M1/M5** — Watermelon's Active applying Blind, then a melee swing producing **damage rather than a Miss card**; and the same swing at range 3 still able to miss (R5).
- [ ] **M4** — the defender's Evade roll showing +4 on the card.
- [ ] **B5/B6** — Soaked applied, then an Ice attack showing a Freeze chance **25 higher** than the attack's own.
- [ ] **B7/R2** — a Soaked *and* Frozen unit hit by Fire: no damage, **both** effects gone.
- [ ] **B8** — Soaked surviving a Night round end and clearing at a Day one.
- [ ] **Snegleta** — Range+1 honoured, and the damage card showing Def Dwn (A) applied **before** the 3.5×.
- [ ] **Ice Block Launcher** — the Instakill chance rising with distance: 5% adjacent, 30% at six panels.
- [ ] **Freeze** — a Frozen unit absorbing an attack under 150 entirely, and breaking on one at 150+.

- [ ] **Step 4: Fix what the board disagrees with**

Any clause that misbehaves is a bug in this implementation, not in the sheet. Fix it, add the unit test that would have caught it, and re-verify.

- [ ] **Step 5: Final commit**

```bash
npm test && npm run lint && npm run validate:content
git add -A
git commit -m "test(content): Anastasia & Viy, verified on a live board

Every clause of the inventory observed rather than inferred. [Record here what
the board disagreed with, and what was fixed.]

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN"
```

---

## Self-review notes

Checked against the spec:

- **§3 rulings R1–R8** — R1 Task 11; R2 Task 4; R3 Tasks 2/10; R4 Task 7 (she keeps Blind's other clauses, enforced by the suppression being scoped to `miss` alone); R5 Tasks 1/7; R6 Task 6; R7 Task 11 (corrected during review: the ranking is COMPUTED, not stored); R8 Task 7.
- **§4 inventory** — the ~30 FREE clauses need no task by definition and are verified in Task 13. The ~24 CONTENT clauses land in Tasks 3–11. The 2 surviving ENGINE clauses are Tasks 1–2.
- **§5 engine work** — E1 Task 1; E6 Task 2. **E2, E3 and E4's carve-out are withdrawn** by the correction block at the head of §5; their clauses are authored as content in Tasks 7 and 4 respectively, and the tests there assert the mechanism they ride on.
- **§6 content — 17 files** — 5 effects (Tasks 3–5), 1 class skill (Task 6), 10 abilities (Tasks 7–10), 1 Servant (Task 11).
- **§7 verification** — Task 13.
- **§8 risks** — the "stage 0 halts" risk is withdrawn with E4. The `Freeze`/`Invuln` blast radius is handled by Task 3 testing against the *existing* pipeline readers and by its Step 6 instruction to stop if any existing test moves.

**Type consistency:** `chanceFromDistance(perPanel, distance)` is defined in Task 2 and referenced by name in Tasks 2 and 10. `missChance(attacker, options)` keeps the signature it shipped with. Effect ids `freeze`, `invuln`, `soaked`, `buffRemovalResUp`, `critUpViy` are each defined once and referenced under the same spelling throughout.

**Both deferred decisions were resolved during the pre-execution review**, and the plan above is corrected: the duration is `"until combatProcessEnd"` (the `until <event>` form, fired at `engine/attack.mjs:1474`), and `strongestNP` is **not authored at all**, because Ch. 33 §33.4 chose computation over storage and `rules/np-strength.mjs` is the answer.
