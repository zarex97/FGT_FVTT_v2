# Actor sheet redesign and ability editor rework — design

**Date:** 2026-08-23
**Chapters affected:** [29 — User Interface](../../29-user-interface.md), [45 — Implementation Status](../../45-implementation-status.md)

---

## 1. The problem

The actor sheet renders a fraction of what an actor holds, and what it does render it
renders as a bare form.

`FGTActorSheet` has one `PART` (`templates/actor/unit.hbs`, 137 lines) showing: name,
faction, three `value/max` number pairs, five parameter text boxes, one attack button
and a flat `<li>` list of abilities. Everything else on the schema is invisible.

Invisible today, all of it already stored and already derived:

| Field | Where it lives | Why it matters on screen |
|---|---|---|
| `baseAttack.str` / `.mag` | `combatantCommon()` | The two numbers every damage roll starts from |
| `normalAttack.mode` / `.component` / `.bands` | `combatantCommon()` | EMIYA's attack changes component at Range 3 and nothing says so |
| `mov`, `range.panels`, `range.targets`, `detect` | `unitCommon()` | Every movement and targeting decision |
| `sustainability`, `sustainabilityRemaining` | `combatantCommon()` | A Free Servant's clock |
| `grantedSteps` | `combatantCommon()` | §5.6: a sheet showing `B` where the Servant was written `C` is uncheckable |
| `alignment`, `region`, `attributes`, `servantClasses` | `ServantData`, `unitCommon()` | Identity, and what content predicates match on |
| `trueName`, `classContainer`, `concealedIdentity`, `identityRevealed` | `ServantData` | Closed-information play (§26.6) |
| `contract`, `masterId`, `zonExempt`, `zonPartnerIds` | `ServantData` | Whether a Noble Phantasm is usable at all |
| `resources` | `unitCommon()` | §6.10 pools that gate abilities (PRS Tokens, Fragarach Tokens) |
| `turnState`, `roundState`, `healthWatermarks` | `combatantCommon()` | What this unit has already spent |
| `defeated`, `defeatCause`, `concealed`, `modesLocked`, `hiddenDamage` | `unitCommon()` | State that changes what every other rule does |
| `biography` | `unitCommon()` | Declared since the schema was written, rendered nowhere |
| `boundToPlatformId`, platform/summon fields | `unitCommon()`, `simple.mjs` | Cross-level and expiry rules |

And `unitSnapshot(actor)` already returns, unread by any sheet: `effectInstances`
(magnitude, stage, uses, expiry tick, source unit, source ability, visibility,
suppressed), `modifiers`, `immunities`, `auras`, `statDeltas`, `compulsionRules`,
`zonDistance` / `outsideZon`, `applicationChances`, `revivals`.

`statDeltas` carries a comment in `rules/snapshot.mjs` saying it exists *"so a sheet can
explain the number"*. No sheet has ever read it.

The ability editor has a second, separate problem: its picker is
`display: flex; flex-wrap: wrap` over `<pre>` schematics with no width constraint, so the
diagrams overflow their buttons and collide with the labels of the row beneath. It also
cannot set an ability's **name** or **description**, and renders each phase as its bare
`kind` string in a text input.

---

## 2. Decisions

| # | Decision |
|---|---|
| D1 | One `FGTActorSheet` class for all six actor types, not one class per type. |
| D2 | Tabs come from `ApplicationV2.TABS`, one `PART` per tab, so `render({parts: […]})` becomes possible (§29.10). |
| D3 | Four tabs — Overview, Abilities, Effects, Details — amending §29.2's five. |
| D4 | The Master block stops being a Handlebars partial and becomes Overview content. |
| D5 | Presentation logic lives in a **pure** module, so it is testable without a world. |
| D6 | Ability state and cost come from `canUseAbility` / `npCost` — the same call `resolveAttack` makes — never from a copy. |
| D7 | Derived values render as text; only what a GM legitimately changes is an input. |
| D8 | No schema change. This is entirely "data that exists and is never rendered". |
| D9 | Targeting schematics render as inline SVG built from `vocabulary.mjs`'s existing rows — one source of truth, so the drift test still holds. |

### D2 — why tabs, and why one part each

Verified against this world (Foundry 14.364): `ApplicationV2.TABS`,
`_prepareTabs(group)`, `_getTabsConfig(group)`, `changeTab` and `_onClickTab` all exist.
`_prepareTabs` reads `this.constructor.TABS[group]` and returns `{id, group, active,
cssClass, label}` per tab, so the framework owns active-state and the click handler.

The alternative — one part with CSS-toggled sections — was rejected because every effect
tick would re-render the whole sheet, and §29.10 names partial re-render as the mitigation
for exactly that.

### D4 — why the partial can go

