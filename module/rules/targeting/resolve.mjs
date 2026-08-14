/**
 * @file The eleven-step targeting resolution algorithm.
 * @see docs/09-targeting.md §9.7
 *
 * Layer 2 (rules). Pure — consumes a board snapshot, returns targets. Nothing
 * writes, which is what lets the preview run the real resolver rather than an
 * approximation of it.
 *
 * The four axes (§9.2) stay orthogonal on purpose: nine anchors × eleven shapes
 * × six selections covers every declaration in both rosters, and new content
 * composes rather than extends.
 */

import * as geo from "../../domain/geometry.mjs";
import { NEUTRAL_FACTION } from "../../domain/enums.mjs";
import { expand, DELTA } from "./shapes.mjs";
import { test as testPredicate } from "../predicate.mjs";

/**
 * @typedef {import("../../domain/geometry.mjs").GridOffset} GridOffset
 */

/**
 * @typedef {object} TargetedUnit
 * @property {string} unitId
 * @property {number} distance Chebyshev, from the caster
 * @property {number} band 0 when the shape is not banded
 * @property {boolean} concealedAoE hit by an AoE while concealed, not chosen
 * @property {string} relation
 */

/**
 * @typedef {object} ExcludedUnit
 * @property {string} unitId
 * @property {string} name
 * @property {string} reason why this unit, though in the area, is not a target
 */

/**
 * @typedef {object} ResolvedTargets
 * @property {TargetedUnit[]} units
 * @property {GridOffset[]} panels
 * @property {object} anchor
 * @property {string[]} warnings
 * @property {string[]} errors placement is illegal while this is non-empty
 * @property {boolean} needsChoice the player must pick from `candidates`
 * @property {TargetedUnit[]} candidates
 * @property {ExcludedUnit[]} excluded in the area, filtered out, and why
 */

/**
 * Resolve a targeting declaration.
 *
 * @param {object} spec a `TargetSpec` — `{anchor, shape, selection, limits}`
 * @param {object} caster the caster's unit snapshot
 * @param {object} board the board snapshot
 * @param {object} [placement] the player's choices: `{panel, direction, unitId, chosenIds, path}`
 * @returns {ResolvedTargets}
 */
