/**
 * @file The sheet's arithmetic, with no world in it.
 * @see docs/29-user-interface.md §29.2
 *
 * Layer 4, but deliberately **pure**: no `game`, no documents, no `canvas`,
 * nothing that has to be running to answer. Everything here is a question with
 * an answer — what percentage that bar is, how many turns are left on that
 * effect, why that button is disabled, what "Stage 3" costs — and a question
 * with an answer belongs in a test rather than inside a template that can only
 * be checked by opening it and looking.
 *
 * `context.mjs` is the impure half. It fetches, and hands the results here.
 */

import { periodicDamageFor } from "../../engine/scheduler.mjs";

/**
 * The five parameters, in the order every reference sheet prints them.
 *
 * Object key order would otherwise decide it, which means a Servant imported
 * from YAML shows them in whatever order its author typed — and a stat block
 * whose columns move between Servants cannot be read at a glance.
 */
const PARAMETER_ORDER = Object.freeze(["str", "end", "agi", "mag", "luc"]);

/** Vulgar fractions, so "1⅓◈" reads as a quantity rather than as arithmetic. */
const VULGAR = Object.freeze({
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
});

/**
 * One depleting resource, as a bar.
 *
 * @param {{value: number|null, max: number|null}|null} resource
 * @returns {{value: number|null, max: number|null, pct: number, label: string,
 *            undamageable: boolean}}
 */
export function resourceBar(resource) {
  const max = resource?.max ?? null;
  const value = resource?.value ?? null;

  // A `null` maximum means intrinsically undamageable -- Pale Rider, the
  // Kagome Spirits (Ch. 04) -- which is why the field is nullable rather than
  // zero. An empty track would read as "one hit from death", which is the
  // opposite of what it means.
  if (max === null) {
    return { value, max, pct: 0, label: "—", undamageable: true };
  }

  const held = value ?? 0;
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((held / max) * 100))) : 0;
  return { value: held, max, pct, label: `${held} / ${max}`, undamageable: false };
}

/**
 * The parameter row, with granted steps shown beside the rank in force.
 *
 * §5.6 keeps base parameters and granted steps apart *"because only granted
 * steps move Base Attack, and because a sheet that shows `B` where the Servant
 * was written `C` and granted one step is a sheet nobody can check"*.
 *
 * `rank` is **the written Rank** and stays the editable field: it is the one
 * tile whose job is being checkable against the paper sheet it came from.
 * `effective` is the Rank every rule is actually reading — `rules/snapshot.mjs`
 * folds the Master's `grantedSteps` and the war Region's bonus into it without
 * touching `system.parameters` — and the two are shown as a transition,
 * `B ▸ B+`, when they differ.
 *
 * This tile used to show the written Rank ALONE, on the argument that an arrow
 * would print a Rank the Servant was never written with. That argument was
 * sound when nothing shifted the Rank; it stopped being sound once
 * `applyGrantedSteps` and `applyRegionBonus` did. Showing only the written Rank
 * then meant the number on the tile was not the number Magic Resistance, the
 * damage table rows or a `Rank.gte` gate were using, and a player checking one
 * against the other found a disagreement the sheet never explained.
 *
 * @param {Record<string, string>} parameters the WRITTEN ranks
 * @param {Record<string, number>} [grantedSteps] steps granted post-summon
 * @param {Record<string, object>|null} [effective] the projected ranks in force
 * @returns {Array<{key: string, rank: string, steps: number, plus: string, granted: boolean}>}
 */
export function parameterTiles(parameters, grantedSteps = {}, effective = null) {
  const keys = [
    ...PARAMETER_ORDER.filter((k) => k in (parameters ?? {})),
    ...Object.keys(parameters ?? {}).filter((k) => !PARAMETER_ORDER.includes(k)),
  ];

  return keys.map((key) => {
    const raw = parameters?.[key];
    const steps = grantedSteps?.[key] ?? 0;
    const rank = raw ? String(raw) : "—";
    // What the rules are actually reading, off the projection: the written Rank
    // shifted by the Master's grant AND by the war Region's, plus anything else
    // that moves a Rank. Compared as STRINGS rather than derived from `steps`,
    // because `steps` knows only about the Master and the tile must not claim a
    // transition the snapshot does not agree with.
    const now = effective?.[key] ? String(effective[key]) : null;
    return {
      key,
      rank,
      // The transition, shown only when there IS one. The written Rank stays on
      // the tile and stays editable -- it is the one field on this sheet whose
      // job is being checkable against the paper sheet it came from -- and the
      // Rank in force sits beside it rather than replacing it.
      effective: now,
      shifted: Boolean(now && now !== rank),
      steps,
      // The grant as the RANK LADDER writes it. Ch. 04 §4.5 states it as *"a
      // free `+` to one of their Servant's Parameters"*, and a granted step is
      // literally that: A becomes A+, A+ becomes A++. "+1" is arithmetic this
      // ladder does not do anywhere else on the sheet, and it reads as a
      // numeric bonus to a value rather than a step up a scale.
      plus: steps > 0 ? "+".repeat(steps) : (steps < 0 ? "-".repeat(-steps) : ""),
      granted: steps > 0,
    };
  });
}

