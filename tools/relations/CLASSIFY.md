# Classifying mined relationship entries (#376)

You read one batch, `tools/relations/work/<Class>.json`, and write `tools/relations/work/<Class>.out.json`.

**Work only in your own directory**, `$SCRATCHPAD/<batch name>/` (create it). Other agents run in
parallel and a shared script name gets overwritten mid-task: a print script that reads another batch
makes you classify the wrong rows. `python3 tools/relations/validate.py` checks your output against
your input when you are done; it must report 0 problems for your file.

Each batch row is a **pair of figures** (`a`, `b`: TYPE-MOON wiki page titles), the roster sheets of each
(`aSheets`, `bSheets`), and the wiki `Relationships` entries where one speaks about the other
(`entries`: `speaker`, `about`, `sub` = the subsection, `text` = the entry with refs stripped, `url`).

## Decide each pair's context, from the text

| context | meaning | preset |
|---|---|---|
| `legend` | knew each other in life or legend: family, lovers, comrades, teacher and pupil, killer and victim, rivals in history or myth | `knew`, or `bond` for the closest partners (sworn brothers, a lord and their knight, lovers) |
| `grailwar` | met in a Holy Grail War story (Fate/stay night, Zero, Apocrypha, EXTRA, Prototype, Strange Fake, Samurai Remnant, etc.) | `knew`, or `bond` for a Master and their main Servant |
| `story` | met in an FGO main-story chapter (a Singularity, Lostbelt, Ordeal Call, Epic of Remnant), or a Lostbelt self tied to Lostbelt figures | `cycle` |
| `chaldea` | only My Room / event / Chaldea chatter: comments, jokes, swimsuits, first impressions | none (no entry) |
| `none` | a denial ("I have no connection to…"), a mistaken identity, or nothing about a tie | none |

Take the **strongest** context any entry supports. If two Servants met in legend AND chat in Chaldea, it is `legend`.
Use your knowledge of the source works only to read an entry correctly, never to invent a tie no entry states.

## Numbers

Presets (same side / enemy side): `bond` 60/30, `knew` 40/40, `cycle` 20/10.
Propose an **override** only when the text shows a clear leaning:
- bitter enemies, a killer and victim, a grudge, a rival seeking a duel → raise enemy, lower same (e.g. `knew` 20/80);
- devoted allies who would never fight → raise same, lower enemy (e.g. `knew` 60/10).
Give the reason in the row.

## Flag

Set `flag: true` with a short `flagReason` when you are unsure: an empty or ambiguous text, a context
between two classes, a possible mistaken page (the entry is about a different person of the same name), or
an override you are not confident in.

## Output

A JSON array, one object per input row, in input order:

```json
{"a": "...", "b": "...", "context": "legend|grailwar|story|chaldea|none",
 "preset": "bond|knew|cycle|null", "same": 40, "enemy": 40, "override": false,
 "reason": "one line, plain English: who they are to each other",
 "quote": "the shortest decisive phrase from an entry, under 200 characters",
 "url": "the url of the entry the quote comes from",
 "flag": false, "flagReason": null}
```

For `chaldea` and `none`, `preset`, `same` and `enemy` are null; still give a reason and quote.
Write valid JSON with Python (`json.dump(..., ensure_ascii=False, indent=1)`), then verify the output row
count equals the input row count.
