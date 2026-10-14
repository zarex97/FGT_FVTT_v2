/**
 * @file Granting copies — the write half of Wisdom of Dún Scáith.
 * @see docs/17-abilities.md, docs/35-sheets-and-editor.md
 *
 * Layer 3. `rules/copy.mjs` decides what may be copied and what a copy is;
 * this offers the list and creates the documents.
 *
 * The two-slot limit lives here rather than in the rules layer because it is a
 * property of *this grant* — "she can then select two of them" — and a future
 * copy effect with a different allowance should not have to fight a hard-coded
 * two.
 */

import { canCopy, copyCandidates, copyAbility } from "../rules/copy.mjs";
import { currentBoard, unitFrom } from "./board.mjs";

/**
 * Wisdom of Dún Scáith's own rank and cooldown, which every copy takes.
 *
 * The minus is an **ASCII hyphen**. It was a U+2212 MINUS SIGN, which
 * `parseTick` does not accept -- so every copy this grant has ever made threw
 * on its cooldown, was caught, and came back reading zero. A copied Skill was
 * reusable every Turn forever.
 */
const DUN_SCAITH = Object.freeze({ rank: "A+", cooldown: "4◈-⅓◈", exclusionSet: "wisdomOfDunScaith" });

/**
 * What this unit could copy right now.
 *
 * @param {object} args
 * @param {string} args.copierId
 * @param {string[]} [args.prefer] grades to mark preferred; Ch. 17 says B and A
 * @returns {Array<object>}
 */
export function offerCopies({ copierId, prefer = ["A", "B"] }) {
  const board = currentBoard();
  const copierDoc = game.actors.get(copierId);
  const copier = unitFrom(board, copierDoc);
  if (!copier) return [];

  // The snapshot's units carry ability *snapshots*; the candidate list is what
  // the GM dialog renders, so it carries the whole ability rather than an id.
  const all = copyCandidates(board, copier, { prefer });
  // Only the Servants on the field when the pick fell due: "Servants summoned
  // later are never added", a GM's redo included (#204 reading 8). No pool is
  // a pick that never fell due -- a hand-built Servant -- and offers the field.
  const pool = copierDoc?.system?.copyPick?.poolIds ?? [];
  return pool.length > 0 ? all.filter((c) => pool.includes(c.unitId)) : all;
}

/**
 * The ability on this actor that opens the copy dialog: Wisdom of Dún Scáith.
 *
 * @param {object|null} actor
 * @returns {object|null}
 */
export function copyGrantOf(actor) {
  return [...(actor?.items ?? [])].find((i) => i.system?.opensDialog === "copy") ?? null;
}

/**
 * The name a grant's copies record as `grantedBy`, as the sheet passes it.
 *
 * @param {object} grant
 * @returns {string}
 */
function grantName(grant) {
  return grant.system?.contentId || grant.id;
}

/**
 * Mark every copier on the board whose pick is owed, and open the GM's list.
 *
 * *"If it is a war that is starting, it should once before the 1st turn ends.
 * If not, it should be after summoning"* (#204 reading 8). Called once when
 * the war is built, and for a Servant whose token enters a war already under
 * way. The pool is the OTHER Servants on the field now; the pick is due until
 * the player makes it, and no Turn ends while it is
 * (`rules/budget.mjs#copyPicksOwed`).
 *
 * A copier that already holds its copies, or already owes a pick, is left
 * alone: a redo is the GM's, from the sheet.
 *
 * @param {{actorIds?: string[]|null, open?: boolean}} [options]
 * @returns {Promise<Array<{copierId: string, grantedBy: string}>>}
 */
export async function markCopyPicksDue({ actorIds = null, open = true } = {}) {
  if (!game.user?.isGM) return [];
  const board = currentBoard();
  const servants = (board.units ?? []).filter((u) => u.kind === "servant");
  /** @type {Array<{copierId: string, grantedBy: string}>} */
  const due = [];
  for (const unit of board.units ?? []) {
    if (actorIds && !actorIds.includes(unit.id)) continue;
    const actor = game.actors.get(unit.id);
    const grant = copyGrantOf(actor);
    if (!grant || actor.system?.copyPick?.due) continue;
    if (actor.items.some((i) => i.system?.grantedBy === grantName(grant))) continue;
    const poolIds = servants.filter((s) => s.id !== unit.id).map((s) => s.id);
    await actor.update({ "system.copyPick": { due: true, poolIds } });
    due.push({ copierId: actor.id, grantedBy: grantName(grant) });
  }
  if (open && due.length > 0) {
    const { CopyDialog } = await import("../apps/copy-dialog.mjs");
    for (const d of due) CopyDialog.open(d);
  }
  return due;
}

/**
 * A copier whose token enters a war already under way owes its pick then.
 *
 * GM only, and only once the war has started: the war's own build marks every
 * copier itself, after the whole field is deployed (`engine/war-setup.mjs`).
 */
export function attachCopyPick() {
  // A pick still owed when the GM's client loads -- a reload closed the list
  // the war's start opened -- opens again, or nothing would ask for it.
  if (game.user?.isGM) {
    const owed = [...(game.actors ?? [])].filter((a) => a.system?.copyPick?.due && copyGrantOf(a));
    if (owed.length > 0) {
      import("../apps/copy-dialog.mjs").then(({ CopyDialog }) => {
        for (const a of owed) CopyDialog.open({ copierId: a.id, grantedBy: grantName(copyGrantOf(a)) });
      }).catch((err) => console.error("FGT | Copy pick:", err));
    }
  }
  Hooks.on("createToken", (token) => {
    if (!game.user?.isGM || !game.combats?.active?.started) return;
    const actorId = token.actorId ?? token.actor?.id ?? null;
    if (!copyGrantOf(game.actors.get(actorId))) return;
    markCopyPicksDue({ actorIds: [actorId] }).catch((err) => console.error("FGT | Copy pick:", err));
  });
}

