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
 * Three of the probes are expected to **diverge**, and that is the point of
 * recording them: the harness deliberately throws where Foundry silently
 * discards, and this is what notices if that stops being the deliberate
 * difference it is documented as.
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
    agree: true,
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
    agree: true,
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
    // Found by this check on its first run, and left in as the record of it.
    // `zonPartnerIds` is a SetField of DocumentIdField, so Foundry validates
    // each ENTRY and drops a non-id; the model coerces the collection and does
    // not look inside it. Harmless for what io writes today -- every id it
    // writes came off a document -- and exactly the kind of thing that stops
    // being harmless quietly, which is why it is written down rather than
    // patched over.
    agree: false,
    expectLive: (v) => v.kept === 0,
    expectFake: (v) => v.kept === 2,
    divergence: "Foundry validates SetField ELEMENTS; the model coerces the collection only",
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
    // the reason the model is worth having — see its header.
    agree: false,
    expectLive: (v) => v.threw === false && v.readBack === null,
    expectFake: (v) => v.threw === true,
    divergence: "Foundry discards silently; the model throws so a test can see it",
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
