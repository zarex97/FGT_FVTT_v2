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

/* -------------------------------------------------------------------------- */
/*  The Dossier: what is sold, at what price, and what each Entry shows        */
/* -------------------------------------------------------------------------- */

/** The seven Stats, each 4 (reading 7; the user's 5.1). */
export const STAT_KEYS = Object.freeze(["str", "end", "agi", "mag", "luc", "mov", "range"]);

/**
 * Every single Entry's price. A Master's Command Spells left is its own.
 * @type {Readonly<Record<string, number>>}
 */
export const ENTRY_PRICES = Object.freeze({
  str: 4, end: 4, agi: 4, mag: 4, luc: 4, mov: 4, range: 4,
  region: 1, attributes: 1, alignment: 1, commandSpells: 4,
});

/**
 * The Sections and a draw's price, in the order a Dossier shows them
 * (readings 13, 21, 22, 28).
 * @type {ReadonlyArray<{key: string, price: number}>}
 */
export const SECTIONS = Object.freeze([
  { key: "spells", price: 8 },
  { key: "active", price: 8 },
  { key: "passive", price: 8 },
  { key: "classSkills", price: 6 },
  { key: "nps", price: 32 },
  { key: "items", price: 4 },
]);

/** @param {string} key @returns {number|null} */
export function sectionPrice(key) {
  return SECTIONS.find((s) => s.key === key)?.price ?? null;
}

/**
 * The Section an Item belongs to, or null for one never sold (a Command Spell
 * Item: its count is the `commandSpells` Entry). `isSpell` is decided by the one
 * reader, `rules/costs.mjs#isSpellAbility`, passed in.
 *
 * @param {object} item an Item, or its plain shape `{type, system}`
 * @param {(system: object) => boolean} isSpell
 * @returns {string|null}
 */
export function sectionOf(item, isSpell) {
  const sys = item?.system ?? {};
  if (item?.type === "equipment") return "items";
  if (item?.type === "noblePhantasm" || sys.isNP || sys.categorizedAsNP) return "nps";
  if (item?.type !== "ability" && item?.type !== "masterEssence") return null;
  if (sys.kind === "classSkill") return "classSkills";
  if (isSpell(sys)) return "spells";
  return sys.passive ? "passive" : "active";
}

/**
 * The single Entries a Unit's Dossier offers: the Stats it has, Region,
 * Attributes and Alignment for a Servant, Command Spells for a Master
 * (`PR.*`, `PR.master`). Class, Faction and kind are free (`PR.free`); the True
 * Name, Sustainability and NP charges are never offered (`PR.never`).
 *
 * @param {object} actor
 * @returns {string[]} entry keys
 */
export function entriesOf(actor) {
  const sys = actor?.system ?? {};
  const params = sys.parameters ?? {};
  const out = [];
  for (const key of ["str", "end", "agi", "mag", "luc"]) if (params[key]) out.push(key);
  if (typeof sys.mov === "number") out.push("mov");
  if (sys.range) out.push("range");
  if (actor?.type === "servant") out.push("region", "attributes", "alignment");
  if (actor?.type === "master") out.push("attributes", "commandSpells");
  return out;
}

/**
 * What one open Entry shows (the user's 5.1): a Stat's Rank, and the pool or
 * Base Attack it governs, live.
 *
 * @param {string} key
 * @param {object} actor
 * @param {{ranksOnly?: boolean}} [opts] Secret of Pedigree: the Rank, never the values (MO.values)
 * @returns {{rank?: string|null, value?: number|null, max?: number|null, text?: string|null, base?: number|null}}
 */
