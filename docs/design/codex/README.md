# The Ability & Effect Codex

There is one row for every ability (passives included) and every effect the packs author. Each row
says four things:
- what it does in this system
- what it does in one plain line
- what TYPE-MOON lore says it is and looks like
- what its icon should look like

The Google Sheet "FGT Ability & Effect Codex" holds these rows in an Abilities tab and an Effects tab.
It is a copy of `abilities.csv` and `effects.csv`. The icon grammar the last two columns follow is in
[`../fgo-icon-visual-identity.md`](../fgo-icon-visual-identity.md).

| File | What it is |
|---|---|
| `abilities.rows.json`, `effects.rows.json` | The columns read from `packs/_source`: id, name, rank, kind, holders, sharing, and the system text. |
| `columns.json` | The hand-written columns, keyed by row id: the one-line phrase, the lore, the look, the wiki source, the icon family and the icon concept. Effects are keyed `effect:<id>`. |
| `abilities.csv`, `effects.csv` | The two merged into the sheet's 13 columns. |

## Rebuild

```sh
node tools/codex/build-rows.mjs --csv docs/design/codex/columns.json
```

It prints the counts. It also prints how many rows lack a line or an icon: a new ability or effect
shows up there until `columns.json` gains its entry.

## Scope

**In scope:**
- abilities, Class Skills, Command Spells and Master Essences
- abilities held by summons
- every effect

**Out of scope:**
- test Servants (`test-*`)
- Normal Servants, and anything held only by them

## Sources

- **TYPE-MOON Wiki** (`[TM]`) comes first.
- **Fate/Grand Order Wiki** (`[FGO]`) is used for game-mechanic statuses, and for FGO-era skills the
  TYPE-MOON Wiki lacks.
- **"No wiki entry"** marks a row that was searched and found nothing. It is mostly this game's own
  inventions.

Lore and look are short paraphrases, never quotes.
