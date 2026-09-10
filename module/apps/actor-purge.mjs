/**
 * @file Deleting actors, and the tokens Foundry leaves behind them.
 * @see docs/29-user-interface.md §29.13
 *
 * Layer 4. Every decision about *what goes with what* is `rules/purge.mjs`;
 * this gathers the world into that shape, renders the plan, and performs it.
 *
 * **Why this exists.** `Actor._onDelete` (`client/documents/actor.mjs`) removes
 * the actor's ActiveEffects and nothing else. Delete a Servant from the sidebar
 * and its tokens stay in every scene, pointing at an id that no longer
 * resolves — and the sidebar shows you none of them, so the only way to find
 * out is to open each scene and look. Clearing a world by hand is therefore
 * dozens of deletions across two sidebars with no way to check you are done.
 *
 * The reference cleanup is the other half. A Servant's `masterId`, a Master's
 * `servantIds`, a summon's `summonerId`, a platform's `ownerId` and the match's
 * own container roster all name actors by id, and Foundry maintains none of
 * them across a delete.
 */

import { filterCandidates, purgePlan, danglingReferences, NO_SCENE } from "../rules/purge.mjs";
import { factions as rosterFactions } from "../engine/board.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class ActorPurge extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-actor-purge",
    classes: ["fgt", "actor-purge"],
    tag: "form",
    position: { width: 720, height: 660 },
    window: { title: "FGT.Purge.Title", resizable: true },
    form: { handler: ActorPurge.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      selectAll: ActorPurge.#onSelectAll,
      selectNone: ActorPurge.#onSelectNone,
      clearFilters: ActorPurge.#onClear,
      purge: ActorPurge.#onPurge,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/actor-purge.hbs", scrollable: [".fgt-purge__list"] },
  };

  /** @type {{search?: string, type?: string, factionId?: string, sceneId?: string}} */
  #filter = {};

  /** @type {"actors"|"tokens"} */
  #mode = "actors";

  /**
   * Selection survives a filter change.
   *
   * Held here rather than read off the checkboxes, because the checkboxes only
   * exist for the rows the filter is currently showing — so reading the form
   * alone would silently drop everything the GM picked before narrowing. The
   * footer says how many of the selection are hidden, which is the honest way
   * to carry it: the count a GM approves must include the rows they cannot see.
   *
   * @type {Set<string>}
   */
  #selected = new Set();

  /** The ids the last render put on screen. @type {string[]} */
  #rendered = [];

  /** @returns {ActorPurge} */
  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FGT.Purge.GMOnly"));
      return null;
    }
    const app = new ActorPurge();
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const candidates = gatherCandidates();
    const shown = filterCandidates(candidates, this.#filter);
    this.#rendered = shown.map((c) => c.id);

    const plan = purgePlan(candidates, {
      mode: this.#mode,
      selectedIds: [...this.#selected],
      sceneId: this.#filter.sceneId ?? null,
    });

    const visible = new Set(this.#rendered);
    const hidden = [...this.#selected].filter((id) => !visible.has(id)).length;

    return {
      filter: this.#filter,
      mode: this.#mode,
      isTokenMode: this.#mode === "tokens",
      types: [...new Set(candidates.map((c) => c.type))].sort(),
      factions: rosterFactions().map((f) => ({ id: f.id, name: f.name })),
      scenes: game.scenes.map((s) => ({ id: s.id, name: s.name })),
      noSceneValue: NO_SCENE,

      rows: shown.map((c) => ({
        ...c,
        selected: this.#selected.has(c.id),
        where: c.placements.length === 0
          ? game.i18n.localize("FGT.Purge.Nowhere")
          : c.placements.map((p) => `${p.sceneName} × ${p.tokenIds.length}`).join(", "),
        tokenCount: c.placements.reduce((n, p) => n + p.tokenIds.length, 0),
      })),

      total: candidates.length,
      // A filter that hides everything says so, rather than showing an empty
      // list that reads as "this world has no actors".
      filteredToNothing: candidates.length > 0 && shown.length === 0,
      selectedCount: this.#selected.size,
      hiddenCount: hidden,

      plan,
      // The sentence the GM approves, built from the SAME plan the delete
      // performs -- so the promise and the deletion cannot disagree.
      summary: summarize(plan),
      canPurge: plan.refusal === null,
      refusal: plan.refusal ? `FGT.Purge.Refusal.${plan.refusal}` : null,
    };
  }

  /**
   * @this {ActorPurge}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onChange(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    this.#filter = {
      search: data.search || undefined,
      type: data.type || undefined,
      factionId: data.factionId || undefined,
      sceneId: data.sceneId || undefined,
    };
    this.#mode = data.mode === "tokens" ? "tokens" : "actors";

    // Only the rows that were on screen have an opinion. Merging rather than
    // replacing is what lets a selection survive the filter that hides it.
    const checked = data.select ?? {};
    for (const id of this.#rendered) {
      if (checked[id]) this.#selected.add(id);
      else this.#selected.delete(id);
    }
    this.render();
  }

  /**
   * Select every row the filter is currently showing — not every actor.
   *
   * "All" means what is in front of you. A button that also picked up rows a
   * filter had deliberately hidden would be the single most dangerous control
   * in this dialog.
   *
   * @this {ActorPurge}
   */
  static #onSelectAll() {
    for (const id of this.#rendered) this.#selected.add(id);
    this.render();
  }

  /** @this {ActorPurge} */
  static #onSelectNone() {
    this.#selected.clear();
    this.render();
  }

  /** @this {ActorPurge} */
  static #onClear() {
    this.#filter = {};
    this.render();
  }

  /**
   * Confirm, then perform the plan.
   *
   * Order is load-bearing: **tokens, then references, then actors.** Tokens
   * first so no scene renders a token whose actor has gone; references before
   * the actors they point at, so there is never a moment where a surviving
   * document names a deleted one.
   *
   * @this {ActorPurge}
   */
  static async #onPurge() {
    const candidates = gatherCandidates();
    // Re-planned from the world as it stands NOW, not from the render. A
    // dialog left open while actors were deleted elsewhere would otherwise
    // delete against a list that no longer exists.
    const plan = purgePlan(candidates, {
      mode: this.#mode,
      selectedIds: [...this.#selected],
      sceneId: this.#filter.sceneId ?? null,
    });
    if (plan.refusal) {
      ui.notifications.warn(game.i18n.localize(`FGT.Purge.Refusal.${plan.refusal}`));
      return;
    }

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("FGT.Purge.ConfirmTitle") },
      content: `<p>${summarize(plan)}</p>`
        + `<p class="notification warning">${game.i18n.localize("FGT.Purge.ConfirmWarning")}</p>`,
      yes: { label: game.i18n.localize("FGT.Purge.ConfirmYes"), icon: "fa-solid fa-trash" },
      no: { default: true },
    });
    if (!confirmed) return;

    let removedTokens = 0;
    for (const entry of plan.scenes) {
      const scene = game.scenes.get(entry.sceneId);
      if (!scene) continue;
      // Filtered against what the scene actually holds: a token deleted from
      // under us makes `deleteEmbeddedDocuments` throw and take the rest of
      // the sweep with it.
      const ids = entry.tokenIds.filter((id) => scene.tokens.has(id));
      if (ids.length === 0) continue;
      await scene.deleteEmbeddedDocuments("Token", ids);
      removedTokens += ids.length;
    }

    if (plan.actorIds.length > 0) {
      await repairReferences(plan.actorIds);
      await Actor.deleteDocuments(plan.actorIds);
    }

    ui.notifications.info(game.i18n.format("FGT.Purge.Done", {
      actors: plan.actorIds.length, tokens: removedTokens,
    }));
    this.#selected.clear();
    this.render();
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Every world actor, with where its tokens stand.
 *
 * Walks the scenes rather than calling `Actor#getActiveTokens`, which only
 * reaches the **current** scene's canvas — and the tokens this tool exists to
 * find are precisely the ones in the scenes nobody is looking at.
 *
 * @returns {import("../rules/purge.mjs").PurgeCandidate[]}
 */
