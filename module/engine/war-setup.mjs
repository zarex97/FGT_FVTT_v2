/**
 * @file Building the board a war is fought on.
 * @see docs/05-board-geometry.md, docs/29-environment.md, Ch. 29
 *
 * Layer 3. `rules/home-base.mjs` says where the bases go; this puts them there.
 *
 * Ch. 05's grid table has been advisory since it was written — there is no
 * `Scene.create` anywhere in `module/` and nothing checks a scene's grid — so a
 * war fought on a hex scene, or one with `distance: 5`, would misreport every
 * range in the game with no warning at all.
 */

import { homeBaseRects } from "../rules/home-base.mjs";
import { gridShape } from "../domain/geometry.mjs";
import { validateRoster } from "../rules/war-setup.mjs";
import { plansFor, resolveSetupPlan } from "../rules/setup-rolls.mjs";
import {
  prepareSummon, commitSummon, servantCatalogue, rollSetupPlan,
} from "./summon.mjs";
import { factions, unitActor } from "./board.mjs";
import { worldIO } from "./io.mjs";
import {
  essenceCatalogue, essenceDraftOptions, essenceDocument, draftsEssences, syncEssences,
} from "./master-essence.mjs";
import { record } from "./game-log.mjs";
import { allWars, sceneIdOfWar } from "./war.mjs";
import { WAR_RULE_KEYS, coerceWarRule } from "../domain/war-rules.mjs";
import { normalizeFactions } from "../rules/factions.mjs";

/**
 * Ch. 05, as data.
 *
 * `diagonals: ILLEGAL` is right for MOVEMENT and wrong for DISTANCE — ZON and
 * every "N panel area" are Chebyshev — which is why this system carries its own
 * `chebyshev()` and `domain/geometry.mjs` deliberately exports no function
 * named `distance`. The setting governs Foundry's ruler, not this system's
 * rules, so it is set for the ruler's sake.
 */
export const GRID_REQUIREMENTS = Object.freeze({
  "grid.type": 1,          // CONST.GRID_TYPES.SQUARE
  "grid.distance": 1,
  "grid.units": "panels",
  "grid.diagonals": 6,     // CONST.GRID_DIAGONALS.ILLEGAL
});

/** Pixels per panel. Arbitrary, and the value every existing scene uses. */
const GRID_SIZE = 100;

/**
 * Every way this scene's grid disagrees with Ch. 05.
 *
 * Reported rather than corrected on sight: a GM who set `distance: 5`
 * deliberately is owed the question, and a silent rewrite of someone's map
 * configuration is the kind of help nobody asked for.
 *
 * @param {object} scene
 * @returns {Array<{key: string, want: unknown, got: unknown}>}
 */
export function gridMismatches(scene) {
  /** @type {Array<{key: string, want: unknown, got: unknown}>} */
  const out = [];
  for (const [key, want] of Object.entries(GRID_REQUIREMENTS)) {
    const got = foundry.utils.getProperty(scene ?? {}, key);
    if (got !== want) out.push({ key, want, got });
  }
  return out;
}

/**
 * The scene a war is fought on, created or corrected.
 *
 * @param {{size: number, name: string, sceneId?: string|null, activate?: boolean}} options
 *   `activate: false` views the scene without pulling every player to it
 * @returns {Promise<object>} the Scene
 */
export async function ensureScene({ size, name, sceneId = null, activate = true }) {
  if (sceneId) {
    const existing = game.scenes.get(sceneId);
    if (!existing) throw new Error(`No such scene: ${sceneId}`);
    const wrong = gridMismatches(existing);
    if (wrong.length > 0) {
      await existing.update(Object.fromEntries(wrong.map(({ key, want }) => [key, want])));
    }
    if (activate && !existing.active) await existing.activate();
    else if (!activate) await existing.view?.();
    return existing;
  }

  const [scene] = await Scene.implementation.create([{
    name,
    width: size * GRID_SIZE,
    height: size * GRID_SIZE,
    padding: 0,
    // `background` is left unset on purpose. A blank grid is a playable board;
    // a map is the GM's, and inventing one would be a decision nobody asked for.
    grid: {
      type: GRID_REQUIREMENTS["grid.type"],
      size: GRID_SIZE,
      distance: GRID_REQUIREMENTS["grid.distance"],
      units: GRID_REQUIREMENTS["grid.units"],
      diagonals: GRID_REQUIREMENTS["grid.diagonals"],
    },
  }]);
  // Activating pulls EVERY player to the scene. With another War in play its
  // players stay where they are; the GM views the new board alone.
  if (activate) await scene.activate();
  else await scene.view?.();
  return scene;
}

