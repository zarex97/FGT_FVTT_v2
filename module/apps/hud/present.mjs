/**
 * @file The action bar's view-model.
 * @see docs/29-user-interface.md §29.5
 *
 * Layer 4, and deliberately PURE: no Foundry globals, no documents. The bar
 * renders exactly what this returns, so every state the design names is
 * testable against literals. Same split, and the same reason, as
 * `apps/actor-sheet/present.mjs`.
 */

import { ticksLabel } from "../actor-sheet/present.mjs";

/** The rows, in the order they are shown. */
const ROW_ORDER = Object.freeze(["pinned", "actions", "skills", "np", "modes", "fields", "effects"]);

/** Which row an ability's group lands in. */
const GROUP_ROW = Object.freeze({ skill: "skills", np: "np", mode: "modes" });

/**
 * The portrait block: which face and which name the viewer is entitled to.
 *
 * Mirrors `apps/actor-sheet/context.mjs`'s `portraitImg` and
 * `rules/identity.mjs#publicNameOf`. Concealment applies to an unrevealed
 * SERVANT and to nothing else, and never to the unit's own owner — the
 * concealment is from opponents, not from the player running it.
 *
 * @param {object} unit
 * @param {{img: string, defaultImage: string|null, publicName: string, trueName: string, isOwner: boolean}} view
 * @returns {{img: string, name: string, subtitle: string|null}}
 */
export function portraitBlock(unit, { img, defaultImage, publicName, trueName, isOwner }) {
  const concealed = unit?.kind === "servant" && !unit?.identityRevealed && !isOwner;
  return {
    img: concealed ? (defaultImage || img) : img,
    name: concealed ? publicName : trueName,
    subtitle: concealed ? null : (publicName === trueName ? null : publicName),
  };
}

/**
 * One slot, with every state the bar draws.
 *
 * @param {object} ability a snapshot ability entry
 * @param {object} view
 * @param {{ok: boolean, reason?: string}} view.verdict from `rules/costs.mjs#canUseAbility`
 * @param {object|null} [view.cost] from `apps/actor-sheet/present.mjs#abilityCost`
 * @param {number} [view.turnsPerRound]
 * @returns {object}
 */
export function slotFor(ability, { verdict, cost = null, turnsPerRound = 3 }) {
  const remaining = ability?.cooldownRemaining ?? 0;
  const cooldown = remaining > 0
    ? { remaining, label: ticksLabel(remaining, turnsPerRound) }
    : null;

  // A ring says "this is switched on", which is a different fact from "this is
  // unavailable" and must not be drawn as one.
  let ring = null;
  if (ability?.isNP && ability?.fieldOpen) ring = "built";
  else if (ability?.active) ring = "on";

  const refused = verdict?.ok === false;
  return {
    id: ability?.id ?? null,
    name: ability?.name ?? "",
    img: ability?.img ?? null,
    cost,
    cooldown,
    ring,
    disabled: refused || Boolean(cooldown),
    // The reason travels with the slot so the tooltip can say it. A dead
    // control with no explanation is how a player concludes the system is
    // broken (`rules/modes.mjs` states the same rule for `cannotDeactivate`).
    reason: refused ? (verdict.reason ?? "unavailable") : (cooldown ? "cooldown" : null),
  };
}

/**
 * Every row the bar shows, in order, omitting the empty ones.
 *
 * A row that would be empty is left out rather than drawn blank: a Master has
 * three rows and Medusa has seven, and an empty "Noble Phantasms" heading on a
 * Civilian is noise.
 *
 * @param {object} args
 * @param {object[]} args.actions from `rules/actions.mjs#availableActions`
 * @param {object[]} args.abilities slot-shaped, each carrying a `group`
 * @param {object[]} [args.fields] slot-shaped
 * @param {object[]} [args.effects] slot-shaped
 * @param {string[]} [args.pins] ability ids
 * @returns {Array<{id: string, label: string, slots: object[]}>}
 */
export function rowsFor({ actions = [], abilities = [], fields = [], effects = [], pins = [] }) {
  /** @type {Record<string, object[]>} */
  const buckets = { pinned: [], actions: [], skills: [], np: [], modes: [], fields, effects };

  for (const action of actions) {
    buckets.actions.push({ ...action, isAction: true, id: action.id, name: action.label });
  }
  for (const ability of abilities) {
    const row = GROUP_ROW[ability.group] ?? "skills";
    buckets[row].push(ability);
  }
  // A pin is a SHORTCUT into the rows below, never a replacement, so the same
  // ability appears twice by design and nothing can be hidden by pinning.
  for (const id of pins) {
    const found = abilities.find((a) => a.id === id);
    if (found) buckets.pinned.push(found);
  }

  return ROW_ORDER
    .filter((id) => (buckets[id] ?? []).length > 0)
    .map((id) => ({ id, label: `FGT.HUD.Row.${id}`, slots: buckets[id] }));
}
