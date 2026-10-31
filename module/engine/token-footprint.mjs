/**
 * @file Keeping a Platform's token the size of the footprint it declares.
 * @see docs/27-platforms-and-levels.md, docs/40-content-pipeline.md
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
      // An authored edit, and also anything that could move a DERIVED footprint:
      // Kingprotea's grows with her Proliferation stocks, which arrive as
      // effects and are counted at contribution time, so the number on the
      // sheet changes with nothing under `system.footprint` in the diff.
      if (changes.system === undefined) return;
      queueSync(actor);
    });

    // The other half of the same thought. A stock is an ActiveEffect, and
    // gaining or losing one is the ONLY signal that her size changed: the
    // actor document itself is untouched.
    for (const hook of ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"]) {
      Hooks.on(hook, (effect) => {
        const actor = effect?.parent;
        if (actor?.documentName === "Actor") queueSync(actor);
      });
    }
    // ...and a Mode switched on or off, which grows or shrinks a Unit whose
    // size is its rule: Fafnir's 3x3 (#345). Ended by its owner's own switch,
    // no actor or effect write followed the item's, and the token stayed 3x3
    // over a 1x1 footprint (found live).
    Hooks.on("updateItem", (item, changes) => {
      const actor = item?.parent;
      if (actor?.documentName !== "Actor" || changes?.system?.active === undefined) return;
      queueSync(actor);
    });

    // ...and the repair. Foundry v14 counts `width`/`height` among its
    // MOVEMENT_FIELDS, so a resize is routed through the movement pipeline --
    // and a resize that walks no step leaves the document PREPARED at the old
    // size. `_source` carries the new number and `TokenDocument#width` still
    // reports the old one, so the board shows a 1x1 Kingprotea whose sheet
    // says 2x2 until something else re-prepares her. Found live, at her third
    // Proliferation stock.
    //
    // Not GM-gated: every client prepares its own copy, so every client has to
    // repair its own.
    Hooks.on("updateToken", (token) => refreshSize(token));

    console.log("FGT | Token footprint sync attached");
  },
};

/**
 * Coalesce a burst of triggers into one resize.
 *
 * Ten Proliferation stocks arrive as ten `createActiveEffect` hooks, and each
 * one would otherwise ask the same question and write the same answer. The
 * derived footprint is read after the microtask queue drains, so a batch that
 * grows her by a whole panel resizes once.
 *
 * @type {Set<string>}
 */
const queued = new Set();

/**
 * @param {object} actor
 */
function queueSync(actor) {
  if (!actor?.id || queued.has(actor.id)) return;
  queued.add(actor.id);
  Promise.resolve().then(() => {
    queued.delete(actor.id);
    syncFootprint(actor).catch((err) => console.error("FGT | Token footprint sync:", err));
  });
}

/**
 * The token size an actor's declared footprint calls for, or `null` when it
 * declares none.
 *
 * Read off the LIVE `system`, which is the derived value — a Servant whose
 * footprint is grown by a `SizeStep` has the grown number here and the size she
 * started at in `_source`.
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
  // A Unit that co-occupies a panel has to draw ABOVE whoever is under it, or
  // *"place the Piedra Del Sol on top of any Units which Move onto that panel"*
  // is a rule with no visible half. Set before the size return below, because a
  // sharing token is usually 1x1 and would otherwise never reach this.
  if (document.actor?.system?.sharesPanel && document.sort === 0) {
    document.updateSource({ sort: 100 });
  }

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
  // One resize at a time per actor. A stock arrives as an ActiveEffect AND as
  // the Health write that pays its +400, two triggers in two microtasks, and
  // while the first was waiting on the owner's corner the second saw the same
  // small token and asked again: two "Kingprotea grows" dialogs (#198). The
  // second waits for the first and then finds nothing left to do.
  const pending = syncing.get(actor.id);
  if (pending) {
    await pending;
    return syncFootprint(actor);
  }
  let release;
  syncing.set(actor.id, new Promise((r) => { release = r; }));
  try {
    await resizeTokens(actor);
  } finally {
    syncing.delete(actor.id);
    release();
  }
}

/** Actors whose tokens are being resized, and the promise that settles it. */
const syncing = new Map();

/**
 * @param {object} actor
 * @returns {Promise<void>}
 */
