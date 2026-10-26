---
id: 2026-10-26-anti-dragon-tag-had-no-writer
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Arturia's Magic Resistance weakness (#230 reading 21) meets an Attack *"with the 'Anti-Dragon'
Attribute"*, so some attack carries that mark.
**Actual:** the weakness read `attack:tag:antiDragon`, and no ability in `packs/_source` carried `antiDragon` among its
`npTags`: a reader with no writer, so her weakness could never fire. Found reading the path for Armor of Fafnir.
**Cause:** `packs/_source/servants/arturia.yml:46 @ d3452f94` — `tag: antiDragon`; the tag's only writer was the test
that hand-built an attack with it.
**Fix:** `packs/_source/class-skills/magic-resistance-weakness.yml:43 @ dc6ed266` — the template reads
`attack:vsAttribute:@vsAttribute`, Siegfried's gloss of Anti-Dragon (#341 ruling 5); Arturia passes `vsAttribute: dragon`.