export function entryValue(key, actor, { ranksOnly = false } = {}) {
  const sys = actor?.system ?? {};
  const rank = (k) => sys.parameters?.[k] ?? null;
  const pool = (p) => (ranksOnly ? {} : { value: p?.value ?? null, max: p?.max ?? null });
  switch (key) {
    case "str": return { rank: rank("str"), base: sys.baseAttack?.str ?? null };
    case "mag": return { rank: rank("mag"), base: sys.baseAttack?.mag ?? null };
    case "end": return { rank: rank("end"), ...pool(sys.health) };
    case "agi": return { rank: rank("agi"), ...pool(sys.agility) };
    case "luc": return { rank: rank("luc"), ...pool(sys.luck) };
    case "mov": return { value: sys.mov ?? null };
    case "range": return { value: sys.range?.panels ?? null, max: sys.range?.targets ?? null };
    case "region": return { text: [...(sys.region ?? [])].join(", ") || "—" };
    case "attributes": return { text: [...(sys.attributes ?? [])].join(", ") || "—" };
    case "alignment": return { text: [sys.alignment?.order, sys.alignment?.morality].filter(Boolean).join(" ") || "—" };
    case "commandSpells": return { value: sys.commandSpells ?? null };
    default: throw new RangeError(`"${key}" is no Dossier Entry.`);
  }
}

/**
 * One random ability of a Section the Faction does not know yet, or null when
 * none is left (reading 22). `pick` takes the count and returns an index, so the
 * GM's die decides it.
 *
 * @param {string[]} pool content ids of the Section's abilities the Unit holds
 * @param {string[]} known content ids the Faction knows already
 * @param {(n: number) => number} pick
 * @returns {string|null}
 */
export function drawFrom(pool, known, pick) {
  const left = pool.filter((id) => !known.includes(id));
  if (left.length === 0) return null;
  const i = Math.min(left.length - 1, Math.max(0, Math.floor(pick(left.length))));
  return left[i];
}

/**
 * An ability as a bought Entry shows it: the words of the authoring
 * vocabulary, never its name, Rank or sheet text (reading 8). Plain data; the
 * window localizes it.
 *
 * @param {object} item the ability's Item
 * @param {object} deps
 * @param {(id: string) => string} deps.effectName an effect's name by id
 * @param {(system: object) => boolean} deps.isSpell
 * @returns {{section: string|null, passive: boolean, cooldown: string|null, target: string|null, lines: Array<{key: string, data?: object}>}}
 */
export function abilitySummary(item, { effectName, isSpell }) {
  const sys = item?.system ?? {};
  const lines = [];
  for (const phase of sys.phases ?? []) {
    if (phase?.kind === "applyEffects") {
      for (const e of phase.effects ?? []) {
        lines.push({ key: "FGT.Intel.Summary.Effect", data: {
          effect: effectName(e?.id ?? ""),
          magnitude: e?.magnitude != null ? `${e.magnitude}${typeof e.magnitude === "number" && e.magnitude <= 100 ? "%" : ""}` : "",
          duration: e?.duration ?? "",
        } });
      }
    } else if (phase?.kind) {
      lines.push({ key: `FGT.Authoring.Phase.${phase.kind}` });
    }
  }
  if (sys.damage) lines.unshift({ key: "FGT.Intel.Summary.Damage", data: { multiplier: sys.damage.multiplier ?? sys.damage.base ?? "" } });
  for (const rule of sys.passiveRules ?? []) {
    if (rule?.key) lines.push({ key: `FGT.Authoring.Element.${rule.key}` });
  }
  const sel = sys.targeting?.selection ?? null;
  const shape = sys.targeting?.shape ?? null;
  const target = sel
    ? [...(sel.relations ?? [])].join("/") + (shape?.kind && shape.kind !== "unit" ? ` · ${shape.kind}${shape.width ? ` ${shape.width}x${shape.height ?? shape.width}` : ""}` : "")
    : null;
  return {
    section: sectionOf(item, isSpell),
    passive: Boolean(sys.passive) || (sys.phases ?? []).length === 0,
    cooldown: typeof sys.cooldown === "string" ? sys.cooldown : (sys.cooldown?.max ?? null),
    target: target || null,
    lines,
  };
}
