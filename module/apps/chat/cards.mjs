/**
 * @file Attack chat cards — the visible surface of the whole engine.
 * @see docs/37-chat-and-log.md
 *
 * The card IS the audit record: the process state and the damage breakdown live
 * on message flags, so a match can be replayed from its chat log alone. That is
 * also what lets the reaction ladder resume after a reconnect.
 */

import { cloakRoll, openCloaks } from "../../engine/intel.mjs";
import { explainDamage } from "../../rules/explain.mjs";
import { visibleTo, renderBreakdown } from "../../rules/roll-log.mjs";
import { cardFor, skillEffectsFor, redactBreakdown, effectLine } from "../../rules/card-visibility.mjs";
import { countdownFor } from "../../engine/await-timeout.mjs";
import { pendingPrompt, didHit, isComplete, PROMPTS, windowFor, rungOptions } from "../../engine/combat-process.mjs";
import * as process from "../../engine/combat-process.mjs";
import { processOffers, teleportDestinations } from "../../engine/command-spells.mjs";
import { publicIdentityOf, publicSpeakerFor } from "../../engine/public-identity.mjs";
import { currentBoard, luckOf, unitActor } from "../../engine/board.mjs";
import { formatRange } from "../../rules/preview.mjs";
import { isCovering } from "../../rules/cover.mjs";
import { ActionBar } from "../hud/action-bar.mjs";
import { shownName } from "../../engine/public-identity.mjs";
import { warRule } from "../../engine/war.mjs";
import { markSystemCard, viewerRole, unseenCard } from "./surface.mjs";
import { playNoblePhantasmCutIn } from "./cut-in.mjs";
import { isClassicUI, uiTemplate } from "../ui-style.mjs";
import { EffectRegistry } from "../../rules/registry.mjs";
import { polarityOf } from "../../rules/effect-instance.mjs";
import {
  shownAbility, shownAbilityRank, nameForViewer, readsTruthOf, swapAbilityTags, truthOfTag, forgetAbilityTruths,
} from "../../engine/public-ability.mjs";

/**
 * Create the card for a newly declared attack.
 * @param {object} args
 * @returns {Promise<object>} the ChatMessage
 */
export async function renderAttackCard({ state, attacker, ability, targets }) {
  const context = await cardContext({ state, attacker, ability, targets });
  const content = await foundry.applications.handlebars.renderTemplate(
    uiTemplate("systems/fgt/templates/chat/attack.hbs"), context,
  );

  const board = currentBoard();
  const defender = game.actors.get(state.defenderId);
  return ChatMessage.create({
    speaker: publicSpeakerFor(attacker, board),
    content,
    flags: {
      fgt: {
        kind: "attack",
        attackerId: attacker.id,
        defenderId: state.defenderId,
        // Remembered so the card still reads after a unit is deleted.
        names: {
          attacker: attacker ? publicIdentityOf(attacker, board).name : null,
          defender: defender ? publicIdentityOf(defender, board).name : null,
        },
        // ...and how it was delivered, for the same reason (#281).
        delivery: context.delivery,
        // A Noble Phantasm's declaration plays the cut-in on every client (#364).
        np: ability?.type === "noblePhantasm" ? { name: shownAbility(ability), rank: shownAbilityRank(ability) } : null,
      },
    },
  });
}

/**
 * Re-render a card after the process advanced.
 * @param {object} message
 * @param {object} state
 */
export async function updateAttackCard(message, state) {
  const attacker = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attacker?.items.get(state.attack.abilityId) : null;
  const content = await foundry.applications.handlebars.renderTemplate(
    uiTemplate("systems/fgt/templates/chat/attack.hbs"),
    await cardContext({
      state, attacker, ability,
      names: message.getFlag("fgt", "names") ?? null,
      targets: state.defenderId ? [{ unitId: state.defenderId }] : [],
      result: message.getFlag("fgt", "result") ?? null,
      // The countdown needs the message it lives on -- the deadline is stored
      // there rather than computed per client, so two clients cannot disagree
      // by the drift between their clocks.
      message,
    }),
  );
  await message.update({ content });
}

/**
 * How this Process's Attack is delivered, or `null` when it cannot be told (a
 * Unit gone from the board). Imported when asked: the attack engine posts these
 * cards, so a static import would close a cycle.
 *
 * @param {object} state
 * @param {object} board
 * @returns {Promise<string|null>}
 */
async function deliveryOfProcess(state, board) {
  const { processDelivery } = await import("../../engine/attack.mjs");
  return processDelivery(state, board);
}

/**
 * @param {object} args
 * @returns {Promise<object>}
 */
