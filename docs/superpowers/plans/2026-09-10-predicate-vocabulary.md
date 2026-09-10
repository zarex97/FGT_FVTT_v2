# Predicate Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the predicate grammar from a free string into a described vocabulary — so a GM builds `self:stance:dismounted` from three dropdowns, the build rejects a term no facet admits, and a failed predicate reads as prose in the audit trail.

**Architecture:** A pure Layer-2 facet table (`module/rules/facets.mjs`) becomes the **authority**, and `options.mjs`'s `EMITTABLE` regexes are **generated** from it. Unlike the four vocabularies already built, whose authority is a dispatcher made of functions, this authority is already pure data — so there is one declaration rather than two spellings held together by a test. The table then also feeds the editor's row builder and `predicate.mjs#explain`.

**Tech Stack:** Plain ESM, Foundry ApplicationV2 + Handlebars, Vitest, Sass. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-predicate-vocabulary-design.md`

**Prerequisites (both merged):**
- `2026-09-10-timing-window-authority.md`
- `2026-09-10-ability-editor.md` — this plan extends `module/rules/authoring/` and the editor's `predicateList` field type, both of which that plan creates.

## Global Constraints

- **Layer rule:** `module/rules/` is Layer 2 — pure, no `game`/`canvas`/`ui`/`foundry` globals, no imports from `module/engine/` or `module/apps/`. `npm run lint` runs `tools/check-layers.mjs`.
- **Localization:** every user-facing string is a key in `lang/en.json`; the English lives beside the descriptor as `english`, and a test holds the two together. **D29.15 — no key may be the prefix of another.** The `<id>Hint` suffix carries no dot for exactly this reason.
- **`registry` value kinds WARN, they never error.** A content vocabulary still being written must be able to name what is coming: `outsider` and `undead` are referenced by six clauses and granted by no unit yet. Only `closed` kinds error.
- **Docs travel with the commit.** Chapter 45 alone is never enough.
- **Commit trailers** (every commit):
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
  ```
- **Full verification before any completion claim:** `npm test && npm run lint && npm run validate:content && npm run check:templates`.

---

## Background an executor needs

**Read the spec first.** In particular §1.1 — more exists than you would guess. `options.mjs`
already exports `isEmittableOption()` backed by 37 `EMITTABLE` regexes, and
`test/unit/options.test.mjs` already holds *rule-element* predicates against it. You are extending
a guard, not creating one.

**The measurements this plan is built on**, all taken from `packs/_source` (336 files):

| | |
|---|---|
| Predicate option references | **236** |
| …guarded today (rule elements only) | 147 |
| …**unguarded** | **89** |
| Facets in `EMITTABLE` | 37 |
| …bare flags, no value | 9 |
| …value fully constrained | 7 |
| …**carrying a free identifier** | **21** |
| Operators used by content | `not` 24, `or` 15, `anyOf` 6, `nor` 1 |
| Comparison operators used | **0** — but the corpus is 29 Servants short |

**Three fields named like predicates that are not:**

- `chanceWhen[].predicate` — `engine/attack.mjs:4508` matches it with a bespoke string compare
  that strips `attack:kind:`. `auto-evade.yml` correctly authors the bare term `"np"`.
- `blockedWhen` — `{state, condition}`, matched by `conditionHolds` in
  `rules/command-spells.mjs`, a switch with one case.
- `targeting.selection.attributes` — **is** a predicate despite the name
  (`rules/targeting/resolve.mjs:252`). It goes IN the collector.

**Two `refs` shapes that disagree.** `@self.health` is `{value, max}` under `expressionRefs` and a
number under a unit snapshot. This plan does not unify them; it scopes the picker so the editor
cannot emit an unresolvable path. See spec §5.2.

