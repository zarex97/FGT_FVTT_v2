# Nursery Rhyme, Part 1 — the core kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable Nursery Rhyme — stats, the Note, four Skills, three Spells and one Noble Phantasm, live on a board.

**Architecture:** Three phases. Phase 1 promotes Territory Creation to a shared class-skill template and fixes the hardcoded-literal defect in Medea's copy on the way past. Phase 2 makes the one engine change her Noble Phantasm needs — a `CooldownDelta` that can reach an attack's targets and *add* rather than set. Phase 3 authors her thirteen content files and walks them on a live board.

**Tech Stack:** Foundry VTT v14, ES modules, JSDoc typing, Vitest, YAML content compiled to LevelDB packs. Layer discipline `domain → rules → engine → apps` is enforced by ESLint.

**Spec:** `docs/superpowers/specs/2026-09-16-nursery-1-core-design.md` — read it before Task 1, **including the correction block in §4**, which withdraws the claim that the Territory Creation tables need creating. Every task cites the ruling (R1–R6) or clause id (S1–S12, T1–T3, M1–M3, H1, P1–P7, W1–W4, V1–V4, F1–F4, E1–E4, A1–A8) it implements.

## Global Constraints

- **This is Part 1 of 4.** Her Servant file gains four more ability refs in Parts 2–4. Write it so adding them is an append, not a rewrite. **Nothing here may assume the summons, the tokens or the rewind exist.**
- **Layer boundaries.** `module/domain` and `module/rules` are pure and may not touch Foundry globals. `npm run lint` runs `tools/check-layers.mjs`.
- **Every rule lands with its reader in the same task.** Ch. 45 classifies an implemented-but-unread rule as **Collected** and names it this project's dominant defect.
- **Both allowlists.** An authored field that `actorSystem()`/`itemSystem()` in `tools/lib/content.mjs` does not name compiles to its schema default, **silently**. That has happened six times. `module/content/authored-fields.mjs` holds the vocabulary and `test/unit/authored-fields.test.mjs` holds the two together — any new authored key goes in **both**.
- **`npm test` must pass at every commit.** Confirm the baseline before Task 1 and record it.
- **`npm run validate:content` must pass after any YAML edit.**
- **Her printed figures are all correct** (spec §2). END `E` → 500, STR `E` → 50, MAG `A` → 200. If `validate:content` reports a Base Attack deviation for her, the authoring is wrong.
- **Medea is live.** Task 1 touches an authored, tested Servant. **Her tests must pass unchanged**; if any move, the promotion is wrong and gets reverted rather than argued with.
- **Rebuilding packs needs the world shut down.** `node tools/fgt-world.mjs shutdown` → `npm run build:packs` → `launch` → rejoin.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
  ```

---

# Phase 1 — Territory Creation, promoted

---

### Task 1: `class-territory-creation.yml`, and Medea re-pointed (T1–T3, R4)

**Files:**
- Create: `packs/_source/class-skills/territory-creation.yml`
- Modify: `packs/_source/abilities/medea-territory-creation.yml` (deleted), `packs/_source/servants/medea.yml:29`
- Test: `test/unit/nursery.test.mjs` (create)

**Interfaces:**
- Consumes: `territoryCreationOffence` and `territoryCreationDefence` from `domain/tables.mjs` — both already exist, indexed `EX 6d20 / A 5d20 / B 5d10 / C 5d8 / D 5d6 / E 5d4` and `EX 3d10+30 / A 3d10+20 / … / E 3d10`.
- Produces: a class skill `class-territory-creation`, `parameterized: [rank]`, referenced as `{ref: class-territory-creation, rank: A}`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/nursery.test.mjs`:

