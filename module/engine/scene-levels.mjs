/**
 * @file Scene Level operations — creating, deleting and scattering.
 * @see docs/20-platforms-and-levels.md §20.2, §20.9
 *
 * Layer 3. `rules/platforms.mjs` decides *what* happens to a platform and its
 * passengers; this performs the Foundry side of it.
 *
 * Each active platform gets its own **Scene Level** (§20.2's decision), which
 * buys separate occupancy, targeting separation, native visual separation and
 * fog, and boarding as a movement operation — none of which a large token with
 * a flag can provide.
 *
 * **One hard constraint from the v14 schema, and it makes §20.9's step order
 * load-bearing rather than merely tidy.** `TokenDocument#level` is a
 * `DocumentIdField` that is `required` and **non-nullable**, and deleting a
 * `Level` does *not* re-parent the tokens standing on it — `Level._onDeleteOperation`
 * fixes the *view* and nothing else. So a level deleted while passengers are
 * still assigned to it leaves every one of them pointing at an id that no
 * longer resolves. Scatter (§20.9 step 4) must therefore complete **before**
 * the delete (step 8), and `destroyLevel` refuses rather than trusting the
 * caller to have done it.
 */

/** The elevation band each platform level occupies, above the ground. */
const LEVEL_HEIGHT = 10;

/**
 * The elevation band a new platform level should occupy.
 *
 * **Above every band that already exists**, not `count × height`. The old
 * arithmetic assumed the ground level was `LEVEL_HEIGHT` tall; Foundry's
 * default Level is `{bottom: 0, top: 20}` (see `BaseLevel.defineSchema`), so
 * the first platform landed at 10–20 — *inside* the ground band.
 *
 * That is not cosmetic. `Canvas#inferLevelFromElevation` scores a candidate
 * level 0 when the elevation is strictly interior to it, 1 when it sits exactly
 * on the bottom, 2 on the top, and takes the **lowest** score. A passenger
 * placed at elevation 10 therefore scored the ground 0 (interior to 0–20) and
 * the platform 1 (its bottom) — so Foundry inferred every passenger straight
 * back down onto the ground, undoing the assignment `assignLevel` had just
 * made. Measured live: the Hanging Gardens' owner stayed at elevation 0 on the
 * ground level immediately after being moved aboard.
 *
 * Starting at the highest existing `top` also makes the boundary resolve
 * upward, which is what we want: a token at exactly the shared edge scores 2
 * (top) for the level below and 1 (bottom) for the platform, so the platform
 * wins.
 *
 * @param {Array<{elevation?: {top?: number}}>} levels every level already on the scene
 * @param {number} [height]
 * @returns {{bottom: number, top: number}}
 */
export function nextBand(levels, height = LEVEL_HEIGHT) {
  const bottom = (levels ?? []).reduce((max, l) => Math.max(max, l?.elevation?.top ?? 0), 0);
  return { bottom, top: bottom + height };
}

/**
 * The Scene Level a platform lives on, if it has one.
 * @param {object} platform an `FGTActor` of type `platform`
 * @param {object} [scene]
 * @returns {object|null}
 */
export function levelOf(platform, scene = canvas.scene) {
  const id = platform?.system?.levelId ?? null;
  return id ? scene?.levels?.get(id) ?? null : null;
}

/** @param {object} [scene] @returns {object|null} */
export function groundLevel(scene = canvas.scene) {
  return scene?.initialLevel ?? scene?.levels?.contents?.[0] ?? null;
}

/**
 * Create the Scene Level for a platform (§20.9, create).
 *
 * The elevation band is stacked above the ground rather than chosen by the
 * content, because two platforms that picked the same band would have their
 * tokens inferred onto each other by `canvas.inferLevelFromElevation`.
 *
 * `visibility.levels` includes the ground: a player standing on the Hanging
 * Gardens must be able to see the board underneath, and the whole point of the
 * cross-level targeting rule is that the two levels can see each other and
 * mostly cannot reach each other.
 *
 * @param {object} platform
 * @param {object} [scene]
 * @returns {Promise<object|null>} the created Level
 */