---

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/facets.mjs` | **Create.** The facet table, the value kinds, `patternFor()`, `parseOption()`, `REF_SCOPES`. Layer 2, pure. |
| `module/rules/options.mjs` | **Modify.** `EMITTABLE` imported from `facets.mjs` instead of declared; `emit()` helper added. |
| `module/rules/predicate.mjs` | **Modify.** `describe()` reads facet `prose`. |
| `module/rules/authoring/predicates.mjs` | **Create.** `predicateSitesIn(doc)` — the one collector, used by the test and the build. |
| `module/apps/ability-editor/predicate-builder.mjs` | **Create.** Pure view-model for the row builder. |
| `templates/apps/predicate-builder.hbs` | **Create.** The rows partial. |
| `tools/lib/content.mjs` | **Modify.** Errors via `isEmittableOption`; `looksLikeRollOption` deleted. |
| `test/unit/facets.test.mjs` | **Create.** Equivalence, shape, i18n. |
| `test/unit/options.test.mjs` | **Modify.** Guard moves onto the shared collector. |

---

## Task 1: The facet table, and proving it equivalent

**Files:**
- Create: `module/rules/facets.mjs`
- Test: `test/unit/facets.test.mjs`

**Interfaces:**
- Consumes: `module/domain/enums.mjs` (`GRADES`, `PARAMETERS`, `COMPONENTS`, `PHASES`, `ELEMENTS`, `NP_TAG_SCALE`).
- Produces:
  - `FACETS: readonly object[]`
  - `patternFor(facet): RegExp[]` — one per subject
  - `GENERATED_EMITTABLE: readonly RegExp[]`
  - `parseOption(option): {subject, facet, segments: Record<string,string>}|null`
  - `REF_SCOPES: Readonly<Record<string, {roots: string[], shape: string}>>`

**This task must be provably behaviour-neutral.** It replaces 37 hand-written regexes with
generated ones; the test proves the generated set accepts and rejects exactly what the old set did,
before anything is built on top.

- [ ] **Step 1: Capture the current regexes as a fixture**

Before writing anything, snapshot the existing list so the equivalence test has something to
compare against that cannot drift:

```bash
node -e "
const fs=require('fs');const s=fs.readFileSync('module/rules/options.mjs','utf8');
const b=s.slice(s.indexOf('const EMITTABLE'), s.indexOf(']);', s.indexOf('const EMITTABLE')));
const lines=b.split('\n').map(l=>l.trim()).filter(l=>l.startsWith('/^')).map(l=>l.replace(/,$/,''));
fs.mkdirSync('test/fixtures',{recursive:true});
fs.writeFileSync('test/fixtures/emittable-before.json', JSON.stringify(lines,null,2)+'\n');
console.log('captured', lines.length);
"
```

Expected: `captured 37`.

- [ ] **Step 2: Write the failing test**

Create `test/unit/facets.test.mjs`:

```js
/**
 * @file The predicate facet vocabulary.
 * @see module/rules/facets.mjs, docs/24-rules-engine.md §24.4
 *
 * `EMITTABLE` is GENERATED from this table rather than declared beside it.
 * Unlike `EXECUTORS` -- functions, which no table can generate -- it is pure
 * data describing a string shape, which is exactly what a descriptor with
 * typed segments is. The equivalence test below is what makes that swap safe.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  FACETS, GENERATED_EMITTABLE, patternFor, parseOption, REF_SCOPES,
} from "../../module/rules/facets.mjs";

const before = JSON.parse(readFileSync("test/fixtures/emittable-before.json", "utf8"))
  .map((src) => new RegExp(src.slice(1, -1)));

/** Options that must be accepted, and near-misses that must not. */
const ACCEPT = [
  "self:stance:dismounted", "target:attribute:large", "self:free", "attack:crit",
  "self:phase:day", "target:masterTier:high", "self:rank:str:gte:B",
  "target:paramVsSelf:agi:gt", "self:skillRank:divinity:gte:A",
  "attack:range:gte:3", "attack:component:mag", "self:stableDie:d6:4",
  "self:withinOfOwnerMaster:2", "attack:npScale:gte:antiArmy",
];
const REJECT = [
  "self:stanse:dismounted",       // typo'd facet
  "self:phase:tuesday",           // closed value, not a member
  "target:masterTier:middling",   // closed value
  "self:rank:str:gte:Z",          // not a grade
  "attack:range:gte:x",           // not a number
  "self:withinOfOwnerMaster:9",   // out of range
  "not:self:stance:dismounted",   // the prefix is stripped BEFORE this is asked
  "",
];

describe("equivalence with the regexes it replaces", () => {
  const oldAccepts = (o) => before.some((r) => r.test(o));
  const newAccepts = (o) => GENERATED_EMITTABLE.some((r) => r.test(o));

  it("generates one pattern per subject per facet", () => {
    expect(GENERATED_EMITTABLE.length).toBeGreaterThanOrEqual(before.length);
  });

  it("agrees with the old list on everything it should accept", () => {
    for (const o of ACCEPT) {
      expect(oldAccepts(o), `fixture rejects ${o}; fix the fixture, not the table`).toBe(true);
      expect(newAccepts(o), o).toBe(true);
    }
  });

  it("agrees with the old list on everything it should reject", () => {
    for (const o of REJECT) {
      expect(newAccepts(o), `${o} must not be emittable`).toBe(false);
    }
  });

  it("agrees on every option the shipped corpus names", async () => {
    // The real equivalence proof: 236 references, and the two lists must give
    // the same verdict on every one.
    const { corpusOptions } = await import("./helpers/corpus.mjs");
    for (const o of corpusOptions()) {
      expect(newAccepts(o), `disagreement on ${o}`).toBe(oldAccepts(o));
    }
  });
});

describe("the table is well formed", () => {
  it("gives every facet an id, subjects, a label, a hint and prose", () => {
    for (const f of FACETS) {
      expect(f.id, JSON.stringify(f)).toBeTruthy();
      expect(f.subjects.length, f.id).toBeGreaterThan(0);
      expect(f.label, f.id).toBeTruthy();
      expect(f.hint, f.id).toBeTruthy();
      expect(f.english.length, f.id).toBeGreaterThan(15);
      expect(f.prose, f.id).toBeTruthy();
    }
  });

  it("declares a value kind for every segment", () => {
    for (const f of FACETS) {
      for (const seg of f.segments ?? []) {
        expect(["closed", "registry", "open", "literal", "number"], `${f.id}.${seg.name}`)
          .toContain(seg.value.kind);
      }
    }
  });

  it("names a real enum for every closed segment", async () => {
    const enums = await import("../../module/domain/enums.mjs");
    for (const f of FACETS) {
      for (const seg of (f.segments ?? []).filter((s) => s.value.kind === "closed")) {
        if (!seg.value.from) { expect(seg.value.list?.length, `${f.id}.${seg.name}`).toBeGreaterThan(0); continue; }
        expect(enums[seg.value.from], `${f.id}.${seg.name} names ${seg.value.from}`).toBeDefined();
      }
    }
  });

  it("closes the five facets that have an enum and were not using it", () => {
    // spec §1.2: these validated as free text and could never be typo-caught.
    // `self:highestParameter:strength` passed and can never match, because
    // the parameter is `str`.
    const closed = (id, seg) => FACETS.find((f) => f.id === id)
      ?.segments.find((s) => s.name === seg)?.value;
    expect(closed("highestParameter", "parameter")).toMatchObject({ kind: "closed", from: "PARAMETERS" });
    expect(closed("rank", "parameter")).toMatchObject({ kind: "closed", from: "PARAMETERS" });
    expect(closed("paramVsSelf", "parameter")).toMatchObject({ kind: "closed", from: "PARAMETERS" });
    expect(closed("element", "element")).toMatchObject({ kind: "closed", from: "ELEMENTS" });
    expect(closed("npScale", "scale")).toMatchObject({ kind: "closed", from: "NP_TAG_SCALE" });
  });

  it("keeps attribute OPEN, because content names what is not built yet", () => {
    // spec §10.1: `outsider` and `undead` are referenced by six clauses in
    // four files and granted by no authored unit. They are forward references
    // to the 29 Servants still to come.
    const attr = FACETS.find((f) => f.id === "attribute");
    expect(attr.segments[0].value.kind).toBe("open");
  });
});

