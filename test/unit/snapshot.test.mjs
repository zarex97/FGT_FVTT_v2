/**
 * @file Projecting an actor's position.
 * @see module/rules/snapshot.mjs
 *
 * A token's `x`/`y` are **pixels**. Reading them as grid offsets put two
 * adjacent tokens a hundred panels apart and made every attack report its
 * target out of range, so the projection is pinned here.
 */

import { describe, it, expect } from "vitest";
import { snapshotUnit, snapshotBoard, turnStateAt, contributionsOf } from "../../module/rules/snapshot.mjs";
import { remainingMovement, segmentCheck } from "../../module/rules/movement.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";

/** A minimal actor. */
function actor(over = {}) {
  return {
    id: "a", uuid: "Actor.a", name: "Heracles", type: "servant",
    system: { factionId: "red", range: { panels: 1, targets: 1 }, ...(over.system ?? {}) },
    items: over.items ?? [],
    effects: over.effects ?? [],
    ...over,
  };
}

/** A token document at a pixel position, with the v14 offset API. */
function token({ x, y, offsets, elevation = 0 }) {
  return {
    x, y, elevation,
    getOccupiedGridSpaceOffsets: () => offsets ?? [],
  };
}

describe("panel projection", () => {
  it("uses the token's grid offsets, not its pixels", () => {
    const doc = token({ x: 1500, y: 1600, offsets: [{ i: 16, j: 15, k: 0 }] });
    expect(snapshotUnit(actor(), { token: doc }).panel).toEqual({ i: 16, j: 15, k: 0 });
  });

  it("puts two adjacent tokens one panel apart", () => {
    const left = snapshotUnit(actor(), { token: token({ x: 500, y: 600, offsets: [{ i: 6, j: 5 }] }) });
    const right = snapshotUnit(actor(), { token: token({ x: 600, y: 600, offsets: [{ i: 6, j: 6 }] }) });
    expect(Math.abs(left.panel.j - right.panel.j)).toBe(1);
    expect(left.panel.i).toBe(right.panel.i);
  });

  it("prefers an explicitly resolved panel over anything on the token", () => {
    const doc = token({ x: 1500, y: 1600, offsets: [{ i: 99, j: 99 }] });
    expect(snapshotUnit(actor(), { token: doc, panel: { i: 3, j: 4 } }).panel).toEqual({ i: 3, j: 4 });
  });

  it("carries a multi-panel unit's whole footprint", () => {
    const doc = token({ x: 0, y: 0, offsets: [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }] });
    const unit = snapshotUnit(actor(), { token: doc });
    expect(unit.panels).toHaveLength(4);
    expect(unit.panel).toEqual({ i: 0, j: 0, k: undefined });
  });

  it("keeps a single-panel unit's `panels` as null rather than a one-item list", () => {
    const doc = token({ x: 0, y: 0, offsets: [{ i: 2, j: 2 }] });
    expect(snapshotUnit(actor(), { token: doc }).panels).toBeNull();
  });

  it("takes the level from the offset's k, not from elevation in feet", () => {
    const doc = token({ x: 0, y: 0, elevation: 20, offsets: [{ i: 1, j: 1, k: 2 }] });
    expect(snapshotUnit(actor(), { token: doc }).level).toBe(2);
  });

  it("falls back to the origin with no token, which is why callers resolve first", () => {
    expect(snapshotUnit(actor()).panel).toEqual({ i: 0, j: 0 });
  });

  it("falls back to the origin when the scene is gridless and returns no offsets", () => {
    expect(snapshotUnit(actor(), { token: token({ x: 640, y: 480, offsets: [] }) }).panel)
      .toEqual({ i: 0, j: 0 });
  });

  // The regression itself: pixels must never be read as offsets.
  it("never treats a pixel coordinate as a panel index", () => {
    const doc = token({ x: 1500, y: 1600, offsets: [{ i: 16, j: 15 }] });
    const unit = snapshotUnit(actor(), { token: doc });
    expect(unit.panel.i).not.toBe(1600);
    expect(unit.panel.j).not.toBe(1500);
  });
});

