# The Turn Record's schema is guarded, not generated

The Turn Record and the Round Record are declared twice: as `SchemaField`s in
`data/actor/_shared.mjs#combatantCommon`, and as field defaults in
`domain/stamped-record.mjs`. `test/unit/master-data.test.mjs` asserts the two key sets match, in both
directions. We considered generating the schema from the spec — one declaration, no drift possible —
and rejected it.

The house rule points the other way, and it is stated in the codebase: `rules/facets.mjs:7-18`, from
the commit that replaced 37 hand-written `EMITTABLE` regexes with a facet table, draws the line as
*"the other four authoring vocabularies are held against a dispatcher by a drift test, because a
dispatcher is code. This one is not… so keeping both would be two spellings of one fact, tested to
agree."* A `SchemaField` literal is data on both sides, which puts the record in the `EMITTABLE`
category and says: delete the duplicate.

## Considered options

Generating the schema was rejected on three costs, none of which `EMITTABLE` paid.

**It blinds two existing guards.** `test/unit/actor-fields.test.mjs` scrapes declared field names out
of every file under `module/data` with a regex over the source *text*, and
`test/unit/item-schema-coverage.test.mjs` slices schema bodies out the same way — both because the
DataModels need Foundry's global `fields` to import. A `turnState` built by iterating a spec has no
`name: new fields.X(` lines for either to find, so its sub-keys become invisible to the guard that
exists to catch writes to undeclared paths. That guard was written after `io.defeat` wrote
`system.defeated` to a schema that never declared it and every defeat in the game left the Unit alive
to everything that asked.

**It has no precedent in that directory.** `resourceField(0)` shows a factory returning a field is
idiomatic, but a search for `Object.fromEntries` or `.map(` across all of `module/data` returns
nothing: every schema there is written key by key. Iterating a table into a `SchemaField` would be the
first of its kind, in the layer where a silent mistake is least visible.

**It costs the prose, which is the asset.** Forty-four of the sixty lines in the `turnState` block are
comments, and they are not decoration: Karna's Kavacha and Kundala explaining why `inCombatPhase` is
distinct from both `acted` and `attacked`, Jack's Mist explaining why `reshapedField` is its own flag
and not `usedActiveSkill`, issue #28 on `namelessForestAttempts`. A spec table of defaults cannot hold
them, and a `domain/` module full of Servant-specific rationale is the wrong home. `EMITTABLE`'s table
was *more* expressive than the regexes it replaced; this one would be strictly less.

Against those, what generation buys over a drift test is nothing. The failure mode is a field added to
one side and not the other, and the test catches exactly that, naming the field.

## Consequences

The duplication is real and stays: adding a field to the record means editing two files. The drift
test makes that a build failure rather than a rule that quietly never fires, which is the only way
this has ever gone wrong — twice, both schema-first. `reshapedField` was declared and not projected,
so `mayReshape` kept saying yes to a Servant who had already redrawn. `abilitiesUsed` was missing from
both branches of the projection, so `oncePerTurn` refused nothing.

The condition that would flip this: **a third consumer of the field list.** Two spellings tested to
agree is a fair trade; three is not, and at that point generating from the spec — and teaching the two
text-scraping guards the new form — becomes the cheaper side. `clearTurnState` was very nearly that
third consumer, carrying its own eight-key literal of a fourteen-key record, and it was deleted rather
than corrected.
