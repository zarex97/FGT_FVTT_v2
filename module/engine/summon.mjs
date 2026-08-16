/**
 * @file Summoning a Servant, and rolling a Master's setup lines.
 * @see docs/37-content-pipeline.md §37.6, docs/14-checks-and-randomness.md §14.9
 *
 * Layer 3. `rules/setup-rolls.mjs` says what to roll and how to fold the
 * results; this rolls it, shows it, and writes.
 *
 * Nothing is written until the whole plan has been resolved. A summon that
 * half-applied — Health rolled, Region grant not yet — would leave a Servant on
 * the board that no rule could put right, because the plan is not recoverable
 * from the sheet once the rolls are gone.
 */

import {
  servantSetupPlan, masterSetupPlan, resolveSetupPlan, summonPlan, baseAttackAdjustment,
} from "../rules/setup-rolls.mjs";
import { Rank } from "../domain/rank.mjs";

/**
 * Roll a whole setup plan.
 *
 * The sign coin is a separate d2 rather than a negative die, because the plan
 * describes it that way and a `2d100` that can come out negative is not a
 * formula Foundry evaluates.
 *
 * @param {object} plan from `servantSetupPlan` or `masterSetupPlan`
 * @returns {Promise<{lines: object[], rolls: object[]}>}
 */
export async function rollSetupPlan(plan) {
  /** @type {Record<string, number>} */ const totals = {};
  /** @type {Record<string, boolean>} */ const signs = {};
  /** @type {object[]} */ const rolls = [];

  for (const line of plan.lines) {
    if (!line.roll) continue;

    const roll = await new Roll(line.roll.formula).evaluate();
    totals[line.id] = roll.total;
    rolls.push({ id: line.id, label: line.label, roll });

    if (line.roll.signCoin) {
      const coin = await new Roll("1d2").evaluate();
      signs[line.id] = coin.total === 1;
      rolls.push({ id: `${line.id}:sign`, label: `${line.label} (sign)`, roll: coin });
    }
  }

  return { lines: resolveSetupPlan(plan, totals, signs), rolls };
}

/**
 * Summon a Servant from the compendium onto the board.
 *
 * @param {object} args
 * @param {string} args.contentId the Servant's content id
 * @param {string} [args.masterId] the Master it contracts to, if any
 * @param {string|null} [args.region] the war's Region; defaults to the world setting
 * @param {Record<string, number>} [args.masterGrants] parameter steps the Master grants
 * @param {boolean} [args.confirm] set false to preview without writing
 * @returns {Promise<{ok: boolean, reason?: string, actor?: object, lines?: object[], steps?: object[]}>}
 */
export async function summonServant({
  contentId, masterId = null, region = null, masterGrants = {}, confirm = true,
}) {
  const source = await servantFromPacks(contentId);
  if (!source) return { ok: false, reason: "unknownServant" };

  const sheet = source.system;
  const warRegion = region ?? (game.settings.get("fgt", "region") || null);
  const master = masterId ? game.actors.get(masterId) : null;
  const steps = summonPlan({ sheet, master, warRegion, masterGrants });

  // §37.6's order: roll first, then grant. A Region step applied before the
  // roll would be rolled against the wrong table row.
  const { lines } = await rollSetupPlan(servantSetupPlan(sheet));
  const granted = mergeGrants(steps);
  const resolved = applyGrants(lines, sheet, granted);

  if (!confirm) return { ok: true, lines: resolved, steps };

  const data = source.toObject();
  data.system = { ...data.system, ...sheetPatch(resolved, sheet, granted) };
  if (master) {
    data.system.masterId = master.id;
    data.system.factionId = master.system?.factionId ?? null;
  }

  const [actor] = await Actor.createDocuments([data]);
  return { ok: true, actor, lines: resolved, steps };
}

/**
 * Roll a Master's setup lines onto an existing Master actor.
 *
 * @param {object} args
 * @param {string} args.masterId
 * @param {boolean} [args.confirm]
 * @returns {Promise<{ok: boolean, reason?: string, lines?: object[]}>}
 */
