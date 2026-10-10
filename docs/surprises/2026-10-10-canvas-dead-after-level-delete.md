---
id: 2026-10-10-canvas-dead-after-level-delete
found: live press
kind: teardown-under-the-viewer
status: fixed
reviewed: true
pattern: live-client-only
---
**Expected:** after the Storm Border surfaces or submerges, the GM's board shows everyone where they now stand.

**Actual:** both times it surfaced, and once as it submerged, the GM canvas went blank: `canvas.ready` false, `currentBoard()` an
empty list, the screenshot a grey field. Re-viewing the Level did nothing; `canvas.draw()` restored it.

**Cause:** `module/engine/dimension.mjs#resurface` moves every token to the ground Level and then
`teardown` deletes the dimension's Level, in quick succession; the canvas did not come back on its own.
Not traced into Foundry's own redraw.

**Fix:** `module/fgt.mjs @ d162f50` — `createLevel` and `deleteLevel` hooks redraw the canvas on any client showing
that scene if it is not ready half a second later.
