/**
 * @file Turning document changes into invalidations, and acting on them.
 * @see docs/23-documents-and-derived-data.md §23.9, docs/25-turn-system.md §25.10
 *
 * Layer 3. `rules/invalidation.mjs` holds the table; this reads the Foundry
 * hooks and applies it.
 *
 * **What there is to invalidate, honestly.** §23.9's table names a snapshot
 * cache, and this system does not have one: `snapshotBoard` runs per
 * resolution, from the documents, every time. That is a deliberate design and
 * the reason most of the staleness §23.9 anticipates cannot occur here — you
 * cannot serve a stale snapshot you never stored. What *is* long-lived, and so
 * what this actually drives:
 *
 *   - the **canvas aura index**, rebuilt on movement and aura-rule changes;
 *   - the **overlays**, which read positions and Master protection;
 *   - the **desync checksum** at each round boundary (§25.10).
 *
 * The table is still worth having for all three, because the alternative — a
 * hand-maintained hook list per consumer, which is what the overlays had — goes
 * stale silently in both directions.
 */

import { invalidationsFor, affectsCanAct } from "../rules/invalidation.mjs";
import { buildAuraIndex } from "../rules/aura-index.mjs";
import { boardChecksum, compareChecksums } from "../rules/desync.mjs";
import { currentBoard } from "./board.mjs";
import { FGTSocket } from "../net/socket.mjs";

/** The canvas-side aura index. Rebuilt lazily, read by the overlays. */
let auraIndex = null;

/**
 * The current aura index, rebuilt if it was invalidated.
 *
 * The **resolution** path does not use this — `snapshotBoard` builds its own,
 * synchronously, because §23.3 requires a resolution to see a current index and
 * a one-frame-stale one is only acceptable for display.
 *
 * @returns {object}
 */
export function canvasAuraIndex() {
  if (!auraIndex) auraIndex = buildAuraIndex(currentBoard(), auraIndex?.version ?? 0);
  return auraIndex;
}

/**
 * Apply a set of invalidation targets.
 * @param {string[]} targets
 */
export function invalidate(targets) {
  if (targets.length === 0) return;

  if (targets.includes("all") || targets.includes("auraIndex")) auraIndex = null;

  // One event, carrying what changed, so a consumer can decide whether it cares
  // rather than refreshing on everything.
  Hooks.callAll("fgt.invalidate", targets);
}

/**
 * Register the document hooks.
 * Called from `ready`.
 */
export function attachInvalidation() {
  Hooks.on("updateActor", (actor, changes) => {
    invalidate(invalidationsFor("actorField", { actorId: actor.id, ...auraHints(actor, changes) }));
  });

  for (const hook of ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"]) {
    Hooks.on(hook, (effect) => {
      const defId = effect.system?.defId ?? null;
      invalidate(invalidationsFor("effectChanged", {
        actorId: effect.parent?.id ?? null,
        grantsAura: grantsAura(effect),
        // §23.9's easily-missed row: anything that changes `canAct` invalidates
        // Master protection for Masters within 2 panels. A mode toggle does not
        // move anyone, and it still changes whether the Servant is protecting.
        affectsCanAct: affectsCanAct(defId),
      }));
    });
  }

  for (const hook of ["createItem", "deleteItem"]) {
    Hooks.on(hook, (item) => {
      invalidate(invalidationsFor("itemChanged", {
        actorId: item.parent?.id ?? null,
        grantsAura: grantsAura(item),
      }));
    });
  }

  Hooks.on("updateItem", (item, changes) => {
    // A mode toggle is an item update on `system.active`, and it is the row
    // §23.9 singles out.
    if (changes?.system?.active === undefined) return;
    invalidate(invalidationsFor("modeToggled", {
      actorId: item.parent?.id ?? null,
      affectsCanAct: Boolean(item.system?.preventsAction),
    }));
  });

  Hooks.on("updateToken", (token, changes) => {
    if (changes?.x === undefined && changes?.y === undefined) return;
    invalidate(invalidationsFor("tokenMoved", {
      actorId: token.actor?.id ?? null,
      partnerId: token.actor?.system?.masterId ?? null,
    }));
  });

  Hooks.on("deleteToken", () => invalidate(invalidationsFor("tokenDeleted", {})));
  Hooks.on("createToken", () => invalidate(invalidationsFor("tokenDeleted", {})));

  Hooks.on("combatTurnChange", () => invalidate(invalidationsFor("turnAdvanced", {})));
  Hooks.on("canvasReady", () => invalidate(["all"]));

  attachDesyncDetector();
}

/* -------------------------------------------------------------------------- */
/*  §25.10 — the desync detector                                              */
/* -------------------------------------------------------------------------- */

/**
 * Check, once per round, that every client sees the same board.
 *
 * Cheap insurance against the class of bug where one client's view silently
 * drifts. The GM broadcasts a checksum over positions, health and effect ids;
 * a client that disagrees logs it and re-renders from the documents, which is
 * what Foundry would have done had it known.
 */
function attachDesyncDetector() {
  Hooks.on("combatRound", () => {
    invalidate(invalidationsFor("roundAdvanced", {}));
    if (!game.user.isGM) return;
    FGTSocket.broadcast("boardChecksum", {
      round: game.combat?.round ?? 0,
      checksum: boardChecksum(currentBoard()),
    });
  });

  Hooks.on("fgt.boardChecksum", (payload) => {
    if (game.user.isGM) return;
    const verdict = compareChecksums(payload?.checksum ?? null, boardChecksum(currentBoard()));
    if (verdict.agreed) return;

    // A warning rather than a silent repair, because a desync that keeps
    // happening is a bug someone needs to see. The refresh is the mitigation,
    // not the fix.
    console.warn(
      `FGT | Board desync at round ${payload?.round}: the GM's checksum is `
      + `${payload?.checksum} and this client computes ${boardChecksum(currentBoard())}. Refreshing.`,
    );
    invalidate(["all"]);
    canvas.fgtOverlays?.refresh();
  });
}

/* -------------------------------------------------------------------------- */

/**
 * Does this document carry an aura?
 *
 * Checked rather than assumed, because §23.9 is explicit that the index is
 * invalidated **only** when the change grants one. Rebuilding on every effect
 * would rebuild on every burn tick, which is the cost the index exists to
 * avoid.
 *
 * @param {object} doc
 * @returns {boolean}
 */
function grantsAura(doc) {
  const buckets = [doc.system?.rules, doc.system?.passiveRules, doc.system?.activeRules];
  return buckets.some((rules) => (rules ?? []).some((r) => r.key === "Aura"));
}

/**
 * Whether an actor update touched anything aura-bearing.
 * @param {object} _actor
 * @param {object} changes
 * @returns {object}
 */
function auraHints(_actor, changes) {
  // A faction change moves who an aura applies to without moving anyone.
  return { grantsAura: changes?.system?.factionId !== undefined };
}
