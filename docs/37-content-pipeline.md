# 37 — Content Pipeline

> **Implementation notes (Ch. 45).** Two source directories were added since this chapter was
> written — `packs/_source/command-spells/` (16 commands, compiling to the `command-spells` pack)
> and `packs/_source/platforms/` (3 reference platforms, compiling into the `servants` pack as
> actors of subtype `platform`).
>
> The compiler carries more fields with them. `itemSystem` now passes Command Spell fields
> (`cost`, `costByMasterRank`, `requirements`, `timing`, `blockedWhen`, `effect`,
> `permanentConsequence`, `overridesValidation`) and `actorSystem` passes platform fields
> (`footprint`, `capacity`, `ownerId`, `level`, `crossLevel`). Without them the catalogue compiled
> into documents that knew their name and cost and nothing about when they could be used.
>
> The summon operation (§37.6) is `module/engine/summon.mjs` over `module/rules/setup-rolls.mjs`.
> `summonPlan` returns an ordered, inspectable list of steps rather than performing them: the
> rolls come **first**, then Master grants, then the war Region's grant, and the sequence always
> ends with a re-rollable `confirm` that locks at match start. A Region step applied before the
> roll would be rolled against the wrong table row, and the two grant sources stack as **separate
> steps** so the dialog can show where each came from.
>
> Base Attack moves ±10 per **granted** parameter step, and only for STR and MAG — §37.6's own
> worked example says so outright ("BA adjustment: none (AGI does not affect BA)"). Granted steps
> are stored separately on the sheet (`system.grantedSteps`), because a sheet showing "B" where
> the Servant was written "C" and granted one step is a sheet nobody can check. A granted END step
> moves the Servant **up the Health table**, not up by one, since the table is not linear.
>
> **The dialog is built** (`module/apps/summon-dialog.mjs`), which is why the engine operation is
> split into `prepareSummon` → `rerollSummonLine` → `commitSummon`: this section requires every
> line to be shown before anything is written, and a one-shot summon has already created the actor
> by the time there is something to show. Changing the Master or Region dropdown **does not
> re-roll** — grants apply after the rolls, so nothing about them can change a die already thrown.
> Re-roll buttons disable once `game.combat.started`, with the reason on screen rather than the
> button simply missing. It is reached from a **Summon** button on the Actors sidebar and a
> context entry in the Servant compendium; a bare compendium drop onto the canvas is **refused**,
> because the actor it makes carries the template's numbers rather than this Servant's rolled ones
> and nothing on the sheet would say so.
>
> **This section's worked example contradicts §14.9 and the code follows §14.9.** The tree below
> rolls a Servant's Max Health (`1000 (END C) ± Health(S) → tails, 2d100 = 87 → 913`); §14.9's
> procedure block says `maxHealth = endTable[END.grade]` with `NO ROLL — Health(S) is not used`.
> An explicit "NO ROLL" in the normative procedure beats an illustrative walkthrough, so a Servant
> summoned by this system has an **unrolled** 1000 there. Every other number in the tree is
> reproduced exactly, and `test/unit/summon-grants.test.mjs` pins them. **If the walkthrough is the
> intended rule, §14.9 is what needs correcting** — one line in `servantSetupPlan` follows.
>
> The compiler also carries §15.7's `copyable`/`copiedFrom` and §15.8's item fields (`quantity`,
> `transferable`, `transferRange`, `transfersPerTurn`, `consumeEffect`), and the validator refuses
> a `copyable.allowed: false` with no documented reason, or a copy that carries phases of its own.
>
> **Source files are single-document YAML.** A multi-document file fails the load; one document
> per file.

The system's long-term cost is not building the engine; it is adding Servant #47. This chapter
specifies the authoring format, the build, validation, and the tooling that keeps that cost low.

---

## 37.1 Source of truth: YAML in the repository

Compendium packs in Foundry v14 are LevelDB directories — binary, unmergeable, undiffable. That
is unacceptable for content that will be reviewed, versioned, and collaboratively edited.

**DECISION.** The source of truth is **YAML under `packs/_source/`**, compiled to LevelDB packs
at build time. The packs are build artefacts and are gitignored.

