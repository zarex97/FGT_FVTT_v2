/**
 * @file The round-boundary desync detector.
 * @see docs/25-turn-system.md §25.10
 *
 * Layer 2 (rules). Pure, and hash-only — it never fetches or refreshes.
 *
 * Foundry synchronizes documents automatically, so most state recovers for
 * free. This is cheap insurance against the class of bug where one client's
 * view silently drifts: the GM computes a checksum at each round boundary and
 * broadcasts it, and a client that disagrees asks for a refresh.
 *
 * What goes into the checksum is the whole design. §25.10 names three things —
 * **positions, health values, effect ids** — and the temptation is to add more
 * "for safety". Every field added that can legitimately differ between clients
 * turns the detector into a false alarm, and a detector that cries wolf is
 * turned off. So: those three, sorted, and nothing else.
 */

/**
 * A checksum over the board state that must agree across clients.
 *
 * Sorted at both levels. Units arrive in whatever order the canvas enumerated
 * its tokens, and effects arrive in creation order — which differs per client
 * when two are applied in one batch. Neither is a desync, and an order-
 * sensitive hash would report one on every board.
 *
 * @param {object} board
 * @returns {string}
 */
export function boardChecksum(board) {
  const rows = (board?.units ?? [])
    .map((u) => [
      u.id,
      u.panel ? `${u.panel.i},${u.panel.j}` : "-",
      // `null` health is intrinsically undamageable (Pale Rider), which is a
      // different state from 0 and must hash differently.
      u.health === null || u.health === undefined ? "null" : String(u.health.value ?? u.health),
      [...(u.effects ?? [])].map(effectId).sort().join("|"),
    ].join(":"))
    .sort();

  return fnv1a(rows.join("\n"));
}

/**
 * Compare a broadcast checksum against a local one.
 *
 * A **missing** broadcast is treated as agreement. It is not evidence of drift
 * — it is a client that connected after the round boundary — and refreshing on
 * one would make every reconnect look like a desync.
 *
 * @param {string|null} broadcast the GM's
 * @param {string} local
 * @returns {{agreed: boolean, shouldRefresh: boolean}}
 */
export function compareChecksums(broadcast, local) {
  if (!broadcast) return { agreed: true, shouldRefresh: false };
  const agreed = broadcast === local;
  return { agreed, shouldRefresh: !agreed };
}

/* -------------------------------------------------------------------------- */

/** @param {object|string} e @returns {string} */
function effectId(e) {
  return typeof e === "string" ? e : (e?.defId ?? e?.id ?? "?");
}

/**
 * FNV-1a, 32-bit, as hex.
 *
 * Hand-rolled because this layer is pure: `crypto` is a Node import the rules
 * layer may not take, and `SubtleCrypto` is async and browser-only. A 32-bit
 * hash is ample — this compares two views of the same board, not two documents
 * chosen adversarially.
 *
 * @param {string} s
 * @returns {string}
 */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
