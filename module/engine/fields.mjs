/**
 * @file Creating a bounded field on the board.
 * @see docs/43-bounded-fields.md, module/rules/bounded-fields.mjs
 *
 * Layer 3. The **write** half of Ch. 43.
 *
 * Everything that reads a field already existed and none of it had ever run.
 * `panelsOf`, `membershipVerdict`, `escapeAttempt`, `isolationBlocks`,
 * `interiorModifiers`, `annotateFields`, the `NPFieldBehavior` data model,
 * `boundedFieldsOf` on the board projection, and the isolation filter inside
 * the targeting resolver are all shipped, tested and wired to each other — and
 * `board.fields` was only ever populated from Regions that nothing created. So
 * Asterios's *Chaos Labyrinthos* has authored six axes since he was written and
 * has never trapped anybody, and EMIYA's *Unlimited Blade Works* would have
 * done the same.
 *
 * A field is a Foundry **Region** carrying an `npField` behaviour, for the
 * reasons Ch. 42 gives for terrain: membership is maintained natively,
 * `tokenEnter`/`tokenExit` fire natively, and the shape survives a reload
 * without this module having to remember anything.
 */

import { currentBoard, unitSnapshot } from "./board.mjs";
import { currentHealth } from "../domain/health.mjs";
import { panelsOf, isExempt, legalRepaint, mayReshape } from "../rules/bounded-fields.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { relationOf } from "../rules/relations.mjs";
import { evade, checkPlan } from "../rules/checks.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { platformCentre } from "../rules/platforms.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import * as I from "./intents.mjs";

/**
 * A field's shape, grown or shrunk by the war Region it is cast in.
 *
 * > *"Affects a 9x9 panel area around Asterios when used; **if the Region is
 * > Greece, it affects an 11x11 panel area instead**."*
 *
 * `regionSizeOverride` has been authored on his *Chaos Labyrinthos* since he was
 * written and had **no reader at all**, so the home-ground clause on the largest
 * bounded field in the game did nothing. It is the field-shaped sibling of
 * `regionScaled` (`engine/scheduler.mjs#regionScale`), which does the same job
 * for a resource gain.
 *
 * Keyed on the war Region rather than on the caster's own `region` list: the
 * clause is about *where the war is being fought*, not about where the Servant
 * is from — Asterios is Greek wherever he is summoned, and the sheet still only
 * gives him the bigger Labyrinth in Greece.
 *
 * Sizes a `square` by `size` and a `rect` by both edges. A shape with neither is
 * returned untouched rather than guessed at.
 *
 * @param {object|null|undefined} geometry
 * @param {string|null} warRegion
 * @returns {object|undefined}
 */
export function regionSizedShape(geometry, warRegion) {
  const shape = geometry?.shape;
  const override = geometry?.regionSizeOverride?.[warRegion ?? ""];
  if (!shape || override === undefined || override === null) return shape;

  if (shape.kind === "square") return { ...shape, size: override };
  if (shape.kind === "rect") return { ...shape, w: override, h: override };
  return shape;
}

/**
 * Open the bounded field an ability declares.
 *
 * @param {object} ability the ability Item
 * @param {object} actor the caster
 * @param {object} [board] an existing snapshot
 * @returns {Promise<object|null>} the created Region, or null when there is nowhere to put it
 */
