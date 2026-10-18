---
id: 2026-10-18-wizard-tabs-cut-off-not-scrolled
found: user
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** every setup-wizard tab marked `scrollable: [""]` scrolls when its content is taller than the window.
**Actual:** the user could not reach the bottom of the Containers tab or of the Servants tab after Roll all; the rows ran past the window and no scrollbar appeared.
**Cause:** `module/apps/setup-wizard.mjs:127 @ b7005fed` — `scrollable` only tells ApplicationV2 which element's scroll position to save and restore. Foundry's `.application .window-content` is a column flexbox with `overflow: hidden`, and `.fgt-setup__tab` (`styles/src/_apps.scss:1086 @ b7005fed`) had neither a flex size nor an overflow of its own, so it grew past the window and was clipped.
**Fix:** `styles/src/_apps.scss:1093 @ aec755e1` — the tab is `flex: 1 1 auto; min-height: 0; overflow-y: auto`. Live, at a 380px window: Containers 261/717 px, Servants 261/597, Confirm 261/339, each scrolled to its last row.