```
packs/
├── _source/
│   ├── effects/
│   │   ├── buffs/atk-up.yml
│   │   ├── buffs/def-up.yml
│   │   ├── debuffs/curse.yml
│   │   └── … (~120 files)
│   ├── class-skills/
│   │   ├── magic-resistance.yml
│   │   ├── riding.yml
│   │   └── … (11 files)
│   ├── master-essences/  (~40 files)
│   ├── command-spells/   (~18 files)
│   ├── servants/
│   │   ├── karna.yml
│   │   ├── van-gogh.yml
│   │   └── … (12 files, growing)
│   └── masters/
└── (built packs — gitignored)
```

One file per document. Small enough to review, large enough to be self-contained.

Why YAML rather than JSON: comments. Content files carry the source text of the ability they
implement, and being able to quote the rulebook inline next to the implementation is worth a
great deal during review.

```yaml
# "Applies Atk Up for 1◈ Turns, all damage dealt is increased by 40%; if NP, 30%."
- id: atkUp
  duration: "1◈"
  magnitude: { base: 40, np: 30 }
```

---

## 37.2 The Servant authoring format

A complete Servant file, showing the structure a content author actually writes:

```yaml
# packs/_source/servants/karna.yml
schema: 1
id: karna
name: Karna
img: systems/fgt/assets/servants/karna.webp

# ─── Identity ──────────────────────────────────────────────────────────
trueName: Karna
servantClasses: [lancer]
alignment: { order: chaotic, morality: good }
region: [india]
attributes: [male, servant, sky, humanoid]

# ─── Parameters and stats ──────────────────────────────────────────────
parameters: { str: B, end: C, agi: A, mag: B, luc: D }
baseHealth: 1000            # stated on the sheet; overrides the END table
mov: 7
range: { panels: 2, targets: 1 }
baseAttack: { str: 125, mag: 175 }
normalAttack: { mode: fixed, component: str }
sustainability: "2◈"

# ─── Abilities ─────────────────────────────────────────────────────────
abilities:
  # Class skills reference the shared template and supply a rank.
  - { ref: class-magic-resistance, rank: C }
  - { ref: class-riding, rank: A, movBonus: 5, cooldown: "3◈" }
  - { ref: divinity, rank: A, flatDamage: 50 }

  # Personal skills are authored inline or in their own file.
  - ref: karna-fated-rivals
  - ref: karna-discernment-of-the-poor
  - ref: karna-uncrowned-arms-mastership
  - ref: karna-end-of-charity
  - ref: karna-mana-burst-flames
  - ref: karna-flash-of-the-sun-god

  # Noble Phantasms.
  - ref: karna-brahmastra
  - ref: karna-kavacha-and-kundala
  - ref: karna-vasavi-shakti
  - ref: karna-brahmastra-kundala

# ─── Notes preserved from the source ───────────────────────────────────
notes: |
  "Real heroes kill with their eyes."

  Note 2: When Karna uses an NP that deals damage, his Master's Health loss from the NP
  overwrites the 20 Health loss from when Karna would normally Act/Attack.
```

The `ref:` indirection matters. Class skills, Divinity, and shared effects live in their own
files and are referenced with parameters, so fixing Magic Resistance fixes it for every Servant
that has it. Only genuinely unique abilities get their own file under the Servant's name.

### The class-skill template

```yaml
# packs/_source/class-skills/magic-resistance.yml
schema: 1
id: class-magic-resistance
name: "Magic Resistance"
source: class
hasPassive: true
hasActive: false
parameterized: [rank]

passiveRules:
  - key: Resistance
    component: mag
    negatesUpToRank: "@rank"
    reductionByRank:
      table: { EX: 100, A: 50, B: 40, C: 30, D: 20, E: 10 }
      perStep: 0
    includesNP: true

  - key: ApplicationChance
    direction: incoming
    valueByRank:
      table: { EX: -30, A: -25, B: -20, C: -15, D: -10, E: -5 }
      perStep: 0
    terminalLadder:
      instakill: conditional     # only if the source is MAG-based
      death: conditional
      erase: none
    condition: "@attack.component != 'str' && !@attack.ignoresMagicResistance"
```

