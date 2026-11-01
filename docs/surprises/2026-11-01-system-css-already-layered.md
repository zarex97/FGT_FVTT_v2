---
id: 2026-11-01-system-css-already-layered
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** I told the user that `fgt.css` loads outside every cascade layer, so it overrides all of core. I put grill question Q5 to them on that basis: "load `fgt.css` into the `system` layer". They agreed.
**Actual:** It was already there. The live page's head holds `@import "systems/fgt/styles/fgt.css" layer(system);`.
**Cause:** `foundryVTT_copy/app/dist/server/views/view.mjs:1 @ 14.364`. `_getStaticContent` gives each system style `layer: void 0 === s ? "system" : s`, so a manifest entry with no `layer` lands in `system`. I relayed a subagent's reading of `main.hbs` without reading the server code that fills it.
**Fix:** No code change: Q5 is moot, and `system.json` stays as it is. I told the user, and #364's ruling 5 is struck as already true.
