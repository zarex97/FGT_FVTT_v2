/**
 * @file Keeping a Servant's token texture in sync with its concealed identity.
 * @see docs/04-units.md §4.2, docs/26-authority-and-sockets.md §26.6
 *
 * Layer 3. Foundry does not propagate an actor's `img` to a token already
 * placed on a scene — each `TokenDocument` (and `prototypeToken`) carries its
 * own `texture.src`, frozen at the moment it was created. Nothing in this
 * system ever synced the two, so changing a Servant's portrait or its
 * `defaultImage` left every placed token showing whatever it always had.
 *
 * The token is not the sheet: a placed token's texture is **one field every
 * viewer sees identically** — Foundry has no per-viewer rendering for it, and
 * building that (the shadow-actor pattern) is the exact thing Ch. 26 §26.6
 * assesses and defers to Ch. 40. So this does not attempt to show the true
 * portrait to the owner and the standard image to everyone else the way the
 * sheet does (`apps/actor-sheet/context.mjs`'s `concealed`) — it keeps the
 * token showing whichever ONE image is currently public: the standard image
 * while `identityRevealed` is unset, the true portrait once it is set. A GM
 * revealing a Servant's identity is therefore also what puts its real face on
 * the board, for everyone, in one action.
 *
 * This ran for `type === "servant"` alone until it was found live: a Master, a
 * Summon or a Platform whose portrait changed kept its old token texture with
 * no way to shift it short of deleting the token and dropping a new one. Only
 * a Servant has an identity to CONCEAL (`identityRevealed` is declared on
 * `ServantData`, not on the shared schema), but every unit type has a portrait
 * that ought to reach the board, so the concealment branch stayed Servant-only
 * and the sync itself widened to every unit type.
 */

import { placedTokensOf } from "./token-sync.mjs";

/**
 * The Actor types this system defines (`system.json`'s `documentTypes.Actor`).
 * A journal or a stock Foundry actor sharing the world is none of our business.
 */
const UNIT_TYPES = new Set(["servant", "master", "civilian", "summon", "platform", "structure"]);

export const TokenImage = {
  /** Register the hooks. Idempotent. */
  attach() {
    Hooks.on("updateActor", (actor, changes) => {
      if (!UNIT_TYPES.has(actor.type)) return;
      if (!touchesWatchedPath(changes)) return;
      syncOne(actor).catch((err) => console.error("FGT | Token image sync:", err));
    });
    console.log("FGT | Token image sync attached");
  },
};

/**
 * Does this update touch `img`, `system.defaultImage`, or
 * `system.identityRevealed`?
 * @param {object} changes
 * @returns {boolean}
 */
function touchesWatchedPath(changes) {
  if ("img" in changes) return true;
  const sys = changes.system;
  return Boolean(sys && ("defaultImage" in sys || "identityRevealed" in sys));
}

/**
 * The image every viewer's canvas should currently show for this unit.
 *
 * Mirrors `apps/actor-sheet/context.mjs`'s `portraitImg` minus that function's
 * viewer-dependent half: concealment applies to a Servant whose identity is
 * unrevealed and to nothing else, so a Master or a Platform shows its own
 * portrait and `defaultImage` is inert on it. Getting this wrong the other way
 * — treating `defaultImage` as an unconditional token override — would pin a
 * Master's token to a field its own sheet never displays.
 *
 * @param {object} actor
 * @returns {string}
 */
export function publicImageOf(actor) {
  const concealed = actor.type === "servant" && !actor.system?.identityRevealed;
  if (!concealed) return actor.img;
  return actor.system?.defaultImage || actor.img;
}

/**
 * Push the public image onto the prototype and every placed token.
 *
 * GM-only: `updateActor` fires on every connected client, and only the GM may
 * write another user's token. Elsewhere this is a no-op rather than a throw,
 * the same convention `engine/faction-ownership.mjs` uses.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
async function syncOne(actor) {
  if (!game.user.isGM) return;

  // A synthetic (token) actor has no prototype of its own to write -- Foundry
  // resolves `.prototypeToken` through to the base actor, so writing it here
  // would push one token's local portrait onto every OTHER token of the same
  // base actor.
  if (!actor.isToken) {
    const src = publicImageOf(actor);
    if (actor.prototypeToken.texture.src !== src) {
      await actor.update({ "prototypeToken.texture.src": src });
    }
  }

  // `placedTokensOf` rather than `getActiveTokens()`, which covers only the
  // scene currently open — this claimed to reach a token on an unopened scene
  // and did not. See `token-sync.mjs` for what that call gets wrong.
  //
  // Unlinked tokens are included because that is exactly the shape a summoned
  // Servant uses. Their image is read from the token's OWN actor: an
  // ActorDelta that overrides `img` is per-token art the GM chose
  // deliberately, and the base actor's portrait must not stomp it.
  for (const token of placedTokensOf(actor)) {
    const src = publicImageOf(token.actor ?? actor);
    if (token.texture.src !== src) await token.update({ "texture.src": src });
  }
}
