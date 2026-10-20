---
id: 2026-10-20-cannot-be-negated-read-as-command-spell
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** Gilles de Rais (Saber)'s Mad Enhancement clause 7, *"cannot be negated once Activated"*, was the
Revised wording of clause 7 for every bearer, and it meant a Command Spell's *Suspend Skill*
(`packs/_source/command-spells/cs-suspend-skill.yml`) could not switch the mode off. Ruling 3d took the first
half as recommended; Q3j recommended the second.

**Actual:** The user: *"basically means that is unsealable; it is not affected by the effects of Skill Seal,
check Darius III"*. Darius's sheet prints the plain Revised clause 7, *"if this Unit is inflicted with Skill
Seal while ME is Active, it is immediately deactivated"*, so Gilles's phrase is his own exemption from it, not
the Revised text.

**Cause:** `docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md` @ ca41d4ab — I read a phrase found on
one sheet as the shared Revised text, and guessed which mechanic "negated" named from the one Command Spell
that touches modes. Revised Presence Concealment's clause 8, the same Skill Seal sentence, was already in
front of me and was the closer match.

**Fix:** `docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md` @ ca41d4ab — ruling 3d corrected:
Revised clause 7 is Skill Seal ending the mode; ruling 3j makes Gilles's *"cannot be negated"* a per-sheet
"unsealable" parameter that holds under every pick; Clauses `ME.7.seal`, `WR.me.seal`, `WR.me.seal.own`.
