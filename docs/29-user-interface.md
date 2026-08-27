# 29 — User Interface

> **Implementation note (Ch. 45).** Three applications joined the sheets and the turn HUD: the
> **summon dialog** (§37.6), the **Wisdom curation dialog** (§36.4) and a generic **choice dialog**
> the second one asks a player through. All three are `ApplicationV2` with
> `HandlebarsApplicationMixin`, as §29.1 requires.
>
> Two conventions they establish, both from this chapter's argument that the interface exists to
> prevent mistakes rather than to look good. First: **a control that is unavailable is disabled
> with its reason on screen**, never hidden — a summon re-roll button that vanished at match start
> teaches a GM nothing, and one that is greyed out beside "the match has started, so the setup
> rolls are locked" teaches them the rule. Second: **the arithmetic is shown, not the answer** —
> "1000" tells a GM nothing about whether to re-roll and "18 + 2 (coin) + 2 granted = 22" tells
> them everything, which is the same argument the damage explainer (Ch. 30) already won.
>
> **The sheet scrolls.** Foundry gives `.window-content` a fixed height and no overflow of its
> own, so a Servant with thirteen abilities — Medea — simply ran off the bottom. The scroll lives
> on the **part root**, which is what `scrollable: [""]` names, so ApplicationV2 restores the
> position after each re-render; scrolling `.window-content` instead would jump back to the top on
> every edit, because the sheet re-renders on change.
>
> §29.3's Master block was a **partial** inside the body rather than a second part, for the same
> reason: two parts meant two scroll containers on one visible page, and the position ApplicationV2
> preserves is per part — so a Master editing a stat watched its Command Spell tracker jump. That
> argument is about two panels visible **at once**. The sheet has tabs now (§29.2), one part each,
> and only one is on screen at a time — so per-part scroll is the behaviour we want rather than the
> defect it was, and the Master block is Overview content.
>
> `test/unit/i18n.test.mjs` now holds every literal `localize` key in the templates and modules
> against `lang/en.json`. A missing key does not throw — Foundry renders the key itself, so a
> button reads `FGT.Summon.Confirm` and the system looks broken in a way nothing else would catch.
>
> It also holds a rule that is easy to miss and expensive to hit: **no key may be the prefix of
> another key.** Foundry expands the flat dotted keys into a tree, and a key that is both a string
> and a prefix asks that tree to hold a string and an object at one node. `expandObject` throws and
> the merge of the *whole file* is abandoned, so one bad pair takes down all 591 keys and every
> string in the system renders as its own name. `FGT.Editor.Kind` was the label on a field whose
> options were `FGT.Editor.Kind.classSkill` and friends. Nothing failed loudly.
>
> Still missing from this chapter: §29.6's dropdown predicate builder, the facing dialog and the
> remaining §29.8 dialogs.

The UI's job in a game this mechanically dense is not to look good — it is to make the rules
legible. Every screen in this chapter is justified by a specific class of mistake it prevents.

---

## 29.1 ApplicationV2

