/**
 * @file Bounded fields — the six-axis model.
 * @see docs/43-bounded-fields.md
 *
 * Layer 2 (rules). Pure.
 *
 * Ten fields across nine Servants, more than a third of the expanded roster.
 * They need a shared model or the engine grows ten special cases — which is the
 * whole argument of Ch. 43, and the reason this is one module rather than one
 * per Noble Phantasm.
 *
 * A field is a point in six axes: geometry, membership, isolation, interior
 * rules, duration, vulnerability. Everything each field does is a value in that
 * space; nothing here is named after a Servant.
 */

import { chebyshev } from "../domain/geometry.mjs";
import { currentHealth } from "../domain/health.mjs";
import { EXECUTORS, empty } from "./elements.mjs";

/* -------------------------------------------------------------------------- */
/*  NP tags — a real, ordered classification                                  */
/* -------------------------------------------------------------------------- */

/**
 * The **scale** tags, in order.
 *
 * "Anti-World or higher" and "Anti-Fortress or higher" are comparisons, so the
 * tags cannot be a flat vocabulary. Ch. 41 Q44 records that this ordering is a
 * construction from conventional usage rather than a stated rule.
 */
export const NP_TAG_SCALE = Object.freeze([
  "antiUnit", "antiArmy", "antiFortress", "antiCountry", "antiWorld",
]);

/**
 * Qualifiers that do **not** participate in the comparison.
 *
 * Listed rather than inferred, so a new tag is a deliberate decision about
 * which kind it is instead of an accident of not appearing in the scale.
 */
export const NP_TAG_QUALIFIERS = Object.freeze([
  "antiDivine", "antiBeast", "antiUnitSelf", "barrier", "fortress",
  "labyrinth", "counter", "boundedField", "unknown",
]);

/**
 * The highest scale an NP's tags reach, or `-1` for none.
 *
 * Ozymandias's is `[Anti-Fortress/Fortress/Anti-Unit]`; the comparison uses
 * Anti-Fortress, not the Anti-Unit it also carries.
 *
 * @param {string[]} tags
 * @returns {number}
 */
export function scaleOf(tags) {
  let best = -1;
  for (const t of tags ?? []) best = Math.max(best, NP_TAG_SCALE.indexOf(t));
  return best;
}

/**
 * Does this Noble Phantasm reach the required scale?
 *
 * `???` sorts as unknown and **never** satisfies a threshold: the field's check
 * surfaces a prompt for the GM rather than silently deciding either way.
 *
 * @param {string[]} npTags
 * @param {string} required
 * @returns {boolean}
 */
export function meetsTagThreshold(npTags, required) {
  const needed = NP_TAG_SCALE.indexOf(required);
  if (needed === -1) return false;
  return scaleOf(npTags) >= needed;
}

/* -------------------------------------------------------------------------- */
/*  Axis 1 — geometry                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The panels a field currently covers.
 *
 * @param {object} field
 * @param {object} board
 * @returns {Array<{i: number, j: number}>}
 */
export function panelsOf(field, board) {
  const geometry = field.geometry ?? {};

  switch (geometry.kind) {
    case "fixedArea":
      return square(geometry.anchor, geometry.shape?.size ?? 1);

    case "followsUnit": {
      // Doomsday Come tracks Pale Rider's *Master*, not its creator: the field
      // is a mobile prison, which is the whole design. So the reference is
      // named rather than assumed to be the owner.
      const anchorId = geometry.unitRef === "ownerMaster" ? field.ownerMasterId : field.ownerId;
      const anchor = (board?.units ?? []).find((u) => u.id === anchorId);
      return anchor?.panel ? square(anchor.panel, geometry.shape?.size ?? 1) : [];
    }

    case "freeform":
    case "markDefined":
    case "enclosing":
      // Drawn or derived at cast time and stored, because the player or the
      // marks decided it — not something to recompute from a shape spec.
      return field.panels ?? [];

    default:
      return field.panels ?? [];
  }
}

/**
 * The (size×size) block centred on a panel.
 * @param {{i: number, j: number}} centre
 * @param {number} size
 * @returns {Array<{i: number, j: number}>}
 */
