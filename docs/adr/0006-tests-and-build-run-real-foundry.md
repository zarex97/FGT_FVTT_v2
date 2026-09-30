# Tests and the build run real Foundry, from a private copy

A Silent Drop is the defect this project has paid for most: about fifty fix commits, and in almost
every one the Clause simply did not happen, nothing failed, and the live board was the only detector.
Roughly a dozen of those were Foundry's own data layer discarding a key the schema did not declare,
and nothing in the suite could see them, because no test ran Foundry. The fake in
`test/helpers/world.mjs` imitates the field classes, and every place it imitates them is a place it
can be wrong — it accepted a write beneath a scalar field, kept undeclared keys inside a nested
object, and treated Items, Effects, Tokens and Combats as having no schema at all.

So the unit tests and `build:packs` import Foundry's **real** `foundry.data.fields` and `DataModel`
classes, and every write is checked out loud: a key Foundry pruned, clamped, reset or voided is an
error, not a quiet difference. Foundry is proprietary and this repository is public, so the source
comes from the private `zarex97/foundryVTT_copy` — read from `FOUNDRY_PATH` (default
`../foundryVTT_copy`) on a workstation, and checked out with a secret token in CI. If neither is
present the run **fails**, naming what is missing; it does not skip, because a skipped guard is a
Silent Drop of its own.

## Considered options

**Make the fake stricter.** Cheaper, needs no secret, and runs anywhere. Rejected because it is a
second implementation of Foundry's cleaning rules, maintained by the people whose misunderstanding
of those rules is the bug being caught. It can only ever be as right as our reading of Foundry, and
the failures it missed were exactly the places that reading was wrong.

**Real Foundry locally, skipped in CI.** Rejected: CI is the gate that runs on every push, and the
guard would be absent from it.

## Consequences

- The real classes cover only `common/`: schemas, cleaning, `updateSource`, validation. The client
  layer (the empty-diff skip before a write is sent, and `_preCreate` edits that never reach the
  server) does not import in Node, so those two traps are guarded by a lint rule and proved by live
  probes in `tools/check-world.mjs`.
- The copy must track the Foundry version in `system.json`'s `compatibility.verified`. A Foundry
  upgrade means updating the private copy first, or the tests are checking last version's rules.
- A fork cannot run the suite. This is a single-owner repository, and that is accepted.
- The text-scraping guards (`actor-fields.test.mjs`, `item-schema-coverage.test.mjs`) are replaced
  by checks that read the real schemas. That removes the first of ADR-0003's three reasons for
  guarding the Turn Record rather than generating it; the other two still hold, and so does that
  decision.
