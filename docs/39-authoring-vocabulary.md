# 39 — The Authoring Vocabulary

## What it is

The authoring vocabulary is a **second, GM-facing description of the engine's capabilities**, kept deliberately in sync with what the engine actually does. It is the answer to "what can a GM author?" rather than "how does the engine execute?"

The engine's rules live in pure code: a switch statement in `engine/attack.mjs`, a dispatcher in `engine/skill-use.mjs`, a set of executors in `rules/elements.mjs`. A GM author does not read code. Instead, the ability editor shows a form with labeled fields for "DamageModifier", "CreateField", "ApplyEffects" and so on — and every one of these names comes from a **descriptor**, a frozen data object that holds the id, the label key, the human-readable hint, the field list, and a link to the documentation (`module/rules/authoring/index.mjs:1-3`).

The vocabulary spans six families: elements (rule execution), phases (ability dispatch events), requirements (gating), timings (window conditions), fields (ability properties), and two requirement lists held apart because they serve different dispatchers. Every family is frozen into an immutable table at import time; a malformed descriptor throws before the system boots, not at the moment a GM tries to use it (`module/rules/authoring/contract.mjs:1-3`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/authoring/index.mjs` | Public surface — exports all six families and the `describe()` lookup |
| `module/rules/authoring/contract.mjs` | Descriptor shape validation, the drift helper `casesIn()` |
| `module/rules/authoring/elements.mjs` | 54 rule elements, with predicates and deferred checks |
| `module/rules/authoring/phases.mjs` | 20 phase kinds, with field specs from the corpus |
| `module/rules/authoring/requirements.mjs` | 24 ability requirements and N command-spell requirements |
| `module/rules/authoring/timing.mjs` | Window timings derived from `rules/windows.mjs`, plus `against*` modifiers |
| `module/rules/authoring/fields.mjs` | The closed set of input types: `text`, `number`, `select`, `rank`, `tickExpr`, `effectId`, `predicateList`, and five more |
| `module/rules/authoring/ability.mjs` | Ability fields grouped into sections: identity, limits, timing, requirements, passive, targeting, on-use |
| `module/apps/ability-editor/editor.mjs` | The form renderer — imports all descriptors and validates against engine dispatchers |

## How it works

### Import-time validation

`describeTable()` freezes a descriptor array into an immutable table (`module/rules/authoring/contract.mjs:58-68`). Every entry is checked: missing `id`, missing `label`, missing `hint`, missing `fields`, a field with no `key`, a field with an unknown `type`, a `select` field with no choices — all collected and thrown together, not one at a time (`module/rules/authoring/contract.mjs:28-50`). A table author fixing 54 entries gets one error message listing all problems, not a slow loop.

Malformation at import is the whole point: a descriptor that silently goes missing produces a picker with a gap, and nothing ever looks for a keyword that was never offered (`module/rules/authoring/contract.mjs:7-11`).

### The drift helper

`casesIn()` extracts switch case labels from JavaScript source code (`module/rules/authoring/contract.mjs:81-90`). Given a source file and an optional function name, it finds every `case "x":` label, scoped to that function if needed, and returns them as a Set of strings.

Drift tests use this to hold the vocabulary against the engine in both directions: `test/unit/authoring-elements.test.mjs` reads `EXECUTORS` from `rules/elements.mjs`, extracts its keys, and checks that every one has a descriptor; then checks that every descriptor has an executor (`test/unit/authoring-elements.test.mjs:18-35`). The same pattern holds for phases (`test/unit/authoring-phases.test.mjs`), requirements (`test/unit/authoring-requirements.test.mjs`), and timings.

Because `casesIn()` scopes to a function name, it avoids false matches: `targeting/resolve.mjs` switches on anchors, shapes and selection modes in the same file, and an unscoped read of all three would fail the drift test on things that are not anchors. Scoping lets the test ask only for the function it cares about (`module/rules/authoring/contract.mjs:73-76`).

### Field types are closed

The editor has exactly one renderer per field type — a text input, a number spinner, a select dropdown (`module/rules/authoring/fields.mjs:22-35`). A descriptor asking for a type that does not exist gets rendered as nothing and silently drops the field. `test/unit/authoring-contract.test.mjs` holds every descriptor's field types against the frozen list (`module/rules/authoring/fields.mjs:1-3`).

Twelve types exist: `text`, `number`, `checkbox`, `select`, `range`, `rank`, `tickExpr`, `effectId`, `predicateList`, `tokenList`, `objectList`, `raw`. `tickExpr` earns its own type because every duration and cooldown in the system is one, `parseTick()` already exists to validate it, and a malformed tick makes an ability reusable immediately, which reads as generosity rather than error (`module/rules/authoring/fields.mjs:12-16`).

### The six families

**Elements.** `ELEMENT_DESCRIPTORS` holds 54 entries, one per executor in `rules/elements.mjs` (`module/rules/authoring/elements.mjs:87-440`). Every element may carry `predicate` to gate its execution and `defer` to hold a check until the attack it depends on exists. The buckets—`rules`, `passiveRules`, `activeRules`—are recorded because the vocabulary is the place to note such a restriction if one is ever found; today nothing filters by bucket because `collectContributions()` splats all three into one list and gates only on `ability.active` (`module/rules/authoring/elements.mjs:12-23`).

**Phases.** `PHASE_DESCRIPTORS` holds 20 kinds, three from `runPhases()` in the attack pipeline and the rest from `runPhases()` in `engine/skill-use.mjs`. `applyEffect` is an alias for `applyEffects`, not a distinct kind, so it is not offered (`module/rules/authoring/phases.mjs:64-192`). The `order` field is a presentation weight: `applyEffects` is 95 of 195 authored abilities, so a picker that sorted alphabetically would bury the common case.

**Requirements.** Two lists, held apart: `REQUIREMENT_DESCRIPTORS` (24 kinds) for abilities, `CS_REQUIREMENT_DESCRIPTORS` for command spells (`module/rules/authoring/requirements.mjs:57-168`). Both dispatchers refuse an unknown kind by returning `false`, which means the gate always loses and the ability silently cannot be used. Comparing the two lists is the cheapest place to catch this defect (`module/rules/authoring/requirements.mjs:6-13`).

**Timing.** `TIMING_DESCRIPTORS` is derived from `rules/windows.mjs` rather than restated; the window list itself is the authority, and the descriptors add the label, the doc anchor, and the `against*` modifiers (`module/rules/authoring/timing.mjs:1-33`). Four modifiers narrow a window: `againstKind`, `againstRank`, `requiresAoE`, and `radiusTo`. Achilles is the reference: four of these in one window for "when Achilles or any allied Unit within a 2 panel area is targeted by an AoE Noble Phantasm of Rank A and above" (`module/rules/authoring/timing.mjs:38-89`).

**Fields.** `FIELD_DESCRIPTORS` groups ability fields into seven sections: identity, limits, timing, requirements, passive effects, targeting, on-use (`module/rules/authoring/ability.mjs:56-161`). `EDITABLE_FIELDS` is derived from `SECTIONS` rather than listed beside it, because two hand-maintained lists of the same thing is how they come to disagree (`module/rules/authoring/ability.mjs:10-19`). Runtime fields written by the engine—`timesUsed`, `toggledAt`, `lastUsedTick`, `expended`, `active`—are recorded in `RUNTIME_FIELDS` and appear in the raw pane but nowhere in the form (`module/rules/authoring/ability.mjs:45-48`).

## Invariants & edge cases

1. **Malformed descriptors throw at import.** A missing id, label, hint or field never opens the editor; the system boots in error instead (`module/rules/authoring/contract.mjs:58-68`).

2. **A descriptor table is frozen whole.** Every entry is immutable, and the table itself is immutable, so it cannot be modified at runtime (`module/rules/authoring/contract.mjs:65-67`).

3. **The drift test is bidirectional and catches both directions.** An executor with no descriptor is caught; a descriptor with no executor is also caught. The test covers every element, phase, requirement and timing with no false positives because `casesIn()` scopes to a function (`test/unit/authoring-elements.test.mjs:18-35`).

4. **The editor imports from the engine, never from the content builder.** Validation consults `handledKeys()` (executors), `EffectRegistry` (effects), `parseTick()` (durations), `SHAPE_IDS` (shapes) — the same checks the engine uses at runtime, not the content validator (`module/apps/ability-editor/editor.mjs:15-23`).

5. **The module may add a rule element dynamically.** A module that adds a case to `EXECUTORS` and registers it has authored content that can author it. The editor opens with that element in the raw pane if the descriptor does not exist, which is the difference between "not offered" and "hidden" (`module/rules/authoring/index.mjs:54-56`).

6. **Localization keys must exist.** Every descriptor's `label` and `hint` are keys like `FGT.Authoring.Element.DamageModifier`. The actual English is stored in the descriptor itself as `english` and checked against `lang/en.json` by `test/unit/authoring-i18n.test.mjs` (`module/rules/authoring/elements.mjs:76-85`).

## Traps and anti-patterns

**A descriptor offers choices the engine never reads.** The `ApplicationChance` element's `direction` field once offered `["inflicting", "receiving"]`. The engine compares against `incoming` and `outgoing` in `effect-applier.mjs`, so a GM picking from the editor authored a direction nothing matched and the default applied it inward, silently. Every authored element in the corpus already used the real pair, which is exactly why no content ever surfaced it — the same shape as `orientedRect`'s `needs`, found the same way. **Verify every choice in a `select` field against the actual code that reads it** — the executor, the dispatcher, the validator — and use grep to spot-check usage across the corpus. (Fixed: `incoming`/`outgoing` are now in the descriptor at `module/rules/authoring/elements.mjs:296-303`, with a comment explaining why.)

**Forgetting that two requirement lists exist.** The ability requirements and command-spell requirements are separate because their dispatchers are separate. Mixing them — offering an ability requirement on command spells, or vice versa — creates a gate the dispatcher has no case for and the ability silently cannot be used. **Keep both lists in view when editing requirements**, and run `test/unit/authoring-requirements.test.mjs` which holds both lists against their respective dispatchers (`module/rules/authoring/requirements.mjs:57-168`).

## Open questions

- **Confirmed live: `describe` degrades to `null`, it never throws.** Called against the real family
  list (`element`, `phase`, `requirement`, `csRequirement`, `timing`, `field`): a known id returns its
  descriptor, an **unknown id returns `null`**, and an **unknown family also returns `null`**. So a
  module may add a rule element the engine executes without touching the vocabulary, and the editor
  falls back to the raw view rather than breaking. The cost is the one the drift test exists to
  prevent -- an element with no descriptor is invisible to the picker -- which is why that test
  covers ids in both directions (Chapter 10).

- The `english` field appears on every descriptor but is mirrored into `lang/en.json` by hand. A future evolution might derive the vocabulary descriptors themselves from a file the translation system reads — so the vocabulary and the translations never drift. The mechanism `test/unit/authoring-i18n.test.mjs` exists for is worth considering.