export async function rollMasterSetup({ masterId, confirm = true }) {
  const actor = game.actors.get(masterId);
  if (!actor) return { ok: false, reason: "notFound" };

  const { lines } = await rollSetupPlan(masterSetupPlan(actor.system));
  if (!confirm) return { ok: true, lines };

  const patch = {};
  for (const line of lines) {
    const path = SETUP_PATHS[line.id];
    if (path) patch[path] = line.value;
  }
  // Current values start at their maxima; a Master that begins a war already
  // wounded is not a rule anywhere.
  patch["system.health.value"] = patch["system.health.max"] ?? actor.system.health.max;
  await actor.update(patch);

  return { ok: true, lines };
}

/* -------------------------------------------------------------------------- */

/** Where each setup line is stored. */
const SETUP_PATHS = Object.freeze({
  maxHealth: "system.health.max",
  maxAgility: "system.agility.max",
  maxLuck: "system.luck.max",
  baseAttackMag: "system.baseAttack.mag",
  commandSpells: "system.commandSpells.value",
});

/**
 * The Servant's parameter grants, merged across every source in the plan.
 *
 * Master and Region grants are separate **steps** in the plan and stack; they
 * are merged here only to compute the final sheet, and the plan keeps them
 * apart so the summon dialog can show where each step came from.
 *
 * @param {object[]} steps
 * @returns {Record<string, number>}
 */
function mergeGrants(steps) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const step of steps.filter((s) => s.kind === "grant")) {
    for (const [parameter, n] of Object.entries(step.steps)) {
      out[parameter] = (out[parameter] ?? 0) + n;
    }
  }
  return out;
}

/**
 * Add the granted steps to the resolved lines.
 *
 * END, AGI and LUC steps raise their own maxima; STR and MAG move Base Attack
 * instead and are handled in `sheetPatch`.
 *
 * @param {object[]} lines
 * @param {object} sheet
 * @param {Record<string, number>} granted
 * @returns {object[]}
 */
function applyGrants(lines, sheet, granted) {
  const bump = { maxHealth: granted.end ?? 0, maxAgility: granted.agi ?? 0, maxLuck: granted.luc ?? 0 };
  return lines.map((line) => {
    const steps = bump[line.id] ?? 0;
    if (steps === 0) return line;
    // A granted END step moves the Servant up the Health table rather than
    // adding one, because the table is not linear.
    const value = line.id === "maxHealth"
      ? healthAt(sheet, steps)
      : line.value + steps;
    return { ...line, value, granted: steps };
  });
}

/**
 * Max Health after `steps` granted END steps, read off the table.
 * @param {object} sheet
 * @param {number} steps
 * @returns {number}
 */
function healthAt(sheet, steps) {
  const end = Rank.parseOrNull(sheet?.parameters?.end);
  const shifted = end ? end.step(steps) : null;
  return Number(servantSetupPlan({ ...sheet, parameters: { ...sheet.parameters, end: shifted?.toString() } })
    .lines.find((l) => l.id === "maxHealth").base);
}

/**
 * The system patch a resolved plan produces.
 * @param {object[]} lines
 * @param {object} sheet
 * @param {Record<string, number>} granted
 * @returns {object}
 */
function sheetPatch(lines, sheet, granted) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const value = (id) => lines.find((l) => l.id === id)?.value ?? 0;

  patch.health = { max: value("maxHealth"), value: value("maxHealth") };
  patch.agility = { max: value("maxAgility"), value: value("maxAgility") };
  patch.luck = { max: value("maxLuck"), value: value("maxLuck") };

  // Only STR and MAG move Base Attack, and only for **granted** steps — the
  // sheet's own figure already accounts for the parameters it was written with.
  const ba = baseAttackAdjustment(granted);
  patch.baseAttack = {
    str: (sheet?.baseAttack?.str ?? 0) + ba.str,
    mag: (sheet?.baseAttack?.mag ?? 0) + ba.mag,
  };

  // The granted steps themselves, so the sheet can show "B (granted +1)" rather
  // than silently displaying a rank the Servant was not written with.
  patch.grantedSteps = granted;
  return patch;
}

/**
 * A Servant document from the content packs, by content id.
 * @param {string} contentId
 * @returns {Promise<object|null>}
 */
async function servantFromPacks(contentId) {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === contentId);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}
