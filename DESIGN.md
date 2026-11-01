---
name: Fate/Grail Tactics
description: A Grail War at night, played on a war table lit in gold.
colors:
  night: "#17161c"
  night-raised: "#21202a"
  night-sunken: "#100f14"
  bone-ink: "#e8e3d8"
  bone-ink-dim: "#a09a8e"
  dusk-line: "#3a3644"
  gold-leaf: "#c9a227"
  grail-crimson: "#9b2226"
  ok-green: "#4c9a5b"
  warn-amber: "#c8860d"
  danger-red: "#c0392b"
  health-red: "#a83232"
  agility-teal: "#2f7d6d"
  luck-violet: "#7a5ea8"
  parchment: "#f2eee3"
  parchment-raised: "#fffdf7"
  parchment-sunken: "#e3ddcd"
  ink: "#23201a"
  ink-dim: "#6a6458"
  parchment-line: "#c5bda8"
  gold-deep: "#8a6d12"
typography:
  display:
    fontFamily: "Modesto Condensed, Signika, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  title:
    fontFamily: "Signika, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Signika, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
  figure:
    fontFamily: "Signika, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Signika, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  hair: "2px"
  base: "4px"
  pill: "999px"
spacing:
  gap: "0.5rem"
components:
  slot:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.bone-ink}"
    rounded: "{rounded.base}"
    size: "40px"
  slot-armed:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.gold-leaf}"
    rounded: "{rounded.base}"
  button:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.bone-ink}"
    rounded: "{rounded.base}"
    padding: "0.25rem 0.75rem"
  tab-active:
    backgroundColor: "{colors.gold-leaf}"
    textColor: "{colors.night}"
    rounded: "{rounded.base}"
  card:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.bone-ink}"
    rounded: "{rounded.base}"
    padding: "0.5rem 0.75rem"
  chip:
    backgroundColor: "{colors.night-sunken}"
    textColor: "{colors.bone-ink-dim}"
    rounded: "{rounded.pill}"
    padding: "0 0.5rem"
---

# Design System: Fate/Grail Tactics

## Overview

**Creative North Star: "The War Table at Night"**

A command table in a dark room, lit by gold lamplight. The surfaces are near-black with a violet
cast, the ink is warm bone, and gold falls only on what matters: what is ready, what is armed,
what is yours. Everything on the table is meant to be read at a glance by a general who has
several Units to move and an opponent waiting, so legibility outranks ornament everywhere. The
night and the gold give the war its mood. They never make a figure harder to read.

The system is dense. It sits inside Foundry VTT beside core's sidebar, hotbar and canvas, so
every surface earns its space. The action bar, the chat cards and the actor sheet are
the three surfaces a player looks at all game. They share one set of tokens and follow
Foundry's interface theme, light or dark. The palette is dark first, and the light theme
redefines only what has to move.

The actor sheet takes its structure from Fate/Grand Order's Servant screen: a framed portrait
card, big tab buttons, skill rows that lead with the cooldown, and Parameters as segmented bars
with a letter Rank. It keeps this system's palette, not FGO's glossy blue.

**Key Characteristics:**
- Night surfaces separated by tone, never by shadow.
- Gold marks state: ready, armed, selected, focused. It is never decoration.
- Colour is never the only signal: a shape, an icon or a word stands beside every hue.
- Dense, with figures in tabular numerals and refusals in the engine's own words.
- Crisp, tactile controls: a small radius, a clear pressed state, a gold ring when armed.

## Colors

Near-black with a violet cast, warm bone ink, and one gold that means something.

