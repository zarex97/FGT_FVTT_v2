---
id: 2026-10-29-self-ask-has-no-clock
found: live press
kind: producer-without-consumer
status: open
reviewed: true
pattern: producer-without-consumer
---
**Expected:** every question the engine asks a person ends: `FGTSocket.ask` withdraws it after its timeout (120 s by
default), and a reaction or Command Spell window times out at 15 s to the option that spends nothing.
**Actual:** Player1's Dainisshō on Asterios (Player2 not connected, so the GM answers for him): two "Contest with a
Luck Check?" windows sat on the GM's screen for minutes, not listed in the pending panel, and both Processes stayed at
`damage` with their cards still reading "Expected damage", the declaration's end (and Dmg Up (Aphotic)'s removal) held
until the GM pressed No.
**Cause:** `module/net/socket.mjs:190 @ 03883e1` — "Asking ourselves goes straight to the dialog": the self-ask skips
the timer, so a question the GM answers for an absent player has no clock and no withdrawal.
**Fix:** open — #357.
