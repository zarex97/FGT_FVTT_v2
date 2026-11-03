# Linked Summon: relationship proposals

Research for #376, under [the spec](../../superpowers/specs/2026-11-03-linked-summon-design.md). Nothing
here is in the game: approved rows move to `packs/_source/relations.yml` with #377.

## How these were made

1. `tools/relations/resolve.py` matched the 469 sheets of `char_orig_sheets/by-class` to 344 TYPE-MOON wiki
   pages (the sheet's `True Name:` first, pinned aliases for the misses, disambiguation pages pinned to
   each form). First Director of FBI and Usamimi have no page.
2. `mine.py` read every page's `Relationships` section through the MediaWiki API, with its revision id:
   3051 entries naming another roster figure, 2247 pairs.
3. Each pair was read and classed (`CLASSIFY.md`): legend, Grail War, story chapter, Chaldea chatter, none.
   `validate.py` checked every row against its own pair and quote.
   A second pass (`RULE.md`) re-read the 497 flagged pairs under the user's four rulings of 2026-11-03
   (vessels, lineage, event plots, alternate selves); 459 resolved.
4. `named.py` searched every sheet for every other figure's name; the hits were read by hand.

## Files

| File | Holds |
|---|---|
| [named.md](named.md) | Pairs a sheet's own mechanics single out (`named`) |
| [groups.md](groups.md) | Crews, orders and Grail Wars proposed as groups |
| One file per Class | Wiki pairs: **to rule** (flagged), **proposed**, and **set aside** (chatter, no tie) |

A pair sits in the Class file of its alphabetically first figure and is listed as a pointer in the other's.

## Totals

| | Pairs |
|---|---|
| Proposed, unflagged | 573 |
| To rule (flagged) | 38 |
| Set aside (Chaldea chatter, denials, empty, two forms of one person) | 1636 |
| Named on a sheet | 72 (21 to rule) |
| Groups | 11 |