describe("parseOption", () => {
  it("splits an option into subject, facet and named segments", () => {
    expect(parseOption("self:skillRank:divinity:gte:B")).toEqual({
      subject: "self",
      facet: "skillRank",
      segments: { slug: "divinity", grade: "B" },
    });
  });

  it("reads a facet with no value at all", () => {
    expect(parseOption("attack:crit")).toEqual({ subject: "attack", facet: "crit", segments: {} });
  });

  it("returns null for anything no facet admits", () => {
    // A module's compendium may name anything; the caller falls back rather
    // than throwing.
    expect(parseOption("self:stanse:dismounted")).toBe(null);
    expect(parseOption("nonsense")).toBe(null);
  });
});

describe("REF_SCOPES", () => {
  it("says which roots each site may reference, and their shape", () => {
    // spec §5.2: `@self.health` is `{value,max}` under expressionRefs and a
    // NUMBER under a unit snapshot. A picker offering one flat list would
    // emit paths that cannot resolve where they sit.
    expect(REF_SCOPES.ownerOnly.roots).toEqual(["self"]);
    expect(REF_SCOPES.exchange.roots).toEqual(expect.arrayContaining(["self", "target"]));
    expect(REF_SCOPES.ownerOnly.shape).not.toBe(REF_SCOPES.exchange.shape);
  });
});
```

- [ ] **Step 3: Write the corpus helper**

Create `test/unit/helpers/corpus.mjs`:

```js
/**
 * @file Every predicate option the shipped content names.
 *
 * Shared, because three tests want the same list and a second walker would be
 * a second opinion about what counts as a predicate.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { predicateSitesIn } from "../../../module/rules/authoring/predicates.mjs";

/** @returns {string[]} every option named, with `not:` stripped, deduplicated */
export function corpusOptions() {
  const out = new Set();
  for (const dir of readdirSync("packs/_source")) {
    const p = join("packs/_source", dir);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p).filter((n) => n.endsWith(".yml"))) {
      let doc;
      try { doc = parse(readFileSync(join(p, f), "utf8")); } catch { continue; }
      for (const site of predicateSitesIn(doc)) for (const o of site.options) out.add(o);
    }
  }
  return [...out];
}
```

This imports Task 2's collector, so **Task 2 is written first in practice**; the equivalence test
in Step 2 will not run until it exists. If you are executing strictly in order, comment out that
one `it(...)` block, complete Task 2, and restore it — do not delete it.

- [ ] **Step 4: Run the test to verify it fails**

```bash
npx vitest run test/unit/facets.test.mjs
```

Expected: FAIL — cannot resolve `module/rules/facets.mjs`.

- [ ] **Step 5: Write the table**

Create `module/rules/facets.mjs`. The header, the value kinds, three worked facets covering all
three kinds, and the generator:

```js
/**
 * @file The predicate facet vocabulary — the authority for what an option may say.
 * @see docs/24-rules-engine.md §24.4, docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure data.
 *
 * **This table generates `options.mjs#EMITTABLE`.** The other four authoring
 * vocabularies are held against a dispatcher by a drift test, because a
 * dispatcher is code. This one is not: `EMITTABLE` was 37 regexes describing a
 * string shape, which is exactly what a descriptor with typed segments is, so
 * keeping both would be two spellings of one fact tested to agree.
 *
 * Generating also buys what a test cannot: `rollOptionsFor` emits through
 * `emit()` and therefore **cannot produce an undeclared option**. Before, it
 * built strings with template literals, so a typo in the generator produced an
 * option no predicate could ever name -- silent in the other direction.
 *
 * **On value kinds.** `closed` errors at build time, `registry` only warns, and
 * `open` is checked for shape alone and says so. That asymmetry is load-bearing:
 * `outsider` and `undead` are named by six authored clauses and granted by no
 * unit, because they are forward references to Servants not yet built. A
 * registry that errored would fail the build on legitimate content. An enum in
 * `domain/enums.mjs`, by contrast, does not gain a member because somebody
 * mistyped -- so `closed` can be strict.
 */

import * as ENUMS from "../domain/enums.mjs";

