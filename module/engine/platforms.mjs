/**
 * @file Platform operations — boarding, and coming apart.
 * @see docs/27-platforms-and-levels.md, Ch. 27
 *
 * Layer 3. The rules decide; this rolls, writes and moves tokens.
 */

import {
  boardingTarget, fallOff, destructionSequence, passengersOf, mayBringMaster,
  canFallFrom, nearestFreePlatformPanel, rescuerFor,
  jumpVerdict, jumpLandings,
} from "../rules/platforms.mjs";
import { relationOf } from "../rules/relations.mjs";
import { remainingMovement } from "../rules/movement.mjs";
import { currentBoard } from "./board.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { createLevel, moveToLevel, teardown, dropToGround } from "./scene-levels.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * Attempt to board a platform.
 *
 * The modifiers **reduce the required value** rather than adding to the roll —
 * the same arithmetic, and a very easy thing to implement backwards, so the
 * comparison is written the way the rulebook states it.
 *
 * *"A boarding Servant may bring its Master if the Master was within 2 panels."*
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.platformId
 * @param {boolean} [args.hitByDragonWingWarriors]
 * @param {boolean} [args.bringMaster]
 * @returns {Promise<{ok: boolean, roll: number, target: number, reason?: string}>}
 */
export async function boardPlatform({ unitId, platformId, hitByDragonWingWarriors = false, bringMaster = false }) {
  const board = currentBoard();
  const unit = board.units.find((u) => u.id === unitId);
  const platform = board.units.find((u) => u.id === platformId && u.kind === "platform");
  if (!unit || !platform) return { ok: false, roll: 0, target: 0, reason: "unknownUnitOrPlatform" };

  // Capacity is counted before the roll: failing a roll you could never have
  // benefited from wastes the attempt for no reason.
  const aboard = passengersOf(platform, board).length;
  if (platform.capacity !== null && aboard >= platform.capacity) {
    return { ok: false, roll: 0, target: 0, reason: "full" };
  }

  // Who has to roll at all. The Golden Hind's rule is aimed at ENEMIES --
  // *"If an ENEMY Unit attempts to board the Golden Hind, it rolls a ten-sided
  // die"* -- and its very next sentence lets everyone else walk on: *"Other
  // allied Units can board and unboard the Golden Hind by Moving onto it
  // normally."*
  //
  // Checked AFTER capacity, because a full ship is full for everybody, and a
  // platform that authors no `byRelation` makes everyone roll, which is the
  // Hanging Gardens' behaviour and stays the default.
  const gate = platform.boarding?.byRelation ?? null;
  if (gate && relationOf(unit, platform, board) !== gate) {
    await applyWorldIntents(
      [
        I.log({ kind: "boarding", unitId, platformId, roll: 0, target: 0, die: 0, ok: true, free: true }),
        I.move(unitId, [platform.panel], true),
      ],
      "platform:board",
    );
    return { ok: true, roll: 0, target: 0 };
  }

  const { die, target } = boardingTarget(unit, { hitByDragonWingWarriors, platform });
  const roll = (await new Roll(`1d${die}`).evaluate()).total;
  const ok = roll >= target;

  const intents = [I.log({
    kind: "boarding", unitId, platformId, roll, target, die, ok,
  })];

  if (ok) {
    intents.push(I.move(unitId, [platform.panel], true));
    if (bringMaster && unit.masterId) {
      const master = board.units.find((u) => u.id === unit.masterId);
      // "if the Master was within 2 panels" — checked against where the Master
      // stood, not where the Servant ended up. `unit` here is still the
      // pre-board snapshot, so `unit.panel` is exactly that.
      if (master && mayBringMaster(unit, master)) intents.push(I.move(master.id, [platform.panel], true));
    }
  }

  await applyWorldIntents(intents, "platform:board");
  return { ok, roll, target };
}

/**
 * Knock a unit off the edge.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.platformId
 * @param {boolean} args.passedAgility
 * @param {boolean} [args.servantRescued]
 * @returns {Promise<void>}
 */