/**
 * Draw one Region per faction and tag it as that faction's Home Base.
 *
 * **The behaviour is created separately**, and that is not a style choice:
 * passing it inline in the Region's creation data is accepted without complaint
 * and silently produces a Region with an empty `behaviors` collection
 * (`engine/fields.mjs` records the same discovery about bounded fields). A home
 * base carrying no `factionId` is invisible to `homeBaseZonesOf`, which is
 * exactly the failure this whole flow exists to end.
 *
 * The shape is a **grid shape**, never a bounding rectangle. `shapeOf` once
 * stored a field's Region as the bounding box of its panels while
 * `boundedFieldsOf` read the panels back OFF the Region, so any non-rectangular
 * area silently filled in its own notches. A Great Holy Grail War base is a
 * rectangle and would have survived that; a Holy Grail War perimeter block is
 * an L or a U and would not.
 *
 * Existing home-base Regions are deleted first: setting a war up twice on one
 * scene must not leave the first war's bases under the second's, because
 * `ownBaseOf` tests membership of ANY tagged region owned by the faction.
 *
 * @param {object} scene
 * @param {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>} rects
 * @param {Array<{id: string, name: string, color: string}>} [roster] for names and colours
 * @returns {Promise<object[]>} the created RegionDocuments
 */
export async function paintHomeBases(scene, rects, roster = []) {
  const stale = scene.regions
    .filter((r) => r.behaviors.some((b) => b.type === "homeBase"))
    .map((r) => r.id);
  if (stale.length > 0) await scene.deleteEmbeddedDocuments("Region", stale);

  /** @type {object[]} */
  const created = [];
  for (const { factionId, offsets } of rects) {
    const faction = roster.find((f) => f.id === factionId) ?? null;
    const [region] = await scene.createEmbeddedDocuments("Region", [{
      name: `Home Base — ${faction?.name ?? factionId}`,
      shapes: gridShape(offsets),
      color: faction?.color ?? null,
      // Drawn for everyone: a home base is public information, and a player who
      // cannot see where theirs ends cannot use the five rules inside it.
      visibility: 2,   // CONST.REGION_VISIBILITY.ALWAYS
    }]);
    if (!region) continue;

    await region.createEmbeddedDocuments("RegionBehavior", [{
      name: "Home Base",
      type: "homeBase",
      // `isSecondary` is false: the only secondary base in the game is
      // Semiramis's Hanging Gardens, and that one is not a Region at all --
      // it moves, and `ownBaseOf` reads `unit.platformId` for it.
      system: { factionId, isSecondary: false },
    }]);
    created.push(region);
  }
  return created;
}

/**
 * The rectangles for a draft, so the wizard can preview them before committing.
 *
 * A thin pass-through, but it is the one place the board's bounds are read off
 * the *draft* rather than off a scene that may not exist yet.
 *
 * @param {{warType: string, boardSize: number, homeBaseDepth: number}} draft
 * @param {Array<{id: string}>} factions
 * @returns {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>}
 */
export function plannedBases(draft, factions) {
  return homeBaseRects(draft.warType, factions, {
    rows: draft.boardSize,
    columns: draft.boardSize,
    depth: draft.homeBaseDepth,
  });
}

/* -------------------------------------------------------------------------- */
/*  Committing a war                                                          */
/* -------------------------------------------------------------------------- */

/** The content id of the generic Master for each ruleset. */
const MASTER_CONTENT = Object.freeze({ advanced: "master-advanced", normal: "master-normal" });

/**
 * The ZON each Normal Master states, keyed on its Servant's container.
 *
 * Written onto `system.zon`, which needs no rule change: `zonRadius` already
 * reads the stored value as a floor under its class-based derivation. An
 * Advanced Master takes the template's 2 and lets the derivation do the work.
 */
const NORMAL_ZON = Object.freeze({
  saber: 2, lancer: 2, rider: 2, berserker: 2, archer: 4, assassin: 4, caster: 5,
});

