---
id: 2026-11-16-foundry-bug-filed-unpressed
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** I took reading Foundry's code, plus a press of the Godot port, as enough proof to file Foundry bugs. I
filed #418 (the Normal Assassin's concealment) and #419 (the Normal Mad Enhancement drain) that way.

**Actual:** the user: "before asserting something is a bug first in the foundryVTT, you are to check it in the live
world." Pressed afterwards in fgt2026, both held. A Normal Attack on the concealed Normal Assassin read "✓ Legal — click
to confirm". The Master of a Normal Berserker that switched Mad Enhancement on and ended its Turn stayed at 300/300.

**Cause:** `docs/surprises/patterns/claim-without-reading-the-path.md @ c79630dd`: a code reading is a lead. A
Foundry bug's evidence is the live world's screen.

**Fix:** both issues now carry the live reproduction (#418, #419 comments). The memory
`feedback-foundry-bug-checked-live` asks for a live press before any Foundry bug claim.
