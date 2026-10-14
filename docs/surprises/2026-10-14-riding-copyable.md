---
id: 2026-10-14-riding-copyable
found: live press
kind: family-marker-missing
status: fixed
reviewed: true
pattern: family-marker-missing
---
**Expected:** The GM's Wisdom of Dún Scáith list offers no Class Skill ("excluding Class Skills").
**Actual:** The live list offered "Medusa: Riding A+", a Class Skill on her sheet ("(Medusa) Class Skill: Riding — Rank: A+").
**Cause:** `packs/_source/class-skills/riding-medusa.yml @ 4983091` — five Riding files carried neither `kind: classSkill` nor a `copyable` refusal, which every other Class Skill file does.
**Fix:** `packs/_source/class-skills/riding*.yml @ cde0483` — `copyable: { allowed: false, reason: classSkill }` on all five.
