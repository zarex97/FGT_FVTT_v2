/**
 * @file What each viewer is shown on a chat card.
 * @see docs/26-authority-and-sockets.md §26.7, §26.6
 *
 * Layer 2 (rules). Pure — takes a result and a viewer, returns the card that
 * viewer should see.
 *
 * This is the part of closed-information play that is worth building. §26.6
 * assesses the shadow-actor pattern honestly and **defers** it: hiding part of
 * a document is something Foundry cannot do, and the workaround doubles the
 * document count for a failure mode that leaks the wrong thing. But the
 * rulebook's actual information rules — a player learns *that* a skill was
 * used, and learns the effects applied to *their own* units — live at the card,
 * and cover most of the practical benefit at a fraction of the cost.
 *
 * The redaction is **by side**, not by name. A row nobody claimed is a fact
 * about the board (a facing bonus, terrain) and stays: dropping it would change
 * the arithmetic the viewer can check, which is worse than revealing it.
 */

/**
 * §26.7's two modes.
 *
 * `filtered` is one message that every client renders differently — fast and
 * simple, and the default. `strict` creates a separate whispered message per
 * audience — slower, and *actually* secure, because a filtered card still ships
 * the full result to every client that can read the flags.
 *
 * The distinction is documented rather than hidden so a group can choose
 * knowingly, which is the whole of §26.6's argument in one setting.
 */
export const VISIBILITY_MODES = Object.freeze(["filtered", "strict"]);

/**
 * The card one viewer should see.
 *
 * @param {object} result
 * @param {object} viewer
 * @param {string} viewer.id
 * @param {boolean} [viewer.isGM]
 * @returns {object}
 */
export function cardFor(result, viewer) {
  const isGM = Boolean(viewer?.isGM);
  const isAttacker = (result.attackerControllers ?? []).includes(viewer?.id);
  const isDefender = (result.defenderControllers ?? []).includes(viewer?.id);
  const involved = isGM || isAttacker || isDefender;

  return {
    // Always. "Karna attacked Heracles" is public by the rulebook's own rule:
    // a player learns *that* something happened.
    header: result.summary ?? "",

    damage: involved ? (result.total ?? 0) : null,

    breakdown: breakdownFor(result, { isGM, isAttacker, isDefender }),

    // The defender learns what was applied to them, by name. Everyone else
    // learns only how many -- enough to see something happened, not enough to
    // plan around it.
    effects: isDefender || isGM ? [...(result.effects ?? [])] : (result.effects ?? []).length,

    // Each roll carries its own visibility; a GM-only Discover roll on a card
    // everyone can read gives away the Assassin's panel for free.
    rolls: (result.rolls ?? []).filter((r) => canSeeRoll(r, { isGM, viewerId: viewer?.id, result })),

    isGM, isAttacker, isDefender, involved,
  };
}

/**
 * Which rows of a Skill card's effect list this viewer may read.
 *
 * The same rule `cardFor` applies to an attack, stated for a Skill: a player
 * learns **that** a Skill was used, and learns the effects applied to units
 * they control. A Servant buffing ITSELF is its own owner's business, and a
 * card listing those rows tells the table exactly what that Servant just
 * gained — which is the information concealment exists to withhold.
 *
 * The caster's controller sees everything, including what landed on enemies:
 * they are the one who applied it, so they already know.
 *
 * `hidden` is a COUNT rather than silence. "2 more" says something happened
 * without saying what, which is the line §26.7 draws everywhere else.
 *
 * @param {Array<{name: string, controllers?: string[]}>} rows
 * @param {object} viewer
 * @param {string} viewer.id
 * @param {boolean} [viewer.isGM]
 * @param {string[]} [viewer.casterControllers]
 * @returns {{names: string[], hidden: number}}
 */
export function skillEffectsFor(rows, viewer) {
  const all = rows ?? [];
  const isCaster = (viewer?.casterControllers ?? []).includes(viewer?.id);
  if (viewer?.isGM || isCaster) return { names: all.map((r) => r.name), hidden: 0 };

  const mine = all.filter((r) => (r.controllers ?? []).includes(viewer?.id));
  return { names: mine.map((r) => r.name), hidden: all.length - mine.length };
}

/**
 * Drop the rows belonging to one side.
 *
 * A row with **no side** is kept. Unattributed is not secret: it is a board
 * fact, and removing it would leave a breakdown whose numbers do not add up.
 *
 * @param {object[]} rows
 * @param {string} side the side to remove
 * @returns {object[]}
 */
export function redactSources(rows, side) {
  return (rows ?? []).filter((r) => !r.side || r.side !== side);
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} result
 * @param {{isGM: boolean, isAttacker: boolean, isDefender: boolean}} who
 * @returns {object[]|null}
 */
function breakdownFor(result, { isGM, isAttacker, isDefender }) {
  const rows = result.breakdown ?? [];
  if (isGM) return [...rows];

  // Both at once -- an AoE that caught its own caster, or a charmed Servant
  // attacking its own faction. Neither redaction applies, because there is no
  // side to hide it from.
  if (isAttacker && isDefender) return [...rows];

  if (isAttacker) return redactSources(rows, "defender");
  if (isDefender) return redactSources(rows, "attacker");

  // A bystander gets none of it, rather than an empty list -- `null` renders as
  // "no breakdown shown" and `[]` renders as "the breakdown was empty".
  return null;
}

/**
 * @param {object} roll
 * @param {object} ctx
 * @returns {boolean}
 */
function canSeeRoll(roll, { isGM, viewerId, result }) {
  if (isGM) return true;
  if (roll.visibility === "public") return true;
  if (roll.visibility === "owner") {
    return (result.controllersByActor?.[roll.actorId] ?? []).includes(viewerId);
  }
  return false;
}
