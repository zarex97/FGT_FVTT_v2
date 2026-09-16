/**
 * @file Conjuring summons — the `summon` phase.
 * @see docs/15-abilities.md §15.2, docs/36-case-remaining.md
 *
 * Layer 3. Medea's Dragon Tooth Warriors is the reference case and the most
 * structurally demanding summon in the set: **two nested rolls**, one deciding
 * how many appear and one deciding what each one is, and a cooldown that
 * depends on the first roll's result — so the cost of the Skill is not known
 * until after it has resolved.
 *
 * That last property is why `summonPhase` returns the count: the caller sets
 * the cooldown afterwards, rather than the phase pretending to know it.
 *
 * Placement is *"within a 5x5 panel area around Medea"*, and the panels are
 * picked from the free ones — a summon that landed on an occupied panel would
 * either overlap a Unit or silently fail to appear, and the second is worse
 * because nothing on screen says a Warrior is missing.
 */

import { chebyshevDisc } from "../domain/geometry.mjs";
import { currentBoard } from "./board.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { orthogonalPanels, SHEET_ORDER } from "../rules/targeting/orthogonal.mjs";

/**
 * Run a `summon` phase.
 *
 * @param {object} phase
 * @param {object} summoner the conjuring actor
 * @param {object} [options]
 * @param {(spec: object) => Promise<string|null>} [options.choose] resolves a
 *   "your choice" entry; without one the choice falls back to the first type
 * @returns {Promise<{count: number, created: object[], rolls: object[]}>}
 */
export async function summonPhase(phase, summoner, { choose = null } = {}) {
  const spec = phase?.spec ?? {};
  const scene = canvas.scene;
  if (!scene) return { count: 0, created: [], rolls: [] };

  /** @type {object[]} */
  const rolls = [];

  /** @type {string[]} */
  let contentIds = [];

  if (Array.isArray(spec.contentIds) && spec.contentIds.length > 0) {
    // A FIXED ROSTER: named summons, all of them, in a stated order.
    //
    // Every summon in the corpus before Raikou was rolled (Medea's 1d6 Warriors
    // of 1d4 types, Bašmu's Dragon Wing Warriors) or singular (the Sphinxes,
    // the Kagome Spirits, one per enemy). Tenmōkaikai is the first that names
    // its squad: *"Raikou summons four extra clones of herself"*, and the four
    // differ in Range, element and rider -- so there is nothing to roll and the
    // ORDER matters, because it pairs with the placement's own order.
    //
    // Without this branch `countRoll ?? "1"` rolled 1, `typeRoll ?? "1"` rolled
    // 1, `spec.types[1]` was undefined, and the Noble Phantasm reported
    // "0 summoned" -- which is what it did, measured live.
    contentIds = [...spec.contentIds];
  } else {
    const countRoll = await new Roll(spec.countRoll ?? "1").evaluate();
    rolls.push({ id: "summonCount", formula: countRoll.formula, total: countRoll.total });
    const count = Math.max(0, countRoll.total);
    if (count === 0) return { count: 0, created: [], rolls };

    // Types first, so a "your choice" entry can be answered before anything is
    // placed -- a half-built squad on the board while a dialog waits is a state
    // no rule describes.
    for (let k = 0; k < count; k++) {
      const typeRoll = await new Roll(spec.typeRoll ?? "1").evaluate();
      rolls.push({ id: `summonType:${k}`, formula: typeRoll.formula, total: typeRoll.total });

      const chosen = (spec.choiceOn ?? []).includes(typeRoll.total)
        ? await resolveChoice(spec, choose)
        : spec.types?.[typeRoll.total] ?? spec.types?.[String(typeRoll.total)] ?? null;

      if (chosen) contentIds.push(chosen);
      else console.warn(`FGT | Summon type ${typeRoll.total} has no entry; that Warrior did not appear.`);
    }
  }

  const panels = freePanels(summoner, spec.placement ?? {}, contentIds.length);

  // A summon tied to the platform its summoner is standing on.
  //
  // > *"Bašmu cannot leave the HGoB. If HGoB is removed from the field while
  // > Bašmu is summoned, it disappears."*
  //
  // `boundToPlatformId` is a Foundry DOCUMENT id, so it can only be written
  // here — content cannot name one. `engine/scene-levels.mjs` dismisses bound
  // summons when a platform is torn down, and with the field never stamped it
  // matched nobody: a destroyed Hanging Gardens left its Bašmu on the board.
  // Found live.
  const stamps = {};
  if (spec.boundToPlatform) {
    const platformId = currentBoard().units.find((u) => u.id === summoner.id)?.platformId ?? null;
    if (platformId) stamps.boundToPlatformId = platformId;
  }

  const created = await placeSummons(contentIds, panels, summoner, scene, spec, stamps);

  return { count: created.length, created, rolls };
}