### Primary
- **Gold Leaf** (#c9a227; light theme Gold Deep #8a6d12): the mark of state. It is the armed
  slot's ring, the active tab, a focus ring, a ready Noble Phantasm, the default faction colour.
  Its rarity is the point.

### Secondary
- **Grail Crimson** (#9b2226): the war's own colour, kept for identity accents such as the
  sheet header's edge. It is never a state.

### Status
- **OK Green** (#4c9a5b), **Warn Amber** (#c8860d), **Danger Red** (#c0392b): outcomes and
  verdicts on cards and refusals, each paired with an icon or a word.
- **Health Red** (#a83232), **Agility Teal** (#2f7d6d), **Luck Violet** (#7a5ea8): the three
  depleting resources. Agility is teal, not green, so the three stay apart under deuteranopia
  and protanopia.

### Neutral
- **Night** (#17161c): the base surface. **Night Raised** (#21202a) for panels, slots and cards.
  **Night Sunken** (#100f14) for wells, tracks and inputs.
- **Bone Ink** (#e8e3d8): text. **Bone Ink Dim** (#a09a8e): labels and secondary text.
- **Dusk Line** (#3a3644): 1px borders and dividers.
- The light theme swaps these for Parchment (#f2eee3), Parchment Raised (#fffdf7), Parchment
  Sunken (#e3ddcd), Ink (#23201a), Ink Dim (#6a6458) and Parchment Line (#c5bda8).

### Named Rules
**The Gold Means State Rule.** Gold marks something a player can act on or must notice now.
A gold that only decorates teaches players to ignore the gold that matters.

**The Faction Colour Rule.** `--fgt-faction` is set per Unit from its faction's colour, which
the board and the bar already read. It frames that Unit's portrait card and nothing else.

**The Tokens Only Rule.** Every colour is a `--fgt-*` custom property defined for both themes in
`styles/src/_tokens.scss`. A hex at a use site is a bug.

## Typography

**Display Font:** Modesto Condensed (with Signika), shipped by Foundry
**Body Font:** Signika (with sans-serif), shipped by Foundry

**Character:** Signika is a workhorse UI face that stays legible at small, dense sizes.
Modesto Condensed is Foundry's own condensed display face, used for names and titles only.
Nothing is loaded from outside Foundry.

### Hierarchy
- **Display** (700, 1.5rem, 1.1): a Unit's name on its sheet and portrait card.
- **Title** (600, 1rem, 1.25): section and card titles, ability names.
- **Body** (400, 0.85rem, 1.4): card prose, ability text, refusals.
- **Figure** (600, 0.85rem, tabular numerals): every number a player compares, such as Health,
  costs, cooldowns and damage.
- **Label** (600, 0.72rem, 0.06em, uppercase): one short label above a group. It is not a
  sentence.

### Named Rules
**The Five Sizes Rule.** Type takes one of the five sizes above. The incumbent SCSS uses about
twenty sizes between 0.6rem and 0.85rem. Each moves to the nearest step as its surface is
polished, and nothing goes below 0.68rem.

**The Tabular Figures Rule.** A figure that changes during play is set in tabular numerals, so a
bar of Health does not jitter as it falls.

## Layout

Dense and gridded. Panels pack their contents with the `--fgt-gap` rhythm (0.5rem) and multiples
of it. Every surface lives inside Foundry's layout:

- **The action bar** mounts in Foundry's `#ui-bottom`, above the hotbar, on its own Night
  backing. It stays clear of the players list, the hotbar and the chat input. The turn panel
  is its right-hand segment.
- **Chat cards** fit the sidebar's width (about 300px). Long breakdowns fold behind a toggle.
- **The actor sheet** opens at 900×720: the portrait card on the left and the tabbed content
  on the right. Below 760px the card stacks on top.

## Elevation & Depth

Flat by default. Surfaces separate by tone: Night Sunken for wells, Night for the base, Night
Raised for panels and controls. A 1px Dusk Line draws edges. There are no resting shadows. Depth
for state is a glow or ring in Gold Leaf: `box-shadow: inset 0 0 0 1px var(--fgt-gold)` for an
armed or selected control, and `0 0 4px var(--fgt-gold)` for a ready one.

### Named Rules
**The Tone Not Shadow Rule.** A panel is lifted by a lighter tone, never by a drop shadow over
the canvas.

## Shapes

Small, square-shouldered corners. 4px (`--fgt-radius`) for panels, slots, buttons and cards. 2px
for tracks and inline marks. A full pill only for chips and pips. Borders are 1px. The FGO-style
portrait card is the one framed shape: a 2px frame in the faction colour.

## Components

### Slots (action bar)
Square 40px controls holding an icon, on Night Raised with a Dusk Line edge.
- **Ready:** full ink.
- **Disabled:** `fgt-slot--disabled` dims the slot and keeps its tooltip, the refusal, on
  hover. The `disabled` attribute stays off so the tooltip shows.
- **On (a mode or a waiting plan):** `fgt-slot--on` wears the gold ring.
- **Armed (a Counter):** the Attack slot glows Gold Leaf. Every other slot dims, with its
  reason.

### Buttons
Crisp and tactile.
- **Shape:** 4px radius.
- **Default:** Night Raised, Bone Ink, 1px Dusk Line.
- **Hover / Focus:** the border turns Gold Leaf, and a `:focus-visible` ring shows.
- **Pressed:** a 1px inset, under 100ms.

### Cards (chat)
Each card is the audit record of one Process or Skill use, on the system's surface, not core's
parchment. It follows the interface theme.
- **Corner Style:** 4px.
- **Background:** Night Raised, or Parchment Raised in the light theme.
- **Rows:** each row says whose it is, what changed and which die decided it.

### Tabs (actor sheet)
Big buttons across the top, in FGO's arrangement: Overview, Abilities, Effects, Details. The
active tab is Gold Leaf with Night text, and the rest are Night Raised.

### Portrait Card (actor sheet, signature)
The Unit's portrait sits square in a frame of its faction colour on a Night backdrop. With no
portrait (Foundry's silhouette), its authored class image shows at 55% of the frame. The foot prints the class and the name through the identity
reader the bar uses, so a concealed Unit stays concealed. Servants, Masters, civilians and summons
have one. Platforms and structures keep a plain header.

### Skill Rows (actor sheet)
In FGO's order: "SKILL n" and its cooldown on the left, an icon tile, the name with its Rank,
then the text, with the use buttons at the right. The icon tile shows a glyph per kind (Skill,
Noble Phantasm, Mode), tinted ready or on cooldown. It never shows the generic item bag.

### Parameter Bars (actor sheet)
Each Parameter is a row: the key, six segments from E to EX filled to the Rank in force, and the
letter Rank. The fill is Grail Crimson, an identity accent and not a state. A `+` is printed, never
stretched.

## Do's and Don'ts

### Do:
- **Do** define every colour as a `--fgt-*` token for both themes.
- **Do** pair every hue with a shape, an icon or a word (D29.7).
- **Do** name a refusal in the engine's own words, on the control it refuses.
- **Do** animate only what a player starts (a tab switch, a press, a card unfolding), under
  200ms with ease-out, and turn it off under `prefers-reduced-motion`.
- **Do** keep every class name and `data-*` attribute that code or tests read.

### Don't:
- **Don't** animate a re-render. The bar re-renders on nearly every hook.
- **Don't** use gold as decoration (The Gold Means State Rule).
- **Don't** cast a resting shadow over the canvas (The Tone Not Shadow Rule).
- **Don't** load a font from outside Foundry.
- **Don't** show the generic item bag as an ability's icon.
