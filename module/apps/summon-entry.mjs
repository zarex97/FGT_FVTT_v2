/**
 * @file Where a GM reaches the summon dialog from.
 * @see docs/37-content-pipeline.md §37.6
 *
 * Layer 4. Two entry points, because they answer two different questions:
 *
 *   - A **Summon** button on the Actors sidebar, for "I want to add a Servant"
 *     — the GM does not yet know which.
 *   - A **Summon** context entry in the Servant compendium, for "I want *this*
 *     Servant" — pre-selected, so the dialog opens one step further along.
 *
 * Dragging a compendium Servant onto the canvas still works and still produces
 * an actor with **no setup rolls**, which is the trap: the numbers on the sheet
 * would be the template's, not this Servant's. So the drop is intercepted and
 * the GM is told to summon instead, rather than being left with a Servant that
 * looks right and is not.
 */

import { SummonDialog } from "./summon-dialog.mjs";

/**
 * Wire the entry points. Called from `ready`.
 */
export function attachSummonEntries() {
  if (!game.user.isGM) return;

  Hooks.on("renderActorDirectory", onRenderDirectory);
  Hooks.on("getCompendiumEntryContext", onCompendiumContext);
  Hooks.on("dropCanvasData", onDropCanvasData);
}

/**
 * A Summon button at the top of the Actors sidebar.
 *
 * @param {object} _app
 * @param {HTMLElement} html
 */
function onRenderDirectory(_app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const header = root?.querySelector(".header-actions") ?? root?.querySelector(".directory-header");
  if (!header || header.querySelector("[data-fgt-summon]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.fgtSummon = "";
  button.innerHTML = `<i class="fa-solid fa-hand-sparkles"></i> ${game.i18n.localize("FGT.Summon.Button")}`;
  button.addEventListener("click", () => SummonDialog.open());
  header.append(button);

  // The game log (§30.8) lives here too: it is a GM tool about the match, and
  // the Actors sidebar is where the match's units already are.
  const log = document.createElement("button");
  log.type = "button";
  log.dataset.fgtLog = "";
  log.innerHTML = `<i class="fa-solid fa-scroll"></i> ${game.i18n.localize("FGT.Log.Button")}`;
  log.addEventListener("click", async () => {
    const { LogViewer } = await import("./log-viewer.mjs");
    LogViewer.open();
  });
  header.append(log);
}

/**
 * A Summon entry on a compendium Servant.
 *
 * @param {HTMLElement} html
 * @param {object[]} entries
 */
function onCompendiumContext(html, entries) {
  entries.unshift({
    name: "FGT.Summon.ContextEntry",
    icon: '<i class="fa-solid fa-hand-sparkles"></i>',
    condition: (li) => Boolean(contentIdOf(html, li)),
    callback: (li) => SummonDialog.open({ contentId: contentIdOf(html, li) }),
  });
}

/**
 * Refuse a bare drop of a compendium Servant.
 *
 * The actor it would create has the template's numbers rather than this
 * Servant's rolled ones, and nothing on the sheet would say so. Refusing is the
 * kinder failure: a Servant with wrong maxima is discovered three rounds later,
 * by which point the war has been played against them.
 *
 * @param {object} _canvas
 * @param {object} data
 * @returns {boolean|undefined} false cancels the drop
 */
function onDropCanvasData(_canvas, data) {
  if (data?.type !== "Actor" || !data.uuid?.startsWith("Compendium.")) return undefined;

  const parsed = foundry.utils.parseUuid(data.uuid);
  const pack = game.packs.get(`${parsed.collection?.collection ?? ""}`);
  if (!pack) return undefined;

  const entry = pack.index.get(parsed.id);
  if (entry?.type !== "servant") return undefined;

  ui.notifications.warn(game.i18n.localize("FGT.Summon.DropRefused"));
  SummonDialog.open({ contentId: entry.system?.contentId ?? null });
  return false;
}

/**
 * The content id behind a compendium list row.
 * @param {HTMLElement} html
 * @param {HTMLElement|object} li
 * @returns {string|null}
 */
function contentIdOf(html, li) {
  const element = li instanceof HTMLElement ? li : li?.[0];
  const id = element?.dataset?.entryId ?? element?.dataset?.documentId;
  if (!id) return null;

  const root = html instanceof HTMLElement ? html : html?.[0];
  const collection = root?.closest("[data-pack]")?.dataset.pack
    ?? root?.dataset?.pack
    ?? element?.closest("[data-pack]")?.dataset.pack;

  const entry = game.packs.get(collection)?.index?.get(id);
  if (entry?.type !== "servant") return null;
  return entry.system?.contentId ?? null;
}
