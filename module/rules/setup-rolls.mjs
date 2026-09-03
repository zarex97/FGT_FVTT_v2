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
 * here — though not, any longer, in Base Attack. This file used to hold that a
 * granted parameter step moved Base Attack by ±10 while an innate one did not,
 * *"because the sheet's Base Attack already accounts for it"*. The author has
 * since supplied the conversion table and settled it the other way: Base Attack
 * is DERIVED from STR and MAG, and *"if you find a value of Base attack that
 * differs from this calculation choose the value of this table instead of what
 * is on the character sheet."* So innate and granted steps are the same thing —
 * both move the rank, and the rank picks the table row. `baseAttackFor` is the
 * single reader; nothing adds a separate ±10 any more. See Ch. 41 Q50.
 */

import { Rank } from "../domain/rank.mjs";
import { lookup } from "../domain/tables.mjs";
// Re-exported so the summon machinery and its tests keep one import site, while
// the definition lives in `domain/` -- `data/actor/servant.mjs` derives Base
// Attack in `prepareBaseData` and a data model may import from `domain` only.
export { baseAttackFor } from "../domain/base-attack.mjs";

/** Base Attack moves by this much per **granted** parameter step. */
const BA_PER_GRANTED_STEP = 10;

/** Which parameters move which Base Attack component. */
const BA_COMPONENT = Object.freeze({ str: "str", mag: "mag" });

/**
 * Has this Servant never had its setup rolls made?
 *
 * Agility and Luck are the two stats that need a die (a coin for Agility, a d4
 * for Luck), so unlike Health they cannot be derived on demand — they are
 * rolled once and stamped. `engine/summon.mjs` does that, and the compendium
 * drop is intercepted so the ordinary path is covered; an actor that arrives
 * some other way (duplicated, built by a macro, imported) keeps the template's
 * zeroes.
 *
 * A zero maximum is unambiguous evidence of that. The lowest row of either
 * table is `E`, and even E is `10 + X` for Agility and `0 + 1d4` for Luck, so a
 * Servant with a stated rank can never legitimately sit at 0. The failure is
 * silent and total where it happens — Agility is the number you must roll
 * *under*, so a maximum of 0 auto-fails every Evade — which is why it is worth
 * detecting rather than trusting the creation paths.
 *
 * @param {object} sheet a Servant's system data
 * @returns {boolean}
 */
export function needsSetupRolls(sheet) {
  const stated = (parameter) => Rank.parseOrNull(sheet?.parameters?.[parameter]) !== null;
  const unrolled = (stat) => !(sheet?.[stat]?.max > 0);
  return (stated("agi") && unrolled("agility")) || (stated("luc") && unrolled("luck"));
}

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
      // A summon-time variant (Ch. 05, `rules/summon-variant.mjs`) FIRST — it
      // changes what the Servant's other lines even mean (Semiramis's
      // Sustainability base differs by branch), so it has to resolve before
      // anything downstream reads her shape. `map` is a two-entry array
      // because the roll is always `1d2`: index 0 is heads (roll 1), index 1
      // is tails (roll 2) -- `resolveSetupPlan`'s existing `map` mechanism,
      // extended to carry a variant id instead of a number.
      ...(sheet?.summonVariant ? [{
        id: "summonVariant",
        label: "Summon Variant",
        base: null,
        roll: { formula: "1d2", map: [sheet.summonVariant.heads?.id ?? null, sheet.summonVariant.tails?.id ?? null] },
      }] : []),
      // HGoB Construction source 2 (Ch. 32): "roll 2 six-sided dice. The
      // Construction is increased by X, where X = the number of both dice
      // multiplied together." Foundry's own Roll grammar already evaluates
      // "1d6*1d6" as two independent dice multiplied, so this needs no
      // separate dice-multiplication primitive. Source 1 (the Region-based
      // starting value) is NOT a roll and is added separately in
      // `engine/summon.mjs`'s `sheetPatch`, which has `warRegion` in scope
      // and this plan does not.
      ...(sheet?.resources?.hgobConstruction ? [{
        id: "hgobConstructionRoll",
        label: "HGoB Construction (summon roll)",
        base: 0,
        roll: { formula: "1d6*1d6" },
      }] : []),
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
      // Ch. 14 §14.9: "Heads=High Rank, Tails=Low Rank." Emitted BEFORE the
      // Base Attack line, which derives from it -- `resolveSetupPlan` walks
      // the lines in order.
      ...(mode === "coinFlip" ? [rankLine()] : []),
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
/**
 * The rank a coin decides.
 *
 * *"You can still determine High Rank or Low Rank Masters by Flipping a Coin
 * for each Master; Heads=High Rank, Tails=Low Rank"* (Ch. 14 §14.9). `A` and
 * `C` stand for the two tiers -- the rulebook names the tier, not the letter,
 * and any A/B or C/D would serve.
 *
 * `map` carrying strings is already supported: `resolveSetupPlan` takes a
 * mapped string as the value outright rather than adding it to `base`, which
 * is what the summon-variant line needed first.
 *
 * @returns {object}
 */
