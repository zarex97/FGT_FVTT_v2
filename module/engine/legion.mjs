/**
 * @file A Servant who is many Units: Hundred-Faced Hassan's hundred.
 * @see docs/32-relationships.md, docs/46-roster-re-audit.md §46.32
 *
 * Layer 3. `rules/linked-group.mjs` says how many may deploy, where, and how a
 * price in bodies splits; this writes it.
 *
 * > *"Hassan's Master has a total of 100 Hassans. Hassan is only defeated when
 * > all 100 Hassans are defeated."*
 *
 * The count is the Master's (`system.legions`, keyed by the legion's key) and
 * shows on the Master's page as the sheet asks: *"Hassans: 100/100"*. Each body
 * is a Servant actor of its own, named `Hassan N` in the order it is deployed
 * (#226 reading 27), linked to the others by `linkedGroup.memberIds` so the
 * shared clocks find each other (#226 reading 9). A body in reserve is not an
 * actor at all: it is the count minus the bodies standing on the field.
 *
 * Every body is built from the TEMPLATE the war's setup stored: the first body
 * as it was summoned, so a new body arrives full, with the war-setup roll as
 * its Agility and Luck and no Presence Concealment (#226 readings 5, 18, 23).
 */

import { record } from "./game-log.mjs";
import { currentBoard, currentMoment } from "./board.mjs";
import { worldIO } from "./io.mjs";
import { askOwner, chooseFor } from "./ask.mjs";
import {
  bodyName, deployable, deployPanels, legionPrice,
} from "../rules/linked-group.mjs";

/**
 * The pool a body belongs to, and the actor that holds it.
 *
 * @param {object|string|null} body an actor, or its id
 * @returns {{holder: object, key: string, pool: object}|null}
 */
export function poolOf(body) {
  const actor = typeof body === "string" ? game.actors.get(body) : body;
  const key = actor?.system?.legionKey || null;
  return key ? poolByKey(key) : null;
}

/**
 * @param {string} key
 * @returns {{holder: object, key: string, pool: object}|null}
 */
export function poolByKey(key) {
  for (const holder of game.actors ?? []) {
    const pool = holder.system?.legions?.[key];
    if (pool && typeof pool === "object") return { holder, key, pool };
  }
  return null;
}

/**
 * The bodies of a legion standing on the board, alive.
 *
 * @param {string} key
 * @returns {object[]} actors
 */
export function livingBodies(key) {
  const onBoard = new Set((canvas?.tokens?.placeables ?? []).map((t) => t.actor?.id).filter(Boolean));
  return (game.actors ?? []).filter((a) => a.system?.legionKey === key
    && !a.system?.defeated && onBoard.has(a.id));
}

/**
 * Write a pool, merged.
 *
 * @param {{holder: object, key: string}} found
 * @param {object} patch
 * @returns {Promise<void>}
 */
async function writePool(found, patch) {
  await found.holder.update({ [`system.legions.${found.key}`]: { ...found.pool, ...patch } });
  found.pool = { ...found.pool, ...patch };
}

/**
 * Cross-link the living bodies, each listing every other.
 *
 * The shared clocks (`engine/cooldown.mjs#twinsOf`) find each other by these
 * ids, and a fallen body must not hold a clock the hundred reads. A body still
 * in the setup's Home Base list (no token yet) is listed too: `extra`.
 *
 * @param {string} key
 * @param {object[]} [extra] bodies to count as living though not yet placed
 * @returns {Promise<void>}
 */
export async function syncMembers(key, extra = []) {
  const living = [...new Map([...livingBodies(key), ...extra].map((a) => [a.id, a])).values()];
  const ids = living.map((a) => a.id);
  for (const body of living) {
    const want = ids.filter((id) => id !== body.id).sort();
    const have = [...(body.system?.linkedGroup?.memberIds ?? [])].sort();
    if (want.join() !== have.join()) await body.update({ "system.linkedGroup.memberIds": want });
  }
}

/* -------------------------------------------------------------------------- */
/*  War setup                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Make the summoned Servant the first body of its legion, and bring the rest of
 * the opening count beside it.
 *
 * > *"At the start of the game, the Master can start with more than 1 Hassan in
 * > its Home Base."* 1 to 10, the Master's pick at war setup (#226 reading 3).
 *
 * Called by `engine/war-setup.mjs#commitWar` once the Servant is contracted.
 * Returns the bodies past the first, for `deployTokens` to place beside it in
 * the Home Base. A Servant with no legion returns `[]` and nothing is written.
 *
 * @param {object} servant the summoned actor
 * @param {object} master its Master
 * @param {number} [opening] how many bodies start in the Home Base
 * @returns {Promise<object[]>}
 */
