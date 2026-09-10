# The ability editor — design

**Date:** 2026-09-10
**Chapter:** docs/29-user-interface.md §29.6
**Status:** design, awaiting review

---

## 1. What is wrong

The editor is not broken. Measured in `fgt2026`: filling `rank`, ticking `isNP`, adding a phase and
pressing Save writes `rank: "A+"`, `isNP: true`, `phases: [{kind: "damage"}]` to the document
correctly. It is **unreachable** and **radically incomplete**.

### 1.1 Unreachable

`apps/index.mjs` registers exactly one sheet for the `ability` type, and it is `FGTItemSheet`.
Confirmed live — `CONFIG.Item.sheetClasses.ability` has a single entry. `AbilityEditor` is opened
from two places only:

- `apps/actor-sheet/sheet.mjs:369`, the pencil on an ability card of an **actor's** sheet;
- `fgt.api.dialogs.AbilityEditor`, from the console.

So **Items → Create Item → Ability** opens the plain display sheet: a name, a Rank, a Cooldown, and
an empty description. There is no route from a newly created Item to the editor at all. An ability
must already be owned by a Servant before it can be authored, which inverts the order a GM works in.

### 1.2 Incomplete

`AbilityData.defineSchema()` has **90 fields. The editor exposes 12.**

Measured across the 195 authored abilities, class skills and command spells in `packs/_source`, the
most-used fields it cannot touch:

| Field | Files | In editor |
|---|---|---|
| `slug` | 122 | ✗ |
| `timing` | **117 (60%)** | ✗ |
| `requirements` | 61 | ✗ |
| `passiveRules` | 60 | ✗ |
| `damage` | 50 | ✗ |
| `npTags` | 42 | ✗ |

### 1.3 Rule elements are validated and unauthorable

`ability-editor.mjs:345` reads `rules`, `passiveRules` and `activeRules` to **validate** them, and
the footer reports *"This ability has no phases and no rule elements, so it will do nothing"* — while
offering no control that can add one. The only actions in the window are `pickAnchor`, `pickShape`,
`addPhase`, `exportSource`, `save`.

This is the defect shape this project keeps finding in itself: **a rule that is right and inert.**

### 1.4 The typed phase list points at the wrong kinds

`PHASE_FIELDS` types eleven phase kinds. Four of them — `cooldownDelta`, `modifyDamage`,
`overrideValidation`, `teleport` — appear in **zero** authored abilities. Meanwhile nine kinds the
content does use fall through to a raw JSON textarea, including `createField` (8 uses) and `zone` (4).

### 1.5 No hints

**5 `data-tooltip`s across 23 controls**, and three of those are the icon picker and the anchor and
shape schematics. Nothing in the editor explains what a keyword means.

---

## 2. Decisions

| # | Decision |
|---|---|
| **D1** | Cover **everything the content uses**: every field appearing in 2+ shipped abilities, every rule-element key, phase kind, requirement kind and timing window the engine implements. The editor becomes the authoring tool of record; YAML becomes an export format. |
| **D2** | Register the editor as the **default sheet for `ability` and `noblePhantasm` for GMs**; players keep the plain read sheet. This mirrors the split `actor-sheet/sheet.mjs:367` already makes, and for the same reason: the editor writes rule elements, and a player who reorders a phase has changed the ability for the whole table. |
| **D3** | **Step rail** — one document, a left rail listing every section with its completion state. Ordered enough to lead a first author through Akhilleus Kosmos; jumpable enough to fix one cooldown on a shipped Servant. |
| **D4** | **Descriptor-driven forms.** A pure Layer-2 authoring vocabulary describes each keyword; the editor renders forms from descriptors, never from hand-written markup per keyword. |
| **D5** | Every descriptor **must** carry a `hint`. A keyword with no explanation fails the drift test, so the hints cannot rot into decoration. |
| **D6** | The raw JSON pane **stays**, per family, as the escape hatch for anything undescribed. |

### Why D4, and not the alternatives

