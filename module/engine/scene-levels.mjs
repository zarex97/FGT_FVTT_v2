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

  const ground = groundLevel(scene);
  const used = scene.levels.contents.length;
  const bottom = used * LEVEL_HEIGHT;

  const [level] = await scene.createEmbeddedDocuments("Level", [{
    name: platform.name,
    elevation: { bottom, top: bottom + LEVEL_HEIGHT },
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
 * Move units onto a platform's level.
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

  if (updates.length > 0) await scene.updateEmbeddedDocuments("Token", updates);
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
