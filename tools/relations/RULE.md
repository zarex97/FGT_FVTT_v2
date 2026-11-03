# Second pass: resolving flagged pairs under the user's rulings (#376)

Your input `tools/relations/work/flagged-<n>.json` holds pairs the first pass flagged. Each row has the
wiki entries (`entries`) and the first pass's call (`first`: context, preset, numbers, reason, why flagged).
Write `tools/relations/work/flagged-<n>.out.json`: one row per input row, in input order, in the output
schema of `CLASSIFY.md` (read it first, including its rule to work only in your own directory).

Re-read each pair's entries and decide again, now applying the user's rulings of 2026-11-03:

1. **A pseudo-Servant's vessel's ties count** as the Servant's own (Zhuge Liang is Waver: bond with
   Iskandar; Ishtar is Rin: tied to EMIYA; Rasputin is Kirei: tied to Angra Mainyu). Class by where the
   vessel met them (a Grail War story is `grailwar`; the Case Files count as `grailwar`).
2. **Ancestors, descendants and rival clans who never met** are context `legend`, preset `cycle` 20/10.
   A clan feud may lean enemy (e.g. `cycle` 10/40, override true).
3. **A tie an FGO event's plot makes** (SE.RA.PH, Heian-kyō, the Prison Tower, Servant Summer, the Saber
   Wars, GUDAGUDA, Prisma Illya's story) counts like a story chapter: context `story`, preset `cycle`.
   A My Room line from an event is still `chaldea`.
4. **A Lostbelt or alternate self** carries the tie when it treats the other as the person it knew; when
   it says the other is a different person, there is no tie (`chaldea`).
5. **Two forms of one person** (Carmilla and Elizabeth, old and young Li Shuwen, the two Gilles) are
   `none`: variants of one figure are never tied to each other.
6. **Empty entries** are `none`, unflagged: no text, no tie.

After applying them, set `flag: false` unless a real question remains that none of these rules answers;
then keep `flag: true` with a `flagReason` that states the question for the user in one line.
Run `python3 tools/relations/validate.py` when done; your file must show 0 problems.