export async function createField(ability, actor, board = null) {
  const spec = ability?.system?.field ?? null;
  const scene = canvas?.scene ?? null;
  if (!spec || !scene) return null;

  const snapshot = board ?? currentBoard();
  const self = (snapshot.units ?? []).find((u) => u.id === actor.id);
  if (!self?.panel) return null;

  // Sikera Ušum: the area rules (interior a-e) are the same regardless of
  // which of Semiramis's two variants cast it, but the SHAPE is not -- a 5x5
  // that follows her for 2◈ Turns off her Hanging Gardens, the fixed 5x5
  // Throne Room for 3◈ Turns aboard it. `branches` overrides just the two
  // axes that differ, selected the same way `damage.branches`/
  // `targeting.branches`/`cooldown.branches` (engine/attack.mjs,
  // rules/ability-use.mjs, engine/cooldown.mjs) pick between an ability's
  // several behaviours -- first match wins, falling back to the base
  // `geometry`/`duration` when nothing matches or there are no branches.
  const options = rollOptionsFor({ attacker: self });
  const branch = (spec.branches ?? []).find((b) => testPredicate(b.predicate, { options }));
  const specGeometry = branch?.geometry ?? spec.geometry;
  const specDuration = branch?.duration ?? spec.duration;
  // "All Units within the Throne Room... cannot leave it" is stated only for
  // Sikera Ušum's Throne-Room branch, not its 5x5-follows-her one -- a
  // per-branch override, same as geometry/duration, rather than a blanket
  // membership rule every field caster would otherwise inherit.
  const specMembership = branch?.membership ?? spec.membership;

  // The anchor is stamped at cast time even for a `followsUnit` geometry, so a
  // field whose anchor is later defeated still knows where it was — and a
  // `fixedArea` one does not silently follow its caster, which is the
  // difference between a Reality Marble and a Labyrinth.
  //
  // `anchorRef: "platform"` overrides the default (the caster's own panel)
  // with the platform's geometric centre -- Sikera Ušum's Throne-Room branch
  // is "the Throne Room", a named place fixed to the Hanging Gardens itself,
  // not wherever aboard it she happens to be standing when she casts.
  const platform = self.platformId ? (snapshot.units ?? []).find((u) => u.id === self.platformId) : null;
  const anchor = specGeometry?.anchorRef === "platform"
    ? (platformCentre(platform) ?? self.panel)
    : self.panel;
  const geometry = {
    ...(specGeometry ?? {}),
    shape: regionSizedShape(specGeometry, snapshot.warRegion),
    anchor: { ...anchor },
  };
  const field = {
    // `fieldId`, which is what `NPFieldBehavior` declares and what
    // `boundedFieldsOf` reads back. Written as `id`, the behaviour failed
    // validation on a required field and Foundry dropped it **silently** --
    // leaving a Region on the canvas with an empty `behaviors` collection, so
    // the Reality Marble existed and carried none of its six axes.
    fieldId: ability.system?.contentId ?? ability.id,
    ownerUnitId: actor.id,
    ownerMasterId: actor.system?.masterId ?? null,
    ownerFaction: self.faction ?? null,
    npTags: [...(ability.system?.npTags ?? [])],
    geometry,
    membership: specMembership ?? null,
    isolation: spec.isolation ?? null,
    interior: spec.interior ?? [],
    interiorEvents: spec.interiorEvents ?? [],
    extension: spec.extension ?? null,
    vulnerabilities: spec.vulnerabilities ?? [],
    onEnd: spec.onEnd ?? [],
    createdAt: game.combat?.system?.globalTurn ?? 0,
    upkeep: spec.upkeep ?? null,
    deactivation: spec.deactivation ?? null,
    duration: specDuration ?? null,
    // Absolute, like every other duration in the system (§7.5): a countdown
    // would have to be decremented by a hook that can fail to fire, and an
    // absolute expiry cannot.
    expiry: expiryOf(specDuration),
    state: { escapeHistory: {} },
  };

  // `panelsOf` reads the runtime shape, where the id is `id` and the owner is
  // `ownerId`; the stored behaviour uses the schema's names. One object, two
  // vocabularies, so the runtime view is built explicitly rather than assumed.
  const runtime = { ...field, id: field.fieldId, ownerId: actor.id };
  // A FREEFORM field has no shape to compute from -- `panelsOf` reads its
  // stored `panels` and a newly created one has none, so it would open with
  // zero panels and `createField` would refuse it outright. The authored
  // `shape` is its OPENING footprint: Jack's Mist "covers a maximum of 25
  // panels ... cannot expand past a distance of 4 panels from Jack", and a 5x5
  // centred on her is exactly 25 panels every one of which is within 2 -- the
  // largest legal opening, which is what a player who draws nothing wants.
  // Reshaping it is a separate control (§43.4).
  if (specGeometry?.kind === "freeform" && !field.panels) {
    field.panels = panelsOf({ ...runtime, geometry: { ...geometry, kind: "fixedArea" } }, snapshot);
    runtime.panels = field.panels;
  }
  const panels = panelsOf(runtime, snapshot);
  if (panels.length === 0) return null;

  // The membership snapshot itself, taken at the same moment the panels are
  // -- "Units within the Throne Room WHEN THE NP WAS ACTIVATED", not
  // whoever happens to be standing there the instant something asks.
  if (specMembership?.trappedAtActivation) {
    const panelKeys = new Set(panels.map((p) => `${p.i},${p.j}`));
    field.state.trappedUnitIds = (snapshot.units ?? [])
      .filter((u) => u.panel && panelKeys.has(`${u.panel.i},${u.panel.j}`))
      .map((u) => u.id);
  }

  const existing = scene.regions?.find((r) =>
    r.behaviors?.some((b) => b.type === "npField" && b.system?.fieldId === field.fieldId));
  // One field per ability. Recasting replaces rather than layering: two
  // overlapping copies of one Reality Marble would each answer the isolation
  // question, and a Unit could be inside one and outside the other.
  if (existing) await existing.delete();

  const [region] = await scene.createEmbeddedDocuments("Region", [{
    name: ability.name,
    shapes: [shapeOf(panels, scene)],
  }]);
  if (!region) return null;

  // The behaviour is created SEPARATELY. Passing it inline in the Region's
  // creation data is accepted without complaint and silently produces a Region
  // with an empty `behaviors` collection -- so the field existed on the canvas,
  // carried none of its six axes, and `boundedFieldsOf` skipped it.
  const [behavior] = await region.createEmbeddedDocuments("RegionBehavior", [{
    name: ability.name,
    type: "npField",
    system: field,
  }]);
  // A dropped behaviour is the failure mode that hides: the Region is on the
  // canvas and looks like a working field. Loud, and the Region goes with it,
  // because half a bounded field is worse than none.
  if (!behavior) {
    console.error(`FGT | ${ability.name} created a Region whose npField behaviour was rejected.`);
    await region.delete();
    return null;
  }
  // Whoever the shape just closed around has made CONTACT with it. Jack's
  // Mist kills Normal Humans caught in it and Poisons enemy Masters on
  // contact -- and "caught in" plainly covers the fog rolling over you, not
  // only walking into it. The mover-side pass lives in movement-hooks.mjs.
  const caught = (snapshot.units ?? [])
    .filter((u) => u.panel && panels.some((q) => q.i === u.panel.i && q.j === u.panel.j))
    .map((u) => u.id);
  if (caught.length > 0) {
    const intents = await runFieldEvents("contact", { unitIds: caught });
    if (intents.length > 0) await applyWorldIntents(intents, "field:contact");
  }

  return region;
}

