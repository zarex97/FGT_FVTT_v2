# The predicate vocabulary — design

**Date:** 2026-09-10
**Chapter:** docs/24-rules-engine.md §24.4, docs/29-user-interface.md §29.6
**Status:** design, awaiting review
**Follows:** `2026-09-10-ability-editor-design.md` §11.2, which deferred this

---

## 1. What is there, and what is missing

More exists than the ability-editor spec assumed. This design corrects that spec's framing.

### 1.1 What exists

- **`EMITTABLE`** in `module/rules/options.mjs` — **37 regexes** describing every option
  `rollOptionsFor` can emit. About eight already constrain the *value* segment:
  `phase:(day|night)`, `masterTier:(high|low|rankless)`, `component:(str|mag)`,
  `rank:…:gte:(E|D|C|B|A|EX)`, `withinOfOwnerMaster:[1-6]`, `stableDie:d6:[1-6]`,
  `paramVsSelf:…:(gt|eq|lt)`, `range:(gte|lte):\d+`.
- **`isEmittableOption()`**, exported.
- **A drift test** — `test/unit/options.test.mjs`, "content predicates name options that exist".
  It was written after `N.Atk Up` and `Bleed Atk` were both authored against
  `self:attack:normal`, which `rollOptionsFor` has never emitted: *"the modifier was dropped at
  every damage event and the effect did nothing at all."*
- **`explain()`** in `rules/predicate.mjs`, which renders a predicate as prose with each statement
  marked passed or failed. This is the stated reason predicates are data at all (§24.4).

### 1.2 The four gaps

**1. 38% of predicate references are unguarded.** Measured across `packs/_source`: **236** option
references in authored predicates. The existing test collects only those on rule elements —
**147**. The other **89** live on `requirements[].predicate`, `phases[].predicate` and phase rules,
and nothing checks them at all.

**2. The content build's own check is weaker than the test's, and is only a warning.**
`tools/lib/content.mjs#looksLikeRollOption` is `^[a-z]+:[a-zA-Z]+(:[\w+-]+)*$` — pure shape. It
does not call `isEmittableOption`. This is precisely how the `not:` bug survived: the file's own
header records that *"the validator's own `looksLikeRollOption` accepts the prefixed form as
well-formed, which is exactly why nobody noticed"*, at the cost of Penthesilea's signature aura and
Karna's divinity override.

**3. `EMITTABLE` is regexes, so no picker can be built from it and `explain()` cannot do better
than a mechanical split.** `target:attribute:large` renders as *"target attribute = large"*.
A regex carries no label, no hint, and no statement of where its value comes from.

**4. Open value segments are unchecked, including five that need not be.**
`self:skill:madeupSkill` matches `^(self|target):skill:[A-Za-z][\w-]*$`, is never in the set, and is
therefore permanently false. Counted across the 37 facets:

| | Count |
|---|---|
| bare flags with no value (`self:free`, `attack:crit`) | 9 |
| value fully constrained (`phase:(day\|night)`, `range:(gte\|lte):\d+`) | 7 |
| **carrying at least one free identifier segment** | **21** |

And five of those 21 have a closed enum sitting in `domain/enums.mjs` that they simply do not use:

| Facet | Validated as | Could be |
|---|---|---|
| `(self\|target):highestParameter:…` | `[a-z]+` | `PARAMETERS` |
| `(self\|target):rank:<param>:gte:…` | `[A-Za-z]+` | `PARAMETERS` |
| `target:paramVsSelf:<param>:…` | `[A-Za-z]+` | `PARAMETERS` |
| `attack:element:…` | `[A-Za-z][\w-]*` | `ELEMENTS` |
| `attack:npScale:gte:…` | `[A-Za-z][\w-]*` | `NP_TAG_SCALE` |

So the descriptor work **tightens** validation rather than merely relabelling it:
`self:highestParameter:strength` passes today and can never match, because the parameter is `str`.

### 1.3 One wart the builder must know about

