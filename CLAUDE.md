# FGT_FVTT_v2

## Agent skills

### Code search

Two graphs, both live: **CodeGraph** (`.codegraph/`) for symbol impact before an edit, **graphify**
(`graphify-out/`) for shape and reach. Consult one before changing a symbol; prefer one over grep to
locate code. Grep stays correct for what a graph does not model — templates, authored content, lang
strings — and for **proving an absence**, which a graph can never do. See `docs/agents/code-search.md`.

### Issue tracker

Issues live as GitHub issues on `zarex97/FGT_FVTT_v2`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Silent Drops

This project's costliest defect is the **Silent Drop** (`CONTEXT.md`): a Hop on an Authored Key's Route
discards it and nothing fails. When a change adds or moves an Authored Key, a field, or its reader:

1. Declare it on the DataModel. `npm run validate:content` runs the model check and names what else is missing.
2. Give it a route in `test/unit/survival.test.mjs`: projected, or read from the document by a named file.
3. Build test subjects with `test/helpers/subject.mjs` — authored input through the real projection. Data that is not authored follows the same rule: see *Assumed shape* under Lessons.
4. Run tests against real Foundry: `FOUNDRY_PATH`, default `../foundryVTT_copy`. A missing copy fails.
5. Prove "unread" or "never written" with grep; `test/unit/field-ledger.test.mjs` does it for every field.

The map of Hops is in `docs/07-schemas.md`, the guards in `docs/44-testing.md`, the reason in ADR-0006.

### Surprises

When the board, a test or the user contradicts what the design or I expected, record it with the
`record-surprise` skill before the turn ends. `/review-surprises` fuses them into patterns and the
lessons below. The records live in `docs/surprises/`.

### Lessons

One line per pattern `/review-surprises` confirmed, each linking its file in `docs/surprises/patterns/`.

- **Producer without consumer.** "Built" means everything a feature emits has a consumer: grep for the reader of each hook, key, option and record before calling it done. [pattern](docs/surprises/patterns/producer-without-consumer.md)
- **Two readers, one rule.** When adding or fixing a rule, find every other place that answers the same question and make them call one reader. [pattern](docs/surprises/patterns/two-readers-one-rule.md)
- **Assumed shape.** Before keying on a name or shape, read one live object of it, and build test data from that live shape. [pattern](docs/surprises/patterns/assumed-shape.md)
- **Hidden timing rule.** For every "first", "then", "if defeated" or "when X" clause, find the key that sets its timing and press the order live. [pattern](docs/surprises/patterns/hidden-timing-rule.md)

### Two workplaces

This PC and a VPS (`ssh foundry-dev`), each with its own clone, Foundry and copy of world `fgt2026`.
Code moves by git; the world is copied one way, never merged; one licence runs one Foundry at a time.
See `docs/agents/vps.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
