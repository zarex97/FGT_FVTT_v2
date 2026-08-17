/**
 * @file Setup rolls, and the summon plan they belong to.
 * @see docs/14-checks-and-randomness.md §14.9, docs/37-content-pipeline.md §37.6
 *
 * Layer 2 (rules). Pure — it says **what to roll** and how to combine the
 * results, and the caller rolls. That split is what lets the summon dialog show
 * every line for confirmation with a per-line re-roll: a plan is inspectable in
 * a way a sequence of side effects is not.
 *
 * The `granted` versus `base` distinction (Ch. 05 §5.6) is at its most visible
 * here. A **granted** parameter step moves Base Attack by ±10; an innate one
 * does not, because the sheet's Base Attack already accounts for it. Applying
 * the adjustment to both would pay a Servant twice for the rank it was written
 * with.
 */

import { Rank } from "../domain/rank.mjs";
import { lookup } from "../domain/tables.mjs";

/** Base Attack moves by this much per **granted** parameter step. */
const BA_PER_GRANTED_STEP = 10;

/** Which parameters move which Base Attack component. */
const BA_COMPONENT = Object.freeze({ str: "str", mag: "mag" });

/**
 * Everything a Servant's summon needs rolled, as a plan.
 *
 * Health takes **no roll**: *"Health(S) is not used"* for a Servant, so its
 * maximum is the END table plus its steps and nothing else. That asymmetry with
 * the Master — who does roll — is deliberate and easy to implement backwards.
 *
 * @param {object} sheet the compendium Servant
 * @returns {{lines: object[], kind: "servant"}}
 */
export function servantSetupPlan(sheet) {
  const p = sheet?.parameters ?? {};
  const end = Rank.parseOrNull(p.end);
  const agi = Rank.parseOrNull(p.agi);
  const luc = Rank.parseOrNull(p.luc);

  return {
    kind: "servant",
    lines: [
      {
        id: "maxHealth",
        label: "Max Health",
        // Stated on the sheet where it disagrees with the table.
        base: sheet?.baseHealth ?? Number(lookup("baseHealthByEnd", end) ?? 0),
        roll: null,
        note: "no roll — Health(S) is not used for a Servant",
      },
      {
        id: "maxAgility",
        label: "Max Agility",
        base: agiBase(agi),
        // EX rolls 1d4; every other grade flips a coin for +1 or +2.
        roll: agi?.grade === "EX" ? { formula: "1d4" } : { formula: "1d2", map: [1, 2] },
      },
      {
        id: "maxLuck",
        label: "Max Luck",
        base: lucBase(luc),
        roll: { formula: "1d4" },
      },
    ],
  };
}

/**
 * The same for a Master.
 *
 * Base Health is a flat **250** regardless of rank or essence, before the
 * coin-flipped roll. That is between a sixth and an eighth of a Servant's, and
 * it is the numerical statement of how fragile Masters are — the reason
 * Overpower, ZON and Master protection all exist.
 *
 * @param {object} sheet
 * @returns {{lines: object[], kind: "master"}}
 */
export function masterSetupPlan(sheet, { mode = "essences" } = {}) {
  return {
    kind: "master",
    mode,
    lines: [
      // The sign is coin-flipped, so the roll can go either way around 250.
      { id: "maxHealth", label: "Max Health", base: 250, roll: { formula: "2d100", signCoin: true } },
      { id: "maxAgility", label: "Max Agility", base: 4, roll: { formula: "1d8" } },
      { id: "maxLuck", label: "Max Luck", base: 8, roll: { formula: "1d12" } },
      baseAttackLine(sheet, mode),
      { id: "commandSpells", label: "Command Spells", base: 3, roll: null },
    ],
  };
}

/**
 * The Base Attack (MAG) line, which is where a Master's rank actually shows up.
 *
 * §14.9's three modes, which the `masterMode` setting selects:
 *
 * - `essences` — the rank comes from the Master Essence on the sheet.
 * - `coinFlip` — *"you can still determine High Rank or Low Rank Masters by
 *   Flipping a Coin for each Master; Heads=High Rank, Tails=Low Rank."* The
 *   coin picks the **value**, because the rank exists here only to select it.
 * - `rankless` — *"If not, all Masters have Base Attack (MAG)=100."*
 *
 * @param {object} sheet
 * @param {string} mode
 * @returns {object}
 */
function baseAttackLine(sheet, mode) {
  const label = "Base Attack (MAG)";

  if (mode === "rankless") {
    return { id: "baseAttackMag", label, base: 100, roll: null, note: "no ranks in play" };
  }
  if (mode === "coinFlip") {
    return {
      id: "baseAttackMag", label, base: 0,
      roll: { formula: "1d2", map: [125, 100] },
      note: "heads = High Rank",
    };
  }

  const rank = Rank.parseOrNull(sheet?.rank ?? null);
  const high = rank !== null && ["A", "B"].includes(rank.grade);
  return { id: "baseAttackMag", label, base: high ? 125 : 100, roll: null };
}

