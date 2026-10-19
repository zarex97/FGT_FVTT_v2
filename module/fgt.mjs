/**
 * @file System entry point — the init/setup/ready sequence.
 * @see docs/02-architecture.md
 */

import { FGT } from "./config.mjs";
import { registerSettings } from "./settings.mjs";
import * as data from "./data/index.mjs";
import * as documents from "./documents/index.mjs";
import { registerSheets } from "./apps/index.mjs";
import { activateChatListeners } from "./apps/chat/cards.mjs";
import { FGTSocket } from "./net/socket.mjs";
import { currentWar, gmForWar } from "./engine/war.mjs";

import { Rank } from "./domain/rank.mjs";
import { parseTick, resolveTicks } from "./domain/tick.mjs";
import * as geometry from "./domain/geometry.mjs";
import { computeDamage } from "./rules/damage/pipeline.mjs";
import { resolveTargets } from "./rules/targeting/resolve.mjs";
import { test as evaluatePredicate } from "./rules/predicate.mjs";
import { snapshotUnit, snapshotBoard } from "./rules/snapshot.mjs";
import { EffectRegistry } from "./rules/registry.mjs";
import { CommandSpellRegistry } from "./rules/cs-registry.mjs";
import { collectContributions } from "./rules/elements.mjs";
import { explainDamage } from "./rules/explain.mjs";
import * as intents from "./engine/intents.mjs";
import * as combatProcess from "./engine/combat-process.mjs";
import * as scheduler from "./engine/scheduler.mjs";
import * as budget from "./engine/budget.mjs";
import * as summon from "./engine/summon.mjs";
import * as items from "./engine/items.mjs";
import * as copy from "./engine/copy.mjs";
import * as gameLog from "./engine/game-log.mjs";
import * as contract from "./engine/contract.mjs";
import * as sceneLevels from "./engine/scene-levels.mjs";
import * as platforms from "./engine/platforms.mjs";
import * as legality from "./rules/legality.mjs";
import * as control from "./rules/control.mjs";
import * as cardVisibility from "./rules/card-visibility.mjs";
import { SummonDialog } from "./apps/summon-dialog.mjs";
import { CopyDialog } from "./apps/copy-dialog.mjs";
import { ChoiceDialog } from "./apps/choice-dialog.mjs";
import { LogViewer } from "./apps/log-viewer.mjs";
import { AbilityEditor } from "./apps/ability-editor/index.mjs";
import { ContractDialog } from "./apps/contract-dialog.mjs";
import { SetupWizard } from "./apps/setup-wizard.mjs";
import { TokenRotation } from "./engine/token-rotation.mjs";
import { LevelExit } from "./engine/level-exit.mjs";
import { backfillVision } from "./engine/token-vision.mjs";
import { registerTargetingLayer, pickTarget } from "./apps/canvas/targeting-layer.mjs";
import { registerOverlayLayer, attachOverlays } from "./apps/canvas/overlay-layer.mjs";
import { FGTToken as FGTTokenPlaceable, followDisguises } from "./apps/canvas/token.mjs";
import { FGTTile } from "./apps/canvas/decoy.mjs";
import { registerCombatTracker } from "./apps/combat/tracker.mjs";
import { sweepTransientRegions } from "./apps/canvas/target-region.mjs";
import { ensurePassiveFields } from "./engine/fields.mjs";
import { ensureSetupRolls } from "./engine/summon.mjs";
import { syncMarkVisibility } from "./engine/marks.mjs";
import { ActionBar } from "./apps/hud/action-bar.mjs";
import { resumeCounterArming } from "./apps/chat/cards.mjs";
import { PendingPanel } from "./apps/hud/pending-panel.mjs";
import { attachSummonEntries } from "./apps/summon-entry.mjs";
import { reconcileForcedModes } from "./engine/modes.mjs";
import { attachEngineListeners } from "./engine/listeners.mjs";
import { Scheduler } from "./engine/scheduler-hooks.mjs";
import { attachAwaitTimeouts } from "./engine/await-timeout.mjs";