export function resolveTargets(spec, caster, board, placement = {}) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {ExcludedUnit[]} */
  const excluded = [];

  /**
   * Record why a unit standing in the area is not a target.
   *
   * Always returns `false`, so a filter predicate reads
   * `keepIt || drop(u, why)` and the reason is captured at the point the
   * decision is made rather than reconstructed afterwards.
   * @param {object} u
   * @param {string} reason
   * @returns {false}
   */
  const drop = (u, reason) => {
    excluded.push({ unitId: u.id, name: u.name ?? u.id, reason });
    return false;
  };

  // 0. The caster has to be somewhere. An unplaced caster used to measure every
  //    distance from {0,0}, so every range check failed and the only symptom
  //    was an empty target list.
  if (!caster.panel) {
    errors.push(`${caster.name ?? "The attacker"} is not placed on the board.`);
    return { units: [], panels: [], anchor: {}, warnings, errors, needsChoice: false, candidates: [], excluded };
  }

  // 1. ANCHOR
  const anchor = resolveAnchor(spec.anchor, caster, board, placement, errors);

  // 2. SHAPE
  const { panels, bands } = expand(spec.shape ?? { kind: "point" }, anchor, {
    bounds: board.bounds ?? null,
    caster: caster.panel,
  });

  // 3. OCCUPANCY — a multi-panel unit is included if ANY of its panels intersect.
  const panelKeys = new Set(panels.map(geo.key));
  const occupants = [];
  for (const u of board.units ?? []) {
    const footprint = u.panels ?? (u.panel ? [u.panel] : []);
    if (!footprint.some((p) => panelKeys.has(geo.key(p)))) continue;
    occupants.push(u);
  }

  const sel = spec.selection ?? {};
  const limits = spec.limits ?? {};
  let survivors = occupants;

  // 4. RELATION FILTER, including the self-inclusion rule.
  const relations = new Set(sel.relations ?? ["enemy"]);
  const includeSelf = resolveIncludeSelf(sel, spec);
  survivors = survivors.filter((u) => {
    if (u.id === caster.id) return includeSelf || drop(u, "the attacker itself");
    const relation = relationOf(caster, u, board);
    return relations.has(relation) || drop(u, relationReason(relation, caster, u, relations));
  });

  // 5. KIND FILTER — platforms and structures are excluded unless asked for.
  const kinds = sel.kinds ?? null;
  survivors = survivors.filter((u) => {
    if (kinds) return kinds.includes(u.kind) || drop(u, `a ${u.kind}; this ability targets ${kinds.join(" or ")}`);
    if (u.kind === "platform" || u.kind === "structure") return drop(u, `a ${u.kind}`);
    return true;
  });
  if (limits.forbidCivilians === "ifGoodAligned" && caster.alignment?.moral === "good") {
    const civilians = survivors.filter((u) => u.kind === "civilian");
    if (civilians.length > 0) {
      errors.push(
        "Good-aligned Servants will not use an AoE Noble Phantasm with a Civilian in range. " +
          "Spend a Command Spell (Kill Humans) to override.",
      );
    }
  }

  // 6. ATTRIBUTE FILTER
  if (sel.attributes) {
    survivors = survivors.filter((u) =>
      testPredicate(sel.attributes, {
        options: optionsForUnit(u),
        refs: { self: caster, target: u, board },
      }) || drop(u, "excluded by this ability's target predicate"),
    );
  }

  // 7. VISIBILITY — concealment blocks *targeting*, but an AoE still catches
  //    the unit; it just gets the coin flip instead (Presence Concealment 1).
  const chooser = sel.chooser ?? "all";
  const isChosen = chooser === "chosen" || (sel.count !== undefined && sel.count !== "unlimited");
  if (sel.excludeConcealed !== false && isChosen) {
    const before = survivors.length;
    survivors = survivors.filter(
      (u) => !u.concealed || u.id === caster.id || drop(u, "concealed — it cannot be targeted directly"),
    );
    if (survivors.length < before) warnings.push("Concealed units cannot be targeted directly.");
  }

  // 8. PROTECTION — a Master adjacent to a Servant of its own faction cannot be
  //    targeted through it, unless the attacker bypasses protection.
  if (!limits.bypassMasterProtection && !caster.bypassesMasterProtection) {
    const before = survivors.length;
    survivors = survivors.filter(
      (u) => !isProtectedMaster(u, caster, board) || drop(u, "a Master protected by an adjacent Servant"),
    );
    if (survivors.length < before) warnings.push("Protected Masters were excluded.");
  }
  if (board.crossLevel) {
    survivors = survivors.filter((u) => crossLevelAllows(caster, u, spec, board, warnings, drop));
  }

  // 9. CHOOSER
  const withMeta = survivors.map((u) => toTargeted(u, caster, bands));
  let chosen = withMeta;
  let needsChoice = false;
  /** @type {TargetedUnit[]} */
  let candidates = [];
  const count = sel.count === "unlimited" ? Infinity : (sel.count ?? Infinity);

  switch (chooser) {
    case "all":
      break;
    case "nearest":
      chosen = [...withMeta].sort((a, b) => a.distance - b.distance).slice(0, count);
      break;
    case "random":
      chosen = seededShuffle(withMeta, board.seed ?? 0).slice(0, count);
      break;
    case "chosen": {
      candidates = withMeta;
      const picked = placement.chosenIds;
      if (picked) {
        const set = new Set(picked);
        chosen = withMeta.filter((t) => set.has(t.unitId));
        if (chosen.length > count) {
          errors.push(`Select at most ${count} target${count === 1 ? "" : "s"}.`);
        }
      } else {
        needsChoice = withMeta.length > 0;
        chosen = [];
      }
      break;
    }
    default:
      throw new RangeError(`FGT | Unknown chooser "${chooser}".`);
  }

  // 10. LIMITS
  if (limits.maxTargets !== undefined && chosen.length > limits.maxTargets) {
    chosen = chosen.slice(0, limits.maxTargets);
  }
  if (limits.minTargets !== undefined && !needsChoice && chosen.length < limits.minTargets) {
    errors.push(`This ability requires at least ${limits.minTargets} target(s).`);
  }
  if (limits.requiresZon && caster.outsideZon) {
    errors.push(
      `Noble Phantasms require the Servant to be within its Master's ZON ` +
        `(currently ${caster.zonDistance ?? "?"} panels away, ZON is ${caster.zon ?? "?"}).`,
    );
  }
  if (limits.requiresCasterIn && !(caster.zones ?? []).includes(limits.requiresCasterIn)) {
    errors.push(`This ability can only be used within ${limits.requiresCasterIn}.`);
  }
  if (limits.forbidsCasterIn && (caster.zones ?? []).includes(limits.forbidsCasterIn)) {
    errors.push(`This ability cannot be used within ${limits.forbidsCasterIn}.`);
  }

  // 11. RESULT
  if (chosen.length === 0 && !needsChoice && errors.length === 0) {
    // A warning for zone placement, an error for an attack: an ability whose
    // effect is not target-dependent is legal with nothing in the area.
    //
    // "Nothing in the area" and "things in the area, all of them filtered out"
    // are different failures and used to read identically. When units were
    // excluded, the message names the first one and why, because that is the
    // sentence that ends the debugging session.
    //
    // The caster excluding itself is not a diagnosis — it is what almost every
    // AoE does — so it is listed for the preview but never drives this message.
    const notable = excluded.filter((e) => e.unitId !== caster.id);
    (spec.targetsRequired === false ? warnings : errors).push(
      notable.length === 0
        ? "No legal targets in the selected area."
        : `No legal targets: ${notable[0].name} is ${notable[0].reason}` +
          (notable.length > 1 ? ` (and ${notable.length - 1} more excluded).` : "."),
    );
  }

  // Unaffiliated units are playable but not configured, and this is the only
  // place a player is looking when it matters.
  if (!caster.faction) {
    warnings.push(
      `${caster.name ?? "The attacker"} has no Faction set; unaffiliated units treat everyone as an enemy.`,
    );
  }

  return { units: chosen, panels, anchor, warnings, errors, needsChoice, candidates, excluded };
}

