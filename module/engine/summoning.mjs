/**
 * @file Conjuring summons — the `summon` phase.
 * @see docs/15-abilities.md §15.2, docs/36-case-remaining.md
 *
 * Layer 3. Medea's Dragon Tooth Warriors is the reference case and the most
 * structurally demanding summon in the set: **two nested rolls**, one deciding
 * how many appear and one deciding what each one is, and a cooldown that
 * depends on the first roll's result — so the cost of the Skill is not known
 * until after it has resolved.
 *
 * That last property is why `summonPhase` returns the count: the caller sets
 * the cooldown afterwards, rather than the phase pretending to know it.
 *
 * Placement is *"within a 5x5 panel area around Medea"*, and the panels are
 * picked from the free ones — a summon that landed on an occupied panel would
 * either overlap a Unit or silently fail to appear, and the second is worse
 * because nothing on screen says a Warrior is missing.
 */

import { chebyshevDisc } from "../domain/geometry.mjs";
import { currentBoard } from "./board.mjs";

/**
 * Run a `summon` phase.
 *
 * @param {object} phase
 * @param {object} summoner the conjuring actor
 * @param {object} [options]
 * @param {(spec: object) => Promise<string|null>} [options.choose] resolves a
 *   "your choice" entry; without one the choice falls back to the first type
 * @returns {Promise<{count: number, created: object[], rolls: object[]}>}
 */
export async function summonPhase(phase, summoner, { choose = null } = {}) {
  const spec = phase?.spec ?? {};
  const scene = canvas.scene;
  if (!scene) return { count: 0, created: [], rolls: [] };

  /** @type {object[]} */
  const rolls = [];

  const countRoll = await new Roll(spec.countRoll ?? "1").evaluate();
  rolls.push({ id: "summonCount", formula: countRoll.formula, total: countRoll.total });
  const count = Math.max(0, countRoll.total);
  if (count === 0) return { count: 0, created: [], rolls };

  // Types first, so a "your choice" entry can be answered before anything is
  // placed -- a half-built squad on the board while a dialog waits is a state
  // no rule describes.
  /** @type {string[]} */
  const contentIds = [];
  for (let k = 0; k < count; k++) {
    const typeRoll = await new Roll(spec.typeRoll ?? "1").evaluate();
    rolls.push({ id: `summonType:${k}`, formula: typeRoll.formula, total: typeRoll.total });

    const chosen = (spec.choiceOn ?? []).includes(typeRoll.total)
      ? await resolveChoice(spec, choose)
      : spec.types?.[typeRoll.total] ?? spec.types?.[String(typeRoll.total)] ?? null;

    if (chosen) contentIds.push(chosen);
    else console.warn(`FGT | Summon type ${typeRoll.total} has no entry; that Warrior did not appear.`);
  }

  const panels = freePanels(summoner, spec.placement ?? {}, contentIds.length);

  // A summon tied to the platform its summoner is standing on.
  //
  // > *"Bašmu cannot leave the HGoB. If HGoB is removed from the field while
  // > Bašmu is summoned, it disappears."*
  //
  // `boundToPlatformId` is a Foundry DOCUMENT id, so it can only be written
  // here — content cannot name one. `engine/scene-levels.mjs` dismisses bound
  // summons when a platform is torn down, and with the field never stamped it
  // matched nobody: a destroyed Hanging Gardens left its Bašmu on the board.
  // Found live.
  const stamps = {};
  if (spec.boundToPlatform) {
    const platformId = currentBoard().units.find((u) => u.id === summoner.id)?.platformId ?? null;
    if (platformId) stamps.boundToPlatformId = platformId;
  }

  const created = await placeSummons(contentIds, panels, summoner, scene, spec, stamps);

  return { count: created.length, created, rolls };
}

/**
 * How many ticks a count-scaled cooldown comes to.
 *
 * *"Cooldown: (Number of Dragon Tooth Warriors x ⅔◈)"* — the only cooldown in
 * the reference set whose length is decided by the roll that just happened.
 *
 * @param {object} cooldown the ability's `cooldown`, as authored
 * @param {number} count
 * @param {number} turnsPerRound
 * @returns {number} ticks
 */