/**
 * Close a field, by the ability that opened it.
 *
 * @param {string} fieldId
 * @returns {Promise<boolean>} whether anything was there to close
 */
export async function endField(fieldId) {
  const scene = canvas?.scene ?? null;
  const region = scene?.regions?.find((r) =>
    r.behaviors?.some((b) => b.type === "npField" && b.system?.fieldId === fieldId));
  if (!region) return false;
  await region.delete();
  return true;
}

/**
 * Set the owning ability's cooldown from its OWN `max`, if it is authored
 * `countFrom: "deactivation"`.
 *
 * @param {object} field
 * @returns {Promise<void>}
 */
async function setCooldownOnDeactivation(field) {
  const owner = game.actors.get(field.ownerId);
  // `field.id` IS `ability.system.contentId ?? ability.id` -- exactly how
  // `createField` stamped it as `fieldId` -- so the same lookup finds the
  // ability back (`board.mjs`'s `boundedFieldsOf` projects it as `id`).
  const ability = owner?.items?.find?.((i) => (i.system?.contentId ?? i.id) === field.id);
  const cd = ability?.system?.cooldown ?? null;
  if (!cd || cd.countFrom !== "deactivation" || !cd.max) return;

  const ticks = resolveTicks(parseTick(String(cd.max)), {
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  });
  if (ticks <= 0) return;

  await applyWorldIntents(
    [I.cooldown(owner.id, ability.id, ticks, "set")],
    `field:deactivationCooldown:${field.id}`,
  );
}

