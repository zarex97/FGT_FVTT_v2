---
id: 2026-10-24-mode-line-spoke-as-the-player
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** the new mode-switch card, posted from Player1's client, speaks as the Unit's public name.
**Actual:** "Kingprotea — Berserker deactivates Mad Enhancement." Kingprotea is Player1's assigned character, not
the Unit that switched.
**Cause:** `module/apps/actor-sheet/sheet.mjs#sayModeSwitch @ 9d40169a` called `ChatMessage.create` with no
speaker, so Foundry's own guess, the user's character, spoke. Every engine card names its speaker through
`public-identity.mjs#publicSpeakerFor`.
**Fix:** `module/apps/actor-sheet/sheet.mjs#sayModeSwitch @ 9d40169a` passes `publicSpeakerFor(actor, board)`.