/** Both unit-facing namespaces. */
const SIDES = Object.freeze(["self", "target"]);

/**
 * @param {object} spec
 * @returns {object}
 */
const facet = ({ id, subjects = SIDES, segments = [], english, prose }) => ({
  id,
  subjects,
  segments,
  label: `FGT.Predicate.Facet.${id}`,
  hint: `FGT.Predicate.Facet.${id}Hint`,
  english,
  prose,
  doc: "24-rules-engine.md",
});

export const FACETS = Object.freeze([
  // A bare flag: no value segment at all.
  facet({
    id: "free",
    english: "The Servant has no Master — it is Free or Unbound.",
    prose: "{subject} is a Free Servant",
  }),

  // A CLOSED value: an enum decides it, so a typo is an error.
  facet({
    id: "phase",
    segments: [{ name: "phase", value: { kind: "closed", from: "PHASES" } }],
    english: "Only during the day, or only during the night.",
    prose: "it is {phase}",
  }),

  // An OPEN value: nothing can check it, and the table says so.
  facet({
    id: "attribute",
    segments: [{ name: "attribute", value: { kind: "open", shape: "identifier" } }],
    english: "Carries a named Attribute — Large, Divine, Undead.",
    prose: "{subject} has the {attribute} attribute",
  }),

  // …the remaining 34 facets, one per entry in the captured fixture.
]);
```

**To write the other 34**, work down `test/fixtures/emittable-before.json` in order. For each
regex, the facet id is the segment after the subject; each remaining group becomes a segment. The
value kind follows the group:

| Regex group | Segment value |
|---|---|
| `(day\|night)` and friends | `{kind: "closed", list: [...]}` or `{kind: "closed", from: "<ENUM>"}` |
| `(E\|D\|C\|B\|A\|EX)` | `{kind: "closed", from: "GRADES"}` |
| `\d+` or `[1-6]` | `{kind: "number", min, max}` |
| a literal like `gte` between groups | `{kind: "literal", is: "gte"}` |
| `[A-Za-z][\w-]*` naming an effect, ability or content id | `{kind: "registry", from: "effects" \| "abilitySlugs" \| "contentIds"}` |
| `[A-Za-z][\w-]*` naming anything else | `{kind: "open", shape: "identifier"}` |

**Five need tightening rather than transcribing** (spec §1.2) — `highestParameter`, `rank`'s
parameter, `paramVsSelf`'s parameter, `attack:element`, `attack:npScale:gte`. Give them
`{kind: "closed", from: …}`. The equivalence test's corpus check will tell you immediately if any
authored option relied on the looser shape; if one does, **stop and report** — it is a predicate
that has never fired.

Then the generator and the parser:

```js
/** @param {object} seg @returns {string} the regex source for one segment */
function sourceFor(seg) {
  const v = seg.value;
  switch (v.kind) {
    case "literal": return v.is;
    case "closed": return `(?:${(v.list ?? ENUMS[v.from]).join("|")})`;
    case "number": return v.min !== undefined ? `[${v.min}-${v.max}]` : "\\d+";
    default: return "[A-Za-z][\\w-]*";
  }
}

/**
 * One pattern per subject. `EMITTABLE` is the flattening of these.
 * @param {object} f
 * @returns {RegExp[]}
 */
export function patternFor(f) {
  const tail = f.segments.map((s) => `:${sourceFor(s)}`).join("");
  return f.subjects.map((subject) => new RegExp(`^${subject}:${f.id}${tail}$`));
}

/** @type {readonly RegExp[]} */
export const GENERATED_EMITTABLE = Object.freeze(FACETS.flatMap(patternFor));

/**
 * Split an option into its parts, or `null` if no facet admits it.
 *
 * `null` rather than a throw: a module's compendium may name anything, and
 * both callers -- the builder and `explain()` -- fall back rather than
 * refusing to render.
 *
 * @param {string} option
 * @returns {{subject: string, facet: string, segments: Record<string, string>}|null}
 */
export function parseOption(option) {
  const [subject, id, ...rest] = String(option).split(":");
  const f = FACETS.find((x) => x.id === id && x.subjects.includes(subject));
  if (!f) return null;
  if (!patternFor(f).some((r) => r.test(option))) return null;

  /** @type {Record<string, string>} */
  const segments = {};
  let i = 0;
  for (const seg of f.segments) {
    if (seg.value.kind === "literal") { i += 1; continue; }
    segments[seg.name] = rest[i];
    i += 1;
  }
  return { subject, facet: id, segments };
}

/**
 * Which `@`-roots a predicate may reference, and what shape they take.
 *
 * `ctx.refs` is built four different ways and the two `self` shapes disagree:
 * `@self.health` is `{value, max}` under `expressionRefs` and a NUMBER under a
 * unit snapshot (`rules/snapshot.mjs`). A picker offering one flat list would
 * happily emit a path that cannot resolve where it sits, and `num()` throws on
 * that rather than failing quietly.
 *
 * Unifying the two shapes is a separate change with its own blast radius
 * (Ch. 41). This is what stops the editor making the problem worse.
 */