`unit.hbs` and `fgt.scss` both carry a comment explaining that §29.3's Master block is a
partial *"rather than a second part"*, because two parts meant two scroll containers on
one page and ApplicationV2 preserves scroll per part — so a Master editing a stat watched
its Command Spell tracker jump.

That reasoning is about two panels **visible at once**. With tabs, one tab is visible at a
time, so per-part scroll is the desired behaviour rather than the defect. Both comments get
rewritten to say so; neither is silently deleted.

### D6 — one gate, not two

`engine/attack.mjs` decides whether an ability may be used by calling:

```js
canUseAbility({ ability: usageSpecFor(item), unit, master, round, board, target })
```

The Abilities tab makes the **same call** to build each card's state line. A second
implementation of "is this on cooldown" is a second place for it to be wrong, and the copy
is the one nobody updates — the defect `engine/cooldown.mjs` was written to end.

---

## 3. Architecture

### 3.1 Files

```
module/apps/actor-sheet/sheet.mjs      the class: DEFAULT_OPTIONS, PARTS, TABS, actions
module/apps/actor-sheet/context.mjs    per-tab context builders (reads game/documents)
module/apps/actor-sheet/present.mjs    PURE presenters — snapshot in, view objects out
module/apps/index.mjs                  registration only; re-exports FGTActorSheet
```

`module/apps/index.mjs` is ~530 lines today and would roughly triple. The split is by
purity, not by size: `present.mjs` touches no global, so its ability-card states, effect
grouping, stage arithmetic and tick→turn conversion are unit-testable with plain objects.

Layer rule (`tools/check-layers.mjs`): everything here is layer 4 (`apps`), which may
import from `domain`, `rules` and `engine`. No new edge is created.

### 3.2 Parts and tabs

```js
static PARTS = {
  header:    { template: "systems/fgt/templates/actor/header.hbs" },
  nav:       { template: "systems/fgt/templates/actor/nav.hbs" },
  overview:  { template: "systems/fgt/templates/actor/overview.hbs",  scrollable: [""] },
  abilities: { template: "systems/fgt/templates/actor/abilities.hbs", scrollable: [""] },
  effects:   { template: "systems/fgt/templates/actor/effects.hbs",   scrollable: [""] },
  details:   { template: "systems/fgt/templates/actor/details.hbs",   scrollable: [""] },
};

static TABS = {
  primary: {
    initial: "overview",
    labelPrefix: "FGT.Tab",
    tabs: [
      { id: "overview",  icon: "fa-solid fa-address-card" },
      { id: "abilities", icon: "fa-solid fa-bolt" },
      { id: "effects",   icon: "fa-solid fa-person-rays" },
      { id: "details",   icon: "fa-solid fa-book-open" },
    ],
  },
};
```

`_preparePartContext(partId, context)` assigns `context.tab = context.tabs[partId]` for the
four tab parts, which is what the template needs for its `data-tab` / `active` class.

Every actor type gets all four tabs. A Structure shows an empty Abilities tab rather than
losing it — D29.2's "a control that is unavailable is disabled with its reason on screen,
never hidden", applied to navigation.

**Overview is type-aware.** Sub-blocks render on a `{{#if}}` over the actor type; the other
three tabs are identical for every type.

### 3.3 Layout

```
┌────────────────────────────────────────────────┐
│ [portrait]  NAME              class · align ·  │  header  (full width)
│             ███████████░░░░  1000/1000 Health  │
│             ██████████░░░░░     15/15  Agility │
│             ████░░░░░░░░░░░       2/2  Luck    │
├───┬────────────────────────────────────────────┤
│ ▣ │                                            │
│ ⚡ │   active tab part (its own scroll)         │  nav rail + one tab part
│ ✦ │                                            │
│ ☰ │                                            │
└───┴────────────────────────────────────────────┘
```

A faction-coloured rail runs down the left edge, taking `faction.color` from
`rules/factions.mjs` (already stored, already used by the board and HUD).

---

## 4. Tab contents

### 4.1 Header (not a tab; always visible)

Portrait (`data-edit="img"`), name input, and the public identity line: `classContainer` ·
`alignment.order alignment.morality` · `region`. True name shown when `identityRevealed` or
the viewer is a GM, italic, as today. Faction select. Three resource **bars** with the
numeric value printed on them — colour is never the only signal (D29.7). Badges for
`defeated` (with `defeatCause`), `concealed`, `modesLocked`.

Health bar for a unit with `health.max === null` reads "undamageable" rather than a
zero-width bar: `null` health is intrinsic (Pale Rider, the Kagome Spirits), not empty.

### 4.2 Overview

- **Parameters** — one tile per parameter. Where `grantedSteps[k] > 0`, the tile reads
  `C ▸ B (+1)`: authored rank, granted rank, steps.