async function cardContext({
  // Only on the client reading it (`fillAttackCard`). Without it this builds the Stored
  // Card, a stranger's view, whoever's client runs it: every write runs on the active
  // GM, and what he would read here shipped to the whole table (#387, #388).
  forViewer = false,
  state, attacker, ability, targets, result = null, message = null, names = null,
}) {
  const prompt = pendingPrompt(state);
  const defender = game.actors.get(state.defenderId);
  // A Servant covering its Master may not Evade (Ch. 32 rule 4): the rung
  // the engine refuses is drawn refused, with why.
  const covering = prompt?.kind === "reaction"
    && isCovering({ id: state.defenderId }, (await import("../../engine/attack.mjs")).coverStateFor(state));
  // Computed BEFORE the breakdown, because the breakdown is redacted with it.
  // ...and from the effects alone when there is no damage to show: an
  // Instakill skips the damage step, and Gáe Bolg Alternative's card said
  // nothing of the Stun and the Instakill it landed (#208, live).
  const effectRows = message?.getFlag?.("fgt", "effects") ?? [];
  const visibility = (result || effectRows.length > 0)
    ? viewerVisibility(state, result ?? { total: 0 }, effectRows, forViewer ? game.user : null)
    : null;
  // For the public names below: `publicNameOf` reads a unit's faction to say
  // "Rider of Red", and only the board knows the factions.
  const board = currentBoard();

  return {
    // Whose card this is, to the one reading it (#364): its banner, its frame's
    // hue and the YOU on its side. Computed here, where `game.user` is the
    // viewer, because `fillAttackCard` re-renders this context on every client.
    viewer: viewerOf(forViewer ? viewerRole({
      isGM: game.user.isGM,
      ownsActor: Boolean(attacker?.isOwner),
      ownsTarget: Boolean(defender?.isOwner),
    }) : "observer", "attack"),
    // Each side's face, the public one: a concealed Servant shows its class.
    attackerImg: attacker ? publicIdentityOf(attacker, board).img : null,
    defenderImg: defender ? publicIdentityOf(defender, board).img : null,
    // The PUBLIC names. A card is one document every client reads, so it must
    // not print a concealed Servant's true name -- the same reason its token
    // shows a class image rather than its face.
    // The live public name, falling back to the one remembered on the message.
    // Re-rendering from flags means a card about a DELETED actor would
    // otherwise lose the name it was posted with, and the chat log is the
    // match's audit record (Ch. 37) -- it has to stay readable after a unit is
    // gone, which is precisely when somebody goes back to read it.
    // Its owner reads their own Unit's true name (#387 ruling 63): this context is built on the viewer's client.
    attackerName: (attacker ? (forViewer ? nameForViewer(attacker, publicIdentityOf(attacker, board).name) : publicIdentityOf(attacker, board).name) : names?.attacker) ?? "Unknown",
    defenderName: (defender ? (forViewer ? nameForViewer(defender, publicIdentityOf(defender, board).name) : publicIdentityOf(defender, board).name) : names?.defender) ?? "—",
    // The tag, whoever reads: `swapAbilityTags` gives the entitled the name (#387).
    abilityName: ability ? shownAbility(ability) : game.i18n.localize("FGT.Chat.NormalAttack"),
    abilityRank: forViewer && readsTruthOf(attacker) ? (ability?.system?.rank ?? null) : shownAbilityRank(ability),
    // Ranged, Melee or Special against THIS defender (#281): the Attack
    // Description's answer, the one the platforms and Gravity Manipulation read.
    delivery: (await deliveryOfProcess(state, board)) ?? message?.getFlag?.("fgt", "delivery") ?? null,
    isNP: ability?.type === "noblePhantasm",
    targetCount: targets?.length ?? 0,

    state: state.state,
    complete: isComplete(state),
    hit: didHit(state),

    // Combat Process step 1.5. A swing that vanished with no line on the card
    // reads as the interface losing the attack rather than as the rule it is,
    // so the miss states its roll, its chance and the effect that caused it.
    missed: state.state === "missed" || state.history.some((h) => h.state === "missed"),
    missRoll: (state.rolls ?? []).find((r) => r.check === "miss") ?? null,
    // ...or an Attack that had no effect on its DU, which says why instead of
    // "Missed": Gravity Manipulation's distant STR Attacks (#328 ruling 9).
    noEffect: (state.rolls ?? []).find((r) => r.check === "noEffect")?.label ?? null,

    // Which side is being asked, and for what. The prompt is rendered as
    // buttons on the card itself rather than as a popup dialog, so a player who
    // tabs away can still find it.
    prompt: prompt
      ? {
          ...prompt,
          label: game.i18n.localize(`FGT.Prompt.${prompt.kind}`),
          options: refuseCoveredEvade(promptOptions(prompt, state), covering),
          isMine: forViewer && (game.actors.get(prompt.unitId)?.isOwner ?? false),
        }
      : null,

    // The die that drew this defender from the declaration's (Dainisshō's
    // *"a random enemy Unit"*, #353): on the card it decided (found live).
    drawn: state.attack?.picked
      ? game.i18n.format("FGT.Card.Drawn", { roll: state.attack.picked.roll, of: state.attack.picked.of })
      : null,

    // A Luck rung declined for its Unit says why on the card, once per reason:
    // the difficulty removed it, or a rule forbids it here (#252).
    luckClosed: [...new Set(state.history
      .map((h) => h.detail?.reason)
      .filter((r) => r === "luckChecksRemoved" || r === "luckChecksBlocked"))]
      .map((r) => game.i18n.localize(`FGT.Card.LuckClosed.${r}`)),

    history: state.history.map((h) => ({
      state: h.state,
      event: h.event,
      label: game.i18n.localize(`FGT.Ladder.${h.state}`),
      detail: h.detail ?? null,
    })),

    // Ch. 23: the GM's "waiting for X (0:23)" indicator, and the button that
    // decides for an absent player. Shown from the start rather than after the
    // clock runs out -- a GM who can see the table knows somebody has left
    // before the timer does.
    countdown: forViewer && message ? countdownFor(message) : null,

    // Command Spells offerable right now, to the Masters who could spend them.
    // Computed per viewer, because "which commands can I use" is a different
    // question for every player at the table.
    commandSpells: forViewer ? offerableCommands(state) : [],
    // "No Command Spell" for this viewer's Masters on this rung, or `null` once
    // they have all passed it (`engine/attack.mjs#awaitInterrupt` goes on when
    // every offered Master has).
    csPass: forViewer ? passFor(state, message) : null,
    // What the Attack may deal, to the side that decides: the defender's and
    // its Master's owners, and the GM. Before the damage only.
    damagePreview: result || !forViewer ? null : await damagePreviewFor(state, board),

    // The Injury decision rides with the result: the card's Injury line reads
    // it rather than the pipeline's pre-barrier flag (#110).
    result: result ? explainedFor({ ...result, injury: message?.getFlag?.("fgt", "injury") ?? null }, visibility) : null,

    // Ch. 38: what THIS viewer may see. A bystander gets the header and a count
    // of effects; the attacker gets their own contributing modifiers; the
    // defender gets what was applied to them; the GM gets everything.
    //
    // This is the part of closed-information play worth building. Ch. 38 assesses
    // shadow actors honestly and defers them -- Foundry cannot hide part of a
    // document, and the workaround doubles the document count for a failure mode
    // that leaks the wrong thing. The card covers most of the benefit at a
    // fraction of the cost, which Ch. 38 says outright.
    // For the viewer `fillAttackCard` names on each client, and for nobody on the
    // Stored Card. Built once and stored, as it was, it described whoever pressed
    // the button.
    visibility,

    // The roll log (Ch. 13), filtered per viewer -- a hidden Discover roll on a
    // card everyone can read would give away the Assassin's panel.
    rolls: visibleTo(state.rolls ?? [], forViewer ? {
      isGM: game.user.isGM,
      ownedActorIds: game.actors.filter((a) => a.isOwner).map((a) => a.id),
    } : {}).map((r) => (forViewer ? cloakRoll(r) : r)).map((r) => ({ ...r, lines: r.breakdownHidden ? [] : renderBreakdown(r) })),
  };
}

