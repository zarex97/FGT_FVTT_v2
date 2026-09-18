/**
 * @file Activating and destroying Semiramis's Hanging Gardens of Babylon.
 * @see char_orig_sheets/Copia de Semiramis.md lines 119-173, docs/32-*.md
 *
 * Layer 3. Deliberately Semiramis-specific rather than a generic "platform
 * activation" service: `engine/platforms.mjs#activatePlatform` already does
 * the generic half (Scene Level, moving units aboard), and `channel.mjs`
 * fires `fgt.channelComplete` without knowing what a platform even is. This
 * is the glue between the two, plus the one-shot writes (the owner buff,
 * `zonExempt`, the Sustainability bump) nothing else has a reason to know.
 */

import { currentBoard, unitSnapshot } from "./board.mjs";
import { activatePlatform } from "./platforms.mjs";
import { displaceToken } from "./io.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";

/** The compendium content id `packs/_source/platforms/hanging-gardens.yml` compiles to. */
const PLATFORM_CONTENT_ID = "hanging-gardens-of-babylon";
/** `packs/_source/effects/hgob-owner-buff.yml`'s `id`. */
const OWNER_BUFF_DEF_ID = "hgob-owner-buff";
/** "her Sustainability is increased by 2◈ Turns." */
const SUSTAINABILITY_BONUS = "2◈";

export const Hgob = {
  /** Register the hooks. Idempotent per Foundry session; GM-gated internally. */
  attach() {
    Hooks.on("fgt.channelComplete", onChannelComplete);
    Hooks.on("fgtPlatformDestroyed", onPlatformDestroyed);
  },
};

/**
 * @param {{actorId: string, onComplete: object|null}} args
 */
async function onChannelComplete({ actorId, onComplete }) {
  if (!game.users.activeGM?.isSelf) return;
  if (onComplete?.kind !== "activateHangingGardens") return;
  await activateHangingGardens(actorId);
}

/**
 * Ch. 45's "place the HGoB token... Move her to the middle panel... all
 * Parameters increased by one Rank... ZON does not apply... Sustainability
 * increased by 2◈."
 *
 * @param {string} semiramisId
 * @param {object} [options]
 * @param {string[]} [options.allyIds] *"all allied Units of your choice are
 *   transported to any panel within the HGoB"* — the choice is the caller's;
 *   this only carries it out.
 * @param {Record<string, {i: number, j: number}>} [options.allyPanels] where
 *   each of those allies lands, by unit id. Any ally without an entry is given
 *   a free panel inside the footprint.
 * @returns {Promise<{ok: boolean, reason?: string, platformId?: string}>}
 */
export async function activateHangingGardens(semiramisId, { allyIds = [], allyPanels = {} } = {}) {
  const owner = game.actors.get(semiramisId);
  if (!owner) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const self = board.units.find((u) => u.id === semiramisId);
  const scene = canvas.scene;
  if (!self?.panel || !scene) return { ok: false, reason: "notOnBoard" };

  const source = await platformFromPacks(PLATFORM_CONTENT_ID);
  if (!source) return { ok: false, reason: "unknownPlatform" };

  // Created before the owner buff, so the buff's own `applyEffect` intent
  // has a real `sourceUnitId` for `reverseOwnerEffects` to match on later --
  // it reads `e.system?.sourceUnitId === platform.id`, and an effect created
  // with no source could never be found again at destruction.
  const data = source.toObject();
  data.system.ownerId = owner.id;
  data.system.factionId = owner.system?.factionId ?? null;
  const platform = await Actor.create(data);

  await applyOwnerBuff(owner, platform.id);

  // "Base Attack (MAG): Uses Semiramis'" -- a one-shot mirror of her POST-buff
  // figure, not a live one; see hanging-gardens.yml's own note on why.
  await platform.update({ "system.baseAttack.mag": game.actors.get(owner.id)?.system?.baseAttack?.mag ?? 0 });

  const footprint = platform.system?.footprint ?? { w: 9, h: 9 };
  const token = await platform.getTokenDocument({
    x: self.panel.j * scene.grid.size,
    y: self.panel.i * scene.grid.size,
    width: footprint.w,
    height: footprint.h,
  });
  await scene.createEmbeddedDocuments("Token", [token.toObject()]);

  const riders = [owner.id, ...allyIds.filter((id) => id !== owner.id)];
  const activated = await activatePlatform({ platformId: platform.id, initialUnitIds: riders });
  if (!activated.ok) return activated;

  // *"...and she is Moved to the middle panel of HGoB, and all allied Units of
  // your choice are transported to any panel within the HGoB."*
  //
  // Neither half happened. `activatePlatform` puts a rider on the platform's
  // LEVEL and never touches its x/y, so Semiramis stayed on the panel the
  // garden's top-left corner was anchored to — outside the Throne Room, and on
  // the one panel of the footprint that is guaranteed to be its edge. Found
  // live: activated at (11,11), she was still at (11,11) afterwards.
  await seatRiders(platform, self.panel, riders, allyPanels);

  return { ok: true, platformId: platform.id };
}

