/**
 * @file The surface a chat card sits on, and whose card it is to the reader.
 * @see docs/37-chat-and-log.md, DESIGN.md
 *
 * Pure: it reads and writes only what it is handed.
 */

/**
 * Mark a message that holds one of this system's cards (#364).
 *
 * Core draws every message on its parchment with near-black ink, and forces
 * the chat log light. `fgt` carries the `--fgt-*` tokens; `themed theme-dark`
 * turns core's own variables dark inside the card, so its buttons and links
 * agree with the plate; `fgt-message` is what the stylesheet keys the
 * message's frame on. A message with no card (a player's chat line) is left
 * on core's parchment.
 *
 * The Classic look (`night: false`, `apps/ui-style.mjs`) keeps #366's card:
 * no forced night, so it follows the interface's theme as it did then.
 *
 * @param {HTMLElement} html the `li.chat-message` from `renderChatMessageHTML`
 * @param {object} [options]
 * @param {boolean} [options.night] Nocturne's night palette; on by default
 * @returns {boolean} whether it was marked
 */
export function markSystemCard(html, { night = true } = {}) {
  if (!html?.querySelector?.(".fgt-card")) return false;
  html.classList.add("fgt", "fgt-message");
  if (night) html.classList.add("themed", "theme-dark");
  return true;
}

/**
 * Whose card this is, to the one reading it (#364): the banner across its top,
 * the frame's hue, and which side of the duel is marked YOU.
 *
 * A GM runs every side, so a GM reads `gm` whatever they own. A player who
 * holds both sides (one table, two factions) reads `both`.
 *
 * @param {object} viewer
 * @param {boolean} viewer.isGM
 * @param {boolean} viewer.ownsActor the attacker, or a Skill's caster
 * @param {boolean} viewer.ownsTarget the defender, or one a Skill landed on
 * @returns {"gm"|"both"|"attacker"|"defender"|"observer"}
 */
export function viewerRole({ isGM = false, ownsActor = false, ownsTarget = false } = {}) {
  if (isGM) return "gm";
  if (ownsActor && ownsTarget) return "both";
  if (ownsActor) return "attacker";
  if (ownsTarget) return "defender";
  return "observer";
}
