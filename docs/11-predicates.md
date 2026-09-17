# 11 — Predicates, roll options and facets

## What it is

A predicate is **a declarative data structure**, not executable code. The engine builds a set of strings called "roll options" describing the current situation, and authored predicates are boolean expressions over that set. This separation makes content safe to load from untrusted sources, auditable when rules fail, and renderable as prose for players. *"Require: target has the large attribute"* is vastly clearer than a silent `false`.

The predicate vocabulary is itself declared in a single table, `FACETS`, which serves as the authority for what an option *may* name. When there is only one source of truth for valid options, typos in the generator that produce options no predicate can name, and typos in content naming options that nothing emits, become visible at build time rather than silent at runtime.

## Where it lives

| File | Role |
|---|---|
| `module/rules/predicate.mjs` | Predicate evaluation over a roll-option set |
| `module/rules/options.mjs` | Option generation; the vocabulary every predicate is written against |
| `module/rules/facets.mjs` | The facet table and option parsing; authority for what an option may say |
| `module/rules/authoring/predicates.mjs` | Which fields in an authored document hold predicates |
| `module/apps/ability-editor/predicate-builder.mjs` | Building a predicate from dropdowns instead of typing |

## How it works

### Predicates as boolean expressions

A predicate is an implicit AND of statements (`module/rules/predicate.mjs:33`). Each statement has one of seven forms (`module/rules/predicate.mjs:23-30`):

- A bare string: `"target:attribute:large"` is true when that string is in the option set.
- Prefixed with `not:`: `"not:self:skillActive:madEnhancement"` negates the option. This notation was authored in five places since the system began and never implemented — the whole string was looked up as one option, which is never in the set, so *"every such clause was permanently **false**"* (`module/rules/predicate.mjs:61-75`). Penthesilea's Charisma, gated on the negation, contributed nothing.
- Group operators: `{or: […]}`, `{and: […]}`, `{nor: […]}`, `{nand: […]}` — boolean algebra over statements.
- Set membership: `{anyOf: ["option1", "option2"]}` is true if any option is in the set.
- Numeric comparisons: `{gte: [1, 2]}`, `{gt: […]}`, `{lte: […]}`, `{lt: […]}`, `{eq: […]}` — both operands are `ValueRef` (number or `@`-path).
- Rank comparisons: `{rankGte: ["@target.parameters.str", "B"]}`, `{rankEq: […]}` — supports `+n` / `-n` step suffixes like Karna's *Brahmastra* (`module/rules/predicate.mjs:128-144`).

Evaluation is pure — `test(predicate, ctx)` consumes a snapshot and a roll-option set, returns a boolean, and requires no Foundry present (`module/rules/predicate.mjs:51-54`).

### Option generation

The engine calls `rollOptionsFor` once per attack with attacker, defender, and attack metadata (`module/rules/options.mjs:41-144`). That single call builds a set of every option describing the situation and both units.

**Who generates options.** The vocabulary lives in `rollOptionsFor` and the `add()` helper. A unit contributes options for its type, attributes, effects, skills, parameter ranks, stance, terrain, fields it occupies or owns, distances to allies and Masters, contracted status, and much more (`module/rules/options.mjs:235-495`). The attack contributes its kind, component, element, NP scale (as a ladder, for "scale or higher" comparisons), range (as a ladder), whether it crits, pierces, aims, and what attributes it hits specially (`module/rules/options.mjs:41-127`). Parameter comparisons between attacker and defender emit one of three options per parameter — `gt`, `eq`, `lt` — computed rather than assumed (`module/rules/options.mjs:193-206`).

**Three options that were missing.** `target:skill:divinity` was authored in `domain/tables.mjs` since transcription and **nothing emitted a `skill:` option**, so the Divinity-versus-Divinity clause could not fire. Distance was never emitted either, leaving EMIYA's range-based sheet inexpressible. And nothing emitted terrain, so Nemo's *"when Nemo is within a 'Waterside' or 'Imaginary Numbers Space' area"* could not be written at all (`module/rules/options.mjs:1-21`). All three are now emitted.

**Ladders.** For any threshold comparison ("rank B or higher"), a predicate can only test set membership, so `rank:gte:B` has to already be in the set. The code emits a ladder: a `B`-rank parameter emits `rank:gte:E`, `rank:gte:D`, `rank:gte:C`, `rank:gte:B` (`module/rules/options.mjs:409-420`). Same for range, NP scale, and distances to Masters/partners (`module/rules/options.mjs:136-141`, `module/rules/options.mjs:322-347`).

**Unranked parameters emit nothing.** A unit with no MAG rank does not hold `rank:mag:gte:E` and no clause requiring one can be accidentally satisfied. Karna's *Brahmastra* compares both units' parameters and emits `target:paramVsSelf:${parameter}:gt/eq/lt`, only for parameters both sides rank (`module/rules/options.mjs:193-206`).

