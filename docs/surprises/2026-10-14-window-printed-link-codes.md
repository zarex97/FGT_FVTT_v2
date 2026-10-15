---
id: 2026-10-14-window-printed-link-codes
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** the "Start of the Combat Phase" window offers Uncrowned Arms Mastership with its description in words, as the sheet shows it.
**Actual:** Round 6, Brahmastra Kundala's declaration: the option read "The effects of this Skill are negated by @UUID[Compendium.fgt.effects.Item.lpna73nh1q5j8zvs]{Skill Seal}".
**Cause:** `module/engine/attack.mjs:6314 @ 7333e08` — the window, the copy dialog and the action picker pass a raw `description` as an option's `detail`, and `templates/apps/choice-dialog.hbs:23` prints it as text. Only the sheets enrich (`apps/enrich.mjs`).
**Fix:** `module/apps/choice-dialog.mjs:27 @ 95b91ea` — `plainLinks` reads each link as its label for every caller; test in `karna-206-rulings.test.mjs`.