function rankLine() {
  return { id: "rank", label: "Rank", base: "", roll: { formula: "1d2", map: ["A", "C"] } };
}

function baseAttackLine(sheet, mode) {
  const label = "Base Attack (MAG)";

  if (mode === "rankless") {
    return { id: "baseAttackMag", label, base: 100, roll: null, note: "no ranks in play" };
  }
  if (mode === "coinFlip") {
    // DERIVED from the `rank` line, not rolled again. This used to carry its
    // own `1d2` mapped straight onto [125, 100] with the note that "the rank
    // exists here only to select it" -- but the rank also decides ZON,
    // Sustainability, the parameter grant and the Kill Yourself price, so a
    // table that flipped Heads got a Master with 125 who was Rankless for
    // every other rule in the game. One coin, one answer, and the two can no
    // longer disagree.
    return {
      id: "baseAttackMag", label, base: 0, roll: null,
      derivedFrom: "rank", map: { A: 125, B: 125, C: 100, D: 100 }, fallback: 100,
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
  /** Values of lines already resolved, for `derivedFrom` to read. @type {Record<string, unknown>} */
  const resolved = {};

  return (plan?.lines ?? []).map((line) => {
    // A line whose value comes from ANOTHER line rather than from a die. The
    // coin-flip Master's Base Attack (MAG) follows the rank the coin picked,
    // so the two cannot disagree. Depends on `lines` order, which is why the
    // rank is emitted first.
    if (line.derivedFrom) {
      const from = resolved[line.derivedFrom];
      const value = line.map?.[from] ?? line.fallback ?? line.base;
      resolved[line.id] = value;
      return { ...line, rolled: null, value, derivedValue: from ?? null };
    }
    if (!line.roll) {
      resolved[line.id] = line.base;
      return { ...line, rolled: null, value: line.base };
    }

    const raw = rolls?.[line.id];
    // A line nobody rolled resolves to its base rather than to NaN, and says so.
    if (typeof raw !== "number") {
      resolved[line.id] = line.base;
      return { ...line, rolled: null, value: line.base, unrolled: true };
    }

    const mapped = line.roll.map ? line.roll.map[raw - 1] ?? raw : raw;
    const signed = line.roll.signCoin && signs[line.id] ? -mapped : mapped;
    // `rolled` is what the die showed after mapping; `applied` is what it
    // contributed, sign included. A display that used `rolled` for both would
    // render a tails 2d100 as "250 + 87 = 163".
    //
    // A `map` may carry a STRING (a summon variant's id) rather than a number
    // -- `resolveSummonVariant`'s one caller here. `line.base + signed` would
    // string-concatenate rather than add, so a mapped string is the value
    // outright; every other line's `map` entries are numbers, unaffected.
    const value = typeof signed === "string" ? signed : line.base + signed;
    resolved[line.id] = value;
    return { ...line, rolled: mapped, applied: signed, value };
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
  // Spread: `region` is a SetField on the document, and the caller is entitled
  // to hand this function either shape.
  if (warRegion && [...(sheet?.region ?? [])].includes(warRegion)) {
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
