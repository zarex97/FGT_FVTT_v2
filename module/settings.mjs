/**
 * @file Game settings registration.
 * @see docs/21-system-skeleton.md §21.5
 *
 * Settings that change rules are LOCKED once a match is in progress. Changing
 * the fixed-operator mid-game would invalidate every stored absolute expiry on
 * the board, so `onChange` refuses and explains rather than silently corrupting
 * durations.
 */

import { registerFactionMenu } from "./apps/faction-config.mjs";
import { SetupWizard } from "./apps/setup-wizard.mjs";

const RULE_SETTINGS = ["turnsPerRound", "difficulty", "activeSkillBudget", "boardSize",
                       "warType", "ruleset",
                       // Moving a Round gate mid-match changes when every Noble
                       // Phantasm in the world becomes usable.
                       "npGateRound", "npGateRoundAssassin", "noAttackRound"];

export function registerSettings() {
  const s = (key, data) => game.settings.register("fgt", key, { scope: "world", config: true, ...data });

  s("turnsPerRound", {
    name: "FGT.Settings.TurnsPerRound", hint: "FGT.Settings.TurnsPerRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 2, initial: 3 }),
    default: 3, requiresReload: false, onChange: () => guardRuleChange("turnsPerRound"),
  });
  // §7.9's round-indexed gates. All four numbers have been in
  // `CONFIG.FGT.gates` since that file was written and NOTHING read the object
  // -- so a Noble Phantasm was usable in Round 1 in every world. Settings
  // rather than constants so `settings-are-read.test.mjs` holds each of them to
  // having a reader, which is the guard that would have caught this.
  s("npGateRound", {
    name: "FGT.Settings.NpGateRound", hint: "FGT.Settings.NpGateRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 1, initial: 6 }),
    default: CONFIG.FGT?.gates?.npRound ?? 6, requiresReload: false,
    onChange: () => guardRuleChange("npGateRound"),
  });
  // "Assassin: after 3 -- from Round 4."
  s("npGateRoundAssassin", {
    name: "FGT.Settings.NpGateRoundAssassin", hint: "FGT.Settings.NpGateRoundAssassinHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 1, initial: 4 }),
    default: CONFIG.FGT?.gates?.npRoundAssassin ?? 4, requiresReload: false,
    onChange: () => guardRuleChange("npGateRoundAssassin"),
  });
  // "Neither faction may Attack during Round 1." `0` switches the ban off.
  s("noAttackRound", {
    name: "FGT.Settings.NoAttackRound", hint: "FGT.Settings.NoAttackRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    default: CONFIG.FGT?.gates?.noAttackRound ?? 1, requiresReload: false,
    onChange: () => guardRuleChange("noAttackRound"),
  });
  // §17.4: "An offer that blocks resolution indefinitely is unacceptable in a
  // game with seven players." After this many seconds the ladder continues as
  // if the offer were declined, with a chat note -- a disconnected player sees
  // that they missed an opportunity rather than silently losing it.
  s("commandSpellTimeout", {
    name: "FGT.Settings.CommandSpellTimeout", hint: "FGT.Settings.CommandSpellTimeoutHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 45 }),
    default: 45, requiresReload: false,
  });
  // A Grand Order war switches off two rules that assume rival Masters: the
  // multi-Servant tax (§16.7) and Hatred of Achilles against allies (Ch. 44).
  s("grandOrder", {
    name: "FGT.Settings.GrandOrder", hint: "FGT.Settings.GrandOrderHint",
    type: Boolean, default: false, requiresReload: false,
  });
  s("boardSize", {
    name: "FGT.Settings.BoardSize", type: Number, default: 13,
    choices: { 13: "13 × 13", 25: "25 × 25" },
    onChange: () => guardRuleChange("boardSize"),
  });
  // The rulebook's four, and only these four. This offered
  // `beginner | standard | expert` while `MatchData` accepted
  // `beginner | intermediate | expert | lunatic` and `engine/board.mjs`
  // defaulted to "intermediate" WITHOUT consulting the setting at all -- so
  // this control could not produce the value the board assumed, and the board
  // never read the control. Three vocabularies, none of which met.
  //
  // A world holding "standard" reads as "intermediate".
  s("difficulty", {
    name: "FGT.Settings.Difficulty", type: String, default: "intermediate",
    choices: {
      beginner: "FGT.Difficulty.Beginner",
      intermediate: "FGT.Difficulty.Intermediate",
      expert: "FGT.Difficulty.Expert",
      lunatic: "FGT.Difficulty.Lunatic",
    },
    onChange: () => guardRuleChange("difficulty"),
  });
  s("warType", {
    name: "FGT.Settings.WarType", hint: "FGT.Settings.WarTypeHint",
    type: String, default: "greatHolyGrailWar",
    choices: {
      greatHolyGrailWar: "FGT.WarType.Great",
      holyGrailWar: "FGT.WarType.Regular",
      custom: "FGT.WarType.Custom",
    },
    onChange: () => guardRuleChange("warType"),
  });
  s("ruleset", {
    name: "FGT.Settings.Ruleset", hint: "FGT.Settings.RulesetHint",
    type: String, default: "advanced",
    choices: { advanced: "FGT.Ruleset.Advanced", normal: "FGT.Ruleset.Normal" },
    onChange: () => guardRuleChange("ruleset"),
  });
  s("drawPolicy", {
    name: "FGT.Settings.DrawPolicy", hint: "FGT.Settings.DrawPolicyHint",
    type: String, default: "duplicates",
    choices: { duplicates: "FGT.DrawPolicy.Duplicates", unique: "FGT.DrawPolicy.Unique" },
  });
  // §8.3 clause 4, as an OPTIONAL rule. It is the one movement clause that
  // refuses a step onto a panel that looks empty, so a table that finds it more
  // trouble than it is worth can switch it off -- and then it stops applying
  // everywhere at once, reachability included. Default TRUE: it is a rule as
  // written, not a house rule.
  s("masterProtection", {
    name: "FGT.Settings.MasterProtection", hint: "FGT.Settings.MasterProtectionHint",
    type: Boolean, default: true,
    onChange: () => guardRuleChange("masterProtection"),
  });
  s("region", { name: "FGT.Settings.Region", type: String, default: "" });
  s("grailThreshold", { name: "FGT.Settings.GrailThreshold", type: Number, default: 9 });
  // Ch. 26 §26.7. ON, a chat card is redacted per viewer: each side reads its
  // own contributing modifiers and the effects that landed on its own units,
  // and the damage of an exchange it was not part of stays hidden. OFF, every
  // card reads the way the GM's does. Default TRUE, because the rulebook's
  // information rules are rules rather than a house style -- and because the
  // switch spent its whole life registered and read by nothing, which is
  // indistinguishable from it not existing.
  s("closedInfo", {
    name: "FGT.Settings.ClosedInfo", hint: "FGT.Settings.ClosedInfoHint",
    type: Boolean, default: true,
  });
  // §12.8. Rule 1 -- the unit a Counter was aimed at never answers it -- is NOT
  // configurable; it is what stops two Servants countering each other to death.
  // This governs only the bystander an AREA counter caught on its way to
  // somebody else. Default `strict`: NO Counter begins as the product of a
  // Counter, so a Counter is always the last attack of an exchange and the
  // ladder a player is reading has an end they can see from the first rung.
  // `collateral` is the more permissive reading and is defensible -- the
  // bystander was not the one being countered -- so the engine implements it
  // in full and a table can turn it on. It is off by default because it turns
  // one attack into a branching tree of them, and the branches are not visible
  // at the moment the first Counter is declared.
  s("counterChain", {
    name: "FGT.Settings.CounterChain", hint: "FGT.Settings.CounterChainHint",
    type: String, default: "strict",
    choices: { strict: "FGT.CounterChain.Strict", collateral: "FGT.CounterChain.Collateral" },
  });
  s("masterMode", {
    name: "FGT.Settings.MasterMode", type: String, default: "essences",
    choices: { essences: "FGT.MasterMode.Essences", coinFlip: "FGT.MasterMode.CoinFlip", rankless: "FGT.MasterMode.Rankless" },
  });
  s("activeSkillBudget", { name: "FGT.Settings.ActiveSkillBudget", type: String, default: "move" });
  s("interruptTimeout", { name: "FGT.Settings.InterruptTimeout", type: Number, default: 45 });
  // §27.5: reactions get longer than optional contests, because a reaction is
  // the decision a player most needs to think about and the one whose default
  // (take the hit) costs them the most.
  s("reactionTimeout", { name: "FGT.Settings.ReactionTimeout", type: Number, default: 60 });
  s("devMode", { name: "FGT.Settings.DevMode", type: Boolean, default: false });

  // The faction roster. Edited through the menu below rather than a text box,
  // because the ids in it are what every actor stores.
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

/**
 * Refuse a rules change while a match is running.
 * @param {string} key
 */
function guardRuleChange(key) {
  if (!RULE_SETTINGS.includes(key)) return;
  if (!game.combat?.started) return;
  ui.notifications.error(game.i18n.format("FGT.Settings.LockedDuringMatch", { key }));
}
