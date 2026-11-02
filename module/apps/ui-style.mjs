/**
 * @file The interface's look: Grail War Nocturne, or Classic (#364).
 * @see DESIGN.md, docs/35-sheets-and-editor.md, DESIGN.md
 *
 * A world setting (`uiStyle`), read once per page load: changing it asks for
 * a reload, so nothing here has to repaint a window already drawn.
 *
 * **Classic** is the interface as it stood after the three polish PRs (#365
 * the action bar, #366 the chat cards, #367 the FGO sheet) and before
 * Nocturne (#368). It is drawn by its own frozen stylesheet,
 * `styles/fgt-classic.css` (from `styles/src/classic/`), which takes the
 * place of `fgt.css`, by its own copy of the two templates Nocturne rebuilt
 * (`templates/classic/`), and without Nocturne's motion: no Noble Phantasm
 * cut-in, no damage count-up, no forced night palette, no tab rise.
 *
 * Every reader asks `uiStyle()` here, never the setting itself.
 */

/** The looks, the default first. */
export const UI_STYLES = Object.freeze(["nocturne", "classic"]);

/** The setting's key. */
export const UI_STYLE_SETTING = "uiStyle";

/** What `system.json` loads, and what Classic loads in its place. */
const NOCTURNE_CSS = /(^|\/)systems\/fgt\/styles\/fgt\.css(\?.*)?$/;
export const CLASSIC_CSS = "systems/fgt/styles/fgt-classic.css";

/**
 * The templates Nocturne rebuilt, and #367's copy of each. Every other
 * template is shared: what it draws for Nocturne alone, Classic's stylesheet
 * hides (`styles/src/classic/_bridge.scss`).
 */
export const CLASSIC_TEMPLATES = Object.freeze({
  "systems/fgt/templates/chat/attack.hbs": "systems/fgt/templates/classic/chat/attack.hbs",
  "systems/fgt/templates/hud/action-bar.hbs": "systems/fgt/templates/classic/hud/action-bar.hbs",
});

/**
 * The look `applyUiStyle` put on this page, once it has run. A Classic that
 * could not load its stylesheet is Nocturne everywhere, templates too.
 *
 * @type {"nocturne"|"classic"|null}
 */
let applied = null;

/**
 * The look this world uses.
 *
 * Before the setting is registered (a test, a module reading early) it is the
 * default. A stored value this system does not know is said, not guessed at,
 * and the default is drawn.
 *
 * @returns {"nocturne"|"classic"}
 */
export function uiStyle() {
  if (applied) return applied;
  let value;
  try {
    value = game.settings.get("fgt", "uiStyle");
  } catch {
    return UI_STYLES[0];
  }
  if (UI_STYLES.includes(value)) return value;
  console.warn(`FGT | Unknown interface look "${value}"; drawing ${UI_STYLES[0]}.`);
  return UI_STYLES[0];
}

/** @returns {boolean} whether this world draws the Classic look */
export function isClassicUI() {
  return uiStyle() === "classic";
}

/**
 * The template a look draws for `path`.
 *
 * @param {string} path the live template's path
 * @param {string} [style] the look; this world's by default
 * @returns {string}
 */
export function uiTemplate(path, style = uiStyle()) {
  return style === "classic" ? (CLASSIC_TEMPLATES[path] ?? path) : path;
}

/**
 * An application's parts with each template swapped for the look's
 * (`_configureRenderParts`).
 *
 * @param {Record<string, {template: string}>} parts
 * @param {string} [style]
 * @returns {Record<string, {template: string}>} the same object
 */
export function uiParts(parts, style = uiStyle()) {
  for (const part of Object.values(parts)) part.template = uiTemplate(part.template, style);
  return parts;
}

/**
 * Put Classic's stylesheet where `fgt.css` was.
 *
 * Foundry loads a system's styles as `@import "…/fgt.css" layer(system);` in
 * one `<style>` in the page's head (`app/templates/views/layouts/main.hbs`),
 * not as a `<link>` that could be switched off. The import is replaced in
 * place: same sheet, same position, same layer, so the cascade around it does
 * not move.
 *
 * @param {Document} doc
 * @param {string} [href]
 * @returns {boolean} whether it was replaced
 */
export function swapStylesheet(doc, href = CLASSIC_CSS) {
  for (const sheet of doc?.styleSheets ?? []) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a cross-origin sheet: not Foundry's head
    }
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (typeof rule?.href !== "string" || !NOCTURNE_CSS.test(rule.href)) continue;
      const layer = rule.layerName ? ` layer(${rule.layerName})` : "";
      sheet.deleteRule(i);
      sheet.insertRule(`@import url("${href}")${layer};`, i);
      return true;
    }
  }
  return false;
}

/**
 * Apply this world's look to the page. Called once at `init`, after the
 * settings are registered and before anything is drawn.
 *
 * @param {Document} [doc]
 * @returns {"nocturne"|"classic"} the look applied
 */
export function applyUiStyle(doc = globalThis.document) {
  applied = null;
  let style = uiStyle();
  if (style === "classic" && !swapStylesheet(doc)) {
    // Refused out loud: loading both would draw neither.
    console.error("FGT | The Classic look could not find fgt.css to replace; Nocturne stays.");
    style = UI_STYLES[0];
  }
  applied = style;
  return style;
}
