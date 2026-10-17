---
id: 2026-10-17-before-attack-window-never-shown
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Heaven's Feel, and Noble Phantasm Max beside it, offered on Pollux's Noble Phantasm card in
the `beforeAttack` window (#241 reading 11), pressed as Player1.
**Actual:** the card opened on the defender's rung offering only heals and cures; Heaven's Feel, Noble
Phantasm Max and Damage Up were never offered on any card.
**Cause:** `module/engine/attack.mjs:1264 @ uncommitted` — a declaration is driven `declare → missCheck`
(`process.advance(aimed, "done")`) before its card is rendered, so the one state that opens
`beforeAttack` (`combat-process.mjs#INTERRUPT_WINDOWS`) never sits on a card and `awaitInterrupt` never
sees it. Every command timed `beforeAttack` was authored, offered by the rules and reachable by nothing.
**Fix:** `packs/_source/command-spells/cs-damage-up.yml @ uncommitted` and the four NP-damage Essences —
`timing: { window: beforeAttack, states: [react] }`: the window before the damage is offered on the
card's first rung. Force Noble Phantasm keeps `beforeAttack` alone: it overrides a refusal, not damage.