/**
 * The absolute tick a field expires on.
 * @param {string|null} duration
 * @returns {number|null}
 */
function expiryOf(duration) {
  if (!duration) return null;
  const turns = resolveTicks(parseTick(duration), {
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  });
  return (game.combat?.system?.globalTurn ?? 0) + turns;
}

/**
 * The Region shape that stores a field's panels.
 *
 * A **grid** shape with explicit offsets, not the bounding rectangle this used
 * to return. The docstring it replaces argued that one rectangle was fine
 * because "a field's panels are always a solid block in the reference set" —
 * true when every field in the corpus was a square, and false the moment
 * anything is painted freehand.
 *
 * It is not merely a display question. `engine/board.mjs#boundedFieldsOf` reads
 * a field's panels back **off its Region** (`panelsOfRegion`, which prefers
 * `getOccupiedGridSpaceOffsets()`), so a rectangle meant the stored panel set
 * was discarded on every board read and replaced by its own bounding box. Paint
 * an L and the board fills in the notch — silently, because the two agree for
 * every shape that has ever been cast.
 *
 * `apps/canvas/target-region.mjs#gridShape` has always done it this way for
 * transient targeting areas; fields simply never did.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @param {object} scene unused, kept so the call site does not change
 * @returns {{type: string, offsets: Array<{i: number, j: number}>, origin: null}}
 */