Hand-writing the UI means the same form shape repeated across 54 rule-element keys, 19 phase kinds,
24 requirement kinds and 18 timing windows — over a hundred little forms — and nothing stops the next
executor added to `EXECUTORS` from silently never appearing in the editor.

Generating from `AbilityData.defineSchema()` was rejected for a concrete reason: the schema carries
no labels, no hints, and no distinction between authored fields and runtime state (`timesUsed`,
`toggledAt`, `lastUsedTick` would all render as editable). Worse, rule elements and phases live in
bare `ArrayField(ObjectField)` — they have **no inner shape to introspect**, so exactly the part that
matters most would generate nothing.

The descriptor table is the pattern `rules/targeting/vocabulary.mjs` already established, and
§29.6's argument for it is unchanged: *"A GM should never have to know that `selfEdgeAdjacent` is the
internal name."*

---

## 3. The authoring vocabulary (Layer 2)

New directory `module/rules/authoring/`, pure data and pure functions, no Foundry globals.

```
module/rules/authoring/
  fields.mjs        the field-type vocabulary shared by every descriptor
  elements.mjs      54 rule-element keys
  phases.mjs        19 phase kinds (20 cases; `applyEffect` is an alias)
  requirements.mjs  24 ability requirement kinds (+ the command-spell list, kept separate)
  timing.mjs        the timing windows and their `against*` modifiers — see §3.4
  ability.mjs       the top-level field groups and the step-rail order
  index.mjs         re-exports, and the `describe(family, id)` lookup
```

### 3.1 Descriptor shape

```js
{
  id: "GrantedAbility",
  label: "FGT.Authoring.Element.GrantedAbility",
  hint:  "FGT.Authoring.Element.GrantedAbilityHint",
  doc:   "11-effect-engine.md#granted-abilities",
  buckets: ["passiveRules", "activeRules", "rules"],
  fields: [
    { key: "abilities", type: "tokenList",     required: true },
    { key: "predicate", type: "predicateList" },
  ],
}
```

`buckets` matters: `OnEvent` belongs in `passiveRules`, `OptionalCost` only makes sense on an active
use. Offering every key in every bucket would author abilities that validate and never fire.

### 3.2 The field-type vocabulary

`fields.mjs` is the closed set of input kinds a descriptor may ask for. The editor has one renderer
per type, so adding a keyword never means adding markup.

| Type | Renders as | Validated by |
|---|---|---|
| `text`, `number`, `checkbox` | the obvious control | — |
| `select` | a dropdown, `choices` from the descriptor or a named provider | membership |
| `rank` | a rank dropdown (`EX, A+, A, …`) | `domain/rank.mjs` |
| `tickExpr` | text with a live "= 22 turns at 3◈" readout | `domain/tick.mjs#parseTick` |
| `effectId` | a dropdown of registered effects | `rules/registry.mjs` |
| `predicateList` | repeatable predicate rows with a term picker | `rules/predicate.mjs` |
| `tokenList` | repeatable free strings (ability slugs, tags) | — |
| `objectList` | a nested repeatable group, described recursively | the nested descriptor |
| `raw` | the JSON escape hatch | `JSON.parse` |

`tickExpr` earns its own type rather than being `text`: every duration and cooldown in the game is
one, `parseTick` already exists, and a typo there is the difference between `5◈+⅓◈` and an ability
that is reusable immediately.

### 3.3 Usage counts

`tools/measure-vocabulary.mjs` walks `packs/_source` and writes
`module/rules/authoring/usage.mjs` — `{GrantedAbility: 10, DamageModifier: 25, …}` — checked in, with
a test asserting it is current. The picker shows *"used by 25 of 195"* beside each keyword, so an
author choosing between `DamageModifier` and `FlatDamage` can see which one the corpus reaches for.

Optional; the editor renders correctly with the file absent, the picker simply omits the counts, and
its drift test skips rather than fails when the file is not there. It is the first thing to cut if
the build cost is not worth it.

### 3.4 Timing windows have no authority — this design creates one

