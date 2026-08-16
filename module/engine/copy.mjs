/**
 * @file Granting copies — the write half of Wisdom of Dún Scáith.
 * @see docs/15-abilities.md §15.7, docs/36-gm-tools.md
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

/** Wisdom of Dún Scáith's own rank and cooldown, which every copy takes. */
const DUN_SCAITH = Object.freeze({ rank: "A+", cooldown: "4◈−⅓◈", exclusionSet: "wisdomOfDunScaith" });

/**
 * What this unit could copy right now.
 *
 * @param {object} args
 * @param {string} args.copierId
 * @param {string[]} [args.prefer] grades to mark preferred; §15.7 says B and A
 * @returns {Array<object>}
 */
export function offerCopies({ copierId, prefer = ["A", "B"] }) {
  const board = currentBoard();
  const copier = unitFrom(board, game.actors.get(copierId));
  if (!copier) return [];

  // The snapshot's units carry ability *snapshots*; the candidate list is what
  // the GM dialog renders, so it carries the whole ability rather than an id.
  return copyCandidates(board, copier, { prefer });
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
        rank: copy.rank,
        cooldown: { value: copy.cooldown },
        copiedFrom: copy.copiedFrom,
        grantedBy: copy.grantedBy,
        exclusionSet: copy.exclusionSet,
      },
    });
  }

  // Removed first, so re-picking replaces rather than accumulating: the grant
  // gives two slots, not two more each time it is used.
  const stale = copier.items.filter((i) => i.system?.grantedBy === grantedBy).map((i) => i.id);
  if (stale.length > 0) await copier.deleteEmbeddedDocuments("Item", stale);

  await copier.createEmbeddedDocuments("Item", data);
  return { ok: true, created: data.length };
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
    kind: sys.kind,
    isNP: Boolean(sys.isNP),
    passive: Boolean(sys.passive),
    phases: sys.phases ?? [],
    copyable: sys.copyable,
  };
}
