/**
 * @file The surface a chat card sits on.
 * @see docs/37-chat-and-log.md, DESIGN.md
 *
 * Pure: it reads and writes only the element it is handed.
 */

/**
 * Mark a message that holds one of this system's cards (#364).
 *
 * Core draws every message on its parchment with near-black ink, which sat
 * against the system's night-and-gold everywhere else. `fgt` carries the
 * `--fgt-*` tokens, so the card takes the interface's theme (`.theme-light
 * .fgt` on a light sidebar, the forced light chat popout too); `fgt-message`
 * is what the stylesheet keys the message's own frame on. A message with no
 * card (a player's chat line) is left on core's parchment.
 *
 * @param {HTMLElement} html the `li.chat-message` from `renderChatMessageHTML`
 * @returns {boolean} whether it was marked
 */
export function markSystemCard(html) {
  if (!html?.querySelector?.(".fgt-card")) return false;
  html.classList.add("fgt", "fgt-message");
  return true;
}
