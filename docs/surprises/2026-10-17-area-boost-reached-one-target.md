---
id: 2026-10-17-area-boost-reached-one-target
found: user
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: declaration-or-process
---
**Expected:** Noble Phantasm Max, Damage Up and the NP damage Essences boost the attack, so an area NP's every
target takes them; my plan offered them on the first card and made the other cards wait for it.
**Actual:** Live, a boost was offered on each defender's card and written to that card's Process only: one target
of an area NP took it. The user then proposed a window of its own after targeting and before the ladder, which
Ch. 33's `beforeAttack` already named and no card had ever shown.
**Cause:** `module/engine/command-spells.mjs#interruptProcess @ e2b42d22` wrote an interrupt to the card it was
bought on, and to a sibling only for Escape. A boost of the whole declaration had no place of its own, so it was
pinned to a per-defender card (`timing.states: [react]`, §46.4-PD).
**Fix:** `module/engine/declaration-window.mjs @ uncommitted`: one whispered card per declaration, and every
Process starts with what it bought (`carryDeclarationBoosts`). Live: Excalibur over two Masters, both cards
*"Total Damage x3.5"*.
