/**
 * @file The linked unit group — two tokens that are one Servant.
 * @see docs/32-relationships.md, docs/45-case-studies.md
 *
 * Layer 2 (rules). **Pure.**
 *
 * Every question here is PAIRWISE, which is why it is a board pass rather than
 * a per-unit derivation — the same shape of problem as ZON and auras, and it
 * gets the same answer: settle it once in `snapshotBoard`, after every unit is
 * projected, and let the readers ask a plain field.
 *
 * Ch. 32 D16.7 is emphatic that this is **a general mechanism, not a Dioscuri
 * special case**: the shape recurs for a Servant with a permanent summon, and
 * for a Master-Servant pair moving under Passenger Seat. Nothing in this file
 * names a twin.
 */

import * as geo from "../domain/geometry.mjs";

/**
 * The other live members of this unit's group that are on the board.
 *
 * A member with no panel is not on the board and cannot constrain anybody. That
 * matters more than it looks: a leash that refused every panel because the
 * partner has not been placed yet would freeze the survivor solid.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {object[]}
 */
export function partnersOf(unit, board) {
  // Spread, for the reason `test/unit/set-fields.test.mjs` enforces: a
  // document-shaped unit carries a SetField here, and `.includes` on one
  // returns undefined rather than failing.
  const ids = [...(unit?.linkedGroup?.memberIds ?? [])];
  if (ids.length === 0) return [];
  return (board?.units ?? []).filter((u) => ids.includes(u.id) && u.panel);
}

/**
 * Chebyshev distance to the nearest partner, or `null` when there is none.
 *
 * `null` rather than `Infinity`, so the predicate ladder in `rules/options.mjs`
 * emits nothing at all and `self:withinOfPartner:N` is false for every N —
 * which is the right answer for a twin standing alone, and makes its negation
 * true, which is also right.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {number|null}
 */
export function partnerDistance(unit, board) {
  const partners = partnersOf(unit, board);
  if (partners.length === 0 || !unit?.panel) return null;
  return Math.min(...partners.map((p) => geo.chebyshev(unit.panel, p.panel)));
}

/**
 * Is this unit further from a partner than the leash allows?
 *
 * Only ever true after a FORCED displacement: voluntary movement cannot reach
 * such a panel, because `rules/movement.mjs#canStopOn` refuses it. Ch. 45
 * takes the DECISION that a knockback may break the leash — dragging the
 * partner along would produce a knockback that pulls a unit *toward* its
 * attacker, which is absurd.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function leashBroken(unit, board) {
  const leash = unit?.linkedGroup?.leash;
  if (leash === null || leash === undefined) return false;
  const d = partnerDistance(unit, board);
  return d !== null && d > leash;
}

/**
 * What this unit counts as wherever the rules count Units.
 *
 * *"each one counts as 0.5 Units"* scopes to every such rule and qualifies
 * none of them: the four turn-budget pools, the multi-Servant tax (Ch. 32) and
 * the roster allowance all read this.
 *
 * @param {object} unit
 * @returns {number}
 */
export function unitWeight(unit) {
  return unit?.linkedGroup?.unitWeight ?? 1;
}

/**
 * Annotate every grouped unit with its partner facts.
 *
 * Runs in `snapshotBoard` beside `annotateZon` — and **before** it, because
 * `zonSatisfaction: "any"` is delivered by unioning the group into
 * `zonPartnerIds`, which is the field `rules/zon.mjs` already reads. Deriving
 * it here rather than changing that reader is what keeps the ZON clause free:
 * that comment has quoted *"as long as the other counterpart is within their
 * Master's ZON"* since it was written, and the rule was right and unwritable.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {object[]} the same units, annotated
 */