export function shapeOf(panels, scene) { // eslint-disable-line no-unused-vars
  return {
    type: "grid",
    offsets: panels.map((p) => ({ i: p.i, j: p.j })),
    // Null anchors at the first offset, which is already an absolute board
    // position -- fields work in absolute panels, never in deltas.
    origin: null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Close every field whose expiry has arrived, and every one whose owner is gone.
 *
 * The reader `duration` and `vulnerabilities` never had. A field with a
 * duration and nothing to enforce it is permanent, which for a total-isolation
 * Reality Marble means the match never ends.
 *
 * @param {number} tick the current global turn
 * @returns {Promise<string[]>} the ids closed
 */
export async function expireFields(tick) {
  const scene = canvas?.scene ?? null;
  if (!scene) return [];

  /** @type {string[]} */
  const closed = [];
  for (const field of currentBoard().fields ?? []) {
    if (!shouldClose(field, tick)) continue;
    if (await endField(field.id)) {
      closed.push(field.id);
      // Sikera Ušum's "6◈+⅓◈ Turns AFTER the NP ends" -- a clock that starts
      // at the field's OWN closure, not at the ability's use, the same shape
      // Presence Concealment's `countFrom: deactivation` already reads for a
      // standing effect (`engine/concealment.mjs`'s `cooldownTicks`). A field
      // has no effect instance to watch for deletion, so its own lifecycle
      // is the trigger instead.
      await setCooldownOnDeactivation(field);
    }
  }
  return closed;
}

/**
 * @param {object} field
 * @param {number} tick
 * @returns {boolean}
 */
function shouldClose(field, tick) {
  if (field.expiry !== null && field.expiry !== undefined && field.expiry <= tick) return true;

  // Axis 6. "Owner defeat ends it" is the only vulnerability in the reference
  // set that resolves without a roll, and both authored fields carry it.
  const onOwnerDefeat = (field.vulnerabilities ?? []).some(
    (v) => v.kind === "ownerDefeat" && v.result === "end",
  );
  if (!onOwnerDefeat) return false;
  return Boolean(game.actors.get(field.ownerId)?.system?.defeated);
}

/**
 * Run every field's own start-of-Turn rules.
 *
 * These belong to the AREA rather than to its caster, which is the whole reason
 * they are authored on the field: a Servant dragged into Unlimited Blade Works
 * is subject to the toll, and EMIYA's own event handlers do not follow anybody
 * around.
 *
 * *"At the start of every Turn, all enemy Servants within Unlimited Blade Works
 * perform an Evade roll. If failed, that Unit receives (25 x 1d4) STR damage;
 * this damage is not affected by any damage modifying effects on EMIYA."*
 *
 * @param {string} event the boundary that fired
 * @returns {Promise<object[]>} the intents produced
 */
export async function runFieldEvents(event, { unitIds = null, fieldIds = null, assumeInside = false } = {}) {
  const board = currentBoard();
  /** @type {object[]} */
  const intents = [];

  for (const field of board.fields ?? []) {
    if (fieldIds && !fieldIds.includes(field.id)) continue;
    for (const spec of field.interiorEvents ?? []) {
      if (spec.event !== event) continue;
      intents.push(...await runFieldEvent(field, spec, board, unitIds, assumeInside));
    }
  }
  return intents;
}

/**
 * @param {object} field
 * @param {object} spec
 * @param {object} board
 * @returns {Promise<object[]>}
 */
async function runFieldEvent(field, spec, board, unitIds = null, assumeInside = false) {
  const owner = (board.units ?? []).find((u) => u.id === field.ownerId) ?? null;
  const relations = new Set(spec.relations ?? ["enemy"]);
  const kinds = spec.kinds ? new Set(spec.kinds) : null;
  // Sikera Ušum clause b: "a Unit OTHER THAN Semiramis OR HER MASTER" -- the
  // owner was always excluded; the owner's Master needed a second exclusion
  // no prior field needed.
  const excludedIds = new Set([field.ownerId, ...(spec.excludeOwnerMaster ? [field.ownerMasterId] : [])]);

  const inside = (board.units ?? []).filter((u) =>
    (!unitIds || unitIds.includes(u.id))
    // `assumeInside` is the CONTACT path, and it is not a shortcut: at
    // `moveToken` the board still places the mover on the panel it left --
    // `currentBoard()` reads the canvas placeables, which lag the document,
    // which itself lags the movement payload -- so `u.fields` says "outside"
    // for the very unit that just walked in. The caller established membership
    // from `movement.origin`/`destination`, which is the only source that is
    // right at this instant, and says so here.
    && (assumeInside || (u.fields ?? []).includes(field.id))
    && !excludedIds.has(u.id)
    // "Acts then ends its Turn within the NP area" -- a Unit that never Acted
    // this Turn has nothing to trigger the clause with.
    && (!spec.requiresActed || u.acted)
    && (!kinds || kinds.has(u.kind))
    // An interior EVENT may be exempted the same way an interior RULE is.
    // `isExempt` was wired into `interiorModifiers` alone, so a clause like
    // Jack's "High Rank Masters are not Poisoned upon contact" authored its
    // exemption, compiled it, and fired anyway -- found live, because the unit
    // test exercised `isExempt` and the rule path rather than this one.
    && !isExempt(spec.exemptIf, u, board)
    && relations.has(relationOf(owner, u, board)));

  /** @type {object[]} */
  const out = [];
  for (const unit of inside) {
    // The check the Unit gets to avoid it. A success is a clean escape: the
    // sheet says "perform an Evade roll. If Failed, that Unit receives …", so
    // there is no partial outcome.
    if (spec.check === "evade") {
      const roll = await new Roll("1d20").evaluate();
      const plan = checkPlan(unit, "evade");
      const outcome = evade({
        roll: roll.total,
        agility: unit.agility,
        hasDodge: (unit.effects ?? []).includes("dodge"),
        forceUnfavourable: plan.forceTable === "unfavourable",
        autoSucceed: plan.autoSucceed,
        modifiers: plan.modifiers,
      });
      if (outcome.success) continue;
    }

    for (const action of spec.onFail ?? []) {
      if (action.key === "Damage") {
        const rolled = action.roll?.formula
          ? (await new Roll(action.roll.formula).evaluate()).total * (action.roll.factor ?? 1)
          : (action.amount ?? 0);
        if (rolled <= 0) continue;
        // A bare damage intent, never the pipeline: "not affected by any damage
        // modifying effects on EMIYA" is the same exemption periodic effect
        // damage carries, and running the pipeline would apply his Atk Up to it.
        out.push(I.damage(unit.id, rolled, null, {
          bypassModifiers: true, source: field.id, component: action.component ?? "str",
        }));
        continue;
      }

      // Jack's Mist: *"Normal Humans immediately die if they are caught in the
      // Mist (this counts as Jack killing the Human)."* No damage number and
      // no roll -- the same shape §4.6 gives a Servant attacking a Civilian,
      // which `rules/environment.mjs#civilianKill` already writes as a bare
      // defeat plus the killer's bounty.
      //
      // `creditOwner` is the parenthesis, and it is load-bearing rather than
      // flavour: Jack's own Sustainability GROWS by 1◈ for every Human she
      // kills while she is a Free Servant, and a death the field takes credit
      // for instead of her would quietly stop paying her.
      if (action.key === "Defeat") {
        out.push(I.defeat(unit.id, action.cause ?? "field"));
        if (action.creditOwner && field.ownerId) {
          out.push(I.log({
            kind: "defeat", event: "fieldKill", unitId: unit.id,
            by: field.ownerId, field: field.id, victimKind: unit.kind,
          }));
        }
        continue;
      }

      // Sikera Ušum clause b: "it is inflicted with Poison" -- no damage
      // number to roll, an effect to apply. `expiry: null` is the correct
      // "no duration" reading (Ch. 7 §7.5's resolution, the same one an
      // ability phase's `applyEffects` uses): Poison's own duration is its
      // stage clock, not this rider's.
      if (action.key === "ApplyEffect") {
        out.push(I.applyEffect(unit.id, {
          defId: action.effect?.id ?? action.effect?.defId,
          magnitude: action.effect?.magnitude ?? 0,
          expiry: null,
          sourceUnitId: field.ownerId,
        }, field.ownerId));
      }
    }
  }
  return out;
}

/**
 * Charge every open field's recurring toll, and close the ones nobody can pay.
 *
 * The other half of axis 5. `duration` closes a field on a clock; an `upkeep`
 * keeps it open only as long as somebody keeps paying, which is a different
 * shape and the one Jack's Mist uses: *"At the end of the Turn after every 1◈
 * Turns since this NP was activated, Jack's Master loses 15 Health."*
 *
 * The refusal is what makes it a real limit rather than a slow drain:
 * *"forcefully deactivated if Jack's Master has 15 Health or less and would
 * lose Health due to this effect. Her Master does not lose Health on the same
 * Turn this NP is deactivated."* So an unaffordable toll closes the field
 * **instead** of being charged — not charged and then closed, which would take
 * a Master to 0 and kill a Servant the sheet is protecting.
 *
 * @param {number} tick the global turn that just ended
 * @returns {Promise<void>}
 */
export async function runUpkeep(tick) {
  const board = currentBoard();
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");

  for (const field of board.fields ?? []) {
    const upkeep = field.upkeep;
    if (!upkeep?.every) continue;

    const period = resolveTicks(parseTick(upkeep.every), { turnsPerRound });
    if (!(period > 0)) continue;
    const since = tick - (field.lastUpkeepAt ?? field.createdAt ?? tick);
    if (since < period) continue;

    // Who pays. `ownerMaster` is the only payer any sheet names, but the field
    // is the wrong place to assume it: the Golden Hind's upkeep is Drake's own
    // Health, and that is the same axis with a different payer.
    const payerId = upkeep.cost?.payer === "owner"
      ? field.ownerId
      : (field.ownerMasterId ?? game.actors.get(field.ownerId)?.system?.masterId ?? null);
    const payer = payerId ? game.actors.get(payerId) : null;
    const amount = Number(upkeep.cost?.amount ?? 0);

    if (!payer || (upkeep.endWhenUnaffordable && currentHealth(unitSnapshot(payer)) <= amount)) {
      await applyWorldIntents(
        [I.log({
          kind: "field", event: "upkeepUnaffordable", unitId: payerId ?? field.ownerId,
          field: field.id, amount,
        })],
        "field:upkeep",
      );
      await deactivateField(field.id, "upkeep");
      continue;
    }

    await applyWorldIntents(
      [I.damage(payer.id, amount, null, { bypassModifiers: true, source: field.id })],
      "field:upkeep",
    );
    await stampUpkeep(field, tick);
  }
}

/**
 * Record when a field last charged, so the next period counts from here.
 *
 * Written onto the behaviour rather than kept in memory for the same reason
 * every other field fact is: the state has to survive a reload, and a counter
 * held by whichever client happens to be the scheduler does not.
 *
 * @param {object} field
 * @param {number} tick
 * @returns {Promise<void>}
 */
async function stampUpkeep(field, tick) {
  const behavior = behaviorFor(field.id);
  if (!behavior) return;
  await behavior.update({ "system.state": { ...(behavior.system?.state ?? {}), lastUpkeepAt: tick } });
}

/**
 * The `npField` behaviour document backing a field id.
 *
 * @param {string} fieldId
 * @returns {object|null}
 */
function behaviorFor(fieldId) {
  for (const region of canvas?.scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type === "npField" && behavior.system?.fieldId === fieldId) return behavior;
    }
  }
  return null;
}