describe("snapshotBoard", () => {
  it("uses a pre-resolved snapshot when the caller supplies one", () => {
    const resolved = { id: "a", panel: { i: 7, j: 7 } };
    const board = snapshotBoard({ scene: null, actors: [{ actor: actor(), snapshot: resolved }] });
    expect(board.units[0]).toBe(resolved);
  });

  it("projects an actor itself when no snapshot is supplied", () => {
    const doc = token({ x: 0, y: 0, offsets: [{ i: 4, j: 5 }] });
    const board = snapshotBoard({ scene: null, actors: [{ actor: actor(), token: doc }] });
    expect(board.units[0].panel).toEqual({ i: 4, j: 5, k: undefined });
  });

  it("carries the alliance map through", () => {
    const board = snapshotBoard({
      scene: null, actors: [], settings: { alliances: { red: ["red", "blue"] } },
    });
    expect(board.alliances.red).toEqual(["red", "blue"]);
  });

  it("carries settings.zones through — the Home Base map, not a nonexistent scene.zones", () => {
    // `homeBaseZonesOf` (engine/board.mjs) computes this into `currentBoard`'s
    // `settings.zones`; this function used to read `scene?.zones` instead --
    // a property no Scene document has -- so `board.zones` was always `{}`
    // regardless of what was passed in. Found live: a Home Base region built
    // for Semiramis's Hanging Gardens never made `self:inHomeBase` true for
    // anyone standing in it, for any Servant, ever.
    const board = snapshotBoard({
      scene: null, actors: [],
      settings: { zones: { r1: { faction: "faction-1", panels: [{ i: 5, j: 5 }] } } },
    });
    expect(board.zones).toEqual({ r1: { faction: "faction-1", panels: [{ i: 5, j: 5 }] } });
  });
});

describe("parameter grants reach the Rank (Ch. 05 §5.6)", () => {
  const withParams = (over = {}) => actor({
    ...over,
    system: {
      parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
      baseAttack: { str: 100, mag: 0 },
      ...(over.system ?? {}),
    },
  });

  it("a High Rank Master's grant shifts the Rank a single-unit snapshot reports", () => {
    const u = snapshotUnit(withParams({ system: { grantedSteps: { str: 1, end: 0, agi: 0, mag: 0, luc: 0 } } }));
    expect(u.parameters.str.toString()).toBe("C+");
    // Untouched parameters are not disturbed by an unrelated grant.
    expect(u.parameters.end.toString()).toBe("C");
  });

  it("does not disturb Base Attack — that adjustment is already baked in at summon", () => {
    const u = snapshotUnit(withParams({ system: { grantedSteps: { str: 1, end: 0, agi: 0, mag: 0, luc: 0 } } }));
    expect(u.baseAttack).toEqual({ str: 100, mag: 0 });
  });

  it("leaves parameters alone when nothing was granted", () => {
    const u = snapshotUnit(withParams());
    expect(u.parameters.str.toString()).toBe("C");
  });

  it("a negative grant steps the Rank down", () => {
    const u = snapshotUnit(withParams({ system: { grantedSteps: { str: 0, end: -1, agi: 0, mag: 0, luc: 0 } } }));
    expect(u.parameters.end.toString()).toBe("C-");
  });

  it("the war Region's bonus shifts every Rank for a matching Servant, live at board build", () => {
    const board = snapshotBoard({
      scene: null,
      actors: [{ actor: withParams({ system: { region: ["greece"] } }) }],
      settings: { warRegion: "greece" },
    });
    const u = board.units[0];
    expect(u.parameters.str.toString()).toBe("C+");
    expect(u.parameters.mag.toString()).toBe("C+");
  });

  it("the Region's bonus also moves Base Attack by 10 per STR/MAG step, live", () => {
    const board = snapshotBoard({
      scene: null,
      actors: [{ actor: withParams({ system: { region: ["greece"] } }) }],
      settings: { warRegion: "greece" },
    });
    expect(board.units[0].baseAttack).toEqual({ str: 110, mag: 10 });
  });

  it("does not grant a Region bonus to a Servant from a different Region", () => {
    const board = snapshotBoard({
      scene: null,
      actors: [{ actor: withParams({ system: { region: ["japan"] } }) }],
      settings: { warRegion: "greece" },
    });
    expect(board.units[0].parameters.str.toString()).toBe("C");
    expect(board.units[0].baseAttack).toEqual({ str: 100, mag: 0 });
  });

  it("a Master grant and a matching Region bonus stack", () => {
    const board = snapshotBoard({
      scene: null,
      actors: [{
        actor: withParams({
          system: { region: ["greece"], grantedSteps: { str: 1, end: 0, agi: 0, mag: 0, luc: 0 } },
        }),
      }],
      settings: { warRegion: "greece" },
    });
    // C -> C+ (Master) -> C++ (Region), two steps up the dense ladder.
    expect(board.units[0].parameters.str.toString()).toBe("C++");
    // Only the Region's step is live-adjusted here; the Master's +10 is already
    // in `sys.baseAttack` from summon, so the board only adds the Region's own.
    expect(board.units[0].baseAttack.str).toBe(110);
  });
});

