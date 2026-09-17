# 02 — Architecture: Five Layers, and the One Place That Writes Unit State

## What it is

The system rests on two structural rules, and almost everything else is a consequence of them.

The first is a **one-way import boundary**: `module/` is divided into layers, each layer may
import only from layers below it, and the direction is enforced by a script that runs in
`npm run lint`. The purpose is testability — the pure layers hold the game's rules and must run
without Foundry present.

The second is a **single write choke point for unit state**: deciding what should happen to a Unit
and actually writing it are separated by a data type — an *intent* — and every such write funnels
through one function that validates, orders, batches, and dispatches them
(`module/engine/applier.mjs`), onto one adapter (`module/engine/io.mjs`).

**That rule used to be stated far more broadly here, and the broad version was false.** This chapter
claimed that *"no code anywhere in the system calls `actor.update()` directly"*, and
`applier.mjs`'s own header called itself *"the only place in the system that writes documents"*.
Nothing had ever counted. `tools/check-writes.mjs` now does: **192 write sites across 41 files**, of
which `io.mjs` accounts for about a quarter. The rest fall into categories the intent vocabulary was
never meant to carry, and one that is honest debt:

| Category | What it is | Why it is not an intent |
|---|---|---|
| `message-flag` | The Combat Process state machine on its chat card | Presentation and coordination state, not a Unit's |
| `scene-lifecycle` | Regions, RegionBehaviors, Levels, Tokens | Created and destroyed, not patched; an intent names a Unit and a field, and these have neither |
| `combat-document` | The ◈ clock, turn order, budgets, the log | Not about a Unit at all |
| `ui-edit` | A person editing a document through its own sheet | A rule is not resolving; a human is typing |
| `migration` | Rewriting stored documents wholesale | That is what a migration *is* |
| `socket` | The GM's side of a player's request | Its `applyIntents` op still goes through `io` |
| `debt` | Eleven files writing unit state with no intent for it | Nothing — these should be intents |

Both rules are mechanical rather than aspirational: each is enforced by code that fails the build,
not by review. The layer rule is enforced by `tools/check-layers.mjs`; the write rule by
`tools/check-writes.mjs`, which gates the **file** rather than the line — a file already permitted to
create its own Regions may create one more, and a file that has never written a document and starts
is the thing worth a conversation. Each entry carries the category and a reason, because an allowlist
without the sentence next to it records only that something was there first. An exception that stops
being needed fails the build too, so the list shrinks instead of ossifying.

**The narrow rule is worth more than the broad one was.** A stated invariant that overstates itself
is worse than a smaller one that holds: somebody trusts it, reasons from it, and is wrong — which is
exactly what happened to the architecture review that produced this correction. That distinction is
the subject of the first entry under *Traps and anti-patterns* below.

## Where it lives

| File | Role |
|---|---|
| `eslint.config.mjs` | Declares `LAYERS` and the `ALLOWED` table — the single source of truth |
| `tools/check-layers.mjs` | Enforces `ALLOWED`; runs as part of `npm run lint` |
| `tools/check-writes.mjs` | Enforces the write allowlist, by file and category; runs as part of `npm run lint` |
| `module/fgt.mjs` | System entry point — the init/setup/ready sequence |
| `module/config.mjs` | `CONFIG.FGT` — the public configuration surface |
| `module/settings.mjs` | Game settings registration |
| `module/engine/intents.mjs` | The intent vocabulary, ordering and validation |
| `module/engine/applier.mjs` | The write choke point |
| `module/engine/io.mjs` | The concrete write adapter — the `io` the applier calls |
| `module/domain/stamped-record.mjs` | The Turn and Round Records — a rule both the schema and the write path derive from |
| `module/net/socket.mjs`, `module/net/operations.mjs` | The GM proxy, for writes a client may not perform |

## How it works

### The layer boundary

Nine layer names are declared, in one line (`eslint.config.mjs:17`):

```
domain · rules · engine · data · documents · apps · canvas · net · regions
```