/**
 * A role's banner: its word and its icon (#364). The word depends on the
 * card: an attack's defender is attacked, a Skill's target is targeted.
 *
 * @param {string} role from `viewerRole`
 * @param {"attack"|"skill"} kind
 * @returns {{role: string, label: string, icon: string, mine: string, theirs: string}}
 */
function viewerOf(role, kind) {
  const ICONS = {
    attacker: "fa-solid fa-swords", defender: "fa-solid fa-shield-halved",
    observer: "fa-solid fa-eye", gm: "fa-solid fa-crown", both: "fa-solid fa-crown",
  };
  return {
    role,
    label: game.i18n.localize(`FGT.Role.${kind}.${role}`),
    icon: ICONS[role] ?? ICONS.observer,
    // Which side of the duel is the reader's: the attacker's (left), the
    // defender's (right), or both.
    mine: ["attacker", "both", "gm"].includes(role) ? "you" : (role === "defender" ? "dim" : ""),
    theirs: ["defender", "both", "gm"].includes(role) ? "you" : (role === "attacker" ? "dim" : ""),
  };
}

/**
 * An effect's picture and polarity diamond, for a card's row (#364).
 *
 * @param {string|null} effectId
 * @returns {string} HTML
 */
function effectArt(effectId) {
  const def = effectId ? EffectRegistry.get(effectId) : null;
  const polarity = polarityOf({}, def) ?? "status";
  const img = def?.img && !def.img.startsWith("icons/svg/") ? def.img : null;
  const pic = img
    ? `<img src="${foundry.utils.escapeHTML(img)}" alt="">`
    : '<i class="fa-solid fa-sparkles"></i>';
  return `<span class="fgt-fx fgt-fx--${polarity}"><span class="fgt-fx__pic">${pic}</span><span class="fgt-fx__pol"></span></span>`;
}

/** Messages this client has drawn at least once. */
const arrived = new Set();

/** Messages whose damage has already counted up on this client. */
const rolledUp = new Set();

/**
 * Count a fresh card's damage up from zero, once, on the client that sees it
 * land (#364). A card re-rendered later, or read back after a reload, is drawn
 * at its value. Nothing moves under reduced motion.
 *
 * @param {object} message
 * @param {HTMLElement} html
 */
function rollUpDamage(message, html) {
  // Nocturne's motion; the Classic look draws the total still (#364).
  if (isClassicUI()) return;
  const node = html.querySelector(".fgt-card__total");
  if (!node || rolledUp.has(message.id)) return;
  rolledUp.add(message.id);
  const to = Number(String(node.textContent).replace(/[^\d.-]/g, ""));
  const fresh = Date.now() - (message.timestamp ?? 0) < 8000;
  if (!fresh || !(to > 0) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 900);
    node.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 4))));
    if (k < 1) requestAnimationFrame(step);
  };
  node.textContent = "0";
  requestAnimationFrame(step);
}

/**
 * Whether the GM has switched closed-information play OFF.
 *
 * `closedInfo` was registered in `settings.mjs` and read by NOTHING: a GM who
 * turned it on or off changed no behaviour anywhere. It is the switch that
 * governs this whole file, so it is read here.
 *
 * @returns {boolean}
 */
function openTable() {
  return !warRule("closedInfo");
}

/**
 * The unit the ladder is currently waiting on.
 *
 * `OPERATIONS.advanceProcess` authorizes on this: a player may answer only the
 * rung their own unit is being asked about. Derived from the stored Process at
 * the moment of the click rather than baked into the button, because the card
 * a client is looking at may be a rung behind what the GM has already recorded.
 *
 * @param {object} message
 * @returns {string|null}
 */
function respondingUnitOf(message) {
  const raw = message.getFlag?.("fgt", "process");
  if (!raw) return null;
  return pendingPrompt(process.deserialize(raw))?.unitId ?? null;
}

/**
 * The damage explainer, with the other side's contributors taken out.
 *
 * The rows are built in full and then redacted, rather than built partially:
 * the running total has to be computed from every stage or it stops being a
 * running total, and a viewer who cannot check the arithmetic cannot tell a
 * redaction from a bug.
 *
 * @param {object} result a raw `DamageResult`
 * @param {object|null} visibility
 * @returns {object}
 */