describe("unit-authored passiveRules (Ch. 32, Bašmu's Normal Attack rider)", () => {
  // A summon has no separate ability item to carry a standing rule -- Bašmu's
  // Normal Attack rider and its Targetability protection are authored
  // directly on the SUMMON, not on an Item, and `contributionsOf` used to
  // read only `actor.items` -- so a unit-level `passiveRules` block was
  // authored, validated, compiled onto the actor's `system`, and then
  // silently dropped by the one reader that would have collected it.
  const withRules = actor({
    system: {
      passiveRules: [{ key: "FlatDamage", value: 10 }],
    },
  });

  it("collects a unit's own passiveRules as a pseudo-ability", () => {
    const c = contributionsOf(withRules);
    expect(c.modifiers).toEqual([expect.objectContaining({ key: "divinity", value: 10 })]);
  });

  it("adds nothing for a unit with no unit-level rules", () => {
    const c = contributionsOf(actor());
    expect(c.modifiers).toEqual([]);
  });

  it("collects alongside an ordinary item's own passiveRules, not instead of it", () => {
    const both = actor({
      system: { passiveRules: [{ key: "FlatDamage", value: 10 }] },
      items: [{
        id: "ability1", name: "Some Skill", type: "ability",
        system: { passiveRules: [{ key: "FlatDamage", value: 5 }] },
      }],
    });
    const c = contributionsOf(both);
    expect(c.modifiers.map((m) => m.value).sort((a, b) => a - b)).toEqual([5, 10]);
  });
});

describe("VariantOverride (Ch. 32, Semiramis's Double Summon buff)", () => {
  // The DSC buff grants Semiramis her OWN 'heads' branch shape for 1◈ Turn --
  // the same `summonVariant.heads.overrides` block `engine/summon.mjs`
  // applies permanently on a real Heads result, read live instead of copied.
  const withDscBuff = actor({
    system: {
      range: { panels: 2, targets: 1 },
      normalAttack: { mode: "fixed", component: "str" },
      sustainability: "2◈",
      summonVariant: {
        heads: {
          id: "dsc",
          overrides: {
            range: { panels: 3, targets: 1 },
            normalAttack: { mode: "rangeBanded", component: "str", bands: [{ to: 2 }, { from: 3 }] },
            sustainability: "4◈",
          },
        },
        tails: { id: "noDsc" },
      },
    },
    items: [{
      id: "dscBuff", name: "DSC", type: "effect",
      system: { passiveRules: [{ key: "VariantOverride", branch: "heads" }] },
    }],
  });

  it("overrides range while the buff is active", () => {
    const u = snapshotUnit(withDscBuff);
    expect(u.range).toBe(3);
    expect(u.maxTargets).toBe(1);
  });

  it("overrides normalAttack's mode, component and bands", () => {
    const u = snapshotUnit(withDscBuff);
    expect(u.normalAttack).toEqual({
      mode: "rangeBanded", component: "str", bands: [{ to: 2 }, { from: 3 }],
      // A Normal Attack may carry an AREA (Kagome: Famine's 3x3); Semiramis's
      // is a single panel, so it projects null.
      shape: null,
    });
  });

  it("overrides sustainability's authored maximum", () => {
    const u = snapshotUnit(withDscBuff, { turnsPerRound: 1 });
    expect(u.sustainability).toBe(4);
  });

  it("leaves the base shape alone without the buff", () => {
    const plain = actor({ system: { range: { panels: 2, targets: 1 }, sustainability: "2◈" } });
    const u = snapshotUnit(plain, { turnsPerRound: 1 });
    expect(u.range).toBe(2);
    expect(u.sustainability).toBe(2);
  });
});