**`chanceWhen[].predicate` is not a predicate.** `engine/attack.mjs:4508` evaluates it with a
bespoke match that strips `attack:kind:` and compares against a plain string list, which is why
`auto-evade.yml` authors the bare term `"np"` — a string `rollOptionsFor` never emits, and correct
anyway. A builder that treated every field named `predicate` as a predicate would generate
something the engine never evaluates. **The vocabulary must name which fields are real predicates**,
and `chanceWhen` is not one.

---

## 2. Decisions

| # | Decision |
|---|---|
| **D1** | **The descriptor table is the authority; `EMITTABLE` is generated from it.** Unlike `EXECUTORS` — functions, which no table can generate — `EMITTABLE` is already pure data. One declaration, and the regexes are derived. |
| **D2** | Each facet declares **where its value comes from**: `closed` (an enum or inline list), `registry` (resolved from loaded content), or `open` (a free identifier, validated by shape and *said to be* unchecked). |
| **D3** | The guard covers **every** predicate site — all 236 references, not the 147 on rule elements. |
| **D4** | The content build **errors** on a term no facet admits, and calls `isEmittableOption` rather than its own weaker regex. |
| **D5** | The editor gets a **row builder**: subject, facet, value, negate; nested groups for `or`/`anyOf`; raw text kept as the escape hatch. |
| **D6** | `explain()` reads the same table, so a failed predicate reads as *"the target has the Large attribute"* rather than *"target attribute = large"*. |

### Why D1, and not a table beside the regexes

The other four vocabularies (`elements`, `phases`, `requirements`, `timing`) are held against their
dispatcher by a drift test, because a dispatcher is code and a descriptor cannot generate it. Here
the "dispatcher" is a list of regexes — data describing a string shape, which is exactly what a
descriptor with typed segments *is*. Keeping both would be maintaining two spellings of one fact
and testing that they agree, when they can simply be one.

Generating also buys something a test cannot: `rollOptionsFor` gets an `emit(facet, …values)`
helper that **cannot produce an undeclared option**. Today it builds strings with template literals,
so a typo in the generator produces an option no predicate can ever name — the mirror image of gap
4, and equally silent.

---

## 3. The facet table (Layer 2)

New module `module/rules/facets.mjs`. Pure data, no Foundry.

### 3.1 Descriptor shape

```js
{
  id: "skillRank",
  subjects: ["self", "target"],        // which namespaces may carry it
  segments: [
    { name: "slug",  value: { kind: "registry", from: "abilitySlugs" } },
    { name: "gte",   value: { kind: "literal", is: "gte" } },
    { name: "grade", value: { kind: "closed", from: "GRADES" } },
  ],
  label: "FGT.Predicate.Facet.skillRank",
  hint:  "FGT.Predicate.Facet.skillRankHint",
  english: "Has a named Skill at a given Rank or better.",
  // How `explain()` says it. `{subject}` and each segment name interpolate.
  prose: "{subject} has {slug} at rank {grade} or better",
  doc: "24-rules-engine.md",
}
```

`self:skillRank:divinity:gte:B` is then `subject=self`, `slug=divinity`, `grade=B` — three pickable
parts, each checkable, and one sentence for the audit trail.

### 3.2 The three value kinds

| Kind | Meaning | Picker | Validation |
|---|---|---|---|
| `closed` | An existing frozen list — `GRADES`, `PARAMETERS`, `COMPONENTS`, `PHASES`, `UNIT_KINDS`, `ELEMENTS` — or an inline one (`masterTier: high\|low\|rankless`) | a dropdown | membership, at build time |
| `registry` | Resolved from loaded content: effect ids, ability slugs, content ids | a dropdown of what the world holds | "some pack defines it", at build time |
| `open` | A free identifier with no authority — field ids, region names, variants, attributes (content grants them) | free text with the shape shown | shape only, **and the descriptor says so** |

The third kind is the honest part. **21 of the 37 facets carry a free identifier segment**, and
pretending otherwise would be the failure this project keeps finding. `open` makes "nothing checks
this" a declared property rather than an accident, and the editor can say so next to the field.

**`registry` is build-time-checkable but not editor-authoritative.** A GM authoring against a world
that has not loaded a pack would see a short list; the picker therefore offers what it knows and
still accepts a typed value, with a warning rather than a refusal.

### 3.3 Generating `EMITTABLE`