```js
/**
 * @file Nursery Rhyme, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 1 of four. Pinned to the SHEET and to the documentation rather than to
 * the implementation; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const classSkill = (id) => parse(readFileSync(`packs/_source/class-skills/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("Territory Creation, promoted to a shared template (R4)", () => {
  const tc = () => classSkill("territory-creation");

  it("exists as a class skill, parameterized by rank", () => {
    expect(tc().id).toBe("class-territory-creation");
    expect(tc().parameterized).toContain("rank");
    expect(tc().rank).toBe("@rank");
  });

  it("T1 — reads the OFFENCE table rather than a literal", () => {
    // Medea's file hardcoded "5d20", which is the table's A value. That is the
    // same latent defect madEnhancementDrain had: right at one rank, wrong at
    // every other. The template must read the table.
    const rule = tc().passiveRules.find((r) => r.key === "DamageModifier");
    expect(rule.roll?.key ?? rule.table).toBe("territoryCreationOffence");
    expect(String(rule.roll?.formula ?? "")).not.toBe("5d20");
    expect(lookup("territoryCreationOffence", Rank.parse("A"))).toBe("5d20");
  });

  it("T2 — reads the DEFENCE table, as an aura with no radius", () => {
    // "While this Unit is on the field" is not a distance, so `scope: field`.
    const aura = tc().passiveRules.find((r) => r.key === "Aura");
    expect(aura.scope).toBe("field");
    expect(aura.radius).toBeUndefined();
    expect(aura.requiresRecipient).toEqual({ inHomeBase: true });
    expect(lookup("territoryCreationDefence", Rank.parse("A"))).toBe("3d10+20");
  });

  it("T3 — does not stack; the highest Rank wins", () => {
    const aura = tc().passiveRules.find((r) => r.key === "Aura");
    expect(aura.stacking).toBe("highestOnly");
    expect(aura.group).toBe("territoryCreation");
  });

  it("Medea now refs the template, and her own file is gone", () => {
    expect(servant("medea").abilities.some((a) => a.ref === "class-territory-creation")).toBe(true);
    expect(existsSync("packs/_source/abilities/medea-territory-creation.yml")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery.test.mjs`
Expected: FAIL — `ENOENT` on `packs/_source/class-skills/territory-creation.yml`.

- [ ] **Step 3: Write the template**

```yaml
# docs/B-rank-tables.md §B.3 — the Caster class skill.
#
# Promoted from `medea-territory-creation.yml`, which Nursery Rhyme's sheet
# repeats word for word: same Rank A, same dice, same non-stacking clause. The
# README's own reasoning applies — "authored once and instantiated at several
# ranks, so fixing it fixes every Servant that has it."
#
# Semiramis and Kingprotea keep their own files. Semiramis's is the EX/C
# Hanging-Gardens split Appendix D marks with an `S`; Kingprotea's is a
# different clause set. They stay as variants beside this template, exactly as
# `riding-medusa.yml` stays beside `class-riding.yml`.
#
# BOTH CLAUSES NOW READ THEIR TABLE. Medea's file hardcoded "5d20" and
# "3d10+20", which are the A row of each — right for her and wrong at every
# other rank, the same defect `madEnhancementDrain` carried when its floor was
# a literal 30.
schema: 1
id: class-territory-creation
name: "Territory Creation"
source: class
slug: territoryCreation
kind: classSkill
passive: true
copyable: { allowed: false, reason: classSkill }
parameterized: [rank]
rank: "@rank"
description: |
  (Passive 1) When this Unit is in its Home Base, all damage dealt by it is increased, including NP.
  (Passive 2) While this Unit is on the field, all damage taken by allied Units who are in their
  Home Base is further reduced, including NP.
  Note: If there are multiple allied Units with this Skill, only the Territory Creation with the
  highest Rank takes effect — it does not stack.
passiveRules:
  # Clause 1 is about the BEARER, so an ordinary predicate on her own options
  # works. "including NP" is why there is no `attack:kind` predicate: the
  # default would have been to exempt Noble Phantasms.
  - key: DamageModifier
    stage: flat
    predicate: ["self:inHomeBase"]
    roll: { key: territoryCreationOffence, table: territoryCreationOffence }

  # Clause 2 is about EVERYONE ELSE, so it is an aura -- and one with no radius,
  # because "while this Unit is on the field" is not a distance. Its condition
  # is on the RECIPIENT ("allied Units who are in THEIR Home Base"), which a
  # predicate cannot say: contributions are evaluated against the source.
  #
  # `stacking: highestOnly` is the Note, and `rules/auras.mjs` already resolves
  # it -- it is the default there, and its comment quotes Item Construction's
  # identical clause.
  - key: Aura
    scope: field
    relations: [ally, self]
    stacking: highestOnly
    group: territoryCreation
    requiresRecipient: { inHomeBase: true }
    elements:
      - key: DamageNegation
        roll: { key: territoryCreationDefence, table: territoryCreationDefence }
```

If `roll:` does not accept a `table:` beside its `key:`, read how `DamageNegation` resolves a rank table elsewhere (`grep -n "roll" module/rules/elements.mjs`) and match that spelling — the requirement is that **no dice formula is written literally in this file.**

- [ ] **Step 4: Re-point Medea and delete her copy**

```bash
git rm packs/_source/abilities/medea-territory-creation.yml
```

In `packs/_source/servants/medea.yml:29`, replace:

```yaml
  - { ref: medea-territory-creation }
```

with:

```yaml
  # Promoted to the shared class-skill template, which Nursery Rhyme's sheet
  # repeats word for word. Her file hardcoded the A row of both dice tables;
  # the template reads them.
  - { ref: class-territory-creation, rank: A }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/unit/nursery.test.mjs && npm run validate:content`
Expected: PASS, and 0 content errors.

- [ ] **Step 6: Confirm Medea did not move**

Run: `npm test`
Expected: PASS. **Every existing test must pass unchanged.** If any test mentioning Medea, auras, or Territory Creation fails, the promotion is wrong — revert it and report, rather than editing the test.

- [ ] **Step 7: Commit**

```bash
git add packs/_source/class-skills/territory-creation.yml packs/_source/servants/medea.yml test/unit/nursery.test.mjs
git commit -F - <<'MSG'
refactor(content): Territory Creation becomes a shared template, and stops lying

Nursery Rhyme's sheet repeats Medea's word for word -- same Rank A, same 5d20,
same (3d10+20), same non-stacking clause -- so it is promoted rather than
copied, on the README's own reasoning: authored once, so fixing it fixes every
Servant that has it.

The promotion fixes a latent defect on the way past. Medea's file hardcoded
"5d20" and "3d10+20", which are the A row of two tables that already exist
indexed across all six grades. That is the same shape as madEnhancementDrain's
hardcoded floor: right at one rank and wrong at every other. She is Rank A, so
her numbers happened to be right.

Semiramis and Kingprotea keep their own files -- hers is the EX/C split, his is
a different clause set -- the way riding-medusa stays beside class-riding.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

# Phase 2 — the one engine change

---

### Task 2: `CooldownDelta` reaches targets, and adds (A7, R5)

**Files:**
- Modify: `module/engine/scheduler.mjs` (the `CooldownDelta` action)
- Modify: `module/rules/authoring/elements.mjs` (register the two new fields)
- Test: `test/unit/nursery.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `CooldownDelta` accepts `target: "victim" | "self"` (default `self`) and `mode: "increase"` beside the existing reduce/set behaviour. A positive `ticks` with `mode: increase` **adds** to the remaining clock.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/nursery.test.mjs`:

```js
import { collectContributions } from "../../module/rules/elements.mjs";

describe("R5 — a cooldown clause may INCREASE somebody else's clock", () => {
  /** The action shape *A Tale for Somebody's Sake* authors. */
  const clause = {
    key: "OnEvent",
    event: "damageDealt",
    automatic: true,
    then: [{ key: "CooldownDelta", target: "victim", scope: "np", mode: "increase", ticks: "1◈" }],
  };

  const actionsOf = () => collectContributions(
    [{ id: "np", name: "A Tale", rank: "C", passiveRules: [clause] }],
    { options: new Set() },
  ).eventHandlers[0].actions;

  it("carries the target and the mode through collection", () => {
    const a = actionsOf()[0];
    expect(a.kind).toBe("CooldownDelta");
    expect(a.target).toBe("victim");
    expect(a.mode).toBe("increase");
  });

  it("adds to a clock that is already running, rather than setting it", () => {
    // THIS is the test that matters. An enemy Noble Phantasm sitting at 4<>
    // remaining must go to 5<>. `set` would put it at 1<>, which is a
    // REDUCTION -- it hands the enemy their Noble Phantasm back early, and the
    // failure is backwards rather than merely wrong.
    //
    // A test starting from a clock of 0 passes under BOTH readings and proves
    // nothing, which is why this one starts at 12.
    const intents = dispatchForTest(
      { kind: "CooldownDelta", target: "victim", scope: "np", mode: "increase", ticks: "1◈" },
      { id: "nursery" },
      { victim: { id: "foe", abilities: [{ id: "foeNP", isNP: true, cooldownRemaining: 12 }] } },
    );
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ unitId: "foe", abilityId: "foeNP", mode: "increase" });
    expect(intents[0].ticks).toBe(3);
  });

  it("still turns the BEARER's own clock when no target is named", () => {
    // Every existing use is self-directed -- "reduce Castor's NP Cooldown",
    // "reduce the Unit's NP Cooldown" -- and must not change.
    const intents = dispatchForTest(
      { kind: "CooldownDelta", scope: "np", delta: -1 },
      { id: "castor", abilities: [{ id: "tyndaridae", isNP: true, cooldownRemaining: 6 }] },
      {},
    );
    expect(intents[0]).toMatchObject({ unitId: "castor", mode: "reduce" });
  });
});
```

`dispatchForTest` is a thin export of the scheduler's action dispatch, added in Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery.test.mjs -t "INCREASE somebody"`
Expected: FAIL — `dispatchForTest is not a function`.

- [ ] **Step 3: Extend the action**

In `module/engine/scheduler.mjs`, replace the tail of `CooldownDelta`:

```js
    const ids = a.scope === "np"
      ? (u.abilities ?? []).filter((x) => x.isNP || x.categorizedAsNP).map((x) => x.id)
      : [a.ability ?? h.abilityId].filter(Boolean);

    return ids.map((id) => I.cooldown(u.id, id, Math.abs(amount), amount < 0 ? "reduce" : "set"));
```

with:

```js
    // WHOSE clock. Every clause in the corpus until now has been self-directed
    // -- "reduce Castor's NP Cooldown", "reduce the Unit's NP Cooldown" -- so
    // nothing has ever needed to reach somebody else. Nursery Rhyme's *A Tale
    // for Somebody's Sake* reaches the units her Noble Phantasm caught:
    // *"increases the NP Cooldown of all affected Units by 1◈ Turns."*
    //
    // `self` stays the default, so no existing content changes meaning.
    const subject = a.target === "victim" ? (c.victim ?? null) : u;
    if (!subject) return [];

    const ids = a.scope === "np"
      ? (subject.abilities ?? []).filter((x) => x.isNP || x.categorizedAsNP).map((x) => x.id)
      : [a.ability ?? h.abilityId].filter(Boolean);

    // ADD, rather than set. On an enemy Noble Phantasm sitting at 4◈ remaining,
    // *"increases by 1◈"* must produce 5◈ -- and `"set"` would produce 1◈,
    // which is a REDUCTION that hands the enemy their Noble Phantasm back
    // early. The failure mode is backwards rather than merely wrong, which is
    // the shape of defect this project keeps meeting.
    const mode = a.mode === "increase" ? "increase" : (amount < 0 ? "reduce" : "set");

    return ids.map((id) => I.cooldown(subject.id, id, Math.abs(amount), mode));
```

Then give the intent applier an `"increase"` arm beside `"reduce"` and `"set"`:

```bash
grep -n "\"reduce\"" module/engine/applier.mjs module/engine/io.mjs
```

and add, wherever `reduce` subtracts from `system.cooldown.remaining`, the mirror that adds.

Export the dispatcher for the test:

```js
/** @internal Exported for `test/unit/nursery.test.mjs`. */
export function dispatchForTest(action, unit, ctx) {
  return dispatch(action, unit, { source: "test", abilityId: null }, ctx);
}
```

- [ ] **Step 4: Register the fields**

Add `target` and `mode` to the `CooldownDelta` entry in `module/rules/authoring/elements.mjs`, so the authoring UI and the content validator both know them.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run lint && npm run validate:content`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add module/engine/scheduler.mjs module/engine/applier.mjs module/rules/authoring/elements.mjs test/unit/nursery.test.mjs
git commit -F - <<'MSG'
feat(engine): a cooldown clause may increase somebody else's clock

Two gaps, both in CooldownDelta, and both needed by one sentence: "increases
the NP Cooldown of all affected Units by 1<> Turns".

It turned the BEARER's clock, because every clause in the corpus until now has
been self-directed. And a positive figure SET the clock rather than adding to
it -- which on an enemy Noble Phantasm sitting at 4<> remaining produces 1<>,
a reduction that hands them the Noble Phantasm back early. Backwards rather
than merely wrong.

`self` stays the default, so nothing already authored changes meaning. The
test starts from a clock of 12 on purpose: one starting from 0 passes under
both readings and proves nothing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

# Phase 3 — her content

---

### Task 3: The three new effects (V3, E2–E4, R6)

**Files:**
- Create: `packs/_source/effects/disable.yml`, `enigma.yml`, `def-dwn-mag.yml`
- Modify: `docs/A-effect-catalogue.md`
- Test: `test/unit/nursery.test.mjs`

**Interfaces:**
- Produces: effect ids `disable`, `enigma`, `defDwnMag`.

- [ ] **Step 1: Write the failing test**

```js
const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));

describe("her three new effects", () => {
  it("R6 — Disable permits Move and nothing else", () => {
    // Appendix A: "Can only use the Move action." The complement of
    // `immobilize`, which prevents ONLY movement.
    expect(effect("disable").preventsAction).toEqual(
      expect.arrayContaining(["attack", "np", "spell", "skill"]),
    );
    expect(effect("disable").preventsAction).not.toContain("move");
  });

  it("E3/R1 — Enigma fires on HER own STR-component Normal Attack", () => {
    // Alice IS Nursery. Appendix A's row says "the bearer's ally" and is
    // wrong; correcting it is part of this task.
    const rule = effect("enigma").rules[0];
    expect(rule.key).toBe("OnEvent");
    expect(rule.event).toBe("damageDealt");
    expect(rule.predicate).toContain("attack:kind:normal");
    expect(rule.predicate).toContain("attack:component:str");
    expect(rule.target).toBe("victim");
    expect(rule.effect.id).toBe("defDwnMag");
  });

  it("E3 — and NOT on a MAG-component attack", () => {
    const rule = effect("enigma").rules[0];
    expect(testPredicate(rule.predicate, {
      options: new Set(["attack:kind:normal", "attack:component:mag"]),
    })).toBe(false);
    expect(testPredicate(rule.predicate, {
      options: new Set(["attack:kind:normal", "attack:component:str"]),
    })).toBe(true);
  });

  it("E4 — Def Dwn (MAG) raises MAG damage taken by 60%, and NP by 40%", () => {
    const rule = effect("def-dwn-mag").rules[0];
    expect(rule.key).toBe("DamageModifier");
    expect(rule.direction).toBe("taken");
    expect(rule.value).toBe("@magnitude");
    expect(rule.npValue).toBe("@npMagnitude");
    // Scoped to MAG damage. An unscoped Def Dwn is a different effect and
    // already exists; this one is the (MAG) variant, like (A) and (C).
    expect(rule.predicate).toContain("attack:component:mag");
  });

  it("E4 — and is a Def Dwn for anything that strips one", () => {
    expect(effect("def-dwn-mag").families).toContain("defDwn");
  });
});
```

with `import { test as testPredicate } from "../../module/rules/predicate.mjs";` added.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery.test.mjs -t "three new effects"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `disable.yml`**

```yaml
# Appendix A §A — catalogued since it was written, authored by nothing until
# Nursery Rhyme's *Plains of Winter*.
#
# The complement of `immobilize`: that one prevents ONLY movement, this one
# prevents everything EXCEPT movement. `rules/budget.mjs#preventedBy` reads the
# list, and already carries `disable` in its PREVENTS table -- so this document
# is what lets one arrive.
schema: 1
id: disable
name: "Disable"
description: "Can only use the Move action."
polarity: debuff
volatility: volatile
valence: offensive
stacking: noneRefresh
baseChance: 100
severity: normal
preventsAction: [attack, np, spell, skill, gather, mark]
```

Check `rules/budget.mjs`'s `PREVENTS` table for the exact action names before writing the list — `grep -n "disable" module/rules/budget.mjs` — and match it rather than inventing names.

- [ ] **Step 4: Write `def-dwn-mag.yml`**

```yaml
# Appendix A §A.9 — referenced by the `Enigma` row and never given a row of its
# own. The fourth Def Dwn variant, beside (A), (B) and (C).
#
# A DISTINCT effect, not a stronger Def Dwn: the parenthesis names what is
# scoped, and content that strips "one Def Dwn" must be able to take this one
# without taking an unscoped one instead.
schema: 1
id: defDwnMag
name: "Def Dwn (MAG)"
description: "All MAG damage taken is increased by X%; a reduced magnitude applies to Noble Phantasms."
polarity: debuff
volatility: nonVolatile
valence: defensive
stacking: magnitudeStacks
baseChance: 100
families: [defDwn]
rules:
  # Scoped to MAG damage by an attack-time predicate -- the same axis Karna's
  # fire resistance and Anastasia's Swimsuit! read.
  - key: DamageModifier
    modifierKey: defDwn
    direction: taken
    value: "@magnitude"
    npValue: "@npMagnitude"
    predicate: ["attack:component:mag"]
```

- [ ] **Step 5: Write `enigma.yml`**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# SELF-ONLY. Her sheet: *"Applies the 'Enigma' buff to Nursery... Whenever
# Alice performs a Normal Attack which deals STR damage, Nursery inflicts the
# Def Dwn (MAG) debuff for 1◈ Turns on the DU."* Alice IS Nursery -- her True
# Name is "Nursery Rhyme, Alice", the sheet labels her Skills (Alice) and her
# last Noble Phantasm (Nursery), and the two names alternate throughout.
#
# Appendix A's own `Enigma` row said *"when the bearer's ALLY performs"* and
# was wrong; it lost the Alice/Nursery identity, and this task corrects it.
#
# The self reading is also the one that makes her coherent. Her Note pins her
# Normal Attacks to BA(STR) 50 while her Noble Phantasm swings BA(MAG) 200 --
# and this is what makes the feeble swing worth taking, because the Def Dwn
# (MAG) it plants raises MAG damage taken by 60%.
schema: 1
id: enigma
name: "Enigma"
description: |
  Whenever the affected Unit performs a Normal Attack which deals STR damage, it inflicts
  @effect[defDwnMag]{Def Dwn (MAG)} for 1◈ Turns on the DU.
polarity: buff
volatility: nonVolatile
valence: offensive
stacking: noneRefresh
baseChance: 100
rules:
  # `damageDealt` fires on the ATTACKER with the victim in `ctx.victim`, which
  # is the rung every "Normal Attacks inflict X on the DU" clause hangs from.
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: ["attack:kind:normal", "attack:component:str"]
    target: victim
    effect: { id: defDwnMag }
    duration: "1◈"
    magnitude: 60
    npMagnitude: 40
```

- [ ] **Step 6: Correct Appendix A**

The `Enigma` row currently reads *"When the bearer's **ally** performs a STR-component Normal
Attack…"*. Change `ally` to the bearer itself, and add a note below the table in the voice the
`Blind` and `Deafen` notes use, recording that the row lost the Alice/Nursery identity and that her
sheet is the authority. Add a `Def Dwn (MAG)` row beside `(A)`, `(B)` and `(C)`, and mark `Disable`
built.

- [ ] **Step 7: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/effects/disable.yml packs/_source/effects/def-dwn-mag.yml packs/_source/effects/enigma.yml docs/A-effect-catalogue.md test/unit/nursery.test.mjs
git commit -F - <<'MSG'
feat(content): Disable, Def Dwn (MAG) and Enigma

Enigma is SELF-ONLY, and Appendix A's own row -- which credits Nursery Rhyme
by name -- said "the bearer's ally" and was wrong. Alice IS Nursery: her True
Name is "Nursery Rhyme, Alice", and the sheet alternates the two names
throughout. The row is corrected here.

The self reading is the one that makes her coherent. Her Note pins her Normal
Attacks to BA(STR) 50 while her Noble Phantasm swings BA(MAG) 200, and Enigma
is what makes the feeble swing worth taking -- the Def Dwn (MAG) it plants
raises MAG damage taken by 60%.

Def Dwn (MAG) had been referenced by that row and never given a row of its own.
Disable is the complement of immobilize: everything except movement.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 4: The three passive/active Skills (M1–M3, H1, W1–W4)

**Files:**
- Create: `packs/_source/abilities/nursery-self-modification.yml`, `-shapeshift.yml`, `-meanwhile.yml`

- [ ] **Step 1: Write the failing test**

```js
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

describe("her three simpler Skills", () => {
  it("M1/M2 — Self-Modification is a passive AND an active", () => {
    const a = ability("nursery-self-modification");
    expect(a.rank).toBe("A");
    expect(a.cooldown).toBe("4◈");
    const passive = a.passiveRules.find((r) => r.key === "CritModifier");
    expect(passive).toMatchObject({ aspect: "damage", value: 40 });
    const buff = a.phases[0].effects[0];
    expect(buff).toMatchObject({ id: "critUp", magnitude: 60, duration: "1◈" });
  });

  it("H1 — Shapeshift is a Ward, not a Def Up", () => {
    // Nothing applies it and nothing can strip it: it is a passive property of
    // the Servant, and a Def Up is an effect somebody put there.
    const rule = ability("nursery-shapeshift").passiveRules[0];
    expect(rule.key).toBe("Ward");
    expect(rule.value).toBe(30);
    expect(rule.npValue).toBe(15);
  });

  it("W1–W4 — Meanwhile turns her clock, heals a fraction, and cleanses", () => {
    const a = ability("nursery-meanwhile");
    expect(a.cooldown).toBe("4◈");
    const cd = a.phases.find((p) => p.rules)?.rules[0];
    expect(cd).toMatchObject({ key: "CooldownDelta", scope: "np", ticks: "1◈+⅓◈" });
    const heal = a.phases.find((p) => p.kind === "heal");
    expect(heal.percentOfMax).toBe(15);
    const strip = a.phases.find((p) => p.kind === "removeEffect");
    expect(strip.selector).toMatchObject({ polarity: "debuff" });
  });

  it("W1 — and that cooldown expression parses", () => {
    expect(parseTick("1◈+⅓◈").kind).toBe("rounds");
  });
});
```

with `import { parseTick } from "../../module/domain/tick.mjs";` added.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery.test.mjs -t "three simpler Skills"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `nursery-self-modification.yml`**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
schema: 1
id: nursery-self-modification
name: "Self-Modification"
rank: A
kind: skill
slug: selfModification
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Passive) Crit Damage dealt is increased by 40%.
  (Active) Used during your Turn. Applies @effect[critUp]{Crit Up} for 1◈ Turns, Crit Chance is increased by 60%.
  Cooldown: 4◈ Turns.
passiveRules:
  - key: CritModifier
    aspect: damage
    value: 40
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: critUp, duration: "1◈", magnitude: 60 }
```

- [ ] **Step 4: Write `nursery-shapeshift.yml`**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
schema: 1
id: nursery-shapeshift
name: "Shapeshift"
rank: "A+"
kind: skill
slug: shapeshift
passive: true
description: |
  (Passive) All damage taken is reduced by 30%; if NP, 15%.
passiveRules:
  # A `Ward`, not a `Def Up`. A Def Up is an EFFECT somebody applied and
  # somebody else can strip; this is a property of the Servant that nothing
  # applied and nothing can remove. Both land in the same stage-4 bucket, which
  # keeps them additive the way §13.4 requires.
  - key: Ward
    value: 30
    npValue: 15
```

- [ ] **Step 5: Write `nursery-meanwhile.yml`**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
schema: 1
id: nursery-meanwhile
name: "Meanwhile…"
rank: A
kind: skill
slug: meanwhile
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Reduces NP Cooldown by 1◈+⅓◈ Turns.
  2. Restores Nursery's Health by 15% of its maximum value.
  3. Remove all debuffs from Nursery.
  Cooldown: 4◈ Turns.
phases:
  - kind: applyEffects
    target: self
    rules:
      # `ticks`, not `delta`: "1◈+⅓◈" is a ◈ expression, and the tick parser
      # takes the `a◈ ± b/c◈` family natively.
      - { key: CooldownDelta, scope: np, ticks: "1◈+⅓◈" }
  - kind: heal
    target: self
    percentOfMax: 15
  # "Remove ALL debuffs" -- selected by polarity rather than named one by one,
  # so a debuff authored later is covered without touching this file.
  - kind: removeEffect
    target: self
    selector: { polarity: debuff }
```

Confirm `removeEffect`'s selector spelling against `module/engine/attack.mjs#removalIntents` and
`medea-rule-breaker.yml`, and match whichever the corpus already uses.

- [ ] **Step 6: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/nursery-self-modification.yml packs/_source/abilities/nursery-shapeshift.yml packs/_source/abilities/nursery-meanwhile.yml test/unit/nursery.test.mjs
git commit -F - <<'MSG'
feat(content): Self-Modification, Shapeshift and Meanwhile

Shapeshift is a Ward rather than a Def Up, and the distinction is the point: a
Def Up is an effect somebody applied and somebody else can strip, and this is a
property of the Servant. Both land in the same stage-4 bucket, so they stay
additive the way s13.4 requires.

Meanwhile removes debuffs by POLARITY rather than by name, so a debuff authored
later is covered without touching the file.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 5: Tommy Thumb's Secret Picture Book (P1–P7)

**Files:**
- Create: `packs/_source/abilities/nursery-tommy-thumb.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("Tommy Thumb's Secret Picture Book (P1–P7)", () => {
  const a = () => ability("nursery-tommy-thumb");

  it("P7 — carries the cooldown her sheet prints", () => {
    expect(a().rank).toBe("A+");
    expect(a().cooldown).toBe("4◈-⅓◈");
  });

  it("P1–P4 — four self effects, with their stated figures", () => {
    const self = a().phases.find((p) => p.target === "self" && p.effects);
    const e = self.effects;
    expect(e.find((x) => x.id === "atkUp")).toMatchObject({ magnitude: 30, npMagnitude: 20, duration: "1◈" });
    expect(e.find((x) => x.id === "defUp")).toMatchObject({ magnitude: 30, npMagnitude: 15, duration: "1◈" });
    expect(e.find((x) => x.id === "dmgCut")).toMatchObject({ magnitude: 30, duration: "⅓◈" });
    expect(e.find((x) => x.id === "debuffResUp")).toMatchObject({ magnitude: 40, duration: "1◈" });
  });

  it("P1 — and restores 3 Luck", () => {
    const stat = a().phases.find((p) => p.kind === "statChange");
    expect(stat.changes[0]).toMatchObject({ stat: "luck", delta: 3, clamp: true });
  });

  it("P5 — the Child clause reaches allies within 2 with that Attribute", () => {
    const phase = a().phases.find((p) => p.rules?.[0]?.key === "CooldownDelta");
    expect(phase.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(phase.targeting.selection.relations).toContain("ally");
    expect(phase.targeting.selection.predicate).toContain("target:attribute:child");
    expect(phase.rules[0]).toMatchObject({ scope: "np", ticks: "⅔◈" });
  });

  it("P6 — the Fairytale clause reaches a DIFFERENT set", () => {
    const phase = a().phases.find((p) => p.effects?.[0]?.id === "npDmUp");
    expect(phase.targeting.selection.predicate).toContain("target:attribute:fairytale");
    expect(phase.effects[0]).toMatchObject({ magnitude: 20, duration: "1◈" });
  });

  it("P5/P6 — and she carries BOTH tags, so both reach her", () => {
    const attrs = servant("nursery-rhyme").attributes;
    expect(attrs).toContain("child");
    expect(attrs).toContain("fairytale");
  });
});
```

The last `it` depends on Task 7; if it is run before Task 7 exists it will fail on `ENOENT`, which
is correct — it is the test that pins the two clauses to her own Attribute list.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery.test.mjs -t "Tommy Thumb"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write it**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# SIX effects reaching THREE different sets: four on herself, one on `Child`
# allies within 2 panels, one on `Fairytale` allies within 2 panels. Each of the
# latter two states its own targeting rather than reusing the ability's --
# defaulting to `reuse` would give every clause the same recipients, which is
# the hole five authored Noble Phantasms shipped with.
#
# She carries BOTH tags herself, so both party clauses reach her too.
schema: 1
id: nursery-tommy-thumb
name: "Tommy Thumb's Secret Picture Book"
rank: "A+"
kind: skill
slug: tommyThumb
cooldown: "4◈-⅓◈"
timing: { window: ownTurn }
description: |
  (Active) Used during your Turn. Has the following effects-
  1. Restores 3 Luck and applies @effect[atkUp]{Atk Up} for 1◈ Turns, all damage dealt is increased by 30%;
     if NP, 20%.
  2. Applies @effect[defUp]{Def Up} for 1◈ Turns, all damage taken is reduced by 30%; if NP, 15%.
  3. Applies @effect[dmgCut]{Dmg Cut} for ⅓◈ Turns, all damage taken is reduced by 30 including NP.
  4. Applies @effect[debuffResUp]{Debuff ResUp} for 1◈ Turns, chance of being inflicted with debuffs is reduced
     by 40%.
  5. Reduce the NP Cooldown of all allied Units within a 2 panel area of herself with the 'Child'
     Attribute by ⅔◈ Turns.
  6. Applies @effect[npDmUp]{NP DmUp} for 1◈ Turns to all allied Units within a 2 panel area of herself with
     the 'Fairytale' Attribute, NP Damage dealt is increased by 20%.
  Cooldown: 4◈-⅓◈ Turns.
phases:
  # Clause 1's first half.
  - kind: statChange
    target: self
    changes:
      - { stat: luck, delta: 3, clamp: true }
  # Clauses 1-4, all on her.
  - kind: applyEffects
    target: self
    effects:
      # "if NP, 20%" -- an ABSOLUTE NP figure, because the sheet states both and
      # 20 is not half of 30.
      - { id: atkUp, duration: "1◈", magnitude: 30, npMagnitude: 20 }
      - { id: defUp, duration: "1◈", magnitude: 30, npMagnitude: 15 }
      # "reduced by 30 INCLUDING NP" -- a flat figure with no NP variant, which
      # is what Dmg Cut is for.
      - { id: dmgCut, duration: "⅓◈", magnitude: 30 }
      - { id: debuffResUp, duration: "1◈", magnitude: 40 }
  # Clause 5 -- the `Child` set.
  - kind: applyEffects
    targeting:
      anchor: { kind: self }
      shape: { kind: chebyshevRadius, r: 2 }
      selection:
        relations: [ally, self]
        includeSelf: true
        chooser: all
        predicate: ["target:attribute:child"]
    rules:
      - { key: CooldownDelta, scope: np, ticks: "⅔◈" }
  # Clause 6 -- the `Fairytale` set, which is not the same set.
  - kind: applyEffects
    targeting:
      anchor: { kind: self }
      shape: { kind: chebyshevRadius, r: 2 }
      selection:
        relations: [ally, self]
        includeSelf: true
        chooser: all
        predicate: ["target:attribute:fairytale"]
    effects:
      - { id: npDmUp, duration: "1◈", magnitude: 20 }
```

If `selection.predicate` is not the spelling the resolver reads for a per-target filter, check
`module/rules/targeting/resolve.mjs` for how Jack's `target:attribute:female` clauses are selected
and match that — the requirement is that the two clauses reach **different** sets.

- [ ] **Step 4: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/nursery-tommy-thumb.yml test/unit/nursery.test.mjs
git commit -F - <<'MSG'
feat(content): Tommy Thumb's Secret Picture Book

Six effects reaching THREE different sets: four on her, one on Child allies
within 2 panels, one on Fairytale allies within 2. Each party clause states its
own targeting rather than reusing the ability's -- defaulting to reuse would
give every clause the same recipients, which is the hole five authored Noble
Phantasms shipped with.

She carries both tags herself, so both party clauses reach her too, and the
test pins that to her own Attribute list rather than assuming it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 6: The three Spells (V1–V4, F1–F4, E1–E2, R2)

**Files:**
- Create: `packs/_source/abilities/nursery-plains-of-winter.yml`, `-frenzied-march-hare.yml`, `-white-queens-enigma.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("her three Spells", () => {
  it("R2 — both damage Spells deal 1x BA(MAG)", () => {
    // "Deals damage" states neither component nor multiplier. Scathach's Thurs
    // settles the component in its own comment -- "A Caster's Spell draws on
    // Base Attack (MAG)" -- and the multiplier is 1 because none is stated;
    // Thurs states its 2 explicitly, so the silence is meaningful.
    for (const id of ["nursery-plains-of-winter", "nursery-frenzied-march-hare"]) {
      const a = ability(id);
      expect(a.isSpell).toBe(true);
      expect(a.damage.component).toBe("mag");
      expect(a.damage.multiplier ?? 1).toBe(1);
      expect(a.cooldown).toBe("2◈");
    }
  });

  it("V3/V4 — Plains of Winter is Ice, with a 50% Disable", () => {
    const a = ability("nursery-plains-of-winter");
    expect(a.damage.element).toBe("ice");
    const rider = a.phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(rider).toMatchObject({ id: "disable", chance: 50, duration: "1◈" });
  });

  it("F3/F4 — Frenzied March Hare is Wind, with a 50% Sap", () => {
    const a = ability("nursery-frenzied-march-hare");
    expect(a.damage.element).toBe("wind");
    const rider = a.phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(rider).toMatchObject({ id: "sap", chance: 50, duration: "1◈" });
  });

  it("E1/E2 — White Queen's Enigma is a non-damaging Spell that buffs her", () => {
    const a = ability("nursery-white-queens-enigma");
    expect(a.isSpell).toBe(true);
    expect(a.cooldown).toBe("3◈");
    // An ability with phases and no `damage` phase deals none.
    expect(a.phases.some((p) => p.kind === "damage")).toBe(false);
    const phase = a.phases[0];
    expect(phase.target).toBe("self");
    expect(phase.effects[0]).toMatchObject({ id: "enigma", duration: "1◈" });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery.test.mjs -t "three Spells"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write `nursery-plains-of-winter.yml`**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# "Deals damage" states neither a component nor a multiplier. Scáthach's Thurs
# settles the component in its own comment -- *"A Caster's Spell draws on Base
# Attack (MAG)"* -- and the multiplier is 1 because none is stated: Thurs states
# its own 2 explicitly, so the silence here is meaningful.
schema: 1
id: nursery-plains-of-winter
name: "Plains of Winter"
kind: skill
slug: plainsOfWinter
isSpell: true
element: ice
cooldown: "2◈"
timing: { window: ownTurn }
description: |
  Damage Spell. Deals damage with a 50% chance of inflicting @effect[disable]{Disable} for 1◈ Turns.
  Ice damage. Cooldown: 2◈ Turns.
targeting:
  anchor: { kind: targetUnit, range: 2 }
  shape: { kind: unit }
  selection: { relations: [enemy], chooser: chosen, count: 1 }
damage:
  base:
    sources:
      - { unit: self, component: mag, factor: 1 }
  component: mag
  multiplier: 1
  element: ice
phases:
  - kind: damage
  - kind: applyEffects
    target: reuse
    effects:
      - { id: disable, duration: "1◈", chance: 50 }
```

- [ ] **Step 4: Write `nursery-frenzied-march-hare.yml`**

Identical to Step 3 except `id: nursery-frenzied-march-hare`, `name: "Frenzied March Hare"`,
`slug: frenziedMarchHare`, `element: wind` in **both** places, the description naming
`@effect[sap]{Sap}` and Wind, and the rider reading `{ id: sap, duration: "1◈", chance: 50 }`.

- [ ] **Step 5: Write `nursery-white-queens-enigma.yml`**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# A NON-DAMAGING Spell: it has phases and no `damage` phase, which is how an
# ability deals none (`engine/attack.mjs#dealsNoDamage`).
#
# The buff it applies is SELF-ONLY (R1). See `enigma.yml` for why Appendix A's
# row was wrong about that.
schema: 1
id: nursery-white-queens-enigma
name: "White Queen's Enigma"
kind: skill
slug: whiteQueensEnigma
isSpell: true
cooldown: "3◈"
timing: { window: ownTurn }
description: |
  Spell. Used during your Turn. Applies the '@effect[enigma]{Enigma}' buff to Nursery for 1◈ Turns. Its effects
  are as follows- Whenever Alice performs a Normal Attack which deals STR damage, Nursery inflicts
  the @effect[defDwnMag]{Def Dwn (MAG)} debuff for 1◈ Turns on the DU, all MAG damage taken is increased by 60%;
  if NP, 40%. Cooldown: 3◈ Turns.
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: enigma, duration: "1◈" }
```

- [ ] **Step 6: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/nursery-plains-of-winter.yml packs/_source/abilities/nursery-frenzied-march-hare.yml packs/_source/abilities/nursery-white-queens-enigma.yml test/unit/nursery.test.mjs
git commit -F - <<'MSG'
feat(content): her three Spells

Both damage Spells deal 1x BA(MAG). "Deals damage" states neither component
nor multiplier; Scathach's Thurs settles the component in its own comment and
states its own multiplier of 2 explicitly, so the silence here means 1.

White Queen's Enigma is non-damaging -- phases with no damage phase -- and the
buff it plants is self-only.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 7: A Tale for Somebody's Sake, and the Servant (A1–A8, S1–S12)

**Files:**
- Create: `packs/_source/abilities/nursery-a-tale-for-somebodys-sake.yml`, `packs/_source/servants/nursery-rhyme.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("Nursery Rhyme: A Tale for Somebody's Sake (A1–A8)", () => {
  const np = () => ability("nursery-a-tale-for-somebodys-sake");

  it("A1/A2/A8 — Rank C, Anti-Unit, Range 4, cooldown 5◈", () => {
    expect(np()).toMatchObject({ rank: "C", isNP: true, cooldown: "5◈" });
    expect(np().npTags).toEqual(["antiUnit"]);
    expect(np().targeting.anchor.range).toBe(4);
  });

  it("A3/A4/A5 — BA(MAG), a 3x3 area, 3x damage", () => {
    expect(np().damage.component).toBe("mag");
    expect(np().damage.multiplier).toBe(3);
    expect(np().targeting.shape).toEqual({ kind: "rect", w: 3, h: 3 });
  });

  it("A6 — inflicts Def Dwn at +20% for 1◈", () => {
    const e = np().phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(e).toMatchObject({ id: "defDwn", magnitude: 20, duration: "1◈" });
  });

  it("A7/R5 — INCREASES the affected Units' NP Cooldown by 1◈", () => {
    const rule = np().phases.find((p) => p.rules)?.rules[0];
    expect(rule).toMatchObject({
      key: "CooldownDelta", target: "victim", scope: "np", mode: "increase", ticks: "1◈",
    });
  });
});

describe("the Servant document (S1–S12)", () => {
  const n = () => servant("nursery-rhyme");

  it("S6/S9/S10 — her figures agree with the rank tables", () => {
    expect(baseAttackFor(n())).toEqual({ str: 50, mag: 200 });
    expect(n().baseHealth).toBe(500);
    expect(lookup("baseHealthByEnd", Rank.parse("E"))).toBe(500);
  });

  it("S12/R3 — the Note: her Normal Attacks use BA(STR)", () => {
    // The axis her whole kit turns on. 50 against her Noble Phantasm's 200.
    expect(n().normalAttack).toMatchObject({ mode: "fixed", component: "str" });
    const spec = normalAttackAt({ normalAttack: n().normalAttack }, 2);
    expect(spec.sources).toEqual([{ unit: "self", component: "str", factor: 1 }]);
  });

  it("S5 — carries all seven Attributes, including both tags her own kit reads", () => {
    expect(n().attributes.sort()).toEqual(
      ["child", "fairytale", "female", "humanoid", "man", "nonHominidae", "servant"].sort(),
    );
  });

  it("S11 — Sustainability 4◈", () => {
    expect(n().sustainability).toBe("4◈");
  });

  it("refs Territory Creation at Rank A, through the shared template", () => {
    expect(n().abilities).toContainEqual({ ref: "class-territory-creation", rank: "A" });
  });

  it("carries exactly the nine abilities Part 1 authors", () => {
    // One class skill + four Skills + three Spells + one Noble Phantasm.
    // Parts 2-4 append four more, taking this to 13. This assertion is what
    // makes that an append rather than a rewrite.
    expect(n().abilities).toHaveLength(9);
  });
});
```

with `import { baseAttackFor } from "../../module/domain/base-attack.mjs";` and
`import { normalAttackAt } from "../../module/rules/normal-attack.mjs";` added.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery.test.mjs -t "A Tale"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the Noble Phantasm**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# Her only damaging Noble Phantasm in Part 1, and the one that pays off her
# Note: BA(MAG) 200 at 3x, against a Normal Attack of 50.
schema: 1
id: nursery-a-tale-for-somebodys-sake
name: "Nursery Rhyme: A Tale for Somebody's Sake"
rank: C
isNP: true
categorizedAsNP: true
npTags: [antiUnit]
kind: noblePhantasm
cooldown: "5◈"
timing: { window: ownTurn }
description: |
  Range=4. Base Attack (MAG) is used. Hits a 3x3 panel area within Range for 3x damage. Then,
  inflicts @effect[defDwn]{Def Dwn} for 1◈ Turns, all damage taken is increased by 20%, and increases the NP
  Cooldown of all affected Units by 1◈ Turns. Cooldown: 5◈ Turns.
targeting:
  anchor: { kind: targetPanel, range: 4 }
  shape: { kind: rect, w: 3, h: 3 }
  selection: { relations: [enemy], chooser: all }
damage:
  base:
    sources:
      - { unit: self, component: mag, factor: 1 }
  component: mag
  multiplier: 3
phases:
  - kind: damage
  - kind: applyEffects
    target: reuse
    effects:
      - { id: defDwn, duration: "1◈", magnitude: 20 }
  # *"increases the NP Cooldown of all affected Units by 1◈ Turns."*
  #
  # `target: victim` and `mode: increase` are both new (Task 2). The mode is the
  # load-bearing half: a `set` would put an enemy Noble Phantasm sitting at 4◈
  # remaining down to 1◈, which is a REDUCTION and hands them the Noble Phantasm
  # back early.
  - kind: applyEffects
    target: reuse
    rules:
      - { key: CooldownDelta, target: victim, scope: np, mode: increase, ticks: "1◈" }
```

Confirm `anchor: {kind: targetPanel}` is the anchor a 3×3-within-range uses — check
`ozymandias-dendera-electric-bulb-area.yml` or another placed area and match it.

- [ ] **Step 4: Write the Servant**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# PART 1 OF 4. Four more ability refs arrive with the summons (Trump Soldiers,
# Jabberwock), the token economy (Nameless Forest) and the rewind (The Queen's
# Glass Game). The list below is written so those are an append.
schema: 1
id: nursery-rhyme
name: "Nursery Rhyme"
type: servant
trueName: "Nursery Rhyme, Alice"
servantClasses: [caster]
classContainer: caster
region: [england, europe]
alignment: { order: true, morality: neutral }
# `fairytale` and `child` are new tags and need no schema change -- `attributes`
# is an open set (Ch. 04 §4.5). Both are read by her OWN Tommy Thumb clauses 5
# and 6, so a typo in either makes two of her clauses reach nobody, herself
# included.
attributes: [female, servant, man, humanoid, fairytale, nonHominidae, child]
parameters: { str: E, end: E, agi: C, mag: A, luc: B }
# Every figure agrees with the tables: END E -> 500, STR E -> 50, MAG A -> 200.
baseHealth: 500
mov: 4
range: { panels: 2, targets: 1 }
baseAttack: { str: 50, mag: 200 }
sustainability: "4◈"

# THE NOTE, and the axis her whole kit turns on. *"Nursery's Normal Attacks use
# Base Attack (STR)"* -- 50, against the 200 her Noble Phantasm swings. Van Gogh
# is the mirror case, forced onto MAG. Enigma exists to make this swing worth
# taking.
normalAttack: { mode: fixed, component: str }

abilities:
  - { ref: class-territory-creation, rank: A }
  - { ref: nursery-self-modification }
  - { ref: nursery-shapeshift }
  - { ref: nursery-tommy-thumb }
  - { ref: nursery-meanwhile }
  - { ref: nursery-plains-of-winter }
  - { ref: nursery-frenzied-march-hare }
  - { ref: nursery-white-queens-enigma }
  - { ref: nursery-a-tale-for-somebodys-sake }
```

**Note the count.** That list is **nine** refs — one class skill, four Skills, three Spells, one
Noble Phantasm — and Task 7 Step 1's test asserts nine. Before moving on, confirm every one of them
**resolves**: `npm run validate:content` reports an unresolved `ref` as an error, and a typo in an
ability id is the single most likely mistake in this file.

- [ ] **Step 5: Validate, test, build**

```bash
npm run validate:content
npm test
npm run lint
```

`validate:content` must report **no Base Attack deviation** for her.

- [ ] **Step 6: Commit**

```bash
git add packs/_source/abilities/nursery-a-tale-for-somebodys-sake.yml packs/_source/servants/nursery-rhyme.yml test/unit/nursery.test.mjs
git commit -F - <<'MSG'
feat(content): Nursery Rhyme, and A Tale for Somebody's Sake

Part 1 of four. Her Note is the axis the whole kit turns on: Normal Attacks
use BA(STR) 50 while this Noble Phantasm swings BA(MAG) 200 at 3x, and Enigma
exists to make the feeble swing worth taking.

A Tale is the first ability in the corpus to INCREASE somebody else's cooldown
rather than its own.

`fairytale` and `child` are new attribute tags, and load-bearing for her own
kit: Tommy Thumb's clauses 5 and 6 read them, and she carries both, so a typo
in either makes two of her clauses reach nobody including herself.

Four more ability refs arrive with Parts 2 to 4.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 8: Documentation and the live board

**Files:**
- Modify: `docs/D-servant-data-sheets.md`, `docs/B-rank-tables.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Document**

- **Appendix D** — a Nursery Rhyme entry recording that Part 1 is built and Parts 2–4 are not, that
  her figures agree with the tables, and that her Note is the kit's axis.
- **Appendix B §B.3** — record that `territoryCreationOffence` / `territoryCreationDefence` now have
  a shared template reading them, and that Medea's literals are gone.
- **Ch. 45** — Servant count from 12 to 13, noting **Part 1 of 4**.
- **`CHANGELOG.md`** — an `## [Unreleased]` entry naming the Enigma correction, the Territory
  Creation promotion and the `CooldownDelta` gap.
- **`README.md`** — the authored-Servant count and the test count.

- [ ] **Step 2: Bring the world up**

```bash
node tools/fgt-world.mjs shutdown
npm run build:packs
node tools/fgt-world.mjs launch
```

Then join as Gamemaster over CDP. Launch fails with no Foundry tab open — open one first.

- [ ] **Step 3: Confirm she compiled with her fields intact**

Read her out of the compendium and check `normalAttack`, `attributes` (all seven), `sustainability`,
and all nine ability refs survived the build. **This is where the last two allowlist defects were
caught.**

- [ ] **Step 4: Walk the inventory**

Every clause gets an observation, not an inference.

- [ ] **S12/R3** — a Normal Attack card showing **50**, not 200.
- [ ] **T1** — her damage card carrying a `5d20` line while she stands in her Home Base, and **not** carrying it when she steps out.
- [ ] **T2** — an ally in *their* Home Base taking `(3d10+20)` less while she is on the field.
- [ ] **T3** — a second Territory Creation bearer not stacking with her.
- [ ] **M2** — Crit Up at +60% on her sheet after Self-Modification.
- [ ] **P5/P6** — *Tommy Thumb* reaching a `Child` ally and a `Fairytale` ally **differently**, and reaching her for both.
- [ ] **W3** — *Meanwhile* stripping a debuff she is carrying.
- [ ] **V3** — a Disabled enemy able to Move and unable to Attack.
- [ ] **E3/R1** — *Enigma* planting `Def Dwn (MAG)` after her STR swing, and **not** after a MAG one.
- [ ] **A4/A5** — *A Tale* hitting a 3×3 for 3× off BA(MAG) 200.
- [ ] **A7/R5** — a caught enemy's Noble Phantasm cooldown going **up**, from whatever it was.

- [ ] **Step 5: Fix what the board disagrees with**

Any clause that misbehaves is a bug in this implementation, not in the sheet. Fix it, add the unit
test that would have caught it, and re-verify.

- [ ] **Step 6: Final commit**

```bash
npm test && npm run lint && npm run validate:content
git add -A
git commit -F - <<'MSG'
test(content): Nursery Rhyme part 1, verified on a live board

Every clause of the inventory observed rather than inferred. [Record here what
the board disagreed with, and what was fixed.]

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

## Self-review notes

**Spec coverage.** §3 rulings: R1 Task 3; R2 Task 6; R3 Tasks 7/8; R4 Task 1; R5 Tasks 2/7; R6 Task 3. §6 inventory: the 12 FREE clauses are verified in Task 8; the ~29 CONTENT clauses land in Tasks 3–7; the 1 ENGINE clause is Task 2; the 3 new effects are Task 3; the refactor is Task 1.

**Type consistency.** `class-territory-creation` is named identically in Tasks 1, 7 and their tests. `dispatchForTest(action, unit, ctx)` is defined in Task 2 and used only there. Effect ids `disable`, `enigma`, `defDwnMag` are each defined once in Task 3 and referenced under the same spelling in Tasks 6 and 7.

**One count checked rather than asserted from memory.** Task 7's ability list is nine refs — one class skill, four Skills, three Spells, one Noble Phantasm — and its test asserts nine. The same off-by-one crept into two previous specs' file counts and was caught only in self-review, so this one was recounted against the task list that authors each file: Task 1 (1), Task 4 (3), Task 5 (1), Task 6 (3), Task 7 (1).

**Three spellings deliberately left to their task, each with a stated check:** `roll:` + `table:` on a `DamageNegation` (Task 1 Step 3), `removeEffect`'s selector (Task 4 Step 5), `selection.predicate` for a per-target attribute filter (Task 5 Step 3), and `targetPanel` as a placed-area anchor (Task 7 Step 3). Each names the file to compare against. None may be guessed.