export async function startLegion(servant, master, opening = 1) {
  const spec = servant.system?.linkedGroup?.legion;
  if (!spec || (spec.size ?? 0) <= 0 || !master) return [];
  const key = servant.id;
  const label = spec.label || servant.name;
  const count = Math.max(1, Math.min(Math.floor(opening) || 1, spec.openingMax ?? 1, spec.size));

  await servant.update({
    name: bodyName(label, 1),
    "prototypeToken.name": bodyName(label, 1),
    "system.legionKey": key,
    "system.legionNumber": 1,
  });
  // The template is the first body as summoned: full, unmarked, no clock.
  const template = servant.toObject();
  for (const k of ["_id", "_stats", "folder", "sort", "effects"]) delete template[k];
  template.effects = [];

  await master.update({
    [`system.legions.${key}`]: {
      size: spec.size, remaining: spec.size, nextNumber: 2, label,
      fieldCap: spec.fieldCap ?? null, template, clocks: null,
    },
  });
  const found = poolByKey(key);

  /** @type {object[]} */
  const bodies = [];
  for (let n = 1; n < count; n += 1) bodies.push(await createBody(found, servant));
  await syncMembers(key, [servant, ...bodies]);
  await record({
    kind: "setup",
    summary: `${master.name}'s ${label}s: ${count} in the Home Base, ${spec.size}/${spec.size}`,
    detail: { key, opening: count },
  });
  return bodies;
}

/**
 * One new body, numbered next, not yet on the board.
 *
 * @param {{holder: object, key: string, pool: object}} found
 * @param {object|null} like a living body, whose Contract, side and ownership it shares
 * @returns {Promise<object>} the actor
 */
async function createBody(found, like) {
  const number = found.pool.nextNumber ?? 1;
  const name = bodyName(found.pool.label, number);
  const data = structuredClone(found.pool.template ?? {});
  data.name = name;
  data.prototypeToken = { ...(data.prototypeToken ?? {}), name };
  data.system = {
    ...(data.system ?? {}),
    legionKey: found.key,
    legionNumber: number,
    factionId: like?.system?.factionId ?? data.system?.factionId ?? null,
    classContainer: like?.system?.classContainer ?? data.system?.classContainer ?? "",
    linkedGroup: { ...(data.system?.linkedGroup ?? {}), memberIds: [] },
  };
  data.items = (data.items ?? []).map((item) => ({
    ...item,
    system: {
      ...(item.system ?? {}),
      cooldown: { ...(item.system?.cooldown ?? {}), remaining: sharedClock(found, item, like) },
    },
  }));
  if (like?.ownership) data.ownership = { ...like.ownership };
  const [actor] = await Actor.createDocuments([data]);
  await writePool(found, { nextNumber: number + 1 });

  const masterId = like?.system?.masterId ?? null;
  if (masterId) await worldIO().setContract(actor.id, "contracted", masterId);
  return actor;
}

/**
 * What a new body's copy of a clock reads.
 *
 * One clock per name for the hundred (#226 reading 9): a new body's Zabaniya
 * is on the Cooldown the others' is on, or a fresh body would be a way round
 * it. Presence Concealment and Battle Retreat are each body's own, so a new
 * body's start at 0. With no body standing, the clock the last one left is read
 * back, less the Turns since (`clocks`).
 *
 * @param {{pool: object}} found
 * @param {object} item a template item's data
 * @param {object|null} like a living body
 * @returns {number}
 */
function sharedClock(found, item, like) {
  const own = found.pool.template?.system?.linkedGroup?.ownCooldowns ?? [];
  if (own.includes(item.system?.slug)) return 0;
  const living = like && !like.system?.defeated
    ? [...(like.items ?? [])].find((i) => i.name === item.name)
    : null;
  if (living) return living.system?.cooldown?.remaining ?? 0;
  const left = found.pool.clocks?.remaining?.[item.name] ?? 0;
  const since = (currentMoment().tick ?? 0) - (found.pool.clocks?.tick ?? 0);
  return Math.max(0, left - Math.max(0, since));
}

/* -------------------------------------------------------------------------- */
/*  A Round's deployment                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Offer every legion's Master the Round's deployment.
 *
 * > *"At the start of a Round, the Master can deploy additional Hassans ...
 * > There can only be a maximum of ten Hundred-Faced Hassans on the field."*
 *
 * From Round 2 (#226 reading 23), to free panels by war type (reading 4). The
 * Master's player picks the panels, one body each, and may stop at any number:
 * deploying is a "can". A body deployed now may act this Round (reading 4).
 *
 * @param {number} round
 * @returns {Promise<object[]>} the bodies deployed
 */
export async function offerLegionDeploys(round) {
  if ((round ?? 1) < 2 || !game.user?.isGM) return [];
  /** @type {object[]} */
  const out = [];
  for (const holder of [...(game.actors ?? [])]) {
    for (const key of Object.keys(holder.system?.legions ?? {})) {
      out.push(...await offerDeploy(key));
    }
  }
  return out;
}

