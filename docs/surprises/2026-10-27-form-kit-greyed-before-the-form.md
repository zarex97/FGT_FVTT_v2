---
id: 2026-10-27-form-kit-greyed-before-the-form
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Before Sieg transformed, Player1's bar holds his own abilities only.
**Actual:** The bar listed Siegfried's seven as greyed slots: *"Riding — Gone with the form he has taken."*, *"Balmung … — G…"*.
**Cause:** `module/apps/hud/action-bar.mjs:241 @ 6ef9ce96` — the bar and the sheet list every ability item and grey the ones `keptByForm` drops; a `formOnly` item is dropped too, so it showed as one the form took away.
**Fix:** `module/rules/form.mjs:56 @ ab3d28a9` — `heldNow` keeps a form's own abilities off the bar and the sheet until that form is taken.
