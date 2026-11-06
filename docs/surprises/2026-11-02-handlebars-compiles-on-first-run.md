---
id: 2026-11-02-handlebars-compiles-on-first-run
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** A template Foundry has loaded with `getTemplate` is compiled and ready, so the first actor sheet a client opens costs what every later one does: about 40ms.
**Actual:** The first sheet after a load spent 341ms in `_renderHTML`, and every later one 4–6ms. Running the six part templates and two partials once on `{}` beforehand took 320ms and brought the first open to 75ms. The user had noticed that "the sheets take some time to render the first time".
**Cause:** Handlebars' `compile` returns a function that compiles on its first call. Foundry's `getTemplate` caches that function, so loading a template is a fetch, and the compile lands on whichever render runs it first.
**Fix:** `module/apps/actor-sheet/sheet.mjs @ 2153ccd9`: `FGTActorSheet.warmTemplates` runs each part and partial once on an empty context. `module/fgt.mjs @ 2153ccd9` calls it from `requestIdleCallback` after `ready`.