/**
 * Close a field and start its owning ability's cooldown.
 *
 * The difference from `endField` is the cooldown: an ability authored
 * `countFrom: "deactivation"` starts its clock here and not at the cast, and a
 * caller that deletes the Region directly skips that entirely.
 *
 * @param {string} fieldId
 * @param {string} [reason]
 * @returns {Promise<boolean>}
 */
export async function deactivateField(fieldId, reason = "manual") {
  const board = currentBoard();
  const field = (board.fields ?? []).find((f) => f.id === fieldId);
  if (!field) return false;

  await setCooldownOnDeactivation(field);
  for (const action of field.onEnd ?? []) {
    if (action.key !== "ApplyEffect") continue;
    await applyWorldIntents([I.applyEffect(field.ownerId, {
      defId: action.effect?.id, magnitude: action.effect?.magnitude ?? 0, expiry: null,
      sourceUnitId: field.ownerId,
    }, field.ownerId)], "field:onEnd");
  }
  await applyWorldIntents(
    [I.log({ kind: "field", event: "deactivated", unitId: field.ownerId, field: fieldId, reason })],
    "field:deactivate",
  );
  return endField(fieldId);
}

/**
 * May this unit switch this field off right now?
 *
 * Authored per field rather than assumed, because most cannot: a Reality
 * Marble runs its clock out. Jack's Mist is the exception — *"This NP can be
 * deactivated at any time … during her Turn or at the start or end of any Turn
 * or Round"* — and `window: "any"` is that sentence.
 *
 * @param {object} field
 * @param {string} unitId
 * @returns {boolean}
 */
