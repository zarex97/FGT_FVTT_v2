/**
 * @file Custom DataFields for the F/GT domain.
 * @see docs/22-data-models.md
 *
 * Two fields carry domain meaning that a bare StringField would lose: a rank
 * must parse, and a duration must parse. Validating at the schema level means a
 * bad value is rejected at write time with a useful message, rather than
 * throwing somewhere deep in the damage pipeline three turns later.
 */

import { Rank } from "../domain/rank.mjs";
import { parseTick } from "../domain/tick.mjs";

const fields = foundry.data.fields;

/**
 * A rank string. `null` and `""` mean **unranked**, which is a distinct value
 * from any rank and never orders below `E` (Ch. 05 §5.1).
 */
export class RankField extends fields.StringField {
  /** @inheritdoc */
  static get _defaults() {
    return Object.assign(super._defaults, { required: false, blank: true, nullable: true, initial: null });
  }

  /** @inheritdoc */
  _validateType(value) {
    if (value === null || value === "" || value === "-") return true;
    try {
      Rank.parse(value);
      return true;
    } catch (err) {
      throw new Error(`is not a valid rank: ${err.message}`, { cause: err });
    }
  }
}

/**
 * A duration or cooldown, in the authoring notation (`"1◈+⅔◈"`, `"2 turns"`,
 * `"permanent"`). Stored as authored and resolved against the world's
 * `turnsPerRound` at read time, so the same content is correct at 3, 8 and 15
 * turns per round (SC-3).
 */
export class TickField extends fields.StringField {
  /** @inheritdoc */
  static get _defaults() {
    return Object.assign(super._defaults, { required: false, blank: true, nullable: true, initial: null });
  }

  /** @inheritdoc */
  _validateType(value) {
    if (value === null || value === "") return true;
    try {
      parseTick(value);
      return true;
    } catch (err) {
      throw new Error(`is not a valid duration: ${err.message}`, { cause: err });
    }
  }
}

/**
 * A `{value, max}` pair. Health, Agility and Luck all deplete and restore, and
 * every one of them needs the max preserved separately because effects modify
 * the two independently (`Max HpDwn` explicitly does not restore current).
 * @param {number} initial
 * @returns {object}
 */
export function resourceField(initial = 0) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, initial, nullable: true }),
    max: new fields.NumberField({ required: true, integer: true, initial, nullable: true }),
  });
}