function explainedFor(result, visibility) {
  const explained = explainDamage(result);
  return { ...explained, rows: redactBreakdown(explained.rows, visibility ?? {}) };
}

/**
 * Ch. 38's redaction for whoever is looking, with the effects split into the two
 * shapes a template can render.
 *
 * `cardFor` returns `effects` as an ARRAY for those entitled to read it and a
 * COUNT for everyone else. One field with two types cannot be rendered without
 * a helper Handlebars does not have, so it is split here.
 *
 * @param {object} state
 * @param {object} result
 * @returns {object}
 */
function viewerVisibility(state, result, effects = [], viewer = game.user) {
  const card = cardFor(visibilityInput(state, result, effects), {
    id: viewer?.id ?? null, isGM: Boolean(viewer?.isGM), openTable: openTable(),
  });
  const names = Array.isArray(card.effects) ? card.effects : [];
  return {
    ...card,
    effectNames: names,
    effectCount: Array.isArray(card.effects) ? names.length : (card.effects ?? 0),
    // Rows beside the names this viewer only counts: the attacker's own Atk Up
    // on a card the defender reads (#202).
    effectsHidden: Array.isArray(card.effects) ? (card.effectsHidden ?? 0) : 0,
  };
}

/**
 * What this client last drew of each card, shown while the next draw runs. Every
 * write to a message puts its Stored Card back on screen, and a Unit's owner read
 * "Observing" on their own card for 70 to 640 ms, several times an Attack (#388, live).
 */
const lastDrawn = new Map();

/**
 * Re-render an attack card for the client that is looking at it.
 *
 * Ch. 38's `filtered` mode. Until this existed the card was built ONCE, on
 * whichever client happened to resolve the attack, and that HTML was stored and
 * served to everyone — so the redaction described the wrong person, and the
 * template never read `visibility` at all, which meant the full damage
 * breakdown was public to the whole table.
 *
 * Everything needed is already on the message: the serialized Process and the
 * damage result. So the context is simply rebuilt here, where `game.user` is
 * the viewer rather than the author.
 *
 * Asynchronous, because rendering a template is. A card shows its Stored Card
 * until its first draw, and its last draw during the next; a client that fails to
 * re-render keeps what it shows, which is why the Stored Card is a stranger's view.
 *
 * @param {object} message
 * @param {HTMLElement} html
 */
function fillAttackCard(message, html) {
  if (message.getFlag?.("fgt", "kind") !== "attack") return;
  const raw = message.getFlag("fgt", "process");
  if (!raw) return;

  const state = process.deserialize(raw);
  // Closed to the attacker's side until the coin opens it (#381).
  if (unseenCard({
    state,
    result: message.getFlag("fgt", "result") ?? null,
    isGM: game.user.isGM,
    seesDefender: Boolean(game.actors.get(state.defenderId)?.testUserPermission?.(game.user, "OBSERVER")),
  })) {
    html.style.display = "none";
    return;
  }
  html.style.removeProperty("display");
  const stored = html.querySelector(".fgt-card");
  if (stored && lastDrawn.has(message.id)) stored.outerHTML = lastDrawn.get(message.id);
  const attacker = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attacker?.items.get(state.attack.abilityId) : null;

  cardContext({
    forViewer: true,
    state,
    attacker,
    ability,
    names: message.getFlag("fgt", "names") ?? null,
    targets: state.defenderId ? [{ unitId: state.defenderId }] : [],
    result: message.getFlag("fgt", "result") ?? null,
    message,
  })
    .then((context) => foundry.applications.handlebars.renderTemplate(
      uiTemplate("systems/fgt/templates/chat/attack.hbs"), context,
    ))
    .then((content) => {
      lastDrawn.set(message.id, content);
      const target = html.querySelector(".fgt-card");
      if (target) target.outerHTML = content;
      swapAbilityTags(html);
      rollUpDamage(message, html);
    })
    .catch((err) => console.error("FGT | Could not re-render an attack card:", err));
}

/**
 * The Command Spells this viewer could spend on this Process right now.
 *
 * Offered only at an interruptible rung, and only what `availableCommands`
 * says is actually usable — Ch. 33 requires an unusable command's option to
 * never appear, and the same argument covers cost.
 *
 * @param {object} state
 * @returns {Array<{id: string, name: string, cost: number, masterId: string, servantId: string}>}
 */
function offerableCommands(state) {
  const window = windowFor(state);
  if (!window) return [];

  // The Masters in THIS match, not every Master this viewer happens to own.
  //
  // The filter was ownership alone — and a GM owns every actor in the world, so
  // every Master ever created was offered its Command Spells on every card, and
  // spending one would have charged a Master standing outside the war. The
  // template's own comment beside it reads *"only shown when this viewer owns a
  // Master that can actually spend one"*, which took ownership for the whole
  // condition.
  //
  // Measured live (§46.4-BE): a two-faction board with two Masters on it offered
  // Command Spells from **eight**, six of them belonging to other setups
  // entirely — Drake's Master, Gogh's Master, an Archer's Master from a war that
  // was over.
  //
  // And each for the Servant it serves, on an attack that Servant is in
  // (ruled 2026-10-14, #204): every Faction 2 Master was offered Damage Block
  // on an attack on another Master's Servant (`engine/command-spells.mjs#processOffers`).
  return processOffers(state)
    .filter((o) => game.actors.get(o.masterId)?.isOwner)
    .map((o) => ({
      id: o.command.id,
      // A Master of several names the Servant on the button.
      name: o.several ? `${o.command.name} (${o.servantName})` : o.command.name,
      cost: o.command.cost,
      // A Master Essence's one use costs no Command Spell (#241).
      essence: Boolean(o.command.essence),
      masterId: o.masterId,
      servantId: o.servantId,
    }));
}