/**
 * Write one line of the war's record.
 *
 * `kind: "setup"` rather than `scheduler`: these entries answer *"what was this
 * war made of"*, which is the first thing anyone reads when a commit stops
 * halfway.
 *
 * @param {object} combat
 * @param {string} summary
 * @param {object} [detail]
 * @returns {Promise<void>}
 */
async function note(combat, summary, detail = null) {
  await record({ kind: "setup", summary, detail }, combat);
}

/**
 * One Master, rolled, named after the container it will hold.
 *
 * @param {object} container
 * @param {object} draft
 * @param {Array<{id: string, name: string}>} [roster]
 * @returns {Promise<object>} the Actor
 */
export async function createMasterFor(container, draft, roster = []) {
  const contentId = MASTER_CONTENT[draft.ruleset] ?? MASTER_CONTENT.advanced;
  const pack = game.packs.get("fgt.masters");
  if (!pack) throw new Error("The fgt.masters compendium is missing.");

  const index = await pack.getIndex({ fields: ["system.contentId"] });
  const entry = [...index].find((e) => e.system?.contentId === contentId);
  if (!entry) throw new Error(`No Master template "${contentId}" in fgt.masters.`);

  const source = await pack.getDocument(entry._id);
  const data = source.toObject();
  delete data._id;

  // The Master's Essence decides its Rank, and the Rank its Base Attack (MAG),
  // ZON and the rest (#241). Written BEFORE the setup plan, which reads it.
  const essence = container.essenceId && draftsEssences(draft) ? await essenceDocument(container.essenceId) : null;
  if (essence) {
    data.system = { ...data.system, rank: essence.system?.rank ?? "" };
    data.items = [...(data.items ?? []), (() => { const e = essence.toObject(); delete e._id; return e; })()];
  }

  // The DRAFT's mode: the War being built, not the War on the GM's screen.
  const mode = draft.masterMode ?? "essences";
  // The DRAFT's ruleset, not the world's: the wizard has not committed it to
  // the match yet, so `warRuleset()` would still read the previous war's.
  const plan = plansFor(draft.ruleset).master(data.system, { mode });
  const { totals, signs } = await rollSetupPlan(plan);
  const lines = resolveSetupPlan(plan, totals, signs);
  const value = (id) => lines.find((l) => l.id === id)?.value;

  const factionName = roster.find((f) => f.id === container.factionId)?.name ?? container.factionId;
  data.name = game.i18n.format("FGT.Setup.MasterName", {
    container: game.i18n.localize(`FGT.Class.${container.classContainer}`),
    faction: factionName,
  });
  data.system = {
    ...data.system,
    factionId: container.factionId,
    warId: draft.warId ?? null,
    health: { value: value("maxHealth"), max: value("maxHealth") },
    agility: { value: value("maxAgility"), max: value("maxAgility") },
    luck: { value: value("maxLuck"), max: value("maxLuck") },
    commandSpells: value("commandSpells") ?? 3,
    rank: value("rank") ?? data.system.rank ?? "",
    baseAttack: {
      str: data.system.baseAttack?.str ?? 50,
      mag: value("baseAttackMag") ?? data.system.baseAttack?.mag ?? 100,
    },
    zon: draft.ruleset === "normal"
      ? (NORMAL_ZON[container.classContainer] ?? 2)
      : (data.system.zon ?? 2),
  };

  return Actor.implementation.create(data);
}

/**
 * Build the whole war.
 *
 * **The Combat is created second, not last.** The log lives on it
 * (`engine/game-log.mjs#record` takes a combat and writes nothing without one),
 * so a sequence that built it at the end would carry no record of the steps
 * before it — precisely the ones a half-failed commit needs to name. The Scene
 * still comes first, because everything painted onto it is.
 *
 * Every step logs BEFORE it acts. A line written afterwards is exactly the one
 * you do not get when the step throws.
 *
 * @param {object} draft
 * @returns {Promise<{scene: object, masters: object[], servants: object[], partners: object[], combat: object}>}
 *   `partners` are the Servants summoned with a drawn one (`seatPartners`)
 */
