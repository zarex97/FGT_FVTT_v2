# The world model borrows Foundry's common layer, and stays harsher than it

`test/helpers/world.mjs` exists because `engine/io.mjs` is 1,429 lines that no test could execute:
the applier takes its write adapter by injection, so the fake the applier's tests inject stands in
for `io.mjs` itself and the seam sits *above* the code that holds the bugs. The model closed that
gap by faking Foundry's globals — hand-written `DataField` classes, a hand-written `TypeDataModel`,
and a documented admission that *"validation is coercion only"*.

Those hand-written fakes are a second spelling of a large, versioned system we do not own. The model
already refuses that duplication one layer in — it loads the project's **real** DataModels rather
than listing their fields, because *"a hand-maintained list here would be a second spelling of the
schema, which is the duplication ADR 0003 exists to avoid"*. Foundry's `common/` is the same
argument one layer out, and it is available: `abstract/_module.mjs`, `data/fields.mjs`,
`documents/_module.mjs` and `constants.mjs` all import into plain Node, and a real
`NumberField({min: 0, integer: true})` clamps `-5` to `0` and rounds `2.7` to `3`.

So the model borrows Foundry's `common/` instead of imitating it, and fakes only the **client**
layer: `game`, `canvas`, `ui`, `Hooks`, and the world collections.

**And it stays deliberately harsher in exactly one place.** Foundry *silently discards* a write to
an undeclared field. The model **throws**. That is less faithful and far more useful: it is how
`io.defeat` was caught writing `system.defeated` to a schema that never declared it, leaving every
defeated Unit in the game a legal target still taking its Turn. Adopting real documents brings
Foundry's silence with them, so the strictness is re-applied on top as a wrapper. **This is not an
oversight to be tidied away** — it is the model's most valuable property, and the first thing a
future contributor would plausibly "fix".

## Considered options

**Broaden the hand-written fakes.** Rejected on scale. Modelling Foundry broadly by hand means
re-deriving a large system from the outside, with the divergences discovered one bug at a time. The
fakes were the right call while the model's ambition was "enough to run `io.mjs`"; they are the wrong
call the moment the ambition is whole flows like `commitWar`, which needs packs, Scenes, Regions,
RegionBehaviors, Combat creation and dice.

**Vendor `common/` into this repo.** Rejected, then rejected again for a better reason. Initially it
was a licence problem: this repo is MIT, Foundry's source is not, and committing 132 proprietary
files into an MIT tree implies a grant that licence cannot make. That constraint lifted — the source
is held under a developer licence in the private `zarex97/foundryVTT_copy` — but a sibling repo is
still better than vendoring: FGT's history stays free of Foundry source, and the licence carve-out
lives in the repo that is already private.

**Skip the model's tests where Foundry is absent.** Rejected. CI is `ubuntu-latest` with no Foundry,
and skipping would remove from CI precisely the tests that catch the io-layer defects the model
exists for. A sparse checkout of `app/common` — 134 files of the sibling repo's 8,806 — costs
nothing by comparison.

**Dual-mode: real `common/` when present, fakes otherwise.** Rejected once the sibling repo was
available, and it is worth recording why it was ever tempting. It keeps CI green without a
credential, but green CI is then evidence about the *fake* while the real mode runs only where
someone has Foundry — the same shape as 4,724 passing tests over a live defect. One implementation,
running identically everywhere, is worth a CI credential.

## Consequences

**The test suite now depends on another repository and a pinned Foundry version.** That is the cost,
and it is real: a contributor needs access to `foundryVTT_copy`, and CI needs a token. The version is
asserted against `system.json`'s `verified` field and fails loudly on mismatch, so a Foundry upgrade
becomes a deliberate two-repo step rather than a mystery in which every test is built on a different
Foundry than the system targets.

**Live verification does not narrow.** Ch. 46's standard holds unchanged: *"Green unit tests are not
evidence."* A deeper model earns speed and coverage, not trust. A behaviour may be promoted to
model-only evidence **per behaviour, never wholesale**, and only when a `check:world` probe covers it
*and* the model has caught at least one real defect in that behaviour first. A passing probe alone is
circular — it proves the model agrees with Foundry on a case somebody already thought of.

**The boundary is fixed, not open.** Canvas and PIXI, rendering and ApplicationV2, sockets, and the
database backend stay out. Those are what `check:smoke` and live verification already cover, so
naming them out of scope is a handoff rather than a gap — and an unbounded "model Foundry broadly"
has no natural stopping point.

The condition that would flip this: **Foundry publishing `common/` as a package.** The sibling repo,
the sparse checkout and the token all exist to work around its not being one. If that changes, this
becomes an ordinary pinned dependency and most of the machinery above can go.
