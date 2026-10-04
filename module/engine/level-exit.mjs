/**
 * @file Where a client goes when the Level it views is deleted (#176).
 * @see docs/27-platforms-and-levels.md, module/engine/scene-levels.mjs
 *
 * Layer 3, on every client. A platform ending, a pocket dimension closing and a
 * collapse all delete a Scene Level. A client viewing that Level was left on no
 * scene at all: `canvas.scene` null, `canvas.ready` false, and every canvas read
 * after it threw. Foundry's own `Level._onDeleteOperation` views the scene's
 * initial Level, but the ground's `visibility.levels` write just before the
 * delete had started a redraw, and the view landed in the middle of it.
 *
 * Ruled 2026-10-02 (#176): each client viewing it goes to the Level its selected
 * token lands on, or to the ground with no token selected. `scene-levels.mjs`
 * now deletes before it writes the ground, so the redraw cannot race the view;
 * this is the other half, and the net for a canvas that still comes up empty.
 */

/**
 * Which Level to view after these Levels go, or `null` to stay.
 *
 * @param {object} args
 * @param {Set<string>} args.deletedIds
 * @param {string|null} args.viewedId the Level this client was viewing
 * @param {string|null} args.tokenLevelId the Level its selected token now stands on
 * @param {string[]} args.levelIds the scene's Levels after the delete
 * @param {string|null} args.groundId
 * @returns {string|null}
 */
export function exitLevelFor({ deletedIds, viewedId, tokenLevelId, levelIds, groundId }) {
  if (!viewedId || !deletedIds.has(viewedId)) return null;
  if (tokenLevelId && levelIds.includes(tokenLevelId)) return tokenLevelId;
  return groundId ?? levelIds[0] ?? null;
}

const state = { viewed: null, selected: null };

export const LevelExit = {
  /** Register the hooks. Idempotent per client. */
  attach() {
    // Remembered rather than read at the delete: by the time `deleteLevel`
    // fires the canvas may already be torn down, and its level and its
    // controlled tokens with it.
    Hooks.on("canvasReady", () => { state.viewed = canvas.level?.id ?? null; });
    Hooks.on("controlToken", (token, controlled) => {
      if (controlled) state.selected = token.document?.id ?? null;
      else if (state.selected === token.document?.id) state.selected = null;
    });
    Hooks.on("deleteLevel", (level) => { void leave(level); });
  },
};

/**
 * @param {object} level the deleted Level
 * @returns {Promise<void>}
 */
async function leave(level) {
  const scene = level?.parent;
  if (!scene) return;
  const viewedId = canvas.level?.id ?? state.viewed;
  const target = exitLevelFor({
    deletedIds: new Set([level.id]),
    viewedId,
    tokenLevelId: state.selected ? scene.tokens.get(state.selected)?.level ?? null : null,
    levelIds: scene.levels.map((l) => l.id),
    groundId: scene.initialLevel?.id ?? null,
  });
  if (!target) return;

  // Let Foundry's own move, and any redraw in flight, finish first. A token's
  // landing is written after the Level goes, so its Level is read again then.
  await settle();
  const landed = state.selected ? scene.tokens.get(state.selected)?.level ?? null : null;
  const goTo = landed && scene.levels.has(landed) ? landed : target;
  if (canvas.scene?.id === scene.id && canvas.ready && canvas.level?.id === goTo) return;
  await scene.view({ level: goTo });
}

/** Wait, briefly, for the canvas to stop drawing. */
async function settle() {
  for (let n = 0; n < 20; n += 1) {
    await new Promise((r) => setTimeout(r, 150));
    if (!canvas.loading) return;
  }
}
