/**
 * @file A Master Essence, carried by its Master's Servant (#241).
 * @see docs/31-war-setup-and-summoning.md, docs/32-relationships.md
 *
 * Layer 3. *"The Master Essences impart different enhancements on their
 * respective Servants"* (`docs/Master Essences.md`). The Master holds the
 * Essence; the Servant holds a **copy** of it, marked `grantedBy` with the
 * Master's id, and the copy is what every reader sees: its `MaxDelta` moves the
 * sheet's maxima, its `DamageModifier` and `CritModifier` reach the pipeline,
 * its `NpGateShift` the Noble Phantasm gate. No reader learns where a passive
 * came from, which is the point: an Essence is a passive of its Servant's,
 * like a Class Skill (#241 reading 7).
 *
 * The copy is the CONTRACT's (reading 5): it follows the Servant's Master, and
 * it is gone the moment that Master is defeated (reading 3). One door, so every
 * path that changes either reaches it: a hook on `system.masterId` and
 * `system.defeated`, whatever wrote them -- war setup, a Contract, a Conquest,
 * Rule Breaker, a Master's death.
 *
 * Losing a maximum cuts the current value to it and no lower; gaining one
 * mid-war raises the maximum only (reading 6). The summon is the one moment a
 * Servant starts full, and war setup asks for that with `fill`.
 */

import { limitsFor } from "../rules/master-essence.mjs";

const STATS = Object.freeze(["health", "agility", "luck"]);

/**
 * A Master's own Essences: never a copy it holds as somebody's Servant.
 *
 * @param {Actor|null|undefined} actor
 * @returns {Item[]}
 */
export function ownEssences(actor) {
  return [...(actor?.items ?? [])].filter((i) => i.type === "masterEssence" && !i.system?.grantedBy);
}

/**
 * The copies a Servant should hold right now: its Master's Essences, while
 * that Master stands.
 *
 * @param {Actor} servant
 * @returns {{master: Actor|null, wanted: Item[]}}
 */
export function wantedEssences(servant) {
  const masterId = servant?.system?.masterId ?? null;
  const master = masterId ? game.actors.get(masterId) : null;
  if (!master || master.system?.defeated) return { master: null, wanted: [] };
  return { master, wanted: ownEssences(master) };
}

/** One sync at a time per Servant: a hook burst must not create a copy twice. */
const RUNNING = new Map();

/**
 * Bring a Servant's Essence copies in line with its Contract.
 *
 * Serialized per Servant (Check-then-act race): commit, the `masterId` write
 * and the Essence's own creation each fire this, and two concurrent runs would
 * each see no copy and each create one.
 *
 * @param {Actor} servant
 * @param {{fill?: boolean}} [options] `fill`: start the Servant full, the summon's rule
 * @returns {Promise<{added: string[], removed: string[]}>}
 */
export function syncEssences(servant, { fill = false } = {}) {
  if (!servant || servant.type !== "servant") return Promise.resolve({ added: [], removed: [] });
  const prior = RUNNING.get(servant.id) ?? Promise.resolve();
  const next = prior.catch(() => {}).then(() => runSync(servant, { fill }));
  RUNNING.set(servant.id, next);
  next.finally(() => { if (RUNNING.get(servant.id) === next) RUNNING.delete(servant.id); });
  return next;
}

/**
 * @param {Actor} servant
 * @param {{fill: boolean}} options
 * @returns {Promise<{added: string[], removed: string[]}>}
 */
async function runSync(servant, { fill }) {
  const { master, wanted } = wantedEssences(servant);
  const key = (masterId, contentId) => `${masterId}|${contentId}`;
  const want = new Map(wanted.map((e) => [key(master.id, e.system?.contentId || e.id), e]));
  const held = [...servant.items].filter((i) => i.type === "masterEssence" && i.system?.grantedBy);

  const removed = held.filter((c) => !want.has(key(c.system.grantedBy, c.system?.contentId || c.id)));
  const keep = new Set(held.filter((c) => !removed.includes(c))
    .map((c) => key(c.system.grantedBy, c.system?.contentId || c.id)));
  const added = [...want.entries()].filter(([k]) => !keep.has(k)).map(([, e]) => e);

  if (removed.length > 0) await servant.deleteEmbeddedDocuments("Item", removed.map((c) => c.id));
  if (added.length > 0) await servant.createEmbeddedDocuments("Item", added.map((e) => copyOf(e, master.id)));

  // The current values against the maxima the copies just moved. The STORED
  // current: the derived one is already capped for display
  // (`rules/derived.mjs`), and a store left above the new maximum would hand
  // the old value back the moment an Essence was regained.
  const patch = {};
  const was = Object.fromEntries(STATS.map((s) => [s, servant._source?.system?.[s]?.value]));
  for (const stat of STATS) {
    const max = servant.system?.[stat]?.max;
    const stored = servant._source?.system?.[stat]?.value;
    if (typeof max !== "number") continue;
    if (fill) patch[`system.${stat}.value`] = max;
    else if (typeof stored === "number" && stored > max) patch[`system.${stat}.value`] = max;
  }
  if (Object.keys(patch).length > 0) await servant.update(patch);

  // Said, to whoever controls the Servant (Producer without consumer): an
  // Essence gained or lost moves maxima nobody would otherwise notice moved.
  // Not at the summon, which is the war being built.
  if (!fill && (added.length > 0 || removed.length > 0)) {
    await tellOwners(servant, { added, removed, cut: STATS.filter((s) => patch[`system.${s}.value`] !== undefined)
      .map((s) => `${s[0].toUpperCase()}${s.slice(1)} ${was[s]} → ${patch[`system.${s}.value`]}`) });
  }

  return { added: added.map((e) => e.name), removed: removed.map((c) => c.name) };
}