export function annotateLinkedGroups(units, board) {
  for (const unit of units ?? []) {
    if (!unit?.linkedGroup?.id) continue;

    const partners = partnersOf(unit, board);
    unit.partnerIds = partners.map((p) => p.id);
    unit.partnerDistance = partnerDistance(unit, board);
    unit.leashBroken = leashBroken(unit, board);

    if (unit.linkedGroup.zonSatisfaction === "any") {
      // The DECLARED members, not only the ones currently on the board: ZON is
      // asked about a Servant that may be anywhere, and `zonStatus` does its
      // own board lookup and skips what it cannot find.
      unit.zonPartnerIds = [
        ...new Set([...(unit.zonPartnerIds ?? []), ...(unit.linkedGroup.memberIds ?? [])]),
      ];
    }
  }
  return units;
}

/* -------------------------------------------------------------------------- */
/*  A legion: one Servant who is many Units                                    */
/* -------------------------------------------------------------------------- */

/**
 * Finish each legion body's `legion` from its pool and the board.
 *
 * Hundred-Faced Hassan: *"Hassan's Master has a total of 100 Hassans. Hassan is
 * only defeated when all 100 Hassans are defeated."* The pool is the Master's
 * (`engine/legion.mjs`), and "remaining" counts every living Hassan, on the
 * field and off (#226 reading 2). What stands HERE is a board fact, so it is
 * settled here: a body with no panel is not on the field.
 *
 * `pools` is keyed by legion key: `{size, remaining, nextNumber, label, fieldCap}`.
 * A body whose pool is missing reads as a legion of itself, so a gate on the
 * count refuses rather than passing on an unknown number.
 *
 * @param {object[]} units
 * @param {Record<string, object>} pools
 * @returns {object[]} the same units, annotated
 */
export function annotateLegions(units, pools = {}) {
  /** @type {Map<string, object[]>} */
  const onField = new Map();
  for (const unit of units ?? []) {
    if (!unit?.legionKey || !unit.panel || unit.defeated) continue;
    onField.set(unit.legionKey, [...(onField.get(unit.legionKey) ?? []), unit]);
  }
  for (const unit of units ?? []) {
    if (!unit?.legionKey) continue;
    const pool = pools?.[unit.legionKey] ?? null;
    const here = onField.get(unit.legionKey) ?? [];
    const remaining = pool?.remaining ?? 0;
    unit.legion = {
      key: unit.legionKey,
      number: unit.legionNumber ?? null,
      size: pool?.size ?? unit.linkedGroup?.legion?.size ?? 0,
      remaining,
      fieldCap: pool?.fieldCap ?? unit.linkedGroup?.legion?.fieldCap ?? null,
      onField: here.length,
      // Off the board and alive: what a Round's start may deploy, and what a
      // Noble Phantasm's price takes first (#226 reading 19).
      reserve: Math.max(0, remaining - here.length),
      bodyIds: here.map((u) => u.id),
    };
  }
  return units;
}

/**
 * How many bodies may still be deployed onto the field now.
 *
 * *"There can only be a maximum of ten Hundred-Faced Hassans on the field."*
 *
 * @param {{remaining: number, onField: number, fieldCap: number|null}} legion
 * @returns {number}
 */
export function deployable(legion) {
  if (!legion) return 0;
  const reserve = Math.max(0, (legion.remaining ?? 0) - (legion.onField ?? 0));
  const room = legion.fieldCap === null || legion.fieldCap === undefined
    ? Infinity
    : Math.max(0, legion.fieldCap - (legion.onField ?? 0));
  return Math.min(reserve, room);
}

/**
 * Split a price in bodies between the reserve and the field.
 *
 * *"Then, reduce the number of Hassans by 4d6."* From the reserve first, then
 * field bodies the player picks; they are removed, not defeated (#226
 * reading 19). `fromField` is how many field bodies the player must name.
 *
 * @param {{remaining: number, onField: number}} legion
 * @param {number} price
 * @returns {{fromReserve: number, fromField: number, remainingAfter: number}}
 */