/**
 * The reaction options with Evade refused, for a Servant covering its Master.
 *
 * @param {Array<{event: string, label: string, hint: string|null}>} options
 * @param {boolean} covering
 * @returns {Array<object>}
 */
export function refuseCoveredEvade(options, covering) {
  if (!covering) return options;
  return options.map((o) => (o.event === "evade"
    ? { ...o, disabled: true, hint: game.i18n.localize("FGT.Cover.CannotEvade") }
    : o));
}

/**
 * The Attack's damage range, for a viewer on the side that decides: the
 * defender's owner, its Master's, or the GM. `null` for anyone else.
 *
 * @param {object} state
 * @param {object} board
 * @returns {Promise<string|null>}
 */
async function damagePreviewFor(state, board) {
  const defender = (board?.units ?? []).find((u) => u.id === state.defenderId);
  if (!defender) return null;
  const deciders = [state.defenderId, defender.masterId].filter(Boolean);
  if (!game.user.isGM && !deciders.some((id) => unitActor(id)?.isOwner)) return null;
  const { processDamagePreview } = await import("../../engine/attack.mjs");
  const range = processDamagePreview(state, board);
  return range ? formatRange(range) : null;
}

/**
 * The viewer's pass on a Command Spell window: the Masters it speaks for, or
 * `null` when there is nothing to pass or they have all passed this rung.
 *
 * @param {object} state
 * @param {object|null} message
 * @returns {{masterIds: string[], masterList: string, rung: string}|null}
 */
function passFor(state, message) {
  const masterIds = [...new Set(offerableCommands(state).map((o) => o.masterId))];
  if (masterIds.length === 0) return null;
  const rung = process.rungKey(state);
  const passes = message?.getFlag?.("fgt", "csPasses");
  if (passes?.rung === rung && masterIds.every((id) => (passes.masterIds ?? []).includes(id))) return null;
  return { masterIds, masterList: masterIds.join(","), rung };
}

/**
 * The buttons offered for a prompting state, with their cost shown.
 * @param {object} prompt
 * @param {object} [state] the Combat Process, for the reactions it refuses
 * @returns {Array<{event: string, label: string, hint: string|null}>}
 */
export function promptOptions(prompt, state = null) {
  if (prompt.kind === "reaction") {
    // `forbiddenReactions` has been written by the `retarget` interrupt since
    // Command Spells shipped and read by NOTHING, so a Servant pulled into an
    // attack it never saw coming could still Block and Evade it -- Ch. 23's own
    // rule, inert. Presence Concealment writes the same field.
    // What the rung has left is `rungOptions`'s, through the prompt that carries it (#244).
    const left = prompt.options ?? (state ? rungOptions(state) : ["nothing", "block", "evade"]);
    const rungs = [
      { event: "nothing", label: game.i18n.localize("FGT.Reaction.Nothing"), hint: null },
      { event: "block", label: game.i18n.localize("FGT.Reaction.Block"), hint: game.i18n.localize("FGT.Reaction.BlockHint") },
      { event: "evade", label: game.i18n.localize("FGT.Reaction.Evade"), hint: null },
      // Only on an Attack aimed at an object (#323 reading 4).
      { event: "luck", label: game.i18n.localize("FGT.Reaction.ObjectLuck"), hint: game.i18n.localize("FGT.Reaction.ObjectLuckHint") },
    ].filter((o) => left.includes(o.event));

    // The reaction ABILITIES, beside the three standing rungs. `pendingPrompt`
    // has assembled them onto the prompt since the Combat Process was written
    // -- *"Reaction abilities are offered BESIDE Block and Evade (Ch. 17). Medea's
    // Trofa is 'used when Attacked' and there is no other moment it can be
    // reached"* -- and this function rebuilt a fixed three and threw them away.
    //
    // So EVERY reaction ability in the game was unreachable from the card:
    // Trofa, both Eyes of the Mind, Rho Aias, Akhilleus Kosmos, Semiramis's
    // Scales, and Kiritsugu's Lethal Gunfire Suppression. The rule was
    // computed, carried in the state, and never drawn.
    //
    // The names arrive already qualified with their owner where that owner is
    // somebody else -- "Rho Aias (EMIYA)" -- because a third party's offer on
    // your rung is otherwise indistinguishable from your own.
    return [...rungs, ...(prompt.abilities ?? []).map((a) => ({
      event: `ability:${a.id}`,
      // fgt-name-ok: an ability's name, not a Unit's
      label: a.name,
      hint: null,
    }))];
  }
  if (prompt.kind === "acceptOrEscape") {
    return [
      { event: "accept", label: game.i18n.localize("FGT.Reaction.Accept"), hint: null },
      // After a failed automatic Evade only: Trofa was her Evade, and she may
      // still Block (#193 reading 9).
      ...(state?.blockAfterAutoEvade
        ? [{ event: "block", label: game.i18n.localize("FGT.Reaction.Block"), hint: game.i18n.localize("FGT.Reaction.BlockHint") }]
        : []),
    ];
  }
  // The counter is a free choice — it costs no budget, only the risk of
  // standing in range. Named explicitly rather than left to fall through to
  // the Luck Check branch below, which would have offered a "Contest" button
  // that emits an event this rung has no transition for.
  if (prompt.kind === "counter") {
    return [
      { event: "counter", label: game.i18n.localize("FGT.Reaction.Counter"), hint: game.i18n.localize("FGT.Reaction.CounterHint") },
      { event: "declined", label: game.i18n.localize("FGT.Reaction.Decline"), hint: null },
    ];
  }
  // Every Luck Check rung is optional, because Luck is spent whether or not
  // the check succeeds. The cost is shown on the button.
  // From the board, not the actor: a platform that shares its summoner's Luck
  // holds none of its own, and its stored 0 disabled this button (#169).
  const luck = luckOf(currentBoard(), game.actors.get(prompt.unitId)).value;
  return [
    {
      event: "contest",
      label: game.i18n.format("FGT.Reaction.Contest", { luck }),
      hint: luck < 1 ? game.i18n.localize("FGT.Reaction.NoLuck") : null,
      disabled: luck < 1,
    },
    { event: "declined", label: game.i18n.localize("FGT.Reaction.Decline"), hint: null },
  ];
}