Hooks.once("init", () => {
  console.log("FGT | Initialising Fate/Grail Tactics");

  // Every hook call, logged. F/GT is driven almost entirely by hooks — the
  // scheduler, movement, budget and turn order all hang off them — so when a
  // rule does not fire, the first question is always whether its hook was
  // reached at all, and this is what answers it.
  CONFIG.debug.hooks = true;

  globalThis.fgt = { FGT, api: {} };
  CONFIG.FGT = FGT;

  // ── Data models ──────────────────────────────────────────────────────────
  CONFIG.Actor.dataModels = {
    ...CONFIG.Actor.dataModels,
    servant: data.ServantData, master: data.MasterData, civilian: data.CivilianData,
    summon: data.SummonData, platform: data.PlatformData, structure: data.StructureData,
  };
  CONFIG.Item.dataModels = {
    ...CONFIG.Item.dataModels,
    ability: data.AbilityData, noblePhantasm: data.NoblePhantasmData,
    commandSpell: data.CommandSpellData, masterEssence: data.MasterEssenceData,
    equipment: data.EquipmentData,
  };
  // SPREAD, not replaced: core ships `{ base: ActiveEffectTypeDataModel }`, and
  // dropping it made every core status effect fail to create without a word --
  // a defeated Unit's skull among them (#96).
  CONFIG.ActiveEffect.dataModels = { ...CONFIG.ActiveEffect.dataModels, fgtEffect: data.EffectData };
  CONFIG.Combat.dataModels = { ...CONFIG.Combat.dataModels, match: data.MatchData };
  CONFIG.Combatant.dataModels = { ...CONFIG.Combatant.dataModels, player: data.PlayerCombatantData };
  // Declared in system.json since the manifest was written, with no data model
  // behind any of them -- so an `fgt.terrain` behaviour on a Region carried no
  // type, no duration and no meaning (Ch. 07).
  //
  // Spread, for the same reason as ActiveEffect's above: core ships twelve
  // built-in behaviours here, and a bare object dropped all of them (#96).
  CONFIG.RegionBehavior.dataModels = {
    ...CONFIG.RegionBehavior.dataModels,
    terrain: data.TerrainBehavior,
    homeBase: data.HomeBaseBehavior,
    npField: data.NPFieldBehavior,
    platform: data.PlatformBehavior,
  };

  // ── Document classes ─────────────────────────────────────────────────────
  CONFIG.Actor.documentClass = documents.FGTActor;
  CONFIG.Item.documentClass = documents.FGTItem;
  CONFIG.ActiveEffect.documentClass = documents.FGTEffect;
  CONFIG.Combat.documentClass = documents.FGTCombat;
  CONFIG.Combatant.documentClass = documents.FGTCombatant;
  CONFIG.Token.documentClass = documents.FGTToken;
  // The PLACEABLE, not the document. A platform is a 9x9 token whose hit area
  // covers eighty other panels, so "which level accepts a click" has to be a
  // rule (Ch. 27). Registered at init, because the canvas reads this when it
  // builds the token layer.
  CONFIG.Token.objectClass = FGTTokenPlaceable;
  followDisguises();
  // A ghost's stand-in body, seen per viewer (#249 reading 33).
  CONFIG.Tile.objectClass = FGTTile;

  // There is no initiative. Turn order is a 1d100 per faction, re-rolled every
  // Round, plus Delay (Ch. 25).
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };

  registerSheets();
  registerSettings();

  // Must happen at init: the canvas reads CONFIG.Canvas.layers when it is built.
  registerTargetingLayer();
  registerOverlayLayer();
  // Turns belong to factions, and only this tracker can create one.
  registerCombatTracker();

  // Mandatory, and it requires "socket": true in the manifest plus a world
  // restart. Without it the server never registers the namespace and every
  // emit silently does nothing.
  FGTSocket.initialize();
  // Each request goes to the GM running the requester's War (Q14 (B), 2026-10-18).
  FGTSocket.setRouter({ warFor: currentWar, gmFor: gmForWar });
  activateChatListeners();

  // Let compendium browsers filter without loading every document.
  CONFIG.Actor.compendiumIndexFields.push("system.servantClasses", "system.region");
  CONFIG.Item.compendiumIndexFields.push("system.rank", "system.isNP");
});

