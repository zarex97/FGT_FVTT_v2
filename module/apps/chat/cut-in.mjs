/**
 * @file The Noble Phantasm cut-in: the one moment the whole table stops.
 * @see docs/37-chat-and-log.md, DESIGN.md
 *
 * When a Noble Phantasm is declared, every client sees a crimson band sweep
 * across the board with its name, over a flash and the summoning circle, for
 * under two seconds. It is the rarest event a table sees, which is what keeps
 * it worth the interruption. It never blocks input (`pointer-events: none`).
 *
 * Held back for a player who asked for calm: reduced motion, or Foundry's
 * photosensitive mode. Their card still says it all.
 */

import { drawSummoningCircle } from "../ornament.mjs";

/** Declarations already shown, so an area attack's cards play it once. */
const shown = new Map();

/** How long two cards of one declaration may be apart. */
const SAME_DECLARATION_MS = 4000;

/**
 * @returns {boolean} whether this client asked for calm
 */
function calm() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches
    || Boolean(globalThis.canvas?.photosensitiveMode);
}

/**
 * Play the cut-in for one declaration.
 *
 * @param {object} args
 * @param {string} args.key the declaration: attacker and Noble Phantasm
 * @param {string} args.name the Noble Phantasm's name, as the card prints it
 * @param {string|null} [args.rank]
 * @returns {boolean} whether it played
 */
export function playNoblePhantasmCutIn({ key, name, rank = null }) {
  const now = Date.now();
  if (now - (shown.get(key) ?? 0) < SAME_DECLARATION_MS) return false;
  shown.set(key, now);
  if (calm() || !name) return false;

  // The NP's name splits at its first colon: "Rhongomyniad: The Spear That
  // Shines..." reads as a title and its epithet.
  const [title, ...rest] = String(name).split(":");
  const epithet = rest.join(":").trim();

  const root = document.createElement("div");
  root.className = "fgt fgt-cutin";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="fgt-cutin__flash"></div>
    <div class="fgt-cutin__band">
      <svg class="fgt-cutin__circle"></svg>
      <div class="fgt-cutin__text">
        <div class="fgt-cutin__kicker"></div>
        <div class="fgt-cutin__title"></div>
        ${epithet ? '<div class="fgt-cutin__sub"></div>' : ""}
      </div>
    </div>`;
  root.querySelector(".fgt-cutin__kicker").textContent = game.i18n.localize("FGT.CutIn.Kicker") + (rank ? ` · ${rank}` : "");
  root.querySelector(".fgt-cutin__title").textContent = title.trim();
  if (epithet) root.querySelector(".fgt-cutin__sub").textContent = epithet;
  drawSummoningCircle(root.querySelector(".fgt-cutin__circle"), { color: "var(--fgt-gold-hi)" });
  document.body.append(root);

  root.querySelector(".fgt-cutin__flash").animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }],
    { duration: 1500, easing: "ease-out" },
  );
  root.querySelector(".fgt-cutin__band").animate([
    { transform: "rotate(-6deg) translateX(110%) scaleY(0.2)", opacity: 0 },
    { transform: "rotate(-6deg) translateX(0) scaleY(1)", opacity: 1, offset: 0.22, easing: "cubic-bezier(.16,1,.3,1)" },
    { transform: "rotate(-6deg) translateX(-2%) scaleY(1)", opacity: 1, offset: 0.78 },
    { transform: "rotate(-6deg) translateX(-110%) scaleY(0.4)", opacity: 0 },
  ], { duration: 1800, easing: "linear" }).finished.finally(() => root.remove());
  return true;
}