/**
 * @param {string} key
 * @returns {Promise<object[]>}
 */
async function offerDeploy(key) {
  const found = poolByKey(key);
  if (!found || (found.pool.remaining ?? 0) <= 0) return [];
  const living = livingBodies(key);
  const legion = { remaining: found.pool.remaining, onField: living.length, fieldCap: found.pool.fieldCap ?? null };
  const room = deployable(legion);
  if (room <= 0) return [];

  const board = currentBoard();
  const factionId = found.holder.system?.factionId ?? living[0]?.system?.factionId ?? null;
  const panels = deployPanels(board, factionId);
  if (panels.length === 0) return [];

  const first = found.pool.nextNumber ?? 1;
  const labels = Array.from({ length: Math.min(room, panels.length) },
    (_, n) => bodyName(found.pool.label, first + n));
  const answer = await askOwner(found.holder, {
    kind: "pickPanels",
    panels,
    labels,
    hint: game.i18n.format("FGT.Legion.DeployHint", {
      label: found.pool.label, room, remaining: found.pool.remaining, size: found.pool.size,
    }),
  });
  const key2 = (p) => `${p.i},${p.j}`;
  const offered = new Set(panels.map(key2));
  const picked = [];
  for (const p of answer?.panels ?? []) {
    if (picked.length >= labels.length || !offered.has(key2(p))) continue;
    offered.delete(key2(p));
    picked.push(p);
  }
  return deployBodies(key, picked);
}

/**
 * Deploy one new body on each panel.
 *
 * @param {string} key
 * @param {Array<{i: number, j: number}>} panels
 * @returns {Promise<object[]>}
 */
export async function deployBodies(key, panels) {
  const found = poolByKey(key);
  if (!found || panels.length === 0) return [];
  const scene = canvas?.scene ?? game.scenes?.active ?? null;
  if (!scene) return [];
  const like = livingBodies(key)[0] ?? templateBody(found);

  /** @type {object[]} */
  const created = [];
  for (const panel of panels) {
    const body = await createBody(found, like);
    const size = scene.grid.size;
    const token = await body.getTokenDocument({ x: panel.j * size, y: panel.i * size });
    await scene.createEmbeddedDocuments("Token", [token.toObject()]);
    created.push(body);
  }
  await syncMembers(key);
  await announce(found, game.i18n.format("FGT.Legion.Deployed", {
    names: created.map((a) => a.name).join(", "),
    label: found.pool.label, remaining: found.pool.remaining, size: found.pool.size,
  }));
  return created;
}

/**
 * Any body of the legion, alive or fallen: the one whose Contract and side a
 * new body takes when none stands on the field (#226 reading 22).
 *
 * @param {{key: string}} found
 * @returns {object|null}
 */
