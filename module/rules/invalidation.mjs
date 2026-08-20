/**
 * @file What each change invalidates.
 * @see docs/23-documents-and-derived-data.md §23.9
 *
 * Layer 2 (rules). Pure — a lookup from "what happened" to "what is now
 * stale". The engine does the clearing.
 *
 * §23.9 calls this the hardest part of any derived-data system, and the reason
 * it is a **table** rather than a set of `if`s scattered through the hooks is
 * that the failure mode is silent in both directions: invalidate too little and
 * a client shows a number that is no longer true; invalidate too much and the
 * board rebuilds on every burn tick.
 *
 * The row that is easy to miss is **mode toggled → Master protection**.
 * Deactivating a Servant's mode does not move it, but if it changes whether the
 * Servant *can act*, the adjacent Master's protection turns on or off with it.
 * The general rule, stated so it survives the next reader: anything that
 * changes `canAct` invalidates Master protection for Masters within 2 panels.
 */

/**
 * Everything an invalidation may name.
 *
 * Some are parameterised by actor (`snapshot:karna`); the prefix is what
 * appears here. Closed, so a typo'd target clears nothing rather than clearing
 * a cache nobody named.
 */
export const INVALIDATION_TARGETS = Object.freeze([
  "all", "board", "snapshot", "auraIndex", "zon", "masterProtection",
  "cooldowns", "effectActivity", "phase", "decoy",
]);

/**
 * The effects that change whether a unit can act, from §23.9.
 *
 * Charm, Confuse and Berserk are in the list even though a unit under them
 * still *moves*: it no longer acts under its owner's direction, and Master
 * protection asks whether the Servant is protecting, not whether it is upright.
 */
export const CAN_ACT_INVALIDATORS = Object.freeze([
  "stun", "stop", "freeze", "petrify", "sleep", "nightmare", "coma",
  "webbed", "crystalfreeze", "charm", "confuse", "berserk",
]);

const CAN_ACT = new Set(CAN_ACT_INVALIDATORS);

/**
 * Does this effect change whether its bearer can act?
 * @param {string} defId
 * @returns {boolean}
 */
export function affectsCanAct(defId) {
  return CAN_ACT.has(defId);
}

/**
 * What a change invalidates.
 *
 * An **unknown** event invalidates nothing. The alternative — invalidating
 * everything to be safe — is a permanent full rebuild that nobody would notice
 * was happening, which is the more expensive mistake.
 *
 * @param {string} event
 * @param {object} ctx
 * @param {string} [ctx.actorId]
 * @param {boolean} [ctx.grantsAura] for an effect or item change
 * @param {boolean} [ctx.affectsCanAct] for a mode toggle
 * @param {string} [ctx.partnerId] the ZON partner, for a move
 * @returns {string[]}
 */
export function invalidationsFor(event, ctx = {}) {
  const forActor = ctx.actorId ? [`snapshot:${ctx.actorId}`] : [];

  switch (event) {
    case "actorField":
      return [...forActor, "board"];

    case "effectChanged":
      return [
        ...forActor, "board",
        // Only when it grants one. Rebuilding on every effect would rebuild on
        // every burn tick.
        ...(ctx.grantsAura ? ["auraIndex"] : []),
        // The canAct rule, applied to effects as well as modes.
        ...(ctx.actorId && ctx.affectsCanAct ? [`masterProtection:${ctx.actorId}`] : []),
      ];

    case "itemChanged":
      return [...forActor, "board", ...(ctx.grantsAura ? ["auraIndex"] : [])];

    case "modeToggled":
      return [
        ...forActor, "auraIndex",
        ...(ctx.actorId && ctx.affectsCanAct ? [`masterProtection:${ctx.actorId}`] : []),
      ];

    case "tokenMoved":
      return [
        "board", "auraIndex", "decoy",
        ...(ctx.actorId ? [`zon:${ctx.actorId}`] : []),
        // The partner's ZON too: ZON is a relationship, and moving one end of
        // it changes the other end's status without touching that actor.
        ...(ctx.partnerId ? [`zon:${ctx.partnerId}`] : []),
      ];

    case "tokenDeleted":
      return ["all"];

    case "turnAdvanced":
      return ["board", "cooldowns", "effectActivity"];

    case "roundAdvanced":
      return ["board", "cooldowns", "effectActivity", "phase"];

    case "settingChanged":
      // Locked mid-match anyway, so the cost of clearing everything is paid
      // once, out of play.
      return ["all"];

    default:
      return [];
  }
}