export function mayDeactivate(field, unitId) {
  if (!field?.deactivation?.byOwner) return false;
  return field.ownerId === unitId;
}

/**
 * Redraw a freeform field's footprint in place.
 *
 * **In place** is the whole point. The field keeps its id, its interior rules,
 * its `createdAt` and its upkeep clock — closing it and casting it again would
 * restart the upkeep period and fire the owning ability's
 * `countFrom: "deactivation"` cooldown, which for Jack's Mist is 5◈ she has not
 * earned.
 *
 * Contact fires for whoever the NEW footprint closes over and not for anyone
 * the old one already covered, reusing the entry set `runContactEvents` takes.
 * So painting the fog onto an enemy Master Poisons him; painting it off and
 * back on next Turn Poisons him again, which is what "upon contact" means.
 *
 * @param {string} fieldId
 * @param {Array<{i: number, j: number}>} panels
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function repaintField(fieldId, panels) {
  const board = currentBoard();
  const field = (board.fields ?? []).find((f) => f.id === fieldId);
  if (!field) return { ok: false, reason: "noField" };

  const owner = (board.units ?? []).find((u) => u.id === field.ownerId);
  const verdict = legalRepaint(field, panels, owner?.panel ?? null);
  if (!verdict.ok) return verdict;

  const region = canvas?.scene?.regions?.get(field.regionId);
  const behavior = region?.behaviors?.find(
    (b) => b.type === "npField" && b.system?.fieldId === fieldId,
  );
  if (!region || !behavior) return { ok: false, reason: "noRegion" };

  const before = new Set((field.panels ?? []).map((p) => `${p.i},${p.j}`));
  const next = panels.map((p) => ({ i: p.i, j: p.j }));

  await region.update({ shapes: [shapeOf(next, canvas.scene)] });
  await behavior.update({ "system.panels": next });

  // Whoever the new footprint newly covers. Read from the board AFTER the
  // write, so a unit standing on a panel the fog just reached is found where
  // it actually is rather than where the old shape put it.
  const after = currentBoard();
  const caught = (after.units ?? [])
    .filter((u) => u.panel
      && next.some((p) => p.i === u.panel.i && p.j === u.panel.j)
      && !before.has(`${u.panel.i},${u.panel.j}`))
    .map((u) => u.id);

  if (caught.length > 0) {
    const intents = await runFieldEvents("contact", {
      unitIds: caught, fieldIds: [fieldId], assumeInside: true,
    });
    if (intents.length > 0) await applyWorldIntents(intents, "field:contact");
  }

  // "Does not count as Moving a Unit and is not an Attack" -- so this writes
  // the repaint flag and nothing else. Not `moved`, not `attacked`, not
  // `acted`.
  if (owner) {
    await applyWorldIntents([I.markTurn(owner.id, { reshapedField: true })], "field:repaint");
  }
  return { ok: true };
}

/**
 * Offer a repaint to every field owner whose Turn is ending and who acted.
 *
 * Jack's Mist gives two windows: *"During Jack's Turn OR at the end of any Turn
 * Jack Acts."* The first is a button on the token HUD. This is the second, and
 * it is OFFERED rather than left as a button that quietly stops working — a
 * window that closes silently is one players lose, and this one only opens on
 * Turns she acted, which is exactly when she is least likely to be watching
 * for it.
 *
 * The prompt goes to the owner's player, falling back to the GM, the same way
 * `engine/attack.mjs#askOwner` picks one. A refusal or a timeout is a decline:
 * the window shutting is the default outcome, not an error.
 *
 * @param {object} board
 * @returns {Promise<void>}
 */