export const REF_SCOPES = Object.freeze({
  ownerOnly: Object.freeze({ roots: Object.freeze(["self"]), shape: "document" }),
  exchange: Object.freeze({
    roots: Object.freeze(["self", "target", "attack", "board"]),
    shape: "snapshot",
  }),
});
```

- [ ] **Step 6: Add the localization keys and run**

Two per facet (`FGT.Predicate.Facet.<id>` and `<id>Hint`), seeded from `english`. Then:

```bash
npx vitest run test/unit/facets.test.mjs && npm run lint
node -e "const j=require('./lang/en.json');const k=Object.keys(j);const bad=[];for(const a of k)for(const b of k)if(a!==b&&b.startsWith(a+'.'))bad.push(a+' < '+b);console.log(bad.length?bad.join('\n'):'no prefix collisions')"
```

- [ ] **Step 7: Commit**

```bash
git add module/rules/facets.mjs test/unit/facets.test.mjs test/unit/helpers/corpus.mjs test/fixtures/emittable-before.json lang/en.json
git commit -m "$(cat <<'EOF'
feat(rules): the predicate facet vocabulary

37 hand-written regexes become a described table. Unlike EXECUTORS --
functions, which no table can generate -- EMITTABLE is pure data
describing a string shape, which is exactly what a descriptor with
typed segments is. Keeping both would be two spellings of one fact
tested to agree.

The equivalence test is what makes the swap safe: the generated set
must give the same verdict as the captured fixture on every option
the shipped corpus names, plus a list of deliberate near-misses.

Five facets gain a closed enum they were not using. Today
`self:highestParameter:strength` passes validation and can never
match, because the parameter is `str`.

`attribute` deliberately stays OPEN, and `registry` warns rather than
errors: `outsider` and `undead` are named by six authored clauses and
granted by no unit, because they are forward references to Servants
not yet built. A registry that errored would fail the build on
legitimate content.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016xKjhGXRPmu4C6a5zuYs5S
EOF
)"
```

---

## Task 2: One collector, every predicate site

**Files:**
- Create: `module/rules/authoring/predicates.mjs`
- Test: `test/unit/authoring-predicates.test.mjs`

**Interfaces:**
- Consumes: `referencedOptions` from `module/rules/predicate.mjs`.
- Produces:
  - `predicateSitesIn(doc): Array<{where: string, options: string[]}>`
  - `PREDICATE_FIELDS: readonly string[]`
  - `NOT_PREDICATES: Readonly<Record<string, string>>` — field name → why it is excluded

- [ ] **Step 1: Write the failing test**

Create `test/unit/authoring-predicates.test.mjs`:

```js
/**
 * @file Every place a predicate can hide.
 * @see module/rules/authoring/predicates.mjs
 *
 * The existing guard in `options.test.mjs` reads rule elements only -- 147 of
 * the 236 option references in the corpus. The other 89 sit on requirements
 * and phases, and nothing has ever checked them.
 */

import { describe, it, expect } from "vitest";
import {
  predicateSitesIn, PREDICATE_FIELDS, NOT_PREDICATES,
} from "../../module/rules/authoring/predicates.mjs";

describe("predicateSitesIn", () => {
  it("finds a rule element's own predicate", () => {
    const doc = { passiveRules: [{ key: "Aura", predicate: ["self:free"] }] };
    expect(predicateSitesIn(doc)).toEqual([
      { where: "passiveRules[0].predicate", options: ["self:free"] },
    ]);
  });

  it("finds the attack and target predicates beside it", () => {
    const doc = { rules: [{ key: "X", attackPredicate: ["attack:crit"], targetPredicate: ["target:free"] }] };
    expect(predicateSitesIn(doc).map((s) => s.where))
      .toEqual(["rules[0].attackPredicate", "rules[0].targetPredicate"]);
  });

  it("finds a requirement's predicate — 89 references nothing checked", () => {
    const doc = { requirements: [{ kind: "predicate", predicate: ["self:stance:dismounted"] }] };
    expect(predicateSitesIn(doc)[0]).toMatchObject({ options: ["self:stance:dismounted"] });
  });

  it("finds a phase's predicate, and a phase rule's", () => {
    const doc = {
      phases: [{
        kind: "damage",
        predicate: ["attack:isAoE"],
        rules: [{ effect: { id: "burn" }, predicate: ["target:free"] }],
      }],
    };
    expect(predicateSitesIn(doc).map((s) => s.options.flat()))
      .toEqual([["attack:isAoE"], ["target:free"]]);
  });

  it("finds targeting.selection.attributes, which IS a predicate", () => {
    // `rules/targeting/resolve.mjs:252` hands it to `testPredicate`. Achilles's
    // Diatrekhōn Astēr Lonkhē uses it for "cannot be used on Female Units".
    const doc = {
      targeting: { selection: { attributes: [{ not: { or: ["target:attribute:female"] } }] } },
    };
    expect(predicateSitesIn(doc)[0].options).toEqual(["target:attribute:female"]);
  });

  it("strips the not: prefix, because the guard asks about the option", () => {
    const doc = { rules: [{ key: "X", predicate: ["not:self:free"] }] };
    expect(predicateSitesIn(doc)[0].options).toEqual(["self:free"]);
  });

  it("descends into or, anyOf and nor", () => {
    const doc = {
      rules: [{ key: "X", predicate: [{ or: ["self:free", { anyOf: ["target:free"] }] }] }],
    };
    expect(predicateSitesIn(doc)[0].options.sort()).toEqual(["self:free", "target:free"]);
  });

  it("returns nothing for a document with no predicates", () => {
    expect(predicateSitesIn({ id: "x", name: "X" })).toEqual([]);
  });
});

