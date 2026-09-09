# Setting up a war — design

**Date:** 2026-09-09
**Chapters affected:** [04 — Units](../../04-units.md), [08 — Board and Geometry](../../08-board-and-geometry.md),
[19 — Environment](../../19-environment.md), [21 — System Skeleton](../../21-system-skeleton.md),
[22 — Data Models](../../22-data-models.md), [25 — Turn System](../../25-turn-system.md),
[29 — User Interface](../../29-user-interface.md), [37 — Content Pipeline](../../37-content-pipeline.md),
[45 — Implementation Status](../../45-implementation-status.md)

---

## 1. The problem

### 1.1 The setup sequence is specified, and three steps of twelve exist

Ch. 19 §19.7 lists twelve procedures that happen before a war begins, and names the first one as a
control the GM operates:

> *"1. Choose ruleset — Great HGW (3 turns/round) | HGW (8) | custom"*

Of the twelve, **three are built**: the war's Region grants its parameter step (§19.3,
`annotateRegionBonus`), the day/night opening flip is a pure function of the round number
(`rules/environment.mjs#phase`), and Round 1's attack ban is refused at declaration
(`attacksPermitted`). Everything else is a GM with a rulebook and a mouse: create the scene, set
its grid, draw two Regions and tag them, create fourteen actors, roll three lines on each of them,
pair them, colour them, assign their owners, drop their tokens, build the Combat, add the
combatants.

The pieces are not missing. They are unassembled. `prepareSummon` / `rerollSummonLine` /
`commitSummon` already produce one rolled Servant with every line shown and re-rollable;
`FGTCombat.syncFactions` already builds the combatants and the GM slot; `HomeBaseBehavior` already
turns a Region into a home base that the damage pipeline, the scheduler and five rules read. What
does not exist is the thing that calls them in order.

### 1.2 Home bases are fully implemented, and nothing has ever created one