export async function createLevel(platform, scene = canvas.scene) {
  if (!scene) return null;
  if (levelOf(platform, scene)) return levelOf(platform, scene);

  // A level this platform already owns but has lost the id of. `system.levelId`
  // and the level's own `flags.fgt.platformId` are two records of one fact, and
  // only the second survives the platform actor being re-created — so without
  // this, re-activating leaves the old level behind and makes a second one.
  const existing = scene.levels.contents.find((l) => l.flags?.fgt?.platformId === platform.id);
  if (existing) {
    await platform.update({ "system.levelId": existing.id });
    return existing;
  }

  // Levels whose platform no longer exists. Nothing else ever removes them:
  // `teardown` runs only from `destroyPlatform`, so a platform actor deleted by
  // hand — or a test run that made one and moved on — strands its level for
  // good. Measured live at **three** orphaned "Hanging Gardens of Babylon"
  // levels on one scene, which is what a GM sees as four sub-scenes.
  await sweepOrphanLevels(scene);

  const ground = groundLevel(scene);
  const used = scene.levels.contents.length;
  const elevation = nextBand(scene.levels.contents);

  const [level] = await scene.createEmbeddedDocuments("Level", [{
    name: platform.name,
    elevation,
    visibility: { levels: ground ? [ground.id] : [] },
    sort: used,
    flags: { fgt: { platformId: platform.id } },
  }]);

  // The ground must see the platform too. `visibility.levels` is one-way per
  // level, so setting only the platform's side leaves the board unable to see
  // what is hovering over it.
  if (ground) {
    await ground.update({ "visibility.levels": [...(ground.visibility?.levels ?? []), level.id] });
  }

  await platform.update({ "system.levelId": level.id });
  return level;
}

/**
 * Delete every platform level whose platform is gone.
 *
 * A level is only ever removed by `teardown`, which runs from
 * `destroyPlatform`. Anything else that ends a platform's life — a GM deleting
 * the actor, a test run, an activation that failed after `createLevel` — leaves
 * the level behind for ever, and the next activation stacks another one on top.
 *
 * Refuses to remove a level that still has tokens on it, for the same schema
 * reason `destroyLevel` does: `TokenDocument#level` is required and
 * non-nullable and Foundry does not re-parent on delete.
 *
 * @param {object} [scene]
 * @returns {Promise<string[]>} the level ids removed
 */
export async function sweepOrphanLevels(scene = canvas.scene) {
  if (!scene) return [];

  const orphans = scene.levels.contents.filter((l) => {
    const platformId = l.flags?.fgt?.platformId ?? null;
    if (!platformId) return false; // not ours; the ground and any GM level
    if (game.actors.get(platformId)) return false; // still alive
    return !(scene.tokens?.contents ?? []).some((t) => t.level === l.id);
  });
  if (orphans.length === 0) return [];

  const ids = orphans.map((l) => l.id);
  const ground = groundLevel(scene);
  if (ground) {
    await ground.update({
      "visibility.levels": (ground.visibility?.levels ?? []).filter((id) => !ids.includes(id)),
    });
  }
  await scene.deleteEmbeddedDocuments("Level", ids);
  return ids;
}

/**
 * Move units onto a platform's level.
 *
 * **The platform's own token is included by the caller** (`activatePlatform`),
 * and that is the fix for the defect this comment exists to record: the token
 * was created before the level and never assigned to it, so the Hanging
 * Gardens flew at elevation 0 on the ground level. Everything downstream reads
 * membership off the level, so a platform standing on the ground made every
 * unit in the scene one of its passengers — measured live at 21 of 21.
 *
 * @param {string[]} unitIds
 * @param {object} platform
 * @param {object} [scene]
 * @returns {Promise<void>}
 */
export async function moveToLevel(unitIds, platform, scene = canvas.scene) {
  const level = levelOf(platform, scene);
  if (!level) return;
  await assignLevel(unitIds, level, scene);
}

/**
 * Scatter passengers down to the ground (§20.9 step 4).
 *
 * Returns the ids it actually moved, so the caller can assert that the level is
 * clear before deleting it. Scattering to a **panel** is the rules layer's job
 * (`rules/platforms.mjs` decides where they land and what damage they take);
 * this only changes which level they are on.
 *
 * @param {object} platform
 * @param {object} [scene]
 * @returns {Promise<string[]>} the token ids moved
 */
export async function scatterToGround(platform, scene = canvas.scene) {
  const level = levelOf(platform, scene);
  const ground = groundLevel(scene);
  if (!level || !ground) return [];

  const aboard = (scene.tokens?.contents ?? []).filter((t) => t.level === level.id);
  if (aboard.length === 0) return [];

  await assignLevel(aboard.map((t) => t.id), ground, scene);
  return aboard.map((t) => t.id);
}

