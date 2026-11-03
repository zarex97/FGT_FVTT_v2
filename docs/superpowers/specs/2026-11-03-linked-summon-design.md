# Linked Summon — design

**Date:** 2026-11-03
**Source:** the user's design, grilled 2026-11-03 (this session). No sheet states it; it is a War setup rule.
**Chapters affected:** [31 — War Setup and Summoning](../../31-war-setup-and-summoning.md),
[30 — Concealment and Identity](../../30-concealment-and-identity.md),
[35 — Sheets and Editor](../../35-sheets-and-editor.md), [07 — Schemas](../../07-schemas.md)

---

## 1. The problem

War setup draws each Class seat uniformly among its candidates (`rules/war-setup.mjs#candidatesFor`,
`apps/setup-wizard.mjs#drawInto`): a Servant's legend has no pull on who arrives beside or against it.
The user wants a Grail War where Jason tends to bring Argonauts, and where a Servant's rival tends to
answer on the other side. Several sheets already ask for the same data (#292: Jason summons *"a random
Argo-related Servant"*, Zhuge Liang is replaced by *"a Servant from the Three Kingdoms period"*).

## 2. Relationships

A **relationship** joins two Servants of the roster and carries **two weights**:

- **same side**: used when the other Servant stands on the candidate's faction or an allied one;
- **enemy side**: used when it stands on a faction not allied to the candidate's.

Relationships are **symmetric**: A→B equals B→A. There is **one entry per pair**; nothing stacks.

**Presets** fill both numbers; a reviewer may override either.

| Preset | Same | Enemy | Meaning |
|---|---|---|---|
| `named` | 100 | 100 | one sheet names the other |
| `bond` | 60 | 30 | Master–Servant of a Grail War, legend partners |
| `knew` | 40 | 40 | knew each other personally |
| `cycle` | 20 | 10 | same Grail War or legend cycle (Argonauts, Round Table) |
| `region` | 5 | 0 | same `system.region`; **computed**, never authored |

`region` applies only to a pair with no entry. An override is how a pair leans: Jason–Medea can be
`knew` at 20 / 120.

**Groups** (Argonauts, Knights of the Round, Fate/Zero's war) give every pair of their members the
group's preset. An explicit pair overrides the group for that pair.

**Opposing** is a separate, hand-made mark: authored by the user, never mined, and **symmetric**.
While an opposing Servant stands on a candidate's side, the candidate's weight is **×0.5**, once per
opposing Servant, in the normal draw and in the linked draw alike.

### 2.1 Evidence

- A relationship is created only by a **TYPE-MOON wiki `Relationships` entry** or **a sheet that names
  the other Servant**. A line on the FGO wiki's `Sub:<Name>/Character Mentions` is a lead for review,
  never an entry: mentions are inbound and noisy (Jacques de Molay mentions Jason over a golden fleece).
- **An entry is a line, not a tie** (ruled 2026-11-03, after mining showed most entries are FGO My Room
  chatter; Surprise `2026-11-03-wiki-entry-is-not-a-tie`). Each entry is read and classed by context:

  | Context | Proposed as |
  |---|---|
  | Knew each other in life or legend | `knew`, or `bond` for partners |
  | Met in a Holy Grail War story | `knew`, or `bond` for a Master and their main Servant |
  | Met in an FGO main-story chapter (Singularity, Lostbelt) | `cycle` |
  | Only Chaldea My Room or event chatter | **no entry** |
  | A denial, or not about a tie | no entry |

  A reviewer may override any preset's numbers to show a leaning (a story rivalry at 10/60).
- **Variants of one figure** (Arturia, Arturia Alter, Arturia Lily, a summer form) share the figure's
  relationships and are **not** tied to each other. Proposals are made per wiki page (the figure) and
  expand to every roster sheet of that figure when the table is built.
- Each Class batch lists **every** proposed pair with its preset and a one-line reason, the uncertain
  ones flagged at the top for the user to rule.
- Every entry records its **source URL, page revision id and a short quote**: a copied source is a
  snapshot to compare against (Lesson *Sources stay in the repo*).
- Claude mines the pages and **proposes** a preset per pair, with its quote; the user **approves in
  batches by Class**. Nothing enters the table unapproved.
- Scope: every Servant of `char_orig_sheets/` (about 500), not only the converted. A pair is kept only
  when **both** are in the roster; a tie to an unconverted Servant waits in the table.

The wikis answer through the MediaWiki API (`typemoon.fandom.com/api.php`,
`fategrandorder.fandom.com/api.php`); plain page fetches return 403 from the container.

## 3. The draw

1. Seats are drawn **round-robin across factions**: seat 1 of every faction, then seat 2, and so on.
2. A faction's **first seat** never rolls for a link. Every later seat rolls **d100 against
   `linkChance`**, a new War Rule (initial 15; 0 turns linking off). 15 or less links.
3. **No link:** the normal draw, every candidate equally likely, an opposed one at half weight.
4. **Link:** each candidate scores
   - the **same-side** weight of its tie to every Servant on its own or an allied faction, plus
   - the **enemy-side** weight of its tie to every Servant on a non-allied faction,
   - then ×0.5 per opposing Servant on its side.

   The draw is weighted by score over the candidates scoring above 0.
5. **No fit:** when no candidate scores above 0, the faction holds **one pending link**. Its next seat
   skips its own roll and tries the link. When the faction runs out of seats, the link lapses, and its
   line says so.
6. A **GM-fixed seat** is never drawn: it rolls nothing and a pending link passes over it. Its Servant
   counts on the board for every score, and as the faction's first seat when it comes first.
7. `unique`, the Grand Order Beast bar and companions filter every draw, linked or not.
   `summonTogether` partners still arrive together, outside this system.
8. **Re-roll** redraws that seat only (its d100 and its draw, against the board as it stands). A later
   seat whose odds came from a Servant since changed keeps its result; its line says *"drawn while Red's
   Archer was Chiron"*. A pending link stays pending.
9. Linking happens **only at War setup**. A summon into a War under way and conjuring do not link;
   #292 reads the same table as its own work.

### 3.1 Worked example

Red and Blue, not allied. Red's Saber draws Jason, Blue's Saber Arturia (first seats, no roll). Red's
Archer rolls 9: a link.

| Archer | Tie to Jason (Red, same) | Tie to Arturia (Blue, enemy) | Score |
|---|---|---|---|
| Chiron | `knew` → 40 | — | 40 |
| Emiya | — | `bond` → 30 | 30 |
| Atalanta | `cycle` (Argonauts) → 20 | — | 20 |
| Arash | — | — | 0, out |

1d90: 1–40 Chiron, 41–70 Emiya, 71–90 Atalanta. (Illustrative weights.)

## 4. What a person sees

- Each seat's line in the **GM's setup wizard** shows the d100, and on a link the tie that won
  (*"linked to Jason: Argonauts, 20"*), a pending link (*"pending: no Related Servant fits Saber"*) or
  a lapse. A die that decides an outcome is on the line.
- **No chat card names a relationship**: an enemy-side tie names an enemy Servant (Ch. 30).
- A sheet's **Relations** tab is visible to its owner and the GM only, read-only, derived from the
  table; an enemy Servant on it is named through `publicIdentityOf`.

## 5. Where it lives

| Path | Holds |
|---|---|
| `packs/_source/relations.yml` | approved groups, pairs and Opposing marks, keyed by `contentId`, each with its evidence |
| `docs/relations/proposals/<class>.md` | mined proposals awaiting approval: pair, preset, numbers, quote, URL, revision |
| `module/rules/relations.mjs` | the pure reader: weight of a pair, score of a candidate |
| `module/domain/war-rules.mjs` | `linkChance` |

The table gets a route in `test/unit/survival.test.mjs` and a model check in `validate:content`
(every `contentId` resolves to a roster sheet; no pair twice; presets are closed words).

## 6. Tickets

Map: #375. Research comes first; no code until the user says so.

1. #376 — Research: mine the wikis and propose relationships, one batch per Class.
2. #377 — Relation table and reader (`relations.yml`, `rules/relations.mjs`, validation, survival route).
3. #378 — The linked draw in the setup wizard (round-robin order, `linkChance`, pending link, re-roll lines).
4. #379 — The Relations tab on the Servant sheet.