/**
 * Wire the card's buttons. Registered once at `ready`.
 */
export function activateChatListeners() {
  // A Noble Phantasm's declaration stops the table (#364).
  Hooks.on("createChatMessage", (message) => {
    const np = message.getFlag?.("fgt", "np");
    if (message.getFlag?.("fgt", "kind") !== "attack" || !np) return;
    // Nocturne's alone: the Classic look has no cut-in (#364).
    if (isClassicUI()) return;
    // The truth for whoever may read it (#387 ruling 63), on this client alone.
    const truth = truthOfTag(np.name); // fgt-name-ok: the tag the flag holds
    playNoblePhantasmCutIn({ key: `${message.getFlag("fgt", "attackerId")}:${np.name}`, name: truth?.name ?? np.name, rank: truth?.rank ?? np.rank }); // fgt-name-ok: the tag the flag holds
  });
  Hooks.on("renderChatMessageHTML", (message, html) => {
    // A card that just arrived slides in, once; the log's own first draw and
    // every later update draw it still (#364).
    if (markSystemCard(html, { night: !isClassicUI() }) && !arrived.has(message.id) && Date.now() - (message.timestamp ?? 0) < 8000) {
      html.classList.add("fgt-fresh");
    }
    arrived.add(message.id);
    fillSkillEffects(message, html);
    fillAttackCard(message, html);
    swapAbilityTags(html);
    // A figure a viewer's Faction has not bought stays cloaked (CL.pool, #404).
    openCloaks(html);
    armCounterRung(message);
    bindCardEvents(message, html);
  });
  // Who holds what changed: the next card reads it afresh (#387).
  for (const hook of ["createItem", "deleteItem", "updateItem", "createActor", "deleteActor"]) Hooks.on(hook, forgetAbilityTruths);
  Hooks.on("updateActor", (actor, changes) => { if (changes?.ownership) forgetAbilityTruths(); });
}

/**
 * Arm the token's action bar when this viewer owns the unit being offered a
 * Counter, and disarm it once the rung has passed.
 *
 * Ch. 21's rung is the one moment a unit may attack outside its own turn, so the
 * player is not left to discover that the bar has quietly become meaningful:
 * the token is selected, the bar opens, and the abilities that could answer
 * glow.
 *
 * @param {object} message
 */
function armCounterRung(message) {
  if (message.getFlag?.("fgt", "kind") !== "attack") return;
  const raw = message.getFlag("fgt", "process");
  if (!raw) return;

  let state;
  try {
    state = process.deserialize(raw);
  } catch {
    return;
  }

  const prompt = pendingPrompt(state);
  const onRung = state.state === "counter" && prompt?.kind === "counter";
  const actor = state.defenderId ? game.actors.get(state.defenderId) : null;

  if (!onRung || !actor?.isOwner) {
    // Only OUR rung disarms the bar. A card for somebody else's exchange
    // rendering behind us must not cancel the prompt we are answering.
    if (ActionBar.instance?.counter?.messageId === message.id) ActionBar.disarmCounter();
    return;
  }

  const token = actor.getActiveTokens?.()[0] ?? null;
  if (!token) return;
  ActionBar.armForCounter({
    token,
    messageId: message.id,
    // Ch. 21: aim at the Servant, not the Master it is shielding.
    requiredTargetId: state.counterRedirectId ?? state.attackerId,
    excludeUnitIds: state.counterRedirectId ? [state.attackerId] : [],
  });
}

/**
 * Arm the bar for a Counter rung that was already open when the client loaded.
 *
 * `armCounterRung` rides `renderChatMessageHTML`, and on a page load the chat
 * renders BEFORE `ActionBar.attach()` has made an instance — so `armForCounter`
 * returned silently and a player who reloaded mid-exchange found the rung on
 * the card and no armed bar to answer it with. Found in play, by reloading.
 *
 * Called once from the `ready` hook, after the bar exists. Newest first, since
 * only one rung can be answered at a time and the newest is the live one.
 *
 * @returns {void}
 */
export function resumeCounterArming() {
  for (let i = game.messages.contents.length - 1; i >= 0; i -= 1) {
    const message = game.messages.contents[i];
    if (message.getFlag?.("fgt", "kind") !== "attack") continue;
    armCounterRung(message);
    if (ActionBar.instance?.counter) return;
  }
}

/**
 * Wire a card's buttons, by DELEGATION on the message element.
 *
 * These used to be bound directly, one listener per button, in the render hook.
 * That worked until `fillAttackCard` was added beside them: it re-renders the
 * card per viewer and assigns `outerHTML`, which REPLACES the element every
 * listener was attached to. The buttons kept their look and stopped working —
 * a defender could not Block, an attacker could not spend a Command Spell, and
 * the breakdown would not open. Nothing threw; the clicks simply went nowhere.
 *
 * Ordering the two correctly would fix it once. Delegation fixes it for good:
 * `html` is the message's own element and survives anything done to the card
 * inside it, so a listener here cannot be detached by a re-render that has not
 * been written yet.
 *
 * @param {object} message
 * @param {HTMLElement} html the rendered message element
 */