/**
 * Fold rolled totals into the plan's lines.
 *
 * @param {object} plan
 * @param {Record<string, number>} rolls line id → total
 * @param {Record<string, boolean>} [signs] line id → true for a negative sign
 * @returns {Array<{id: string, label: string, value: number, base: number, rolled: number|null}>}
 */
export function resolveSetupPlan(plan, rolls, signs = {}) {
  return (plan?.lines ?? []).map((line) => {
    if (!line.roll) return { ...line, rolled: null, value: line.base };

    const raw = rolls?.[line.id];
    // A line nobody rolled resolves to its base rather than to NaN, and says so.
    if (typeof raw !== "number") return { ...line, rolled: null, value: line.base, unrolled: true };

    const mapped = line.roll.map ? line.roll.map[raw - 1] ?? raw : raw;
    const signed = line.roll.signCoin && signs[line.id] ? -mapped : mapped;
    // `rolled` is what the die showed after mapping; `applied` is what it
    // contributed, sign included. A display that used `rolled` for both would
    // render a tails 2d100 as "250 + 87 = 163".
    return { ...line, rolled: mapped, applied: signed, value: line.base + signed };
  });
}

/**
 * The Base Attack adjustment a set of **granted** steps produces.
 *
 * Only STR and MAG move Base Attack. AGI, END and LUC steps change their own
 * maxima and leave it alone — §37.6's worked example makes the point explicitly
 * ("BA adjustment: none (AGI does not affect BA)").
 *
 * @param {Record<string, number>} grantedSteps parameter → steps granted
 * @returns {{str: number, mag: number}}
 */
export function baseAttackAdjustment(grantedSteps) {
  const out = { str: 0, mag: 0 };
  for (const [parameter, steps] of Object.entries(grantedSteps ?? {})) {
    const component = BA_COMPONENT[parameter];
    if (!component) continue;
    out[component] += BA_PER_GRANTED_STEP * steps;
  }
  return out;
}

/**
 * The ordered summon sequence (§37.6).
 *
 * Order is load-bearing: the **rolls come first**, then Master grants, then the
 * war Region's grant. A Region step applied before the roll would be rolled
 * against the wrong table row, and the two grant sources stack as separate
 * steps rather than one combined shift.
 *
 * @param {object} args
 * @param {object} args.sheet
 * @param {object} [args.master]
 * @param {string|null} [args.warRegion]
 * @param {Record<string, number>} [args.masterGrants] parameter → steps
 * @returns {object[]} steps, each inspectable before it is committed
 */
export function summonPlan({ sheet, master = null, warRegion = null, masterGrants = {} }) {
  /** @type {object[]} */
  const steps = [{ kind: "rolls", plan: servantSetupPlan(sheet) }];

  if (Object.keys(masterGrants).length > 0) {
    steps.push({ kind: "grant", source: "master", steps: masterGrants,
      baseAttack: baseAttackAdjustment(masterGrants) });
  }

  // The war Region grants +1 to ALL parameters of a matching Servant, and
  // matching is `any` across the Servant's region list.
  if (warRegion && (sheet?.region ?? []).includes(warRegion)) {
    const all = { str: 1, end: 1, agi: 1, mag: 1, luc: 1 };
    steps.push({ kind: "grant", source: `region:${warRegion}`, steps: all,
      baseAttack: baseAttackAdjustment(all) });
  }

  if (master) steps.push({ kind: "contract", masterId: master.id });

  // Nothing is written until every line has been shown. The GM may re-roll any
  // one of them, and the whole set locks once the match starts.
  steps.push({ kind: "confirm", rerollable: true, locksAtMatchStart: true });
  return steps;
}

/* -------------------------------------------------------------------------- */

/** @param {Rank|null} agi @returns {number} */
function agiBase(agi) {
  return numericBase(lookup("baseAgilityByAgi", agi), agi);
}

/** @param {Rank|null} luc @returns {number} */
function lucBase(luc) {
  return numericBase(lookup("baseLuckByLuc", luc), luc);
}

/**
 * These tables store `"18 + @agilityCoin"` — the constant and the roll together
 * — because the sheet states them that way. The plan needs them apart, so the
 * constant is taken here and the roll is described on the line.
 *
 * @param {unknown} entry
 * @param {Rank|null} rank
 * @returns {number}
 */
function numericBase(entry, rank) {
  const raw = typeof entry === "object" && entry !== null && "formula" in entry ? entry.formula : entry;
  const constant = Number.parseInt(String(raw ?? "0"), 10);
  const base = Number.isFinite(constant) ? constant : 0;
  // `perStep` is 1 for both tables, and `lookup` already applied it for numeric
  // values — but these are strings, so the step is applied here.
  return base + (rank?.steps ?? 0);
}