/**
 * The written Base Attack and the one in force, as the tile shows them.
 *
 * The same fault the parameter tiles had, in the one place it costs the most:
 * this panel read `system.baseAttack` while every other field beside it read
 * the projection. A Servant fielded in her own war Region has the Region's ±10
 * per component folded into the Rank the damage pipeline reads, so her sheet
 * said 125 while every attack she made used 135, and nothing on the sheet
 * explained the gap.
 *
 * Written first, because this panel is checkable against the paper sheet for
 * the same reason the parameter tile is.
 *
 * @param {{str: number, mag: number}|null} written `system.baseAttack`
 * @param {{str: number, mag: number}|null} effective the projection's
 * @returns {object|null}
 */
export function baseAttackTiles(written, effective) {
  if (!written) return null;
  const one = (key) => {
    const value = written[key] ?? 0;
    const now = effective?.[key];
    return {
      value,
      effective: Number.isFinite(now) ? now : null,
      shifted: Number.isFinite(now) && now !== value,
    };
  };
  return { str: one("str"), mag: one("mag") };
}

/**
 * Turns left before an effect expires.
 *
 * `null` out of combat rather than a large number: with no ticks there is
 * nothing for an expiry to count down against, and inventing "999" would put a
 * duration on screen that no rule agrees with.
 *
 * @param {number|null|undefined} expiry the ◈ tick the effect ends on
 * @param {number|null|undefined} tick the current ◈ tick
 * @returns {number|null}
 */
export function remainingTurns(expiry, tick) {
  if (expiry === null || expiry === undefined) return null;
  if (tick === null || tick === undefined) return null;
  return Math.max(0, expiry - tick);
}

/**
 * A turn count, in the ◈ notation the sheets are authored in.
 *
 * Both notations get shown together, never one alone: `◈` is what the ability
 * was written with and turns are what a player counts down, and a reader who
 * has only one of them has to do the conversion that this exists to spare them.
 *
 * Not `formatTick` — that renders a parsed expression back to its source, and
 * what is in hand here is a resolved turn count going the other way.
 *
 * @param {number} turns
 * @param {number} turnsPerRound
 * @returns {string} `""` for no turns at all
 */
