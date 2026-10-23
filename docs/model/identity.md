---
shape: Identity
parent: Character
code: module/rules/identity.mjs, module/engine/public-identity.mjs
---
**What it is:** what other players know of a Unit: its True Name, Class and Noble Phantasm.

**Fields:**
- `identityRevealed`: one flag, the same for every viewer. Known.
  keys: `actor.identityRevealed`
- NP True Name learned per player (**Variant**, Caster 2026-10-21): Sen no Rikyū, Gilles (Caster) and Mozart have a
  chance of *"learning the True Name of that NP (the information of that NP is copied to your Notebook)"* when
  an Artistic NP is used near them. That is one player learning one NP, not a public reveal. Assassin 2026-10-21
  widens it past NPs. First Director of FBI's Coercion forces a Skill's full text, and Classified shares a Unit's
  Notebook page to Units near it. Jack's Information Erasure wipes what a player wrote down about her. Fathomless
  Hassan's Shadow Lantern turns True Name Discernment into a coin flip. Ruler 2026-10-21: True Name Discernment
  itself, on 5 sheets, copies a met enemy's whole Notebook page, behind a Luck Check if it hides its information.
  Metatron Jeanne is immune to it. The first of these runs since #323: `LearnsTrueNames` rolls for each witness of a
  tagged NP within its radius, whispers the die to its player and copies the NP into that player's Notebook (a Journal
  Entry, `engine/notebook.mjs`). Coercion, Classified, Information Erasure and True Name Discernment are not run, #297.
  keys: `element.LearnsTrueNames`
- disguise: Yan Qing's Doppelganger shows another Unit's look. Known, `rules/elements.mjs#Disguise`.
  keys: `phase.disguise`, `element.Disguise`

**Kin:** Caster: K121, 3 sheets. Assassin: First Director of FBI, Jack, Hassan (Fathomless), 4 Clauses. Ruler: K1, 5 sheets.
