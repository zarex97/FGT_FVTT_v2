/**
 * @file Building the board a war is fought on.
 * @see docs/08-board-and-geometry.md §8.9, docs/19-environment.md §19.1, §19.7
 *
 * Layer 3. `rules/home-base.mjs` says where the bases go; this puts them there.
 *
 * Ch. 08 §8.9's grid table has been advisory since it was written — there is no
 * `Scene.create` anywhere in `module/` and nothing checks a scene's grid — so a
 * war fought on a hex scene, or one with `distance: 5`, would misreport every
 * range in the game with no warning at all.
 */

import { homeBaseRects } from "../rules/home-base.mjs";
import { gridShape } from "../domain/geometry.mjs";
import { validateRoster } from "../rules/war-setup.mjs";
import { masterSetupPlan, resolveSetupPlan } from "../rules/setup-rolls.mjs";
import {
  prepareSummon, commitSummon, servantCatalogue, rollSetupPlan,
} from "./summon.mjs";
import { factions } from "./board.mjs";
import { worldIO } from "./io.mjs";
import { record } from "./game-log.mjs";

/**
 * Ch. 08 §8.9, as data.
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
 * Every way this scene's grid disagrees with §8.9.
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
 * @param {{size: number, name: string, sceneId?: string|null}} options
 * @returns {Promise<object>} the Scene
 */
export async function ensureScene({ size, name, sceneId = null }) {
  if (sceneId) {
    const existing = game.scenes.get(sceneId);
    if (!existing) throw new Error(`No such scene: ${sceneId}`);
    const wrong = gridMismatches(existing);
    if (wrong.length > 0) {
      await existing.update(Object.fromEntries(wrong.map(({ key, want }) => [key, want])));
    }
    if (!existing.active) await existing.activate();
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
  await scene.activate();
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

  const mode = game.settings.get("fgt", "masterMode");
  const plan = masterSetupPlan(data.system, { mode });
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
 * still comes first, because the Combat is scene-linked.
 *
 * Every step logs BEFORE it acts. A line written afterwards is exactly the one
 * you do not get when the step throws.
 *
 * @param {object} draft
 * @returns {Promise<{scene: object, masters: object[], servants: object[], combat: object}>}
 */
export async function commitWar(draft) {
  const roster = factions();
  const catalogue = await servantCatalogue({ ruleset: draft.ruleset });
  const refusals = validateRoster(draft.containers, roster, catalogue, { policy: draft.drawPolicy });
  if (refusals.length > 0) {
    throw new Error(`The roster is not ready: ${refusals.map((r) => r.code).join(", ")}`);
  }

  const scene = await ensureScene({
    size: draft.boardSize,
    name: draft.sceneName || game.i18n.localize("FGT.Setup.SceneName"),
    sceneId: draft.sceneId || null,
  });

  const combat = await Combat.implementation.create({ type: "match", scene: scene.id });
  // ACTIVATE it. `currentBoard()` reads `game.combats.active`, and
  // `Combat.create` leaves `active: false` -- `game.combat` is only the combat
  // being VIEWED. Without this the board is match-blind: no phase, no tick, no
  // difficulty, no war type and no Grail, all silently at their defaults. Found
  // live, where a match carrying `grailMaterialized: true` projected
  // `materialized: false` and the Grail could not appear.
  await combat.activate();
  await combat.syncFactions({ withGM: true });

  await note(combat, `War setup began: ${draft.warType}, ${draft.ruleset} ruleset`, {
    warType: draft.warType, ruleset: draft.ruleset,
    boardSize: draft.boardSize, containers: draft.containers.length,
  });

  await note(combat, `Painting ${roster.length} home base(s)`);
  await paintHomeBases(scene, plannedBases(draft, roster), roster);

  /** @type {object[]} */ const masters = [];
  /** @type {object[]} */ const servants = [];

  for (const container of draft.containers) {
    await note(combat, `Filling ${container.factionId} / ${container.classContainer}`,
      { container: container.id, contentId: container.contentId });

    const master = await createMasterFor(container, draft, roster);
    masters.push(master);

    // The plan the wizard already rolled and the GM already approved.
    // Re-preparing here would throw those dice away and hand the table numbers
    // nobody looked at.
    const prepared = draft.prepared?.[container.id]
      ?? await prepareSummon({ contentId: container.contentId, region: draft.region || null });
    if (!prepared) throw new Error(`Cannot summon "${container.contentId}".`);

    const servant = await commitSummon(prepared);
    servants.push(servant);

    await servant.update({
      "system.factionId": container.factionId,
      "system.classContainer": container.classContainer,
    });
    // `setContract` is the ONE place that keeps `Servant.masterId` and
    // `Master.servantIds` reciprocal; writing either directly desynchronizes
    // them, and §16.9's per-Servant Command Spell pools are keyed off the
    // Master's roster.
    await worldIO().setContract(servant.id, "contracted", master.id);
  }

  await combat.update({
    "system.warType": draft.warType,
    "system.ruleset": draft.ruleset,
    "system.homeBaseDepth": draft.homeBaseDepth,
    "system.region": draft.region || null,
    "system.difficulty": draft.difficulty,
    "system.grailThreshold": draft.grailThreshold,
    "system.containers": draft.containers.map((c, i) => ({
      ...c, servantId: servants[i]?.id ?? null, masterId: masters[i]?.id ?? null,
    })),
  });

  await note(combat, "Deploying units into their home bases");
  await deployTokens(scene, draft, roster, masters, servants);

  await note(combat, `War built: ${servants.length} Servants, ${masters.length} Masters`);
  return { scene, masters, servants, combat };
}

/**
 * Drop every unit inside its own faction's base.
 *
 * Placed rather than left in the sidebar, because §19.7 step 10 is *"both
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
 * @returns {Promise<void>}
 */
async function deployTokens(scene, draft, roster, masters, servants) {
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