export async function knockOff({ unitId, platformId, passedAgility = null, servantRescued = null }) {
  const board = currentBoard();
  const unit = board.units.find((u) => u.id === unitId);
  const platform = board.units.find((u) => u.id === platformId);
  if (!unit || !platform) return { ok: false, reason: "unknownUnitOrPlatform" };
  if (!canFallFrom(platform)) return { ok: false, reason: "edgeHolds" };

  // The Unit's own Agility Check, unless the caller already rolled one.
  const passed = passedAgility ?? await agilityCheckPasses(unit);

  // *"If a Master who is directly next to its Servant fails its Agility Check,
  // its Servant can perform an Agility Check too."* Its OWN Servant, one panel
  // away, and only ever for a Master.
  let rescued = servantRescued ?? false;
  if (!passed && servantRescued === null) {
    const rescuer = rescuerFor(unit, board);
    if (rescuer) rescued = await agilityCheckPasses(rescuer);
  }

  // The choice a passed check earns. Asked of the controlling player, because
  // dropping to the Board voluntarily may be the better move -- a garden full
  // of enemies is not a safe place to stay.
  let choice = "land";
  let landingPanel = null;
  if (passed && !rescued) {
    landingPanel = nearestFreePlatformPanel(unit, platform, board);
    choice = landingPanel ? await askWhereToGo(unit, platform) : "land";
  }

  const descriptors = fallOff(unit, platform, {
    passedAgility: passed, servantRescued: rescued, choice, landingPanel,
  });
  await applyWorldIntents(
    [
      ...(await toIntents(descriptors)),
      I.log({
        kind: "platformStep", step: "knockedOff", unitId, platformId,
        passed, rescued, choice: passed && !rescued ? choice : null,
      }),
    ],
    "platform:fall",
  );

  // The LEVEL change, which no intent can carry: `I.move` takes a path and a
  // forced flag and nothing else, so the `toLevel: 0` the fall descriptor has
  // always stated was dropped on the way to an intent. Without this a Unit
  // that fell moved horizontally and stayed at Platform elevation.
  const landed = descriptors.some((d) => d.kind === "move" && d.toLevel === 0);
  if (landed) await dropToGround(unitId);

  return { ok: true, passed, rescued, choice, landed };
}

/**
 * One Agility Check, rolled the way every other check in the system is.
 * @param {object} unit a unit projection
 * @returns {Promise<boolean>}
 */
async function agilityCheckPasses(unit) {
  const { checkPlan, resolveCheck } = await import("../rules/checks.mjs");
  // The same shape `engine/attack.mjs` uses for Penthesilea's shove: an AGILITY
  // Check has its own name in the plan vocabulary, so an Evade-specific bonus
  // cannot help somebody keep their footing.
  const plan = checkPlan(unit, "agility");
  const roll = (await new Roll("1d20").evaluate()).total;
  return resolveCheck({
    roll,
    // A NUMBER on the board: the projection flattens the pools it carries, and
    // reading `.value` off one gives `undefined` (Ch. 09).
    target: typeof unit.agility === "number" ? unit.agility : (unit.agility?.value ?? 0),
    table: plan.forceTable === "unfavourable" ? "unfavourable" : "favourable",
    modifiers: plan.modifiers,
  }).success;
}

/**
 * *"a choice of Moving to the nearest unoccupied panel other than the one it
 * was previously occupying, or landing on the Game Board panel directly under
 * it."*
 *
 * @param {object} unit
 * @param {object} platform
 * @returns {Promise<"stay"|"land">}
 */
async function askWhereToGo(unit, platform) {
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  const picked = await ChoiceDialog.pick({
    title: game.i18n.format("FGT.Platform.KnockedOffTitle", {
      name: game.actors.get(unit.id)?.name ?? unit.id,
    }),
    hint: game.i18n.localize("FGT.Platform.KnockedOffHint"),
    count: 1,
    min: 0,
    options: [
      {
        id: "stay",
        name: game.i18n.localize("FGT.Platform.KnockedOffStay"),
        detail: game.i18n.format("FGT.Platform.KnockedOffStayHint", {
          name: game.actors.get(platform.id)?.name ?? platform.id,
        }),
      },
      {
        id: "land",
        name: game.i18n.localize("FGT.Platform.KnockedOffLand"),
        detail: game.i18n.localize("FGT.Platform.KnockedOffLandHint"),
      },
    ],
  });
  // Declining the dialog keeps the Unit aboard, which is the safe direction:
  // a player who closed a window has not chosen to jump off a flying garden.
  return (picked ?? [])[0] === "land" ? "land" : "stay";
}