function bindCardEvents(message, html) {
  html.addEventListener("click", async (event) => {
    // `closest` exists on Element and not on Node; a click can land on a text
    // node inside a button.
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    if (!target) return;

    // A reaction, a Luck Check, a counter -- one step of the ladder.
    //
    // Routed to the GM through `advanceProcess`, NOT called locally. Advancing
    // a Process writes the Combat document's turn budget, and nobody but the
    // GM owns Combat -- so a player pressing Block got
    // *"User Player2 lacks permission to update Combat"* and the ladder stopped
    // dead. `OPERATIONS.advanceProcess` was written for exactly this, complete
    // with an authorizer that admits only the side the machine is waiting on,
    // and had no caller anywhere in the system.
    //
    // `FGTSocket.request` executes locally when the caller IS the active GM, so
    // this one path serves both and there is no branch to get wrong.
    const step = target.closest("[data-fgt-event]");
    if (step) {
      event.preventDefault();
      step.disabled = true;
      const { FGTSocket } = await import("../../net/socket.mjs");
      try {
        await FGTSocket.request("advanceProcess", {
          messageId: message.id,
          event: step.dataset.fgtEvent,
          // Whose decision this is, for the authorizer. Read off the Process
          // rather than assumed to be the defender: a Luck Check and a Command
          // Spell interrupt are answered by different people on the same card.
          respondingUnitId: respondingUnitOf(message),
        });
      } catch (err) {
        step.disabled = false;
        ui.notifications.error(err.message);
        throw err;
      }
      return;
    }

    // Command Spell interrupts. Routed through the socket to the GM, because a
    // spend changes a Process other clients are participating in (Ch. 23).
    const spell = target.closest("[data-fgt-cs]");
    if (spell) {
      event.preventDefault();
      spell.disabled = true;
      // Escape and Teleport Servant land where the player says, chosen BEFORE
      // the spend, so a cancelled pick costs nothing (#204 Q6). They were sent
      // with no destination at all, paid for, and moved nobody.
      const servantId = spell.dataset.fgtServant || null;
      const panels = teleportDestinations(spell.dataset.fgtMaster, spell.dataset.fgtCs, servantId);
      let destination = null;
      if (panels) {
        if (panels.length === 0) {
          spell.disabled = false;
          ui.notifications.warn(game.i18n.localize("FGT.CommandSpell.NoDestination"));
          return;
        }
        const { pickDestination } = await import("../canvas/targeting-layer.mjs");
        destination = await pickDestination({
          panels, label: spell.textContent.trim(), hint: game.i18n.localize("FGT.CommandSpell.ChooseLanding"),
        });
        if (!destination) {
          spell.disabled = false;
          return;
        }
      }
      const { FGTSocket } = await import("../../net/socket.mjs");
      try {
        const result = await FGTSocket.request("spendCommandSpell", {
          masterId: spell.dataset.fgtMaster,
          commandId: spell.dataset.fgtCs,
          messageId: message.id,
          context: { servantId, ...(destination ? { destination } : {}) },
        });
        if (!result?.ok) {
          spell.disabled = false;
          ui.notifications.warn(`FGT | Command Spell refused: ${result?.reason ?? "unknown"}`);
        }
      } catch (err) {
        spell.disabled = false;
        ui.notifications.error(err.message);
        throw err;
      }
      return;
    }

    // "No Command Spell": this player's Masters pass the rung, and the GM goes
    // on once every offered Master has. Written by the GM, who owns the card.
    const pass = target.closest("[data-fgt-cs-pass]");
    if (pass) {
      event.preventDefault();
      pass.disabled = true;
      const { FGTSocket } = await import("../../net/socket.mjs");
      try {
        await FGTSocket.request("passCommandSpells", {
          messageId: message.id,
          masterIds: (pass.dataset.fgtMasters ?? "").split(",").filter(Boolean),
          rung: pass.dataset.fgtRung,
        });
      } catch (err) {
        pass.disabled = false;
        ui.notifications.error(err.message);
        throw err;
      }
      return;
    }

    // The declaration window's Continue (#241): the attack goes ahead with
    // whatever was bought. On the GM, which holds the wait.
    const close = target.closest("[data-fgt-declaration-close]");
    if (close) {
      event.preventDefault();
      close.disabled = true;
      const { FGTSocket } = await import("../../net/socket.mjs");
      try {
        await FGTSocket.request("closeDeclarationWindow", { messageId: message.id });
      } catch (err) {
        close.disabled = false;
        ui.notifications.error(err.message);
        throw err;
      }
      return;
    }

    // Ch. 23's "decide for them". GM-only, and it applies the SAME default the
    // timeout would -- so a GM who is tired of waiting cannot accidentally make
    // a costlier choice than the clock would have.
    if (target.closest("[data-fgt-decide]")) {
      const { applyExpiry } = await import("../../engine/await-timeout.mjs");
      await applyExpiry(message);
      return;
    }

    const toggle = target.closest("[data-fgt-toggle]");
    if (toggle) {
      const panel = html.querySelector(`#${toggle.dataset.fgtToggle}`);
      if (panel) panel.hidden = !panel.hidden;
    }
  });
}

export { PROMPTS };

