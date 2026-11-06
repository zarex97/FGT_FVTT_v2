---
id: 2026-10-17-window-offered-what-it-refused
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** A window offers only what its owner may use, and a card says a Unit used what it used.
**Actual:** *"Start of the Combat Phase"* offered Reinforcement under the spent cap; picked, the use gate refused it,
and the chat read *"Assassin uses Thaumaturgy: Reinforcement."* over a buff that never landed.
**Cause:** `module/rules/reactions.mjs#abilitiesAtWindow @ 72cbaca6` re-implements the use gates and never asked the
category cap; `module/engine/attack.mjs#offerAttackerWindow @ 72cbaca6` announced every pick, refused or not, and
carried casts as contributions.
**Fix:** `module/rules/reactions.mjs#abilitiesAtWindow @ 24f8c657` asks `costs.mjs#categoryLimitFor`;
`offerAttackerWindow @ 24f8c657` announces only the uses that landed and carries no cast.