/**
 * Create the copies on the copier.
 *
 * @param {object} args
 * @param {string} args.copierId
 * @param {Array<{unitId: string, abilityId: string}>} args.picks
 * @param {number} [args.slots] how many the grant allows
 * @param {string} [args.grantedBy]
 * @returns {Promise<{ok: boolean, reason?: string, created?: number}>}
 */
export async function grantCopies({ copierId, picks, slots = 2, grantedBy = "wisdomOfDunScaith" }) {
  const copier = game.actors.get(copierId);
  if (!copier) return { ok: false, reason: "notFound" };
  if ((picks ?? []).length > slots) return { ok: false, reason: "tooManyPicks" };

  /** @type {object[]} */
  const data = [];
  for (const pick of picks ?? []) {
    const source = game.actors.get(pick.unitId)?.items?.get(pick.abilityId);
    if (!source) return { ok: false, reason: "unknownAbility" };

    // Checked again here even though `offerCopies` filtered: the offer and the
    // pick are separated by a human, and an EX-ranked buff applied in between
    // would otherwise slip through.
    const verdict = canCopy(abilitySpec(source));
    if (!verdict.ok) return { ok: false, reason: verdict.reason };

    const copy = copyAbility(abilitySpec(source), { id: copierId }, { ...DUN_SCAITH, grantedBy });
    data.push({
      name: copy.name,
      type: "ability",
      system: {
        // HOW it is used, carried from the source: its window, its targeting,
        // its damage, its phases. Only the phases were resolved by reference
        // (`rules/copy.mjs#effectivePhases`), and nothing else -- so a copy
        // classified as passive, sat greyed on the bar and could not be used
        // at all (found pressing #204 W1.effect). The phases still run from the
        // source at execution, so a content fix reaches them.
        ...carriedUse(source),
        rank: copy.rank,
        // `max`, not `value`. The schema has no `value`, so the DataModel
        // dropped it: on top of the unparseable expression above, the field
        // the cooldown was written to did not exist.
        cooldown: { max: copy.cooldown, remaining: 0, regen: 0 },
        copiedFrom: copy.copiedFrom,
        grantedBy: copy.grantedBy,
        exclusionSet: copy.exclusionSet,
        // Every slot from one grant gates on the others (Ch. 17): "Cannot be
        // used if Wisdom of Dún Scáith (Skill 2) or (Clairvoyance) is on
        // Cooldown." Authored ON the copy, because the copy is what the player
        // presses and `canUseAbility` reads its requirements.
        requirements: [{ kind: "abilityOffCooldown", exclusionSet: copy.exclusionSet, excludeSelf: true }],
      },
    });
  }

  // Removed first, so re-picking replaces rather than accumulating: the grant
  // gives two slots, not two more each time it is used.
  const stale = copier.items.filter((i) => i.system?.grantedBy === grantedBy).map((i) => i.id);
  if (stale.length > 0) await copier.deleteEmbeddedDocuments("Item", stale);

  await copier.createEmbeddedDocuments("Item", data);
  // The pick is made: the Turn it was holding may end (#204 reading 8).
  if (copier.system?.copyPick?.due) await copier.update({ "system.copyPick.due": false });
  return { ok: true, created: data.length };
}

/**
 * What a copy keeps of its source: everything about USING it, nothing about
 * owning it. The copier's rank, cooldown and gates replace the source's, and
 * the source's passive `rules` stay behind -- a copy carries "only the Active
 * part" (#204 reading 10).
 */
const NOT_CARRIED = Object.freeze([
  "rank", "cooldown", "requirements", "exclusionSet", "rules", "passive", "copyable",
  // A Skill's "(Passive)" clauses, kept apart from its Active ones: Eye of the
  // Mind (False)'s cooldown refund on an Evade came along with its Dodge.
  "passiveRules",
  "contentId", "contentVersion", "category", "sameTurnExclusive", "alsoTriggers",
  "opensDialog", "copiedFrom", "grantedBy", "inheritedFrom",
  // Runtime state of the source, not of the copy.
  "active", "toggledAt", "lastUsedTick",
]);

/**
 * @param {object} source the source ability Item
 * @returns {object}
 */
function carriedUse(source) {
  const system = foundry.utils.deepClone(source.toObject().system ?? {});
  for (const key of NOT_CARRIED) delete system[key];
  return system;
}

/**
 * The pure shape `rules/copy.mjs` wants, off an Item document.
 * @param {object} item
 * @returns {object}
 */
function abilitySpec(item) {
  const sys = item.system ?? {};
  return {
    id: sys.contentId || item.id,
    name: item.name,
    rank: sys.rank,
    // `kind` and `passive` were read here against a schema that declared
    // neither, so `canCopy`'s "excluding Class Skills" and "must have an
    // Active effect" both saw `undefined` and let everything through.
    kind: sys.kind ?? null,
    isNP: item.type === "noblePhantasm" || Boolean(sys.isNP),
    passive: Boolean(sys.passive),
    phases: sys.phases ?? [],
    copyable: sys.copyable,
  };
}
