/**
 * @file The war's container roster — which slots exist and what may fill them.
 * @see docs/19-environment.md §19.7, docs/04-units.md §4.2
 *
 * Layer 2 (rules). Pure: it takes the catalogue as an argument and returns the
 * candidates, and the caller rolls. That split is what lets the setup wizard
 * show every draw before committing, with a per-container re-draw — the same
 * reason `prepareSummon` returns a plan rather than an actor.
 *
 * A **container** is the unit of setup. `ServantData.classContainer` has always
 * recorded which container a Servant occupies; nothing recorded that the war
 * HAS containers, which faction owns them, or that one is empty. That last is
 * the case this module exists for: the reference roster holds no Saber at all,
 * so every war built today has a slot the pool cannot fill, and Ch. 29 requires
 * that be shown with its reason rather than silently skipped.
 */

import { SERVANT_CLASSES } from "../domain/enums.mjs";

/**
 * The seven classes a war always has a container for.
 *
 * A slice of `SERVANT_CLASSES` rather than a second list: the enum already
 * orders the seven first and the extras after, and two lists would drift.
 */
export const CORE_CLASSES = Object.freeze(SERVANT_CLASSES.slice(0, 7));

/**
 * The catch-all container.
 *
 * *"Extra classes will all be counted towards the same slot: if you assign a
 * slot for extra, any Servant that is not from the seven regular classes could
 * be summoned."* So this is a **container, not a class** — nothing is ever *of*
 * class `extra`, and no Servant sheet may state it.
 */
export const EXTRA = "extra";

/**
 * @typedef {object} Container
 * @property {string} id
 * @property {string} factionId
 * @property {string} classContainer one of `CORE_CLASSES`, or `EXTRA`
 * @property {"random"|"fixed"} fill
 * @property {string|null} contentId the Servant drawn or chosen
 * @property {string|null} servantId the actor, after commit
 * @property {string|null} masterId the actor, after commit
 * @property {string|null} npChoice Normal's "select NP (a) or (b)"
 */

/**
 * @typedef {object} CatalogueEntry
 * @property {string} contentId
 * @property {string} name
 * @property {string[]} [servantClasses]
 * @property {string} [packId]
 */

/**
 * A blank container.
 *
 * @param {string} factionId
 * @param {string} classContainer
 * @param {number} index
 * @returns {Container}
 */
function blank(factionId, classContainer, index) {
  return {
    id: `${factionId}-${classContainer}-${index}`,
    factionId,
    classContainer,
    fill: "random",
    contentId: null,
    servantId: null,
    masterId: null,
    npChoice: null,
  };
}

/**
 * The default roster: `perFaction` containers for every faction.
 *
 * The first seven are the core classes in rulebook order, which is the order
 * `SERVANT_CLASSES` states them in. Beyond seven, every further container is an
 * `EXTRA` — a GM who wants an eighth slot wants somewhere to put a Ruler, not a
 * second Saber, and the class on the row can be changed either way afterwards.
 *
 * @param {Array<{id: string}>} factions
 * @param {number} [perFaction]
 * @returns {Container[]}
 */
export function defaultContainers(factions, perFaction = CORE_CLASSES.length) {
  /** @type {Container[]} */
  const out = [];
  for (const faction of factions ?? []) {
    for (let i = 0; i < perFaction; i++) {
      out.push(blank(faction.id, CORE_CLASSES[i] ?? EXTRA, i));
    }
  }
  return out;
}

/**
 * Every catalogue entry that may fill this container.
 *
 * A core container matches on class membership, so Semiramis — Caster AND
 * Assassin — is a candidate for either. `EXTRA` matches the complement: any
 * Servant holding NO core class. A Servant with no classes at all is therefore
 * an `EXTRA` candidate, which is the right reading of a sheet that states none.
 *
 * @param {Container} container
 * @param {CatalogueEntry[]} catalogue
 * @param {{policy?: string, taken?: string[]}} [options]
 * @returns {string[]} contentIds, in catalogue order
 */
export function candidatesFor(container, catalogue, { policy = "duplicates", taken = [] } = {}) {
  const wanted = container?.classContainer;
  const excluded = policy === "unique" ? new Set(taken) : new Set();

  return (catalogue ?? [])
    .filter((entry) => {
      if (excluded.has(entry.contentId)) return false;
      const classes = entry.servantClasses ?? [];
      return wanted === EXTRA
        ? !classes.some((c) => CORE_CLASSES.includes(c))
        : classes.includes(wanted);
    })
    .map((entry) => entry.contentId);
}

/**
 * What each random container may be drawn from. The caller rolls.
 *
 * A fixed container produces no line at all — there is nothing to draw and
 * nothing to re-draw. An empty candidate list produces a line **with** a reason
 * rather than no line, because "this container cannot be filled" is a fact the
 * GM needs on screen; a missing line is indistinguishable from a filled one.
 *
 * @param {Container[]} containers
 * @param {CatalogueEntry[]} catalogue
 * @param {{policy?: string, taken?: string[]}} [options]
 * @returns {Array<{containerId: string, candidates: string[], reason: string|null}>}
 */
export function drawPlan(containers, catalogue, { policy = "duplicates", taken = [] } = {}) {
  return (containers ?? [])
    .filter((c) => c?.fill !== "fixed")
    .map((c) => {
      const candidates = candidatesFor(c, catalogue, { policy, taken });
      return {
        containerId: c.id,
        candidates,
        reason: candidates.length === 0 ? "noCandidates" : null,
      };
    });
}

/**
 * Everything wrong with this roster, each with the code to show a reason for.
 *
 * Returns a list rather than throwing on the first problem: a GM fixing a war
 * wants every complaint at once, not one per attempt.
 *
 * @param {Container[]} containers
 * @param {Array<{id: string}>} factions
 * @param {CatalogueEntry[]} catalogue
 * @param {{policy?: string}} [options]
 * @returns {Array<{containerId: string|null, code: string, message: string}>}
 */
export function validateRoster(containers, factions, catalogue, { policy = "duplicates" } = {}) {
  /** @type {Array<{containerId: string|null, code: string, message: string}>} */
  const out = [];
  const rows = containers ?? [];
  const known = new Set((factions ?? []).map((f) => f.id));
  const say = (containerId, code) =>
    out.push({ containerId, code, message: `FGT.Setup.Refusal.${code}` });

  for (const c of rows) {
    if (!known.has(c.factionId)) say(c.id, "unknownFaction");
    if (c.fill === "fixed" && !c.contentId) say(c.id, "noFixedChoice");
    if (c.fill !== "fixed" && candidatesFor(c, catalogue, { policy }).length === 0) {
      say(c.id, "noCandidates");
    }
    // "The unselected Noble Phantasm is unusable" only means something once one
    // IS selected (Ch. 15). A Servant offering the choice and given none would
    // reach the table with both usable, which is a Servant nobody agreed to.
    if ((c.npOptions ?? []).length > 0 && !c.npChoice) say(c.id, "noNPChoice");
  }

  // A faction with no containers has no Servants, which is not a war -- and it
  // is the failure a GM is most likely to carry to the Confirm tab without
  // noticing, because an empty list looks like a list that has not loaded.
  for (const faction of factions ?? []) {
    if (!rows.some((c) => c.factionId === faction.id)) {
      say(null, "emptyFaction");
    }
  }

  if (policy === "unique") {
    const seen = new Set();
    for (const c of rows) {
      if (!c.contentId) continue;
      if (seen.has(c.contentId)) say(c.id, "duplicateDraw");
      seen.add(c.contentId);
    }
  }

  return out;
}
