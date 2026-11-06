---
id: 2026-11-04-bug-space-skill-invented
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Enuma Elish's *"Bug Space: If the Unit with this Skill is affected"* needs a Skill of that name, so I picked a new Skill, *Bug Space*, on Kazuradrop, holding the list and the release. Gilgamesh's stand-in row, `kazuradrop-bug-space`, assumes the same id.
**Actual:** The user, grill Q42: *"Let's instead make it aim at Kazuradrop, or to a Character that has the ability that creates the Bug Space"*. The heading names a mechanism, and the row goes to whoever holds the ability that creates it.
**Cause:** `packs/_source/abilities/gilgamesh-enuma-elish.yml:148 @ 74ed98ac` — the row keys on an ability id no sheet prints, and I built my pick on that id rather than asking what the word pointed at.
**Fix:** `packs/_source/abilities/gilgamesh-enuma-elish.yml @ 8232005f` — the row names `kazuradrop-gully-trap`, the ability that creates Bug Space.
