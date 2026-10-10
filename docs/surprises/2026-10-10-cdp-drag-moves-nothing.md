---
id: 2026-10-10-cdp-drag-moves-nothing
found: tooling
kind: headless-canvas-input
status: open
reviewed: true
pattern: vps-drive-kit
---
**Expected:** a CDP `Input.dispatchMouseEvent` press-move-release over a token on the VPS's headless Chrome
drags it, as the claude-in-chrome drags did on the PC.

**Actual:** the canvas received every `pointerdown`/`pointermove`/`pointerup`, and no token moved — on the
ground Level and on the Storm Border's alike, with no notification.

**Cause:** not found. Clicks on the HUD and on panels (`pickDestination`) work over the same channel.

**Fix:** open. Movement Clauses on the VPS are driven through `TokenDocument#move`, the call the drag ends
in, and recorded as `Pressed (engine)` with this named.