/**
 * Jump off a Platform, on purpose (#31).
 *
 * > *"A non-Civilian or non-Master Unit standing on an edge panel of a HGoB can
 * > Jump off the HGoB and land on a Game Board panel within its MOV; in this
 * > case, the Unit's MOV is reduced by 1."*
 * >
 * > *"If a Servant would Jump off the HGoB with its Master directly next to it,
 * > the Servant can choose to bring its Master with it, the Master will land
 * > next to its Servant in the same orientation. This does not count as Moving
 * > the Master."*
 *
 * Nothing like being Knocked Off: no Agility Check, no damage, and the Unit
 * chooses where it lands.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.platformId
 * @param {{i: number, j: number}|null} [args.destination] chosen, or asked for
 * @param {boolean|null} [args.bringMaster] chosen, or asked for
 * @returns {Promise<{ok: boolean, reason?: string, to?: object, broughtMaster?: string|null}>}
 */
export async function jumpOff({ unitId, platformId, destination = null, bringMaster = null }) {
  const board = currentBoard();
  const unit = board.units.find((u) => u.id === unitId);
  const platform = board.units.find((u) => u.id === platformId && u.kind === "platform");
  if (!unit || !platform) return { ok: false, reason: "unknownUnitOrPlatform" };

  // The planner's own answer, passed in rather than recomputed: `platforms.mjs`
  // used to do the arithmetic itself to avoid importing `movement.mjs`, and got
  // a different number for a Slowed Unit than the thing that would actually
  // move it.
  const remaining = remainingMovement(unit);

  const verdict = jumpVerdict(unit, platform, remaining);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const landings = jumpLandings(unit, platform, board, remaining);
  if (landings.length === 0) return { ok: false, reason: "nowhereToLand" };

  const to = destination ?? await askWhereToLand(unit, landings);
  if (!to) return { ok: false, reason: "cancelled" };
  if (!landings.some((p) => p.i === to.i && p.j === to.j)) {
    return { ok: false, reason: "illegalLanding" };
  }

  // *"with its Master directly next to it"* -- ONE panel, deliberately not the
  // two the boarding carry uses (#24). Its own Master, and only a Servant may
  // bring one.
  const master = unit.kind === "servant" && unit.masterId
    ? board.units.find((u) => u.id === unit.masterId && mayBringMaster(unit, u, 1)) ?? null
    : null;
  const carry = master ? (bringMaster ?? await askBringMaster(master)) : false;

  // *"the Unit's MOV is reduced by 1"* -- on top of the panels it travelled, so
  // the jump costs distance plus one.
  const travelled = Math.max(
    Math.abs(to.i - unit.panel.i), Math.abs(to.j - unit.panel.j),
  );
  const spent = (unit.turnState?.movedPanels ?? 0) + travelled + 1;

  const intents = [
    I.move(unitId, [to], true),
    I.markTurn(unitId, { movedPanels: spent }),
    I.log({ kind: "platformStep", step: "jumped", unitId, platformId, to, broughtMaster: carry ? master.id : null }),
  ];
  if (carry) {
    // *"the Master will land next to its Servant in the same orientation"* --
    // the offset it held before the jump, preserved.
    const offset = { i: master.panel.i - unit.panel.i, j: master.panel.j - unit.panel.j };
    // FORCED, and that is the whole of *"this does not count as Moving the
    // Master"*: a carried Unit has not moved, so it spends no budget of its own
    // and fires nothing that watches movement (Ch. 27).
    intents.push(I.move(master.id, [{ i: to.i + offset.i, j: to.j + offset.j }], true));
  }

  await applyWorldIntents(intents, "platform:jump");

  // The LEVEL change, which no move intent can carry -- the same gap the fall
  // has (#29).
  await dropToGround(unitId);
  if (carry) await dropToGround(master.id);

  return { ok: true, to, broughtMaster: carry ? master.id : null };
}

/**
 * Where to land, asked of the player.
 * @param {object} unit
 * @param {Array<{i: number, j: number}>} landings
 * @returns {Promise<{i: number, j: number}|null>}
 */
async function askWhereToLand(unit, landings) {
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  const picked = await ChoiceDialog.pick({
    title: game.i18n.localize("FGT.Action.Jump"),
    hint: game.i18n.localize("FGT.Platform.JumpHint"),
    count: 1,
    min: 0,
    options: landings.map((p) => ({
      id: `${p.i},${p.j}`,
      name: game.i18n.format("FGT.Platform.JumpPanel", { i: p.i, j: p.j }),
      detail: game.i18n.format("FGT.Platform.JumpDistance", {
        count: Math.max(Math.abs(p.i - unit.panel.i), Math.abs(p.j - unit.panel.j)),
      }),
    })),
  });
  const choice = (picked ?? [])[0];
  if (!choice) return null;
  const [i, j] = choice.split(",").map(Number);
  return { i, j };
}