```js
export function patternFor(facet) { /* → RegExp, from subjects + segments */ }
export const EMITTABLE = Object.freeze(FACETS.flatMap(patternFor));
```

`options.mjs` imports `EMITTABLE` instead of declaring it, and keeps `isEmittableOption` as its
public name so no caller changes. A test asserts the generated set matches the 37 regexes it
replaces, **term by term against the current corpus**, so the refactor is provably behaviour-neutral
before anything else is built on it.

---

## 4. The guard

### 4.1 Every predicate site

One shared collector, `predicateSitesIn(doc)`, listing every field that **is** a predicate:

- rule elements: `predicate`, `attackPredicate`, `targetPredicate`, `requiresRecipient`,
  `chanceWhen[].predicate` — **excluded, see §1.3**
- `requirements[]` of `kind: predicate`, and the `predicate` on any other requirement kind
- `phases[].predicate`, and `phases[].rules[].predicate`
- **`targeting.selection.attributes`** — a predicate despite its name, evaluated by
  `testPredicate` at `rules/targeting/resolve.mjs:252`. Achilles's *Diatrekhōn Astēr Lonkhē* uses
  it for *"cannot be used on Female Units"* and the three Servants he will not duel. Found while
  writing this spec; it is not in the existing guard either.
- **`blockedWhen` is excluded** — see §10.2. It is not a predicate.

`test/unit/options.test.mjs`'s existing guard moves onto this collector, so its coverage goes from
147 to 236 references in one change and cannot silently miss a new site: a companion test asserts
the collector finds **every** `predicate`-named field in the corpus, minus a named exclusion list —
so a new predicate site added to the schema fails the build until it is either collected or
explicitly excluded with a reason.

### 4.2 The build errors

`tools/lib/content.mjs` imports `isEmittableOption` — the established pattern, already used for
`REQUIREMENT_KINDS` and now `ABILITY_WINDOW_IDS` — and `looksLikeRollOption` is deleted rather than
left beside it as a weaker second opinion.

**Expect this to find things.** The corpus is clean at *facet* level today — measured: of 236
references, exactly one fails `isEmittableOption`, and that one is the `chanceWhen` non-predicate of
§1.3. It has **never been checked at value level**, and §1.2's five enum-backed facets are where to
look first. If promoting the check surfaces real
errors, the executor **stops and reports**; a predicate that has never fired is a rules bug with a
Servant behind it and deserves its own decision.

---

## 5. The builder (Layer 4)

A `predicateList` field type today renders one text input. It becomes a row builder.

```
┌─ Requires ───────────────────────────────┐
│ ☑ all of                                 │
│  ┌───────────────────────────────────┐   │
│  │ ☐not [self ▾][stance  ▾][dismounted▾]│ ✕ │
│  └───────────────────────────────────┘   │
│  ┌─ any of ─────────────────────────┐    │
│  │ [target▾][attribute▾][large    ] ✕│    │
│  │ [+ term]                          │    │
│  └───────────────────────────────────┘    │
│  [+ term] [+ any of] [+ raw]             │
│  "self is dismounted, and the target      │
│   has the Large attribute or …"           │
└──────────────────────────────────────────┘
```

- **Three selects per row**, the third switching to free text for an `open` value, with the shape
  shown as placeholder and "nothing checks this" as its hint.
- **Negation is a checkbox**, writing the `not:` prefix — the form content already uses, and the
  form whose absence cost two Servants their rules.
- **Groups** for `or`, `anyOf`, `nor`; `and` is the implicit top level and is not offered as a
  nested group, because a predicate is already an implicit AND.
- **A live sentence** under the rows, from the same `prose` templates `explain()` uses. An author
  reads back what they built in the words the audit trail will use.
- **Raw stays** (D6 of the editor spec).
- **The comparison operators are in the builder**, as a second row shape: `[ref][op][ref]`. See
  §5.2 — they are 0 of 236 uses today, but the corpus is 29 Servants short of finished and
  "nothing uses it yet" is not evidence that nothing will.

### 5.2 Comparison rows, and the reference problem they expose