All UI is `ApplicationV2` with `HandlebarsApplicationMixin`. V1 `Application` and `FormApplication`
are removed from our surface entirely; v14's V2 API is native DOM, has a proper parts system,
and handles form submission declaratively.

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ServantSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fgt", "sheet", "servant"],
    position: { width: 780, height: 720 },
    window: { resizable: true, contentClasses: ["fgt-sheet-content"] },
    actions: {
      useAbility:   ServantSheet.#onUseAbility,
      toggleMode:   ServantSheet.#onToggleMode,
      rollSetup:    ServantSheet.#onRollSetup,
      removeEffect: ServantSheet.#onRemoveEffect,
      editAbility:  ServantSheet.#onEditAbility,
    },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    header:    { template: "systems/fgt/templates/servant/header.hbs" },
    tabs:      { template: "systems/fgt/templates/shared/tabs.hbs" },
    stats:     { template: "systems/fgt/templates/servant/stats.hbs" },
    abilities: { template: "systems/fgt/templates/servant/abilities.hbs", scrollable: [""] },
    effects:   { template: "systems/fgt/templates/servant/effects.hbs", scrollable: [""] },
    bio:       { template: "systems/fgt/templates/servant/bio.hbs" },
  };

  async _prepareContext(options) { /* … */ }
}
```

The `actions` map replaces `activateListeners` — handlers are declared, bound automatically to
`[data-action]` elements, and there is no jQuery.

---

> **Implemented.** `module/apps/actor-sheet/`, as **four** tabs rather than this section's five —
> the fifth was a stats tab, and D29.3 wants those values in the header where they are always
> visible. One `FGTActorSheet` serves all six actor types: the tabs are the same everywhere and
> only Overview's blocks differ, so six classes would have been six copies of the same eighty
> percent. Tabs come from `ApplicationV2.TABS` with **one `PART` per tab**, which is what finally
> makes §29.10's `render({parts: ["effects"]})` possible.
>
> Two things the framework needs that are easy to miss. `changeTab` finds the nav with
> `closest(".tabs")` and the panes with `.tab[data-group]`, so without those two class names it
> binds the click and then has nothing to toggle. And a tab `PART` must be handed its own entry
> from `context.tabs` in `_preparePartContext`, or its template has no `data-tab` to render.
>
> The split that matters is not the tabs but **`present.mjs`**: every piece of arithmetic the sheet
> does — bar percentages, granted-step recovery, turns-to-◈, effect grouping, stage damage — lives
> in a module with no `game`, no documents and no canvas, and is unit-tested with plain objects.
> `context.mjs` is the impure half: it fetches and hands the results over. A question with an
> answer belongs in a test rather than inside a template that can only be checked by opening it.
>
> **Every state line and every cost is read from the engine's own gate.** A card calls
> `canUseAbility({ability: usageSpecFor(item), …})` and `npCost(…)` — the same calls
> `engine/attack.mjs` makes before it resolves anything — so what the card promises and what the
> click does cannot disagree, and a gate added to `rules/costs.mjs` later appears on the sheet
> without anyone wiring it. `abilityState`'s default branch is load-bearing: an unrecognised reason
> falls through to `FGT.Ability.Refused.<reason>`, so the worst case is an untranslated key rather
> than a disabled button with no explanation, which is the one thing D29.2 forbids.

## 29.2 The Servant sheet

Four tabs — Overview, Abilities, Effects, Details — over an always-visible header. The design
constraint: a player mid-turn needs to answer *"what can this unit do right now, and what is
stopping it?"* in under five seconds.

### Header (always visible)

```
┌────────────────────────────────────────────────────────────────────┐
│  ▣  KARNA                     Lancer · Chaotic Good · India        │
│     ████████████████░░░░  1,243 / 1,512   Health                   │
│     ████████████░░░░░░░░       14 / 20    Agility                  │
│     ██████░░░░░░░░░░░░░░        4 / 8     Luck                     │
│                                                                    │
│  STR B   END C   AGI A   MAG B   LUC D      MOV 7   Range 2        │
│  BA(STR) 125   BA(MAG) 175        Sustainability 2◈                │
│                                                                    │
│  Master: Jinako  ●●○  ZON 2 · ✓ inside     Contract: Contracted    │
│  ⚠ Fated Rivals: Arjuna within Range — Karna may only attack Arjuna│
└────────────────────────────────────────────────────────────────────┘
```

The header carries every value that gates an action. The ZON indicator and the compulsion
warning are the two highest-value elements: both prevent mistakes that are otherwise only
discovered after committing.

The `▣` portrait is a click target, not decoration: it opens Foundry's FilePicker, the same as
the ability sheet's icon (§29.6). Both used AppV1's `data-edit` markup, which `ActorSheetV2` and
`ItemSheetV2` do not wire up on their own — `apps/image-edit.mjs` is the small shared handler
that does, bound as the `editImage` action both sheets declare.

A Servant carries a second image, `system.defaultImage` (the Details tab, GM-only, beside the
identity fields), for the same reason `classContainer` stands in for `trueName`: while
`identityRevealed` is unset, anyone but the GM sees this standard image in the header instead of
the true portrait — the true `img` is never overwritten, so the sheet the GM edits and the one
everyone else sees stay two different, correct things.

### Abilities tab

One card per ability, sorted: class skills, personal skills, Noble Phantasms.

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚡ Flash of the Sun God                        Rank EX   [ USE ]   │
│    Ready · Cooldown 4◈ (12 turns)                                  │
│    ⚠ Cannot be used on the same Turn as Mana Burst (Flames)        │
│    Restores 3 Agility · Atk Up 40% (30% NP) 1◈ · NP DmUp 20% 1◈    │
├────────────────────────────────────────────────────────────────────┤
│ 🔥 Brahmastra Kundala                    Rank A+ · NP  [ USE ]     │
│    Ready from Round 6 (2 rounds away)                              │
│    Range 5 · 7×7 area · 4× + 100 · Burn 3◈ · Def Dwn (B) 1◈        │
│    Master cost: 53 Health (Jinako has 118)          ✓ affordable    │
│    Also puts Mana Burst (Flames) on cooldown                       │
├────────────────────────────────────────────────────────────────────┤
│ 🌞 Vasavi Shakti                       Rank EX · NP   [ ACTIVATE ] │
│    Not yet activated                                               │
│    ⚠ Activating permanently removes Kavacha and Kundala (−90% dmg) │
└────────────────────────────────────────────────────────────────────┘
```

