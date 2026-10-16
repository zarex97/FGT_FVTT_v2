---
id: 2026-10-15-gm-background-tab-stale
found: tooling
kind: drive-kit
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** the GM tab's board matches Player1's after a move, and a reload of the GM tab draws its canvas.
**Actual:** the GM's TokenDocuments kept old x/y, so distances read wrong; once a reload stopped at "Loading" with "TokenRing UV generation failed", and every attack then refused "Choose a target." with an empty board. One drag on Player1 moved every controlled token at once.
**Cause:** a background tab never finishes token animations, a canvas that failed to draw has no placeables for `currentBoard`, and Foundry drags every controlled token together.
**Fix:** on the GM tab, `Hooks.on('updateToken', d => setTimeout(() => d.object?.stopAnimation?.(), 30))`; check `canvas.ready` after a reload and reload again if false; release all and control one token before a drag.