/**
 * Whether to take the Master along.
 * @param {object} master
 * @returns {Promise<boolean>}
 */
async function askBringMaster(master) {
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  const picked = await ChoiceDialog.pick({
    title: game.i18n.localize("FGT.Platform.JumpCarryTitle"),
    hint: game.i18n.format("FGT.Platform.JumpCarryHint", {
      name: game.actors.get(master.id)?.name ?? master.id,
    }),
    count: 1,
    min: 0,
    options: [
      { id: "yes", name: game.i18n.localize("FGT.Platform.JumpCarryYes") },
      { id: "no", name: game.i18n.localize("FGT.Platform.JumpCarryNo") },
    ],
  });
  return (picked ?? [])[0] === "yes";
}

/**
 * Take the platform apart (Ch. 27).
 *
 * The order is the specification's and it matters: save, damage the failures,
 * scatter **everyone**, then remove the level. Surviving the fall is not the
 * same as staying in the air.
 *
 * @param {object} args
 * @param {string} args.platformId
 * @param {Record<string, boolean>} [args.saves] unitId → passed
 * @returns {Promise<void>}
 */
export async function destroyPlatform({ platformId, saves = {} }) {
  const board = currentBoard();
  const platform = board.units.find((u) => u.id === platformId);
  if (!platform) return;

  const descriptors = destructionSequence(platform, board, { saves });
  await applyWorldIntents(await toIntents(descriptors), "platform:destroyed");

  // Ch. 27 steps 4-8, which used to be logged by name. Ordered by the schema
  // rather than by preference: `TokenDocument#level` is required and
  // non-nullable and Foundry does not re-parent on delete, so scatter must
  // finish before the level goes.
  const doc = game.actors.get(platformId);
  if (doc) {
    const out = await teardown(doc);
    if (!out.ok) {
      console.error(`FGT | Could not tear down ${doc.name}: ${out.reason}`, out.stranded);
      ui.notifications?.error(game.i18n.format("FGT.Platform.TeardownFailed", { name: doc.name }));
    }
  }

  // "Cooldown: 7◈ Turns AFTER Quetzalcoatlus is defeated", and Drake's
  // "7◈+⅓◈ Turns after the Golden Hind is destroyed/deactivated": the clock
  // starts when the platform leaves the board, so a Servant whose platform is
  // killed early waits from that moment rather than from the cast, and one
  // that stands for twenty Turns has not been counting down for twenty.
  await setCooldownOnDestruction(platform);

  Hooks.callAll("fgtPlatformDestroyed", platform);
}

/**
 * Start the owning ability's cooldown, for an NP whose clock counts from its
 * platform being destroyed.
 *
 * The mirror of `engine/fields.mjs#setCooldownOnDeactivation`, and it exists
 * for the same reason that one does: a Noble Phantasm that stands until
 * something kills it has no "use" moment worth counting from.
 *
 * @param {object} platform the platform's snapshot
 * @returns {Promise<void>}
 */
async function setCooldownOnDestruction(platform) {
  const owner = platform?.ownerId ? game.actors.get(platform.ownerId) : null;
  if (!owner) return;

  // The ability whose `summonPlatform` phase named this platform's content id.
  const ability = owner.items?.find?.(
    (i) => (i.system?.phases ?? []).some(
      (p) => p.kind === "summonPlatform" && p.platformId === platform.contentId,
    ),
  );
  const cd = ability?.system?.cooldown ?? null;
  // BOTH triggers, because for a platform they are one event. Quetzalcoatl's
  // sheet says *"7◈ Turns AFTER Quetzalcoatlus is defeated"* and Drake's says
  // *"7◈+⅓◈ Turns after the Golden Hind is destroyed/deactivated"* -- one
  // phrase, because every route off the board (destruction, the owner's
  // at-will switch-off, an unaffordable toll, NP Seal) arrives at
  // `destroyPlatform`. Accepting only `destroyed` would have left the Hind's
  // cooldown never starting at all for three of those four routes.
  if (!cd || !["destroyed", "deactivation"].includes(cd.countFrom) || !cd.max) return;

  const ticks = resolveTicks(parseTick(String(cd.max)), {
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  });
  if (ticks <= 0) return;

  await applyWorldIntents(
    [I.cooldown(owner.id, ability.id, ticks, "set")],
    `platform:destructionCooldown:${platform.id}`,
  );
}