- **Combat** — `baseAttack.str` / `.mag`; `normalAttack.mode` and `.component`, with the
  `bands` listed when the mode is `rangeBanded`; `mov`; `range.panels`; `range.targets`;
  `detect` (marked *derived* when `null`); `sustainability` expression with
  `sustainabilityRemaining` turns; `facing`.
- **Explainers** — where `snapshot.statDeltas` contains a delta for `mov`, `range` or
  `agility`, a line under that value naming the source and the amount.
- **Status** — `contract`; Master by name; ZON radius, distance, inside/outside and the
  penalty text where outside; `zonExempt` / `zonPartnerIds`; `boundToPlatformId`.
- **Compulsions** — `snapshot.compulsionRules` as an amber band (D29.3).
- **Turn budget** — acted / moved / attacked pips, `movedPanels` of `mov`, `moveSegments`,
  `usedActiveSkill`, `itemTransfers`. Read stale-by-tick, as `snapshot` already does.
- **Resource pools** — `system.resources` as pip rows with `value/max`.
- **Actions** — Normal Attack, Roll Setup, Contract, unchanged in behaviour.
- **Master only** — Command Spell tracker (own + per-Servant, with the derived Unbound
  warning), contracted Servants with distance / ZON / health, Essences, the multi-Servant
  tax warning, `rank`, `zon`. Content moved from `templates/actor/master.hbs`; the
  `masterContext()` and `describeServant()` builders move to `context.mjs` unchanged.
- **Platform only** — `footprint`, `capacity`, `level`, `ownerId`, `upkeep`, `crossLevel`.
- **Summon only** — `summonerId`, `expiresAt`, `countsTowardBudget`, `actsOncePerTurn`.

### 4.3 Abilities

Cards, grouped by `system.kind` in the order `classSkill` → `skill` → `noblePhantasm`,
with abilities carrying no `kind` falling into `skill`. Content uses exactly these three
values.

Each card carries:

- Icon by `classifyAbility(item).kind` (`passive` / `mode` / `active` / `attack` /
  `dialog`), rank badge, NP badge.
- The correct control: `USE` for an attack or active skill, a toggle for a mode, plain
  text for a passive — `classifyAbility` already decides this and the current list already
  honours it.
- **State line** from `canUseAbility({ability: usageSpecFor(item), unit, master, round,
  board})`: `cooldown` → "Cooldown 4◈ (12 turns)"; `exhausted` → "Used 11 of 11";
  `round` → "Ready from Round 6"; `oncePerTurn`, `sameTurnExclusive`,
  `sameRoundExclusive`, ZON and requirement refusals each with their own sentence.
  Otherwise "Ready".
- **Cost line** from `npCost({ability, unit, master})`: `masterHealth` → "Master cost 53
  Health (Our Master has 118) ✓"; `sustainability` → "−2◈ Sustainability (7 left)".
  Affordability is stated, not implied.
- Warnings: `alsoTriggers` ("also puts Mana Burst on cooldown"), and an irreversibility
  warning where `permanentConsequence` is non-empty — before the click, not after (D29.2).
- `description` in a collapsible, and the edit pencil for a GM.

### 4.4 Effects

`snapshot.effectInstances` joined to `EffectRegistry.get(defId)`, grouped by the
definition's `valence` into BUFFS / DEBUFFS / STATUSES. An instance whose definition is
missing from the registry renders under its raw `defId` with a "no definition" note rather
than vanishing — a silently dropped effect is the failure mode this project keeps finding.

Each row: name, magnitude, `stage` **with its computed periodic damage** (D29.4's
worked example: Poison stage 3 → `20 × 2^(3−1) = 80`, computed from `def.periodic`, not
restated by the template), uses remaining, `expiry − currentTick()` as turns, source unit
and source ability by name, `suppressed` marked, and `[×]` for a GM unless
`def.unremovable`.

Below the groups: **Immunities** (`snapshot.immunities`), **Auras** (`snapshot.auras`),
and a collapsible **modifiers table** (`snapshot.modifiers`: key, value, component, source,
predicate) — the "why is my attack +50%" explainer.

### 4.5 Details

Editable identity: `trueName`, `classContainer`, `concealedIdentity`, `identityRevealed`,
`servantClasses`, `alignment.order`, `alignment.morality`, `region`, `attributes`,
`contentId`, `defaultImage`. Set fields render as removable chips with an add control;
they are `SetField`s and arrive as `Set`s, so the context spreads them to arrays before
the template sees them.

`biography` and `notes` through the `{{editor}}` helper — `notes` is currently emitted as
raw triple-stash HTML and `biography` has never been rendered.

Reference half: `defeated` / `defeatCause`, `concealed`, `hiddenDamage` tally,
`healthWatermarks`, `summonedAt`, raw `turnState` / `roundState`, and non-ability items
(`equipped`, `quantity`, `transferable`, `transferRange`).

---

## 5. Styles

