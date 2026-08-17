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
> `test/unit/i18n.test.mjs` now holds every literal `localize` key in the templates and modules
> against `lang/en.json`. A missing key does not throw — Foundry renders the key itself, so a
> button reads `FGT.Summon.Confirm` and the system looks broken in a way nothing else would catch.
>
> Still missing from this chapter: the Master sheet (§29.3), the token HUD (§29.5) and the ability
> editor (§29.6).

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

## 29.2 The Servant sheet

Five tabs. The design constraint: a player mid-turn needs to answer *"what can this unit do
right now, and what is stopping it?"* in under five seconds.

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

---

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

## 29.6 The ability editor

The tool that determines whether success criterion **SC-6** (a GM authors a Karna-complexity
Servant in under an hour) is met.

A form over the ability schema (Ch. 22 §22.6), with:

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

---

**Next:** [30 — Chat and Audit](30-chat-and-audit.md)