function square(centre, size) {
  if (!centre) return [];
  const r = Math.floor(size / 2);
  /** @type {Array<{i: number, j: number}>} */
  const out = [];
  for (let di = -r; di <= r; di++) {
    for (let dj = -r; dj <= r; dj++) out.push({ i: centre.i + di, j: centre.j + dj });
  }
  return out;
}

/**
 * Is a panel inside the field?
 * @param {object} field
 * @param {{i: number, j: number}} panel
 * @param {object} board
 * @returns {boolean}
 */
export function contains(field, panel, board) {
  if (!panel) return false;
  return panelsOf(field, board).some((p) => p.i === panel.i && p.j === panel.j);
}

/* -------------------------------------------------------------------------- */
/*  Axis 2 — membership                                                       */
/* -------------------------------------------------------------------------- */

/**
 * How the field sees a unit.
 * @param {object} field
 * @param {object} unit
 * @param {object} board
 * @returns {"ally"|"enemy"}
 */
function relationTo(field, unit, board) {
  // The owner is its OWN relation, as everywhere else in the system. It was
  // folded into "ally", so a rule scoped `relations: [self]` matched nobody --
  // which is how EMIYA's "+50 Base Attack (STR) inside Unlimited Blade Works"
  // and Asterios's "+4 MOV inside the Labyrinth" both applied to the one Unit
  // they were written for and to no other.
  if (unit?.id && unit.id === field.ownerId) return "self";

  const owner = field.ownerFaction
    ?? (board?.units ?? []).find((u) => u.id === field.ownerId)?.faction
    ?? null;
  if (owner === null) return "enemy";
  const allied = board?.alliances?.[owner]?.includes(unit.faction) ?? unit.faction === owner;
  return allied ? "ally" : "enemy";
}

/**
 * May this unit cross the boundary in this direction?
 *
 * `rollRequired` is **not** a refusal — it is a refusal *of the free move*, and
 * the caller is expected to offer `escapeAttempt`. Conflating the two would
 * turn the Labyrinth from a puzzle into a wall.
 *
 * @param {object} field
 * @param {object} unit
 * @param {"enter"|"exit"} direction
 * @param {object} board
 * @returns {{ok: boolean, reason?: string}}
 */
export function membershipVerdict(field, unit, direction, board) {
  const rules = field.membership ?? {};

  // Sikera Ušum's Throne-Room branch: "all Units within the Throne Room WHEN
  // THE NP WAS ACTIVATED cannot leave it" -- a snapshot at creation, not a
  // standing rule that would also trap a Unit who wanders in and straight
  // back out later. `trappedUnitIds` is stamped once, at creation
  // (`engine/fields.mjs#createField`), and this policy is keyed on THAT
  // membership rather than the live ally/enemy split every other field uses.
  if (rules.trappedAtActivation && direction === "exit") {
    return (field.state?.trappedUnitIds ?? []).includes(unit?.id)
      ? { ok: false, reason: "trappedAtActivation" }
      : { ok: true };
  }

  const relation = relationTo(field, unit, board);
  const key = `${relation === "ally" ? "ally" : "enemy"}${direction === "enter" ? "Entry" : "Exit"}`;
  const policy = rules[key] ?? "free";

  if (policy === "free") return { ok: true };
  if (policy === "draggedIn") return { ok: true, reason: "draggedIn" };
  return { ok: false, reason: policy };
}

/**
 * One attempt at the escape ladder.
 *
 * The order is the specification's, and each rung refuses for its own reason so
 * a player is told which one stopped them:
 *
 *   1. reach the inner border,
 *   2. have movement left,
 *   3. roll under the accumulated chance.
 *
 * The **veteran** clause is what makes a Labyrinth a puzzle rather than a soft
 * lock: a unit that has escaped once always escapes, and can lead adjacent
 * allies out with it — so the correct play is to concentrate attempts on one
 * unit rather than spread them.
 *
 * @param {object} field
 * @param {object} unit
 * @param {object} ctx
 * @param {number} ctx.roll the caller rolls
 * @param {number} ctx.movRemaining
 * @param {object[]} [ctx.adjacentVeterans]
 * @returns {{ok: boolean, reason?: string, chance?: number, onFailure?: string}}
 */
