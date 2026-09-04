# Content cross-references — clickable rules in every description

**Date:** 2026-09-04
**Status:** design, approved in chat, not yet implemented
**Chapters affected:** 37 (§37.8, §37.4, §37.11), 29 (§29.2, §29.7), 11, 18

---

## 1. The problem

A player reading Karna's *Brahmastra Kundala* is told it "inflicts Burn for 3◈ Turns". Nothing
tells them what Burn does. A player reading Scáthach's *Gate of Skye* is told it "cannot be used
if Primordial Rune, Wisdom of Dún Scáith and/or Gáe Bolg Alternative are on Cooldown", and has to
go and find three abilities by hand to learn what that costs them.

Every one of those names is a document this system already ships.

## 2. What is actually missing

**Not the documents.** 195 linkable documents exist today: 75 effect definitions, the class-skill
and ability packs, command spells, master essences. Burn is a real Item at a stable, derivable
address.

**Not a Foundry feature.** `@UUID[uuid]{label}` is core, not a pf2e invention. Verified in the
core source: `TextEditor.enrichHTML` runs `_enrichContentLinks`, which converts
`@UUID[uuid]{name}` into an anchor, and its accepted types are
`CONST.DOCUMENT_LINK_TYPES.concat(["Compendium", "UUID"])`. pf2e's condition links are exactly
this, written literally into pack prose:

```
@UUID[Compendium.pf2e.conditionitems.Item.Stunned]{Stunned 1}
```

**What is missing is one call we never made.** Searching all of `module/` for `enrichHTML` or
`TextEditor` returns nothing. Our templates print descriptions raw:

```handlebars
<section class="fgt-sheet__description">{{{system.description}}}</section>
```

So a `@UUID` written by hand today would render as literal text. That is the whole reason there
are no links, and it is unrelated to how actors and items are stored.

**One correction on the architecture, since it prompted this.** Embedded versus standalone is not
a choice for actor-owned items. Foundry's Actor document declares `embedded: {ActiveEffect:
"effects", Item: "items"}`, so pf2e's items on an actor are embedded exactly like ours. And an
embedded document still has a resolvable UUID, so a Servant's own abilities are addressable
without shipping them standalone.

## 3. Decisions

| # | Decision |
|---|---|
| DX.1 | Cross-references are **explicit markers authored in the YAML**, not names matched from prose. A typo fails the build. |
| DX.2 | Markers are **typed** (`@effect`, `@ability`, `@np`, `@spell`, `@essence`, `@action`), so the validator can check that the target is the kind the author claimed. |
| DX.3 | The build resolves a marker to a real `@UUID[...]` link. Content never writes a document id, and never sees a 16-character hash. |
| DX.4 | A label is optional. Without one the link shows the document's own name; with one it shows the author's wording. |
| DX.5 | A Servant's own ability is linked **through the Servant**, at its embedded address. No ability is shipped standalone to make this work. |
| DX.6 | Actions and rules terms get a real home: a new `packs/_source/rules/` source directory populating the `fgt.rules` JournalEntry pack the manifest has declared, and nothing has ever filled. |
| DX.7 | The validator **warns** when a description mentions a known document name outside a marker, so the retrofit is a worklist rather than a mystery, and a new description cannot quietly regress. |
| DX.8 | Enrichment happens in `_prepareContext`, because `enrichHTML` is async and Handlebars is not. |

## 4. The marker vocabulary

```yaml
description: |
  Inflicts @effect[burn] for 3◈ Turns to all affected Units.
  Cannot be used if @ability[scathach-primordial-rune]{Primordial Rune} is on Cooldown.
  Using @action[mark] counts as this Unit's Attack for the Turn.
```

| Marker | Resolves against | Example |
|---|---|---|
| `@effect[id]` | the `effects` source directory | `@effect[burn]` |
| `@ability[id]` | `class-skills` and `abilities`, non-NP | `@ability[class-riding]` |
| `@np[id]` | `abilities`, where `isNP` is true | `@np[medusa-bellerophon]` |
| `@spell[id]` | `command-spells` | `@spell[cs-kill-yourself]` |
| `@essence[id]` | `master-essences` | none yet — see below |
| `@action[id]` | the new `rules` directory | `@action[mark]` |

**`@essence` has no targets today.** `master-essences` is mapped in `PACKS` and declared in
`system.json`, and has **no source directory** — the second declared-but-empty pack this design
turned up, alongside `rules`. The marker is defined so the vocabulary is complete and the
validator can reject a stray one; it starts resolving the day the first essence is authored.

`@effect[burn]` renders as **Burn**, the document's own name. `@effect[burn]{Burning}` renders as
**Burning**. The label is for inflection and case, never for pointing somewhere else.

## 5. Addresses

Every address is derived from content ids by `documentId`, so nothing is hand-written and nothing
churns between builds.

| Target | UUID |
|---|---|
| Effect, class skill, shared ability | `Compendium.fgt.<pack>.Item.<documentId(id)>` |
| Command spell, master essence | `Compendium.fgt.<pack>.Item.<documentId(id)>` |
| A Servant's own ability or NP | `Compendium.fgt.servants.Actor.<documentId(owner)>.Item.<documentId("owner/id")>` |
| Action or rules term | `Compendium.fgt.rules.JournalEntry.<documentId(id)>` |

The third row is the one worth stating. `compileEmbeddedAbility` already derives an embedded
item's `_id` as `documentId(`${ownerContentId}/${ability.id}`)`, deterministically. The build
holds the library, so it knows which Servant owns any ability id and can compose the full path.
This is why DX.5 needs no change to what ships.

## 6. The rules journal

A new source directory, compiling to the pack `system.json` has declared since `0.1.0` and which
nothing has ever populated:

```yaml
# packs/_source/rules/mark.yml
schema: 1
id: mark
name: "Mark"
kind: action
description: |
  Places a Bloodmark on the panel this Unit is standing on, and counts as its Attack for the
  Turn. Bloodmarks may be placed on any panel, even within an enemy Home Base.
