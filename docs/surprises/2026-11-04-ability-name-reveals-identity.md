---
id: 2026-11-04-ability-name-reveals-identity
found: user
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** The public-name guard of #235 keeps a concealed Unit's identity off every card, so a card that says *"Archer of Red"* tells the table nothing more.
**Actual:** The user: *"I noticed that they give the full name of the skills which kinda ends up revealing the identity."* The same card prints the ability's real name, and *Excalibur* names its Unit as surely as *Arturia* would.
**Cause:** `tools/check-public-names.mjs:51 @ 74ed98ac` — `NOT_A_UNIT` lists `ability` and `item` as safe, and `docs/30-concealment-and-identity.md` counts *"an ability's name"* among the safe reads. The rule guarded one name and left the other reader of a Unit's identity open: `module/apps/chat/cards.mjs:59`, `:150`, `module/engine/attack.mjs:1696`.
**Fix:** `module/engine/public-ability.mjs @ 40d6e0d6` — the public tag and its one door, with the guard reading ability names.