export function escapeAttempt(field, unit, { roll, movRemaining, adjacentVeterans = [] }) {
  const spec = field.membership?.escape;
  if (!spec) return { ok: false, reason: "noEscapeRule" };

  const history = field.state?.escapeHistory ?? {};
  const mine = history[unit.id] ?? { failures: 0, escaped: false };

  // A veteran led out by proximity does not roll at all, and neither does one
  // who has escaped before.
  const veteranHere = mine.escaped;
  const led = spec.veteranBonus?.leadsAdjacentAllies
    && adjacentVeterans.some((v) => chebyshev(v.panel, unit.panel) <= 1
      && (history[v.id]?.escaped ?? false));

  if (spec.requiresBorderContact && !veteranHere && !led && !onInnerBorder(field, unit)) {
    return { ok: false, reason: "notAtBorder" };
  }
  if (spec.requiresRemainingMove && (movRemaining ?? 0) <= 0) {
    return { ok: false, reason: "noMovement" };
  }

  if (veteranHere) return { ok: true, reason: "veteran", chance: 100 };
  if (led) return { ok: true, reason: "ledOut", chance: 100 };

  // 1d20 at 20% means a roll of 4 or less; the chance is a percentage and the
  // die is whatever the field names, so the comparison is done in percent.
  const chance = (spec.baseChance ?? 0) + (spec.chanceIncreasePerFailure ?? 0) * mine.failures;
  const faces = Number(String(spec.formula ?? "1d20").split("d")[1] ?? 20);
  const succeeded = roll <= Math.round((chance / 100) * faces);

  return succeeded
    ? { ok: true, chance }
    : { ok: false, reason: "failed", chance, onFailure: spec.onFailure ?? "stayPut" };
}

/**
 * Is the unit standing on the field's inner edge?
 * @param {object} field
 * @param {object} unit
 * @returns {boolean}
 */
function onInnerBorder(field, unit) {
  const panels = panelsOf(field, { units: [] });
  if (panels.length === 0) return false;
  const is = panels.map((p) => p.i);
  const js = panels.map((p) => p.j);
  return unit.panel.i === Math.min(...is) || unit.panel.i === Math.max(...is)
    || unit.panel.j === Math.min(...js) || unit.panel.j === Math.max(...js);
}

/* -------------------------------------------------------------------------- */
/*  Axis 3 — isolation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Does the boundary stop this interaction?
 *
 * Full isolation partitions the board into two independent combats, which is a
 * strong statement: a player whose units straddle the boundary still takes one
 * turn and acts with both groups, but the groups cannot help each other.
 *
 * The duel field goes further and blocks **Command Spells** — the only thing in
 * the game that does — so that is its own axis rather than an inference from
 * isolation.
 *
 * @param {object} field
 * @param {object} attacker
 * @param {object} target
 * @param {object} board
 * @param {object} [ctx]
 * @param {boolean} [ctx.isCommandSpell]
 * @returns {{blocked: boolean, reason?: string}}
 */
export function isolationBlocks(field, attacker, target, board, ctx = {}) {
  const attackerIn = contains(field, attacker?.panel, board);
  const targetIn = contains(field, target?.panel, board);
  if (attackerIn === targetIn) return { blocked: false };

  const rules = field.isolation ?? {};

  if (ctx.isCommandSpell) {
    return rules.blocksCommandSpells
      ? { blocked: true, reason: "commandSpellsBlocked" }
      : { blocked: false };
  }

  if (!attackerIn && targetIn && rules.outsideCanTargetInside === false) {
    return { blocked: true, reason: "outsideCannotTargetInside" };
  }
  if (attackerIn && !targetIn && rules.insideCanTargetOutside === false) {
    return { blocked: true, reason: "insideCannotTargetOutside" };
  }
  return { blocked: false };
}

/* -------------------------------------------------------------------------- */
/*  Axis 4 — interior rules                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The field's rules, for a unit standing in it.
 *
 * @param {object} field
 * @param {object} unit
 * @param {object} board
 * @returns {object[]}
 */