The other three families each have an engine dispatcher to be held against: `EXECUTORS`,
`runPhases`, `meetsRequirement`. **`timing.window` has none.**

`timing` is a bare `ObjectField` (`data/item/ability.mjs:174`). Windows are matched by string
comparison at scattered call sites — `reactions.mjs:113` does
`[sys.timing?.window ?? []].flat().includes(window)` against whatever string the caller passed, and
the only enumerations that exist are two module-local constants (`REACTION_WINDOW`, `ALLY_WINDOW`)
and `ATTACKER_WINDOWS`, which holds two entries. Command spells have a proper `WINDOWS` table
(`rules/command-spells.mjs:33`); abilities do not. Nothing in the content build validates the field.

So the field used by **117 of 195 abilities — 60% of the corpus** — is a free string that nothing
checks. A typo in it produces an ability that authors cleanly, validates, passes CI, and whose
reaction window never fires. That is the identical failure the targeting drift test was written
after, and it is currently live for the single most-used structured field in the content.

**This design therefore adds `module/rules/windows.mjs`**: the enumerated ability window vocabulary,
with `REACTION_WINDOW`, `ALLY_WINDOW` and `ATTACKER_WINDOWS` re-derived from it so there is one list
rather than four. `tools/lib/content.mjs` validates `timing.window` against it, and the editor's
descriptor table is held against it in both directions like the rest.

This is scope the editor did not strictly need — the editor could have offered a dropdown of 18
strings and been useful. It is included because building the picker without the authority would put
a *second* unchecked list beside the first, and because the audit that this design required is what
turned the gap up. It is separable: it can ship as its own commit before any editor work begins, and
probably should.

Note that a window may legitimately be **a string or a list of strings** — Karna's Uncrowned Arms
Mastership carries two, and `reactions.mjs:113` flattens for exactly that reason. The descriptor's
field type is therefore a multi-select, not a select.

---

## 4. The editor (Layer 4)

`apps/ability-editor.mjs` keeps its name, its `#draft`/patch model, its live validation and its
export button. What changes is that its body becomes a rail plus descriptor-rendered sections.

### 4.1 The rail

```
✓ What it is      name, kind, rank, slug, description, icon
✓ Limits          cooldown, duration, cost, uses, round gate, exclusivity, flags
● When it fires   timing window + against-modifiers            ← NEW
  Requirements    the gate list                                ← NEW
  Rule elements   passiveRules / activeRules / rules           ← NEW
✓ Where it lands  anchor + shape (kept) + selection            ← selection is NEW
  What it does    phases
! Check           problems, warnings, and the compile verdict
```

Each row shows `✓` complete, `●` current, `!` empty-but-required, and clicking scrolls to the
section. The rail is the "step by step" affordance without the wizard's cost when editing.

### 4.2 Rule elements — the section that does not exist today

Per bucket (`passiveRules`, `activeRules`, `rules`):

- **Add** opens a keyword picker: search box, grouped by what the key *does* (damage, stats,
  targeting, reactions, grants, visibility), each row showing label, one-line hint and usage count.
- A chosen key renders its descriptor's fields, plus `predicate` (every element may carry one).
- Reorder and remove, as phases already have.
- A raw JSON pane per element for anything the descriptor does not cover.

### 4.3 Phases

The existing list stays. Its typed fields move into `authoring/phases.mjs`, which corrects §1.4:
`createField`, `zone`, `summon`, `check`, `choose`, `expend`, `dragInto`, `createStructure`,
`summonPlatform`, `rollTable`, `channel`, `itemGrant` get described; the four unused kinds keep their
descriptors (the engine implements them, so they must remain reachable) but sort below the ones
content actually uses.

### 4.4 Targeting

`TARGET_ANCHORS`/`TARGET_SHAPES` and the schematic picker are kept unchanged — they are the part of
this editor that already does what §29.6 asked. The section gains `selection`
(`relations`, `includeSelf`, `chooser`), which Akhilleus Kosmos needs and which has never been
editable.

---

## 5. Reach

