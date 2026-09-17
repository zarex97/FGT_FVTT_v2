# 35 — Sheets, the ability editor and the predicate builder

## What it is

The actor sheet and ability editor are **AppV2 applications built for testability**. The actor sheet displays a unit's state across four tabs; the ability editor lets a GM author abilities through dropdowns instead of raw JSON. Both separate impure (document-fetching) code from pure presentation logic, so the arithmetic can be tested without a world running.

The actor sheet is **one class for all six actor types** (`module/apps/actor-sheet/sheet.mjs:8`), with a single header and four tabs whose content differs by type and snapshot state. The tabs are identical everywhere; only the Overview tab renders different blocks per type.

The ability editor is an **ItemSheetV2 registered as the default sheet for three Item types** (`module/apps/sheet-choice.mjs:37`). A GM sees the editor; a player is handed the read-only display sheet. The editor writes nothing to the Item until Save, so rule-element forms never put half-typed content in the document.

## Where it lives

| File | Role |
|---|---|
| `module/apps/actor-sheet/sheet.mjs` | The actor sheet class, AppV2 mixin, action handlers |
| `module/apps/actor-sheet/context.mjs` | Impure context builders: fetch documents, board, combat, snapshot |
| `module/apps/actor-sheet/present.mjs` | Pure presentation: resource bars, parameter tiles, modifier descriptions, effect grouping |
| `module/apps/ability-editor/editor.mjs` | ItemSheetV2 base class, editor actions, draft management |
| `module/apps/ability-editor/present.mjs` | View-model: rail rows, form rows, element/requirement/timing rows |
| `module/apps/ability-editor/predicate-builder.mjs` | Bidirectional: predicate ↔ builder rows, reference paths and facets |
| `module/apps/sheet-choice.mjs` | GM/player split: who gets which sheet; Item type validation |
| `module/apps/image-edit.mjs` | AppV2 image-picker wiring (FilePicker on `img[data-edit]`) |
| `module/apps/enrich.mjs` | HTML enrichment: @UUID links, prose rendering (async, outside templates) |

## How it works

### The actor sheet

`buildContext` takes an actor and snapshot and returns everything the four tabs render (`module/apps/actor-sheet/context.mjs:149`). One snapshot per render, threaded through every builder, because `unitSnapshot` walks the canvas and effect list — doing that four times would quadruple the work for one answer (`module/apps/actor-sheet/context.mjs:140-143`).

**Header** carries every value that gates an action: the three depleting resources (Health, Agility, Luck), public identity (class/alignment/region), portrait and badges (defeated, concealed, modes locked). The faction's colour matches the token on canvas (`module/apps/actor-sheet/context.mjs:221`).

**Overview tab** shows what this unit may do now: Base Attack and Normal Attack (written rank + projected rank), MOV, Detect range, Sustainability, stance buttons if applicable. All figures are projections where the snapshot differs from authored values — a Master's granted steps, a Region's rank bonus, a mode's effect (`module/apps/actor-sheet/context.mjs:345`).

**Abilities tab** groups abilities by type (Class Skill, Skill, Noble Phantasm) and shows each as a card with name, rank, cooldown, cost, description and a button whose class (toggle/button/text) reflects whether it is a mode, an attack or passive (`module/apps/actor-sheet/context.mjs:569`).

**Effects tab** lists every effect on the unit, grouped by source, with remaining turns and the modifiers each applies (`module/apps/actor-sheet/context.mjs:682`). Modifiers show their mathematical reason: "−50% Range (Interference)".

**Details tab** carries identity, prose (description, abilities), alignment, Region, reference sheets and image fields. Only the GM sees authored values (trueName, descriptions); players see public identity only.

### Separation of concerns

`context.mjs` is impure: it reaches for documents, the board, combat, settings, and builds a snapshot. `present.mjs` is pure: given parameters, it returns presentation data with no side effects (`module/apps/actor-sheet/sheet.mjs:11`). This split means the sheet's arithmetic can be unit-tested without Foundry running, and changes to the board or combat behaviour stay visible without reading the template.

### The ability editor

`AbilityEditor` is an ItemSheetV2 that holds a working copy (`#draft`) until Save, so every keystroke is not written to the Item (`module/apps/ability-editor/editor.mjs:112-113`). It was not originally registered as a sheet class, which is why Items → Create Item → Ability opened the display sheet and new items had to be owned by a Servant before they could be authored (`module/apps/sheet-choice.mjs:7-12`).

The editor presents a **vertical rail** of sections (name, rank, cooldown, phases, elements, requirements) and renders one section at a time in the main panel (`module/apps/ability-editor/present.mjs:96`). Each section has a **state** — empty, partial, done — so a GM can scan the rail to see what is left (`module/apps/ability-editor/present.mjs:74-85`). The rail is built from `fieldGroupsFor`, which knows the authoring schema per Item type (`module/apps/ability-editor/present.mjs:96`).

### The predicate builder

