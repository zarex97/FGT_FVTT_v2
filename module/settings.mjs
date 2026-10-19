/**
 * @file Game settings registration.
 * @see docs/02-architecture.md
 *
 * **The War Rules are not world settings any more.** A world holds several
 * Wars, each on its own scene and played at the same time, so a rule a world
 * setting held hit every War at once (2026-10-18). Each War holds its own
 * (`MatchData`, built from `rules/war-rules.mjs`), and the world keeps the same
 * keys only as the DEFAULTS a new War starts from: hidden from the settings
 * window and edited through the "Defaults for new Wars" menu, read by
 * `engine/war.mjs#worldDefault` and nothing else. Changing one changes no War
 * in play, which is why the old mid-match lock on them is gone: the lock lives
 * on the War now (`apps/war-rules.mjs`).
 */

import { registerFactionMenu } from "./apps/faction-config.mjs";
import { SetupWizard } from "./apps/setup-wizard.mjs";
import { WarRulesApp } from "./apps/war-rules.mjs";
import { WAR_RULES } from "./domain/war-rules.mjs";

/** A setting's type, from a War Rule's. */
const SETTING_TYPE = { number: Number, boolean: Boolean, string: String, roster: Array };

export function registerSettings() {
  const s = (key, data) => game.settings.register("fgt", key, { scope: "world", config: true, ...data });

  // The War Rules' world defaults, one per rule. `config: false`: they are
  // edited in the War rules window's defaults mode, which states what they
  // are, instead of a settings window that would read as if they ruled the
  // Wars in play. The roster is registered below, with its own editor.
  for (const spec of WAR_RULES) {
    if (spec.key === "factions") continue;
    s(spec.key, {
      name: spec.name, hint: spec.hint, config: false,
      type: SETTING_TYPE[spec.type],
      // A setting holds no `null`: a Region of none is the empty string,
      // which `worldDefault` reads back as `null`.
      default: spec.initial ?? "",
      ...(spec.choices ? { choices: spec.choices } : {}),
      ...(spec.range ? { range: spec.range } : {}),
    });
  }
  game.settings.registerMenu("fgt", "warDefaults", {
    name: "FGT.WarRules.DefaultsMenuName",
    label: "FGT.WarRules.DefaultsMenuLabel",
    hint: "FGT.WarRules.DefaultsMenuHint",
    icon: "fa-solid fa-scale-balanced",
    type: WarRulesApp.Defaults,
    restricted: true,
  });

  // KNOWN INERT (`test/unit/settings-are-read.test.mjs`): registered and read
  // by nothing, so it is not a War Rule -- moving a switch nothing reads would
  // give every War a field nothing reads.
  s("activeSkillBudget", { name: "FGT.Settings.ActiveSkillBudget", type: String, default: "move" });
  s("devMode", { name: "FGT.Settings.DevMode", type: Boolean, default: false });

  // The roster a NEW War starts from; each War holds its own
  // (`MatchData.factions`). Edited through the menu below rather than a text
  // box, because the ids in it are what every actor stores.
  game.settings.register("fgt", "factions", {
    scope: "world", config: false, type: Array, default: [],
    // Re-render anything showing a faction: the sheets' selects and the
    // roster editor itself. ApplicationV2 instances are not in `ui.windows`.
    onChange: () => {
      for (const app of foundry.applications.instances.values()) app.render?.({ force: false });
    },
  });
  registerFactionMenu();

  // The setup wizard's in-progress draft, so a GM may close the window, go
  // and read a rulebook, and come back to fourteen rolled Servants rather
  // than to nothing. Cleared on commit. Registered HERE, beside the menu
  // that opens its reader: `test/unit/settings-are-read.test.mjs` fails any
  // setting nothing reads, which is the guard that exists because
  // `closedInfo` and `difficulty` both spent their lives that way.
  s("setupDraft", { config: false, type: Object, default: {} });

  game.settings.registerMenu("fgt", "setupWizard", {
    name: "FGT.Setup.MenuName",
    label: "FGT.Setup.MenuLabel",
    hint: "FGT.Setup.MenuHint",
    icon: "fa-solid fa-chess-board",
    type: SetupWizard,
    restricted: true,
  });

  s("diceFormulas", { config: false, type: Object, default: {} });

  // Ch. 41's schema version. Ch. 41 put it on `world.flags.fgt`, which is
  // not a place: `game.world` is a World *package*, not a Document -- no
  // `flags`, no `setFlag` -- and Foundry ships no migration version of its own.
  // A world-scoped setting is the only durable per-world store the API offers.
  // `0` means "never recorded", which `runner.mjs` reads as "current" rather
  // than replaying every migration against data that never needed them.
  s("schemaVersion", {
    config: false, type: new foundry.data.fields.NumberField({
      required: true, integer: true, min: 0, initial: 0,
    }), default: 0,
  });

  game.settings.register("fgt", "showDamagePreview", {
    scope: "client", config: true, name: "FGT.Settings.ShowDamagePreview", type: Boolean, default: true,
  });
  game.settings.register("fgt", "autoDeclineLuckBelow", {
    scope: "client", config: true, name: "FGT.Settings.AutoDeclineLuckBelow", type: Number, default: 0,
  });
  // Per-client for the same reason the review dialog is: a table that wants to
  // confirm every attack and one that does not can both be right.
  game.settings.register("fgt", "targetingReview", {
    scope: "client", config: true, name: "FGT.Settings.TargetingReview",
    hint: "FGT.Settings.TargetingReviewHint", type: Boolean, default: true,
  });
  // Per-client: one player wanting a clean board should not take the ZON ring
  // away from everybody else.
  game.settings.register("fgt", "showOverlays", {
    scope: "client", config: true, name: "FGT.Settings.ShowOverlays",
    hint: "FGT.Settings.ShowOverlaysHint", type: Boolean, default: true,
    onChange: () => canvas?.fgtOverlays?.refresh(),
  });
}
