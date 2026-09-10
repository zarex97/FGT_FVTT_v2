/**
 * @file Choosing actors and their tokens for deletion.
 * @see docs/29-user-interface.md §29.13
 *
 * Layer 2 (rules). Pure — it takes plain shapes and returns a plan, and the
 * dialog in `apps/actor-purge.mjs` performs it.
 *
 * **Why the arithmetic is not in the dialog.** Foundry does not clean up after
 * a deleted Actor: `Actor._onDelete` (`client/documents/actor.mjs`) removes its
 * ActiveEffects and nothing else, so every token of that actor stays in its
 * scene pointing at an id that no longer resolves. Which tokens go with which
 * actor, which references survive them, and what the confirm dialog is allowed
 * to promise are therefore *rules*, and rules that a delete button computes
 * inline are rules nobody can test.
 *
 * The plan is also what the confirmation reads from, so the sentence a GM
 * approves and the documents that are deleted cannot disagree.
 */

/**
 * A world Actor, as the purge tool sees it.
 *
 * @typedef {object} PurgeCandidate
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string|null} factionId
 * @property {string} [img]
 * @property {Array<{sceneId: string, sceneName: string, tokenIds: string[]}>} placements
 *   where this actor's tokens stand, one entry per scene that holds any
 */

/**
 * @typedef {object} PurgeFilter
 * @property {string} [search] matched anywhere in the name, case-insensitively
 * @property {string} [type]
 * @property {string} [factionId]
 * @property {string} [sceneId] a scene id, or `NO_SCENE` for "placed nowhere"
 */

/**
 * The scene filter that cannot be expressed by naming a scene: actors standing
 * in none of them. The sweepable ones — left over from a test, or from a setup
 * that got half way — and the hardest to find by hand, because no scene shows
 * them.
 */
export const NO_SCENE = "__none__";

/**
 * The candidates one filter admits, in the order given.
 *
 * Every clause given is intersected. An absent clause is not a clause: an
 * empty search box must not filter everything out, which is the failure mode
 * of testing `filter.search !== undefined`.
 *
 * @param {PurgeCandidate[]} candidates
 * @param {PurgeFilter} [filter]
 * @returns {PurgeCandidate[]}
 */
export function filterCandidates(candidates, filter = {}) {
  const search = String(filter.search ?? "").trim().toLowerCase();

  return (candidates ?? []).filter((c) => {
    if (search && !String(c.name ?? "").toLowerCase().includes(search)) return false;
    if (filter.type && c.type !== filter.type) return false;
    // `!=` on purpose is NOT wanted here: a filter of `null` is "no filter",
    // and a candidate's own `factionId` of `null` is "no faction". Only an
    // explicitly chosen faction narrows.
    if (filter.factionId && (c.factionId ?? null) !== filter.factionId) return false;

    if (filter.sceneId === NO_SCENE) return placementsOf(c).length === 0;
    if (filter.sceneId) return placementsOf(c).some((p) => p.sceneId === filter.sceneId);
    return true;
  });
}

/**
 * What a deletion would take, and why it would refuse.
 *
 * Two modes, because the scene picker means two different things and guessing
 * which is how a GM clears a board they meant to filter:
 *
 *   - `"actors"` — the selected actors **and every token of theirs, in every
 *     scene**. The scene filter narrowed what was *shown*; it does not scope
 *     the delete, because a token left behind in a scene nobody was looking at
 *     is exactly the orphan this tool exists to prevent.
 *   - `"tokens"` — only those actors' tokens **in the named scene**. The actors
 *     survive. A scene is required: "remove tokens" with none chosen would
 *     otherwise read as every scene.
 *
 * @param {PurgeCandidate[]} candidates
 * @param {object} args
 * @param {"actors"|"tokens"} args.mode
 * @param {string[]} args.selectedIds
 * @param {string|null} [args.sceneId]
 * @returns {{mode: string, actorIds: string[],
 *            scenes: Array<{sceneId: string, sceneName: string, tokenIds: string[]}>,
 *            counts: {actors: number, tokens: number, scenes: number},
 *            refusal: string|null}}
 */
export function purgePlan(candidates, { mode = "actors", selectedIds = [], sceneId = null } = {}) {
  const wanted = new Set(selectedIds ?? []);
  // Driven by the candidate list, not by the id list: a selection that has
  // gone stale between the render and the click (the actor was deleted in
  // another window) must drop out rather than be planned against.
  const chosen = (candidates ?? []).filter((c) => wanted.has(c.id));

  const empty = { mode, actorIds: [], scenes: [], counts: { actors: 0, tokens: 0, scenes: 0 } };
  if (chosen.length === 0) return { ...empty, refusal: "nothingSelected" };

  const scoped = mode === "tokens" ? sceneId : null;
  if (mode === "tokens" && (!scoped || scoped === NO_SCENE)) return { ...empty, refusal: "noScene" };

  const scenes = groupPlacements(chosen, scoped);
  if (mode === "tokens" && scenes.length === 0) return { ...empty, refusal: "nothingToRemove" };

  const actorIds = mode === "actors" ? chosen.map((c) => c.id) : [];
  return {
    mode,
    actorIds,
    scenes,
    counts: {
      actors: actorIds.length,
      tokens: scenes.reduce((n, s) => n + s.tokenIds.length, 0),
      scenes: scenes.length,
    },
    refusal: null,
  };
}