/* -------------------------------------------------------------------------- */
/*  Axis 1 — anchors                                                           */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} spec
 * @param {object} caster
 * @param {object} board
 * @param {object} placement
 * @param {string[]} errors
 * @returns {object}
 */
function resolveAnchor(spec, caster, board, placement, errors) {
  const casterPanel = caster.panel;
  const base = { casterPanel };

  switch (spec.kind) {
    case "self":
      return { ...base, panel: casterPanel };

    case "selfEdgeAdjacent": {
      // Direction is a player choice, presented as four ghost previews. That
      // affordance is the point: no free placement, no rule knowledge needed.
      const direction = placement.direction ?? spec.default ?? "n";
      if (!DELTA[direction]) errors.push(`Unknown direction "${direction}".`);
      return { ...base, panel: casterPanel, direction };
    }

    case "withinRange": {
      const panel = placement.panel;
      if (!panel) {
        errors.push("Choose a panel.");
        return { ...base, panel: casterPanel };
      }
      const r = spec.range ?? caster.range ?? 1;
      const inRange = spec.metric === "chebyshev"
        ? geo.chebyshev(casterPanel, panel) <= r
        : geo.inAttackRange(casterPanel, panel, r);
      if (!inRange) {
        errors.push(`Anchor panel is ${geo.chebyshev(casterPanel, panel)} panels away; Range is ${r}.`);
      }
      if (spec.minRange && geo.chebyshev(casterPanel, panel) < spec.minRange) {
        errors.push(`This ability has a minimum Range of ${spec.minRange}.`);
      }
      return { ...base, panel };
    }

    case "targetUnit": {
      const unit = (board.units ?? []).find((u) => u.id === placement.unitId);
      if (!unit) {
        errors.push("Choose a target.");
        return { ...base, panel: casterPanel };
      }
      if (!unit.panel) {
        errors.push(`${unit.name ?? "That unit"} is not placed on the board.`);
        return { ...base, panel: casterPanel };
      }
      const r = spec.range ?? caster.range ?? 1;
      if (!geo.inAttackRange(casterPanel, unit.panel, r)) {
        errors.push(`${unit.name ?? "Target"} is out of Range (${r}).`);
      }
      return { ...base, panel: unit.panel, panels: unit.panels ?? [unit.panel], unitId: unit.id };
    }

    case "movementPath":
      return { ...base, panel: casterPanel, path: placement.path ?? [] };

    case "zone": {
      const zone = board.zones?.[spec.zoneId];
      if (!zone) errors.push(`Zone "${spec.zoneId}" is not on the board.`);
      return { ...base, panel: casterPanel, panels: zone?.panels ?? [] };
    }

    case "platform": {
      const platform = (board.units ?? []).find((u) => u.id === (placement.platformId ?? spec.platformId));
      return { ...base, panel: platform?.panel ?? casterPanel, panels: platform?.panels ?? [] };
    }

    case "global":
      return { ...base, panel: casterPanel, panels: allPanels(board) };

    case "sourceOfAttack": {
      const src = (board.units ?? []).find((u) => u.id === placement.sourceUnitId);
      if (!src) errors.push("No attacking unit in context.");
      return { ...base, panel: src?.panel ?? casterPanel, panels: src ? [src.panel] : [], unitId: src?.id };
    }

    default:
      throw new RangeError(`FGT | Unknown targeting anchor "${spec.kind}".`);
  }
}

