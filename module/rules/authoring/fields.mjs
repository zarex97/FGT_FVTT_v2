/**
 * @file The closed set of input kinds an authoring descriptor may ask for.
 * @see docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure.
 *
 * **Closed on purpose.** The editor has exactly one renderer per type, so a
 * descriptor asking for a type that does not exist would render nothing and
 * drop the field without saying so. `test/unit/authoring-contract.test.mjs`
 * holds every descriptor's field types against this list.
 *
 * `tickExpr` earns a type of its own rather than being `text` because every
 * duration and every cooldown in the game is one, `parseTick` already exists
 * to check it, and the failure is invisible: an unreadable cooldown makes an
 * ability reusable immediately, which reads as generosity rather than as a
 * content error (`engine/cooldown.mjs` says exactly this).
 */

import { parseTick } from "../../domain/tick.mjs";

/** @type {readonly string[]} */
export const FIELD_TYPES = Object.freeze([
  "text",
  "number",
  "checkbox",
  "select",
  "range",
  "rank",
  "tickExpr",
  "effectId",
  "predicateList",
  "tokenList",
  "objectList",
  "raw",
]);

/**
 * @param {unknown} type
 * @returns {boolean}
 */
export function isFieldType(type) {
  return typeof type === "string" && FIELD_TYPES.includes(type);
}

/**
 * Whether a value is syntactically usable for its field type.
 *
 * **Emptiness is always accepted.** A half-filled form is the normal state of
 * an editor, and required-ness is the descriptor's business, reported by the
 * rail's checklist. A validator that refused blanks would paint a new ability
 * red before its author had typed anything.
 *
 * @param {string} type
 * @param {unknown} value
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateFieldValue(type, value) {
  if (value === "" || value === null || value === undefined) return { ok: true };

  switch (type) {
    case "tickExpr":
      try {
        parseTick(String(value));
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message };
      }

    case "number":
      return Number.isFinite(Number(value))
        ? { ok: true }
        : { ok: false, reason: `"${value}" is not a number.` };

    case "raw":
      try {
        JSON.parse(typeof value === "string" ? value : JSON.stringify(value));
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message };
      }

    default:
      // `select`, `effectId` and `rank` are checked against their CHOICES by
      // the contract, which has them; this function only knows syntax.
      return { ok: true };
  }
}