- `apps/index.mjs` registers `AbilityEditor` for `["ability", "noblePhantasm"]` with
  `makeDefault: true` for GMs, `FGTItemSheet` remaining registered so a player (and a `@UUID` link)
  still lands on the read sheet.
- `FGTItemSheet` gains an **Edit rules** button for a GM who arrived at the plain sheet anyway.
- `apps/actor-sheet/sheet.mjs:369` is unchanged — it already opens the editor.

The GM/player branch lives in one predicate so the two entry points cannot disagree.

---

## 6. Hints and documentation

Two levels, because they answer different questions:

- **`hint`** — one sentence, in the tooltip and under the control on first use. *"The reaction
  window this opens in."*
- **`doc`** — a chapter anchor, rendered as a "read more" link. `11-effect-engine.md`,
  `A-effect-catalogue.md`, `09-targeting.md`, `07-time-model.md`.

Both are localization keys, so §29.9's Spanish target is not compromised by a wall of English help
text. D29.15's prefix rule applies — a test already enforces it.

---

## 7. The contract: drift tests

This is what keeps the editor from decaying back into §1.2. Modelled exactly on
`test/unit/targeting.test.mjs:600-660`, which tests **both directions** because it was written after
the picker offered `point` and the resolver only knew `withinRange`.

| Test | Fails when |
|---|---|
| every `EXECUTORS` key has a descriptor | a rule element is added to the engine and no GM can author it |
| every descriptor names a real `EXECUTORS` key | the picker offers a key nothing executes |
| every `runPhases` case has a descriptor, and back | same, for phases |
| every `meetsRequirement` case has a descriptor, and back | same, for requirements |
| every `windows.mjs` entry has a descriptor, and back | same, for timing windows — **possible only once §3.4's authority exists** |
| every `timing.window` in `packs/_source` is in `windows.mjs` | the corpus already carries a window nothing matches |
| every descriptor has a non-empty `hint` | D5 |
| every `doc` resolves to a file in `docs/` | a help link rots |
| every descriptor field `type` is in `fields.mjs` | a descriptor asks for a renderer that does not exist |
| `usage.mjs` matches a fresh measurement (skipped when absent) | the counts go stale |

The requirement tests use `rules/items.mjs` for abilities and `rules/command-spells.mjs` for command
spells, **separately** — `tools/lib/content.mjs:83` documents why the two lists must not merge:
`servantInZon` asks about somebody else's Servant and `attackIsNotNP` about an attack already being
resolved, so an ability that authored either would be asking a question with no answer.

---

## 8. Acceptance

**The editor can author `packs/_source/abilities/achilles-akhilleus-kosmos.yml` from an empty Item,
through the UI, with no hand-written JSON**, and `Export to pack source` round-trips to YAML that
`npm run validate:content` accepts. Concretely, each of these becomes reachable:

| Clause | Section | Today |
|---|---|---|
| `isNP`, `rank: A+`, `kind` | What it is | ✓ |
| `slug`, `npTags: [barrier]` | What it is | ✗ |
| `expendsPermanently` | Limits | ✗ |
| `timing: {whenAllyAttacked, againstKind: np, againstRank: A, requiresAoE, radius: 2}` | When it fires | ✗ |
| `requirements: [{kind: stance, stance: dismounted}]` | Requirements | ✗ |
| `passiveRules: [GrantedAbility, Knockback]` + predicates | Rule elements | ✗ |
| `targeting.anchor/shape` | Where it lands | ✓ |
| `targeting.selection: {relations, includeSelf, chooser}` | Where it lands | ✗ |
| `phases: [applyEffects → antiPurge, "this turn", uses 1]` | What it does | ✓ |

A golden test authors this ability from descriptors and asserts the result equals the shipped YAML.

---

## 9. Non-goals

- **Not** covering all 90 schema fields. Runtime state (`timesUsed`, `toggledAt`, `lastUsedTick`,
  `expended`, `recordedAttacks`, `active`) is written by the engine and must not be typed by a GM;
  it stays out of the editor entirely, visible only in the raw pane.