/**
 * The shape `cardFor` wants, from a Process state and its damage result.
 *
 * Attribution by **side** is what makes the redaction work: a row nobody
 * claimed is a fact about the board -- a facing bonus, terrain -- and stays
 * visible to both, because dropping it would leave a breakdown whose numbers do
 * not add up.
 *
 * @param {object} state
 * @param {object} result
 * @returns {object}
 */
function visibilityInput(state, result, effects = []) {
  const attacker = game.actors.get(state.attackerId);
  const defender = game.actors.get(state.defenderId);
  // Whose each row is, where it says (#202): a third Unit's line is shown to
  // its own controllers, as on a Skill card.
  const effectOwners = (effects ?? []).map((e) => (typeof e === "object" ? e?.unitId ?? null : null));
  const others = Object.fromEntries(effectOwners.filter((id) => id && id !== state.attackerId && id !== state.defenderId)
    .map((id) => [id, ownersOf(game.actors.get(id))]));

  return {
    summary: `${attacker ? shownName(attacker) : "?"} → ${defender ? shownName(defender) : "?"}`,
    attackerId: state.attackerId,
    defenderIds: [state.defenderId],
    attackerControllers: ownersOf(attacker),
    defenderControllers: ownersOf(defender),
    controllersByActor: {
      ...others,
      [state.attackerId]: ownersOf(attacker),
      [state.defenderId]: ownersOf(defender),
    },
    total: result.total ?? 0,
    breakdown: (result.rows ?? result.contributions ?? []).map((row) => ({
      source: row.source ?? row.label ?? "",
      value: row.value ?? row.amount ?? 0,
      side: sideOf(row, state),
    })),
    // What the riders did, from the message's `effects` flag, which the engine
    // writes after the damage (#185). This read `state.appliedEffects`, which
    // nothing has ever written, so no attack card listed an effect: Maria's
    // Instakill and its roll were in the flags and nowhere on the card.
    effects: (effects ?? []).map(effectLine),
    effectOwners,
    rolls: state.rolls ?? [],
  };
}

/**
 * Which side a breakdown row belongs to.
 *
 * Unattributed rows return `null` rather than guessing a side: guessing wrong
 * either leaks a source or removes a number the viewer needs to check the sum,
 * and `null` is the only answer that does neither.
 *
 * @param {object} row
 * @param {object} state
 * @returns {string|null}
 */
function sideOf(row, state) {
  const owner = row.sourceUnitId ?? row.unitId ?? null;
  if (!owner) return null;
  if (owner === state.attackerId) return "attacker";
  if (owner === state.defenderId) return "defender";
  return null;
}

/** @param {object} actor @returns {string[]} */
function ownersOf(actor) {
  if (!actor) return [];
  return game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

/**
 * Fill a Skill card's effect list for whoever is looking at it.
 *
 * Ch. 38's `filtered` mode: one message, rendered differently per client. The
 * card ships with a count and the hook replaces it with the rows this viewer
 * is entitled to read — everything for the caster's controller and the GM, and
 * for everyone else only what landed on a unit they control.
 *
 * A Servant buffing itself is the case that prompted this: the card listed
 * every buff to the whole table, which tells an opponent exactly what that
 * Servant just gained.
 *
 * @param {object} message
 * @param {HTMLElement} html
 */
function fillSkillEffects(message, html) {
  const flags = message.getFlag?.("fgt", "kind") === "skill" ? message.flags.fgt : null;
  const list = html.querySelector("[data-fgt-effects]");
  if (!flags || !list) return;

  const { rows: seen, hidden } = skillEffectsFor(flags.rows, {
    id: game.user.id,
    isGM: game.user.isGM,
    openTable: openTable(),
    casterControllers: flags.casterControllers ?? [],
  });

  // The caster's truth for those who read it (#387 ruling 63): the tag in the
  // title is swapped by the hook, and its name and Rank are written here.
  const caster = flags.casterId ? game.actors.get(flags.casterId) : null;
  if (readsTruthOf(caster)) {
    const named = html.querySelector(".fgt-card__caster");
    if (named) named.textContent = caster.name; // fgt-name-ok: this viewer reads its truth
    const rank = caster.items?.get(flags.abilityId)?.system?.rank ?? null;
    const title = html.querySelector(".fgt-card__title");
    if (title && rank && !title.querySelector(".fgt-card__rank")) title.insertAdjacentHTML("beforeend", ` <span class="fgt-card__rank">${foundry.utils.escapeHTML(String(rank))}</span>`);
  }

  // Whose card this is, to the reader (#364): the caster's controllers, one a
  // row landed on, or neither.
  const card = html.querySelector(".fgt-card");
  if (card && !card.querySelector(".fgt-role")) {
    const viewer = viewerOf(viewerRole({
      isGM: game.user.isGM,
      ownsActor: (flags.casterControllers ?? []).includes(game.user.id),
      ownsTarget: (flags.rows ?? []).some((r) => (r.controllers ?? []).includes(game.user.id)),
    }), "skill");
    card.dataset.role = viewer.role;
    card.insertAdjacentHTML("afterbegin",
      `<div class="fgt-role"><i class="${viewer.icon}"></i><span>${foundry.utils.escapeHTML(viewer.label)}</span></div>`);
  }

  // Each row with its effect's picture and polarity diamond.
  const rows = seen.map((r) => `<li>${effectArt(r.effectId)}<span>${foundry.utils.escapeHTML(r.name)}</span></li>`);
  // A count rather than silence: "something happened" is public, "what" is not.
  if (hidden > 0) {
    rows.push(
      `<li class="fgt-card__hidden">${game.i18n.format("FGT.Skill.HiddenEffects", { n: hidden })}</li>`,
    );
  }
  list.innerHTML = rows.join("");
}