export function interiorModifiers(field, unit, board) {
  if (!contains(field, unit?.panel, board)) return [];
  const relation = relationTo(field, unit, board);

  return (field.interior ?? [])
    .filter((rule) => (rule.relations ?? ["ally", "enemy"]).includes(relation))
    .map((rule) => ({ ...rule, field: field.id, source: field.id }));
}

/**
 * A field's interior rules, run through the SAME executor table an ability's
 * `passiveRules` are (`rules/elements.mjs`'s `EXECUTORS`), rather than the
 * narrower raw dump `annotateFields` used to do.
 *
 * The dump worked for `DamageModifier`-shaped rules, which read back off
 * `modifiers` in their AUTHORED shape by coincidence -- but an interior rule
 * key whose executor transforms the shape or routes to a DIFFERENT bucket
 * (`ImmunityDowngrade` → `suppressions`; Sikera Ušum's `VulnerabilityAmplifier`
 * and `PeriodicOverride` → their own dedicated lists) went into `modifiers`
 * verbatim and was read by nothing there.
 *
 * @param {object} field
 * @param {object} unit
 * @param {object} board
 * @returns {import("./elements.mjs").Contributions}
 */
export function interiorContributions(field, unit, board) {
  const out = empty();
  for (const rule of interiorModifiers(field, unit, board)) {
    const execute = EXECUTORS[rule.key];
    if (!execute) continue;
    execute(rule, { rank: null, source: rule.source, ability: null, out, ctx: {} });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Axis 5 — duration and extension                                           */
/* -------------------------------------------------------------------------- */

/**
 * What extending this field would cost, and whether the payer can pay.
 *
 * Paid extension is an attrition engine: the owner burns their own resource to
 * keep the trap shut while the trapped burn theirs getting out. Both fields
 * that have it charge **Health**, and both refuse below the cost rather than
 * allowing it to reach zero.
 *
 * @param {object} field
 * @param {object} payer
 * @returns {{ok: boolean, reason?: string, amount?: number, grants?: string}}
 */
export function extensionFor(field, payer) {
  const spec = field.extension;
  if (!spec) return { ok: false, reason: "notExtendable" };

  const amount = spec.cost?.amount ?? 0;
  if (currentHealth(payer) < amount) return { ok: false, reason: "cannotAfford", amount };

  return { ok: true, amount, grants: spec.grants, repeatable: Boolean(spec.repeatable) };
}

/* -------------------------------------------------------------------------- */
/*  Axis 6 — vulnerability                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Has anything just broken the field?
 *
 * @param {object} field
 * @param {object} event
 * @returns {{triggered: boolean, result?: string, reason?: string}}
 */
export function vulnerabilityTriggered(field, event) {
  for (const v of field.vulnerabilities ?? []) {
    switch (v.kind) {
      case "ownerDefeat":
        if (event.kind === "ownerDefeat") return { triggered: true, result: v.result ?? "end" };
        break;

      case "npTagAtLeast":
        if (event.kind === "npUsed" && meetsTagThreshold(event.npTags, v.tag)) {
          return { triggered: true, result: v.result ?? "end" };
        }
        break;

      case "npCount":
        // "Two Anti-Fortress or higher NPs in the same Round" — the count is
        // kept by the caller, because the window is a property of the match.
        if (event.kind === "npUsed"
          && meetsTagThreshold(event.npTags, v.tag)
          && (event.countThisWindow ?? 0) >= (v.threshold ?? 1)) {
          return { triggered: true, result: v.result ?? "end" };
        }
        break;

      case "damageThreshold":
        if (event.kind === "damage" && (event.damageThisWindow ?? 0) > (v.threshold ?? Infinity)) {
          return { triggered: true, result: v.result ?? "end" };
        }
        break;

      case "markDestruction":
        if (event.kind === "markDestroyed" && (event.marksRemaining ?? 1) <= 0) {
          return { triggered: true, result: v.result ?? "end" };
        }
        break;

      default:
        break;
    }
  }
  return { triggered: false };
}

/* -------------------------------------------------------------------------- */
/*  The board pass                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Tell every unit which fields it stands in, and give it their interior rules.
 *
 * Positional, like auras and terrain, and settled in the same place for the
 * same reason: only the board knows who is standing where.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
export function annotateFields(units, board) {
  const fields = board?.fields ?? [];

  for (const u of units ?? []) {
    u.fields = [];
    if (fields.length === 0) continue;

    /** @type {object[]} */
    const gained = [];
    for (const field of fields) {
      if (!contains(field, u.panel, board)) continue;
      u.fields.push(field.id);
      gained.push(...interiorModifiers(field, u, board));
    }
    // A stat-shaped rule moves the snapshot's OWN value directly: the field
    // pass runs after `prepareDerivedData` (a per-document Foundry hook that
    // cannot know about a board-wide area), so nothing else would fold it in.
    const [stats, rest] = partition(gained, (rule) => STAT_INTERIOR.has(rule.key));
    for (const rule of stats) applyInteriorStat(u, rule);

    // Everything else runs through the SAME executor table an ability's
    // `passiveRules` do (`interiorContributions`), so a rule that routes to
    // `suppressions` or its own dedicated bucket actually lands there instead
    // of sitting in `modifiers` unread.
    const out = empty();
    for (const rule of rest) {
      const execute = EXECUTORS[rule.key];
      if (!execute) continue;
      execute(rule, { rank: null, source: rule.source, ability: null, out, ctx: {} });
    }
    if (out.modifiers.length > 0) u.modifiers = [...(u.modifiers ?? []), ...out.modifiers];
    if (out.suppressions.length > 0) u.suppressions = [...(u.suppressions ?? []), ...out.suppressions];
    if (out.applicationChances.length > 0) {
      u.applicationChances = [...(u.applicationChances ?? []), ...out.applicationChances];
    }
    if (out.vulnerabilityAmplifiers.length > 0) {
      u.vulnerabilityAmplifiers = [...(u.vulnerabilityAmplifiers ?? []), ...out.vulnerabilityAmplifiers];
    }
    if (out.periodicOverrides.length > 0) {
      u.periodicOverrides = [...(u.periodicOverrides ?? []), ...out.periodicOverrides];
    }
    if (out.damageNegation.length > 0) {
      u.damageNegation = [...(u.damageNegation ?? []), ...out.damageNegation];
    }
  }
}