Hooks.once("setup", async () => {
  // The ability card, as a named partial. The Abilities tab renders it three
  // times -- class skills, personal skills, Noble Phantasms -- and three copies
  // of that markup would be three places for the disabled-reason to go missing
  // from. This is not the Master-panel case: that partial existed to keep two
  // panels in ONE scroll container, and this one exists because three call
  // sites want one implementation.
  await foundry.applications.handlebars.loadTemplates({
    "fgt-ability-card": "systems/fgt/templates/actor/ability-card.hbs",
    "fgt-effect-row": "systems/fgt/templates/actor/effect-row.hbs",
    // The turn panel, rendered inside the action bar rather than in a
    // window of its own.
    "fgt-turn-panel": "systems/fgt/templates/hud/turn.hbs",
    // The one partial that renders ANY authoring descriptor field. Adding a
    // rule element to the engine means adding a table entry, never markup.
    "fgt-editor-field": "systems/fgt/templates/apps/ability-editor-field.hbs",
    // Recursive: a predicate group renders it again for each child.
    "fgt-predicate-row": "systems/fgt/templates/apps/predicate-builder.hbs",
    // One control per War Rule: the War rules window and the setup wizard's
    // War tab render the same rows (`apps/war-rules.mjs#warRuleRows`).
    "fgt-war-rule-fields": "systems/fgt/templates/apps/war-rule-fields.hbs",
  });

  // Packs are not readable during `init`; `setup` runs after they are indexed
  // and before the canvas draws, which is exactly the window we need.
  const pack = game.packs.get("fgt.effects");
  const documents = pack ? await pack.getDocuments() : [];
  const count = EffectRegistry.load(documents);
  console.log(`FGT | Loaded ${count} effect definitions`);

  // The Command Spell catalogue. Its own pack, because it is content a GM may
  // extend -- the rulebook says so explicitly.
  const csPack = game.packs.get("fgt.command-spells");
  const csDocs = csPack ? await csPack.getDocuments() : [];
  console.log(`FGT | Loaded ${CommandSpellRegistry.load(csDocs)} Command Spells`);

  // Base Attacks a `damage.base.sources` entry may name by content id, so that
  // *"The Golden Hind's Base Attack (MAG) is used"* survives the ship not being
  // on the board. Cached here because stage 1 of the damage pipeline is pure
  // and cannot await a pack.
  const { primeContentBaseAttacks } = await import("./engine/attack.mjs");
  console.log(`FGT | Cached ${await primeContentBaseAttacks()} content Base Attack(s)`);

  if (game.settings.get("fgt", "devMode")) {
    const report = EffectRegistry.validate();
    for (const w of report.warnings) console.warn(`FGT | ${w}`);
    if (report.errors.length) {
      for (const e of report.errors) console.error(`FGT | ${e}`);
      ui.notifications.error(`FGT: ${report.errors.length} content errors — see console.`);
    }
  }

  // Everything above landed AFTER every Actor was already prepared, so redo it.
  console.log(`FGT | Re-prepared ${reprepareUnits()} unit(s) against the loaded registries`);
});

