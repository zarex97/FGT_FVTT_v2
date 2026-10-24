---
id: 2026-10-23-compulsion-banner-printed-json
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Player1 opens Dracula Vlad's sheet and reads that he must Attack the closest Unit (#330, LD.closest).
**Actual:** the sheet's amber banner read `{"id":"dracula","within":1,"relations":["ally","enemy"],"targetPredicate":null,
"forcesTarget":true,...}`.
**Cause:** `module/apps/actor-sheet/context.mjs:491 @ 630495df` — the banner shows `rule.text ?? rule.reason`, and no
`Compulsion` element carries either, so every compulsion fell to `JSON.stringify(rule)`: Penthesilea's and Karna's too.
**Fix:** `module/apps/actor-sheet/context.mjs:493 @ uncommitted` — a sentence from the lang file, naming the source by
its definition's name.