/**
 * Interior rule keys that move a STAT rather than contributing a modifier.
 *
 * The field annotation runs after `prepareDerivedData` -- it needs the whole
 * board, and derived data is per-document -- so these are folded onto the
 * snapshot directly. Everything else goes into `modifiers`, where the damage
 * pipeline reads it.
 */
const STAT_INTERIOR = new Set(["StatDelta", "MovDelta", "RangeDelta"]);

/**
 * @param {object[]} list
 * @param {(item: object) => boolean} predicate
 * @returns {[object[], object[]]}
 */
function partition(list, predicate) {
  /** @type {object[]} */ const yes = [];
  /** @type {object[]} */ const no = [];
  for (const item of list) (predicate(item) ? yes : no).push(item);
  return [yes, no];
}

/**
 * Fold one stat-shaped interior rule onto a unit snapshot.
 *
 * `minimum` is Asterios's *"MOV reduced by 2, minimum 2"* -- a floor on the
 * resulting value rather than on the deduction, which is the opposite of Mad
 * Enhancement's Master drain and worth not confusing.
 *
 * @param {object} unit
 * @param {object} rule
 * @returns {void}
 */
function applyInteriorStat(unit, rule) {
  const path = rule.key === "MovDelta" ? "mov"
    : rule.key === "RangeDelta" ? "range.panels"
      : rule.stat;
  if (!path) return;

  const parts = String(path).split(".");
  const leaf = parts.pop();
  let node = unit;
  for (const part of parts) {
    if (node[part] === null || node[part] === undefined) return;
    node = node[part];
  }
  if (typeof node[leaf] !== "number") return;

  const next = node[leaf] + (rule.value ?? 0);
  node[leaf] = typeof rule.minimum === "number" ? Math.max(rule.minimum, next) : next;
}
