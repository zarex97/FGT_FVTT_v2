/**
 * @file Castor and Pollux as a war holds them: two actors, one linked group.
 * @see test/unit/dioscuri-209-rulings.test.mjs, test/unit/dioscuri-209-arena.test.mjs
 *
 * `commitSummon` cross-links the twins' `memberIds` with their real actor ids,
 * the only moment every id exists, so a subject built from the corpus alone has
 * a group with no members and no leash to keep. This seeds exactly that and
 * nothing else: the group is the AUTHORED object read from the real YAML (a
 * `state.linkedGroup` replaces the whole object, so a hand-typed copy would
 * drift from what the sheets say), with `memberIds` added.
 */

import { loadSource } from "../../tools/lib/load.mjs";

/** Real 16-character actor ids: `memberIds` is a list of them and the model refuses anything else. */
export const CASTOR = "castorDioscuri01";
export const POLLUX = "polluxDioscuri01";

/** @type {Promise<Record<string, object>>|null} */
let AUTHORED = null;

/** Each twin's authored `linkedGroup`, once per test file. */
function authoredGroups() {
  AUTHORED ??= (async () => {
    const { files } = await loadSource("packs/_source");
    return Object.fromEntries(["castor", "pollux"].map((id) => [id, files.find((f) => f.doc?.id === id).doc.linkedGroup]));
  })();
  return AUTHORED;
}

/**
 * The twins, ready for `withSubjects`.
 *
 * @param {object} [over]
 * @param {string} [over.faction] both twins' side
 * @param {object} [over.castor] `withSubjects` keys layered over Castor's (`panel`, `state`, `with`, `effects`)
 * @param {object} [over.pollux] the same for Pollux
 * @returns {Promise<object[]>}
 */
export async function twinSpecs({ faction = "A", castor = {}, pollux = {} } = {}) {
  const groups = await authoredGroups();
  const one = (from, id, partner, extra) => ({
    from, id, ...extra,
    state: {
      factionId: faction,
      linkedGroup: { ...groups[from], memberIds: [partner] },
      ...(extra.state ?? {}),
    },
  });
  return [one("castor", CASTOR, POLLUX, castor), one("pollux", POLLUX, CASTOR, pollux)];
}