Authored once, instantiated eleven times across the reference set at seven different ranks.

---

## 37.3 The build

`tools/build-packs.mjs`:

```
1. Discover every .yml under packs/_source/
2. Parse; fail on syntax errors with file:line
3. Resolve `ref:` indirections and parameter substitution
4. Expand rank tables into concrete values? NO — keep them symbolic (see below)
5. Validate (§37.4)
6. Assign stable document _ids (§37.5)
7. Serialize to the pack format
8. Write LevelDB packs via @foundryvtt/foundryvtt-cli
9. Emit a manifest of what changed
```

**Step 4 deserves a note.** Rank tables stay symbolic in the built pack rather than being
resolved at build time, because a rank can change at runtime (Ch. 05 §5.7 — Semiramis aboard the
HGoB, Kiritsugu under Skill Seal). A Magic Resistance whose reduction was baked to 30% at build
time would not respond to a rank shift.

**Step 7 has one derived field, and it is derived for a reason.** `compileDocument` builds
`prototypeToken` from two things: `actorLink` (per actor type — a Servant is one unit and must
share a document with its token; six Dragon Tooth Warriors from one statblock must not), and now
`width`/`height`, taken from an authored `footprint`. Those are the same fact in two places —
the platform's size in panels, and the token's size in grid squares — and only the first was
ever compiled, so the Hanging Gardens shipped a 1×1 prototype for a 9×9 platform. An explicitly
authored `prototypeToken:` block still overrides both, since it is spread last.

This is the general shape of the "authored and inert" defect this chapter's validator exists to
catch, in its hardest form: the field *was* compiled, into `system`, where the rules read it —
what went missing was its Foundry-side twin. §37.4's checks cannot see that class of gap, because
nothing about the source file is wrong. Ch. 20 §20.3 has the consequences.

---

## 37.4 Validation

The single most valuable tool in the project. Runs at build, in CI, and at world setup in dev
mode.

### Structural

| Check | Failure mode it catches |
|---|---|
| Every YAML parses | typos |
| Every document has `schema`, `id`, `name` | malformed files |
| Every `id` is unique across the pack | copy-paste |
| Every `ref:` resolves | renamed files |
| Every parameter a `ref` requires is supplied | incomplete instantiation |

### Domain

| Check | Failure mode |
|---|---|
| Every rank string parses (`Rank.isValid`) | `"A++"` typo'd as `"A+++"` |
| Every duration parses (`TickExpr.parse`) | `"1◈+2/3"` missing the ◈ |
| Every effect id exists in the registry | `defDwnC` typo'd as `defDownC` |
| Every ability cross-reference resolves | `blockedBy` pointing at a renamed ability |
| `blockedBy` symmetry where mutual exclusion is implied | one-sided declarations |
| Every rule element `key` is registered | a typo'd element silently doing nothing |
| Every rule element spec validates against its schema | wrong field names |
| Every predicate parses and its options are known | `target:atribute:divine` |
| Every expression parses and its `@paths` resolve | `@self.helth.value` |
| Every `Script` fn is registered | a script that was never written |
| Every targeting shape and anchor is known | `selfAdjacentRect` vs `selfEdgeAdjacent` |
| Every attribute is in the closed vocabulary | `Non-hominidae` vs `nonHominidae` |
| Every localization key exists | untranslated strings in play |
| Every requirement **kind** is one its reader implements | a gate that refuses for ever |
| Every requirement **selector field** is one its reader reads | a gate that **passes** for ever |
| Every rank table an event action names exists | `floorTable`/`lteTable` resolving to nothing |

Four of those were added by authoring Asterios and Karna, and each was added because something
had already gone wrong in a way nothing announced:

- **Anchors and shapes** were listed here and not implemented. `resolveAnchor` *throws* on an
  unknown kind, so Asterios's *Chaos Labyrinthos* — authored `{kind: selfCentred}`, which reads
  perfectly and has never been an anchor this system has — could not be used at all.