/**
 * Put the riders on their panels inside the footprint.
 *
 * The owner takes the middle panel, which the sheet names; everyone else takes
 * the panel the caller chose, or the nearest free one to the middle if it did
 * not choose. Foundry anchors a token at its TOP-LEFT, so the middle of a `w x
 * h` footprint anchored at `origin` is `origin + floor(size / 2)`.
 *
 * @param {object} platform
 * @param {{i: number, j: number}} origin the panel the token was anchored to
 * @param {string[]} riders owner first
 * @param {Record<string, {i: number, j: number}>} chosen
 * @returns {Promise<void>}
 */
async function seatRiders(platform, origin, riders, chosen) {
  const scene = canvas.scene;
  const footprint = platform.system?.footprint ?? { w: 9, h: 9 };

  for (const { unitId, panel } of seatingPlan(origin, footprint, riders, chosen)) {
    // The scene's DOCUMENT collection, not `getActiveTokens()`.
    //
    // `getActiveTokens` reads the canvas **placeable** layer, and this runs
    // immediately after a 9x9 token has been created and every rider moved to a
    // new level — so the layer is mid-redraw and answers `[]` for a Unit whose
    // token plainly exists. The owner was then skipped by the falsy-`token`
    // guard below, silently, and left on the footprint's corner: outside the
    // Throne Room, which made Sikera Ušum's DSC branch unreachable.
    //
    // The document collection does not depend on anything being drawn, which is
    // the same reason §46.2 tells an auditor to move a token through its
    // document rather than its placeable.
    const token = tokenDocumentFor(unitId);
    // Loud when there is nobody to seat. A silent skip here is how the owner
    // came to be left on the rim twice: the arithmetic above is right, the
    // caller is right, and the whole failure fits in one falsy `token`.
    if (!token) {
      console.warn(`FGT | Hanging Gardens: no token to seat for ${game.actors.get(unitId)?.name ?? unitId}.`);
      continue;
    }
    // Through `displaceToken` for the reason `engine/io.mjs` records: a rider
    // set down inside a 9x9 platform is not walking there.
    const moved = await displaceToken(token, { x: panel.j * scene.grid.size, y: panel.i * scene.grid.size });
    if (!moved) {
      console.warn(`FGT | Hanging Gardens: could not seat ${token.name} at`, panel);
    }
  }
}

/**
 * Which panel each rider takes, inside a footprint anchored at `origin`.
 *
 * Pure, and exported for that reason: the decision this makes is the whole of
 * *"she is Moved to the middle panel of HGoB, and all allied Units of your
 * choice are transported to any panel within the HGoB"*, and it can be asserted
 * without a canvas, a scene or a platform. The impure half — finding a token
 * and moving it — is the four lines that remain in `seatRiders`.
 *
 * The owner is `riders[0]` and takes the middle. Foundry anchors a token at its
 * TOP-LEFT, so the middle of a `w × h` footprint anchored at `origin` is
 * `origin + floor(size / 2)`. Everyone else takes the panel the caller chose,
 * or the free panel nearest the middle when it chose none or chose one already
 * taken or outside the footprint.
 *
 * @param {{i: number, j: number}} origin the panel the platform token is anchored to
 * @param {{w: number, h: number}} footprint
 * @param {string[]} riders owner first
 * @param {Record<string, {i: number, j: number}>} [chosen]
 * @returns {Array<{unitId: string, panel: {i: number, j: number}}>}
 */