/**
 * Bring a platform onto the board (Ch. 27, create).
 *
 * The Scene Level comes first: boarding is a movement operation between levels,
 * so units cannot be placed aboard until there is a level to place them on.
 *
 * @param {object} args
 * @param {string} args.platformId
 * @param {string[]} [args.initialUnitIds]
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function activatePlatform({ platformId, initialUnitIds = [] }) {
  const platform = game.actors.get(platformId);
  if (!platform) return { ok: false, reason: "notFound" };

  const level = await createLevel(platform);
  if (!level) return { ok: false, reason: "noScene" };

  // THE PLATFORM'S OWN TOKEN FIRST. It was never assigned to the level it had
  // just been given: `activateHangingGardens` creates the token before calling
  // this, and nothing here moved it. So the Hanging Gardens — a flying garden —
  // sat at elevation 0 on the ground level, where it collided with every unit
  // on the board and counted every one of them as a passenger.
  //
  // Included here rather than fixed in `hgob.mjs` because it is true of every
  // platform: a platform belongs on its own level by definition, and no caller
  // should have to remember to say so.
  await moveToLevel([platform.id, ...initialUnitIds], platform);
  await sinkBeneathPassengers(platform);

  Hooks.callAll("fgtPlatformActivated", platform, level);
  return { ok: true };
}

/**
 * The `sort` value that puts a platform underneath everything on its level.
 *
 * Low enough that no ordinary token collides with it, and a constant rather
 * than `min(sort) - 1` so it does not drift downward every time a platform is
 * raised.
 */
const PLATFORM_SORT = -1000;

/**
 * Put a platform's token beneath the units standing on it.
 *
 * `PlaceablesLayer` sorts by `elevation → sort → zIndex → insertion order` and
 * PIXI picks the topmost, so a platform and its passengers — which share an
 * elevation by construction — were separated only by insertion order. The
 * platform is created first and its passengers board afterwards, so the
 * platform should already have lost that race; it did not, because the
 * PASSENGERS are pre-existing tokens and the platform's token is the new one.
 *
 * A platform is scenery you stand on. `sort` is the field Foundry provides for
 * saying so, and it is what `_onDropActorData` uses in the other direction
 * (`sort: getMaxSort() + 1`) to drop a new token on top.
 *
 * Measured live: a 9×9 Hanging Gardens at `sort: 0` swallowed every click
 * aimed at a passenger standing on it; at `sort: -1000` the passenger is
 * selected.
 *
 * @param {object} platform the platform actor
 * @returns {Promise<void>}
 */
async function sinkBeneathPassengers(platform) {
  const tokens = (canvas?.scene?.tokens?.contents ?? [])
    .filter((t) => t.actorId === platform.id && t.sort !== PLATFORM_SORT);
  if (tokens.length === 0) return;

  await canvas.scene.updateEmbeddedDocuments(
    "Token",
    tokens.map((t) => ({ _id: t.id, sort: PLATFORM_SORT })),
    { fgtForced: true },
  );
}

/**
 * Turn platform descriptors into intents.
 *
 * `scatter`, `removeLevel`, `removeOwnerEffects` and `dismissBoundSummons` are
 * still logged here, but they are no longer only logged: `teardown` in
 * `engine/scene-levels.mjs` performs each of them after this batch applies. The
 * log entry is the audit trail for a step that now actually happens.
 *
 * @param {object[]} descriptors
 * @returns {Promise<object[]>}
 */
async function toIntents(descriptors) {
  /** @type {object[]} */
  const out = [];
  for (const d of descriptors) {
    switch (d.kind) {
      case "move":
        out.push(I.move(d.unitId, [d.to], d.forced !== false));
        break;
      case "damage":
        out.push(d.formula
          ? I.damage(d.unitId, (await new Roll("10*2d6").evaluate()).total, null, { fixed: true, source: d.source })
          : I.damage(d.unitId, d.amount, null, { fixed: true, source: d.source }));
        break;
      case "overpower":
        out.push(I.log({ kind: "overpowerRequired", unitId: d.unitId, reason: d.reason }));
        break;
      default:
        out.push(I.log({ kind: "platformStep", step: d.kind, ...d }));
        break;
    }
  }
  return out;
}