async function resizeTokens(actor) {
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
    // `animate: false` for the same reason `engine/io.mjs#move` passes it: a
    // resize is a MOVEMENT_FIELDS write, and an animated one holds the document
    // at the size it started from. Growing looked fine and SHRINKING did not --
    // Infantile Regression put her footprint back to 1x1 and left a 3x3 token
    // standing on the board.
    // Growing, she grows from a corner her owner picks, and shoves whoever
    // stands where she grows to (#198 reading 6). Shrinking keeps her top-left.
    // A Unit that grows about its centre shrinks about it too: Fafnir ends on
    // the middle panel of his 3x3 (#345 ruling 19).
    const grew = size.width > token.width || size.height > token.height;
    const grows = actor.system?.footprint?.grows;
    const centred = grows === "centre";
    // Summer Habetrot leaving her Shisarot Form shrinks onto one of the panels
    // she covered, her owner's pick (#359 ruling 26); it kept her top-left.
    const at = grew ? await growthPlacement(actor, token, size, { centred })
      : centred ? shrinkPlacement(token, size)
        : grows === "cornerPick" ? await pickedShrink(actor, token, size) : null;
    await token.update({ ...size, ...(at ?? {}) }, { fgtForced: true, animate: false });
    refreshSize(token);
  }
}

/** The corner that stays put, and which way that grows her. */
const CORNERS = Object.freeze({
  nw: { down: true, right: true },
  ne: { down: true, right: false },
  sw: { down: false, right: true },
  se: { down: false, right: false },
});

/**
 * Where a growing Unit's token goes, after its owner picks the corner it grows
 * from and the Units it grows into are shoved off it.
 *
 * Ruled 2026-10-11 (#198 reading 6): her owner picks the corner; a Unit in a
 * panel she grows into is knocked back as Huge Scale's Passive 1 knocks it
 * back, away from her; against a wall or the board's edge she grows the other
 * way.
 *
 * @param {object} actor
 * @param {object} token a `TokenDocument`
 * @param {{width: number, height: number}} size the size she is growing to
 * @returns {Promise<{x: number, y: number}|null>}
 */
async function growthPlacement(actor, token, size, { centred = false } = {}) {
  if (!canvas?.grid) return null;
  const { currentBoard } = await import("./board.mjs");
  const { clearFootprintPlan } = await import("../rules/movement.mjs");
  const { displacePlan } = await import("./movement-hooks.mjs");
  const { chooseFor } = await import("./ask.mjs");

  const board = currentBoard();
  const from = canvas.grid.getOffset({ x: token.x, y: token.y });
  const old = { i: from.i, j: from.j, h: token.height, w: token.width };

  // About its centre, when the board has room (#345 ruling 23): Fafnir's 3x3
  // around the panel Sieg stood on. At an edge the owner picks a corner, as
  // Kingprotea's does.
  const centre = centred ? centredOrigin(old, size, board.bounds ?? null) : null;
  if (centre) {
    const footprint = [];
    for (let di = 0; di < size.height; di += 1) for (let dj = 0; dj < size.width; dj += 1) footprint.push({ i: centre.i + di, j: centre.j + dj });
    // Away from his old self, the way each occupant already stands from him.
    const dirOf = (u) => {
      const di = u.panel.i - old.i;
      const dj = u.panel.j - old.j;
      return Math.abs(di) >= Math.abs(dj) ? { i: Math.sign(di) || 1, j: 0 } : { i: 0, j: Math.sign(dj) };
    };
    const mover = board.units.find((u) => u.id === actor.id) ?? { id: actor.id };
    await displacePlan(clearFootprintPlan(mover, footprint, dirOf, board));
    return canvas.grid.getTopLeftPoint({ i: centre.i, j: centre.j });
  }

  const picked = await chooseFor(actor, {
    // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
    title: game.i18n.format("FGT.Growth.Title", { name: actor.name }),
    hint: game.i18n.localize("FGT.Growth.Hint"),
    count: 1,
    options: Object.keys(CORNERS).map((id) => ({ id, name: game.i18n.localize(`FGT.Growth.Corner.${id}`) })),
  });
  const corner = CORNERS[picked?.[0]] ?? CORNERS.nw;

  // Against a wall or the edge, the other way; failing both, as far as fits.
  const b = board.bounds ?? null;
  const fits = (lo, len, min, max) => lo >= min && lo + len - 1 <= max;
  let i0 = corner.down ? old.i : old.i + old.h - size.height;
  let j0 = corner.right ? old.j : old.j + old.w - size.width;
  if (b) {
    if (!fits(i0, size.height, b.iMin, b.iMax)) i0 = corner.down ? old.i + old.h - size.height : old.i;
    if (!fits(j0, size.width, b.jMin, b.jMax)) j0 = corner.right ? old.j + old.w - size.width : old.j;
    i0 = Math.min(Math.max(i0, b.iMin), b.iMax - size.height + 1);
    j0 = Math.min(Math.max(j0, b.jMin), b.jMax - size.width + 1);
  }

  const footprint = [];
  for (let di = 0; di < size.height; di += 1) for (let dj = 0; dj < size.width; dj += 1) footprint.push({ i: i0 + di, j: j0 + dj });
  // Away from her old self, across the side it grew past.
  const dirOf = (u) => {
    if (u.panel.i < old.i) return { i: -1, j: 0 };
    if (u.panel.i > old.i + old.h - 1) return { i: 1, j: 0 };
    return u.panel.j < old.j ? { i: 0, j: -1 } : { i: 0, j: 1 };
  };
  const mover = board.units.find((u) => u.id === actor.id) ?? { id: actor.id };
  await displacePlan(clearFootprintPlan(mover, footprint, dirOf, board));

  return canvas.grid.getTopLeftPoint({ i: i0, j: j0 });
}