/**
 * Validate a chosen placement.
 *
 * A thin projection of `resolveTargets` — the resolver already produces
 * human-readable failures, and a second implementation of the same rules would
 * be a second implementation to keep in sync. The canvas layer calls this on
 * every pointer move, which is affordable because the resolver is pure and does
 * no allocation beyond the panel set.
 *
 * @param {object} spec
 * @param {object} caster
 * @param {object} board
 * @param {object} placement
 * @returns {{ok: boolean, reasons: string[], warnings: string[], resolved: ResolvedTargets}}
 */
export function validate(spec, caster, board, placement = {}) {
  const resolved = resolveTargets(spec, caster, board, placement);
  return {
    ok: resolved.errors.length === 0,
    reasons: resolved.errors,
    warnings: resolved.warnings,
    resolved,
  };
}

/**
 * Enumerate the placements a player could choose, each already resolved.
 *
 * This is what drives every one of the four targeting modes: the direction
 * picker draws one ghost per returned entry, free placement dims the panels
 * whose entries are illegal, and the unit picker lists them. One function, four
 * interactions, and the canvas never computes a rule.
 *
 * Illegal placements are **returned, not filtered** — a player needs to see
 * that a direction exists and why it cannot be chosen (D28.6). The caller
 * decides what to do with `legal: false`.
 *
 * @param {object} spec
 * @param {object} caster
 * @param {object} board
 * @param {object} [opts]
 * @param {number} [opts.max] cap on returned entries, for the free-placement grid
 * @returns {Array<{placement: object, legal: boolean, reasons: string[], resolved: ResolvedTargets}>}
 */
export function legalPlacements(spec, caster, board, { max = 400 } = {}) {
  const candidates = candidatePlacements(spec, caster, board, max);
  return candidates.map((placement) => {
    const v = validate(spec, caster, board, placement);
    return { placement, legal: v.ok, reasons: v.reasons, resolved: v.resolved };
  });
}

/**
 * The raw placement candidates for an anchor kind, before validation.
 *
 * @param {object} spec
 * @param {object} caster
 * @param {object} board
 * @param {number} max
 * @returns {object[]}
 */