describe("platformContentId (Ch. 20, Semiramis's Territory Creation)", () => {
  // `annotatePlatforms` matches a unit to a platform by ELEVATION, not by the
  // platform's own `system.level` field -- both are projected through the
  // same generic `level: footprint[0].k ?? doc?.elevation ?? 0`, so the token
  // fixture below is what actually places a unit "aboard".
  const platform = (over = {}) => actor({
    id: "hgob-actor", type: "platform",
    system: { contentId: "hanging-gardens-of-babylon", footprint: { w: 9, h: 9 }, ...(over.system ?? {}) },
    ...over,
  });
  const at = (elevation) => token({ x: 0, y: 0, offsets: [{ i: 0, j: 0, k: elevation }], elevation });

  it("stamps the platform's STABLE content id on a unit aboard it, not its Foundry id", () => {
    const board = snapshotBoard({
      scene: null,
      actors: [
        { actor: platform(), token: at(1) },
        { actor: actor({ id: "semiramis" }), token: at(1) },
      ],
    });
    const semiramis = board.units.find((u) => u.id === "semiramis");
    expect(semiramis.platformContentId).toBe("hanging-gardens-of-babylon");
    expect(semiramis.platformId).toBe("hgob-actor");
  });

  it("leaves platformContentId unset for a unit on the ground", () => {
    const board = snapshotBoard({
      scene: null,
      actors: [
        { actor: platform(), token: at(1) },
        { actor: actor({ id: "on-ground" }), token: at(0) },
      ],
    });
    const onGround = board.units.find((u) => u.id === "on-ground");
    expect(onGround.platformContentId).toBeUndefined();
  });
});

describe("range projection", () => {
  it("is the panel count, not the schema object", () => {
    expect(snapshotUnit(actor({ system: { range: { panels: 3, targets: 2 } } })).range).toBe(3);
    expect(snapshotUnit(actor({ system: { range: { panels: 3, targets: 2 } } })).maxTargets).toBe(2);
  });

  it("accepts a bare number, for a hand-built fixture", () => {
    expect(snapshotUnit(actor({ system: { range: 4 } })).range).toBe(4);
  });

  it("defaults to 1 when unset", () => {
    expect(snapshotUnit(actor({ system: {} })).range).toBe(1);
  });
});

describe("turn state expires by tick, not by being cleared", () => {
  const spent = {
    tick: 4, acted: true, moved: true, attacked: true,
    movedPanels: 7, moveSegments: 3, usedRidingAttack: true,
  };

  it("keeps the state while the tick it was written on is current", () => {
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: 4 });
    expect(unit.turnState.movedPanels).toBe(7);
    expect(unit.turnState.attacked).toBe(true);
  });

  it("reads blank once the turn has moved on", () => {
    // The bug this replaces: the state was cleared by *writing* a blank one at
    // each turn boundary, so one hook that did not fire left a Unit with
    // "0 remain of MOV 7" for the rest of the match. Staleness is decided on
    // read now, so no write has to succeed for the turn to end.
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: 5 });
    expect(unit.turnState.movedPanels).toBe(0);
    expect(unit.turnState.attacked).toBe(false);
    expect(unit.turnState.usedRidingAttack).toBe(false);
    expect(unit.acted).toBe(false);
  });

  it("treats state written before the stamp existed as stale", () => {
    const legacy = { acted: true, moved: true, movedPanels: 7 };
    expect(snapshotUnit(actor({ system: { turnState: legacy } }), { tick: 0 }).turnState.movedPanels)
      .toBe(0);
  });

  it("leaves the state alone out of combat, where there are no ticks", () => {
    // `tick: null` means the rule does not apply: a GM arranging the board
    // between matches should not have a Unit's state silently forgotten.
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: null });
    expect(unit.turnState.movedPanels).toBe(7);
  });

  it("expires every field together, so nothing survives its turn", () => {
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: 99 });
    expect(unit.turnState).toMatchObject({
      acted: false, moved: false, attacked: false, movedPanels: 0,
      moveSegments: 0, usedActiveSkill: false, mayMoveAgain: false, usedRidingAttack: false,
    });
  });
});

describe("turnStateAt is what movement reads", () => {
  it("restores the full MOV allowance on the next tick", () => {
    const walked = { tick: 2, moved: true, movedPanels: 7 };
    const stale = turnStateAt(walked, 3);
    expect(remainingMovement({ mov: 7, turnState: stale })).toBe(7);
    expect(segmentCheck({ mov: 7, turnState: stale })).toBeNull();
  });

  it("still refuses while the same tick is current", () => {
    const walked = { tick: 2, moved: true, movedPanels: 7 };
    const fresh = turnStateAt(walked, 2);
    expect(remainingMovement({ mov: 7, turnState: fresh })).toBe(0);
    expect(segmentCheck({ mov: 7, turnState: fresh })).toMatch(/spent all 7 panels/);
  });
});