/**
 * Re-run derived data on every unit, now that the registries hold something.
 *
 * Foundry prepares the world's documents while its collections initialize,
 * which is **before** the `setup` hook — and the registries are loaded inside
 * that hook, from a compendium, behind an `await`. So every Actor computed its
 * derived data against an EMPTY `EffectRegistry`.
 *
 * `contributionsOf` resolves an effect's behaviour through that registry and
 * skips any effect it cannot find a definition for, so on a cold load **every
 * effect whose behaviour is expressed as `rules:` contributed nothing** —
 * silently, and only until something happened to touch the actor and re-run
 * preparation, at which point the modifier appeared out of nowhere. Found on
 * Medusa: her Riding Active's +5 MOV was in `statDeltas` on the sheet's
 * explainer and NOT in her MOV, because the explainer reads a snapshot taken
 * at render time and the MOV came from derived data computed at world load.
 *
 * This is the second half of a defect whose first half is recorded in
 * `rules/snapshot.mjs#contributionsOf`: that one read a field nothing
 * populated, this one reads a registry nothing had filled yet. Same symptom,
 * and Medea's MOV Up is again the example.
 *
 * Unlinked token actors are prepared separately: they are synthetic documents
 * built from an `ActorDelta` and do not inherit the base actor's preparation.
 *
 * @returns {number} how many units were re-prepared
 */
function reprepareUnits() {
  let count = 0;
  for (const actor of game.actors ?? []) {
    try {
      actor.prepareData();
      count += 1;
    } catch (err) {
      console.error(`FGT | Could not re-prepare ${actor.name}:`, err);
    }
  }
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      // A linked token shares the base actor that was just re-prepared.
      if (token.actorLink) continue;
      try {
        token.actor?.prepareData();
        count += 1;
      } catch (err) {
        console.error(`FGT | Could not re-prepare token ${token.name}:`, err);
      }
    }
  }
  return count;
}

Hooks.once("ready", async () => {
  // Ch. 41, and FIRST in this callback: the shape of stored data, then its
  // content, before anything below reads either. GM-only and single-client,
  // because two clients migrating one world is a corrupted world.
  // ...except the Turn and Round boundaries, bound before the migration's
  // await and waiting for the engine: a Turn changed during it ran no boundary
  // and was lost for good (#230, §46.4-JY).
  Scheduler.attachBoundaries();
  const { onReady: migrateOnReady } = await import("./migration/runner.mjs");
  await migrateOnReady();

  // The engine's own listeners, in one list (`engine/listeners.mjs`), which the
  // test world binds too: the Turn and Round boundaries, a mode's end, terrain,
  // token footprint, vision and rotation, faction ownership, derived fields,
  // Bloodmark sight, invalidation, forced modes and Presence Concealment's end.
  attachEngineListeners();

  // The listeners that only draw, bound after the engine's.
  // A client viewing a Level that is deleted goes where its selected token
  // landed, or to the ground (#176).
  LevelExit.attach();
  // `system.facing` lives on the Actor, and no Foundry render flag fires for
  // it — so the chevron the placeable draws has to be told by hand.
  Hooks.on("updateActor", (actor, changes) => {
    if (!(changes.system && "facing" in changes.system)) return;
    for (const token of actor.getActiveTokens()) token.refreshFacing?.();
  });
  // ZON rings, threat ranges and Master protection, drawn from selection and
  // hover. Context, never a control.
  attachOverlays();
  // A platform's or a dimension's Level deleted under a client's feet. The
  // Storm Border surfacing moves everyone aboard to the ground and deletes its
  // Level in one breath, and the canvas was left not ready -- no board, no
  // tokens, nothing to click -- until something redrew it (#191). Every client,
  // because every client was showing that scene.
  // Created, too: submerging creates the Level and moves everyone onto it at
  // once, and the canvas stalled the same way.
  for (const hook of ["createLevel", "deleteLevel"]) {
    Hooks.on(hook, (level) => {
      if (level?.parent?.id !== canvas?.scene?.id) return;
      setTimeout(() => { if (!canvas.ready) canvas.draw(); }, 500);
    });
  }
  // Ch. 40's summon, reachable from the sidebar and the compendium. GM only,
  // and it intercepts a bare compendium drop -- which would otherwise produce a
  // Servant with the template's numbers instead of its own rolled ones.
  attachSummonEntries();
  // Ch. 34: attack, move, the ability quick-bar, the facing dial and the budget
  // dot, on the token itself.
  ActionBar.attach();
  // Ch. 23: one place that answers "what is the game waiting for me to do?" An
  // AoE already fans out to one ladder per defender, so a player with four
  // units can hold three prompts at once in a scrolling log.
  PendingPanel.attach();
  // Ch. 23: a player who has closed their browser must not block the table, and
  // the decision made for them must never spend anything.
  attachAwaitTimeouts();

  // Once at load. Each is async and not awaited, so each writes after every
  // listener above is bound, as it did when they were interleaved.
  // Facing lives in `system.facing`, not in Foundry's `rotation` — every token
  // already placed is locked.
  TokenRotation.lockExisting();
  // A targeting area is discarded in a `finally`, so the only way one survives
  // is a client that stopped existing mid-decision. Sweep them once, here.
  sweepTransientRegions();
  // Ch. 28: a PASSIVE bounded field has no cast to open it. Pale Rider's
  // Contagion is the area around him, full stop — so it is reconciled with the
  // board here and at every Turn start rather than waiting for an activation
  // that never comes. Idempotent and GM-gated internally.
  ensurePassiveFields();
  // Agility and Luck are ROLLED, not derived, so a Servant that reached the
  // world by some other route -- duplicated, built by a macro, imported --
  // keeps the template's zeroes, and a maximum of 0 is a number no d20 can roll
  // under: that Servant auto-fails every Evade and Luck Check in silence.
  // GM-gated and idempotent internally.
  ensureSetupRolls().catch((err) => console.error("FGT | Setup rolls:", err));
  // Bloodmark sight for the board as it stands (`markSight` re-asks on moves).
  syncMarkVisibility().catch((err) => console.error("FGT | Mark visibility:", err));
  // For a world resumed mid-match with a Greek Male already standing beside
  // Penthesilea. A rule that only fires on a *change* would leave her calm
  // until somebody happened to move.
  reconcileForcedModes().catch((err) => console.error("FGT | Forced modes:", err));
  // For the tokens already on a board. The hooks above only catch a token
  // being placed or an actor being edited, and every token in every world that
  // predates Ch. 05's vision sync is sitting at range 0.
  backfillVision().catch((err) => console.error("FGT | Token vision backfill:", err));
  // Ch. 21: a Counter rung that was already waiting when this client loaded. The
  // render hook that normally arms the bar fires before the bar exists, so a
  // player who reloads mid-exchange would otherwise see the prompt and have
  // nothing to answer it with.
  resumeCounterArming();
  fgt.api = buildPublicAPI();
  console.log(`FGT | Ready — ${game.system.version}`);
});