`ALLOWED` states what each may import (`eslint.config.mjs:20-30`):

| Layer | May import from |
|---|---|
| `domain` | *(nothing)* |
| `rules` | `domain` |
| `data` | `domain` |
| `net` | `domain` |
| `canvas` | `domain`, `rules` |
| `documents` | `domain`, `rules`, `data` |
| `regions` | `domain`, `rules`, `data` |
| `engine` | `domain`, `rules`, `data`, `documents`, `net` |
| `apps` | *(everything)* |

The shape to read off this table is a **purity gradient**. `domain/` imports nothing and is pure
arithmetic and value objects. `rules/` adds only `domain` and holds the game's decisions — it can
compute what *should* happen without a world existing. `engine/` is the first layer allowed to
reach documents, and it is where orchestration and writing live. `apps/` sits on top and may
reach anywhere, because a UI legitimately needs all of it.

Files directly in `module/` — `fgt.mjs`, `config.mjs`, `settings.mjs` — belong to **no** layer and
may reach anywhere. That is the bootstrap exemption, and `layerOf` returns `null` for them
(`tools/check-layers.mjs:47-62`).

Enforcement resolves each import specifier against the importing file's directory before
classifying it, so `"../domain/x.mjs"` and `"../../module/domain/x.mjs"` are recognised as the
same edge (`tools/check-layers.mjs:75`). That second spelling is exactly how the original
violation evaded a pattern-matching rule.

Three violations are recorded rather than waved through, each with the reason it exists and what
would remove it (`tools/check-layers.mjs:100-121`):

| File | Imports | Why it stands |
|---|---|---|
| `module/documents/combat.mjs` | `engine` | Reads turn order and the faction roster. Turn order is pure and belongs in `rules`; moving it clears this. |
| `module/engine/attack.mjs` | `apps` | The attack flow renders its own chat card, and Process state lives on a message flag. The fix is an event the `apps` layer subscribes to. |
| `module/net/operations.mjs` | `engine` | The socket operation table statically imports `validate`. The dynamic imports are lazy on purpose; the static one would move. |

The allowlist is bidirectional: **new violations fail, and a stale entry also fails**, so the list
cannot quietly outlive the debt it records (`tools/check-layers.mjs:95-96`).

### The write boundary

An **intent** is a plain object describing one change. The legal set is frozen at 33 types
(`module/engine/intents.mjs:23-36`):

```
damage · heal · statDelta · applyEffect · removeEffect · move · setFacing · defeat
dismissSummon · durationDelta · suppressRule · rewind · markGlassGameSpent · resource
cooldown · spendCS · markTurn · prompt · log · itemQuantity · itemGrant · markContract
grantCommandSpells · consumeUse · setMode · setStance · recordUse · extendEffect
shieldDelta · recordAttack · suspendSkill · setStage · event
```

The comment above that list states the rule for extending it: *"A type here, a constructor below,
an ORDER rank, and an applier case: all four, or `applyIntents` throws the whole batch out"*
(`module/engine/intents.mjs:33-34`). It is written there because two types once shipped with
three of the four.

A batch flows through `applyIntents` (`module/engine/applier.mjs:76-115`) in this order:

1. **Resolve effects.** Unresolved `applyEffect` intents go through the effect flow first
   (`module/engine/applier.mjs:83`). This happens here, not in the caller, because three paths write to the
   world without going through the world helper — the attack flow, the scheduler's boundary
   sequences, and the movement hook — and putting the step in one of them would leave the other
   two applying bare effect intents (`module/engine/applier.mjs:77-82`).
2. **Validate.** `I.validate` checks every intent against the frozen type list and the numeric
   field rules (`module/engine/intents.mjs:582`). Any problem rejects the **whole batch** with a thrown error
   naming its source (`module/engine/applier.mjs:84-88`).