export async function commitWar(draft) {
  // The new War's own roster, from the draft; a draft built before the roster
  // moved onto the War falls back to the roster of the War on screen.
  const roster = normalizeFactions(draft.factions ?? factions());
  const catalogue = await servantCatalogue({ ruleset: draft.ruleset });
  const essences = await essenceCatalogue();
  const refusals = validateRoster(draft.containers, roster, catalogue,
    { policy: draft.drawPolicy, essences: essenceDraftOptions(draft, essences) });
  if (refusals.length > 0) {
    throw new Error(`The roster is not ready: ${refusals.map((r) => r.code).join(", ")}`);
  }

  // A scene that already holds a started War is refused: a world holds several
  // Wars, each on its own board (ruled 2026-10-18).
  const taken = draft.sceneId ? allWars().find((w) => sceneIdOfWar(w) === draft.sceneId && w.started) : null;
  if (taken) throw new Error(game.i18n.localize("FGT.Setup.SceneTaken"));
  // Another War already being played keeps its players where they are.
  const othersInPlay = allWars().some((w) => w.started);

  const scene = await ensureScene({
    size: draft.boardSize,
    name: draft.sceneName || game.i18n.localize("FGT.Setup.SceneName"),
    sceneId: draft.sceneId || null,
    activate: !othersInPlay,
  });

  // Bound to its board scene. A world holds several Wars at once, each on its
  // own scene (2026-10-18), and `engine/war.mjs#currentWar` finds a client's
  // War by the scene it is looking at. A War was once `scene: null` -- global
  // -- because `CombatEncounters#active` only answers for the ACTIVATED scene
  // and the board went match-blind whenever the GM looked elsewhere; nothing
  // reads `game.combats.active` for "the match" any more.
  const combat = await Combat.implementation.create({ type: "match", scene: scene.id });
  // Activated, so the combat tracker on its scene shows it.
  await combat.activate();
  draft = { ...draft, warId: combat.id };

  // Every War Rule and the roster, BEFORE anything is built into it: the
  // combatants are this roster's factions, and everything downstream reads
  // the War's shape off it -- `warRuleset()` most of all. A Combat created
  // with the schema's defaults SHADOWED the wizard's choices once: a Normal
  // war's `commitSummon` saw `ruleset: "advanced"` and refused every one of
  // its own Servants. `turnsPerRound` was never written at all, so a war set
  // up at 8 Turns a Round played at whatever the world said (found
  // 2026-10-18). `containers` still comes last: it carries the actor ids,
  // which do not exist yet.
  /** @type {Record<string, unknown>} */
  const rules = {};
  for (const key of WAR_RULE_KEYS) {
    if (key === "factions") continue;
    if (key in draft) rules[`system.${key}`] = coerceWarRule(key, draft[key]);
  }
  await combat.update({
    ...rules,
    "system.factions": roster,
    "system.homeBaseDepth": draft.homeBaseDepth,
  });
  await combat.syncFactions({ withGM: true });

  await note(combat, `War setup began: ${draft.warType}, ${draft.ruleset} ruleset`, {
    warType: draft.warType, ruleset: draft.ruleset,
    boardSize: draft.boardSize, containers: draft.containers.length,
  });

  await note(combat, `Painting ${roster.length} home base(s)`);
  await paintHomeBases(scene, plannedBases(draft, roster), roster);

  /** @type {object[]} */ const masters = [];
  /** @type {object[]} */ const servants = [];
  /** @type {object[][]} */ const companions = [];

  for (const container of draft.containers) {
    await note(combat, `Filling ${container.factionId} / ${container.classContainer}`,
      { container: container.id, contentId: container.contentId });

    const master = await createMasterFor(container, draft, roster);
    masters.push(master);

    // The plan the wizard already rolled and the GM already approved.
    // Re-preparing here would throw those dice away and hand the table numbers
    // nobody looked at.
    const prepared = draft.prepared?.[container.id]
      ?? await prepareSummon({
        contentId: container.contentId, region: draft.region || null,
        // The High Rank Master's `+` (#241 reading 17).
        masterGrants: container.paramPlus ? { [container.paramPlus]: 1 } : {},
      });
    if (!prepared) throw new Error(`Cannot summon "${container.contentId}".`);

    const servant = await commitSummon(prepared);
    servants.push(servant);

    await servant.update({
      "system.factionId": container.factionId,
      "system.classContainer": container.classContainer,
      "system.warId": combat.id,
    });
    // "The unselected Noble Phantasm is unusable." `expended` is the existing
    // way to say that, and the rejected option stays ON the sheet greyed out
    // rather than being deleted -- so a player can check afterwards that the
    // war was set up the way the table agreed.
    const offered = [...(servant.system.npChoice ?? [])];
    if (offered.length > 0 && container.npChoice) {
      const losers = servant.items
        .filter((i) => offered.includes(i.system?.contentId)
          && i.system?.contentId !== container.npChoice)
        .map((i) => ({ _id: i.id, "system.expended": true }));
      if (losers.length > 0) await servant.updateEmbeddedDocuments("Item", losers);
    }

    // `setContract` is the ONE place that keeps `Servant.masterId` and
    // `Master.servantIds` reciprocal; writing either directly desynchronizes
    // them, and Ch. 32's per-Servant Command Spell pools are keyed off the
    // Master's roster.
    await worldIO().setContract(servant.id, "contracted", master.id);
    // The Master's Essence onto its Servant, and the Servant full at the new
    // maxima: the summon is the one moment it starts full (#241 reading 6).
    await syncEssences(servant, { fill: true });

    // A Servant who is many Units starts with the Master's pick of them in the
    // Home Base (#226 reading 3). `startLegion` cross-links them as one group,
    // so `seatPartners` below seats and places them beside the first.
    {
      const { startLegion } = await import("./legion.mjs");
      await startLegion(servant, master, container.legionOpening ?? 1);
    }

    // The Servant summoned WITH this one (`commitSummon` cross-links them) is a
    // full member of the slot: the same side, the same Contract, a token beside
    // it. Without this the second twin of every pair stood on no side, under no
    // Master and off the board (§46.4-D3, found by the Dioscuri audit, #218).
    companions.push(await seatPartners(servant, container, master));
  }

  await combat.update({
    "system.containers": draft.containers.map((c, i) => ({
      ...c, servantId: servants[i]?.id ?? null, masterId: masters[i]?.id ?? null,
    })),
  });

  await note(combat, "Deploying units into their home bases");
  await deployTokens(scene, draft, roster, masters, servants, companions);

  // Everyone can see everyone their Detect reaches the moment they are placed,
  // and `unitFirstSeen` has to be asked here or it is never asked about the
  // opening board at all.
  //
  // `checkSightings` had exactly ONE caller -- `movement-hooks.mjs`, on a move
  // -- so a Unit that was in sight from deployment was never "first seen" by
  // anybody. Found on Semiramis: Familiar: Doves is the corpus' only consumer
  // of the event, and she stood adjacent to an enemy Servant for five Rounds
  // and attacked him twice without ever applying the Dove that lets her track
  // him through Fog of War (Ch. 46 §46.14.5).
  // No board passed: `checkSightings` falls back to `currentBoard()`, and the
  // combat was activated at the top of this function, so that is this war's.
  // Building one here would snapshot the scene before the deploy has settled.
  const { checkSightings } = await import("./vision.mjs");
  await checkSightings();

  // Wisdom of Dún Scáith: with the whole field deployed, the GM's list opens
  // for every copier, and the war's first Turn cannot end until each has
  // picked (#204 reading 8).
  const { markCopyPicksDue } = await import("./copy.mjs");
  await markCopyPicksDue();
  // Uncrowned Arms Mastership's opening choice, asked the same way (#206
  // reading 3).
  const { markOpeningChoicesDue } = await import("./opening-choice.mjs");
  await markOpeningChoicesDue();

  await note(combat, `War built: ${servants.length + companions.flat().length} Servants, ${masters.length} Masters`);
  return { scene, masters, servants, partners: companions.flat(), combat };
}