Every disabled button carries a tooltip stating exactly why (Ch. 15 §15.10). Every irreversible
action carries a warning before the click, not after.

### Effects tab

Grouped by polarity, with the source and remaining duration:

```
BUFFS
  Atk Up 40% (30% NP)      Flash of the Sun God      3 turns  [×]
  NP DmUp 20%              Flash of the Sun God      3 turns  [×]

DEBUFFS
  Burn                     Enemy Archer's arrow      5 turns
    −30 BA · 50 damage at end of Round
  Poison  Stage 3          Semiramis                 ∞
    80 damage at end of Round · stage increases at Round start

STATUSES  (neither buff nor debuff — unremovable)
  Mad Enhancement B        class skill               active
```

The Poison entry showing **Stage 3** and its computed 80 damage is the kind of thing a player
will otherwise get wrong: `20 × 2^(3−1) = 80` is not obvious from "Stage 3".

> **Implemented**, with three corrections this section needed.
>
> The groups are keyed on the definition's **`polarity`** (`buff` / `debuff` / `status`), not on
> its `valence`. Valence is a separate axis — `offensive` / `defensive` / `neutral` / `neither` —
> and no effect in the catalogue carries `valence: debuff` at all, so grouping on it filed every
> debuff in the game under Statuses.
>
> The stage damage comes from `engine/scheduler.mjs`'s **`periodicDamageFor`**, extracted for this
> so there is one implementation. The registry's own `periodic` field is not what ticks — the
> scheduler's `PERIODICS` table is — and the figure carries `AMPLIFIERS` with it, so a bearer who
> also holds Deadly Poison reads 160 rather than 80. That is the number that will actually come
> off, which is the only number worth printing.
>
> An instance whose definition is missing from the registry gets its own group with a warning
> rather than being dropped. It *is* on the Unit, nothing will apply its rules, and "it loads and
> does nothing" is the failure shape this project keeps finding in its own content.
>
> Below the groups: immunities, auras, and a collapsible **modifier table** — `snapshot.modifiers`
> with each predicate rendered as text. It is the answer to *"why is my attack +50%"*, and a
> predicate written straight into a template arrives as `[object Object]`, which answers nothing.

---

> **Implemented.** `templates/actor/master.hbs`, added as an extra sheet part for actors of type
> `master`. Every figure on it is **derived**, the Unbound warning most of all: a stored flag would
> need updating from spending, granting, inheriting and the Master dying, and the one that got
> missed would leave a Servant permanently Unbound with a full pool.
>
> Building it required implementing Ch. 16 §16.9, which was specified and absent — `commandSpells`
> was a flat number that could not say *which* Servant its spells reached. It is now
> `module/rules/cs-namespacing.mjs`, with `commandSpellsPerServant` added **beside** the existing
> count rather than replacing it: the migration runner (Ch. 39) does not exist yet, and retyping a
> live field would break every world that already has one.

## 29.3 The Master sheet

Smaller, with three things a Servant sheet does not have:

**Command Spell tracker.**

```
COMMAND SPELLS
  Own          ● ● ○        2 of 3
  For Lancer   ● ● ●        3   (inherited from Kayneth's death, Round 5)
  For Archer   ○ ○ ○        0   → Archer is UNBOUND
```

The per-Servant namespacing (Ch. 16 §16.9) made visible, including the derived Unbound warning.

**Contracted Servants**, each with distance, ZON status, and the multi-Servant tax indicator:

