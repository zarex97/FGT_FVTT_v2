---
id: 2026-10-10-imaginary-numbers-terrain-unread
found: live press
kind: collected-but-unread
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** inside the Storm Border Nemo carries `self:terrain:imaginaryNumbers`, so Poseidon's
Protection, Voyager of the Storm, Journey's Guidance and the Noble Phantasm take their Waterside branch.
`storm-border.yml` says the tag is *"painted for everyone aboard"*.

**Actual:** submerged at tick 2, Nemo's options held `self:skillActive:zeroSail` and no terrain at all.
`grep terrainTags module` found nothing.

**Cause:** `packs/_source/platforms/storm-border.yml:38 @ 08ea4b1` authors `terrainTags`, and no reader
exists. The unit tests asserted the YAML, not a projection.

**Fix:** `module/rules/terrain.mjs:306 @ d162f50` — `annotateTerrain` adds the dimension's tags to
every Unit on its Level.
