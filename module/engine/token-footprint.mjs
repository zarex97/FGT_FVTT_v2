/**
 * @file Keeping a Platform's token the size of the footprint it declares.
 * @see docs/20-platforms-and-levels.md §20.3, docs/37-content-pipeline.md §37.4
 *
 * Layer 3. A Platform declares `system.footprint: {w, h}` — the Hanging
 * Gardens of Babylon is 9×9 — but a Foundry token's size lives in a different
 * place entirely, `TokenDocument#width`/`#height`, and nothing connected the
 * two. `prototypeToken` therefore compiled at Foundry's 1×1 default, so the
 * compendium entry showed a one-cell platform and dragging it onto a scene
 * placed a one-cell token.
 *
 * That is not cosmetic. `rules/snapshot.mjs#gridFootprint` derives a unit's
 * occupied panels from `TokenDocument#getOccupiedGridSpaceOffsets()` — the
 * TOKEN's grid size — while `rules/platforms.mjs#isUnderPlatform` reads
 * `system.footprint`. A 1×1 token for a 9×9 platform makes those two
 * disagree: the board sees a single-panel obstacle that nonetheless shelters
 * an 81-panel area. Only `engine/hgob.mjs` got it right, because it passes
 * `width`/`height` to `getTokenDocument()` by hand at activation time.
 *
 * So the sizing is enforced in three places, deliberately:
 *
 *  1. `tools/lib/content.mjs` compiles `prototypeToken.width`/`height` from
 *     the authored footprint, which is what makes the COMPENDIUM entry right.
 *  2. `preCreateToken` here sizes any platform token on the way in, which
 *     covers a world actor whose prototype predates (1) and was never rebuilt.
 *  3. `updateActor` here follows a footprint edit onto the prototype and every
 *     placed token, so changing the number on the sheet is enough.
 */

import { placedTokensOf } from "./token-sync.mjs";

export const TokenFootprint = {
  /** Register the hooks. Idempotent. */
  attach() {
    // Not GM-gated: `preCreateToken` mutates the pending document in the
    // creating client's own memory before it is sent, so whoever is placing
    // the token has to be the one to do it.
    Hooks.on("preCreateToken", onPreCreateToken);

    Hooks.on("updateActor", (actor, changes) => {
      if (changes.system?.footprint === undefined) return;
      syncFootprint(actor).catch((err) => console.error("FGT | Token footprint sync:", err));
    });
    console.log("FGT | Token footprint sync attached");
  },
};

/**
 * The token size an actor's declared footprint calls for, or `null` when it
 * declares none (every type but `platform`).
 *
 * @param {object} actor
 * @returns {{width: number, height: number}|null}
 */
export function footprintSize(actor) {
  const fp = actor?.system?.footprint;
  if (!fp) return null;
  const width = Number(fp.w);
  const height = Number(fp.h);
  if (!(width >= 1) || !(height >= 1)) return null;
  return { width, height };
}

/**
 * @param {object} document the pending `TokenDocument`
 */
function onPreCreateToken(document) {
  const size = footprintSize(document.actor);
  if (!size) return;
  if (document.width === size.width && document.height === size.height) return;
  // `updateSource` rather than `document.update`: the document does not exist
  // yet, and this is the one window in which changing it is free.
  document.updateSource(size);
}

/**
 * Push a changed footprint onto the prototype and every placed token.
 *
 * GM-only, the same convention `engine/token-image.mjs` and
 * `engine/faction-ownership.mjs` use: `updateActor` fires on every connected
 * client and only the GM may write another user's token.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
async function syncFootprint(actor) {
  if (!game.user.isGM) return;
  const size = footprintSize(actor);
  if (!size) return;

  if (!actor.isToken
    && (actor.prototypeToken.width !== size.width || actor.prototypeToken.height !== size.height)) {
    await actor.update({ "prototypeToken.width": size.width, "prototypeToken.height": size.height });
  }

  for (const token of placedTokensOf(actor)) {
    if (token.width === size.width && token.height === size.height) continue;
    // `fgtForced`, exactly as `engine/scene-levels.mjs#assignLevel` needs it:
    // `width` and `height` are Foundry v14 MOVEMENT_FIELDS (alongside `x`,
    // `y`, `elevation` and `level`), so a resize is routed through the
    // movement pipeline and `engine/movement-hooks.mjs#onPreMove` refuses it
    // as a Move that is not an orthogonal step. Without this the update
    // reaches `preUpdateToken` as a bare `{_id}` and fails SILENTLY -- no
    // throw, no rejection, just a token that never changed size.
    await token.update(size, { fgtForced: true });
  }
}