`styles/src/fgt.scss` is 974 lines in one file. It splits into partials consumed with
`@use` from an unchanged entry point, so `npm run build:styles` is untouched and no
dependency is added:

```
styles/src/_tokens.scss    every colour as a custom property, both themes
styles/src/_shell.scss     window, header, nav rail, tab panes
styles/src/_cards.scss     ability cards, stat tiles, pip rows, bars
styles/src/_effects.scss   effect rows, modifier table
styles/src/_editor.scss    the ability editor
styles/src/_apps.scss      summon dialog, log viewer, HUD, chat — moved as-is
styles/src/fgt.scss        @use of the above
```

`_tokens.scss` is the point of the split. The current file hardcodes `#7a7971`, `#b07`,
`#3a3`, `#c80`, `#b33` at their use sites, so §29.9's "all colours are CSS custom
properties defined for both [light and dark] themes" is unmet. Every colour becomes a
token defined on `.fgt` and redefined under Foundry's light theme selector.

---

## 6. The ability editor

### 6.1 Layout

`&__picker` becomes `display: grid; grid-template-columns: repeat(auto-fill,
minmax(9rem, 1fr))`, each option a card with a fixed-height diagram box above a label that
wraps rather than overflowing. That alone removes the collision in the reported screenshot.

### 6.2 Schematics as SVG

`rules/targeting/vocabulary.mjs` stores each anchor and shape as rows of `.` (empty),
`#` (covered) and `@` (the caster). The editor renders **those same rows** as an inline SVG
grid — one rect per cell, three fills. Nothing new is authored, so the existing drift test
holding the picker's shape list against `expand()`'s `switch` in both directions still
covers it.

### 6.3 Fields

Added, none of which the editor can set today: `name`, `img`, `description` (rich editor),
`kind`, `cost`, `cooldown.max` (validated through `parseTick`, with the resolved turn count
shown), `maxUses`, `oncePerTurn`, `requiresRound`, `category`, `isPassive`,
`isAttackSkill`, `isMode`.

**Phases** stop being a bare `kind` text input. Each phase expands into a typed editor for
the kinds content uses — `applyEffects`, `damage`, `heal`, `resource`, `statChange`,
`modifyDamage`, `cooldown`, `cooldownDelta`, `removeEffect`, `teleport` — and any other
kind falls back to a JSON textarea. **The fallback is required, not a convenience:** phases
are an `ObjectField`, a module may add a kind (§21.4), and an editor that silently dropped
what it could not type would corrupt the ability on save.

Predicates keep the raw-JSON escape hatch with parse validation. The dropdown-built
predicate builder of §29.6 stays unbuilt and stays listed as missing in Chapter 29.

Live validation and the Save gate are unchanged: they already consult `handledKeys()`,
`EffectRegistry`, `parseTick` and the shape vocabulary, and CI remains authoritative.

---

## 7. Testing

**New unit tests** over `present.mjs`, which is pure:

- an ability card's state line for each `canUseAbility` refusal reason
- cost line for `masterHealth` and `sustainability`, affordable and not
- effect grouping by valence; an instance whose definition is missing
- stage → periodic damage
- expiry tick → remaining turns, and no combat → no remaining
- granted-step display: authored rank, granted rank, steps
- `health.max === null` → "undamageable", not an empty bar

**Existing gates that must stay green:** `npm test` (the i18n test holds every literal
`localize` key against `lang/en.json` — every new string needs a key or the sheet renders
`FGT.Tab.Effects` at players), `npm run check:templates` (only helpers Foundry v14
registers; `{{range}}` does not exist and would throw at render), `npm run lint`
(including `check-layers`), `npm run typecheck`, `npm run build:styles`.

**Live verification** in world `FGT_2026` as GM, with screenshots and the console checked
for render errors on each: EMIYA (17 items, `rangeBanded` normal attack, live `dodge` and
`defUp` instances), Medea (13 items — the scroll case Chapter 29 names), Our Master
(Command Spell tracker), a Dragon Tooth Warrior (Summon-only Overview blocks), and the
ability editor opened on one of EMIYA's Noble Phantasms.

---

## 8. Documentation

`docs/29-user-interface.md` is the affected chapter. Its header note still lists the Master
sheet, the token HUD and the ability editor as missing while all three exist, §29.2 is still
written as a specification for five tabs, and §29.6 describes an editor that cannot set an
ability's name. All three change, and §29.12's decision table gains the decisions above.

`docs/45-implementation-status.md` is updated alongside it — per the project's standing
rule, Chapter 45 alone is not enough.

---

## 9. Out of scope

- No schema change. If a field is needed that does not exist, that is a separate decision.
- The dropdown predicate builder (§29.6) — stays unbuilt, stays documented as missing.
- The facing dialog, reaction prompt and the remaining §29.8 dialogs.
- The turn HUD (§29.4) and token HUD (§29.5), which already exist and are not touched.