### The facet table

`FACETS` is an array of 45 descriptors, each declaring one option family (`module/rules/facets.mjs:76-424`). Each facet has:

- `subjects`: which entity(ies) it applies to — `["self", "target"]`, `["attack"]`, `["revival"]`.
- `segments`: the variable parts of the option string and the authority for each (an enum, a registry, or free-form).
- `prose`: a template rendered to English, so `explain()` reads a predicate as the sentence its author meant.

Three value kinds enforce strictness differently (`module/rules/facets.mjs:19-34`):

- **`closed`** errors: An enum in `domain/enums.mjs`. A typo in an authored predicate costs nothing — the vocabulary is fixed — and the build fails loud.
- **`registry`** warns: A growing vocabulary like ability slugs or effect names. Content naming what does not exist yet is legitimate, so it warns rather than erroring.
- **`open`** accepts anything matching the shape (usually an identifier). The descriptor says so, and 21 facets use it (`module/rules/predicate-builder.mjs:188`).

Five facets formerly used `open` but should have used `closed` — `self:highestParameter:strength` passed validation for years and could never match because the parameter is `str` (`module/rules/facets.mjs:32-35`).

Facets are generated into `GENERATED_EMITTABLE` — a list of regex patterns one per form per subject (`module/rules/facets.mjs:459-460`). This is the authority for what `rollOptionsFor` may emit and what content may name, and violations in either direction are visible at build time: typos in the generator itself, and options no facet admits.

### Predicate rendering

`explain(predicate, ctx)` returns an array of `{text, passed}` objects, one per statement (`module/rules/predicate.mjs:174-177`). An option is parsed against `FACETS`, and its template is rendered with the option's segments interpolated. An option no facet admits falls back to mechanical split — `target:something:odd` → `"target something = odd"` — rather than throwing, because a module's compendium may name anything (`module/rules/predicate.mjs:196-243`).

### Authoring predicates

Predicates hide in six fields: `predicate`, `attackPredicate`, `targetPredicate`, `requiresRecipient`, `chanceWhen`, and `floorPredicate` (`module/rules/authoring/predicates.mjs:36-48`). A collector walks every document looking for these fields and validation tests them against `isEmittableOption` for every option the predicate mentions, catching typos at build time (`module/rules/authoring/predicates.mjs:72-125`).

Three fields look like predicates and are not: `chanceWhen` is matched by bespoke string compare that strips `attack:kind:`, and `blockedWhen` is a `{state, condition}` switch with no roll options at all (`module/rules/authoring/predicates.mjs:55-64`).

### The predicate builder

The ability editor offers dropdowns instead of typing. `builderRows` renders a predicate as UI rows; `toPredicate` turns rows back into a predicate (`module/apps/ability-editor/predicate-builder.mjs:89-101`). The round-trip is the invariant: opening an ability and pressing Save must not rewrite correct rules (`module/apps/ability-editor/predicate-builder.mjs:7-11`). A statement the builder cannot model becomes a `raw` row carrying its JSON, which is preserved on rebuild — nothing is silently dropped (`module/apps/ability-editor/predicate-builder.mjs:13-16`).

Comparisons offer `@`-paths scoped to the context: `ownerOnly` has only `self`, while the damage pipeline's `exchange` context has `self`, `target`, `attack`, and `board` (`module/rules/facets.mjs:507-515`). The two `self` shapes disagree — `@self.health` is `{value, max}` under `expressionRefs` and a **number** under a unit snapshot — so the picker must scope its paths or emit references that cannot resolve (`module/apps/ability-editor/predicate-builder.mjs:34-80`).

## Invariants & edge cases

1. **A predicate is an implicit AND.** `test` returns `true` only if every statement passes (`module/rules/predicate.mjs:51-54`).

2. **The `not:` prefix applies to one option, not a whole statement.** `"not:target:skill:divinity"` is a bare string negating the option that follows, distinct from `{not: "target:skill:divinity"}`, the object form (`module/rules/predicate.mjs:20-78`).

3. **Unranked parameters participate in comparisons by their absence.** Karna's *Brahmastra* compares all five parameters — a unit with no MAG rank does not hold the MAG comparison option, so the clause *"all Parameters equal or lower"* reads as satisfied for the ones it has (`module/rules/options.mjs:176-186`).

4. **`@` paths are scoped to the context.** `@self.health` is `{value, max}` in one context and a **number** in another. Offering one flat picker list produces paths that throw at evaluation time (`module/rules/facets.mjs:494-515`).