3. **Order.** `I.order` sorts by each type's `ORDER` rank, stably, so equal ranks keep their
   original sequence (`module/engine/intents.mjs:521-526`). Two ranks are computed rather than looked up: a
   revival heal sorts just after `damage`, and a heal whose maximum is raised by an effect in the
   same batch sorts just after `applyEffect` (`module/engine/intents.mjs:542`, `module/engine/intents.mjs:548`).
4. **Split by authority.** `planApplication` divides the batch into `local`, `remote` and
   `prompts` (`module/engine/applier.mjs:38-57`). A GM takes everything locally; a player takes what it owns and
   proxies the rest to the GM over the socket.
5. **Write.** Local intents are grouped and written through the injected `io`
   (`module/engine/applier.mjs:90-92`).
6. **Convergence hooks.** Two reactions run over what was actually written, rather than at each
   call site: `noteDebuffs` queues automatic counters for every debuff that landed
   (`module/engine/applier.mjs:105`), and `notePlatformDeactivations` switches off platforms whose owner was hit
   by a disabling effect (`module/engine/applier.mjs:110`).
7. **Dispatch the rest.** Remote intents go to `io.proxy`; prompts go to `io.prompt`
   (`module/engine/applier.mjs:111-112`).

`applyWorldIntents` is the entry point against the live world and has **53 callers** across the
engine and the apps layer (`module/engine/applier.mjs:214-225`). It imports `io.mjs` lazily, because
`applier → io → socket → operations → applier` would otherwise be a static import cycle
(`module/engine/applier.mjs:215-218`).

`worldIO()` is the concrete adapter, and it is where a unit-state `actor.update()` is finally
called. It is **not** the only place `actor.update()` is called — see the table above, and
`tools/check-writes.mjs` for the full accounting.

`worldIO()` is also the seam the applier's tests inject a fake at, which has a consequence worth
stating plainly: the fake stands in for `io.mjs` itself, so **`io.mjs` is executed by none of the
suite's 214 test files.** `test/unit/actor-fields.test.mjs` reaches it by reading the file as *text*
and regexing out `"system.x"` literals, because that is the only way in. Ch. 44 covers what is being
done about that.

## Invariants & edge cases

1. **A new intent type needs four edits.** Type, constructor, `ORDER` rank, applier case. Three
   of four throws the batch out (`module/engine/intents.mjs:33-34`).
2. **A malformed batch is rejected whole.** There is no partial application and no salvage path;
   the error names the source string the caller passed (`module/engine/applier.mjs:84-88`).
3. **Bootstrap files belong to no layer.** `fgt.mjs`, `config.mjs` and `settings.mjs` may import
   anything. Adding a file directly under `module/` silently opts it out of the boundary
   (`tools/check-layers.mjs:47-62`).
4. **`log` intents are never proxied.** They carry no authority, so they are written by whoever
   produced them — duplicating one is harmless, dropping one loses audit history
   (`module/engine/applier.mjs:51-54`).
5. **A `null` Health maximum means the unit has no Health resource**, not zero Health. `adjustHealth`
   refuses the write rather than creating the pool — Pale Rider and the Kagome Spirits depend on
   this (`module/engine/io.mjs:210`).
6. **The convergence hooks are guarded on `game`**, not on the caller, so `applyIntents` stays
   exercisable by unit tests with an injected `io` and no Foundry globals present
   (`module/engine/applier.mjs:120-122`, `module/engine/applier.mjs:186`).
7. **Counters are queued, never resolved inside a write.** A Counter is a full declaration, and
   opening one from inside the write path would re-enter the applier (`module/engine/applier.mjs:103-104`).
8. **The layer allowlist fails in both directions.** Fixing a listed violation without removing
   its entry fails the check (`tools/check-layers.mjs:95-96`).

## Traps and anti-patterns

**Stating an invariant more broadly than it holds.** This chapter opened by claiming *"no code
anywhere in the system calls `actor.update()` directly"*, and `applier.mjs` called itself *"the only
place in the system that writes documents"*. Both were written in good faith about the intent
vocabulary and neither was ever counted; the real number is 192 sites across 41 files. The cost is
not the inaccuracy — it is that an architecture review read the claim, reasoned from it, and designed
a refactor on the premise that putting a seam under `io.mjs` would capture the system's writes. It
would have captured a quarter of them. **A stated invariant is load-bearing whether or not it is
true**, so state the narrow one that holds and enforce it (`tools/check-writes.mjs`) rather than the
broad one that reads better.