describe("the fields that are NOT predicates", () => {
  it("skips chanceWhen, and says why", () => {
    // `engine/attack.mjs:4508` matches it with a bespoke string compare that
    // strips `attack:kind:`. `auto-evade.yml` correctly authors the bare "np".
    const doc = { rules: [{ key: "AutoSucceed", chanceWhen: [{ predicate: ["np"], chance: 50 }] }] };
    expect(predicateSitesIn(doc)).toEqual([]);
    expect(NOT_PREDICATES.chanceWhen).toBeTruthy();
  });

  it("skips blockedWhen, and says why", () => {
    // `{state, condition}`, matched by `conditionHolds` -- a switch with one
    // case. No options, no operators.
    const doc = { blockedWhen: [{ state: "damage", condition: "damageWouldDefeatServant" }] };
    expect(predicateSitesIn(doc)).toEqual([]);
    expect(NOT_PREDICATES.blockedWhen).toBeTruthy();
  });

  it("gives a reason for every exclusion, so none is a silent omission", () => {
    for (const [field, why] of Object.entries(NOT_PREDICATES)) {
      expect(why.length, field).toBeGreaterThan(20);
    }
  });
});

describe("no predicate site escapes the collector", () => {
  it("accounts for every field named like a predicate in the corpus", async () => {
    // The guard on the guard. A new predicate site added to the schema fails
    // here until it is either collected or explicitly excluded with a reason.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parse } = await import("yaml");

    const seen = new Set();
    const scan = (node) => {
      if (Array.isArray(node)) return node.forEach(scan);
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node)) {
        if (/predicate/i.test(k) || k === "attributes") seen.add(k);
        scan(v);
      }
    };
    for (const dir of readdirSync("packs/_source")) {
      const p = join("packs/_source", dir);
      if (!statSync(p).isDirectory()) continue;
      for (const f of readdirSync(p).filter((n) => n.endsWith(".yml"))) {
        try { scan(parse(readFileSync(join(p, f), "utf8"))); } catch { /* validated elsewhere */ }
      }
    }

    const known = new Set([...PREDICATE_FIELDS, ...Object.keys(NOT_PREDICATES), "attributes"]);
    expect([...seen].filter((k) => !known.has(k))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run test/unit/authoring-predicates.test.mjs
```

Expected: FAIL — cannot resolve `module/rules/authoring/predicates.mjs`.

- [ ] **Step 3: Write the collector**

`predicateSitesIn` walks the document and, for each field in `PREDICATE_FIELDS`, records
`{where, options}` using `referencedOptions` from `predicate.mjs` — which already strips `not:` and
descends `or`/`anyOf`/`nor`, so do not re-implement it. `targeting.selection.attributes` is
collected by path, not by name, so a unit's own `attributes:` list is never mistaken for one.

`NOT_PREDICATES` is `{chanceWhen: "…", blockedWhen: "…"}` with the reasons from the spec.

- [ ] **Step 4: Verify the coverage jumped, and commit**

```bash
npx vitest run test/unit/authoring-predicates.test.mjs && npm run lint
node -e "
const {readdirSync,readFileSync,statSync}=require('fs'),{join}=require('path'),{parse}=require('yaml');
import('./module/rules/authoring/predicates.mjs').then(({predicateSitesIn})=>{
  let n=0;
  for(const d of readdirSync('packs/_source')){const p=join('packs/_source',d);
    if(!statSync(p).isDirectory())continue;
    for(const f of readdirSync(p).filter(x=>x.endsWith('.yml'))){
      try{for(const s of predicateSitesIn(parse(readFileSync(join(p,f),'utf8'))))n+=s.options.length;}catch{}}}
  console.log('option references collected:', n);
});"
```

Expected: **236**, up from the 147 the old guard reached. If it is lower, a site is missing; if
much higher, the collector is picking up something that is not a predicate — check
`selection.attributes` versus a unit's `attributes`.

Commit message: `feat(authoring): one collector for every predicate site`

---

## Task 3: Generate `EMITTABLE`, and emit through it

**Files:**
- Modify: `module/rules/options.mjs`
- Test: `test/unit/options.test.mjs`

**Interfaces:**
- Consumes: `GENERATED_EMITTABLE`, `FACETS` from Task 1.
- Produces: `emit(options, subject, facetId, ...values)` — appends only declared options.

- [ ] **Step 1: Swap the declaration**

Delete the 37-entry `EMITTABLE` array and replace with:

```js
// GENERATED, not declared. See `rules/facets.mjs` -- one table describes what
// an option may say, and both the emitter and the picker read it.
import { GENERATED_EMITTABLE, FACETS } from "./facets.mjs";

const EMITTABLE = GENERATED_EMITTABLE;
```

`isEmittableOption` keeps its name and behaviour, so no caller changes.

- [ ] **Step 2: Run the whole suite**

```bash
npm test
```

Expected: **all green, with no test edited**. That is the equivalence proof in practice — 3470
tests, including `options.test.mjs`'s own emission tests, pass against a generated list. If
anything fails, the table is wrong; fix the table, never the test.

- [ ] **Step 3: Add `emit()` and route one caller through it**

```js
/**
 * Add an option, refusing anything no facet declares.
 *
 * The mirror of `isEmittableOption`. Before this, `rollOptionsFor` built
 * strings with template literals, so a typo in the GENERATOR produced an
 * option no predicate could ever name -- silent in the opposite direction from
 * a typo in content.
 *
 * @param {Set<string>} options
 * @param {string} subject
 * @param {string} facetId
 * @param {...(string|number)} values
 * @returns {void}
 */
export function emit(options, subject, facetId, ...values) { /* … */ }
```

Route **`stance` only** through it in this task, and leave the rest for a follow-up: the point is
to prove the helper against a live call site, not to rewrite 500 lines in a task whose subject is
the table.

- [ ] **Step 4: Verify and commit**

```bash
npm test && npm run lint
```

Commit message: `feat(rules): EMITTABLE is generated, and emission is checked both ways`

---

## Task 4: The build errors

**Files:**
- Modify: `tools/lib/content.mjs`
- Test: `test/unit/content.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
describe("predicate options are validated against the facets", () => {
  const ability = (predicate) =>
    file({ ...ok(), rules: [{ key: "Aura", predicate }] }, "abilities/x.yml", "abilities");

  it("errors on a facet no table admits", () => {
    expect(errorsFor([ability(["self:stanse:dismounted"])]).join(" ")).toMatch(/stanse/);
  });

  it("errors on a closed value that is not a member", () => {
    // `PHASES` is day/night/none. This passed the old shape regex.
    expect(errorsFor([ability(["self:phase:tuesday"])]).join(" ")).toMatch(/tuesday/);
  });

  it("accepts every option the shipped corpus names", async () => {
    const { corpusOptions } = await import("./helpers/corpus.mjs");
    for (const o of corpusOptions()) {
      expect(errorsFor([ability([o])]), o).toEqual([]);
    }
  });

  it("only WARNS on a registry value nothing defines yet", () => {
    // `outsider` is named by alter-ego and granted by no unit, because it is a
    // forward reference to a Servant not yet built. Erroring would fail the
    // build on legitimate content.
    const files = [ability(["self:attribute:outsider"])];
    expect(errorsFor(files)).toEqual([]);
  });

  it("checks a requirement's predicate, not only a rule element's", () => {
    const doc = file(
      { ...ok(), requirements: [{ kind: "predicate", predicate: ["self:stanse:x"] }] },
      "abilities/x.yml", "abilities",
    );
    expect(errorsFor([doc]).join(" ")).toMatch(/stanse/);
  });
});
```

- [ ] **Step 2: Implement**

Replace the `looksLikeRollOption` call with `isEmittableOption`, driven by `predicateSitesIn` so
every site is covered, and **delete `looksLikeRollOption`** rather than leaving it beside as a
weaker second opinion.

- [ ] **Step 3: Run the real content build — the moment of truth**

```bash
npm run validate:content
```

Expected: **0 errors.** The corpus is facet-clean today and Task 1's equivalence test proved the
five tightened facets accept what is authored.

**If it reports errors: STOP. List them and report. Do not edit content.** A predicate that has
never fired is a rules bug with a Servant behind it, and it deserves its own decision — the same
instruction the timing-window plan carried, for the same reason.

- [ ] **Step 4: Commit**

Commit message: `feat(content): predicate options are checked against the facets, not a shape`

---

## Task 5: `explain()` reads the table

**Files:**
- Modify: `module/rules/predicate.mjs`
- Test: `test/unit/predicate.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
describe("prose from the facet table", () => {
  it("says what a failed option means, not what it is spelled", () => {
    // §24.4: predicates are DATA so a failed one can be read. What it says
    // today is "target attribute = large".
    const [line] = explain(["target:attribute:large"], { options: new Set() });
    expect(line.text).toBe("target has the large attribute");
    expect(line.passed).toBe(false);
  });

  it("interpolates every segment", () => {
    const [line] = explain(["self:skillRank:divinity:gte:B"], { options: new Set() });
    expect(line.text).toContain("divinity");
    expect(line.text).toContain("B");
  });

  it("falls back to the mechanical split for an option no facet knows", () => {
    // A module's compendium may name anything. Rendering beats throwing.
    const [line] = explain(["mod:something:odd"], { options: new Set() });
    expect(line.text).toBe("mod something = odd");
  });

  it("still negates", () => {
    const [line] = explain(["not:self:free"], { options: new Set() });
    expect(line.text).toMatch(/not/);
  });
});
```

- [ ] **Step 2: Implement, verify, commit**

`humanize()` calls `parseOption`; on a hit it interpolates the facet's `prose`, on a miss it keeps
today's split. Commit message: `feat(rules): a failed predicate reads as prose, from the facet table`

---

## Task 6: The row builder

**Files:**
- Create: `module/apps/ability-editor/predicate-builder.mjs`
- Create: `templates/apps/predicate-builder.hbs`
- Modify: `module/apps/ability-editor/present.mjs`, `editor.mjs`, `styles/src/_editor.scss`
- Test: `test/unit/predicate-builder.test.mjs`

**Interfaces:**
- Produces: `builderRows(predicate, scope)`, `toPredicate(rows)` — inverses.

- [ ] **Step 1: Write the failing test**

```js
describe("builderRows", () => {
  it("turns an option into subject, facet and value choices", () => {
    const [row] = builderRows(["self:stance:dismounted"], "ownerOnly");
    expect(row).toMatchObject({ kind: "term", subject: "self", facet: "stance", negated: false });
    expect(row.segments[0].value).toBe("dismounted");
  });

  it("marks a negated term without losing the option", () => {
    const [row] = builderRows(["not:self:free"], "ownerOnly");
    expect(row.negated).toBe(true);
    expect(row.facet).toBe("free");
  });

  it("renders a group for or/anyOf", () => {
    const [row] = builderRows([{ or: ["self:free", "target:free"] }], "ownerOnly");
    expect(row.kind).toBe("group");
    expect(row.op).toBe("or");
    expect(row.rows).toHaveLength(2);
  });

  it("renders a comparison as a two-ref row", () => {
    const [row] = builderRows([{ gte: ["@self.health.value", 100] }], "ownerOnly");
    expect(row.kind).toBe("comparison");
    expect(row.op).toBe("gte");
    expect(row.left).toBe("@self.health.value");
    expect(row.right).toBe(100);
  });

  it("offers only the refs its scope can resolve", () => {
    // spec §5.2: `expressionRefs` supplies no `target` at all, so offering
    // `@target.…` there would emit a path that cannot resolve.
    const owner = builderRows([{ gte: ["@self.health.value", 1] }], "ownerOnly")[0];
    expect(owner.refChoices.every((r) => r.startsWith("@self"))).toBe(true);
    const exchange = builderRows([{ gte: ["@self.health.value", 1] }], "exchange")[0];
    expect(exchange.refChoices.some((r) => r.startsWith("@target"))).toBe(true);
  });

  it("keeps anything it cannot model as a raw row", () => {
    const [row] = builderRows([{ someModuleOp: ["x"] }], "ownerOnly");
    expect(row.kind).toBe("raw");
    expect(row.raw).toContain("someModuleOp");
  });
});

describe("toPredicate", () => {
  it("is the inverse of builderRows", () => {
    // Anything the builder renders it must be able to give back unchanged, or
    // opening an ability and saving it would rewrite its rules.
    for (const p of [
      ["self:stance:dismounted"],
      ["not:self:free"],
      [{ or: ["self:free", "target:free"] }],
      [{ anyOf: ["target:attribute:large", "target:attribute:divine"] }],
      [{ gte: ["@self.health.value", 100] }],
      [{ rankGte: ["@self.parameters.str", "B"] }],
    ]) {
      expect(toPredicate(builderRows(p, "exchange"))).toEqual(p);
    }
  });
});
```

- [ ] **Step 2: Implement, then wire `formRows`'s `predicateList` branch to the builder**

Every rule element, requirement kind and phase kind carrying a predicate gets it at once — the
point of having built the descriptor tables first.

- [ ] **Step 3: Verify in the live world**

Green tests are not evidence a picker works. Bring the world up, open an ability, and build
Achilles's `["self:stance:dismounted"]` from three dropdowns. Confirm the sentence beneath reads
*"self is dismounted"*, save, and read the document back — it must equal the shipped YAML exactly.
Screenshot it.

```bash
node tools/fgt-world.mjs status && node tools/fgt-reload.mjs
```

- [ ] **Step 4: Commit**

Commit message: `feat(editor): predicates are built from dropdowns, not typed`

---

## Task 7: Docs

**Files:**
- Modify: `docs/24-rules-engine.md` §24.4, `docs/29-user-interface.md` §29.6,
  `docs/41-open-questions.md`, `docs/45-implementation-status.md`

- [ ] **Step 1: §24.4** — the facet table is the authority; `EMITTABLE` is generated; the three
  value kinds and why `registry` warns while `closed` errors.
- [ ] **Step 2: §29.6** — the row builder, and the scoped ref picker.
- [ ] **Step 3: Ch. 41** — add the open question: the two `refs` shapes disagree, `@self.health`
  is an object under `expressionRefs` and a number under a unit snapshot, and unifying them
  touches four call sites and every authored magnitude.
- [ ] **Step 4: Ch. 45** — the measurements: 236 references guarded where 147 were, five facets
  tightened, the eighth site found, and whatever the live check showed.
- [ ] **Step 5: Full verification and commit**

```bash
npm test && npm run lint && npm run validate:content && npm run check:templates && npm run build:styles
```

---

## Self-Review

**Spec coverage.** D1 generated authority → Task 1 + 3. D2 three value kinds → Task 1. D3 every
site → Task 2. D4 build errors → Task 4. D5 row builder → Task 6. D6 prose → Task 5. §5.2 scoped
refs → Task 1 (`REF_SCOPES`) and Task 6 (`refChoices`). §10.1 `attribute` open → tested in Task 1.
§10.2 `blockedWhen` excluded → tested in Task 2. §11 open questions → Task 7 Step 3. **No gaps.**

**Placeholder scan.** The "remaining 34 facets" marker in Task 1 Step 5 is paired with the captured
fixture to work from, a table mapping each regex group to a value kind, and a named list of the five
that need tightening. That is a transcription with a rule, not a "figure it out".

**Type consistency.** `FACETS`, `patternFor`, `GENERATED_EMITTABLE`, `parseOption`, `REF_SCOPES`
(Task 1) are spelled identically in Tasks 3, 5 and 6. `predicateSitesIn`, `PREDICATE_FIELDS`,
`NOT_PREDICATES` (Task 2) in Tasks 1's helper and Task 4. `builderRows`/`toPredicate` (Task 6) are
inverses and tested as such.

**One ordering hazard, called out where it bites.** Task 1's corpus equivalence test imports Task
2's collector. Task 1 Step 3 says so and gives the workaround; do not delete the test to make Task
1 pass.

**The risk that could stop Task 4.** Promoting the build check may surface a predicate that has
never fired. The instruction is explicit and appears twice: stop and report, do not edit content.