```
CONTRACTED
  Lancer   3 panels   ✓ in ZON (2+2 Mad Enhancement)
  Archer   9 panels   ✗ outside ZON — attacks −5d10, NP unusable
  ⚠ 2 Servants acted last Turn — you lost 25 Health
```

**Master Essence**, with its granted effect and a warning that it is lost on death.

---

## 29.4 The turn HUD

Specified in Ch. 18 §18.9 and Ch. 25 §25.6. Pinned, always visible during a match. The single
most-looked-at element in the interface.

---

> **Implemented.** `module/apps/hud/token-hud.mjs`, extending Foundry's HUD rather than replacing
> it. Every control is a **shortcut to something that already exists** — the attack flow is
> `FGTActorSheet.declareAttack`, reused rather than reimplemented, because a second path into a
> resolution is a second place for it to be wrong and the copy is the one nobody updates.
>
> The quick-bar filters to **ready** abilities: a button that refuses when pressed teaches nothing
> a missing button does not teach faster. The facing dial does **not** end the turn, as this
> section requires. The budget dot reads turn state as **stale-by-reading** — a state stamped with
> an earlier tick is spent whatever it says — which is why a missed reset hook cannot leave a
> Servant looking exhausted for the rest of the match.

## 29.5 The token HUD

Extends Foundry's token HUD with F/GT-specific controls:

| Control | Purpose |
|---|---|
| Attack | Opens the attack flow (targeting mode C) |
| Move | Enters movement mode with the reachable set highlighted |
| Ability quick-bar | Up to 6 ready abilities, one click each |
| Facing dial | Set facing without ending the turn |
| Mode toggles | Presence Concealment / Mad Enhancement, with their cooldowns |
| Effect pips | Hover for the full list |
| Budget indicator | Whether this unit has already moved/attacked |

The budget indicator on the token itself (a small dot in a corner) means a player does not have
to remember which of their seven Servants has already acted.

---

> **Implemented.** `module/apps/ability-editor.mjs`, opened from the ability list for a GM and
> falling back to the plain sheet for everyone else — the editor writes rule elements, and a player
> who reorders a phase has changed the ability for the whole table.
>
> The **targeting picker** is built as this section demands: `module/rules/targeting/vocabulary.mjs`
> pairs each internal id with a plain-language label and a small schematic, so a GM picks a diagram
> and the internal name is written, never read. A drift test holds the picker's shape list against
> `expand()`'s `switch` **in both directions** — a shape offered but not implemented authors an
> ability that targets nothing, and one implemented but not offered is unreachable.
>
> One deviation, stated plainly. This section asks for validation "running the same checks as the
> content build", and the editor **does not import the build's validator**: `tools/lib/content.mjs`
> already imports from `module/`, so importing it back would invert the layer graph. Instead every
> live check consults the authority the engine uses at runtime — `handledKeys()` for rule elements,
> `EffectRegistry` for effect ids, `parseTick` for durations, the shape vocabulary for targeting.
> Those are the checks that decide whether an ability *does anything*. **CI remains authoritative**
> for the rest, and Save is refused while any of them fails.

## 29.6 The ability editor

The tool that determines whether success criterion **SC-6** (a GM authors a Karna-complexity
Servant in under an hour) is met.

A form over the ability schema (Ch. 22 §22.6), with:

- **Name and icon**, both on the Item document rather than in `system`, held as `#pendingName` /
  `#pendingImg` until Save with the rest of the draft. The icon control was the missing half of
  that pair: `#pendingImg` and `#onSave` already existed, but nothing in the template ever gave
  it a value — the editor could set a name and had nowhere to click for the icon beside it.
- **Type flags** as checkboxes, with the three NP-scoping flags in an "advanced" disclosure
  that defaults to the derived values.
- **Phases** as a sortable list, each expanding into a type-specific editor.
- **Targeting** as a visual picker: choose the anchor from nine illustrated options, the shape
  from eleven, and see a live preview on a schematic grid.
- **Effects** chosen from the registry by name, with magnitude and duration fields that validate
  as you type (`"1◈+⅔◈"` shows "= 5 turns at 3 turns/round").
- **Predicates** built from dropdowns over the roll-option vocabulary, with a raw-JSON escape
  hatch.
- **Live validation** running the same checks as the content build, shown inline.

The targeting picker is the piece that matters most. A GM should never have to know that
`selfEdgeAdjacent` is the internal name for "a 5×5 area in any non-diagonal direction next to
the caster" — they should see four little diagrams and click one.

