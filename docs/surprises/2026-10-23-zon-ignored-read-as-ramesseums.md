---
id: 2026-10-23-zon-ignored-read-as-ramesseums
found: live press
kind: precedent-carried-without-asking
status: fixed
reviewed: false
---
**Expected:** Vlad in Wallachia, 5 panels from his Master, offered Kazıklı Bey (Execution) at the end of his
Attack's Combat Process (#330 ruling 25).
**Actual:** the window was asked and the gate refused it, reason `zon`: outside his Master's ZON. Wallachia's
"his Master's ZON is ignored" had been built as Ramesseum's `Suppress zonPenalty`, the damage penalty alone.
**Cause:** `packs/_source/abilities/vlad-demonic-defender-of-the-state.yml:72 @ 2f18de06` — my grill pick (ruling 5,
"as Ramesseum's") carried Ozymandias's narrower clause, *"when he Attacks (no damage reduction)"*, onto a sheet
that says the ZON is ignored with no qualifier; the scope was never put to the user.
**Fix:** `module/rules/zon.mjs#waiveZon @ 2f18de06` — the user ruled the whole ZON (#330 ruling 29): `Suppress
{scope: zon}` takes a Servant inside it for the penalty and the NP gate both.