/**
 * The writes that keep the survivors from pointing at the dead.
 *
 * Four fields refer to another actor by id, and none of them is maintained by
 * Foundry when the target goes: a Servant's `masterId`, a Master's
 * `servantIds`, a summon's `summonerId` and a platform's `ownerId`. A fifth
 * lives on the match — `MatchData.containers` records the `servantId` and
 * `masterId` of every war slot (`engine/war-setup.mjs`), so a roster naming
 * deleted actors describes containers that cannot be opened.
 *
 * **The actors being deleted are never given fixes.** `medea` may point at
 * `kotomine` while both are going; writing to a document that is about to be
 * deleted is wasted work at best and a failed update at worst.
 *
 * One entry per document, however many of its fields dangle, so the caller
 * performs one update rather than one per field.
 *
 * @param {Array<{id: string, type?: string, system?: object}>} actors every world actor
 * @param {string[]} deletedIds
 * @param {object} [match]
 * @param {object[]} [match.containers] `MatchData.containers`, if there is a match
 * @returns {Array<{actorId?: string, match?: boolean, changes: object}>}
 */
export function danglingReferences(actors, deletedIds, { containers = null } = {}) {
  const gone = new Set(deletedIds ?? []);
  /** @type {Array<{actorId?: string, match?: boolean, changes: object}>} */
  const out = [];

  for (const actor of actors ?? []) {
    if (gone.has(actor.id)) continue;
    const sys = actor.system ?? {};
    /** @type {Record<string, unknown>} */
    const changes = {};

    for (const key of ["masterId", "summonerId", "ownerId"]) {
      if (sys[key] && gone.has(sys[key])) changes[`system.${key}`] = null;
    }

    // A Set on the schema, an array here: the survivor keeps the ids that
    // still resolve rather than being emptied.
    const servantIds = [...(sys.servantIds ?? [])];
    if (servantIds.some((id) => gone.has(id))) {
      changes["system.servantIds"] = servantIds.filter((id) => !gone.has(id));
    }

    if (Object.keys(changes).length > 0) out.push({ actorId: actor.id, changes });
  }

  const slots = containersWithout(containers, gone);
  if (slots) out.push({ match: true, changes: { "system.containers": slots } });

  return out;
}

/* -------------------------------------------------------------------------- */

/**
 * @param {PurgeCandidate} candidate
 * @returns {Array<{sceneId: string, sceneName: string, tokenIds: string[]}>}
 */
function placementsOf(candidate) {
  return (candidate?.placements ?? []).filter((p) => (p?.tokenIds ?? []).length > 0);
}

/**
 * Every chosen actor's tokens, gathered by scene.
 *
 * Scene order follows first appearance among the chosen actors rather than
 * anything sorted: the confirmation lists scenes in this order, and a list
 * that reshuffles between renders is one a GM stops reading.
 *
 * @param {PurgeCandidate[]} chosen
 * @param {string|null} onlyScene
 * @returns {Array<{sceneId: string, sceneName: string, tokenIds: string[]}>}
 */
function groupPlacements(chosen, onlyScene) {
  /** @type {Map<string, {sceneId: string, sceneName: string, tokenIds: string[]}>} */
  const byScene = new Map();

  for (const candidate of chosen) {
    for (const placement of placementsOf(candidate)) {
      if (onlyScene && placement.sceneId !== onlyScene) continue;
      const entry = byScene.get(placement.sceneId)
        ?? { sceneId: placement.sceneId, sceneName: placement.sceneName, tokenIds: [] };
      entry.tokenIds.push(...placement.tokenIds);
      byScene.set(placement.sceneId, entry);
    }
  }
  return [...byScene.values()];
}

/**
 * The war roster with every deleted actor's slot id cleared, or `null` when no
 * slot names one — so an untouched roster is never rewritten.
 *
 * @param {object[]|null} containers
 * @param {Set<string>} gone
 * @returns {object[]|null}
 */
function containersWithout(containers, gone) {
  if (!containers?.length) return null;

  let touched = false;
  const next = containers.map((c) => {
    const slot = { ...c };
    for (const key of ["servantId", "masterId"]) {
      if (slot[key] && gone.has(slot[key])) {
        slot[key] = null;
        touched = true;
      }
    }
    return slot;
  });
  return touched ? next : null;
}