> **Reworked.** The diagrams were `<pre>` blocks of the vocabulary's raw characters inside a
> `flex-wrap` row with no width constraint, so a wide schematic overflowed its own button and
> landed on the labels of the row beneath. The picker is a grid of fixed tiles now and the
> schematics are **inline SVG built from the same rows** — one description of each shape, so the
> drift test that holds the picker against `expand()` still covers what is drawn. Foundry pins
> every `<button>` to a 28px `--button-size`, which clipped the first attempt to a strip: a tile
> holding a diagram above a wrapping label has to say `height: auto`.
>
> The editor also **could not set an ability's name**, which made SC-6 unreachable regardless of
> how good the picker was. It now sets name, image, kind, description, cost, cooldown, uses per
> match, the Round gate, category and the behaviour flags, and gives each phase a typed editor.
>
> **The typed editors merge, never replace.** A phase carries properties this form has no field
> for — a predicate, an event filter, a target selector — and building a fresh object from the
> form would drop them silently, which is precisely the defect the editor exists to catch in other
> people's content. Four kinds (`resource`, `statChange`, `removeEffect`, `cooldown`) carry their
> payload in a nested `changes` array or a `selector` object, so they get `target` plus the JSON
> editor rather than invented flat fields; a form that cannot express what the phase does is worse
> than no form. A blank typed field never stamps a key onto a phase that did not have one.
>
> Three bugs found by driving it rather than by reading it, all of the same family — **every input
> is submitted on every change**:
>
> - The raw-JSON textarea, applied in DOM order, ran *after* the typed fields and replaced the
>   phase with its own stale contents. Typing into a typed field did nothing at all, every time.
>   It is applied first now, and only where the text differs from the phase's current
>   serialization — that is what tells an edit from an echo.
> - Editing anything rewrote `rank: null` to `""`. Null is deliberate on the three Noble Phantasms
>   whose sheets print a *range* rather than a Rank. A blank input no longer overwrites a value
>   that was never set; blanking one that has a value still works.
> - `<option {{#if (eq k ../p.kind)}}selected>` inside two nested `{{#each}}`es marks nothing
>   selected, so every phase dropdown showed the first kind alphabetically beside the fields of
>   whatever it really was. The same mistake named the inputs `phase..target`. Block params reach
>   into nested scopes directly; the `../` was wrong. Both are `selectOptions` now.
>
> And one that predates this work: the duration hint §29.6 asks for — *"`1◈+⅔◈` shows `= 5 turns at
> 3 turns/round`"* — read `tick.rounds` and `tick.turns` off the parse result. A `TickExpr` has
> neither, so the hint had rendered `NaN turns` for every expression since it was written. It uses
> `resolveTicks`, which is what the scheduler uses.
>
> **Still not built:** the dropdown predicate builder over the roll-option vocabulary. Predicates
> remain a raw-JSON escape hatch with parse validation, and this section still asks for more.

---

## 29.7 Chat cards

Specified in Ch. 30. From the UI's perspective: one card per Combat Phase, collapsed by default,
expandable to the full trace, with per-viewer content.

---

## 29.8 Dialogs

| Dialog | When |
|---|---|
| Reaction prompt | Ch. 27 §27.8 — anchored, non-modal, with computed odds |
| Command Spell offer | Inline strip on the chat card, dismissible |
| Facing choice | Turn end, all moved units in one grid |
| Confused resolution | Turn end, showing each random roll |
| Setup rolls | Summon, showing each rolled stat with a GM re-roll |
| Servant selection | Draft (deferred past v1) |
| Wisdom of Dún Scáith | Scáthach's copy selection (Ch. 36) |
| Grail warning | Hard confirm before a Grail-endangering AoE |

The facing dialog is worth showing because it is a per-turn interaction:

```
┌─ Choose facing ─────────────────────────────────┐
│  Three units moved this turn.                    │
│                                                  │
│   Lancer      ↖ ↑ ↗       Rider       ↖ ↑ ↗      │
│               ← ▣ →                    ← ▣ →     │
│               ↙ ↓ ↘                    ↙ ↓ ↘     │
│                                                  │
│   Assassin    ↖ ↑ ↗                              │
│               ← ▣ →      [ Face nearest enemy ]  │
│               ↙ ↓ ↘      [ Keep current ]        │
│                                                  │
│                              [ Confirm ]         │
└──────────────────────────────────────────────────┘
```

The two bulk buttons handle the common cases in one click, which matters when a player moves
four Servants every turn.

---

## 29.9 Visual language

| Signal | Meaning |
|---|---|
| Faction colour | Ownership and alliance |
| Solid border | Legal |
| Dashed border | Illegal, with a reason |
| Red tint | Danger (Grail at risk, irreversible action, lethal damage) |
| Amber badge | Warning that does not block (out of ZON, compulsion pending) |
| Dotted ring | ZON |
| Faint octagon | Threat range |
| Pip rows | Discrete resources (Command Spells, Fragarach Tokens, budget) |
| Bars | Continuous resources (Health, Agility, Luck) |

Colour is never the only signal. Every colour-coded state also has a shape, an icon, or text.

### Theme

The system respects Foundry's light/dark themes. All colours are CSS custom properties defined
for both, with the faction palette chosen for distinguishability under the common forms of
colour vision deficiency (deuteranopia and protanopia), verified with a simulator.

> **Implemented.** `styles/src/_tokens.scss`. This was previously true of the window frame and
> false of everything inside it: `#7a7971`, `#b07`, `#3a3`, `#c80`, `#b33` and `#666` were spelled
> at their use sites, so there was nothing for a theme to redefine. Agility is teal rather than the
> obvious green, for the deuteranopia reason above.
>
> The 974-line flat stylesheet split into partials at the same time — it had the HUD, the chat
> cards, three dialogs and the sheet interleaved, with `.fgt-hud` declared twice 160 lines apart
> and `.fgt-preview` likewise. The split was done mechanically and checked by selector count:
> nothing was lost in the move.