export function ticksLabel(turns, turnsPerRound) {
  const tpr = turnsPerRound > 0 ? turnsPerRound : 1;
  if (!turns || turns <= 0) return "";

  const whole = Math.floor(turns / tpr);
  const rest = turns % tpr;
  if (rest === 0) return `${whole}◈`;

  const divisor = gcd(rest, tpr);
  const key = `${rest / divisor}/${tpr / divisor}`;
  const frac = VULGAR[key] ?? `${key}`;
  return whole === 0 ? `${frac}◈` : `${whole}${frac}◈`;
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Why an ability may or may not be used, as the card shows it.
 *
 * Takes the verdict `canUseAbility` returned — the **same call**
 * `engine/attack.mjs` makes before it resolves anything — rather than reading
 * the cooldown fields again. A card that computed its own answer would be a
 * second implementation of §15.10, and the copy is the one nobody updates.
 *
 * The default branch matters more than the named ones. A gate added to
 * `rules/costs.mjs` later will arrive here as a reason this function has never
 * heard of, and falling through to `FGT.Ability.Refused.<reason>` means the
 * worst case is an untranslated key on screen — not a disabled button with no
 * explanation, which is the one thing D29.2 forbids.
 *
 * @param {{ok: boolean, reason?: string, detail?: object}} verdict
 * @param {{turnsPerRound?: number}} [ctx]
 * @returns {{ok: boolean, label: string, detail: object}}
 */
export function abilityState(verdict, { turnsPerRound = 3 } = {}) {
  if (verdict?.ok !== false) return { ok: true, label: "FGT.Ability.Ready", detail: {} };

  const detail = { ...(verdict.detail ?? {}) };
  switch (verdict.reason) {
    case "cooldown":
      detail.ticks = ticksLabel(detail.remaining ?? 0, turnsPerRound);
      return { ok: false, label: "FGT.Ability.Cooldown", detail };

    case "exhausted":
      return { ok: false, label: "FGT.Ability.Exhausted", detail };

    case "round":
      // How far away, not just which Round: "Round 6" makes a player count.
      detail.away = Math.max(0, (detail.requiresRound ?? 0) - (detail.round ?? 0));
      return { ok: false, label: "FGT.Ability.FromRound", detail };

    default:
      return { ok: false, label: `FGT.Ability.Refused.${verdict.reason}`, detail };
  }
}

/**
 * What using this ability costs, and whether the payer can pay it.
 *
 * Affordability is **stated, not implied** (§29.2's worked example): a player
 * who is shown "Master cost 53 Health" still has to go and look at the Master,
 * and the look is where the mistake happens.
 *
 * @param {{kind: string, amount: number}|null} cost from `npCost`
 * @param {{name?: string, health?: {value?: number}}|null} master
 * @param {{sustainability?: number}|null} [unit] for a Free Servant's own clock
 * @returns {{kind: string, amount: number, payer: string|null, has: number,
 *            affordable: boolean}|null} `null` when nothing is charged
 */
export function abilityCost(cost, master, unit = null) {
  if (!cost || !(cost.amount > 0)) return null;

  if (cost.kind === "sustainability") {
    // A Free Servant pays with its own clock -- there is no Master to bill.
    const has = unit?.sustainability ?? 0;
    return { kind: cost.kind, amount: cost.amount, payer: null, has, affordable: has >= cost.amount };
  }

  const has = master?.health?.value ?? 0;
  return {
    kind: cost.kind,
    amount: cost.amount,
    payer: master?.name ?? null,
    has,
    // No Master at all is not affordable. A Servant whose Master has died
    // cannot pay a Master Health cost, and "—" beside a usable button would
    // read as free.
    affordable: Boolean(master) && has >= cost.amount,
  };
}

/**
 * Every effect on a unit, grouped the way §29.2 groups them.
 *
 * Takes a **lookup function** rather than the registry itself, which is what
 * keeps this module pure: `context.mjs` passes `(id) => EffectRegistry.get(id)`
 * and a test passes a plain object's accessor.
 *
 * An instance whose definition is missing goes to `unknown` rather than being
 * dropped. A silently discarded effect is this project's recurring failure
 * shape — it loads, it does nothing, and nothing reports it — and an effect
 * that is really on the unit but absent from the registry is exactly the case
 * a GM needs to see.
 *
 * @param {object[]} instances from `snapshot.effectInstances`
 * @param {(id: string) => object|null} lookup
 * @param {object} unit the bearer's snapshot, for the periodic amplifiers
 * @returns {{buffs: object[], debuffs: object[], statuses: object[], unknown: object[]}}
 */
export function groupEffects(instances, lookup, unit) {
  /** @type {{buffs: object[], debuffs: object[], statuses: object[], unknown: object[]}} */
  const out = { buffs: [], debuffs: [], statuses: [], unknown: [] };

  for (const instance of instances ?? []) {
    const def = lookup(instance.defId) ?? null;
    const row = {
      ...instance,
      name: def?.name ?? instance.defId,
      img: def?.img ?? null,
      // `polarity` is the buff/debuff/status axis §29.2 groups by. `valence`
      // is a DIFFERENT axis -- offensive/defensive/neutral -- and grouping on
      // it filed every debuff in the catalogue under Statuses, because no
      // effect in the pack has `valence: debuff` at all.
      polarity: def?.polarity ?? null,
      valence: def?.valence ?? null,
      severity: def?.severity ?? null,
      // Nothing offers an [x] for an effect the rules say cannot be removed.
      removable: !def?.unremovable,
      known: Boolean(def),
      // The number D29.4 names as the one players get wrong: "Stage 3" does
      // not look like 80 until somebody does 20 x 2^(3-1) out loud.
      periodic: periodicDamageFor(instance, unit),
    };

    if (!def) out.unknown.push(row);
    else if (def.polarity === "buff") out.buffs.push(row);
    else if (def.polarity === "debuff") out.debuffs.push(row);
    else out.statuses.push(row);
  }

  return out;
}

/**
 * One standing modifier, as a row a player can read.
 *
 * The modifier table answers *"why is my attack +50%"*, and it can only answer
 * it if the condition is legible: a predicate rendered straight into a template
 * arrives as `[object Object]`, which answers nothing.
 *
 * @param {object} mod from `snapshot.modifiers`
 * @returns {{key: string, value: number, component: string|null, source: string,
 *            predicate: string|null}}
 */
export function describeModifier(mod) {
  return {
    key: mod?.key ?? "",
    value: mod?.value ?? 0,
    component: mod?.component ?? null,
    // An unattributed modifier is worse than none: it moves a number and names
    // nothing to go and look at.
    source: mod?.source ?? "FGT.Sheet.UnknownSource",
    predicate: predicateText(mod?.predicate),
  };
}

/**
 * A predicate array as readable text.
 *
 * @param {Array<string|object>|null|undefined} predicate
 * @returns {string|null} `null` when the modifier is unconditional
 */
function predicateText(predicate) {
  const clauses = (predicate ?? []).map(clauseText).filter(Boolean);
  return clauses.length > 0 ? clauses.join(" · ") : null;
}

/**
 * @param {string|object} clause
 * @returns {string}
 */
function clauseText(clause) {
  if (typeof clause === "string") return clause;
  if (!clause || typeof clause !== "object") return "";
  return Object.entries(clause)
    .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" ");
}