/**
 * Drop every unit inside its own faction's base.
 *
 * Placed rather than left in the sidebar, because Ch. 29 step 10 is *"both
 * players are allowed to freely arrange their Units within their Home Base"* —
 * and a rearrangement needs something to rearrange.
 *
 * Each pair is placed together, Servant then Master, because ZON is a property
 * of the **pair**: a deployment that scatters them starts every Servant outside
 * its Master's zone and every attack at −5d10.
 *
 * @param {object} scene
 * @param {object} draft
 * @param {Array<{id: string}>} roster
 * @param {object[]} masters
 * @param {object[]} servants
 * @param {object[][]} [partners] by Servant, the Servants summoned with it (`seatPartners`)
 * @returns {Promise<void>}
 */
export async function deployTokens(scene, draft, roster, masters, servants, partners = []) {
  const free = new Map(plannedBases(draft, roster).map((r) => [r.factionId, [...r.offsets]]));
  const size = scene.grid.size;

  /** Take the free panel nearest `to`, or the first free one if `to` is null. */
  const take = (panels, to) => {
    if (!panels || panels.length === 0) return null;
    if (!to) return panels.shift();
    let best = 0;
    let bestDistance = Infinity;
    for (let k = 0; k < panels.length; k++) {
      const d = Math.max(Math.abs(panels[k].i - to.i), Math.abs(panels[k].j - to.j));
      if (d < bestDistance) { bestDistance = d; best = k; }
    }
    return panels.splice(best, 1)[0];
  };

  /** @type {object[]} */
  const data = [];
  for (let n = 0; n < servants.length; n++) {
    const servant = servants[n];
    const master = masters[n];
    const panels = free.get(servant?.system?.factionId);
    // A faction with no base -- a `custom` war -- gets no automatic placement
    // rather than a token dropped at the origin on top of every other one.
    if (!servant || !panels || panels.length === 0) continue;

    const here = take(panels, null);
    const servantToken = await servant.getTokenDocument({ x: here.j * size, y: here.i * size });
    data.push(servantToken.toObject());

    // A Servant summoned with partners brings them to the same spot: each on
    // the free panel nearest it, BEFORE the Master takes the next, so the pair
    // starts directly next to each other (the Dioscuri's joint Noble Phantasm
    // asks for that) and well inside the leash of 2, whatever the base's shape.
    for (const partner of partners[n] ?? []) {
      const next = take(panels, here);
      if (!next) break;
      const partnerToken = await partner.getTokenDocument({ x: next.j * size, y: next.i * size });
      data.push(partnerToken.toObject());
    }

    // The Master goes on the free panel NEAREST its own Servant, not on the
    // next one in the list. Walking the list in order straddles the end of a
    // row: on a 13-wide base the seventh pair landed at (0,12) and (1,0),
    // twelve panels apart, and both Servants started the war outside their
    // Master's ZON and every attack at -5d10. Measured — `outsideZon: 2` on the
    // first war this built.
    const beside = take(panels, here);
    if (!master || !beside) continue;
    const masterToken = await master.getTokenDocument({ x: beside.j * size, y: beside.i * size });
    data.push(masterToken.toObject());
  }
  if (data.length > 0) await scene.createEmbeddedDocuments("Token", data);
}