export function scaledCooldown(cooldown, count, turnsPerRound) {
  if (!cooldown?.perUnit) return 0;

  // `⅔◈` is two thirds of a Round, which is a whole number of turns only
  // because a Round is three turns. Rounded UP: a cooldown that came out
  // shorter than the text says is a Skill used more often than it should be.
  const perUnit = fractionOf(cooldown.perUnit) * turnsPerRound;
  return Math.ceil(perUnit * count);
}

/* -------------------------------------------------------------------------- */

/**
 * The free panels a summon may appear on.
 *
 * Occupied panels are excluded rather than overlapped: two Units on one panel
 * is not a state this system has rules for, and a Warrior that quietly failed
 * to appear is worse than one that appears further out.
 *
 * @param {object} summoner
 * @param {object} placement
 * @param {number} needed
 * @returns {Array<{i: number, j: number}>}
 */
export function freePanels(summoner, placement, needed) {
  const board = currentBoard();
  const self = board.units.find((u) => u.id === summoner.id);
  const origin = self?.panel;
  if (!origin) return [];

  // A 5x5 "around" the caster is a Chebyshev radius of 2.
  const radius = Math.floor((placement.size ?? 5) / 2);
  const level = self.level ?? 0;
  const occupied = new Set(
    board.units
      // A Unit that shares panels does not make a panel unavailable -- that is
      // what sharing means, and a summon refused the only free square because
      // Piedra Del Sol was standing on it would be the same defect from the
      // other side.
      .filter((u) => !u.sharesPanel)
      // Nor does a PLATFORM or a STRUCTURE, for the reason
      // `rules/movement.mjs#canStopOn` gives in the same words: they are stood
      // on, not blocked by. A platform's footprint covers every panel of its
      // own deck, so this filter is what decides whether anything can be
      // summoned aboard one at all. Found live the moment the Hanging Gardens
      // first occupied its own footprint correctly: Bašmu, whose whole placement
      // is *"on a panel directly next to her"* while she stands in the Throne
      // Room, reported "0 summoned" with all nine candidate panels taken by the
      // garden underneath her.
      .filter((u) => u.kind !== "platform" && u.kind !== "structure")
      // Only what is on the same level. A summon appears beside its summoner,
      // and a Unit on the ground twenty feet below is not beside anybody.
      .filter((u) => (u.level ?? 0) === level)
      .flatMap((u) => (u.panels ?? [u.panel]).filter(Boolean).map((p) => `${p.i},${p.j}`)),
  );

  return chebyshevDisc(origin, radius, board.bounds ?? null)
    .filter((p) => !occupied.has(`${p.i},${p.j}`))
    .slice(0, needed);
}

/**
 * Create the tokens.
 *
 * @param {string[]} contentIds
 * @param {object[]} panels
 * @param {object} summoner
 * @param {object} scene
 * @param {object} spec
 * @returns {Promise<object[]>}
 */