/**
 * How many ticks a count-scaled cooldown comes to.
 *
 * *"Cooldown: (Number of Dragon Tooth Warriors x ⅔◈)"* — the only cooldown in
 * the reference set whose length is decided by the roll that just happened.
 *
 * @param {object} cooldown the ability's `cooldown`, as authored
 * @param {number} count
 * @param {number} turnsPerRound
 * @returns {number} ticks
 */
export function scaledCooldown(cooldown, count, turnsPerRound) {
  if (!cooldown?.perUnit) return 0;

  // `⅔◈` is two thirds of a Round, which is a whole number of turns only
  // because a Round is three turns. Rounded UP: a cooldown that came out
  // shorter than the text says is a Skill used more often than it should be.
  const perUnit = fractionOf(cooldown.perUnit) * turnsPerRound;
  return Math.ceil(perUnit * count);
}

/* -------------------------------------------------------------------------- */

/**
 * The free panels a summon may appear on.
 *
 * Occupied panels are excluded rather than overlapped: two Units on one panel
 * is not a state this system has rules for, and a Warrior that quietly failed
 * to appear is worse than one that appears further out.
 *
 * @param {object} summoner
 * @param {object} placement
 * @param {number} needed
 * @returns {Array<{i: number, j: number}>}
 */
export function freePanels(summoner, placement, needed) {
  const board = currentBoard();
  const self = board.units.find((u) => u.id === summoner.id);
  const origin = self?.panel;
  if (!origin) return [];

  // A 5x5 "around" the caster is a Chebyshev radius of 2.
  const radius = Math.floor((placement.size ?? 5) / 2);
  const level = self.level ?? 0;
  const occupied = new Set(
    board.units
      // A Unit that shares panels does not make a panel unavailable -- that is
      // what sharing means, and a summon refused the only free square because
      // Piedra Del Sol was standing on it would be the same defect from the
      // other side.
      .filter((u) => !u.sharesPanel)
      // Nor does a PLATFORM or a STRUCTURE, for the reason
      // `rules/movement.mjs#canStopOn` gives in the same words: they are stood
      // on, not blocked by. A platform's footprint covers every panel of its
      // own deck, so this filter is what decides whether anything can be
      // summoned aboard one at all. Found live the moment the Hanging Gardens
      // first occupied its own footprint correctly: Bašmu, whose whole placement
      // is *"on a panel directly next to her"* while she stands in the Throne
      // Room, reported "0 summoned" with all nine candidate panels taken by the
      // garden underneath her.
      .filter((u) => u.kind !== "platform" && u.kind !== "structure")
      // Only what is on the same level. A summon appears beside its summoner,
      // and a Unit on the ground twenty feet below is not beside anybody.
      .filter((u) => (u.level ?? 0) === level)
      .flatMap((u) => (u.panels ?? [u.panel]).filter(Boolean).map((p) => `${p.i},${p.j}`)),
  );

  // *"...on the panels in front of her, behind her, and her left and right."*
  //
  // An ORDERED formation rather than a disc, and the distinction is the clause:
  // Raikou's four copies differ in Range, element and rider, so which one is in
  // front is part of what the Noble Phantasm does. `chebyshevDisc` returns
  // panels in its own order and would scatter them.
  //
  // Returns `null` for a direction with no free panel on its axis -- kept in
  // place rather than filtered out, so `placeSummons` can name the copy that
  // had nowhere to go instead of reporting a count.
  if (placement.shape === "orthogonal") {
    return orthogonalPanels(origin, self.facing ?? "n", placement.order ?? SHEET_ORDER, {
      bounds: board.bounds ?? null,
      occupied,
      maxDistance: placement.maxDistance ?? 6,
    });
  }

  return chebyshevDisc(origin, radius, board.bounds ?? null)
    .filter((p) => !occupied.has(`${p.i},${p.j}`))
    .slice(0, needed);
}

/**
 * Create the tokens.
 *
 * @param {string[]} contentIds
 * @param {object[]} panels
 * @param {object} summoner
 * @param {object} scene
 * @param {object} spec
 * @returns {Promise<object[]>}
 */