/**
 * Seat the Servants summoned WITH this one in its slot: the same side, the same
 * class container, and a Contract to the same Master.
 *
 * `commitSummon` brings a group's partners in the same commit and cross-links
 * their `memberIds`, and writes nothing about a war: a partner arrives with no
 * Master, so Free, and no faction. The wizard wrote all of that for the Servant
 * it drew and for nobody else, so the second twin of a pair stood on no side,
 * under no Master and off the board (§46.4-D3). Only the Dioscuri summon
 * together; every other Servant has no `memberIds` and this returns `[]`.
 *
 * The partner takes the SLOT's container, not its own class: the pair sits in
 * one slot (#209 reading 8), and `classContainer` is the slot.
 *
 * @param {object} servant the Servant the container drew
 * @param {{factionId: string, classContainer: string}} container
 * @param {object} master the slot's Master
 * @returns {Promise<object[]>} the partners, in `memberIds` order
 */
export async function seatPartners(servant, container, master) {
  /** @type {object[]} */
  const seated = [];
  for (const id of [...(servant.system?.linkedGroup?.memberIds ?? [])]) {
    const partner = unitActor(id);
    if (!partner) continue;
    await partner.update({
      "system.factionId": container.factionId,
      "system.classContainer": container.classContainer,
      // The War this slot was built into (`commitWar` writes it on the draft).
      "system.warId": container.warId ?? master?.system?.warId ?? null,
    });
    // The one place `masterId` and `Master.servantIds` are kept reciprocal.
    await worldIO().setContract(partner.id, "contracted", master.id);
    seated.push(partner);
  }
  return seated;
}