export async function placeSummons(contentIds, panels, summoner, scene, spec, stamps = {}) {
  // Where the summoner is standing, for a summon that belongs beside it rather
  // than on the ground beneath it. Read once: every summon in one call lands on
  // the same level.
  const summonerToken = summoner.getActiveTokens?.()[0]?.document ?? null;
  const summonerLevel = stamps.boundToPlatformId ? summonerToken?.level ?? null : null;
  const summonerElevation = summonerToken?.elevation ?? 0;

  /** @type {object[]} */
  const created = [];

  for (const [index, contentId] of contentIds.entries()) {
    const panel = panels[index];
    if (!panel) {
      // Ran out of room. Reported rather than dropped: a player who rolled six
      // and got four needs to know which rule took the other two.
      ui.notifications?.warn(game.i18n.format("FGT.Summon.NoRoom", { count: contentIds.length - index }));
      break;
    }

    const source = await fromPacks(contentId);
    if (!source) {
      console.warn(`FGT | Unknown summon "${contentId}".`);
      continue;
    }

    const data = source.toObject();
    data.name = `${source.name}`;
    data.system.summonerId = summoner.id;
    data.system.factionId = summoner.system?.factionId ?? null;
    // Both clauses from the sheet, carried on the summon rather than special-
    // cased for its summoner: "do not count towards the number of Units that
    // Move and/or Attack", and "can only Move/Attack once per Turn".
    data.system.countsTowardBudget = spec.countsTowardBudget ?? data.system.countsTowardBudget;
    data.system.actsOncePerTurn = spec.actsOncePerTurn ?? data.system.actsOncePerTurn;

    // Stats stated RELATIVE to the summoner. The Kagome Spirits are the first
    // in the corpus: *"Agility: Pale Rider's plus 2"*, *"Luck: Same as Pale
    // Rider's"* -- which cannot be written as numbers on a sheet, because they
    // are not numbers. Resolved here, from the summoner's LIVE values, because
    // that is the only moment they are both known and fixed.
    for (const [stat, rule] of Object.entries(data.system.inherit ?? {})) {
      if (rule?.from !== "summoner") continue;
      const base = summoner.system?.[stat]?.max ?? summoner.system?.[stat]?.value ?? 0;
      const value = Math.max(0, base + (rule.delta ?? 0));
      data.system[stat] = { value, max: value };
    }

    // Whatever the caller needs stamped on every summon it is placing --
    // `pursuitTargetId` and `boundToFieldId` for a Kagome Spirit. Foundry
    // document ids, so they can only be written here and never authored.
    const { rememberedStats, ...plain } = stamps;
    Object.assign(data.system, plain);

    // *"…but with the same Stats as when they disappeared."* Applied AFTER the
    // `inherit` pass above, because a remembered figure is what the Unit had
    // when it left and must not be recomputed from its summoner: a Sphinx that
    // came back at its inherited Luck would also come back at full Health.
    //
    // Only the stats that were actually recorded, and only when they hold a
    // number -- a partial record must not blank the rest of the sheet.
    for (const [stat, value] of Object.entries(rememberedStats ?? {})) {
      if (typeof value?.value !== "number") continue;
      data.system[stat] = { value: value.value, max: value.max ?? value.value };
    }

    const actor = await Actor.create(data);
    const token = await actor.getTokenDocument({
      x: panel.j * scene.grid.size,
      y: panel.i * scene.grid.size,
      // A summon bound to a platform is summoned ONTO it. Bašmu is placed *"on
      // a panel directly next to her"* while she is aboard the Hanging Gardens,
      // and *"cannot leave the HGoB"* -- so the ground level is the one place
      // it must not appear. Set at creation rather than moved afterwards: a
      // token created on the ground and then displaced upward is two writes and
      // a frame of it standing under the garden.
      ...(summonerLevel ? { level: summonerLevel, elevation: summonerElevation } : {}),
    });
    await scene.createEmbeddedDocuments("Token", [token.toObject()]);
    created.push(actor);
  }
  return created;
}

/**
 * @param {object} spec
 * @param {Function|null} choose
 * @returns {Promise<string|null>}
 */
async function resolveChoice(spec, choose) {
  const from = spec.choiceFrom ?? [];
  if (from.length === 0) return null;
  if (!choose) return from[0];

  const picked = await choose(spec);
  return picked ?? from[0];
}

/**
 * `⅓`, `⅔` and plain numbers, as a fraction of a Round.
 * @param {string} raw
 * @returns {number}
 */
function fractionOf(raw) {
  const text = String(raw).replace("◈", "").trim();
  if (text.includes("⅔")) return 2 / 3;
  if (text.includes("⅓")) return 1 / 3;
  if (text.includes("½")) return 1 / 2;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A summon statblock from the packs, by content id.
 * @param {string} contentId
 * @returns {Promise<object|null>}
 */
async function fromPacks(contentId) {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === contentId);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}