export async function placeSummons(contentIds, panels, summoner, scene, spec, stamps = {}) {
  // Where the summoner is standing, for a summon that belongs beside it rather
  // than on the ground beneath it. Read once: every summon in one call lands on
  // the same level.
  const summonerToken = summoner.getActiveTokens?.()[0]?.document ?? null;
  const summonerLevel = stamps.boundToPlatformId ? summonerToken?.level ?? null : null;
  const summonerElevation = summonerToken?.elevation ?? 0;

  /** @type {object[]} */
  const created = [];

  for (const [index, contentId] of contentIds.entries()) {
    const panel = panels[index];
    if (!panel) {
      // An ORDERED placement leaves a hole rather than running out: Raikou's
      // copy with a wall in front of it gets `null` at its own index while its
      // three sisters appear. So this CONTINUES rather than breaking, and names
      // the one that could not appear -- "Raikou (Urabe) had nowhere to appear"
      // is a rule a player can act on; "3 of 4 summoned" is not.
      if (panels.length === contentIds.length) {
        const named = await fromPacks(contentId);
        ui.notifications?.warn(game.i18n.format("FGT.Summon.NoPanel", {
          name: named?.name ?? contentId,
        }));
        continue;
      }
      // Ran out of room. Reported rather than dropped: a player who rolled six
      // and got four needs to know which rule took the other two.
      ui.notifications?.warn(game.i18n.format("FGT.Summon.NoRoom", { count: contentIds.length - index }));
      break;
    }

    const source = await fromPacks(contentId);
    if (!source) {
      console.warn(`FGT | Unknown summon "${contentId}".`);
      continue;
    }

    const data = source.toObject();
    data.name = `${source.name}`;
    data.system.summonerId = summoner.id;
    data.system.factionId = summoner.system?.factionId ?? null;
    // Both clauses from the sheet, carried on the summon rather than special-
    // cased for its summoner: "do not count towards the number of Units that
    // Move and/or Attack", and "can only Move/Attack once per Turn".
    data.system.countsTowardBudget = spec.countsTowardBudget ?? data.system.countsTowardBudget;
    data.system.actsOncePerTurn = spec.actsOncePerTurn ?? data.system.actsOncePerTurn;

    // Stats stated RELATIVE to the summoner. The Kagome Spirits are the first
    // in the corpus: *"Agility: Pale Rider's plus 2"*, *"Luck: Same as Pale
    // Rider's"* -- which cannot be written as numbers on a sheet, because they
    // are not numbers. Resolved here, from the summoner's LIVE values, because
    // that is the only moment they are both known and fixed.
    for (const [stat, rule] of Object.entries(data.system.inherit ?? {})) {
      if (rule?.from !== "summoner") continue;
      if (stat === "passives") continue;   // not a stat -- handled below

      const raw = summoner.system?.[stat];
      // A RESOURCE (`{value, max}`) or a plain number. `health`, `agility` and
      // `luck` are resources; `mov` is a bare integer, and writing `{value,
      // max}` into it would hand the schema an object where it wants a number
      // and silently leave the summon on MOV 0.
      const scalar = typeof raw === "number";
      const base = scalar ? raw : (raw?.max ?? raw?.value ?? 0);

      // A FACTOR beside the existing delta. Raikou's copies are *"the same Max
      // Agility, Max Luck and MOV as Raikou, but Max Health is halved"* -- 1250
      // to 625. Read off `.max`, not `.value`, so a wounded Raikou still spawns
      // copies at half of her MAXIMUM: the sheet halves her Max Health and says
      // nothing about her wounds.
      //
      // Rounded DOWN, and applied before the delta, so `{factor, delta}`
      // together read as "half, then plus two" rather than the reverse.
      const scaled = Math.floor(base * (rule.factor ?? 1));
      const value = Math.max(0, scaled + (rule.delta ?? 0));

      data.system[stat] = scalar ? value : { value, max: value };
    }

    // *"(Passive effects are still present.)"* Raikou's copies carry HER
    // passive rule elements -- Divinity's +30, both Mystery Slayer passives,
    // Magic Resistance, Mana Burst's Shock immunity and Lightning halving --
    // without carrying her Skills.
    //
    // Copied as ABILITY DOCUMENTS with their Actives stripped, not as loose
    // rule elements onto the summon's own `passiveRules`. The reason is
    // `rank`: a unit-level `passiveRules` block is collected as ONE
    // pseudo-ability with `rank: null` (`rules/snapshot.mjs#contributionsOf`),
    // and every table-driven magnitude Raikou owns is resolved against its
    // OWNING ability's rank -- Divinity C, Magic Resistance D. Flattened, her
    // Divinity's `table: divinity` would have looked up a null rank and handed
    // the copies the table's fallback instead of +30.
    //
    // It also means the copy's sheet SHOWS what it inherited, which is what
    // makes the clause checkable on a live board rather than only in a test.
    //
    // `excludeAbilities` is the sheet's own list: *"unable to use Mad
    // Enhancement, Riding and the Active effects of Raikou's Skills"*. The
    // Actives go by construction -- `activeRules`, `phases`, `timing` and the
    // cooldown are dropped from every copy -- and the two named Skills have to
    // be named, because Riding's grants live in `passiveRules` and would
    // otherwise hand a copy Double Move and a Riding Attack.
    const passiveSpec = data.system.inherit?.passives;
    if (passiveSpec?.from === "summoner") {
      const exclude = new Set(passiveSpec.excludeAbilities ?? []);
      data.items = [
        ...(data.items ?? []),
        ...[...(summoner.items ?? [])]
          .filter((i) => i.type === "ability")
          .filter((i) => !exclude.has(i.system?.contentId ?? i.id))
          .filter((i) => (i.system?.passiveRules ?? []).length > 0)
          .map((i) => {
            const copy = i.toObject();
            copy.system = {
              ...copy.system,
              activeRules: [],
              phases: [],
              timing: null,
              cooldown: null,
              isMode: false,
              active: false,
              // It is a passive on the copy whatever it was on her, so the
              // sheet does not offer a button the grant would refuse anyway.
              passive: true,
              inheritedFrom: summoner.id,
            };
            delete copy._id;
            return copy;
          }),
      ];
    }

    // Whatever the caller needs stamped on every summon it is placing --
    // `pursuitTargetId` and `boundToFieldId` for a Kagome Spirit. Foundry
    // document ids, so they can only be written here and never authored.
    const { rememberedStats, ...plain } = stamps;
    Object.assign(data.system, plain);

    // *"When the Jabberwock is summoned, it disappears after 3◈ Turns."*
    //
    // Resolved to an ABSOLUTE tick here, at the one moment both halves are
    // known: the world's clock, and the stay the spec states. A countdown would
    // need a hook that can fail to fire, which is the reason `data/regions.mjs`
    // gives twice for storing its own durations the same way.
    //
    // `expiresAt` has been on this schema since it was written with nothing
    // writing it; `rules/summons.mjs#expiredSummonIds` is the reader, added in
    // the same commit.
    if (spec.duration) {
      const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
      const now = game.combat?.system?.globalTurn ?? 0;
      data.system.expiresAt = now + resolveTicks(parseTick(spec.duration), { turnsPerRound });
    }

    // *"…but with the same Stats as when they disappeared."* Applied AFTER the
    // `inherit` pass above, because a remembered figure is what the Unit had
    // when it left and must not be recomputed from its summoner: a Sphinx that
    // came back at its inherited Luck would also come back at full Health.
    //
    // Only the stats that were actually recorded, and only when they hold a
    // number -- a partial record must not blank the rest of the sheet.
    for (const [stat, value] of Object.entries(rememberedStats ?? {})) {
      if (stat === "suppressedScopes") continue;   // not a stat -- below
      if (typeof value?.value !== "number") continue;
      data.system[stat] = { value: value.value, max: value.max ?? value.value };
    }

    // ...and what was PERMANENTLY taken from it before it left.
    //
    // > *"…the 'Whenever the Jabberwock receives damage from Servants…' effect
    // > is permanently removed from the Jabberwock."*
    //
    // The subtle half of the Vorpal Blade, and the reason the removal is stored
    // on the SUMMONER rather than on the summon: a suppression that lived on
    // the monster would die with it, and the monster comes back *"with the same
    // Stats as when it disappeared"*. Without this line the Blade's sacrifice
    // is undone by the next summoning, which is exactly the interaction the
    // sheet spends a sentence on.
    if (Array.isArray(rememberedStats?.suppressedScopes)) {
      data.system.suppressedScopes = [...rememberedStats.suppressedScopes];
    }

    const actor = await Actor.create(data);
    const token = await actor.getTokenDocument({
      x: panel.j * scene.grid.size,
      y: panel.i * scene.grid.size,
      // A summon bound to a platform is summoned ONTO it. Bašmu is placed *"on
      // a panel directly next to her"* while she is aboard the Hanging Gardens,
      // and *"cannot leave the HGoB"* -- so the ground level is the one place
      // it must not appear. Set at creation rather than moved afterwards: a
      // token created on the ground and then displaced upward is two writes and
      // a frame of it standing under the garden.
      ...(summonerLevel ? { level: summonerLevel, elevation: summonerElevation } : {}),
    });
    await scene.createEmbeddedDocuments("Token", [token.toObject()]);
    created.push(actor);
  }
  return created;
}

/**
 * @param {object} spec
 * @param {Function|null} choose
 * @returns {Promise<string|null>}
 */
async function resolveChoice(spec, choose) {
  const from = spec.choiceFrom ?? [];
  if (from.length === 0) return null;
  if (!choose) return from[0];

  const picked = await choose(spec);
  return picked ?? from[0];
}

/**
 * `⅓`, `⅔` and plain numbers, as a fraction of a Round.
 * @param {string} raw
 * @returns {number}
 */
function fractionOf(raw) {
  const text = String(raw).replace("◈", "").trim();
  if (text.includes("⅔")) return 2 / 3;
  if (text.includes("⅓")) return 1 / 3;
  if (text.includes("½")) return 1 / 2;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A summon statblock from the packs, by content id.
 * @param {string} contentId
 * @returns {Promise<object|null>}
 */
async function fromPacks(contentId) {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === contentId);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}
