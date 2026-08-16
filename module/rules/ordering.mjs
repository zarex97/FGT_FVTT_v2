/**
 * @file Element priority bands.
 * @see docs/24-rules-engine.md §24.6, docs/06-stats-and-resources.md §6.11
 *
 * Layer 2 (rules). Pure.
 *
 * Elements applied in collection order give different answers on different
 * clients, because collection order is document load order. Bands fix the
 * *what* and the source id fixes the *tie*, so every client computes the same
 * number from the same board.
 *
 * The two bands that matter most are 30 and 35. An aura must be **collected**
 * before anything **reads** one — `Clarity` doubles the `Area CritUp` it
 * receives, and running it first would double nothing.
 */

/** The bands, in the order they apply. */
export const PRIORITY_BANDS = Object.freeze({
  base: 10,
  additive: 20,
  auraCollection: 30,
  auraConsumers: 35,
  multiplicative: 40,
  applicationChance: 50,
  absoluteSet: 60,
  immunity: 70,
  bounds: 80,
  suppression: 90,
});

/** Which band each element key belongs to. */
const BY_KEY = Object.freeze({
  RankShift: PRIORITY_BANDS.base,
  SizeStep: PRIORITY_BANDS.base,

  StatDelta: PRIORITY_BANDS.additive,
  MovDelta: PRIORITY_BANDS.additive,
  RangeDelta: PRIORITY_BANDS.additive,
  MaxDelta: PRIORITY_BANDS.additive,
  ZonBonus: PRIORITY_BANDS.additive,
  DamageModifier: PRIORITY_BANDS.additive,
  FlatDamage: PRIORITY_BANDS.additive,
  CritModifier: PRIORITY_BANDS.additive,
  BlockModifier: PRIORITY_BANDS.additive,
  CheckModifier: PRIORITY_BANDS.additive,
  RollAdjustment: PRIORITY_BANDS.additive,
  AttackerPropertyTier: PRIORITY_BANDS.additive,
  TargetingModifier: PRIORITY_BANDS.additive,
  ForceTarget: PRIORITY_BANDS.additive,
  Decoy: PRIORITY_BANDS.additive,
  WeakPoint: PRIORITY_BANDS.additive,
  Compulsion: PRIORITY_BANDS.additive,
  OnEvent: PRIORITY_BANDS.additive,
  GrantedAbility: PRIORITY_BANDS.additive,
  OfferAbilityUse: PRIORITY_BANDS.additive,
  SustainabilityGain: PRIORITY_BANDS.additive,
  RelationshipProxy: PRIORITY_BANDS.additive,
  Script: PRIORITY_BANDS.additive,

  Aura: PRIORITY_BANDS.auraCollection,

  ApplicationChance: PRIORITY_BANDS.applicationChance,

  TableOverride: PRIORITY_BANDS.absoluteSet,
  ReplaceAbility: PRIORITY_BANDS.absoluteSet,
  Disguise: PRIORITY_BANDS.absoluteSet,
  EffectVisibility: PRIORITY_BANDS.absoluteSet,
  StackingOverride: PRIORITY_BANDS.absoluteSet,

  Immunity: PRIORITY_BANDS.immunity,
  ImmunityDowngrade: PRIORITY_BANDS.immunity,
  DamageNegation: PRIORITY_BANDS.immunity,
  Resistance: PRIORITY_BANDS.immunity,
  Ward: PRIORITY_BANDS.immunity,
  AutoSucceed: PRIORITY_BANDS.immunity,

  Suppress: PRIORITY_BANDS.suppression,
});

/**
 * The band an element applies in.
 *
 * An **unknown** key gets the additive band rather than sorting to either end.
 * A new element must not silently gain the power to run before everything or
 * after everything simply by not being listed here.
 *
 * @param {object} element
 * @returns {number}
 */
export function bandOf(element) {
  // Content may override, which §24.6 permits with an `@intentional` marker.
  if (typeof element?.priority === "number") return element.priority;
  // An element that reads aura magnitudes runs in the consumer band, whatever
  // its key: it is the dependency that decides, not the name.
  if (element?.consumesAuras) return PRIORITY_BANDS.auraConsumers;
  return BY_KEY[element?.key] ?? PRIORITY_BANDS.additive;
}

/**
 * Sort elements into application order.
 *
 * Stable within a band by **source id**, so two clients holding the same
 * documents in different orders still compute the same result. That is the
 * whole reason this exists — a mismatch here is a desync nobody can reproduce.
 *
 * @param {object[]} elements
 * @returns {object[]} a new array
 */
export function orderElements(elements) {
  return [...(elements ?? [])]
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const byBand = bandOf(a.element) - bandOf(b.element);
      if (byBand !== 0) return byBand;
      const ida = String(a.element.sourceId ?? a.element.source ?? "");
      const idb = String(b.element.sourceId ?? b.element.source ?? "");
      return ida.localeCompare(idb) || a.index - b.index;
    })
    .map(({ element }) => element);
}