/**
 * The top-left of a footprint grown about the old one's centre, or `null` when
 * the board's edge leaves no room for it there.
 *
 * @param {{i: number, j: number, h: number, w: number}} old
 * @param {{width: number, height: number}} size
 * @param {{iMin: number, iMax: number, jMin: number, jMax: number}|null} bounds
 * @returns {{i: number, j: number}|null}
 */
export function centredOrigin(old, size, bounds) {
  const i = old.i - Math.floor((size.height - old.h) / 2);
  const j = old.j - Math.floor((size.width - old.w) / 2);
  if (!bounds) return { i, j };
  const fits = i >= bounds.iMin && i + size.height - 1 <= bounds.iMax && j >= bounds.jMin && j + size.width - 1 <= bounds.jMax;
  return fits ? { i, j } : null;
}

/**
 * Where a Unit that shrinks onto a panel of her owner's choosing lands: one of
 * the footprint-sized blocks inside the one she leaves, asked by its corner, as
 * her growth is (#359 ruling 26). A 2x2 Summer Habetrot leaving her Shisarot
 * Form stands on any of her four panels. Nobody answering keeps the top-left.
 *
 * @param {object} actor
 * @param {object} token a `TokenDocument`
 * @param {{width: number, height: number}} size the size she shrinks to
 * @returns {Promise<{x: number, y: number}|null>}
 */
async function pickedShrink(actor, token, size) {
  if (!canvas?.grid) return null;
  const { chooseFor } = await import("./ask.mjs");
  const from = canvas.grid.getOffset({ x: token.x, y: token.y });
  const spareH = Math.max(0, token.height - size.height);
  const spareW = Math.max(0, token.width - size.width);
  const picked = await chooseFor(actor, {
    // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
    title: game.i18n.format("FGT.Shrink.Title", { name: actor.name }),
    hint: game.i18n.localize("FGT.Shrink.Hint"),
    count: 1,
    options: Object.keys(CORNERS).map((id) => ({ id, name: game.i18n.localize(`FGT.Shrink.Corner.${id}`) })),
  });
  const corner = CORNERS[picked?.[0]] ?? CORNERS.nw;
  // `down`/`right` name the corner that stays put as she GROWS; shrinking,
  // she keeps that corner's panel.
  return canvas.grid.getTopLeftPoint({
    i: from.i + (corner.down ? 0 : spareH),
    j: from.j + (corner.right ? 0 : spareW),
  });
}

/**
 * Where a Unit that grew about its centre lands as it shrinks: the middle of
 * the footprint it leaves (#345 ruling 19).
 *
 * @param {object} token a `TokenDocument`
 * @param {{width: number, height: number}} size the size it shrinks to
 * @returns {{x: number, y: number}|null}
 */
function shrinkPlacement(token, size) {
  if (!canvas?.grid) return null;
  const from = canvas.grid.getOffset({ x: token.x, y: token.y });
  return canvas.grid.getTopLeftPoint({
    i: from.i + Math.floor((token.height - size.height) / 2),
    j: from.j + Math.floor((token.width - size.width) / 2),
  });
}

/**
 * Re-prepare a token whose live size has drifted from the one that was stored,
 * and tell its placeable to redraw at it.
 *
 * The `updateToken` hook above is the general case; `syncFootprint` calls it
 * directly as well, because the hook fires with a diff of `{_id}` alone and the
 * writer should not have to depend on hook ordering to see its own write.
 *
 * @param {object} token a `TokenDocument`
 */
function refreshSize(token) {
  const source = token?._source;
  if (!source) return;
  if (token.width === source.width && token.height === source.height) return;
  token.reset();
  token.object?.renderFlags?.set({ refreshSize: true, refreshPosition: true });
}