- **Requirement selectors** are the subtler half. An unknown requirement *kind* refuses, which is
  loud. A misnamed *field* on a known kind matches nothing, and `abilityOffCooldown`'s empty match
  set is a deliberate **pass** (§15.4) — so Karna's two cross-NP gates, authored `abilityId` where
  the reader takes `abilityIds`, passed unconditionally in a live world.
- **Tables inside an event action** were unreachable by `ruleElements`, which walks the element
  lists and stops. Every `table:`, `cooldownTable:`, `floorTable:` and `whenValue.lteTable:` under
  a `then:` was unchecked, and an unknown table id is not an error at runtime — it is `lookup`
  returning `undefined` and the action quietly doing nothing.
- **An `applyEffects` phase's entries are effect specs, not rule elements.** Validating them as
  rule elements demanded a `key` they have no use for, so four shipped files carried a decorative
  `key: OnEvent, event: abilityUsed` that reads as an event handler and is not one —
  `applyPhaseEffects` reads `rule.effect ?? rule` and never looks at `key`. Their durations and
  effect ids are still checked; nothing new has to write the ceremony.

### Advisory (warnings, not failures)

| Check | Why a warning |
|---|---|
| A rank predicate uses `gte` on a mid-scale grade without `@intentional` | Ch. 05 §5.3's RISK — usually a bug, occasionally correct |
| A stated `baseHealth` disagrees with the END table by a non-multiple of 100 | Ch. 05 §5.6 |
| A damaging AoE does not explicitly declare `includeSelf` | Note 11's default should never apply silently |
| A cooldown delta is a bare number with no unit | ◈ vs literal turns (Ch. 34 §34.8) |
| A priority override lacks `@intentional` | Ch. 24 §24.6 |
| A cross-Servant reference is unresolvable | the Servant may simply not be in this match |
| An ability has >6 phases | probably wants decomposition |

Output format, designed for someone fixing it rather than someone who wrote the validator:

```
✗ packs/_source/servants/karna.yml
    abilities[7] → karna-brahmastra-kundala → phases[1] → effects[1]
    Unknown effect id "defDownB".
    Did you mean "defDwnB"?
    → The source text reads: "inflicts Def Dwn (B) on all affected Units"

⚠ packs/_source/servants/scathach.yml
    abilities[9] → scathach-gate-of-skye → phases[0] → formula → saveModifiers[0]
    Rank predicate uses `rankGte` on grade B.
    The source reads "if their MAG is Rank B" — equality, not "B or higher".
    Add `@intentional` if `gte` is correct here.
```

Suggesting the correction and quoting the source text is what turns validation from a chore into
a review tool.

---

## 37.5 Stable document ids

Foundry documents need 16-character alphanumeric `_id`s. Regenerating them on every build would
break every reference in every world.

**DECISION.** Derive the `_id` deterministically from the content `id`:

```js
function stableId(contentId) {
  const hash = createHash("sha1").update(`fgt:${contentId}`).digest("base64url");
  return hash.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
}
```

Same content id → same document id, forever, across rebuilds and machines. Renaming a content id
is therefore a breaking change requiring a migration entry (Ch. 39), which is correct: it *is* a
breaking change.

---

## 37.6 The summon operation

Turning a compendium Servant into a playable actor runs the setup rolls (Ch. 14 §14.9):

```
Summon Karna
├── Import the compendium actor
├── Roll Max Health:   1000 (END C) ± Health(S) → tails, 2d100 = 87 → 913
├── Roll Max Agility:  14 (AGI A → 18) + coin flip heads (2) → 20
├── Roll Max Luck:     4 (LUC D) + 1d4 = 3 → 7
├── Apply Master grants: Kaleidoscope (Rank A) → +1 to a parameter (player picks: AGI)
│     AGI A → A+ ⇒ Max Agility +1 → 21;  BA adjustment: none (AGI does not affect BA)
├── Apply Region grant:  war region is India → +1 to all parameters
│     STR B → B+ ⇒ BA(STR) +10 → 135
│     MAG B → B+ ⇒ BA(MAG) +10 → 185
│     END C → C+ ⇒ Max Health +100 → 1013
│     AGI A+ → A++ ⇒ Max Agility +1 → 22
│     LUC D → D+ ⇒ Max Luck +1 → 8
├── Set contract to the assigned Master
└── Show for confirmation, with a GM re-roll button per line
```