---

## 29.10 Performance

| Concern | Mitigation |
|---|---|
| Sheet re-render on every effect tick | Partial re-render of the affected `PART` only, via `render({parts: ["effects"]})` |
| 28 token HUDs updating per turn | HUD renders on demand, not persistently |
| Targeting preview at pointer rate | Debounced to 30 Hz; resolution memoized per panel |
| Chat log growth | Transient messages deleted on phase completion (Ch. 27 §27.7) |
| Zone overlays redrawing on every move | Dirty-flag per overlay; only the moved unit's overlays redraw |

---

## 29.11 Localization

Every string goes through `game.i18n`. Keys follow `FGT.<Area>.<Key>`. The content compendium
carries English names inline with localization keys alongside, so a translated world shows
translated ability names without duplicating the compendium.

The content validator checks that every key referenced by content exists in `lang/en.json`, so a
missing translation is a build failure rather than a `FGT.Ability.Foo.Name` appearing in play.

Spanish is a first-class target (the project's primary user base is Spanish-speaking), which
means: no string concatenation for grammatical constructions, no assumptions about word order,
and pluralization through `game.i18n.format` with explicit plural keys.

---

## 29.12 Summary of decisions

| # | Decision |
|---|---|
| D29.1 | ApplicationV2 with the declarative `actions` map throughout; no V1 Application, no jQuery. |
| D29.2 | Every disabled control states its reason; every irreversible action warns before, not after. |
| D29.3 | The header carries every value that gates an action — ZON, contract, compulsions, resources. |
| D29.4 | Derived values that players compute wrong (Poison stage damage, tick durations) are shown computed. |
| D29.5 | The ability editor's targeting picker is visual, so authors never learn internal shape names. |
| D29.6 | Facing is one bulk dialog at turn end with two one-click defaults. |
| D29.7 | Colour is never the only signal. |
| D29.8 | Sheets re-render by part, not wholesale. |
| D29.9 | Spanish is a first-class localization target; no concatenated grammar. |
| D29.10 | One sheet class for all six actor types; only the Overview tab's blocks differ. |
| D29.11 | Four tabs, one `PART` each, on ApplicationV2's native `TABS`. The header carries what gates an action. |
| D29.12 | Presentation arithmetic lives in a **pure** module and is unit-tested without a world. |
| D29.13 | Ability state and cost are read from `canUseAbility` / `npCost` — the engine's own gate — never from a copy. |
| D29.14 | Derived values render as text; only what a GM legitimately changes is an input. |
| D29.15 | No localization key may be the prefix of another: one collision silently voids the whole file. |

---

**Next:** [30 — Chat and Audit](30-chat-and-audit.md)
