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

import { currentBoard } from "./board.mjs";
import { panelsOf } from "../rules/bounded-fields.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { relationOf } from "../rules/relations.mjs";
import { evade, checkPlan } from "../rules/checks.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { platformCentre } from "../rules/platforms.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import * as I from "./intents.mjs";

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
  const geometry = { ...(specGeometry ?? {}), anchor: { ...anchor } };
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
 * The Region shape covering a panel list.
 *
 * One rectangle per panel rather than a traced outline: a field's panels are
 * always a solid block in the reference set, and Foundry unions overlapping
 * shapes anyway — so the simple version is correct and a traced polygon would
 * be a second place for the geometry to be wrong.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @param {object} scene
 * @returns {object}
 */
function shapeOf(panels, scene) {
  const size = scene.grid?.size ?? 100;
  const is = panels.map((p) => p.i);
  const js = panels.map((p) => p.j);
  const top = Math.min(...is);
  const left = Math.min(...js);

  return {
    type: "rectangle",
    x: left * size,
    y: top * size,
    width: (Math.max(...js) - left + 1) * size,
    height: (Math.max(...is) - top + 1) * size,
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
export async function runFieldEvents(event) {
  const board = currentBoard();
  /** @type {object[]} */
  const intents = [];

  for (const field of board.fields ?? []) {
    for (const spec of field.interiorEvents ?? []) {
      if (spec.event !== event) continue;
      intents.push(...await runFieldEvent(field, spec, board));
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
async function runFieldEvent(field, spec, board) {
  const owner = (board.units ?? []).find((u) => u.id === field.ownerId) ?? null;
  const relations = new Set(spec.relations ?? ["enemy"]);
  const kinds = spec.kinds ? new Set(spec.kinds) : null;
  // Sikera Ušum clause b: "a Unit OTHER THAN Semiramis OR HER MASTER" -- the
  // owner was always excluded; the owner's Master needed a second exclusion
  // no prior field needed.
  const excludedIds = new Set([field.ownerId, ...(spec.excludeOwnerMaster ? [field.ownerMasterId] : [])]);

  const inside = (board.units ?? []).filter((u) =>
    (u.fields ?? []).includes(field.id)
    && !excludedIds.has(u.id)
    // "Acts then ends its Turn within the NP area" -- a Unit that never Acted
    // this Turn has nothing to trigger the clause with.
    && (!spec.requiresActed || u.acted)
    && (!kinds || kinds.has(u.kind))
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