A predicate is authored as a dropdown tree, not JSON. `builderRows` renders a predicate as a sequence of form rows, one per statement, showing subject/facet/value selects. `toPredicate` reverses the process: builder rows → predicate JSON (`module/apps/ability-editor/predicate-builder.mjs:89-99`). The round-trip is the property that matters — a save must not silently rewrite a correct predicate.

Statements the builder cannot model (a module operator, an option no facet admits) become `raw` rows carrying their JSON, so nothing is dropped (`module/apps/ability-editor/predicate-builder.mjs:15-16`).

## Invariants & edge cases

1. **One snapshot per render.** `unitSnapshot` is expensive; each tab took its own before the rebuild. Now the whole context shares one snapshot, passed through every builder.

2. **The Overview tab shows projections, not authored values.** A sheet showing the authored MOV while the engine reads the modified one is a sheet that lies (`module/apps/actor-sheet/context.mjs:345`).

3. **A pure layer, deliberately.** `present.mjs` is Layer 4 but has no `game`, no `canvas`, no `ui`. Everything here is a testable question: "what percentage is this bar", "how many turns left", "why is this disabled" (`module/apps/actor-sheet/present.mjs:1-10`).

4. **`enrichHTML` is async; templates are not.** Enrichment happens in `_prepareContext` before render, never in a helper. Inline rolls `[[/r]]` are disabled — the engine resolves every die (`module/apps/enrich.mjs:24`).

5. **The predicate builder is an inverse.** Every predicate it renders, it must give back unchanged via round-trip test (`module/apps/ability-editor/predicate-builder.mjs:7-11`).

## Traps and anti-patterns

**Mode toggling as a bare write.** Mode toggling was implemented as a simple update with no validation, so when Mannanán's *God's Holder: Possession* needed entry gates (Health < 30%) and costs (drain Fragarach Tokens), there was nowhere to put them — only Mad Enhancement, Presence Concealment and Riding had ever paid anything to activate, so every rule lived as an isolated check (`module/apps/actor-sheet/sheet.mjs:135`). **Mode activation that may have costs must go through `useSkill`, not a bare write** (`module/apps/actor-sheet/sheet.mjs:169-173`). Modes with no phases skip the cost path entirely; modes with gates declare them as ordinary ability requirements.

**Image editing not wired in AppV2.** AppV1's `FormApplication` auto-wired `img[data-edit]` clicks into a FilePicker. AppV2 does not, so the actor sheet's portrait and ability sheet's icon could not be changed — both templates carried the AppV1 markup and nothing carried the handler (`module/apps/image-edit.mjs:5-10`). **Every AppV2 sheet that displays an editable image must import and call `editImage` on the clicked element** (`module/apps/image-edit.mjs:25`).

**Registering a sheet class for a non-existent Item type.** Registering `AbilityEditor` for a type that `system.json` does not declare breaks `init` silently — settings registration stopped running and the world came up with `fgt.schemaVersion` missing (`module/apps/sheet-choice.mjs:23-30`). **Use `EDITOR_TYPES` as the ground truth for which types the editor can author** — it is a list, checked at registration time, maintained against Foundry's actual type list.

**Creating a new sheet without registering it.** The ability editor opened from exactly two places — the pencil on an ability card and `fgt.api.dialogs.AbilityEditor` in the console — until it was registered as an ItemSheetV2. A GM creating a new ability had to own it to a Servant first (`module/apps/sheet-choice.mjs:7-12`). **Every sheet class that users should reach from the Items directory must be registered with `DocumentSheetConfig.registerSheet`**, and must extend `DocumentSheetV2`, not bare `ApplicationV2`.

## Open questions

- **Four tabs or fewer?** The Overview, Abilities, Effects and Details tabs are specific to the unit view. Platform and Structure types have no stance and limited effects; summons and civilians have fewer classes. The four-tab design is not a burden, but asking whether the Details tab could be merged into Overview for non-GM viewers, and whether the Abilities and Effects tabs could be search/filter rather than static, is open.

- **Still open, and it is specifically a concurrency question.** The routing itself is not in doubt:
  the editor declares `form: { handler: AbilityEditor.#onChange, submitOnChange: true,
  closeOnSubmit: false }` (`module/apps/ability-editor/editor.mjs:84`), and the file is explicit that
  *"`submitOnChange` submits EVERY input on any change"* -- so each keystroke-level change routes the
  whole form through the handler rather than writing the document directly. What is unverified is what
  happens when **two clients edit the same ability at once**: each submits a whole form built from its
  own view, so a last-write-wins collision is plausible. Settling it needs two editors open on one
  document, which is a deliberate conflict rather than an observation.

- **Predicate builder and raw fallback.** Anything the builder cannot render becomes a `raw` row. This preserves the data, but a player opening an ability with a raw row sees an error-box instead of a rendered form. Rendering paths for operators/facets that are not in the builder would move more predicates out of raw, but widening the builder to every possible facet scope (`expressionRefs` vs. snapshot refs, `board` vs. `self`) is a cost worth measuring.