function candidatePlacements(spec, caster, board, max) {
  const anchor = spec.anchor ?? { kind: "self" };
  const range = anchor.range ?? caster.range ?? 1;

  switch (anchor.kind) {
    // Mode A. Four directions, always all four, so the player sees the choice
    // rather than discovering it.
    case "selfEdgeAdjacent":
      return ["n", "e", "s", "w"].map((direction) => ({ direction }));

    // Mode B. Every panel the anchor could legally sit on, plus the panels just
    // outside it -- the overlay needs to draw the boundary, not only its inside.
    case "withinRange": {
      const out = [];
      const { i, j } = caster.panel;
      const reach = range + 1;
      for (let di = -reach; di <= reach && out.length < max; di++) {
        for (let dj = -reach; dj <= reach && out.length < max; dj++) {
          const panel = { i: i + di, j: j + dj };
          if (!inBounds(panel, board)) continue;
          out.push({ panel });
        }
      }
      return out;
    }

    // Mode C. Every unit on the board; the relation and range filters inside
    // the resolver decide which are legal.
    case "targetUnit":
      return (board.units ?? [])
        .filter((u) => u.id !== caster.id || spec.selection?.includeSelf)
        .slice(0, max)
        .map((u) => ({ unitId: u.id }));

    // Everything else resolves without a choice.
    default:
      return [{}];
  }
}

/**
 * @param {GridOffset} panel
 * @param {object} board
 * @returns {boolean}
 */
