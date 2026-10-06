/**
 * @file The eleven-step targeting resolution algorithm.
 * @see docs/20-targeting.md
 *
 * Layer 2 (rules). Pure — consumes a board snapshot, returns targets. Nothing
 * writes, which is what lets the preview run the real resolver rather than an
 * approximation of it.
 *
 * The four axes (Ch. 20) stay orthogonal on purpose: nine anchors × eleven shapes
 * × six selections covers every declaration in both rosters, and new content
 * composes rather than extends.
 */

import * as geo from "../../domain/geometry.mjs";
import { expand, DELTA } from "./shapes.mjs";
import { test as testPredicate } from "../predicate.mjs";
import { rollOptionsFor } from "../options.mjs";
import { compelledTargetsOf } from "../compulsion.mjs";
import { isolationBlocks, panelsOf } from "../bounded-fields.mjs";
import { relationOf } from "../relations.mjs";
import { guardsInRange, guardsNear } from "../master-guard.mjs";
import { crossLevelLegal } from "../platforms.mjs";
import { Rank } from "../../domain/rank.mjs";
import { facingAllows, pathClear } from "./facing.mjs";

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

  // 0b. A targeting sentence with an "or if" in it, resolved BEFORE anything is
  //     expanded. Nemo's two support Skills both read *"all allied Units within
  //     a 2 panel area of himself, **or if Zero Sail is activated**, all allied
  //     Units within the Storm Border"* -- one sentence describing two
  //     GEOMETRIES, and the anchor and the shape change together, so a
  //     predicate on a single shape cannot say it.
  //
  //     Branches are tested in order and the first match wins, which is the
  //     same precedence `damage.branches` uses.
  if (spec.anchor?.kind === "conditional") {
    // The caster's own options when the caller supplied none. No caller ever
    // did, so every conditional anchor took its fallback: Beyond the
    // Uncharted from the Golden Hind's deck buffed everyone within 2 of Drake,
    // the ship and a grounded Master included, and missed Karna aboard (#187).
    // Nemo's two Storm Border Skills share the shape.
    const opts = placement.options ?? rollOptionsFor({ attacker: caster });
    const branch = (spec.anchor.branches ?? [])
      .find((b) => testPredicate(b.predicate, { options: opts, refs: placement.refs ?? {} }))
      ?? spec.anchor.otherwise;
    if (!branch) {
      errors.push("No branch of this conditional anchor matched, and it declares no fallback.");
      return { units: [], panels: [], anchor: {}, warnings, errors, needsChoice: false, candidates: [], excluded };
    }
    spec = { ...spec, anchor: branch.anchor, shape: branch.shape ?? spec.shape };
  }

  // 1. ANCHOR
  const anchor = resolveAnchor(spec.anchor, caster, board, placement, errors);

  // 1b. The anchor is itself a target. Step 8 lets an area's SPLASH catch a
  //     protected Master (Ch. 32 rule 4's whole premise), but aiming the area at
  //     one is still "targeting a Master for an Attack" and rule 1 refuses it.
  if (anchor.unitId && !(spec.limits ?? {}).bypassMasterProtection && !caster.bypassesMasterProtection) {
    const aimed = (board.units ?? []).find((u) => u.id === anchor.unitId);
    if (aimed && isProtectedMaster(aimed, caster, board, anchorRange(spec.anchor ?? {}, caster))) {
      errors.push(`${aimed.name ?? "That Master"} is guarded by a Servant within your Range: only the Servant can be targeted.`);
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
    // A defeat never removes the token, so a corpse stands in the area like
    // anybody else. It is listed, with its reason, and never a target: no
    // ability in the corpus acts on the defeated, and one that ever does
    // authors a key for it (#168).
    if (u.defeated) return drop(u, "defeated");
    // *"...except herself AND THE PREVIOUSLY TARGETED UNIT"* -- Xiuhcoatl's
    // splash. `includeSelf: false` above is the first half; this is the second,
    // and only a SECOND resolution has a first one to exclude. Inert without a
    // `primaryTargetId`, which every ordinary resolution is.
    if (sel.excludePrimaryTarget && placement?.primaryTargetId === u.id) {
      return drop(u, "the Unit this Noble Phantasm already targeted");
    }
    const relation = relationOf(caster, u, board);
    return relations.has(relation) || drop(u, relationReason(relation, caster, u, relations));
  });

  // 4b. COMPULSION — a compelled unit "will ignore all orders/Player commands".
  //
  // Narrowing here rather than erroring is the point: the compulsion does not
  // make the attack illegal, it makes the CHOICE illegal. Offering a free pick
  // of target and then refusing it would be offering something the rules have
  // already taken away. Ch. 46 recorded that the targeting executors wrote keys
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
      // A forced target that has been defeated forces nothing: the narrowing
      // below would otherwise leave the attacker no legal target at all (#168).
      // Nor does one no longer on the board (#180): a defeated Unit's body is
      // cleared at the Turn's end, and Asterios's Famine, compelled towards a
      // body that was gone, could attack nobody for the rest of the war.
      // A Spirit's pursuit also lifts once its prey has left the field the
      // Spirit is bound to, as `rules/movement.mjs#pursuitVerdict` lifts the
      // move half: the compulsion belongs to the area.
      .filter((sup) => {
        const prey = (board.units ?? []).find((u) => u.id === sup.forceTarget);
        if (!prey?.panel || prey.defeated) return false;
        if (sup.source === "pursuit" && caster.boundToFieldId
          && !(prey.fields ?? []).includes(caster.boundToFieldId)) return false;
        // A charmed prey is the Spirit's ally for the Charm's duration (#180).
        if (sup.source === "pursuit" && relationOf(caster, prey, board) !== "enemy") return false;
        return true;
      })
      .map((sup) => ({ id: sup.forceTarget, pursuit: sup.source === "pursuit" }));
    // A Kagome Spirit's AREA attack. Ruled 2026-10-04 (#180): Famine's 3x3
    // must contain its enemy, and then hits every enemy in it -- a 3x3 that
    // hits one Unit is not an area. Decoy and Fated Rivals keep the narrowing:
    // they say who may be targeted, a pursuit says what the Spirit must hit.
    const area = (spec.shape?.kind ?? "unit") !== "unit";
    const pursued = forced.filter((f) => f.pursuit).map((f) => f.id);
    const narrowing = forced.filter((f) => !(f.pursuit && area)).map((f) => f.id);
    if (area && pursued.length > 0 && !survivors.some((u) => pursued.includes(u.id))) {
      survivors = survivors.filter((u) => drop(u, "the area must contain the Spirit's own enemy"));
    }
    if (narrowing.length > 0) {
      survivors = survivors.filter((u) =>
        narrowing.includes(u.id) || drop(u, "the attacker is forced to attack another unit"));
    }
  }

  // 4c. BOUNDED FIELD ISOLATION (Ch. 28). Full isolation partitions the
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
    // The placement's when the declaration path supplies them, else the
    // spec's, which is where the aiming session carries them (#183).
    npTags: placement.npTags ?? spec.npTags ?? [],
    isCommandSpell: Boolean(placement.isCommandSpell),
  };
  for (const field of board.fields ?? []) {
    // An anchor measured from a field's edge reaches ACROSS that edge by
    // definition: Doomsday Come's drag targets *"an enemy Unit within a 2 panel
    // area of the Doomsday Come area"* to pull it in, from a Pale Rider who is
    // usually inside. The area's own isolation refused every one of them (#180).
    if (spec.anchor?.kind === "fieldEdge" && spec.anchor.fieldId === field.id) continue;
    survivors = survivors.filter((u) => {
      const verdict = isolationBlocks(field, caster, u, board, isolationCtx);
      return !verdict.blocked || drop(u, `separated by ${field.id}`);
    });
  }

  // 4d. CROSS-LEVEL PROTECTION (Ch. 27). A platform states, in its own
  //     `crossLevel` block, who may shoot into it, who may shoot out of it,
  //     and whether the ground directly underneath is reachable at all.
  //
  //     `crossLevelLegal` has existed, documented and unit-tested, since the
  //     platform rules were written, and until now **nothing called it** — so
  //     every one of those axes was inert. The Hanging Gardens' Aerial Garden
  //     of Vanity, whose sheet says *"Cannot hit under or above the HGoB"*,
  //     hit a Unit standing directly under it. Measured live.
  //
  //     The ATTACK's reach is passed in, not the caster's: the Hanging Gardens
  //     *"does not Normal Attack"* and carries Range 0, and reading that would
  //     refuse both of its own Skills as melee. `allowDirectlyBelow` is the
  //     one axis an ability may overrule — Dragon Wing Warriors is *"Range=4
  //     plus the area under the HGoB"*.
  //
  //     WHAT is being done and to whom are asked as well (#138): `reach` says
  //     whether this is an Attack (the attack paths) or an effect (the Skill
  //     paths), and an AREA shape catches an occupant instead of targeting it,
  //     which is the `aoe*` axes' business. An occupant kept at a tier below
  //     full damage carries it out as `platformFactor`, for stage 15.
  const crossLevelOptions = {
    range: typeof spec.anchor?.range === "number" ? spec.anchor.range : null,
    allowDirectlyBelow: Boolean(spec.allowDirectlyBelow),
    // The placement says what the resolution is; failing that the spec does
    // (the targeting session's preview says so on the spec, because it calls
    // `validate` and `legalPlacements`, which take no reach of their own);
    // failing that it is an Attack, the more protected reading.
    reach: placement?.reach ?? spec.reach ?? "attack",
    // A single Unit or a single panel is aimed at; anything wider is an area.
    area: !["unit", "point"].includes(spec.shape?.kind ?? "point"),
  };
  /** @type {Map<string, {platformFactor: number, platformName: string}>} */
  const tiers = new Map();
  survivors = survivors.filter((u) => {
    const verdict = crossLevelLegal(caster, u, board, crossLevelOptions);
    if (!verdict.ok) return drop(u, crossLevelReason(verdict.reason));
    if (typeof verdict.factor === "number") {
      tiers.set(u.id, { platformFactor: verdict.factor, platformName: verdict.platform });
    }
    return true;
  });

  // 4e. THE DECK. Aerial Garden of Vanity *"cannot hit under or above the
  //     HGoB"*, and against Dragon Wing Warriors' *"plus the area under the HGoB
  //     and the area of the HGoB"* the area OF the garden is what "above"
  //     names. `forbidDirectlyBelow` above is the "under" half; this is the
  //     other, and only an ability that says so asks for it (Ch. 46 §46.4-BR).
  if (spec.forbidAboard) {
    const deckId = caster.kind === "platform" ? caster.id : caster.platformId ?? null;
    const deck = deckId ? (board.units ?? []).find((p) => p.id === deckId) : null;
    if (deck) {
      survivors = survivors.filter((u) => !aboard(u, deck)
        || drop(u, `standing on ${deck.name ?? "the platform"}, which this ability cannot hit`));
    }
  }

  // 5. KIND FILTER — platforms and structures are excluded unless asked for.
  const kinds = sel.kinds ?? null;
  survivors = survivors.filter((u) => {
    if (kinds) return kinds.includes(u.kind) || drop(u, `a ${u.kind}; this ability targets ${kinds.join(" or ")}`);
    // A Structure that names who may break it is asking to be attacked by
    // them. *"Only Masters can destroy a Bloodmark, and it is done by SIMPLY
    // ATTACKING IT"* -- a Normal Attack, which declares no `kinds` and would
    // otherwise be refused by the blanket exclusion below. Everybody else is
    // still refused, at step 8b-ii and with a reason that names the kinds.
    if (u.kind === "structure" && (u.destroyableBy ?? []).includes(caster.kind)) return true;
    // A platform with Health to lose is a Unit that can be attacked. *"Enemy
    // Units on the ground can only Attack the HGoB with ranged Attacks"* says
    // they can, and *"its Health drops to 0"* is how it is destroyed; which
    // attacks may reach it is `crossLevel.hullTargeting`, at step 4d. Dropped
    // here as "a platform", nothing ever reached that rule (Ch. 46 §46.4-BS).
    if (u.kind === "platform" && u.maxHealth > 0 && !u.undamageable) return true;
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

  // 6b. PARAMETER COMPARISON — a refusal keyed on how the target measures up
  //     to the CASTER, over a count of Parameters.
  //
  //     Achilles's duel: *"cannot be used on ... Units with at least 3
  //     Parameters one Rank lower than Achilles'."* No predicate can say this:
  //     "three of the five, each at least one Rank down" is an aggregate, and
  //     the predicate language deliberately has no aggregate form. It is a
  //     refusal rather than a modifier, so it drops the unit with a reason.
  if (sel.parametersBelow) {
    const { count = 1, steps = 1 } = sel.parametersBelow;
    survivors = survivors.filter((u) =>
      parametersBelowBy(caster, u, steps) < count
      || drop(u, `has ${count} or more Parameters at least ${steps} Rank lower`));
  }

  // 7. VISIBILITY — concealment blocks *targeting*, but an AoE still catches
  //    the unit; it just gets the coin flip instead (Presence Concealment 1).
  //
  //    What it blocks is *"an Attack or an enemy Unit's Skill"*, and no more: an
  //    ALLY'S Skill is neither, and §46.4-AK already lets the Unit's own side see
  //    it, so they know it is there. `limits.forAttack` says which kind of use
  //    this is (`rules/ability-use.mjs#targetSpecFor`); a spec that does not say
  //    is an Attack, so a caller that never learned of the flag is unchanged.
  const chooser = sel.chooser ?? "all";
  const isChosen = chooser === "chosen" || (sel.count !== undefined && sel.count !== "unlimited");
  if (sel.excludeConcealed !== false && isChosen) {
    const before = survivors.length;
    const forAttack = limits.forAttack !== false;
    survivors = survivors.filter(
      (u) => !u.concealed || u.id === caster.id
        || (!forAttack && relationOf(caster, u, board) === "ally")
        || drop(u, "concealed — it cannot be targeted directly"),
    );
    if (survivors.length < before) warnings.push("Concealed units cannot be targeted directly.");
  }

  // 8. PROTECTION — a Master adjacent to a Servant of its own faction cannot be
  //    targeted through it, unless the attacker bypasses protection.
  //
  //    Gated on `isChosen` for the same reason concealment is at step 7, and
  //    the two rules draw the line with the same verb. Ch. 32 rule 1 refuses
  //    *targeting*: "Masters cannot be TARGETED for an Attack when their
  //    Servant is within 2 panels". Ch. 32 rule 4 then describes a Master who
  //    "gets CAUGHT IN an AoE Noble Phantasm" while a Servant stands within
  //    those same 2 panels — a state rule 1 would make unreachable if the
  //    splash were filtered too. Filtering here unconditionally is exactly why
  //    Cover could never fire: the one configuration rule 4 is about was the
  //    one this line removed from the area. The area catches whoever stands in
  //    it; only a directly chosen target is refused. The ANCHOR of an area is
  //    still refused below — aiming an AoE at a Master is targeting it.
  // Ch. 21's redirect, the half that says who must NOT be caught. Unconditional,
  // and deliberately NOT inside Ch. 32's block below: that one is gated on
  // `isChosen` so an area may still catch a protected Master incidentally,
  // which is the whole reason Cover works. This rule is the opposite -- the
  // Master takes nothing even from an area that covers it, because "the Counter
  // Attack cannot be used on the Master".
  //
  // Dropped through `drop` rather than filtered silently: a unit that vanishes
  // from the targeting preview with no explanation reads as a bug.
  const excludeIds = limits.excludeUnitIds ?? [];
  if (excludeIds.length > 0) {
    survivors = survivors.filter(
      (u) => !excludeIds.includes(u.id)
        || drop(u, "protected by its Servant; the Counter is redirected"),
    );
  }

  if (!limits.bypassMasterProtection && !caster.bypassesMasterProtection && isChosen) {
    const before = survivors.length;
    // "Within the AU's Range" for a pick among candidates is "itself a
    // candidate": a guard this very attack could reach instead (#181, case 1).
    const reachable = new Set(survivors.map((u) => u.id));
    survivors = survivors.filter(
      (u) => !(u.kind === "master" && relationOf(caster, u, board) === "enemy"
        && guardsNear(u, board).some((g) => reachable.has(g.id)))
        || drop(u, "a Master guarded by a Servant within Range"),
    );
    if (survivors.length < before) warnings.push("Protected Masters were excluded.");
  }
  // 8b-ii. WHO MAY BREAK IT. *"Only Masters can destroy a Bloodmark, and it is
  //     done by simply Attacking it."* A property of the OBJECT rather than of
  //     the attacker, so it is refused with a reason instead of letting a
  //     Servant swing at something it can never break.
  survivors = survivors.filter((u) => {
    const allowed = u.destroyableBy ?? [];
    return allowed.length === 0 || allowed.includes(caster.kind)
      || drop(u, `destructible only by ${allowed.join(" or ")}`);
  });
  //  ...and not once the area it marks is up. *"When Bloodfort Andromeda is
  //  activated, it is continuously Active until Medusa is defeated"* (#188
  //  reading 14): the four corners stay to show where it is, and breaking one
  //  would do nothing, so none can be attacked while the Fort stands.
  survivors = survivors.filter((u) =>
    !(u.kind === "structure" && (u.attributes ?? []).includes("mark") && u.fieldId
      && (board.fields ?? []).some((f) => f.id === u.fieldId))
    || drop(u, "a corner of an active field"));

  // 8c. FACING and CLEAR PATH — Medusa's Mystic Eyes is the only ability in
  //     the corpus that asks either, which is exactly what D44.8 decided: no
  //     general line of sight, a per-ability predicate instead.
  if (limits.requiresFacing) {
    survivors = survivors.filter(
      (u) => facingAllows(caster, u)
        || drop(u, `not in front of ${caster.name ?? "the attacker"}`),
    );
  }
  if (limits.requiresClearPath) {
    survivors = survivors.filter(
      (u) => pathClear(caster, u, board) || drop(u, "behind another Unit"),
    );
  }

  // 8b. TARGETABILITY AURA — Bašmu's protection: "Enemy Units cannot Attack
  // Semiramis or her allied Units if a Bašmu is next to them." Unlike Master
  // protection above, the sheet states no "unless" clause, so there is no
  // bypass flag to check. An aura the TARGET carries (`untargetableBy`,
  // `rules/auras.mjs`'s `annotateAuras`), not a suppression the caster does —
  // the same reason Master protection is read off the DEFENDER's position.
  {
    const before = survivors.length;
    /** @type {string[]} */
    const protectors = [];
    // NAMED, rather than assumed. Both sentences read "Bašmu" for every
    // protector in the game, and ten content files author a
    // `TargetabilityModifier`: Bašmu, the three Dragon Tooth Warriors, Raikou's
    // four retainers, the Sphinx Queen and Tenmokaikai. The aura entry has
    // carried the real name on `source` all along. Measured live -- a Medea
    // ringed by her own Dragon Tooth Warriors was refused with "protected by a
    // nearby Bašmu", which is a creature belonging to a different Servant in a
    // different war (Ch. 46 §46.4-O).
    const nameOf = (u) => (u.untargetableBy ?? []).map((a) => a.source).find(Boolean) ?? null;
    survivors = survivors.filter((u) => {
      if ((u.untargetableBy ?? []).length === 0) return true;
      if (relationOf(caster, u, board) !== "enemy") return true;
      const who = nameOf(u);
      if (who) protectors.push(who);
      return drop(u, who ? `protected by a nearby ${who}` : "protected by a nearby ally");
    });
    if (survivors.length < before) {
      const who = [...new Set(protectors)].join(", ");
      warnings.push(who
        ? `A Unit protected by ${who} was excluded.`
        : "A protected Unit was excluded.");
    }
  }

  // 9. CHOOSER
  const withMeta = survivors.map((u) => ({ ...toTargeted(u, caster, bands, !isChosen), ...(tiers.get(u.id) ?? {}) }));
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

  // Ch. 21's *"declare an Attack on the AU"*. A Counter may be aimed anywhere,
  // as long as it CATCHES the unit that attacked -- not centred on it, which
  // would forbid an area answer that legitimately covers the attacker from one
  // side. Stated as a limit rather than checked after the placement is
  // committed, so the refusal is drawn under the cursor while the player is
  // still aiming (Ch. 20): a refusal they fix by moving the mouse rather than
  // one they fix by guessing.
  if (limits.requireUnitId && !chosen.some((t) => t.unitId === limits.requireUnitId)) {
    const required = (board.units ?? []).find((u) => u.id === limits.requireUnitId);
    errors.push(
      `This Counter must include ${required?.name ?? "the unit that attacked"}.`,
    );
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
  // 11. THE LINKED PARTNER, ALWAYS.
  //
  //   *"all allied Units within a 2 panel area of himself (and Pollux if she is
  //    out of the Skill's Range)"*
  //
  // The partner is in the set whatever the shape caught: never excluded for
  // standing too far, never counted twice for standing near. Four clauses
  // across the two twins say it -- both copies of Stars of the Chief God and
  // both of Guardians of Navigation -- which is what earns it a name rather
  // than four hand-written target lists.
  //
  // AFTER the limits deliberately. `maxTargets` bounds what the shape may
  // catch; the partner is not something the shape caught, and letting a count
  // limit cut her would make the clause depend on how many bystanders happened
  // to be standing nearby.
  if (spec.selection?.alsoIncludes === "partner") {
    for (const id of [...(caster?.linkedGroup?.memberIds ?? [])]) {
      if (chosen.some((t) => t.unitId === id)) continue;
      const partner = (board.units ?? []).find((u) => u.id === id);
      if (!partner || partner.defeated) continue;
      chosen = [...chosen, { ...toTargeted(partner, caster, bands, false), viaPartnerClause: true }];
    }
  }

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
/**
 * A cross-level refusal in words a player can act on.
 * @param {string|undefined} reason
 * @returns {string}
 */
function crossLevelReason(reason) {
  switch (reason) {
    case "occupantsForbidden": return "aboard a platform that cannot be attacked into";
    case "aoeMastersImmune": return "a Master aboard a platform, which takes no damage or effects from an area";
    case "requiresRanged": return "on another level; this reach is too short to attack across";
    case "outboundForbidden": return "on another level; this platform cannot attack off it";
    case "directlyBelow": return "directly below this platform, which cannot attack straight down";
    default: return "on another level";
  }
}

function resolveAnchor(spec, caster, board, placement, errors) {
  const casterPanel = caster.panel;
  // Range is measured from the WHOLE unit, not from the anchor panel a
  // multi-panel footprint is stored under -- see
  // `domain/geometry.mjs#chebyshevFromAny` for the case that found it.
  //
  // ...unless the swing is not hers. A bare Normal Attack by a rider whose mount
  // replaces it names the mount in `anchor.originUnitId` (`engine/attack.mjs#
  // targetSpecFor`, from `rules/platforms.mjs#attackSourceOf`), and Range is
  // then measured from the mount's whole footprint: the Range was already the
  // mount's, and the panel it was measured from was still her one (#171). Only
  // that spec carries it, so what she casts herself measures from her own.
  const origin = spec.originUnitId
    ? (board.units ?? []).find((u) => u.id === spec.originUnitId)
    : null;
  const from = origin ?? caster;
  const casterPanels = from.panels?.length ? from.panels : [from.panel ?? casterPanel];
  // A turnable shape's quarter turn, chosen in the preview (#187 reading 6).
  const base = { casterPanel, ...(placement?.transverse === true ? { transverse: true } : {}) };

  switch (spec.kind) {
    case "self":
      // `facing`, deliberately NOT `direction`. `shapes.mjs`'s `rect` case
      // turns a plain square into a forward-projected edge-adjacent rect the
      // moment `anchor.direction` is present, so handing every `self` anchor a
      // direction silently reshapes every square splash in the game -- found
      // by `aoe.test.mjs`, which lost its primary target.
      //
      // `orientedRect` reads `direction ?? facing`, so a player-chosen
      // direction still wins and nothing else sees this field. Drake's
      // broadside *"can be used even if the Golden Hind isn't present"*, and
      // that branch anchors here.
      return { ...base, panel: casterPanel, facing: caster.facing ?? "n" };

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
      const r = anchorRange(spec, caster);
      const reach = geo.chebyshevFromAny(casterPanels, panel);
      const inRange = spec.metric === "chebyshev"
        ? reach <= r
        : geo.inAttackRangeFromAny(casterPanels, panel, r);
      if (!inRange) {
        errors.push(`Anchor panel is ${reach} panels away; Range is ${r}.`);
      }
      if (spec.minRange && reach < spec.minRange) {
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
      const r = anchorRange(spec, caster);
      // To ANY panel of the target, as from any panel of the caster: a 3x3
      // Bašmu or a 9x9 garden is in Range if any part of it is. Measured to
      // the anchor corner alone, Heracles beside the garden's middle was told
      // it was out of Range (Ch. 46 §46.4-BT).
      const targetPanels = unit.panels?.length ? unit.panels : [unit.panel];
      if (!geo.inAttackRangeBetween(casterPanels, targetPanels, r)) {
        errors.push(`${unit.name ?? "Target"} is out of Range (${r}).`);
      }
      // A minimum, which only the `withinRange` anchor honoured. EMIYA's
      // Hrunting "cannot be used on a Unit directly next to EMIYA" and picks a
      // UNIT, so the one anchor that could express the rule was the one it
      // could not use.
      if (spec.minRange && Math.min(...targetPanels.map((p) => geo.chebyshevFromAny(casterPanels, p))) < spec.minRange) {
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
      const nearest = panels.length > 0
        ? panels.reduce((best, p) => (
          geo.chebyshev(p, unit.panel) < geo.chebyshev(best, unit.panel) ? p : best))
        : null;
      const edge = nearest ? geo.chebyshev(nearest, unit.panel) : Infinity;
      const r = spec.range ?? 1;

      // Already inside. Doomsday Come's drag-in has nothing to drag, so it
      // refuses; Dendera Electric Bulb reaches *"any panel within Ramesseum
      // Tentyris, AND ALSO 4 panels away from the border"*, so it does not.
      // The anchor says which it is rather than assuming the older one.
      if (!nearest) {
        errors.push("That area covers no panels.");
      } else if (edge === 0 && !spec.allowInside) {
        errors.push(`${unit.name ?? "That Unit"} is already inside.`);
      } else if (edge > 0) {
        // *"…and also has a Range of 4 panels away from the border of Ramesseum
        // Tentyris (if diagonal, 3 panels)."* A shorter reach on the diagonal,
        // which Chebyshev alone cannot express -- it counts a diagonal step as
        // one, so a plain radius of 4 would give four in every direction.
        // "Diagonal" is an offset with both components non-zero.
        const di = Math.abs(nearest.i - unit.panel.i);
        const dj = Math.abs(nearest.j - unit.panel.j);
        const diagonal = di > 0 && dj > 0;
        const limit = diagonal ? (spec.diagonalRange ?? r) : r;
        if (edge > limit) {
          errors.push(
            `${unit.name ?? "Target"} is ${edge} panels from the area; `
            + `Range is ${limit}${diagonal ? " on the diagonal" : ""}.`,
          );
        }
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
      // By id, or by the CONTENT id an ability authors (`platform-golden-hind`):
      // the caster's own one first, since two Drakes would each raise a ship.
      // The anchor matched the actor id only, so the ship the content names was
      // never found and its zone was empty (#187).
      const wanted = placement.platformId ?? spec.platformId;
      const platforms = (board.units ?? []).filter((u) => u.kind === "platform"
        && (u.id === wanted || u.contentId === wanted));
      const platform = platforms.find((u) => u.ownerId === caster?.id) ?? platforms[0] ?? null;
      // *"in the direction the Golden Hind is facing (i.e. where the ship's
      // bow is facing)"*. `PlatformData` spreads `unitCommon()`, so a platform
      // has carried `facing` all along and `snapshot.mjs` projects it --
      // nothing had ever asked the anchor for it, so the bow pointed one way
      // and the broadside went another.
      const facing = platform?.facing ?? caster.facing ?? "n";
      return {
        ...base,
        // FROM THE BOW (#187): a shape projected forward starts at the middle
        // of the ship's front edge, not at the panel its owner stands on.
        // From Drake at the stern the broadside began inside her own ship.
        ...(platform ? { casterPanel: bowOf(platform, facing) } : {}),
        panel: platform?.panel ?? casterPanel,
        panels: platform?.panels ?? [],
        facing,
      };
    }

    case "conditional":
      // Flattened at step 0b of `resolveTargets`, before anything is expanded,
      // because a conditional swaps the SHAPE as well as the anchor and this
      // function only returns an anchor.
      //
      // Reaching here means a caller resolved an anchor without going through
      // `resolveTargets` -- so the branch was never chosen and whatever shape
      // it would have selected is not the one about to be expanded. Loud,
      // because the alternative is a Skill quietly targeting the wrong area.
      throw new RangeError(
        "FGT | A conditional anchor reached resolveAnchor. It must be flattened by "
        + "resolveTargets first -- see step 0b.",
      );

    case "global":
      return { ...base, panel: casterPanel, panels: allPanels(board) };

    case "sourceOfAttack": {
      const src = (board.units ?? []).find((u) => u.id === placement.sourceUnitId);
      if (!src) errors.push("No attacking unit in context.");
      return { ...base, panel: src?.panel ?? casterPanel, panels: src ? [src.panel] : [], unitId: src?.id };
    }

    // The Unit the resolution this one follows was aimed at, by its whole
    // footprint. Xiuhcoatl's splash, as the user changed it (ruled 2026-10-02,
    // #65): *"everything within 2 panels of the target"*, where the sheet had
    // it around Quetzalcoatl. An aftermath hands `primaryTargetId` in
    // (`engine/attack.mjs#declareAftermath`), so this is where it lands.
    case "primaryTarget": {
      const unit = (board.units ?? []).find((u) => u.id === placement.primaryTargetId);
      if (!unit?.panel) {
        errors.push("No target to centre this on.");
        return { ...base, panel: casterPanel, panels: [] };
      }
      return { ...base, panel: unit.panel, panels: unit.panels?.length ? unit.panels : [unit.panel], unitId: unit.id };
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
 * A choice among one is no choice. A `chosen` selection whose anchor already
 * named the Unit (21 of the 23 abilities that author it: `targetUnit`,
 * `withinRange` and `fieldEdge` over a `unit` shape) comes back from the
 * resolver with `needsChoice` and a single candidate, and the session used to
 * send its `resolved.units` -- always empty -- as `chosenIds`, which the
 * resolver read as "the player chose nobody" (#129). So the one candidate is
 * chosen here, by resolving again under its id, which keeps every limit in
 * force. Two or more candidates stay `needsChoice`: the session asks.
 *
 * @param {object} spec
 * @param {object} caster
 * @param {object} board
 * @param {object} placement
 * @returns {{ok: boolean, reasons: string[], warnings: string[], resolved: ResolvedTargets}}
 */
export function validate(spec, caster, board, placement = {}) {
  let resolved = resolveTargets(spec, caster, board, placement);
  if (resolved.needsChoice && resolved.candidates.length === 1) {
    resolved = resolveTargets(spec, caster, board, {
      ...placement, chosenIds: [resolved.candidates[0].unitId],
    });
  }
  return {
    ok: resolved.errors.length === 0,
    reasons: resolved.errors,
    warnings: resolved.warnings,
    resolved,
  };
}

/**
 * The Units a resolution is about, for drawing: who is caught, or -- while a
 * choice is still owed -- who could be chosen.
 *
 * @param {{units?: object[], candidates?: object[], needsChoice?: boolean}} resolved
 * @returns {object[]}
 */
export function unitsShown(resolved) {
  return (resolved?.needsChoice ? resolved.candidates : resolved?.units) ?? [];
}

/**
 * What an engine entry point refuses when a choice is still owed.
 *
 * `resolveTargets` answers a `chosen` selection with `needsChoice` until the
 * placement carries `chosenIds`, and the interface settles that before it
 * sends anything (`validate`, the review dialog). A choice that survives to
 * the engine came from a path that never asked -- a macro, a stale client --
 * and running it resolved against nobody while still paying the cost (#129).
 *
 * @param {{needsChoice?: boolean}} resolved a `ResolvedTargets`
 * @returns {string[]}
 */
export function pendingChoiceErrors(resolved) {
  return resolved?.needsChoice ? ["Choose a target."] : [];
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
 * How far an anchor reaches.
 *
 * `range:` states an absolute number and `rangeBonus:` states a **relative**
 * one, on top of whatever the caster's own Range happens to be. The second is
 * how the corpus actually writes an Attack Skill's reach -- Mannanán's *Toole
 * Fragarach* is *"Range+2 for the Combat Process"* and her *Hallowed Sea God's
 * Sword* is *"Range+1"* -- and for her it is not the same thing as an absolute
 * number: Holder Mode moves her Range from 1 to 3 and both Skills move with it.
 *
 * @param {object} spec an anchor spec
 * @param {object} caster
 * @returns {number}
 */
function anchorRange(spec, caster) {
  if (typeof spec?.range === "number") return spec.range;
  return (caster?.range ?? 1) + (spec?.rangeBonus ?? 0);
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
  const range = anchorRange(anchor, caster);

  switch (anchor.kind) {
    // Mode A. Four directions, always all four, so the player sees the choice
    // rather than discovering it.
    case "selfEdgeAdjacent":
      // Eight for a shape that says so. Bellerophon *"hits a 1x13 or 13x1
      // panel area in a straight line IN ANY DIRECTION (INCLUDING DIAGONAL)"*,
      // and `domain/geometry.mjs#line` has stepped a diagonal correctly since
      // it was written -- `DELTA` holds all eight compass values too. Only
      // this picker was cardinal-only, so a diagonal line was expressible and
      // unofferable. Ch. 45 reads it as a geometry gap; it was not.
      return (spec.shape?.directions === "all"
        ? ["n", "ne", "e", "se", "s", "sw", "w", "nw"]
        : ["n", "e", "s", "w"]).map((direction) => ({ direction }));

    // Mode B. Every panel the anchor could legally sit on, plus the panels just
    // outside it -- the overlay needs to draw the boundary, not only its inside.
    case "withinRange": {
      const out = [];
      const seen = new Set();
      // Around every panel the caster occupies, for the reason
      // `resolveAnchor` measures from all of them: an overlay drawn around a
      // 9x9 platform's top-left corner offers panels the resolver refuses and
      // hides panels it would allow. Deduplicated, because the discs around
      // neighbouring panels overlap almost entirely.
      const from = caster.panels?.length ? caster.panels : [caster.panel];
      const reach = range + 1;
      for (const origin of from) {
        for (let di = -reach; di <= reach && out.length < max; di++) {
          for (let dj = -reach; dj <= reach && out.length < max; dj++) {
            const panel = { i: origin.i + di, j: origin.j + dj };
            if (!inBounds(panel, board)) continue;
            const at = `${panel.i},${panel.j}`;
            if (seen.has(at)) continue;
            seen.add(at);
            out.push({ panel });
          }
        }
      }
      return out;
    }

    // Mode C. Every unit on the board; the relation and range filters inside
    // the resolver decide which are legal. `fieldEdge` names a Unit too -- the
    // one Doomsday Come's drag pulls in -- and offered nothing, so the session
    // refused it at once: "No legal targets … Choose a target." (#180).
    case "targetUnit":
    case "fieldEdge":
      return (board.units ?? [])
        .filter((u) => u.id !== caster.id || spec.selection?.includeSelf)
        .slice(0, max)
        .map((u) => ({ unitId: u.id }));

    // Everything else resolves without a choice -- but a turnable shape
    // offers its quarter turn too (#187 reading 6), so the picker can toggle.
    default:
      return turnable(spec) ? [{}, { transverse: true }] : [{}];
  }
}

/**
 * The middle panel of a platform's front edge, the edge its facing points out
 * of. An even edge rounds toward its lower index.
 *
 * @param {object} platform
 * @param {string} facing
 * @returns {GridOffset}
 */
function bowOf(platform, facing) {
  const panels = platform.panels?.length ? platform.panels : [platform.panel];
  const is = panels.map((p) => p.i); const js = panels.map((p) => p.j);
  const [iMin, iMax, jMin, jMax] = [Math.min(...is), Math.max(...is), Math.min(...js), Math.max(...js)];
  const midI = iMin + Math.floor((iMax - iMin) / 2);
  const midJ = jMin + Math.floor((jMax - jMin) / 2);
  // A lookup rather than a `switch`: the vocabulary test reads every `case`
  // in this file as an anchor kind.
  const edge = { s: { i: iMax, j: midJ }, e: { i: midI, j: jMax }, w: { i: midI, j: jMin } };
  return edge[facing] ?? { i: iMin, j: midJ };
}

/**
 * Does this spec's shape, or any shape a conditional could pick, turn?
 *
 * @param {object} spec
 * @returns {boolean}
 */
function turnable(spec) {
  const anchor = spec.anchor ?? {};
  const shapes = [spec.shape, ...(anchor.branches ?? []).map((b) => b.shape), anchor.otherwise?.shape];
  return shapes.some((s) => s?.turnable === true);
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
 * @see docs/20-targeting.md
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
 * Is this Unit standing on the platform's deck?
 *
 * @param {object} unit
 * @param {object} deck
 * @returns {boolean}
 */
function aboard(unit, deck) {
  if (unit.id === deck.id) return false;
  if (unit.platformId) return unit.platformId === deck.id;
  return (unit.level ?? 0) !== 0 && (unit.level ?? 0) === (deck.level ?? 0)
    && (deck.panels ?? []).some((p) => p.i === unit.panel?.i && p.j === unit.panel?.j);
}

/**
 * Case 1 of the rulebook's three (#181): a Master whose guard is within 2
 * panels of it AND within the attacker's Range cannot be targeted -- *"the AU
 * can only target the Servant"*. Cases 2 and 3 let the Master be targeted and
 * act at the start of the Combat Phase (`engine/master-guard.mjs`). This used
 * to refuse whenever a guard stood ADJACENT, which is case 2's condition with
 * case 1's answer. Presence Concealment and several abilities bypass it.
 *
 * `guardsOf` rather than "any Servant of that faction": Pale Rider's Kagome
 * Spirits stand in for him, he does not protect his own Master at all, and a
 * charmed Servant guards nobody (Ch. 32).
 *
 * @param {object} unit
 * @param {object} caster
 * @param {object} board
 * @param {number} range the attack's Range
 * @returns {boolean}
 */
function isProtectedMaster(unit, caster, board, range) {
  if (unit.kind !== "master") return false;
  if (relationOf(caster, unit, board) !== "enemy") return false;
  return guardsInRange(unit, caster, board, range).length > 0;
}

/**
 * @param {object} u
 * @param {object} caster
 * @param {Map<string, number>|null} bands
 * @param {boolean} caught the shape caught it rather than a choice naming it:
 *   Presence Concealment's coin is for a Unit *"caught in an AoE Attack"*, and
 *   a chosen concealed Unit only survives step 7 when the spec waived it (#185)
 * @returns {TargetedUnit}
 */
function toTargeted(u, caster, bands, caught) {
  return {
    unitId: u.id,
    distance: geo.chebyshev(caster.panel, u.panel),
    band: bands?.get(geo.key(u.panel)) ?? 0,
    concealedAoE: Boolean(u.concealed) && caught,
    relation: u.id === caster.id ? "self" : (u.relation ?? "enemy"),
  };
}

/**
 * How many of a Unit's five Parameters sit at least `steps` Ranks below the
 * caster's own.
 *
 * Achilles's duel: *"cannot be used on ... Units with at least 3 Parameters one
 * Rank lower than Achilles'."* No predicate can say this — "three of the five,
 * each at least one Rank down" is an aggregate, and the predicate language
 * deliberately has no aggregate form.
 *
 * A Parameter one of them does not have is skipped rather than counted: it
 * cannot be lower than something that is not there.
 *
 * @param {object} caster
 * @param {object} target
 * @param {number} steps
 * @returns {number}
 */
function parametersBelowBy(caster, target, steps) {
  let below = 0;
  for (const key of ["str", "end", "agi", "mag", "luc"]) {
    const mine = Rank.parseOrNull(caster?.parameters?.[key] ?? null);
    const theirs = Rank.parseOrNull(target?.parameters?.[key] ?? null);
    if (!mine || !theirs) continue;
    // "One Rank lower" is one letter GRADE, not one `+`/`−` step: Ch. 03
    // keeps the two scales apart, and `stepGrade` is the one that moves
    // grades. B+ against an A is not "one Rank lower"; a B is.
    if (Rank.compare(theirs, mine.stepGrade(-steps)) <= 0) below += 1;
  }
  return below;
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
 * replayed combat produces the same targets (Ch. 37).
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