describe("turnStateAt", () => {
  it("projects which abilities went, which every same-Turn rule depends on", () => {
    // Absent from the projection until Scáthach's `oncePerTurn` needed it, so
    // every snapshot reader of the turn record saw `undefined`: the gate never
    // refused, and `reactionAbilities` offered a Skill whose same-Turn partner
    // had already been used.
    const projected = turnStateAt({ tick: 7, abilitiesUsed: ["medea-keraino"], itemTransfers: 1 }, 7);
    expect(projected.abilitiesUsed).toEqual(["medea-keraino"]);
    expect(projected.itemTransfers).toBe(1);
  });

  it("blanks the list when the record is stale, rather than leaving it undefined", () => {
    // The safe direction, and the reason turn state is stale-by-tick: a Servant
    // must never be permanently unable to use half its Skills because one
    // reset hook did not fire.
    const stale = turnStateAt({ tick: 3, abilitiesUsed: ["medea-keraino"] }, 7);
    expect(stale.abilitiesUsed).toEqual([]);
  });
});

describe("sustainability", () => {
  const actor = (system) => ({ id: "s", name: "S", type: "servant", items: [], effects: [], system });

  it("projects a NUMBER of turns, not the authored ◈ expression", () => {
    // Four rules-layer readers do arithmetic on this. The document holds "2◈",
    // so `cannotPay` compared `"2◈" > 5`, `checkRemovals` computed `"2◈" - 1`,
    // and `onMasterDefeated` wrote `Math.max(0, NaN)`. A Free Servant could
    // never pay for a Noble Phantasm and never ran out of time.
    const snap = snapshotUnit(actor({ sustainability: "2◈" }), { turnsPerRound: 3 });

    expect(snap.sustainability).toBe(6);
    expect(snap.sustainabilityMax).toBe("2◈");
  });

  it("resolves against the world's turns per Round", () => {
    expect(snapshotUnit(actor({ sustainability: "2◈" }), { turnsPerRound: 8 }).sustainability).toBe(16);
  });

  it("prefers what is left once something has been spent", () => {
    const snap = snapshotUnit(
      actor({ sustainability: "2◈", sustainabilityRemaining: 4 }), { turnsPerRound: 3 },
    );
    expect(snap.sustainability).toBe(4);
  });

  it("reads a spent clock as zero rather than as absent", () => {
    // Zero is "about to disappear"; null is "has no clock at all". Conflating
    // them makes a Servant out of time immortal.
    const snap = snapshotUnit(
      actor({ sustainability: "2◈", sustainabilityRemaining: 0 }), { turnsPerRound: 3 },
    );
    expect(snap.sustainability).toBe(0);
  });

  it("keeps null meaning no clock at all — Independent Action A+/EX", () => {
    expect(snapshotUnit(actor({ sustainability: null })).sustainability).toBe(null);
  });
});

describe("canAct reads the effects, not only the channelling flag", () => {
  // §16.4: "While a Servant is affected by Charm, Confuse, Berserk, Stun,
  // Stop, Petrify, Freeze, Sleep, or any other effect that prevents a Servant
  // from Acting, the effects in the above paragraphs are negated."
  //
  // All four Master-protection rules read `canAct`, and it used to answer only
  // `system.canAct` -- which nothing but `engine/channel.mjs` ever writes. So a
  // Stunned bodyguard still protected its Master, still redirected a Counter,
  // still denied the zone and still Covered, and the negation clause was inert.
  // `load()` is handed its documents rather than going looking for them,
  // which is what makes the lookup half testable without a world.
  EffectRegistry.load([
    { name: "Stun", system: { contentId: "stun", polarity: "debuff", preventsAction: true } },
    { name: "Petrify", system: { contentId: "petrify", polarity: "debuff", preventsAction: true } },
    { name: "Burn", system: { contentId: "burn", polarity: "debuff" } },
  ]);

  const withEffect = (defId) => actor({
    effects: [{ id: "e1", disabled: false, isSuppressed: false, system: { defId } }],
  });

  it("is true for a unit carrying nothing", () => {
    expect(snapshotUnit(actor()).canAct).toBe(true);
  });

  it("is false while an action-preventing effect is in force", () => {
    // `stun` declares `preventsAction: true`; the registry answers from the
    // definition rather than from a list this file would have to keep current.
    expect(snapshotUnit(withEffect("stun")).canAct).toBe(false);
  });

  it("is still false when the flag says nothing but an effect does", () => {
    const a = withEffect("petrify");
    a.system.canAct = null;
    expect(snapshotUnit(a).canAct).toBe(false);
  });

  it("stays true for an effect that does not prevent acting", () => {
    expect(snapshotUnit(withEffect("burn")).canAct).toBe(true);
  });
});
