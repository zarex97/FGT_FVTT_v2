# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One Game Master and two to four players, together online in a Foundry VTT world, usually over
voice, for long sessions. A Turn belongs to a player, not a token: on it, one player moves and
acts with several Servants and Masters. The other side answers what that Turn asks of it (an
Evade, a Block, a Counter, a Luck Check) through prompts that wait on a deadline. The GM runs the
war, adjudicates, and can override what the log records.

## Product Purpose

F/GT (Fate/Grail Tactics) is a grid-based tactical wargame of Masters, Servants and Noble
Phantasms, first played in Tabletop Simulator. This system plays it inside Foundry VTT with full
rules automation: a Servant is a document whose clauses the engine executes, not a sheet a human
interprets.

The rules engine is the product; the interface is how players come to trust it. Success is a
player who can see, at a glance, what each of their Units can do right now and why anything else
is refused, and who can read every outcome afterwards: who did what, with which die, and what
changed.

## Positioning

A wargame with a rules engine, not a role-playing game with a character sheet. Combat is an
interactive negotiation between two players (attack, evade, luck-check contest, counter-check,
counter-attack) resolved by the engine, with the chat card as the audit record of each one.

## Operating Context

- Played inside Foundry VTT v14, beside core's own interface: the scene controls, the players
  list, the hotbar, the sidebar with the chat log, and the canvas board of panels.
- Three surfaces carry the game. The **action bar** shows the controlled Unit's actions,
  abilities and modes, with the turn panel's budget and order. **Chat cards** carry each
  Process, its prompts and its breakdown. The **actor sheet** is the Unit's window.
- A Turn's options change with every write, so the bar re-renders often.
- Each viewer reads a different version of one card: what an opponent may see is redacted by
  side.
- Terms follow `CONTEXT.md`. "Actor sheet" is the Foundry window, while a "Character Sheet" is the
  authored source a Unit is built from.

## Capabilities and Constraints

- Runs inside Foundry VTT v14 (minimum 14, verified 14.364). Every surface lives in Foundry's
  page, its cascade layers and its light and dark themes.
- Built with Handlebars templates, `ApplicationV2` windows and SCSS compiled to
  `styles/fgt.css`. There is no framework and no dev server of its own.
- Class names and `data-*` attributes that code and tests read are part of the contract.

## Evidence on Hand

- Portraits: 12 square Servant portraits in `assets/servants/`, mostly 256px.
- Class icons: 15 in `assets/classes/`, at 80px.
- Every ability uses Foundry's generic item icon. No ability art exists, and none may be
  invented as if it did.
- A live world, `fgt2026`, with a full roster to look at.

## Product Principles

1. **Show the option and its refusal.** Whatever a Unit cannot do now says why, in the
   engine's own words.
2. **Every outcome is legible.** A card names who, what, the die and the change. Nothing an
   opponent may not see leaks.
3. **The engine is trusted through the UI.** What a surface says is what the engine did.
4. **Clarity first, spectacle second.** Ornament may give the war its night-and-gold mood, but
   never at the cost of reading a figure.
