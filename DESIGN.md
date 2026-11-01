---
name: Fate/Grail Tactics
description: Grail War Nocturne. A Holy Grail War at night, in lacquer, gold leaf and Command Seal crimson.
colors:
  night-sunken: "#05060c"
  night: "#0a0d1a"
  night-raised: "#111629"
  night-3: "#1a2140"
  night-4: "#262f57"
  bone-ink: "#efe8d6"
  ink-dim: "#a3a6bd"
  ink-faint: "#7a7f9e"
  gold-hi: "#fbe7a8"
  gold: "#d4a94e"
  gold-lo: "#7c5a1c"
  gold-line: "#b88b35"
  seal-hi: "#ff5a74"
  seal: "#e0233f"
  seal-lo: "#6e0d1d"
  guard-hi: "#a9d0ff"
  guard: "#4f8fe2"
  guard-lo: "#183f80"
  health: "#e34a5f"
  agility: "#2fc2a5"
  luck: "#a982ff"
  mana: "#63b8ff"
  warn: "#e8a33a"
typography:
  display:
    fontFamily: "FGT Cinzel, Trajan Pro, Georgia, serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.1em"
  title:
    fontFamily: "FGT Cinzel, Georgia, serif"
    fontSize: "0.95rem"
    fontWeight: 700
    letterSpacing: "0.16em"
  body:
    fontFamily: "FGT Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.38
  figure:
    fontFamily: "FGT Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    fontFeature: "\"tnum\" 1"
  hero:
    fontFamily: "FGT Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "3.2rem"
    fontWeight: 800
    lineHeight: 0.95
  label:
    fontFamily: "FGT Barlow Semi Condensed, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  none: "0px"
spacing:
  gap: "0.5rem"
  cut: "12px"
components:
  plate:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.bone-ink}"
    rounded: "{rounded.none}"
  button-commit:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.night-sunken}"
    padding: "0.4rem 1rem"
  button-end-turn:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.bone-ink}"
    height: "2.4rem"
  slot:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.gold-hi}"
    size: "3.1rem"
  tab-active:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.night-sunken}"
---

# Design System: Fate/Grail Tactics

## Overview

**Creative North Star: "Grail War Nocturne"**

A Holy Grail War fought at night. Every surface is lacquer, blue-black and never a neutral grey.
Its edges are gold leaf, its corners are cut, and the one hue that means "act now", "it is spent"
or "it fell" is Command Seal crimson. The interface reads as a game, never as a web page. The
night and the gold carry the war's mood, and they never make a figure harder to read.

There is one signature move: the **summoning circle** (`module/apps/ornament.mjs`). It turns slowly
behind every portrait and medal, closes over a slot as its Cooldown runs out, and erupts in the
Noble Phantasm cut-in. It is drawn from a few loops, not traced, so it is crisp at every size.

The actor sheet takes its structure from Fate/Grand Order's Servant screen: a tall framed portrait
card, big tab buttons, skill rows that lead with "SKILL 1" and the Cooldown, and Parameters as
segmented bars with the letter Rank. It keeps this system's palette, not FGO's glossy blue.

There is one look, night, whatever Foundry's own theme says (#364). The system's windows force
core's dark variables (`themed theme-dark`), so core's own inputs agree with the plates around them.

**Key Characteristics:**
- Plates: panels with cut corners and a metal edge, built from two pseudo-elements (`plate` in
  `styles/src/_ornament.scss`). An edge's hue can carry meaning: the reader's role on a card, the
  faction on a portrait.
- Gold marks what can be done and what is ornament. Crimson marks what must be done, spent or lost.
- Colour is never the only signal: an icon, an arrow or a word stands beside every hue.
- Motion rewards a player's own act and announces what the game did to them. It never decorates a
  re-render.

## Colors

