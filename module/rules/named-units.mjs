/**
 * @file Who a Unit IS by True Name, and which named allies stand on its board.
 * @see module/rules/options.mjs, docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md reading 6
 *
 * Layer 2 (rules). Pure.
 *
 * Gilles de Rais (Saber) asks about a Heroic Spirit, not a build: *"If an allied
 * non-Alter Jeanne d'Arc is present on the field"*, *"an allied Jeanne d'Arc
 * Alter within a 3 panel area"*, *"standing directly next to Gilles"*. Ruled
 * 2026-10-20 (#260 reading 6): by True Name. A non-Alter Jeanne is any allied
 * Servant whose True Name is *Jeanne d'Arc* (a summer or a Ruler form alike);
 * the Alter's is *Jeanne d'Arc (Alter)*. `self:contentId:` names one build and
 * cannot say this.
 */

import { chebyshev } from "../domain/geometry.mjs";
import { relationOf } from "./relations.mjs";

/**
 * A True Name as an option word: lower case, every run of other characters one
 * hyphen. *"Jeanne d'Arc (Alter)"* is `jeanne-d-arc-alter`.
 *
 * @param {string|null|undefined} name
 * @returns {string|null}
 */
export function trueNameSlug(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  const slug = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || null;
}

/**
 * Stamp on every Unit the allied Units on its board, how far each stands, and
 * what it is: `nearbyAllies: [{trueName, attributes, distance}]`. The defeated
 * are not on the field, and a Unit is not its own ally here.
 *
 * Two clauses read it, both Gilles de Rais (Saber)'s: *"an allied non-Alter
 * Jeanne d'Arc"* by True Name (reading 6), and Triumphal Return's *"an allied
 * Unit with the [Star] Attribute within a 2 panel area of himself"*.
 *
 * @param {object[]} units the board's projected Units, mutated
 * @param {object} board
 * @returns {void}
 */
export function annotateAllies(units, board) {
  const standing = units.filter((u) => !u.defeated && u.panel);
  for (const u of units) {
    if (!u.panel) continue;
    u.nearbyAllies = standing
      .filter((n) => n.id !== u.id && relationOf(u, n, board) === "ally")
      .map((n) => ({
        trueName: n.kind === "servant" ? trueNameSlug(n.trueName) : null,
        attributes: [...(n.attributes ?? [])],
        distance: chebyshev(u.panel, n.panel),
      }));
  }
}