function templateBody(found) {
  const bodies = (game.actors ?? []).filter((a) => a.system?.legionKey === found.key);
  return bodies.find((a) => !a.system?.defeated) ?? bodies[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  A body falls, or is spent                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Would this defeat leave the hundred standing?
 *
 * Read BEFORE the defeat is written, by `io.defeat`: a body that falls while
 * others remain is not the Servant's defeat, so it does not count towards the
 * Grail (#226 reading 1).
 *
 * @param {object} actor
 * @returns {boolean}
 */
export function survivesBody(actor) {
  const found = poolOf(actor);
  return Boolean(found) && (found.pool.remaining ?? 0) > 1;
}

/**
 * Take a fallen body off the count and off the board.
 *
 * > *"Hassan is only defeated when all 100 Hassans are defeated."*
 *
 * Called by `io.defeat` after the defeat stands, so Guts and every other
 * revival have had their say: a body that stays down is -1, and one that came
 * back never reached here (#226 reading 21). The body's token goes; the actor
 * stays, defeated, for the record.
 *
 * @param {object} actor
 * @returns {Promise<{remaining: number}|null>}
 */
export async function bodyFell(actor) {
  const found = poolOf(actor);
  if (!found) return null;
  const remaining = Math.max(0, (found.pool.remaining ?? 0) - 1);
  await holdClocks(found, actor);
  await writePool(found, { remaining });
  await worldIO().clearBody(actor.id);
  await syncMembers(found.key);
  await announce(found, game.i18n.format("FGT.Legion.Fell", {
    name: actor.name, label: found.pool.label, remaining, size: found.pool.size,
  }));
  return { remaining };
}

/**
 * Keep the hundred's shared clocks while no body stands to hold them.
 *
 * @param {{holder: object, key: string, pool: object}} found
 * @param {object} leaving the body about to leave the field
 * @returns {Promise<void>}
 */
async function holdClocks(found, leaving) {
  const others = livingBodies(found.key).filter((a) => a.id !== leaving.id);
  if (others.length > 0) return;
  const remaining = Object.fromEntries([...(leaving.items ?? [])]
    .map((i) => [i.name, i.system?.cooldown?.remaining ?? 0]));
  await writePool(found, { clocks: { tick: currentMoment().tick ?? 0, remaining } });
}

/**
 * Pay a price in bodies.
 *
 * > *"Then, reduce the number of Hassans by 4d6."*
 *
 * From the reserve first, then field bodies the player picks; those are
 * REMOVED, not defeated: no Guts, no *"when defeated"* Clause (#226 reading
 * 19). A count of 0 defeats Hassan through the ordinary defeat chain (reading
 * 20): every other body is removed and the user, or the last one standing,
 * falls.
 *
 * @param {object} user the body that paid it
 * @param {string} formula the dice
 * @param {string} source what is being paid for, for the card
 * @returns {Promise<{roll: number, fromReserve: number, fromField: number, remaining: number}|null>}
 */
export async function payLegionPrice(user, formula, source) {
  const found = poolOf(user);
  if (!found) return null;
  const roll = await new Roll(formula).evaluate();
  const living = livingBodies(found.key);
  const legion = { remaining: found.pool.remaining ?? 0, onField: living.length };
  const price = legionPrice(legion, roll.total);

  /** @type {object[]} */
  let removed = [];
  if (price.remainingAfter > 0 && price.fromField > 0) {
    const picked = await chooseFor(user, {
      title: source,
      hint: game.i18n.format("FGT.Legion.PickRemoved", { count: price.fromField, label: found.pool.label }),
      count: price.fromField,
      min: price.fromField,
      options: living.map((a) => ({ id: a.id, name: a.name })),
    });
    const chosen = new Set((picked ?? []).filter((id) => living.some((a) => a.id === id)));
    // A closed window does not refuse the price: the highest numbers go first.
    for (const a of [...living].sort((x, y) => (y.system?.legionNumber ?? 0) - (x.system?.legionNumber ?? 0))) {
      if (chosen.size >= price.fromField) break;
      chosen.add(a.id);
    }
    removed = living.filter((a) => chosen.has(a.id));
  } else if (price.remainingAfter <= 0) {
    // The last: every body but the one that falls is removed.
    const last = living.find((a) => a.id === user.id) ?? living[0] ?? user;
    removed = living.filter((a) => a.id !== last.id);
  }

  for (const body of removed) await removeBody(found, body);
  const remaining = price.remainingAfter > 0 ? price.remainingAfter : 1;
  await writePool(found, { remaining });
  await syncMembers(found.key);
  await announce(found, game.i18n.format("FGT.Legion.Paid", {
    source, formula, roll: roll.total, reserve: price.fromReserve, field: removed.length,
    label: found.pool.label, remaining: price.remainingAfter, size: found.pool.size,
  }), [roll]);

  if (price.remainingAfter <= 0) {
    const last = living.find((a) => a.id === user.id && !removed.includes(a)) ?? living.find((a) => !removed.includes(a)) ?? user;
    await worldIO().defeat(last.id, "legionSpent");
  }
  return { roll: roll.total, fromReserve: price.fromReserve, fromField: removed.length, remaining: price.remainingAfter };
}

/**
 * Take a body off the board without a defeat.
 *
 * @param {{holder: object, key: string, pool: object}} found
 * @param {object} body
 * @returns {Promise<void>}
 */
async function removeBody(found, body) {
  await holdClocks(found, body);
  await worldIO().clearBody(body.id);
  await worldIO().log([{ kind: "legionRemoved", unitId: body.id, name: body.name }]);
  const masterId = body.system?.masterId ?? null;
  const master = masterId ? game.actors.get(masterId) : null;
  if (master) {
    await master.update({ "system.servantIds": [...(master.system.servantIds ?? [])].filter((id) => id !== body.id) });
  }
  await body.delete();
}

/**
 * A public line about the count, under the Master's name.
 *
 * @param {{holder: object}} found
 * @param {string} text
 * @param {object[]} [rolls]
 * @returns {Promise<void>}
 */
async function announce(found, text, rolls = []) {
  await ChatMessage.create({
    content: `<p>${foundry.utils.escapeHTML(text)}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: found.holder }),
    ...(rolls.length > 0 ? { rolls } : {}),
  });
}

/**
 * End the whole hundred at once: every other body removed, the reserve gone,
 * and the given body left as the last, for its defeat to be the Servant's.
 *
 * Sustainability acts on the hundred, not on one body (#226 reading 17).
 *
 * @param {object} last
 * @returns {Promise<void>}
 */
export async function exhaustLegion(last) {
  const found = poolOf(last);
  if (!found) return;
  for (const body of livingBodies(found.key)) {
    if (body.id !== last.id) await removeBody(found, body);
  }
  await writePool(found, { remaining: 1 });
}
