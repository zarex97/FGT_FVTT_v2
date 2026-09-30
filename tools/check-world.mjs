#!/usr/bin/env node
/**
 * @file Hold `test/helpers/world.mjs` against a real world.
 * @see test/helpers/world.mjs, docs/44-testing.md
 *
 * The harness makes `module/engine/io.mjs` executable by modelling Foundry. A
 * model that is subtly wrong is worse than none, because the tests written
 * against it encode the wrongness — so this runs the same probe in both places
 * and reports where they disagree.
 *
 * It works at all because the harness installs **globals**. A probe is a script
 * against `game.actors.get(id)`, and the identical text runs in the modelled
 * world and in the live one; nothing is written twice.
 *
 * Four of the probes are expected to **diverge**, and that is the point of
 * recording them: the harness's loud prune deliberately throws wherever
 * Foundry silently discards, clamps, coerces or voids a write, and this is
 * what notices if that stops being the deliberate difference it is documented
 * as — or if a Foundry upgrade stops doing the silent thing.
 *
 * Three more probe Foundry's CLIENT layer, which the model does not run at all:
 * the empty-diff skip and a `preCreate` edit to `data`. They are live-only, and
 * they prove the lint rule in `tools/lib/eslint-client-traps.mjs` still guards
 * something real on the Foundry build in `system.json`.
 *
 * Local only, like `check:smoke` — it needs Foundry serving and a Chrome with a
 * debugging port. It is not a CI gate; it is what you run before trusting the
 * model with something new.
 *
 *   npm run check:world
 */

import { evaluate } from "./lib/cdp.mjs";
import { withWorld } from "../test/helpers/world.mjs";

/**
 * Probes.
 *
 * `body` runs with `a` bound to an Actor and must return something JSON-safe.
 * `agree: false` marks a divergence the harness documents on purpose; the probe
 * then asserts that the model still behaves the way the header claims.
 */
const PROBES = [
  {
    name: "a declared write is visible immediately after await",
    body: `
      const before = a.system.mov;
      await a.update({ "system.mov": 7 });
      const after = a.system.mov;
      await a.update({ "system.mov": before });
      return { after, restored: a.system.mov === before };
    `,
    agree: true,
  },
  {
    name: "a NumberField with min: 0 clamps a negative write",
    body: `
      const before = a.system.mov;
      await a.update({ "system.mov": -5 });
      const after = a.system.mov;
      await a.update({ "system.mov": before });
      return { after };
    `,
    // Foundry clamps to 0 and says nothing; the loud prune throws, because the
    // value that landed is not the value written.
    agree: false,
    expectLive: (v) => v.after === 0,
    expectFake: (v) => v.threw === true,
    divergence: "Foundry clamps silently; the model throws",
  },
  {
    name: "a BooleanField coerces a truthy non-boolean",
    body: `
      const before = a.system.undamageable;
      await a.update({ "system.undamageable": 1 });
      const after = a.system.undamageable;
      await a.update({ "system.undamageable": before });
      return { after, type: typeof after };
    `,
    agree: false,
    expectLive: (v) => v.after === true && v.type === "boolean",
    expectFake: (v) => v.threw === true,
    divergence: "Foundry coerces 1 to true silently; the model throws",
  },
  {
    name: "a SetField written as an array reads back as a Set",
    body: `
      const before = [...(a.system.zonPartnerIds ?? [])];
      await a.update({ "system.zonPartnerIds": ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"] });
      const value = a.system.zonPartnerIds;
      const out = { isSet: value instanceof Set, size: value instanceof Set ? value.size : (value?.length ?? null) };
      await a.update({ "system.zonPartnerIds": before });
      return out;
    `,
    agree: true,
  },
  {
    name: "a SetField element that fails its own field's validation",
    body: `
      const before = [...(a.system.zonPartnerIds ?? [])];
      await a.update({ "system.zonPartnerIds": ["alpha", "beta"] });
      const value = a.system.zonPartnerIds;
      const out = { kept: value instanceof Set ? value.size : null };
      await a.update({ "system.zonPartnerIds": before });
      return out;
    `,
    // Found by this check on its first run, when the model imitated the field
    // classes and kept both entries. `zonPartnerIds` is a SetField of
    // DocumentIdField, so Foundry validates each ENTRY and the write lands as
    // nothing. The model now runs Foundry's own SetField, and throws.
    agree: false,
    expectLive: (v) => v.kept === 0,
    expectFake: (v) => v.threw === true,
    divergence: "Foundry voids the write silently; the model throws",
  },
  {
    name: "a Servant's Health maximum is backfilled from the END table",
    body: `
      return { hasMax: typeof a.system.health?.max === "number" && a.system.health.max > 0 };
    `,
    agree: true,
  },
  {
    name: "a write to an undeclared field",
    body: `
      try {
        await a.update({ "system.__conformanceProbe": 42 });
        return { threw: false, readBack: a.system.__conformanceProbe ?? null };
      } catch (err) {
        return { threw: true, message: String(err.message).slice(0, 60) };
      }
    `,
    // Foundry discards it and says nothing; the model throws. Deliberate, and
    // the reason the model is worth having — see its header's loud prune.
    agree: false,
    expectLive: (v) => v.threw === false && v.readBack === null,
    expectFake: (v) => v.threw === true,
    divergence: "Foundry discards silently; the model throws so a test can see it",
  },
];