export function legionPrice(legion, price) {
  const remaining = legion?.remaining ?? 0;
  const reserve = Math.max(0, remaining - (legion?.onField ?? 0));
  const paid = Math.min(Math.max(0, price), remaining);
  const fromReserve = Math.min(reserve, paid);
  return { fromReserve, fromField: paid - fromReserve, remainingAfter: remaining - paid };
}

/**
 * The name of a legion's body. *"Each Hassan will be coded with a number (e.g.
 * Hassan 1, Hassan 16, Hassan 47) in ascending order when they are deployed."*
 *
 * @param {string} label
 * @param {number} number
 * @returns {string}
 */
export function bodyName(label, number) {
  return `${label || "Body"} ${number}`;
}

/**
 * The free panels a legion's Master may deploy a body onto at a Round's start.
 *
 * > *"At the start of a Round, the Master can deploy additional Hassans onto
 * > its half of the field (or within a 2 panel area from the border of its
 * > Home Base)."*
 *
 * By war type (#226 reading 4): a Great Holy Grail War deploys onto the
 * Master's half, every other war within 2 panels of its Home Base's border, the
 * base included. Free panels only (#226 reading 23): a panel any Unit stands on
 * is not offered.
 *
 * The half is the side of the board's centre line that holds the faction's
 * Home Base, measured along the line between its base and the board's centre,
 * so a base along any edge reads the same way. The centre line itself belongs
 * to both halves.
 *
 * @param {object} board
 * @param {string} factionId
 * @returns {Array<{i: number, j: number}>}
 */
export function deployPanels(board, factionId) {
  const bounds = board?.bounds ?? { iMin: 0, jMin: 0, iMax: 12, jMax: 12 };
  const base = Object.values(board?.zones ?? {})
    .filter((z) => z?.faction === factionId)
    .flatMap((z) => z.panels ?? []);
  if (base.length === 0) return [];

  const taken = new Set((board?.units ?? [])
    .filter((u) => !u.defeated && !u.sharesPanel)
    .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : []))
    .filter((p) => (p.k ?? 0) === 0)
    .map((p) => `${p.i},${p.j}`));

  /** @type {Array<{i: number, j: number}>} */
  const all = [];
  for (let i = bounds.iMin; i <= bounds.iMax; i += 1) {
    for (let j = bounds.jMin; j <= bounds.jMax; j += 1) all.push({ i, j });
  }

  let offered;
  if ((board?.warType ?? "greatHolyGrailWar") === "greatHolyGrailWar") {
    const centreOf = (panels) => ({
      i: panels.reduce((n, p) => n + p.i, 0) / panels.length,
      j: panels.reduce((n, p) => n + p.j, 0) / panels.length,
    });
    const centre = centreOf(base);
    // The line between his base and the nearest enemy base, not the scene's
    // centre: a war's board may sit inside a larger scene (#226, live, a
    // 13x13 war on a 21x21 scene split its halves diagonally).
    const enemies = Object.values(board?.zones ?? {})
      .filter((z) => z?.faction && z.faction !== factionId && (z.panels ?? []).length > 0)
      .map((z) => centreOf(z.panels));
    const enemy = enemies.sort((a, b) => Math.hypot(a.i - centre.i, a.j - centre.j)
      - Math.hypot(b.i - centre.i, b.j - centre.j))[0]
      ?? { i: (bounds.iMin + bounds.iMax) - centre.i, j: (bounds.jMin + bounds.jMax) - centre.j };
    const mid = { i: (centre.i + enemy.i) / 2, j: (centre.j + enemy.j) / 2 };
    const toBase = { i: centre.i - mid.i, j: centre.j - mid.j };
    offered = all.filter((p) => (p.i - mid.i) * toBase.i + (p.j - mid.j) * toBase.j >= 0);
  } else {
    offered = all.filter((p) => base.some((b) => geo.chebyshev(b, p) <= 2));
  }
  return offered.filter((p) => !taken.has(`${p.i},${p.j}`));
}