`module/data/regions.mjs` declares `HomeBaseBehavior {factionId, isSecondary}`,
`engine/board.mjs#homeBaseZonesOf` projects tagged Regions into `board.zones` keyed by region id
(not by faction — Semiramis's Hanging Gardens *"counts as a second Home Base"*), and
`rules/environment.mjs` implements all five effects: end-of-round regeneration and its
narrower-than-it-reads combat exclusion, the three-round debuff cure, the −10% taken, the +20%/+10%
dealt when both combatants are inside, and Territory Creation's amplification. `CS: Escape` anchors
on `zone: homeBase`. Caster's Detect is 5 inside and 3 outside.

`docs/08-board-and-geometry.md:527` records why nothing creates one: *"| **Static** | Home bases |
`Scene.regions`, authored per-scene |"*. Authored, by a person, with a drawing tool, every time.

**And one rule has been waiting on it.** `MatchData.grailPosition` is declared
(`data/misc.mjs:121`) and read (`engine/board.mjs:286`) and **written nowhere**. `registerDefeat`
flips `grailMaterialized` and never picks a panel, so `grailContest` short-circuits on
`!state.position` for the rest of the match. The reason is §19.4's own wording — *"appear on a
random panel on the field **excluding Home Bases**"* — which cannot be evaluated on a board that
has none. The Holy Grail has never been obtainable.

### 1.3 A faction holds exactly one player

`rules/factions.mjs:21-28` types a faction as `{id, name, color, userId, allies[]}` — singular.
`docs/04-units.md:569-576` specifies `playerIds: string[]`. The doc is right and the code drifted: a
Great Holy Grail War is *"7 players cooperating as one Faction"*, or *"2 Players cooperating on each
Faction"*, and neither is expressible today. `engine/faction-ownership.mjs` grants Foundry OWNER to
the one `userId`, so six of seven cooperating players cannot move their own units.

### 1.4 The war's shape has nowhere to live

There is no war type and no submode anywhere in the system. The Great Holy Grail War and the Holy
Grail War are distinguishable only by `turnsPerRound` being 3 or 8, and only in a hint string
(`lang/en.json:68`). `grandOrder` is a boolean, and it is the only mode flag that exists.

Nor is there a **class container roster**. `ServantData.classContainer` records which container a
Servant occupies; nothing records that the war *has* containers, which faction owns them, or that
one is empty. The container is the unit of setup — *"each Servant will get 1 Saber, 1 Archer, 1
Lancer, 1 Assassin, 1 Caster, 1 Rider, 1 Berserker, plus any other container the GM adds"* — and it
is the one concept in this design with no representation at all.

---

## 2. Data model

### 2.1 A faction holds players

```js
// module/rules/factions.mjs
/**
 * @typedef {object} Faction
 * @property {string} id      stable, machine-generated, never edited
 * @property {string} name
 * @property {string} color
 * @property {string[]} userIds the players who control it
 * @property {string[]} allies
 */
```

`normalizeFactions` migrates a stored `userId` into `[userId]`, dropping blanks — the same place it
already symmetrizes the alliance graph rather than trusting what was stored. There is no migration
runner (Ch. 39), and the normalizer runs on every read, so it is where a shape change belongs.

`factionForUser` becomes a membership test. `engine/faction-ownership.mjs` grants OWNER to every
listed player and revokes from anyone dropped. `apps/faction-config.mjs` renders a multi-select.

### 2.2 The match carries the war's shape

```js
// module/data/misc.mjs — MatchData
warType: new fields.StringField({
  initial: "greatHolyGrailWar",
  choices: ["greatHolyGrailWar", "holyGrailWar", "custom"],
}),
ruleset: new fields.StringField({ initial: "advanced", choices: ["advanced", "normal"] }),
homeBaseDepth: new fields.NumberField({ required: true, integer: true, initial: 3, min: 1 }),
/** The war's slot roster. */
containers: new fields.ArrayField(new fields.ObjectField()),
```

A container:

```js
{
  id: string,                 // stable, generated
  factionId: string,
  classContainer: string,     // one of SERVANT_CLASSES, or "extra"
  fill: "random" | "fixed",
  contentId: string | null,   // the Servant drawn or chosen
  servantId: string | null,   // the actor, after commit
  masterId: string | null,    // the actor, after commit
  npChoice: string | null,    // Normal's "select NP (a) or (b)"
}
```

`ObjectField` for the same reason `resources` and the rule elements are untyped: this is a shape the
wizard owns, and a rigid schema would have to name every future field before the wizard could write
one. It lives on the match rather than in a setting for the reason that file already gives about
`region`: *"it is chosen once, at setup, and never changes mid-war."*

**`extra` is a container, not a class.** Any Servant whose `servantClasses` contains none of the
seven core classes may be drawn into it. `domain/enums.mjs#SERVANT_CLASSES` already lists the seven
first and the extras after, so the split is a slice rather than a second list to keep in sync.

### 2.3 Settings, and the difficulty vocabulary

`warType`, `ruleset` and `drawPolicy` become world settings. The first two join `RULE_SETTINGS` and
lock once `game.combat.started`, for the reason that list exists: they change what the stored
numbers mean. This follows the `region` / `difficulty` precedent exactly — the setting is the
world's default, `MatchData` is this match's copy, and `engine/board.mjs` reads the match's first.

```js
s("drawPolicy", {
  name: "FGT.Settings.DrawPolicy", hint: "FGT.Settings.DrawPolicyHint",
  type: String, default: "duplicates",
  choices: { duplicates: "FGT.DrawPolicy.Duplicates", unique: "FGT.DrawPolicy.Unique" },
});
```

**And the difficulty vocabulary is unified**, because this design reads it and cannot leave three
answers standing. Today the setting offers `beginner | standard | expert` (`settings.mjs:45`),
`MatchData.difficulty` accepts `beginner | intermediate | expert | lunatic` (`data/misc.mjs:113`),
and `engine/board.mjs:280` defaults to `"intermediate"` — **a value the setting cannot produce**.
The rulebook names four:

> *"Beginner: Damage modifiers & Luck Check removed. Intermediate: Luck Check removed. Expert:
> Nothing removed. Lunatic: Random Event rate up."*

Those four win, in both places. `standard` is dropped; a world holding it reads as `intermediate`.
Wiring what each level *removes* is Spec 2 §5. What this fixes is a setting that could never select
the mode the board already assumed, and `civiliansNeeded`'s Lunatic ≥2 invariant, which was written
against a value nothing could set.

---

## 3. The container roster — `module/rules/war-setup.mjs`

Layer 2. Pure: it says what the roster is and which Servants may fill each slot, and the caller
rolls.

```js
export const CORE_CLASSES = Object.freeze(["saber", "archer", "lancer", "rider",
                                           "caster", "assassin", "berserker"]);
export const EXTRA = "extra";

/** The default roster: `perFaction` containers for each faction. */
export function defaultContainers(factions, perFaction = 7);

/** Every catalogue entry that may fill this container. */
export function candidatesFor(container, catalogue, { policy, taken });

/** What to draw into each random container. The caller rolls. */
export function drawPlan(containers, catalogue, { policy });

/** Everything wrong with this roster, each with the reason to show. */
export function validateRoster(containers, factions, catalogue, { policy });
```

`candidatesFor` matches a core container against `servantClasses.includes(class)` and an `extra`
container against *"holds no core class"*. Under `policy: "unique"` it also removes everything in
`taken`.

**An empty container is a refusal with a reason, not a silent skip.** The Advanced roster holds
sixteen Servants and **no Saber at all** — four Rider, three Berserker, two each of Lancer, Caster,
Assassin and AlterEgo, one Archer — so every war built today has at least one container the pool
cannot fill. Ch. 29's rule, *"a control that is unavailable is disabled with its reason on screen,
never hidden"*, is what that case is for. The GM then sets the slot to a fixed pick, authors the
missing Servant, or leaves it empty deliberately.

`drawPlan` returns one line per random container so the wizard can show and re-roll each
individually — the same reason `prepareSummon` returns a plan rather than an actor.

---

## 4. Home-base geometry — `module/rules/home-base.mjs`

Layer 2. Pure, and it takes the board's bounds as an argument rather than reading the scene.

```js
/** @returns {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>} */
export function homeBaseRects(warType, factions, { rows, columns, depth });
```

- **`greatHolyGrailWar`** — two sides. The first faction takes the top `depth` rows, the second the
  bottom `depth`. A war declaring more than two factions is a refusal, not a guess.
- **`holyGrailWar`** — the perimeter band of `depth` panels is divided into N contiguous blocks, one
  per faction, starting top-left and running clockwise; the remainder goes to the earliest blocks,
  so any two differ by at most one panel.
- **`custom`** — no rectangles. The GM draws them.

`depth` defaults to 3, which is this design's decision. `docs/08-board-and-geometry.md:59-66` guesses
*"2 rows (inferred) / 3 rows (inferred)"* for the two board sizes; the author has stated three, and
the chapter is corrected rather than left disagreeing with the code.

The perimeter division is a **house rule, and the chapter will label it one**: the rulebook
specifies home bases for the two-sided war and says nothing about an all-versus-all. It is offered
because five implemented rules (E1–E5), `CS: Escape` and the Grail's exclusion zone all go dark
without a base, and silently disabling seven rules is worse than a stated convention.

---

## 5. The engine — `module/engine/war-setup.mjs`

Layer 3. Performs what the two pure modules describe.

| Function | Does |
|---|---|
| `ensureScene({size, name})` | Creates a `size × size` Scene with Ch. 08 §8.9's grid: square, `distance: 1`, `units: "panels"`, `gridDiagonals: ILLEGAL`. On an existing scene, reports each mismatch and offers to correct it. |
| `paintHomeBases(scene, rects)` | `createEmbeddedDocuments("Region", …)`, each carrying a `homeBase` behaviour with its `factionId`. |
| `createMasters(draft)` | One Master actor per container from the ruleset's pack template, rolled through the Master setup plan. |
| `commitWar(draft)` | The sequence in §7. |

**The Region geometry must be a grid shape**, `{type: "grid", offsets, origin: null}`, never a
bounding rectangle. `engine/fields.mjs#shapeOf` once stored a field's Region as the bounding
rectangle of its panels while `boundedFieldsOf` read the panels back off the Region, so any
non-rectangular field silently filled in its own notches. A GHGW home base is a rectangle and would
survive that; an HGW perimeter block is an L or a U and would not. The correct form already exists
at `apps/canvas/target-region.mjs#gridShape`.

---

## 6. The wizard — `module/apps/setup-wizard.mjs`

Layer 4. `HandlebarsApplicationMixin(ApplicationV2)`, `tag: "form"`, seven tabs via
`ApplicationV2.TABS` with one PART each, following `apps/actor-sheet/sheet.mjs`'s tab wiring and
`apps/faction-config.mjs`'s shape. GM-only: `restricted: true` on the settings menu and a
`game.user.isGM` gate at `open`.

Two entry points, for the reason `summon-entry.mjs` gives for having two: a settings menu under
**Configure War**, and a third button in the Actors sidebar header beside Summon and Game Log,
because that header is where the match's units already are.

The draft persists to a hidden `fgt.setupDraft` world setting on every change, so a GM may close the
window, read a rulebook and come back. It is cleared on commit.

| Tab | Collects |
|---|---|
| **War** | war type, ruleset, board size, turns per round (defaulted from the war type, overridable), difficulty, Region, Grail threshold, draw policy |
| **Factions** | add / remove / colour, players per faction, alliances |
| **Containers** | per faction, the seven defaults plus *Add container*; per row, random or fixed |
| **Masters** | one per container by default; setup lines with per-line re-roll, including the High/Low rank coin under `masterMode: "coinFlip"` |
| **Servants** | *Roll all*, then a card per container showing every line's arithmetic, with per-line re-roll and per-container re-draw |
| **Board** | board size, home-base depth, and a preview of which rows or blocks each faction takes |
| **Confirm** | the refusal list, then Commit |

**A fixed container's Servant is chosen through a filtering combobox** — a text input over the
catalogue that narrows as the GM types, ranking name-prefix matches above substring matches, so `EM`
surfaces EMIYA first. A `<select>` of a hundred Servants is not a control a GM can use at the table,
and the roster is only going to grow.

**Every roll shows its arithmetic**, which is Ch. 29's second rule and the reason `describe()`
exists: *"1000" tells a GM nothing about whether to re-roll, and "18 + 2 (coin) = 20" tells them
everything*. `describe` / `describeStep` move out of `apps/summon-dialog.mjs` into a new pure
`apps/summon-present.mjs`, so both dialogs render a plan line identically and the presenter can be
unit-tested. The repo already splits UI this way for `actor-sheet/present.mjs` and `hud/present.mjs`,
and those pure halves are the ones with tests.

**Changing a dropdown does not re-roll**, which is the summon dialog's rule and its reason: grants
apply after the rolls, so nothing about a Master or a Region can change a die already thrown, and
re-rolling on every change hands the GM new numbers each time they touch a control.

---

## 7. What Commit writes, in order

1. The Scene, and its grid.
2. The home-base Regions.
3. Master actors, rolled and named.
4. Servant actors, through the existing `commitSummon` — one call per container, so the wizard
   inherits every correction that path already carries.
5. Contracts, through `io.setContract`, the one place that keeps `Servant.masterId` and
   `Master.servantIds` reciprocal.
6. `factionId` on every actor, which makes `engine/faction-ownership.mjs` grant each faction's
   players OWNER.
7. The Combat, its per-faction Combatants and the GM slot, via
   `FGTCombat.syncFactions({withGM: true})`.
8. `MatchData`: `warType`, `ruleset`, `containers`, `homeBaseDepth`, `region`, `difficulty`,
   `grailThreshold`.
9. Tokens, placed inside each faction's own base — which players may then rearrange freely, as
   §19.7 step 10 allows.

Each step writes a game-log line before it acts, so a commit that fails halfway says where it
stopped. The day/night opening flip stays in `startMatch`: commit builds the board, starting the
match starts the clock.

---

## 8. The Grail finally gets a panel

Two additions, both small, and together they close a rule that has never been able to fire:

```js
// module/rules/environment.mjs — layer 2, pure
/** Every in-bounds panel that lies in no home-base zone. */
export function grailPanelCandidates(board);
```

`registerDefeat` already flips `grailMaterialized` at the threshold. The caller rolls over the
candidate list and writes `grailPosition` through `io`, at which point `grailContest` — which is
built, and correct, and has never run — starts advancing.

The two distances in that contest differ and must stay differing: a claimant must be **adjacent**
(Chebyshev 1); a blocker need only be within the **2-panel Area**. Nothing here touches that.

---

## 9. Testing

**Pure units.** `test/unit/war-setup.test.mjs` — the default roster's shape, `extra` matching a
non-core class and refusing a core one, both draw policies, and each refusal reason, including the
Saber-shaped hole in the current catalogue. `test/unit/home-base-geometry.test.mjs` — GHGW's two row
bands at depth 3 on both board sizes, HGW's perimeter division at three through seven factions with
no overlap and nothing out of bounds, the remainder distribution, and the refusal when a GHGW
declares three factions.

**Static gates.** `npm run lint` (which runs `check-layers`), `check:templates`, `typecheck`,
`validate:content`, `test`.

**Live, in `fgt2026`.** Green tests are not evidence for anything in Layer 4, which is where every
defect reported from the table so far has been. Drive the wizard through Chrome and confirm on
screen: a two-faction Great Holy Grail War built end to end; both home bases painted at the top and
bottom three rows; fourteen tokens standing inside them; `board.zones` holding two entries;
`inOwnHomeBase` true for a unit in its own base and false in the enemy's; the Combat carrying three
combatants with the GM last; and, with the Grail threshold lowered, a defeat past it putting
`grailPosition` on a panel that is in neither base.

---

## 10. What this does not do

- **The draft (§19.7 steps 6–8)** — Master Essences are a declared non-goal (Ch. 01) and the pack is
  empty. The wizard assigns Masters; it does not draft them.
- **Random Events** — §19.5 says the system provides tooling, not automation. Unchanged.
- **A player-facing setup phase.** Every choice is the GM's, in one window. A container may be marked
  non-random and the GM picks for it, presumably after asking the table. That is one surface to build
  and one to test, and the wizard works with nobody else logged in.
- **Scene art, terrain and platforms.** The wizard makes a playable grid with home bases on it. A map
  is the GM's.