/**
 * Probes of Foundry's CLIENT layer, which the model cannot run at all.
 *
 * `client/` does not import in Node (ADR-0006), so the two Silent Drops it
 * hides are guarded by a lint rule (`tools/lib/eslint-client-traps.mjs`) and
 * PROVED here: each probe does the dangerous thing to a throwaway actor, reads
 * back what the SERVER holds rather than the local copy, and deletes it. The
 * point is the build: if a Foundry upgrade stops doing the silent thing, the
 * lint is guarding something that is no longer there, and this says so (#94).
 *
 * `expect` states what Foundry does today, which is the trap.
 */
const SERVER_COPY = `
  const fromServer = async (id) =>
    (await CONFIG.DatabaseBackend.get(Actor.implementation, { query: { _id: id } }, game.user))[0];
`;
const CLIENT_PROBES = [
  {
    name: "update() after updateSource() sends nothing: the local copy says 4, the server 0",
    body: `${SERVER_COPY}
      const t = await Actor.create({ name: "fgt-probe empty diff", type: "civilian" });
      try {
        t.updateSource({ "system.mov": 4 });
        await t.update({ "system.mov": 4 });
        return { local: t.system.mov, server: (await fromServer(t.id))?.system?.mov ?? null };
      } finally { await t.delete(); }
    `,
    expect: (v) => v.local === 4 && v.server !== 4,
  },
  {
    name: "an edit to preCreate's data argument never reaches the server",
    body: `${SERVER_COPY}
      const hook = Hooks.once("preCreateActor", (doc, data) => { data.img = "icons/svg/skull.svg"; });
      const t = await Actor.create({ name: "fgt-probe preCreate data", type: "civilian" });
      try {
        return { server: (await fromServer(t.id))?.img ?? null };
      } finally { Hooks.off("preCreateActor", hook); await t.delete(); }
    `,
    expect: (v) => v.server !== "icons/svg/skull.svg",
  },
  {
    name: "the same edit through updateSource() does reach it",
    body: `${SERVER_COPY}
      const hook = Hooks.once("preCreateActor", (doc) => { doc.updateSource({ img: "icons/svg/skull.svg" }); });
      const t = await Actor.create({ name: "fgt-probe preCreate source", type: "civilian" });
      try {
        return { server: (await fromServer(t.id))?.img ?? null };
      } finally { Hooks.off("preCreateActor", hook); await t.delete(); }
    `,
    expect: (v) => v.server === "icons/svg/skull.svg",
  },
];

/** The body, wrapped so both sides resolve their own actor. */
const liveScript = (body) => `
  const a = game.actors.find((x) => x.type === "servant" && !x.system.defeated);
  if (!a) return { error: "no undefeated Servant in this world" };
  ${body}
`;

/** A Servant the model can answer the same questions about. */
const FAKE_ACTOR = {
  id: "probe",
  name: "Probe",
  type: "servant",
  system: { parameters: { str: "B", end: "B", agi: "B", mag: "B", luc: "B" }, mov: 5 },
};

async function runFake(body) {
  return withWorld({
    actors: [FAKE_ACTOR],
    combat: { round: 1, system: { globalTurn: 1 } },
  }, async (w) => {
    const fn = new Function("a", `return (async () => { ${body} })();`);
    return JSON.parse(JSON.stringify(await fn(w.actor("Probe"))));
  });
}

const results = [];
for (const probe of PROBES) {
  let live;
  let fake;
  try {
    live = JSON.parse(await evaluate(liveScript(probe.body)));
  } catch (err) {
    console.error(`FGT | Could not reach the live world: ${err.message}`);
    console.error("      Foundry must be serving and Chrome started with --remote-debugging-port=9222.");
    process.exit(1);
  }
  try {
    fake = await runFake(probe.body);
  } catch (err) {
    fake = { threw: true, message: String(err.message).slice(0, 60) };
  }

  const ok = probe.agree
    ? JSON.stringify(live) === JSON.stringify(fake)
    : Boolean(probe.expectLive?.(live) && probe.expectFake?.(fake));
  results.push({ ...probe, live, fake, ok });
}

for (const probe of CLIENT_PROBES) {
  const live = JSON.parse(await evaluate(probe.body));
  results.push({ ...probe, agree: false, live, fake: "(client layer: not modelled)", ok: probe.expect(live),
    divergence: "live-only; see tools/lib/eslint-client-traps.mjs" });
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  const mark = r.ok ? "ok      " : "MISMATCH";
  const note = r.agree ? "" : `  (divergence: ${r.divergence})`;
  console.log(`${mark} ${r.name}${note}`);
  if (!r.ok) {
    console.log(`         live: ${JSON.stringify(r.live)}`);
    console.log(`         fake: ${JSON.stringify(r.fake)}`);
  }
}

if (failed.length > 0) {
  console.error(
    `\nFGT | ${failed.length} of ${results.length} probe(s) disagree. `
    + "Either the model is wrong, or its header's list of divergences is out of date. "
    + "See test/helpers/world.mjs.",
  );
  process.exit(1);
}

const diverging = results.filter((r) => !r.agree).length;
console.log(
  `\nFGT | World model conforms (${results.length} probe(s); `
  + `${diverging} documented divergence(s) still behaving as documented).`,
);