- **Not** replacing `tools/validate-content.mjs`. CI remains authoritative for the whole content
  build; the editor validates what decides whether an ability *does anything*.
- **Not** a YAML editor. Export stays one-way; `tools/stage-to-yaml.mjs` is the way home.
- **Not** touching the actor sheet's ability cards.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| 54 + 21 + 24 + 18 descriptors is a lot of prose to write, and a half-filled table is worse than none | Phase it by usage: the 30 rule-element keys content uses come first; the remaining 24 are described before the drift test is switched on, so the test cannot be merged half-satisfied |
| The descriptor abstraction fights an area that needs bespoke UI | Targeting keeps its hand-built picker; the shells for phases and elements are hand-designed. Descriptors fill forms, they do not lay out the page |
| The editor becomes a second source of truth for what content may say | It is not one: every list is derived from the engine's own dispatchers, and the drift tests fail in both directions |
| A GM edits a compendium-derived ability and the next content sync overwrites it | Pre-existing (Ch. 39). The editor should warn when `contentId` is set — noted, not solved here |

---

## 11. Resolved questions

All three were settled at review on 2026-09-10.

### 11.1 The window authority ships first, on its own — **resolved: yes**

§3.4 becomes **Stage 0** of the implementation plan, merged before any editor work starts. It is a
content-correctness fix that stands alone: `rules/windows.mjs`, the four partial lists re-derived
from it, `tools/lib/content.mjs` validating `timing.window` against it, and a test asserting every
window in `packs/_source` is known. Whether or not the editor is ever rebuilt, 60% of the corpus
stops carrying an unchecked string.

Expect it to find things. A field nothing has ever validated, across 117 files, is unlikely to be
uniformly correct — and any window it rejects is an ability whose reaction has never fired.

### 11.2 Predicate authoring gets its own descriptor treatment and its own spec — **resolved: yes**

The predicate grammar (`self:stance:dismounted`, and the `rollOptionsFor` vocabulary behind it) is
its own family with its own authority, and folding it into this design would have made one spec
carry two subsystems.

**Out of scope here. A follow-up spec, to be written before the predicate rows are upgraded.**

Until it exists, `predicateList` renders **validated free-text rows** — each row checked against
`rules/predicate.mjs`'s parser, with the term shown as valid or not. That is a strictly smaller
promise than a term picker, and still a large improvement on the JSON blob predicates live in
today. The plan must not quietly grow a picker; the field type stays free text until that spec
lands.

### 11.3 One editor, branching on item type — **resolved: yes**

**Interpretation, flagged for cheap correction:** the answer is read as confirming the design's
assumption — a single `AbilityEditor` that branches on item type rather than four separate editors.
Scope is therefore `ability`, `noblePhantasm`, `classSkill` and `commandSpell`.

What branches, concretely:

| | ability / noblePhantasm | classSkill | commandSpell |
|---|---|---|---|
| Requirement vocabulary | `rules/items.mjs` (24 kinds) | same | `rules/command-spells.mjs` — **different list** |
| Timing windows | `rules/windows.mjs` (§3.4) | same | `rules/command-spells.mjs#WINDOWS` — **different list** |
| Field groups | full | no `npTags`, no NP scoping | `blockedWhen`, `permanentConsequence`, `effect` |
| Phases | all 19 | all 19 | all 19 |
| Rule elements | all 54 | all 54 | `rules` bucket only |

`tools/lib/content.mjs:83` is explicit that the two requirement lists must not merge — `servantInZon`
asks about somebody else's Servant and `attackIsNotNP` about an attack already being resolved, so an
ability authoring either would be asking a question with no answer. The branch is therefore a
**vocabulary selection**, not a different editor: one shell, one renderer, different descriptor
tables passed in. If that turns out to be wrong, it is wrong in one function.

---

## 12. Deferred

- **Predicate descriptor vocabulary** — §11.2, its own spec.
- **Compendium-derived warning.** A GM editing an ability with a `contentId` set will have it
  overwritten by the next content sync (Ch. 39). The editor should say so. Noted, not solved here.
