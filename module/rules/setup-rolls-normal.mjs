/**
 * @file The Normal ruleset's setup rolls.
 * @see docs/14-checks-and-randomness.md §14.9
 * @see char_orig_sheets/extra docs/Normal Great Holy Grail War.md
 *
 * Layer 2 (rules). Pure — it says what to roll and how to combine the results,
 * and the caller rolls.
 *
 * Deliberately the same **line vocabulary** as `setup-rolls.mjs`: `signCoin`,
 * `map`, `derivedFrom`, `base` and `roll.formula` all exist already, because
 * the Advanced Master's Max Health is itself a coin-signed `2d100` and its rank
 * line already maps a `1d2` onto letters. Nothing here is a new kind of line;
 * only the numbers differ.
 *
 * The line **ids** are shared too — `maxHealth`, `maxAgility`, `maxLuck`,
 * `rank`, `baseAttackMag`, `commandSpells` — which is what lets
 * `engine/summon.mjs`'s `sheetPatch` and `SETUP_PATHS` consume a Normal plan
 * without knowing it is one.
 *
 * Why a separate file rather than a branch inside `setup-rolls.mjs`: the two
 * rulesets derive from different things entirely. Advanced reads rank tables
 * and has **no Health roll at all** (*"Health(S) is not used"*); Normal rolls
 * Health and reads no table. One function switching on a flag would be two
 * functions sharing a name.
 */

/**
 * Normal's Agility deltas, added to the flat base of 10 before the `1d10`.
 *
 * > *"For the following Servants, add/deduct the following values to/from their
 * > Max Agility. Lancer: +2, Rider: +1, Caster: −2, Assassin: +3."*
 *
 * Plain frozen objects rather than entries in `domain/tables.mjs`, because
 * `lookup()` is keyed on a **Rank** and these are keyed on a class — the same
 * shape and the same reason as `ZON_BASE` and `ZON_CLASS_BONUS` in
 * `rules/zon.mjs`. Keyed on the CONTAINER, not on `servantClasses`: Normal has
 * one generic Servant per container, and the container is what its sheet is
 * titled by.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const NORMAL_AGILITY_BY_CLASS = Object.freeze({
  lancer: 2, rider: 1, caster: -2, assassin: 3,
});

/**
 * Normal's Luck deltas, added to the `1d20`.
 *
 * > *"Lancer: −2, Assassin: +2."*
 *
 * @type {Readonly<Record<string, number>>}
 */
export const NORMAL_LUCK_BY_CLASS = Object.freeze({ lancer: -2, assassin: 2 });

/** The flat base Agility every Normal Servant rolls `1d10` on top of. */
const AGILITY_BASE = 10;

/**
 * A signed delta, for a line's note. `null` when there is nothing to say.
 * @param {string} container
 * @param {number} delta
 * @returns {string|null}
 */
function deltaNote(container, delta) {
  if (delta === 0) return null;
  return `${container} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
}

/**
 * Everything a Normal Servant's summon needs rolled.
 *
 * > *"For every Servant, Flip a Coin, then Roll for Health(S). If Heads, the
 * > Max Health is the Base Health plus the rolled value. If Tails, the Max
 * > Health is the Base Health minus the rolled value."*
 *
 * Unlike Advanced, Health **is** rolled here — and that is the reason the
 * Normal sheets state a flat Base Health instead of an END rank.
 *
 * @param {object} sheet the compendium Servant's system data
 * @returns {{kind: "servant", lines: object[]}}
 */
export function normalServantSetupPlan(sheet) {
  const container = sheet?.classContainer ?? "";
  const agilityDelta = NORMAL_AGILITY_BY_CLASS[container] ?? 0;
  const luckDelta = NORMAL_LUCK_BY_CLASS[container] ?? 0;

  return {
    kind: "servant",
    lines: [
      {
        id: "maxHealth",
        label: "Max Health",
        base: sheet?.baseHealth ?? 0,
        roll: { formula: "10d20", signCoin: true },
      },
      {
        id: "maxAgility",
        label: "Max Agility",
        // "Roll for Agility (S): 1d10+10" -- the +10 is a flat base, so the
        // class delta joins it rather than modifying the die.
        base: AGILITY_BASE + agilityDelta,
        roll: { formula: "1d10" },
        note: deltaNote(container, agilityDelta),
      },
      {
        id: "maxLuck",
        label: "Max Luck",
        base: luckDelta,
        roll: { formula: "1d20" },
        note: deltaNote(container, luckDelta),
      },
    ],
  };
}

/**
 * The same for a Normal Master.
 *
 * > *"Optional: High Rank & Low Rank Masters — If everyone agrees, you can
 * > determine whether each Master is High Rank or Low Rank by Flipping a Coin
 * > for each Master; Heads=High Rank, Tails=Low Rank. If not, all Masters have
 * > Base Attack (MAG)=100."*
 *
 * That is exactly the `masterMode` setting's `coinFlip` and `rankless` modes,
 * and `rules/master-rank.mjs` already grants the High Rank's three benefits
 * (Base Attack 125, ZON +1, Sustainability +1◈) — so this plan only decides the
 * rank and lets the rank decide the rest.
 *
 * @param {object} sheet
 * @param {{mode?: string}} [options]
 * @returns {{kind: "master", mode: string, lines: object[]}}
 */
export function normalMasterSetupPlan(sheet, { mode = "rankless" } = {}) {
  return {
    kind: "master",
    mode,
    lines: [
      { id: "maxHealth", label: "Max Health", base: 250, roll: { formula: "5d20", signCoin: true } },
      // "Roll for Agility (M): 1d12" and "Roll for Luck: 1d20", both with NO
      // flat base -- unlike the Advanced Master, which starts at 4 and 8.
      { id: "maxAgility", label: "Max Agility", base: 0, roll: { formula: "1d12" } },
      { id: "maxLuck", label: "Max Luck", base: 0, roll: { formula: "1d20" } },
      // BEFORE the Base Attack line, which derives from it: `resolveSetupPlan`
      // walks the lines in order and a `derivedFrom` reads what is already
      // resolved.
      ...(mode === "coinFlip"
        ? [{ id: "rank", label: "Rank", base: "", roll: { formula: "1d2", map: ["A", "C"] } }]
        : []),
      baseAttackLine(mode),
      { id: "commandSpells", label: "Command Spells", base: 3, roll: null },
    ],
  };
}

/**
 * Base Attack (MAG), which is where the Master's rank shows up.
 *
 * Derived from the `rank` line rather than rolled again, so the two can never
 * disagree — a Master who flipped Heads must not end up with 125 and be
 * Rankless for ZON, Sustainability and the Kill Yourself price, which is
 * exactly the defect `setup-rolls.mjs` records having had.
 *
 * @param {string} mode
 * @returns {object}
 */
function baseAttackLine(mode) {
  const label = "Base Attack (MAG)";
  if (mode === "coinFlip") {
    return {
      id: "baseAttackMag", label, base: 0, roll: null,
      derivedFrom: "rank", map: { A: 125, B: 125, C: 100, D: 100 }, fallback: 100,
    };
  }
  // "If not, all Masters have Base Attack (MAG)=100." An Essence-driven rank is
  // an Advanced concept; a Normal table that has not opted into the coin has no
  // ranks at all.
  return { id: "baseAttackMag", label, base: 100, roll: null, note: "no ranks in play" };
}
