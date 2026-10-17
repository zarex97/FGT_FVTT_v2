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

- **Producer without consumer.** "Built" means everything a feature emits has a consumer: grep for the reader of each hook, key, option and record before calling it done, and give every outcome (resisted, ended, deferred) a line a player sees, naming who and the real change, read on screen as a player would. [pattern](docs/surprises/patterns/producer-without-consumer.md)
- **Two readers, one rule.** When adding or fixing a rule, find every other place that answers the same question and make them call one reader. The preview, the bar and the card are readers too, and so is every door the engine opens on a Unit's behalf, and every option set a predicate is tested against, wherever it is built. A Unit named on a line or a prompt is `publicIdentityOf`'s. When a lesson lands, sweep the old sites too. [pattern](docs/surprises/patterns/two-readers-one-rule.md)
- **Assumed shape.** Before keying on a name or shape, read one live object of it, and build test data from that live shape. The environment a test runs in and what a library call returns are shapes too. [pattern](docs/surprises/patterns/assumed-shape.md)
- **Role keyed on type.** When code asks about a role (Master, summoner, owner, guard), ask about the relationship that confers it, the contract, never the actor's type, its side or what it carries; a role is held in this war, on this board. [pattern](docs/surprises/patterns/role-keyed-on-type.md)
- **Hidden timing rule.** For every "first", "then", "if defeated" or "when X" clause, find the key that sets its timing and press the order live. A boundary reads the cycle that ended, not the live clock. For each event, ask who hears it and what already exists when it fires. [pattern](docs/surprises/patterns/hidden-timing-rule.md)
- **Generic path escapes the special case.** When a sheet bends a generic mechanic, list every exit the generic path offers (edges, toggles, prompts, buttons, revivals) and close each one the sheet rules out, in the engine and not only on the bar, best at the one door every path passes. [pattern](docs/surprises/patterns/generic-path-escapes-special-case.md)
- **Check-then-act race.** When several async flows can reach one decision together (a fan-out's Processes, a hook burst), claim it in memory and make the rest await the claim; never decide from a record a sibling writes later. [pattern](docs/surprises/patterns/check-then-act-race.md)
- **Claim without reading.** A doc line, a glossary entry, a name or one look at the screen is not evidence: read the code, or probe it, before telling the user what it does or proposing to change it, and read the rationale already recorded in the file you would restructure. A ticket's "Differs" line is a claim too: read the path before writing it. [pattern](docs/surprises/patterns/claim-without-reading-the-path.md)
- **Passes for the wrong reason.** A check asserts the reason it fails, not only that it failed; when the test world takes over something a test stubbed, the test fails out loud instead of passing on the new default. [pattern](docs/surprises/patterns/passes-for-the-wrong-reason.md)
- **Unknown value falls to default.** When content gains a value, find the executor's switch and its default branch: an unknown value refuses out loud, and the guard walks every nesting where it can sit. [pattern](docs/surprises/patterns/unknown-value-falls-to-default.md)
- **Press as a player.** Press every player-facing button as Player1, not only as the GM; every write a press makes runs on the active GM, the owner only when no GM is connected. [pattern](docs/surprises/patterns/live-client-only.md)
- **Rule word read one way.** When a sheet phrase can be read two ways, grep the same document's other uses of the term, then put both readings to the user before building; a list two rules share is a reading too, and so is an event's name, read against the clause that listens to it. [pattern](docs/surprises/patterns/rule-word-read-one-way.md)
- **Shared working copy.** When another session may be live in a directory, work in your own worktree and never switch its branch; before blaming a red test, check `git status` for files that are not yours. [pattern](docs/surprises/patterns/shared-working-copy.md)

### Two workplaces

This PC and a VPS (`ssh foundry-dev`), each with its own clone, Foundry and copy of world `fgt2026`.
Code moves by git; the world is copied one way, never merged; one licence runs one Foundry at a time.
See `docs/agents/vps.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