function inBounds(panel, board) {
  const b = board.bounds;
  if (!b) return true;
  return panel.i >= b.iMin && panel.i <= b.iMax && panel.j >= b.jMin && panel.j <= b.jMax;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The self-inclusion rule, which is explicit in the source and easy to get wrong.
 *
 * > *"When a Skill states 'used on an allied Unit' or 'affects all allied Units
 * > within…', the user is included."*
 *
 * So `"allied"` **includes the caster** by default — Van Gogh's *Het Gele Huis*
 * curses herself, which is the entire point of her design. But Note 11 inverts
 * it for damaging AoE Noble Phantasms, which do not affect their user unless
 * stated. An explicit boolean overrides both.
 *
 * @param {object} sel
 * @param {object} spec
 * @returns {boolean}
 * @see docs/09-targeting.md §9.5
 */
function resolveIncludeSelf(sel, spec) {
  if (typeof sel.includeSelf === "boolean") return sel.includeSelf;
  const relations = sel.relations ?? ["enemy"];
  if (spec.isDamagingAoE) return false; // Note 11
  return relations.includes("ally") || relations.includes("self");
}

/**
 * The relation of `unit` to `caster`, exactly as D4.10 defines it.
 *
 * > ```
 * > if (a.id === b.id)                    return "self";
 * > if (b.factionId === NEUTRAL_FACTION)  return "neutral";
 * > if (a.factionId === b.factionId)      return "ally";
 * > return "enemy";
 * > ```
 *
 * The `null` faction is **not** the neutral faction. Conflating them made every
 * unit whose `factionId` had never been set neutral to everything, so a freshly
 * placed pair of Servants had no relation to each other and no ability could
 * name a legal target. Neutrality is a faction a unit is *in*
 * ({@link NEUTRAL_FACTION}, and Civilians by kind); `null` is *unaffiliated* —
 * nobody has assigned this unit yet — and falls through to `enemy`, so an
 * unconfigured board is playable and the omission shows up as a warning rather
 * than as an empty target list.
 *
 * `board.alliances` extends this: factions may be allied for a match without
 * being the same faction.
 *
 * @param {object} caster
 * @param {object} unit
 * @param {object} board
 * @returns {"self"|"ally"|"enemy"|"neutral"}
 * @see docs/04-units.md §4.10
 */
export function relationOf(caster, unit, board) {
  if (unit.id === caster.id) return "self";
  if (unit.kind === "civilian" || unit.faction === NEUTRAL_FACTION) return "neutral";
  if (caster.faction && unit.faction && caster.faction === unit.faction) return "ally";
  if (board.alliances?.[caster.faction]?.includes(unit.faction)) return "ally";
  return "enemy";
}

/**
 * Why a unit's relation excluded it, in words a player can act on.
 *
 * The unassigned-faction case names the fix, because it is the one exclusion
 * caused by configuration rather than by the rules — and the one a player has
 * no way to deduce from the board.
 *
 * @param {string} relation
 * @param {object} caster
 * @param {object} unit
 * @param {Set<string>} wanted
 * @returns {string}
 */
function relationReason(relation, caster, unit, wanted) {
  const wants = [...wanted].join(" or ");
  if (relation === "ally" && caster.faction && caster.faction === unit.faction) {
    return `an ally — same faction as ${caster.name ?? "the attacker"} (${caster.faction}); this ability targets ${wants}`;
  }
  if (relation === "ally") return `an ally by alliance; this ability targets ${wants}`;
  if (relation === "neutral" && unit.kind === "civilian") {
    return `a Civilian, and Civilians are neutral; this ability targets ${wants}`;
  }
  if (relation === "neutral") return `neutral; this ability targets ${wants}`;
  return `${relation}; this ability targets ${wants}`;
}

/**
 * A Master standing next to a Servant of its own faction cannot be targeted
 * through it. Presence Concealment and several abilities bypass this.
 * @param {object} unit
 * @param {object} caster
 * @param {object} board
 * @returns {boolean}
 */
function isProtectedMaster(unit, caster, board) {
  if (unit.kind !== "master") return false;
  if (relationOf(caster, unit, board) !== "enemy") return false;
  return (board.units ?? []).some(
    (u) =>
      u.kind === "servant" &&
      u.faction === unit.faction &&
      u.canAct !== false &&
      u.panel &&
      geo.chebyshev(u.panel, unit.panel) <= 1,
  );
}

/**
 * Cross-level rules are **per-platform**, not global (Ch. 20 §20.7). The board
 * snapshot supplies the policy; this only enforces it.
 * @param {object} caster
 * @param {object} unit
 * @param {object} spec
 * @param {object} board
 * @param {string[]} warnings
 * @returns {boolean}
 */
function crossLevelAllows(caster, unit, spec, board, warnings, drop) {
  if ((unit.level ?? 0) === (caster.level ?? 0)) return true;
  const rules = board.crossLevel?.[unit.platformId] ?? board.crossLevel?.default;
  if (!rules) return true;
  if (rules.requiresRanged && (spec.isMelee ?? false)) {
    warnings.push(`Units aboard ${unit.platformId ?? "a platform"} can only be attacked with ranged Attacks.`);
    return drop(unit, `on another level; ${unit.platformId ?? "that platform"} can only be attacked at range`);
  }
  if (rules.untargetable) {
    warnings.push(`${unit.name ?? "A unit"} cannot be targeted while aboard ${unit.platformId}.`);
    return drop(unit, `aboard ${unit.platformId}, which cannot be targeted`);
  }
  return true;
}

/**
 * @param {object} u
 * @param {object} caster
 * @param {Map<string, number>|null} bands
 * @returns {TargetedUnit}
 */
function toTargeted(u, caster, bands) {
  return {
    unitId: u.id,
    distance: geo.chebyshev(caster.panel, u.panel),
    band: bands?.get(geo.key(u.panel)) ?? 0,
    concealedAoE: Boolean(u.concealed),
    relation: u.id === caster.id ? "self" : (u.relation ?? "enemy"),
  };
}

/**
 * @param {object} u
 * @returns {Set<string>}
 */
function optionsForUnit(u) {
  const out = new Set([`target:type:${u.kind}`]);
  for (const a of u.attributes ?? []) out.add(`target:attribute:${a}`);
  for (const e of u.effects ?? []) out.add(`target:effect:${e}`);
  return out;
}

/**
 * @param {object} board
 * @returns {GridOffset[]}
 */
function allPanels(board) {
  const b = board.bounds;
  if (!b) return [];
  /** @type {GridOffset[]} */
  const out = [];
  for (let i = b.iMin; i <= b.iMax; i++) for (let j = b.jMin; j <= b.jMax; j++) out.push({ i, j });
  return out;
}

/**
 * Deterministic shuffle. Random selection must be reproducible so that a
 * replayed combat produces the same targets (Ch. 30).
 * @template T
 * @param {T[]} arr
 * @param {number} seed
 * @returns {T[]}
 */
function seededShuffle(arr, seed) {
  const out = [...arr];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
