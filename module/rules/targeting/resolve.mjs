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
import { expand, DELTA } from "./shapes.mjs";
import { test as testPredicate } from "../predicate.mjs";
import { compelledTargetsOf } from "../compulsion.mjs";
import { isolationBlocks, panelsOf } from "../bounded-fields.mjs";
import { relationOf, guardsOf } from "../relations.mjs";

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

  // 1b. The anchor is itself a target. Step 8 lets an area's SPLASH catch a
  //     protected Master (§16.4 rule 4's whole premise), but aiming the area at
  //     one is still "targeting a Master for an Attack" and rule 1 refuses it.
  if (anchor.unitId && !(spec.limits ?? {}).bypassMasterProtection && !caster.bypassesMasterProtection) {
    const aimed = (board.units ?? []).find((u) => u.id === anchor.unitId);
    if (aimed && isProtectedMaster(aimed, caster, board)) {
      errors.push(`${aimed.name ?? "That Master"} is protected by an adjacent Servant and cannot be targeted.`);
    }
  }

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

  // 4b. COMPULSION — a compelled unit "will ignore all orders/Player commands".
  //
  // Narrowing here rather than erroring is the point: the compulsion does not
  // make the attack illegal, it makes the CHOICE illegal. Offering a free pick
  // of target and then refusing it would be offering something the rules have
  // already taken away. §45.4 recorded that the targeting executors wrote keys
  // nothing read; this is the reader.
  //
  // Only an ATTACK is compelled. "She will constantly Move towards and ATTACK
  // said Unit" restricts which enemy she may hit; it says nothing about who
  // she may buff. Narrowing every resolution made Penthesilea's Howl of the
  // War God -- "affects all allied Units within a 2 panel area" -- refuse with
  // "no legal targets" for as long as any Greek Male stood near her, which is
  // exactly when a Berserker would want to use it.
  //
  // A resolution that cannot reach an enemy is not an attack, which is the
  // whole test: no new field, and no caller has to remember to pass one.
  const compelled = relations.has("enemy") ? compelledTargetsOf(caster) : [];
  if (compelled.length > 0) {
    survivors = survivors.filter((u) =>
      compelled.includes(u.id) || drop(u, "the attacker is compelled to attack another unit"));
  }

  // 4b-ii. FORCED TARGET. `ForceTarget` has been in the executor table since
  // it was written and had **no reader anywhere**: Decoy's pull, Karna's Fated
  // Rivals and now a Kagome Spirit's prey all pushed a `{scope: "targeting",
  // forceTarget}` suppression into a bucket nothing consulted. Same scope as
  // the compulsion above and the same narrowing — it makes the CHOICE illegal
  // rather than the attack.
  if (relations.has("enemy")) {
    const forced = (caster.suppressions ?? [])
      .filter((sup) => sup?.scope === "targeting" && sup.forceTarget)
      .map((sup) => sup.forceTarget);
    if (forced.length > 0) {
      survivors = survivors.filter((u) =>
        forced.includes(u.id) || drop(u, "the attacker is forced to attack another unit"));
    }
  }

  // 4c. BOUNDED FIELD ISOLATION (Ch. 43 §43.5). Full isolation partitions the
  // board into two independent combats: a player whose units straddle the
  // boundary still takes one turn and acts with both groups, but the groups
  // cannot reach each other.
  //
  // The attack's own NP tags travel with the placement, because one field's
  // boundary opens for a big enough Noble Phantasm: Doomsday Come is
  // *"a Noble Phantasm of [Anti-World] or higher can be used on Doomsday Come
  // (from outside) or within"*. Without them every isolation question is asked
  // as though the attack were a Normal one, and the exception could never fire.
  const isolationCtx = {
    npTags: placement.npTags ?? [],
    isCommandSpell: Boolean(placement.isCommandSpell),
  };
  for (const field of board.fields ?? []) {
    survivors = survivors.filter((u) => {
      const verdict = isolationBlocks(field, caster, u, board, isolationCtx);
      return !verdict.blocked || drop(u, `separated by ${field.id}`);
    });
  }

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
  //
  //    Gated on `isChosen` for the same reason concealment is at step 7, and
  //    the two rules draw the line with the same verb. §16.4 rule 1 refuses
  //    *targeting*: "Masters cannot be TARGETED for an Attack when their
  //    Servant is within 2 panels". §16.4 rule 4 then describes a Master who
  //    "gets CAUGHT IN an AoE Noble Phantasm" while a Servant stands within
  //    those same 2 panels — a state rule 1 would make unreachable if the
  //    splash were filtered too. Filtering here unconditionally is exactly why
  //    Cover could never fire: the one configuration rule 4 is about was the
  //    one this line removed from the area. The area catches whoever stands in
  //    it; only a directly chosen target is refused. The ANCHOR of an area is
  //    still refused below — aiming an AoE at a Master is targeting it.
  if (!limits.bypassMasterProtection && !caster.bypassesMasterProtection && isChosen) {
    const before = survivors.length;
    survivors = survivors.filter(
      (u) => !isProtectedMaster(u, caster, board) || drop(u, "a Master protected by an adjacent Servant"),
    );
    if (survivors.length < before) warnings.push("Protected Masters were excluded.");
  }
  if (board.crossLevel) {
    survivors = survivors.filter((u) => crossLevelAllows(caster, u, spec, board, warnings, drop));
  }

  // 8b. TARGETABILITY AURA — Bašmu's protection: "Enemy Units cannot Attack
  // Semiramis or her allied Units if a Bašmu is next to them." Unlike Master
  // protection above, the sheet states no "unless" clause, so there is no
  // bypass flag to check. An aura the TARGET carries (`untargetableBy`,
  // `rules/auras.mjs`'s `annotateAuras`), not a suppression the caster does —
  // the same reason Master protection is read off the DEFENDER's position.
  {
    const before = survivors.length;
    survivors = survivors.filter(
      (u) => (u.untargetableBy ?? []).length === 0
        || relationOf(caster, u, board) !== "enemy"
        || drop(u, "protected by a nearby Bašmu"),
    );
    if (survivors.length < before) warnings.push("A Unit protected by Bašmu was excluded.");
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

  // 9b. THE ATTACKER'S OWN NARROWING.
  //
  // `chosenIds` is how the confirmation dialog says "these, of the ones you
  // offered me". It applies whatever the chooser is, because an attacker may
  // always hit *fewer* targets than the rules permit — sparing a Charmed ally
  // standing with the enemy is a decision the rules have no opinion about. It
  // can only ever remove: a unit the filters excluded cannot be added back by
  // sending its id, which is what makes this safe to accept from a client.
  if (placement.chosenIds && chooser !== "chosen") {
    const wanted = new Set(placement.chosenIds);
    const kept = chosen.filter((t) => wanted.has(t.unitId));
    for (const t of chosen) {
      if (!wanted.has(t.unitId)) {
        const unit = (board.units ?? []).find((u) => u.id === t.unitId);
        drop(unit ?? { id: t.unitId }, "not selected by the attacker");
      }
    }
    chosen = kept;
  }

  // 10. LIMITS
  if (limits.maxTargets !== undefined && chosen.length > limits.maxTargets) {
    chosen = chosen.slice(0, limits.maxTargets);
  }
  if (limits.minTargets !== undefined && !needsChoice && chosen.length < limits.minTargets) {
    errors.push(`This ability requires at least ${limits.minTargets} target(s).`);
  }
  // "EMIYA cannot be within the NP area." A restriction on the PLACEMENT, not
  // on the target list: `includeSelf: false` already keeps him from being
  // damaged by his own Caladbolg II, and the sheet forbids something stronger
  // -- standing in the blast at all. Refusing rather than dropping him,
  // because the player has a legal alternative (aim somewhere else) and
  // silently sparing him would be inventing a different rule.
  if (limits.casterOutsideArea && caster.panel && panelKeys.has(geo.key(caster.panel))) {
    errors.push("The caster cannot be within this ability's area.");
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
      // A minimum, which only the `withinRange` anchor honoured. EMIYA's
      // Hrunting "cannot be used on a Unit directly next to EMIYA" and picks a
      // UNIT, so the one anchor that could express the rule was the one it
      // could not use.
      if (spec.minRange && geo.chebyshev(casterPanel, unit.panel) < spec.minRange) {
        errors.push(`${unit.name ?? "Target"} is too close; this ability has a minimum Range of ${spec.minRange}.`);
      }
      return { ...base, panel: unit.panel, panels: unit.panels ?? [unit.panel], unitId: unit.id };
    }

    // Measured from the nearest panel of a FIELD, not from the caster.
    // Doomsday Come: *"if there are any enemy Units within a 2 panel area of
    // the Doomsday Come area, Pale Rider can target an enemy Unit within this
    // Range"* — his own position is irrelevant, because the area is anchored
    // on his Master and may be the width of the board away from him.
    case "fieldEdge": {
      const field = (board.fields ?? []).find((f) => f.id === spec.fieldId);
      if (!field) {
        errors.push("That area is not open.");
        return { ...base, panel: casterPanel };
      }
      const unit = (board.units ?? []).find((u) => u.id === placement.unitId);
      if (!unit?.panel) {
        errors.push("Choose a target.");
        return { ...base, panel: casterPanel };
      }
      const panels = panelsOf(field, board);
      const edge = panels.length > 0
        ? Math.min(...panels.map((p) => geo.chebyshev(p, unit.panel)))
        : Infinity;
      const r = spec.range ?? 1;
      // Already inside: there is nothing to drag them into.
      if (edge === 0) {
        errors.push(`${unit.name ?? "That Unit"} is already inside.`);
      } else if (edge > r) {
        errors.push(`${unit.name ?? "Target"} is ${edge} panels from the area; Range is ${r}.`);
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
  if (relation === "neutral" && !unit.faction) {
    return `neutral because it has no Faction — assign one in the faction roster`;
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
  // `guardsOf` rather than "any Servant of that faction": Pale Rider's
  // Kagome Spirits stand in for him here, and he does not protect his own
  // Master at all (Ch. 16).
  return guardsOf(unit, board).some(
    (u) => u.canAct !== false && u.panel && geo.chebyshev(u.panel, unit.panel) <= 1,
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
