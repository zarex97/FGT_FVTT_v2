---
id: 2026-10-12-drag-moves-part-way
found: tooling
kind: synthetic-drag-partial
status: open
reviewed: false
---
**Expected:** a claude-in-chrome drag of her token moves her to the drop panel.
**Actual:** 8 panels dragged moved her 3, then 1; arrow keys panned the canvas.
**Cause:** not found.
**Fix:** open. The rest of each walk was driven by `TokenDocument#move` from Player1's client, the call a drag ends in.
