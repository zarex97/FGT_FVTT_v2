/**
 * @file System entry point — the init/setup/ready sequence.
 * @see docs/21-system-skeleton.md §21.3
 */

import { FGT } from "./config.mjs";
import { registerSettings } from "./settings.mjs";
import * as data from "./data/index.mjs";
import * as documents from "./documents/index.mjs";
import { registerSheets } from "./apps/index.mjs";
import { activateChatListeners } from "./apps/chat/cards.mjs";
import { FGTSocket } from "./net/socket.mjs";

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
import { Scheduler } from "./engine/scheduler-hooks.mjs";
import * as budget from "./engine/budget.mjs";
import * as summon from "./engine/summon.mjs";
import * as items from "./engine/items.mjs";
import * as copy from "./engine/copy.mjs";
import * as gameLog from "./engine/game-log.mjs";
import * as contract from "./engine/contract.mjs";
import * as sceneLevels from "./engine/scene-levels.mjs";
import * as legality from "./rules/legality.mjs";
import * as control from "./rules/control.mjs";
import * as cardVisibility from "./rules/card-visibility.mjs";
import { SummonDialog } from "./apps/summon-dialog.mjs";
import { CopyDialog } from "./apps/copy-dialog.mjs";
import { ChoiceDialog } from "./apps/choice-dialog.mjs";
import { LogViewer } from "./apps/log-viewer.mjs";
import { AbilityEditor } from "./apps/ability-editor.mjs";
import { ContractDialog } from "./apps/contract-dialog.mjs";
import { Movement } from "./engine/movement-hooks.mjs";
import { TurnHUD } from "./apps/hud/turn-hud.mjs";
import { registerTargetingLayer, pickTarget } from "./apps/canvas/targeting-layer.mjs";
import { registerOverlayLayer, attachOverlays } from "./apps/canvas/overlay-layer.mjs";
import { registerCombatTracker } from "./apps/combat/tracker.mjs";
import { sweepTransientRegions } from "./apps/canvas/target-region.mjs";
import { attachSummonEntries } from "./apps/summon-entry.mjs";
import { attachInvalidation } from "./engine/invalidation-hooks.mjs";
import { attachForcedModes, reconcileForcedModes } from "./engine/modes.mjs";
import { attachConcealment } from "./engine/concealment.mjs";
import { attachTokenHUD } from "./apps/hud/token-hud.mjs";
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
    servant: data.ServantData, master: data.MasterData, civilian: data.CivilianData,
    summon: data.SummonData, platform: data.PlatformData, structure: data.StructureData,
  };
  CONFIG.Item.dataModels = {
    ability: data.AbilityData, noblePhantasm: data.NoblePhantasmData,
    commandSpell: data.CommandSpellData, masterEssence: data.MasterEssenceData,
    equipment: data.EquipmentData,
  };
  CONFIG.ActiveEffect.dataModels = { fgtEffect: data.EffectData };
  CONFIG.Combat.dataModels = { match: data.MatchData };
  CONFIG.Combatant.dataModels = { player: data.PlayerCombatantData };
  // Declared in system.json since the manifest was written, with no data model
  // behind any of them -- so an `fgt.terrain` behaviour on a Region carried no
  // type, no duration and no meaning (Ch. 22 §22.10).
  CONFIG.RegionBehavior.dataModels = {
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

  // There is no initiative. Turn order is a 1d100 per faction, re-rolled every
  // Round, plus Delay (Ch. 25 §25.3).
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

  if (game.settings.get("fgt", "devMode")) {
    const report = EffectRegistry.validate();
    for (const w of report.warnings) console.warn(`FGT | ${w}`);
    if (report.errors.length) {
      for (const e of report.errors) console.error(`FGT | ${e}`);
      ui.notifications.error(`FGT: ${report.errors.length} content errors — see console.`);
    }
  }
});

Hooks.once("ready", () => {
  // GM client only; a no-op everywhere else.
  Scheduler.attach();
  // Every client validates its own movement; the write is proxied as usual.
  Movement.attach();
  // Everyone sees the budget; only the acting faction can spend it.
  TurnHUD.attach();
  // ZON rings, threat ranges and Master protection, drawn from selection and
  // hover. Context, never a control.
  attachOverlays();
  // A targeting area is discarded in a `finally`, so the only way one survives
  // is a client that stopped existing mid-decision. Sweep them once, here.
  sweepTransientRegions();
  // §37.6's summon, reachable from the sidebar and the compendium. GM only,
  // and it intercepts a bare compendium drop -- which would otherwise produce a
  // Servant with the template's numbers instead of its own rolled ones.
  attachSummonEntries();
  // §23.9's invalidation table, driving the canvas aura index and the overlays,
  // plus §25.10's round-boundary desync check.
  attachInvalidation();
  // Penthesilea's Hatred of Achilles: "at any time, if there is a Greek Male
  // Unit within a 4 panel area, her Mad Enhancement is IMMEDIATELY ACTIVATED".
  // Nobody presses anything, so something has to be watching -- and it rides
  // the same invalidation the aura index does, because the question is
  // positional and changes whenever anybody moves.
  attachForcedModes();

  // Presence Concealment's aftermath: the cooldown that starts when the Skill
  // ENDS, and the Secret Poison that becomes visible at the same moment.
  attachConcealment();
  // Once at load, for a world resumed mid-match with a Greek Male already
  // standing beside her. A rule that only fires on a *change* would leave her
  // calm until somebody happened to move.
  reconcileForcedModes().catch((err) => console.error("FGT | Forced modes:", err));
  // §29.5: attack, move, the ability quick-bar, the facing dial and the budget
  // dot, on the token itself.
  attachTokenHUD();
  // §27.5: a player who has closed their browser must not block the table, and
  // the decision made for them must never spend anything.
  attachAwaitTimeouts();
  fgt.api = buildPublicAPI();
  console.log(`FGT | Ready — ${game.system.version}`);
});

/**
 * The documented surface for macros and modules.
 *
 * Everything a macro needs, and nothing that bypasses a permission check: the
 * pure functions are safe by construction, and anything that writes goes
 * through the intent applier (Ch. 21 §21.6).
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
    // Summoning and setup rolls (Ch. 37 §37.6), and items (Ch. 15 §15.8).
    // Exposed because both are GM workflows a macro drives -- a summon dialog
    // is content, not engine.
    summon, items, copy,
    gameLog, control, cardVisibility, contract, sceneLevels, legality,
    // The forced half of a compulsion (Penthesilea). Exposed because a GM who
    // has hand-placed tokens may want to reconcile without waiting for a move.
    forcedModes: reconcileForcedModes,
    dialogs: { SummonDialog, CopyDialog, ChoiceDialog, LogViewer, AbilityEditor, ContractDialog },
    effects: EffectRegistry,
    commandSpells: CommandSpellRegistry,
    collectContributions,
    socket: FGTSocket,
  };
}