```

`PACKS` gains `rules: { pack: "rules", documentType: "JournalEntry" }`, and `compileDocument`
grows a `JournalEntry` branch producing one entry with one page. Scope for this change is the
eight action kinds. Rules terms like ZON and Sustainability get pages the same way, when
something needs to link to them.

## 7. The build

One new step between reference resolution and id assignment (§37.3 step 3.5):

1. Index every source document by `id`, recording its kind and its owner where it has one.
2. Scan every `description` for `@<kind>[<id>]{<label>}?`.
3. Resolve each against the index and rewrite it to `@UUID[<address>]{<label or name>}`.
4. An unresolvable marker, or one whose target is the wrong kind, is a **build error**.

The rewrite happens at build time rather than at render time on purpose: the compendium then
contains ordinary Foundry links, so they work in a chat card, a journal, an exported adventure
and anywhere else the text is shown, with no system code involved.

## 8. Validation

**Errors**, because each one is a link that would not work:

| Check |
|---|
| A marker names an id that resolves to no document |
| A marker's kind disagrees with the target (`@effect[...]` pointing at an ability) |
| `@np[...]` naming an ability whose `isNP` is not set, or `@ability[...]` naming one where it is |
| A marker is malformed (unclosed bracket, empty id) |

**Warning**, which is the retrofit worklist (DX.7):

```
warning  packs/_source/abilities/karna-brahmastra.yml: description mentions "Def Dwn"
         without linking it — write @effect[defDwn] or leave it if the mention is incidental
```

Six display names collide across documents: *Monstrous Strength*, *Indomitable*, *Item
Construction*, *Territory Creation*, *Presence Concealment* and *Riding*. Explicit markers make
the collision a non-issue for linking, and the warning names every candidate rather than guessing.

## 9. Runtime

`enrichHTML` is async, so enrichment belongs in `_prepareContext` and not in a template or a
helper. Four call sites, all of which currently print raw:

| Where | Field |
|---|---|
| `apps/actor-sheet/context.mjs` | ability card descriptions |
| item sheet context | `system.description` |
| chat cards for a used ability | the description block |
| the action bar's tooltips | plain text, so unchanged |

Enrichment is applied with `{ documents: true, links: true, rolls: false }`. Rolls stay off: this
system resolves its own dice through the engine, and an inline `[[/r]]` in a description would
open a second path to a roll.

## 10. The retrofit

Measured against the real corpus rather than estimated:

| Measure | Count |
|---|---|
| Linkable documents | 195 |
| Files whose description mentions one | 106 of 226 |
| Total mentions to mark | 321 |
| Mentions ambiguous by name | 18 |

A script proposes a marker for each unambiguous mention, and the 18 ambiguous ones are listed for
a decision rather than guessed at. The diff lands one commit per source directory so it can be
read. The warning in §8 then covers whatever the script did not catch.

## 11. Testing

**Unit, pure, no Foundry:**

- The marker parser: every kind, with and without a label, and each malformed shape.
- Resolution: a standalone document, a Servant-owned ability composing the embedded path, and a
  rules entry.
- Every error in §8's table, each proved by a failing document.
- The warning fires on an unmarked mention and stays silent on a marked one.
- A golden test pinning Burn's compiled address, so a change to `documentId` cannot silently
  break every link in the corpus.

**Live, in `fgt2026`:**

- Open Karna's Brahmastra Kundala and click Burn. The effect's compendium entry opens.
- Open Gate of Skye and click Primordial Rune. Scáthach's own ability opens, from inside her.
- Click Mark on Medusa's Blood Fort Andromeda description. The rules page opens.

## 12. Documentation

- **Ch. 37** — §37.8 gains the marker syntax as a content convention; §37.4 gains the four errors
  and the warning; §37.3 gains the resolution step; §37.11 gains DX.1–DX.8.
- **Ch. 29** — descriptions are enriched, and where.
- **CHANGELOG** — under `Added`.

## 13. Risks and non-goals

**Risk: 321 markers is a large diff to read.** Mitigated by committing per directory and by the
warning, which makes an omission visible rather than silent.

**Risk: two packs ship empty.** `rules` is filled by DX.6. `master-essences` is not, and stays
empty until content exists for it — this design neither worsens nor fixes that, but it is now
written down rather than merely true.

**Risk: a link whose target is later renamed.** A content id rename is already a breaking change
requiring a migration entry (D37.4), and the validator's unresolvable-marker error catches it at
build time rather than in play.

**Non-goals.** Replacing `ActiveEffect` with Items for effect instances is explicitly out of
scope: it would touch the registry, the applier, the scheduler, the snapshot and the socket
layer, and buys nothing a player can see that this design does not already deliver. Shipping
per-Servant abilities standalone is also out of scope, since DX.5 makes it unnecessary for
linking; it remains available later if dragging an ability out of a compendium becomes wanted.
Generating the whole specification into the rules pack is out of scope: those 45 chapters are
written for implementers, not for a table.