**Documenting a rule without enforcing it.** The layer boundary was written down, and
`eslint.config.mjs` *computed* the `zones` table from `ALLOWED` — but nothing consumed it, because
enforcement needs `eslint-plugin-import`, which was never a dependency. So the project's central
architectural rule was documented, computed, and unchecked for most of its life. It was found the
honest way: `module/rules/environment.mjs` imported `engine/intents.mjs` and lint passed
(`tools/check-layers.mjs:5-18`). **A rule that is right and inert is not a rule.** If a constraint
matters, something must fail when it is broken — here, a twenty-line script beat adding a
dependency.

**Matching import paths as strings.** The violation above evaded detection partly because a
pattern-matching rule sees `"../domain/x.mjs"` and `"../../module/domain/x.mjs"` as different
things. **Resolve the specifier against the importing file's directory before classifying it**
(`tools/check-layers.mjs:75`).

**Widening the rule to fit the exceptions.** Three real violations exist. Adding them to `ALLOWED`
would have said the architecture permits them, which it does not; blocking every commit until
three refactors landed would have meant the rule went on not being enforced. **Record each
exception with the reason it exists and what would remove it, and make a stale entry fail too**
(`tools/check-layers.mjs:90-96`) — so the allowlist cannot quietly outlive the debt.

**Adding an intent type in fewer than four places.** A type needs an entry in `INTENT_TYPES`, a
constructor, an `ORDER` rank, and an applier case. `setStage` and `event` once shipped with three
of the four, which throws the entire batch out at runtime rather than failing at the edit
(`module/engine/intents.mjs:28-35`). **Make all four edits together.**

**Hanging a cross-cutting reaction off one call site.** Auto-counters and platform deactivation
both need to see *every* effect application, whatever declared it — an attack's rider, a Skill's
phase, a field's interior rule, a periodic tick. Four separate hooks would have been four chances
to miss one. **Hang it on the convergence point instead** — here, inside `applyIntents`, which is
the single place every path meets (`module/engine/applier.mjs:96-101`).

## Open questions

- **Four layers or nine?** `eslint.config.mjs:6` says the design *"defines four layers"*, while
  `LAYERS` at line 17 declares nine names. The four-layer reading (`domain → rules → engine →
  apps`) is the conceptual spine and the other five are satellites, but the code does not say so
  anywhere. Worth an ADR.
- **Resolved: the doc references are remapped and now enforced.** 495 `docs/…` references were
  repointed at the rebuilt chapters and 363 stale `§N.N` section anchors stripped — section
  numbers do not survive a renumbering, so an anchor that looks precise is worse than none.
  `tools/check-doc-refs.mjs` now fails the build on a reference that dangles or points into
  `docs/plan-archive/`, and it reads the root configs as well as the walked directories, because
  `eslint.config.mjs` hid a stale reference through an entire remap by not being in one.
- **Confirmed live (the routing half).** `planApplication` was run against a live board with the
  same two-intent batch under three identities. A GM takes both locally; an owner takes both
  locally; a **non-owner sends `statDelta` to `remote` and keeps `log` local** — which confirms
  both the authority split and invariant 4 in one observation. The remaining gap is the socket
  round trip itself: whether the GM receives the proxied batch and applies it identically needs a
  second client connected, and only the Gamemaster was active.
- **Confirmed live.** A batch was applied against a fixture actor with a valid `statDelta` first
  and a malformed intent second. It threw — *"Refusing to apply a malformed intent batch from
  doc-verify: intent[1] (notARealIntentType): unknown intent type"* — and the actor's `system` data
  was byte-identical afterwards. The valid intent that preceded the malformed one wrote nothing,
  so validation does precede every write, and the error does name its source.