5. **An option no facet admits is valid, and falls back to mechanical split.** A module's compendium may name anything. The builder and `explain()` render it rather than refuse (`module/rules/predicate.mjs:196-243`, `module/apps/ability-editor/predicate-builder.mjs:13-16`).

6. **`anyOf` and `referencedOptions` descend together.** A negated option inside `anyOf` is still extracted as the bare name, because the validator checks for typos and the deferral pass asks whose state the clause is about — both want the bare option (`module/rules/predicate.mjs:260-279`).

7. **Comparison operands are polymorphic.** A number stays a number: `{gte: ["@x", 100]}` and `{gte: ["@x", "100"]}` are not the same. The builder preserves the distinction (`module/apps/ability-editor/predicate-builder.mjs:286-292`).

8. **Five facets close over the wrong enum.** `self:highestParameter:strength` never matched because the parameter is `str`. Fixing it requires all five enums to move from `closed` with `open()` to using `closed("PARAMETERS")` properly (`module/rules/facets.mjs:32-35`).

## Traps and anti-patterns

**Never implementing the `not:` prefix.** The notation was authored in five places and documented in the predicate grammar, but the prefix was never actually parsed. The string `"not:self:skillActive:madEnhancement"` was looked up whole as one option, which is never in the set, so every such clause was permanently **false** (`module/rules/predicate.mjs:62-75`). It cost three rules: Penthesilea's *Charisma* is gated on the negation in both its passive and active form; her Noble Phantasm's three passive clauses use it; and Karna's *Vasavi Shakti* divinity override predicates hinge on `not:target:skill:divinity`. **Implement the grammar, don't write and ignore it** (`module/rules/predicate.mjs:77`).

**Emitting options through templates rather than a table.** The generator emitted options as template literals, so a typo in the generator produced an undeclared option no predicate could name — the opposite mistake from content typos. Three options were missing: `target:skill:divinity` was predicated since transcription and nothing emitted it, so Divinity-versus-Divinity clauses could not fire; nothing emitted distance, leaving EMIYA's range-based sheet inexpressible; and nothing emitted region/terrain, so Nemo's conditional areas could not be written at all (`module/rules/options.mjs:11-21`). **Generate from a facet table that is also the validation authority** (`module/rules/facets.mjs:7-11`), so the generator cannot produce undeclared options and a typo in content becomes visible at build time.

**Closing facets over the wrong enum.** Five facets that hold parameter names were declared with `open()`, accepting anything that looks like an identifier. A clause like `self:highestParameter:strength` passed validation cleanly and could never match, because the parameter is `str`, not `strength`. Validation worked perfectly — it just validated nothing (`module/rules/facets.mjs:32-34`, `module/rules/facets.mjs:156-157`). **Use a closed enum for a fixed vocabulary** — if the value set is frozen, strictness gains nothing and costs it.

## Open questions

- **`chanceWhen` is not a true predicate.** It is matched by `rules/command-spells.mjs#conditionHolds` with bespoke string parsing that strips `attack:kind:`. It appears in the `PREDICATE_FIELDS` list but is enforced by different code and behaves differently (`module/rules/authoring/predicates.mjs:56-59`). Worth an ADR on the collector's scope.

- **Tested live, and the corpus uses none of it — including Karna.** The `@path±N` stepping suffix
  works exactly as specified (`module/rules/predicate.mjs:135-143`): against a Servant at STR **C**,
  `@self.parameters.str+1` clears `C+` but **not** `B`, and `@self.parameters.str-1` clears `C-` but not `C` —
  the dense `+`/`−` ladder, not grades. But `grep -rE '@[a-zA-Z.]+[+-][0-9]' packs/_source/` returns
  **nothing**: no authored clause uses it, Karna included. Karna's *Brahmastra* reaches for a roll option
  instead — `target:paramVsSelf:<p>:gt` — and its own header says why: the emitted `rank:gte:` ladder is
  *"absolute and GRADE-COARSE"*, so `not:target:rank:str:gte:A` reads as "STR is not above B" for a `B+`
  unit (`packs/_source/abilities/karna-brahmastra.yml:37-41`). The stepping suffix answers a different
  question — relative to a fixed rank, not to the opponent's — which is why nothing has needed it yet.

- **Answered: neither. Options are rebuilt at every point of use.** `rollOptionsFor` allocates a fresh
  `Set` on entry (`module/rules/options.mjs:41-43`) and nothing memoizes it — two calls with identical
  input were verified live to return **different objects**. There are 38 call sites across 15 files, the
  bulk in `module/engine/attack.mjs` (15) and `module/engine/skill-use.mjs` (5), each constructing the set
  from whatever attacker, defender and attack facts that site holds. The consequence is the useful one:
  an option set can never be stale, because none is ever stored. The cost is recomputation, paid per call.