/**
 * The documented surface for macros and modules.
 *
 * Everything a macro needs, and nothing that bypasses a permission check: the
 * pure functions are safe by construction, and anything that writes goes
 * through the intent applier (Ch. 02).
 * @returns {object}
 */
function buildPublicAPI() {
  return {
    // Domain (L1)
    Rank, parseTick, resolveTicks, geometry,
    // Rules (L2) — pure, no writes
    computeDamage, resolveTargets, evaluatePredicate, snapshotUnit, snapshotBoard,
    explainDamage,
    // Engine (L3)
    intents, combatProcess, scheduler, budget,
    pickTarget,
    // Summoning and setup rolls (Ch. 40), and items (Ch. 17).
    // Exposed because both are GM workflows a macro drives -- a summon dialog
    // is content, not engine.
    summon, items, copy,
    gameLog, control, cardVisibility, contract, sceneLevels, legality,
    // `boardPlatform` had a complete engine and no way to reach it -- no
    // action-registry entry, no action-bar button, no console handle -- so a
    // GM driving boarding by hand had nothing to call. Fixed as #24.
    platforms,
    // The forced half of a compulsion (Penthesilea). Exposed because a GM who
    // has hand-placed tokens may want to reconcile without waiting for a move.
    forcedModes: reconcileForcedModes,
    dialogs: {
      SummonDialog, CopyDialog, ChoiceDialog, LogViewer, AbilityEditor, ContractDialog,
      SetupWizard,
    },
    effects: EffectRegistry,
    commandSpells: CommandSpellRegistry,
    collectContributions,
    socket: FGTSocket,
  };
}
