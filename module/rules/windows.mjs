/**
 * @file The ability timing window vocabulary.
 * @see docs/17-abilities.md
 *
 * Layer 2 (rules). Pure data.
 *
 * **Why this exists.** `timing` is a bare `ObjectField` (`data/item/ability.mjs`),
 * and `timing.window` is authored by 117 of the 195 abilities in
 * `packs/_source` — the most-used structured field in the content. Until this
 * module there was no enumeration of it anywhere: windows were matched by
 * string comparison at three scattered call sites, two of them against
 * module-local constants and one against a bare literal, and the content build
 * checked nothing. A typo authored cleanly, validated, passed CI, and produced
 * an ability whose reaction window never fired.
 *
 * That is the identical failure `test/unit/targeting.test.mjs` was written
 * after, when the picker offered `point` and the resolver only knew
 * `withinRange`. One list, and a drift test in both directions.
 *
 * **`ownTurn` is the odd one.** No dispatcher matches it — it is not offered at
 * a moment, it is "usable during your Turn", which is the sheet button rather
 * than an offer. `dispatched` says so rather than leaving a reader to hunt for
 * a call site that does not exist. 89 of the 117 uses are this one. It is
 * ENFORCED, though, by two readers: `rules/modes.mjs#canToggleMode` for a mode
 * and `rules/costs.mjs#canUseAbility` for everything else, through
 * {@link usedOnlyDuringOwnTurn} (#160).
 *
 * Command spells have their own windows (`rules/command-spells.mjs#WINDOWS`)
 * and the two lists must never merge, for the same reason their requirement
 * lists must not (`tools/lib/content.mjs`): `anyTime` and `onDefeat` describe
 * moments an ability has no way to be offered at.
 */

/**
 * @typedef {object} WindowEntry
 * @property {string} id
 * @property {boolean} dispatched whether any call site offers abilities at it
 * @property {string} hint one line, in the words a GM uses
 */

/** Every window an ability's `timing.window` may name. */
export const ABILITY_WINDOWS = Object.freeze({
  ownTurn: Object.freeze({
    id: "ownTurn",
    // Not offered at: `rules/ability-use.mjs` reads it to classify the
    // ability, and the use gate refuses it on another Turn (#160).
    dispatched: false,
    hint: "During its owner's own Turn — the ordinary case, and the sheet button.",
  }),
  whenAttacked: Object.freeze({
    id: "whenAttacked",
    dispatched: true,
    hint: "When this Unit is attacked, as a reaction inside the attacker's Combat Process.",
  }),
  whenAllyAttacked: Object.freeze({
    id: "whenAllyAttacked",
    dispatched: true,
    hint: "When an allied Unit nearby is about to be hit — the bearer is neither attacker nor defender.",
  }),
  damageStep: Object.freeze({
    id: "damageStep",
    dispatched: true,
    hint: "At the start of a Damage Step, on this Unit's OWN attack.",
  }),
  combatPhaseStart: Object.freeze({
    id: "combatPhaseStart",
    dispatched: true,
    hint: "At the start of a Combat Phase, on this Unit's own attack.",
  }),
  whenTargetedByNP: Object.freeze({
    id: "whenTargetedByNP",
    dispatched: true,
    hint: "When a Noble Phantasm is DECLARED against this Unit, before any Combat Process exists.",
  }),
});

/** @type {readonly string[]} */
export const ABILITY_WINDOW_IDS = Object.freeze(Object.keys(ABILITY_WINDOWS));

/** The window an ability must name to be offered as a defender's reaction. */
export const REACTION_WINDOW = ABILITY_WINDOWS.whenAttacked.id;

/** The window for an ability somebody else's peril triggers. */
export const ALLY_WINDOW = ABILITY_WINDOWS.whenAllyAttacked.id;

/**
 * The window answering a DECLARATION rather than a moment inside a Process —
 * Mannanán's Fragarach, which stops the Process from happening at all.
 */
export const NP_DECLARATION_WINDOW = ABILITY_WINDOWS.whenTargetedByNP.id;

/** The start of a Damage Step, on this Unit's own attack. */
export const DAMAGE_STEP_WINDOW = ABILITY_WINDOWS.damageStep.id;

/** The start of a Combat Phase, on this Unit's own attack. */
export const COMBAT_PHASE_START_WINDOW = ABILITY_WINDOWS.combatPhaseStart.id;

/**
 * The windows the **attacker's own** abilities may name.
 *
 * Two in the reference set and both were inert before they had a dispatcher:
 * Asterios's *Monstrous Strength* (*"at the start of a Damage Step when
 * performing an Attack"*) and Karna's *Uncrowned Arms Mastership* (*"during
 * your Turn or at the start of a Combat Phase"*).
 */
export const ATTACKER_WINDOWS = Object.freeze([
  DAMAGE_STEP_WINDOW,
  COMBAT_PHASE_START_WINDOW,
]);

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isAbilityWindow(id) {
  return typeof id === "string" && Object.hasOwn(ABILITY_WINDOWS, id);
}

/**
 * The windows one `timing` block names, as a list.
 *
 * A window may be a single string or a list of them — Karna's Uncrowned Arms
 * Mastership is *"used during your Turn or at the start of a Combat Phase"* —
 * so every consumer flattens. This is that flattening, in one place, rather
 * than `[sys.timing?.window ?? []].flat()` repeated at each call site.
 *
 * @param {object|null|undefined} timing
 * @returns {string[]}
 */
export function windowsOf(timing) {
  return [timing?.window ?? []].flat().filter((w) => typeof w === "string");
}

/**
 * Is this ability usable at no moment but its owner's own Turn?
 *
 * *"(Active) Used during your Turn."* `ownTurn` was read in one place, so it
 * gated Modes and nothing else, and Quetzalcoatl's Lucha Libre was pressed on
 * the enemy's Turn and resolved (#160).
 *
 * Only when `ownTurn` is the ONLY window. An ability that also names another
 * moment -- Medea's Argos, *"used during your Turn or when Attacked"*, Karna's
 * Uncrowned Arms Mastership at a Combat Phase -- is used at one or the other,
 * and the use gate cannot tell which, so it asks nothing of it.
 *
 * @param {object|null|undefined} ability an ability, or its usage spec
 * @returns {boolean}
 */
export function usedOnlyDuringOwnTurn(ability) {
  const windows = windowsOf(ability?.timing);
  return windows.length > 0 && windows.every((w) => w === ABILITY_WINDOWS.ownTurn.id);
}