### Primary
- **Gold Leaf** (#d4a94e, with Gold High #fbe7a8 and Gold Low #7c5a1c): the metal of every edge,
  the commit button, the active tab, a ready slot's glyph. As a three-stop gradient it reads as metal.

### Secondary
- **Command Seal Crimson** (#e0233f, with #ff5a74 and #6e0d1d): End Turn, a Noble Phantasm's slot and
  ribbon, the attacker's side of a card, a defeat, a debuff's frame.
- **Guard Blue** (#4f8fe2, with #a9d0ff and #183f80): the defender's side of a card.

### Status
- **Health** (#e34a5f), **Agility** (#2fc2a5), **Luck** (#a982ff), **Mana and pools** (#63b8ff):
  each printed with its word. Agility is teal, not green, so the three stay apart under
  deuteranopia and protanopia.
- **Buff** teal with an up-arrow, **debuff** red with a down-arrow, on an effect's corner diamond.

### Neutral
- **Night** (#0a0d1a), **Night Raised** (#111629), **Night Sunken** (#05060c), and #1a2140 and
  #262f57 for tracks and tiles. **Bone Ink** (#efe8d6) is the text, with Ink Dim (#a3a6bd) and
  Ink Faint (#7a7f9e) below it.

### Named Rules
**The Tokens Only Rule.** Every colour is a `--fgt-*` custom property in `styles/src/_tokens.scss`.
A hex at a use site is a bug.

**The Crimson Means Now Rule.** Crimson is kept for what must be done or what was lost. It never
decorates.

## Typography

**Display Font:** Cinzel, shipped as `FGT Cinzel`, for names, titles, tabs and banners.
**Body Font:** Barlow Semi Condensed, shipped as `FGT Barlow Semi Condensed`, for the interface.
**Figures:** Barlow Condensed, shipped as `FGT Barlow Condensed`, for every number a player compares.

All three ship as woff2 in `fonts/` under the SIL Open Font License, with Latin and Latin Extended
subsets, so a name like Tenmōkaikai renders in the face. Nothing loads from the web.

**Character:** Cinzel is engraved and Roman, the lettering of a war fought over a relic. Barlow is a
condensed workhorse that keeps a dense HUD readable.

### Hierarchy
- **Display** (Cinzel 800, 1.6rem, tracked 0.1em, gold metal fill): a class on a portrait's foot.
- **Title** (Cinzel 700, about 0.95rem, tracked 0.16em, uppercase): window titles, tabs, section
  titles, role banners.
- **Body** (Barlow Semi Condensed 400, 0.9rem, 1.38): card and ability prose.
- **Figure** (Barlow Condensed 700, tabular): gauges, costs, Cooldowns.
- **Hero** (Barlow Condensed 800 italic, 3.2rem, gold metal fill, skewed): a card's damage.
- **Label** (Barlow Semi Condensed 700, 0.68rem, tracked 0.16em, uppercase): one short label above a
  group.

## Layout

- **The action bar** mounts in Foundry's `#ui-bottom`, above the hotbar, and fills the middle column
  in three columns: who (the medal, the effect strip, the gauges), what they can do (rows of slots),
  and the Turn (End Turn pinned to its foot).
- **Chat cards** are plates in the sidebar's width. Each opens with the reader's role banner.
- **The actor sheet** opens at 900×720: the portrait card's column on the left, the tabs across
  the top of the right, the pane below. Under 760px the card stacks on top.

## Elevation & Depth

Depth is layered, not flat. A plate lifts off the board with a soft drop shadow
(`drop-shadow(0 16px 26px rgb(0 0 0 / 65%))`). Inside a plate, tone separates the wells. Glow is
kept for state: a ready Noble Phantasm breathes crimson, an answer to a Counter breathes gold, and
the reader's own side of a duel is ringed in gold.

## Shapes

Corners are cut, never rounded: 10 to 18px on plates, 6 to 10px on buttons and tiles. Tabs, chips
and buttons are slanted parallelograms. Skill gems and buff diamonds are rotated squares. Gauges and
Parameter segments are skewed. The portrait card is the one tall frame.

## Components

### Slots (action bar)
Metal tiles with cut corners. A ready slot's glyph is lit gold. A Cooldown closes a conic shade over
it with its figure. A disabled slot is desaturated, with its refusal in the tooltip. A Noble
Phantasm's slot is larger and crimson, and breathes when ready. An armed Counter lights what can
answer and darkens the rest.

### Gauges
A word, a skewed track and a figure. When a resource falls, the fill drops at once and a pale ghost
of the loss drains after it (`ActionBar#animateGauges`).

### Effects
Every effect shows its own picture in a metal frame (crimson for a debuff), with a diamond on its
corner: teal with an up-arrow for a buff, red with a down-arrow for a debuff. Foundry's stock icons
are no one's art, so a sparkle glyph stands in for them until the effect has its own.

### Cards (chat)
A plate whose edge is the reader's role: crimson for the attacker, blue for the defender, split for
the GM, gold for an observer. A banner says it in words with an icon. The duel row shows each side's
public face and marks the reader's own **YOU**. A Noble Phantasm's ribbon is crimson. The damage is
the hero figure, counted up once when the card lands. A whisper's edge is dashed.

### The Noble Phantasm cut-in
When a Noble Phantasm is declared, every client sees a crimson band sweep the board with its name,
over a flash and the summoning circle, in under two seconds (`apps/chat/cut-in.mjs`). It is held
back under reduced motion and Foundry's photosensitive mode.

### Tabs (actor sheet)
Slanted plates with an icon and a word. The active tab is gold metal with dark lettering. Opening a
tab lets its sections rise in. A render never replays it.

### Portrait Card (actor sheet, signature)
A tall frame in the faction's colour: the face over a turning summoning circle. A Unit with no face
shows its class crest large and centred. The foot gives the class in gold metal Cinzel and the name
beneath, both through the identity reader.

### Skill Rows (actor sheet)
In FGO's order: "SKILL n" with the Cooldown, a diamond gem holding the ability's art or its kind's
glyph (gold when usable), the name with its Rank, the text, and a gold USE.

### Parameter Bars (actor sheet)
The key, six skewed segments from E to EX lit ember-gold to the Rank in force (EX in white gold), and
the letter Rank.

## Do's and Don'ts

### Do:
- **Do** define every colour as a `--fgt-*` token.
- **Do** pair every hue with an icon, an arrow or a word (D29.7).
- **Do** keep core's window positioning when dressing a window (`plate($position: null)`).
- **Do** gate every motion on `prefers-reduced-motion`, and the cut-in on photosensitive mode too.
- **Do** keep every class name and `data-*` attribute that code or tests read.

### Don't:
- **Don't** animate a re-render. A part re-renders as a fresh element.
- **Don't** spend crimson on decoration.
- **Don't** load a font from outside the system.
- **Don't** show Foundry's item bag or silhouette as a picture. Use the kind's glyph or the class crest.