function gatherCandidates() {
  /** @type {Map<string, Array<{sceneId: string, sceneName: string, tokenIds: string[]}>>} */
  const byActor = new Map();

  for (const scene of game.scenes) {
    /** @type {Map<string, string[]>} */
    const here = new Map();
    for (const token of scene.tokens) {
      if (!token.actorId) continue;
      here.set(token.actorId, [...(here.get(token.actorId) ?? []), token.id]);
    }
    for (const [actorId, tokenIds] of here) {
      byActor.set(actorId, [
        ...(byActor.get(actorId) ?? []),
        { sceneId: scene.id, sceneName: scene.name, tokenIds },
      ]);
    }
  }

  return game.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    type: actor.type,
    img: actor.img,
    factionId: actor.system?.factionId ?? null,
    placements: byActor.get(actor.id) ?? [],
  }));
}

/**
 * Clear every reference the survivors hold to the actors about to go.
 *
 * @param {string[]} deletedIds
 * @returns {Promise<void>}
 */
async function repairReferences(deletedIds) {
  const combat = game.combats?.active ?? null;
  const fixes = danglingReferences(
    game.actors.map((a) => ({ id: a.id, type: a.type, system: a.system })),
    deletedIds,
    { containers: combat?.system?.containers ?? null },
  );
  if (fixes.length === 0) return;

  const actorUpdates = fixes
    .filter((f) => f.actorId)
    .map((f) => ({ _id: f.actorId, ...f.changes }));
  if (actorUpdates.length > 0) await Actor.updateDocuments(actorUpdates);

  const matchFix = fixes.find((f) => f.match);
  if (matchFix && combat) await combat.update(matchFix.changes);
}

/**
 * What the plan will do, as one sentence.
 *
 * @param {object} plan
 * @returns {string}
 */
function summarize(plan) {
  if (plan.refusal) return game.i18n.localize(`FGT.Purge.Refusal.${plan.refusal}`);
  if (plan.mode === "tokens") {
    return game.i18n.format("FGT.Purge.SummaryTokens", {
      tokens: plan.counts.tokens, scene: plan.scenes[0]?.sceneName ?? "",
    });
  }
  return game.i18n.format("FGT.Purge.SummaryActors", {
    actors: plan.counts.actors, tokens: plan.counts.tokens, scenes: plan.counts.scenes,
  });
}