`gte`/`gt`/`lte`/`lt`/`eq` take two `ValueRef`s — a number or an `@`-path — and `rankGte`/`rankEq`
take `RankRef`s, which additionally accept a `+n`/`-n` step suffix (`"@target.parameters.str+1"` is
one step above). A comparison row is therefore `[ref or number][operator][ref or number]`.

**The obstacle is that `@`-paths do not mean one thing.** `ctx.refs` is built differently at every
call site:

| Call site | `refs` |
|---|---|
| `rules/elements.mjs` (most elements) | `expressionRefs(actor)` → `{self: {document, system, resources, health, baseHealth, agility, luck, parameters, remainingMov}}` — **no `target`** |
| `rules/damage/pipeline.mjs` | `{self: attackerSnapshot, target: defenderSnapshot, attack, board}` |
| `rules/targeting/resolve.mjs` | `{self: caster, target: unit, board}` |
| `engine/attack.mjs:4247` | `{self: attackerDoc}` — a raw **Document** |

And the two `self` shapes disagree on the same path:

| Path | Under `expressionRefs` | Under a unit snapshot |
|---|---|---|
| `@self.health` | `{value, max}` | a **number** (`snapshot.mjs:159`) |
| `@self.health.value` | the number | `undefined` |
| `@self.agility` | `{value, …}` | a **number** |

`num()` throws on a non-finite value, so a predicate written against the wrong shape does not fail
quietly — it raises *"Predicate reference did not resolve to a number"* mid-resolution. That is
better than silence and worse than a build error.

**DECISION.** The builder offers a **scoped** reference picker rather than one flat list. Each
predicate site declares which refs are in scope and which shape they take, in the same
`facets.mjs` table:

```js
export const REF_SCOPES = Object.freeze({
  // Where `expressionRefs` supplies the root: rule element magnitudes and
  // most element predicates.
  ownerOnly: { roots: ["self"], shape: "document" },
  // The damage pipeline and targeting resolution.
  exchange:  { roots: ["self", "target", "attack", "board"], shape: "snapshot" },
});
```

…and each ref path declares its type (`number`, `rank`, `object`) so the picker only offers paths
that can answer the operator being built. A `rankGte` row offers only rank-typed paths.

**This design does not unify the two shapes.** That is a real inconsistency in the engine and
fixing it means touching `expressionRefs`, four call sites and every magnitude that reads
`@self.health.value` — a change with its own blast radius that deserves its own decision. What this
design does is **stop the editor from producing a path that cannot resolve where it sits**, and
record the divergence where the next person will find it. Recorded in Ch. 41 as an open question.

### 5.1 Reuse

`formRows`'s `predicateList` branch delegates to the builder, so every one of the 54 rule elements,
24 requirement kinds and 20 phase kinds that carries a predicate gets it at once — the point of
having done the descriptor work first.

---

## 6. `explain()`

`describe()`'s `humanize()` is replaced by a lookup: parse the option into subject + facet +
segments, find the facet, interpolate its `prose`. An unknown option falls back to today's
mechanical split rather than throwing — a compendium from a module may name anything.

This is the half of §24.4 that has been half-delivered since it was written: predicates are data so
a failed one can say *"requires: target has the Large attribute (target does not)"*, and what it
actually says is *"target attribute = large"*.

---

## 7. Acceptance

1. `EMITTABLE` is generated, and a test proves the generated set accepts and rejects exactly what
   the 37 hand-written regexes did.
2. The guard covers **236** references, not 147, and a companion test fails if a new predicate site
   escapes the collector.
3. `npm run validate:content` **errors** on `self:stanse:dismounted` and on
   `self:phase:tuesday`; both pass today.
4. Achilles's `["self:stance:dismounted"]` is built in the editor from three dropdowns, and the
   sentence under it reads *"self is dismounted"*.
5. A failed `target:attribute:large` in the audit trail reads *"the target has the Large
   attribute"*.

---

## 8. Non-goals

- **Not** unifying the two `refs` shapes (§5.2, §11.1). The builder is scoped so it cannot emit
  an unresolvable path; making `@self.health.value` mean one thing everywhere is its own change.
- **Not** closing the `open` value kinds. Field ids, regions, variants and attributes are authored
  data with no registry; the design *declares* them unchecked rather than pretending.