Every line is shown before committing, with a per-line re-roll for the GM. Once the match starts,
the rolls are locked.

The **granted vs base** distinction (Ch. 05 §5.6) is visible here: the region grant adds `+10` to
base attack because it *adds* a step, while Karna's innate `B` does not.

---

## 37.7 The ability editor round-trip

A GM who edits an ability in the sheet (Ch. 29 §29.6) is editing the *world's* copy, not the
compendium. Two paths back:

**Export to YAML.** A button on the ability sheet serializes the current state to YAML matching
the source format, for pasting into a pull request. This is how community content reaches the
repository.

**Import from YAML.** A paste box that validates and applies. Useful for sharing homebrew.

Both use the same serializer as the build, so a round-trip is lossless.

---

## 37.8 Content conventions

Established so that 47 Servants look like they were authored by one person:

| Convention | Rule |
|---|---|
| Content ids | `<servant-slug>-<ability-slug>`, kebab-case |
| Shared abilities | No servant prefix (`divinity`, `class-riding`) |
| Effect ids | camelCase, matching the rulebook's abbreviation (`defDwnC`, `sCritUp`) |
| Source quoting | Every non-obvious rule element carries the source sentence as a comment |
| Magnitudes | Always `{base, np}` when an NP variant exists, never two separate elements |
| Durations | Always the ◈ notation as written in the source, never pre-resolved turns |
| Ordering | Phases in the order the source describes them |
| Naming | The ability's `name` is exactly the source's, including the subtitle after the colon |

The last one matters more than it sounds: `"Gáe Bolg Alternative: Soaring Spear of Piercing
Death"` is how players refer to it, and truncating it to `"Gáe Bolg Alternative"` makes the
sheet stop matching the table talk.

---

## 37.9 Localization of content

Content carries English strings inline plus a localization key:

```yaml
name: "Flash of the Sun God"
nameKey: "FGT.Ability.KarnaFlashOfTheSunGod.Name"
description: "…"
descriptionKey: "FGT.Ability.KarnaFlashOfTheSunGod.Desc"
```

The build extracts every `*Key` into `lang/en.json` with the inline string as the English value,
so translators work from a single generated file and English content never needs manual
key maintenance. A missing key in a non-English file falls back to English.

---

## 37.10 Adding Servant #47 — the target workflow

```
1. Copy packs/_source/servants/_template.yml
2. Fill in identity, parameters, stats                          ~10 min
3. Reference class skills with ranks                            ~2 min
4. For each personal skill:
     - create <servant>-<skill>.yml
     - paste the source text as a comment
     - express it as phases and effects                         ~5 min each
5. For each NP: same, plus targeting                            ~8 min each
6. npm run validate:content                                     seconds
7. Fix what it reports
8. npm run build:packs && test in a world
9. Open a PR; the diff is readable YAML
```

For a Servant with 6 skills and 2 NPs: roughly 10 + 2 + 30 + 16 = **~58 minutes**, meeting
SC-6. The reference set's conversions (Chs. 31–36) are the evidence that the format is
sufficient; the two script cases are the evidence that the escape hatch is needed and rare.

---

## 37.11 Summary of decisions

| # | Decision |
|---|---|
| D37.1 | YAML under version control is the source of truth; packs are gitignored build artefacts. |
| D37.2 | `ref:` indirection with parameters so shared abilities are authored once. |
| D37.3 | Rank tables stay symbolic in built packs, because ranks change at runtime. |
| D37.4 | Document `_id`s are derived deterministically from content ids. |
| D37.5 | Validation suggests corrections and quotes the source text. |
| D37.6 | Summon shows every rolled value with per-line GM re-roll, then locks at match start. |
| D37.7 | The ability editor round-trips losslessly to and from the source YAML. |
| D37.8 | Localization keys are generated from inline English by the build. |

---

**Next:** [38 — Testing Strategy](38-testing-strategy.md)