/**
 * A line to the Servant's owners and the GM: which Essence it gained or lost,
 * and what the loss cut. Whispered: an Essence is its Master's own business,
 * and a Servant's name its public identity's (Ch. 30).
 *
 * @param {Actor} servant
 * @param {{added: Item[], removed: Item[], cut: string[]}} change
 * @returns {Promise<void>}
 */
async function tellOwners(servant, { added, removed, cut }) {
  const escape = foundry.utils.escapeHTML;
  const { shownName } = await import("./public-identity.mjs");
  const { currentBoard } = await import("./board.mjs");
  const who = escape(shownName(servant, currentBoard()));
  const rows = [
    ...removed.map((c) => game.i18n.format("FGT.MasterEssence.Lost", { servant: who, name: escape(c.name) })),
    ...added.map((e) => game.i18n.format("FGT.MasterEssence.Gained", { servant: who, name: escape(e.name) })),
    ...cut.map(escape),
  ];
  const owners = game.users.filter((u) => u.isGM || servant.testUserPermission(u, "OWNER")).map((u) => u.id);
  await ChatMessage.create({
    content: `<div class="fgt-card fgt-card--command-spell"><ul>${rows.map((r) => `<li>${r}</li>`).join("")}</ul></div>`,
    whisper: owners,
  });
}

/**
 * The Servant's copy of an Essence: its passive rules, none of its use.
 *
 * The one use is the Master's (*"Player decides when it's used"*), so the copy
 * carries no `effect` for any offer to find.
 *
 * @param {Item} essence
 * @param {string} masterId
 * @returns {object}
 */
function copyOf(essence, masterId) {
  const data = essence.toObject();
  delete data._id;
  data.system = {
    ...data.system,
    grantedBy: masterId, timesUsed: 0, maxUses: null, timing: null, requirements: [], effect: [],
  };
  return data;
}

/**
 * Every Servant a Master holds, by the reciprocal link `masterId`.
 * @param {Actor} master
 * @returns {Actor[]}
 */
function servantsOf(master) {
  return game.actors.filter((a) => a.type === "servant" && a.system?.masterId === master.id);
}

/** The listeners: the one door every Contract and every Master's death passes. */
export const MasterEssences = {
  attach() {
    const run = (servant) => syncEssences(servant)
      .catch((err) => console.error("FGT | Master Essence sync:", err));
    const gm = () => Boolean(game.users?.activeGM?.isSelf);

    Hooks.on("updateActor", (actor, changes) => {
      if (!gm()) return;
      const sys = changes?.system ?? {};
      if (actor.type === "servant" && ("masterId" in sys || "contract" in sys)) run(actor);
      if (actor.type !== "servant" && "defeated" in sys) servantsOf(actor).forEach(run);
    });
    for (const hook of ["createItem", "deleteItem"]) {
      Hooks.on(hook, (item) => {
        if (!gm() || item.type !== "masterEssence" || item.system?.grantedBy) return;
        if (item.parent?.documentName !== "Actor") return;
        servantsOf(item.parent).forEach(run);
      });
    }
  },
};

/**
 * Every Master Essence in the pack, for the setup wizard's picker.
 *
 * @returns {Promise<Array<{contentId: string, name: string, rank: string, id: string}>>}
 */
export async function essenceCatalogue() {
  const pack = game.packs.get("fgt.master-essences");
  if (!pack) return [];
  const index = await pack.getIndex({ fields: ["system.contentId", "system.rank"] });
  return [...index]
    .map((e) => ({ id: e._id, contentId: e.system?.contentId ?? e._id, name: e.name, rank: e.system?.rank ?? "" }))
    // fgt-name-ok: an Essence's name, never a Unit's
    .sort((a, b) => (a.rank + a.name).localeCompare(b.rank + b.name));
}

/**
 * The Essence half of `validateRoster`'s options, or `null` when this war is
 * not drafting Essences: the `masterMode` setting is `essences` and the war is
 * Advanced (a Normal table has the coin or no ranks, `setup-rolls-normal.mjs`).
 *
 * @param {object} draft
 * @param {Array<{contentId: string, rank: string}>} catalogue
 * @returns {{ranks: Map<string, string>, limits: Record<string, number>}|null}
 */
export function essenceDraftOptions(draft, catalogue) {
  if (!draftsEssences(draft)) return null;
  return {
    ranks: new Map((catalogue ?? []).map((e) => [e.contentId, e.rank])),
    limits: limitsFor(draft.warType, draft.essenceLimits ?? null),
  };
}

/**
 * Does this war draft Master Essences?
 * @param {object} draft
 * @returns {boolean}
 */
export function draftsEssences(draft) {
  const mode = game.settings.get("fgt", "masterMode") ?? "essences";
  return mode === "essences" && (draft?.ruleset ?? "advanced") === "advanced";
}

/**
 * One Master Essence from the pack, by content id.
 * @param {string} contentId
 * @returns {Promise<Item|null>}
 */
export async function essenceDocument(contentId) {
  const pack = game.packs.get("fgt.master-essences");
  if (!pack || !contentId) return null;
  const index = await pack.getIndex({ fields: ["system.contentId"] });
  const entry = [...index].find((e) => (e.system?.contentId ?? e._id) === contentId);
  return entry ? pack.getDocument(entry._id) : null;
}