- **Not** fixing `chanceWhen`. Its field is misnamed and its evaluator is bespoke; renaming it is a
  content migration, and this spec only excludes it from the collector with a comment saying why.
- **Not** touching `rollOptionsFor`'s logic. It gains an `emit()` helper; which options it decides
  to emit for a given board is unchanged.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Generating `EMITTABLE` changes what is accepted, silently | The equivalence test in §7.1 runs against the current corpus **and** a fixture of deliberate near-misses, before anything is built on it |
| Promoting the build check surfaces real content errors | Expected. Stop and report; do not edit content — see §4.2 |
| The `registry` kind needs loaded packs, which the build has and the editor may not | Build-time validation is authoritative; the editor's picker is advisory and accepts a typed value with a warning |
| The row builder cannot express something a GM needs | Raw text stays, per the editor spec's D6, and the builder must round-trip anything it renders |

---

## 10. Resolved questions

### 10.1 `attribute` stays `open` — and this is load-bearing

**The question.** Attributes are granted by content and closed over an implication table
(`domain/attributes.mjs`), so a registry built from the packs looked feasible: enumerate every
attribute any unit declares, plus the implications, plus the derived `magus`.

**The answer is no, and the evidence is decisive.** Measured across `packs/_source`: **30 distinct
attributes** are authored on units. Predicates reference two that are **not among them**:

| Attribute | Referenced by | Granted by |
|---|---|---|
| `outsider` | `class-skills/alter-ego.yml` (×2) | nothing |
| `undead` | `scathach-god-slayer.yml`, `effects/alpi.yml` (×2), `effects/dmg-up-gods.yml` | nothing |

These are **forward references to Servants that have not been built yet** — the corpus is 29 test
Servants short. A `registry` kind that *errored* would fail the build on six legitimate clauses in
four files.

The build already has the precedent and gets it right: it emits
*`alter-ego.yml: references "existenceOutsideTheDomain", which no authored document provides yet
(declared, inert)`* as a **warning**. That is the correct treatment, and it generalises.

**DECISION.** `attribute` is `open`. More broadly, **`registry` warns, it never errors** — a
content vocabulary that is still being written must be able to name what is coming. Only `closed`
kinds error, because an enum in `domain/enums.mjs` is not going to gain a member because somebody
authored a typo.

*Advantage of the rejected approach:* a registry would have caught a genuine typo like
`target:attribute:femail`. *Cost:* it would have blocked authoring forward, which is exactly what
this project is doing right now. The warning keeps most of the benefit — an author who mistypes
gets told — without the block.

### 10.2 `blockedWhen` is not a predicate

**The question.** `blockedWhen` sits beside `requirements` on a command spell and looked like it
might carry predicates.

**The answer is no.** It is `{state, condition}`, and `rules/command-spells.mjs:86` matches `state`
against `ctx.state` and hands `condition` to `conditionHolds` — a switch with **exactly one case**
(`damageWouldDefeatServant`) and `default: false`. No roll options, no operators, no predicate
evaluator. It is a third mini-vocabulary beside predicates and requirement kinds.

**DECISION.** Excluded from the collector, with a comment saying why, exactly as `chanceWhen` is.

**Noted in passing, not fixed here:** `conditionHolds`'s `default: false` means any condition string
other than the single implemented one silently never blocks — the same defect shape as
`meetsRequirement`'s default, and the reason both requirement vocabularies are drift-tested. There
are two authored uses and both name the implemented condition, so nothing is broken today. A
two-line guard would close it; it belongs to the command-spell vocabulary, not this one.

---

## 11. Open questions

1. **The two `refs` shapes should probably be unified.** `@self.health.value` resolves under
   `expressionRefs` and is `undefined` under a unit snapshot (§5.2). This design routes around it
   with scoped ref pickers rather than fixing it, because unifying touches `expressionRefs`, four
   call sites and every authored magnitude that reads a path. Recorded for Ch. 41.
2. **Should `chanceWhen[].predicate` be renamed?** It is not a predicate (§1.3) and its name is the
   only reason anyone would think so. A rename is a content migration across the effects pack;
   cheap, but out of scope here.
