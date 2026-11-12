# Knowledge belongs to the Faction, and every page starts hidden

On the tabletop every Unit's page was open to every player: the core rules tell the table to *"thoroughly read the
Notebook pages of all Units"* before starting, and a figurine's drop-down showed its Health, Agility and Luck. What a
player kept private was their own Notebook, a text only they and the GM could read and edit. Hiding was the
exception a few sheets bought (Mordred's Secret of Pedigree, Hephaestion's Camouflage).

The system turns that round (the user's design, ruled 2026-11-12; `docs/superpowers/specs/2026-11-12-information-system.md`).
**Every Unit's page starts hidden from every other Faction**, and a Faction learns it piece by piece with **Intel** it
earns by watching that Unit act. **What a Faction knows belongs to the Faction**, shared by its players, never by one
player: Intel, bought Entries, a known identity, and everything a sheet teaches (True Name Discernment, Appreciation of
the Arts, Coercion, Classified). The per-player Notebook built for #297 and #323 folds into the Faction's.

Identity follows: it stops being one public flag and becomes the set of Factions that know a Unit, drawn per viewer.
That is the per-viewer rendering Ch. 30 deferred, and the #387 tag swap already does it for ability names.

## Considered options

**Per player.** It matches the tabletop's Notebook and the existing code. Rejected: a Faction's players share a Turn
and a board, and two Notebooks for one side would let one player buy what the other already holds, and make Jack's
Erasure and Classified ask whose knowledge they touch.

**Open by default, sell only what sheets hide.** The tabletop's rule. Rejected by the user: the information economy is
the point, and a page bought piece by piece is what makes watching a Unit worth something.

**Keep identity public.** Simpler: one flag, one token texture. Rejected by the user: an NP reveals its user only to
the Factions that witnessed it.

## Consequences

- A sheet clause written against an open page needs a reading under a hidden one: each is in the spec (Mordred and
  Lancelot, Hephaestion, Jack, the Rulers, Hassan (Fathomless), Metatron Jeanne, the FBI).
- Every line a player reads that carries a figure about a Unit is a leak to close: roll lines and pool lines are
  cloaked per viewer, the message storing the cloaked view.
- The War Rule `informationSystem` off restores the open page, so a War can be played as on the tabletop.
- Every window and line is built in both skins, nocturne and classic.