export async function offerReshape(board) {
  if (!game.users.activeGM?.isSelf) return;

  for (const field of board.fields ?? []) {
    const owner = (board.units ?? []).find((u) => u.id === field.ownerId);
    if (!owner?.acted || !mayReshape(field, owner)) continue;

    const doc = game.actors.get(owner.id);
    if (!doc) continue;

    const user = game.users.find((u) => u.active && !u.isGM && doc.testUserPermission(u, "OWNER"))
      ?? game.user;
    const { FGTSocket } = await import("../net/socket.mjs");
    const picked = await FGTSocket.ask(user.id, {
      kind: "choose",
      title: game.i18n.localize("FGT.Paint.OfferTitle"),
      hint: game.i18n.format("FGT.Paint.OfferHint", { name: doc.name }),
      // `min: 0` -- keeping the shape is a legitimate play, and a dialog that
      // forced a redraw would make an optional clause mandatory.
      min: 0,
      count: 1,
      options: [{ id: "reshape", name: game.i18n.localize("FGT.Paint.Offer") }],
    }).catch(() => null);

    // Raised as a hook rather than opening the canvas layer from here: this is
    // layer 3 and the painter is layer 4, and the GM client running the
    // scheduler is not necessarily the client that answered.
    if ((picked ?? []).includes("reshape")) {
      Hooks.callAll("fgtOfferReshape", { fieldId: field.id, unitId: owner.id });
    }
  }
}
