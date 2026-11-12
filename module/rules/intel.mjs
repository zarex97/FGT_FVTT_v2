/**
 * @file The Information System's rules: who witnesses an act, what it pays, and the per-Turn ledger.
 * @see docs/superpowers/specs/2026-11-12-information-system.md, docs/adr/0008-knowledge-belongs-to-the-faction.md
 *
 * Layer 2 (rules). Pure.
 *
 * Every Unit's page starts hidden from every other Faction, and a Faction earns
 * **Intel** on a Unit by **witnessing** it act (readings 2-5, ruled 2026-11-12).
 * Which Factions witness an act and what each earns is decided here, from the
 * board; `engine/intel.mjs` writes the result into each Faction's Notebook.
 */

import { sees } from "./identity.mjs";
import { isConcealed } from "./concealment.mjs";

/**
 * What one act is worth, before the ×2 for an involved Witness (readings 4, 5).
 * @type {Readonly<Record<string, number>>}
 */
export const INTEL_VALUES = Object.freeze({
  move: 1,
  attack: 2,
  evade: 1,
  block: 1,
  counter: 2,
  skill: 2,
  np: 8,
  commandSpell: 2,
});

/** Acts that count once per Unit per Turn: a second adds nothing (reading 4). */
export const ONCE_PER_TURN = Object.freeze(["move", "attack"]);

/** The Unit kinds that hold a Dossier and earn Intel for others (reading 2). */
export const DOSSIER_KINDS = Object.freeze(["servant", "master"]);

/**
 * The Faction that owns a Unit's knowledge: its owner's side, never the side a
 * Charm hands it to (`sideOf` reads that one), since what a Faction knows is the
 * Faction's (ADR-0008).
 *
 * @param {object} unit
 * @returns {string|null}
 */
export function factionOf(unit) {
  return unit?.faction ?? unit?.factionId ?? null;
}

/**
 * What each Faction earns on one act: the highest any single Witness of it
 * earns, ×2 when that Witness is involved, never the sum over Witnesses
 * (readings 3, 4).
 *
 * A Faction witnesses when one of its Units `sees` the actor (at any of
 * `panels`, the Move's start and end, reading 29) or is involved (targeted,
 * caught, countering), whatever the range. An act made while concealed is
 * witnessed by nobody. The actor's own Faction earns nothing on it.
 *
 * @param {object} args
 * @param {object} args.actor the acting board Unit
 * @param {object} args.board
 * @param {string} args.kind a key of {@link INTEL_VALUES}
 * @param {string[]} [args.involvedIds] Units involved in the act
 * @param {Array<{i: number, j: number, k?: number}>|null} [args.panels] where to read sight from; the actor's panel by default
 * @returns {Map<string, number>} factionId → Intel earned
 */
export function witnessesOf({ actor, board, kind, involvedIds = [], panels = null }) {
  const out = new Map();
  const base = INTEL_VALUES[kind];
  if (!base || !actor || !DOSSIER_KINDS.includes(actor.kind)) return out;
  if (isConcealed(actor)) return out;
  const own = factionOf(actor);
  const involved = new Set(involvedIds);
  const places = (panels ?? [actor.panel]).filter(Boolean);
  for (const u of board?.units ?? []) {
    if (u.id === actor.id || u.defeated || !u.panel) continue;
    const faction = factionOf(u);
    if (!faction || faction === own) continue;
    const isInvolved = involved.has(u.id);
    const saw = isInvolved || places.some((panel) => sees(u, { ...actor, panel }, board));
    if (!saw) continue;
    const value = base * (isInvolved ? 2 : 1);
    if (value > (out.get(faction) ?? 0)) out.set(faction, value);
  }
  return out;
}

/**
 * A Faction's ledger for one Turn: what each Unit's once-per-Turn acts have paid
 * it, and what it gained, for the card at the Turn's end (reading 30).
 *
 * @typedef {object} IntelLedger
 * @property {number|null} tick the Turn it records
 * @property {Record<string, number>} earned `${unitId}|${kind}` → the highest paid this Turn
 * @property {Record<string, number>} gains unitId → Intel gained this Turn
 */

/** @returns {IntelLedger} */
export function emptyLedger(tick = null) {
  return { tick, earned: {}, gains: {} };
}

/**
 * Pay one act into a Faction's ledger. A once-per-Turn act pays only what it
 * earns above what that act has already paid this Turn: an area Attack's second
 * Process involving the same Faction raises a 2 to a 4 and pays 2, never 4 more
 * (reading 4).
 *
 * @param {IntelLedger|null} ledger
 * @param {{tick: number, unitId: string, kind: string, value: number}} act
 * @returns {{ledger: IntelLedger, paid: number}}
 */
export function payAct(ledger, { tick, unitId, kind, value }) {
  const current = ledger && ledger.tick === tick
    ? { tick, earned: { ...ledger.earned }, gains: { ...ledger.gains } }
    : emptyLedger(tick);
  let paid = value;
  if (ONCE_PER_TURN.includes(kind)) {
    const key = `${unitId}|${kind}`;
    const before = current.earned[key] ?? 0;
    paid = Math.max(0, value - before);
    current.earned[key] = Math.max(before, value);
  }
  if (paid > 0) current.gains[unitId] = (current.gains[unitId] ?? 0) + paid;
  return { ledger: current, paid };
}