export function seatingPlan(origin, footprint, riders, chosen = {}) {
  const { w = 9, h = 9 } = footprint ?? {};
  const middle = { i: origin.i + Math.floor(h / 2), j: origin.j + Math.floor(w / 2) };

  // Ordered by distance from the middle, so an ally with no chosen panel lands
  // in the Throne Room rather than on the rim.
  /** @type {Array<{i: number, j: number}>} */
  const inside = [];
  for (let i = origin.i; i < origin.i + h; i++) {
    for (let j = origin.j; j < origin.j + w; j++) inside.push({ i, j });
  }
  inside.sort((a, b) => reach(a, middle) - reach(b, middle));

  /** @type {Array<{unitId: string, panel: {i: number, j: number}}>} */
  const out = [];
  const taken = new Set();
  for (const [index, unitId] of (riders ?? []).entries()) {
    const want = index === 0 ? middle : chosen?.[unitId] ?? null;
    const panel = want && !taken.has(key(want)) && contains(want, origin, w, h)
      ? want
      : inside.find((p) => !taken.has(key(p))) ?? null;
    if (!panel) continue;
    taken.add(key(panel));
    out.push({ unitId, panel });
  }
  return out;
}

/**
 * This Unit's token, read off the scene rather than off the canvas.
 *
 * @param {string} unitId
 * @returns {object|null} a TokenDocument
 */
function tokenDocumentFor(unitId) {
  return canvas.scene?.tokens?.find((t) => t.actorId === unitId)
    ?? game.actors.get(unitId)?.getActiveTokens?.(false, true)?.[0]
    ?? null;
}

/** @param {{i: number, j: number}} p */
const key = (p) => `${p.i},${p.j}`;
/** @param {{i: number, j: number}} a @param {{i: number, j: number}} b */
const reach = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
/** Is this panel inside the footprint anchored at `origin`? */
const contains = (p, origin, w, h) =>
  p.i >= origin.i && p.i < origin.i + h && p.j >= origin.j && p.j < origin.j + w;

/**
 * The owner-side writes: the buff effect, the ZON exemption, and the
 * Sustainability bump.
 *
 * @param {object} owner
 * @param {string} platformId
 * @returns {Promise<void>}
 */
async function applyOwnerBuff(owner, platformId) {
  const self = unitSnapshot(owner);
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
  const bonus = resolveTicks(parseTick(SUSTAINABILITY_BONUS), { turnsPerRound });

  await applyWorldIntents(
    [
      // `resolved: true`: this is an unconditional grant from boarding her own
      // platform, not a landed attack -- it must skip the immunity/chance/
      // stacking flow `effect-applier.mjs#applyEffect` runs for everything
      // else, the same way that function's own output does.
      {
        ...I.applyEffect(owner.id, {
          defId: OWNER_BUFF_DEF_ID, magnitude: 0, expiry: null,
          sourceUnitId: platformId, unremovable: true,
        }, platformId),
        resolved: true,
      },
    ],
    "hgob:activate",
  );

  // `zonExempt` and `sustainabilityRemaining` have no rule-element reader
  // (see hgob-owner-buff.yml's own note) and are written directly.
  await owner.update({
    "system.zonExempt": true,
    "system.sustainabilityRemaining": (self.sustainability ?? 0) + bonus,
  });
}

/**
 * @param {object} platform a board unit snapshot (`fgtPlatformDestroyed`'s payload)
 */
async function onPlatformDestroyed(platform) {
  if (!game.users.activeGM?.isSelf) return;
  if (platform?.contentId !== PLATFORM_CONTENT_ID) return;

  const owner = platform.ownerId ? game.actors.get(platform.ownerId) : null;
  if (!owner) return;

  // "its Construction is reduced to 0" -- she may rebuild from scratch.
  const self = unitSnapshot(owner);
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
  const bonus = resolveTicks(parseTick(SUSTAINABILITY_BONUS), { turnsPerRound });

  await owner.update({
    "system.zonExempt": false,
    "system.sustainabilityRemaining": Math.max(0, (self.sustainability ?? 0) - bonus),
    "system.resources.hgobConstruction.value": 0,
  });
}

/**
 * @param {string} contentId
 * @returns {Promise<object|null>}
 */
async function platformFromPacks(contentId) {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === contentId);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}