/**
 * Delete a platform's Scene Level (§20.9 step 8).
 *
 * **Refuses while anything is still standing on it.** `TokenDocument#level` is
 * required and non-nullable and Foundry does not re-parent on delete, so a
 * level removed under its passengers leaves them pointing at an id that no
 * longer resolves — a corruption that survives a reload and that nothing on
 * screen explains. Scatter first; this checks rather than trusts.
 *
 * @param {object} platform
 * @param {object} [scene]
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function destroyLevel(platform, scene = canvas.scene) {
  const level = levelOf(platform, scene);
  if (!level) return { ok: true };

  const stranded = (scene.tokens?.contents ?? []).filter((t) => t.level === level.id);
  if (stranded.length > 0) {
    return { ok: false, reason: "passengersAboard", stranded: stranded.map((t) => t.id) };
  }

  // Drop the ground's reference first. A dangling id in `visibility.levels`
  // is harmless today, but it accumulates over a match of repeated HGoB
  // rebuilds and nothing ever cleans it up.
  const ground = groundLevel(scene);
  if (ground) {
    await ground.update({
      "visibility.levels": (ground.visibility?.levels ?? []).filter((id) => id !== level.id),
    });
  }

  await scene.deleteEmbeddedDocuments("Level", [level.id]);
  await platform.update({ "system.levelId": null });
  return { ok: true };
}

/**
 * The whole teardown, in §20.9's order.
 *
 * Sequenced here rather than left to the caller because the order is the rule:
 * scatter before delete (the schema requires it), and reverse the owner's
 * effects before either, while the platform still exists to say what they were.
 *
 * @param {object} platform
 * @param {object} [scene]
 * @returns {Promise<{ok: boolean, scattered: string[], reason?: string}>}
 */
export async function teardown(platform, scene = canvas.scene) {
  await reverseOwnerEffects(platform);
  const scattered = await scatterToGround(platform, scene);
  const deleted = await destroyLevel(platform, scene);

  return { ...deleted, scattered };
}

/**
 * Remove the effects a platform granted its owner (§20.9 step 5).
 *
 * This is why rank-shift effects declare **explicit stat deltas** (Ch. 05
 * §5.6): the reversal has to be subtractable without re-rolling, and a rank
 * shift stored as "one step up" cannot be undone once the underlying rank has
 * changed for another reason.
 *
 * @param {object} platform
 * @returns {Promise<void>}
 */
export async function reverseOwnerEffects(platform) {
  const owner = platform?.system?.ownerId ? game.actors.get(platform.system.ownerId) : null;
  if (!owner) return;

  const granted = owner.effects.filter((e) => e.system?.sourceUnitId === platform.id);
  if (granted.length > 0) {
    await owner.deleteEmbeddedDocuments("ActiveEffect", granted.map((e) => e.id));
  }

  // Step 7: a summon bound to the platform goes with it. Bašmu is the case --
  // "if HGoB is removed from the field while Bašmu is summoned, it disappears."
  const bound = game.actors.filter((a) => a.system?.boundToPlatformId === platform.id);
  for (const summon of bound) {
    const token = summon.getActiveTokens?.()[0];
    if (token) await token.document.delete();
  }
}

/* -------------------------------------------------------------------------- */

/**
 * @param {string[]} tokenIds
 * @param {object} level
 * @param {object} scene
 */
async function assignLevel(tokenIds, level, scene) {
  const updates = tokenIds
    .map((id) => scene.tokens.get(id) ?? tokenOfActor(id, scene))
    .filter(Boolean)
    .map((token) => ({
      _id: token.id,
      level: level.id,
      // Elevation follows the level, because `inferLevelFromElevation` reads it
      // back: a token on the platform's level at the ground's elevation would
      // be inferred back down the next time anything asked.
      elevation: level.elevation?.bottom ?? 0,
    }));

  // `fgtForced`: assigning a level is an engine operation, not a player's Move.
  // Foundry counts `elevation`/`level` among its movement fields, so this
  // arrives at `preMoveToken` as a movement and was refused by our own legality
  // check (`engine/movement-hooks.mjs`). Belt and braces with the level-only
  // test that hook now makes: this says what the operation *is*, that says what
  // it *looks like*, and either alone would be enough.
  if (updates.length > 0) {
    await scene.updateEmbeddedDocuments("Token", updates, { fgtForced: true });
  }
}

/**
 * A unit id may be an actor id rather than a token id, because the rules layer
 * works in units and units are actors.
 * @param {string} actorId
 * @param {object} scene
 * @returns {object|null}
 */
function tokenOfActor(actorId, scene) {
  return (scene.tokens?.contents ?? []).find((t) => t.actorId === actorId) ?? null;
}
