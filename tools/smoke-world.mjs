#!/usr/bin/env node
/**
 * @file Load a real world in a real Foundry and fail if it does not come up.
 *
 * Every other gate in this repository runs without Foundry. That is deliberate
 * — L1 and L2 are pure ESM and testing them against a live client would be slow
 * and pointless — but it leaves one layer uncovered, and it is the layer that
 * can take the whole world down.
 *
 * `0.2.10` shipped an `EffectData.changes` field with a v13-style numeric
 * `mode`. Core verifies that schema's shape at `setupGame`
 * (`#verifyActiveEffectModels`) and *throws* when it is wrong, from inside
 * `Game.setupGame` where nothing catches it. Every world on that release
 * rendered a black page. Lint passed. All 629 tests passed. The content
 * validator passed. Nothing in the repository could have known, because
 * nothing in the repository ever loaded a world.
 *
 * This does. It drives a real browser at a real Foundry over the Chrome
 * DevTools Protocol, launches a world, joins it, and waits for `game.ready`. An
 * uncaught exception anywhere in that sequence fails the run and is printed
 * with its stack. That is the entire contract: **did the world come up.**
 *
 * ## Running it
 *
 * It needs two things this repository cannot provide, so it is not part of CI —
 * GitHub's runners have no Foundry to point it at. It is a *local* gate, to be
 * run before tagging, alongside `npm run check:release`.
 *
 * 1. Foundry running and serving the world (default `http://localhost:30000`).
 * 2. Chrome started with a debugging port:
 *
 *        chrome.exe --remote-debugging-port=9222 --user-data-dir=%TEMP%\chrome-foundry-debug
 *
 * Then:
 *
 *        npm run check:smoke -- --world=fgt2026 --user=Gamemaster
 *
 * It opens its own tab and closes it again, so a world you already have open in
 * another tab is left alone. Note that Foundry disables a user in the join
 * screen while that user is already connected — if you are sitting in the world
 * as the Gamemaster, either pass a different `--user` or close your tab first.
 *
 * @see docs/38-testing.md
 */

/* ── Arguments ────────────────────────────────────────────────────────────── */

const args = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith("--"))
  .map((a) => {
    const eq = a.indexOf("=");
    return eq === -1 ? [a.slice(2), true] : [a.slice(2, eq), a.slice(eq + 1)];
  }));

if (args.help || !args.world) {
  console.error(`usage: node tools/smoke-world.mjs --world=<id> [options]

  --world=<id>        REQUIRED. The world to launch, by id (its folder name).
  --user=<name>       The user to join as. Default: the first one available.
  --password=<pw>     That user's password, if it has one.
  --url=<origin>      Where Foundry is. Default: http://localhost:30000
  --port=<n>          Chrome's remote debugging port. Default: 9222
  --timeout=<s>       How long to wait for a ready world. Default: 120
  --strict            Also fail if the system logs a console error.
  --keep-open         Leave the tab open afterwards, to look at what happened.`);
  process.exit(1);
}

const origin = (args.url ?? "http://localhost:30000").replace(/\/$/, "");
const port = Number(args.port ?? 9222);
const timeoutMs = Number(args.timeout ?? 120) * 1000;

// Node gained a global WebSocket in 22. There is no point limping on without
// it — say so plainly rather than failing later with "WebSocket is not defined".
if (typeof WebSocket === "undefined") {
  console.error(`FGT | This needs a global WebSocket, which arrived in Node 22. You are on ${process.version}.`);
  process.exit(1);
}

/* ── A very small CDP client ──────────────────────────────────────────────── */

/**
 * Open a fresh tab and attach to it.
 *
 * Its own tab, because this navigates: driving whichever tab happened to be
 * first would yank a world out from under someone reading it.
 *
 * @returns {Promise<{send: Function, close: Function, id: string}>}
 */
async function attachToNewTab() {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
    .catch(() => null);
  if (!res?.ok) {
    throw new Error(
      `No Chrome listening on 127.0.0.1:${port}. Start one with:\n` +
      `      chrome.exe --remote-debugging-port=${port} --user-data-dir=%TEMP%\\chrome-foundry-debug`,
    );
  }
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", () => no(new Error("Could not attach to the new tab.")), { once: true });
  });

  let nextId = 0;
  const pending = new Map();

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, no } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? no(new Error(msg.error.message)) : ok(msg.result);
      return;
    }
    handleEvent(msg);
  });

  const send = (method, params = {}) => new Promise((ok, no) => {
    const id = ++nextId;
    pending.set(id, { ok, no });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const close = async () => {
    ws.close();
    if (!args["keep-open"]) {
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
    }
  };

  return { send, close, id: target.id };
}

/* ── What we are listening for ────────────────────────────────────────────── */

/** @type {string[]} Uncaught exceptions. Any one of these fails the run. */
const exceptions = [];
/** @type {string[]} `console.error` output, reported always, fatal under --strict. */
const consoleErrors = [];

function handleEvent(msg) {
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    exceptions.push(d.exception?.description ?? d.text ?? "unknown exception");
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args
      .map((a) => (a.type === "string" ? a.value : a.description ?? JSON.stringify(a.value)))
      .join(" "));
  }
}

/* ── The probe ────────────────────────────────────────────────────────────── */

/**
 * One expression, evaluated in the page, that reports where the client is in
 * the setup → join → game sequence. Polling one probe rather than racing a set
 * of navigation events keeps this readable and keeps it honest: whatever the
 * page actually is right now is what we act on.
 */
const PROBE = `(() => {
  const path = location.pathname;
  if ( path === "/game" ) return {
    phase: "game",
    ready: !!globalThis.game?.ready,
    system: globalThis.game?.system?.version ?? null
  };
  if ( path === "/join" ) {
    const form = document.querySelector("#join-game-form");
    // No form on a finished page means Foundry served "There is currently no
    // active game session" -- it does NOT redirect to /setup, so the caller has
    // to go there itself.
    if ( !form ) return {phase: "join", loading: document.readyState !== "complete",
      noSession: document.readyState === "complete"};
    return {phase: "join", users: Array.from(form.querySelectorAll("select[name=userid] option"))
      .filter(o => o.value)
      .map(o => ({id: o.value, name: o.textContent.trim(), disabled: o.disabled}))};
  }
  if ( path === "/setup" ) {
    const tile = document.querySelector('[data-package-id="' + ${JSON.stringify(args.world)} + '"]');
    return {phase: "setup", found: !!tile, worlds: tile ? [] :
      Array.from(document.querySelectorAll("#worlds-list [data-package-id], .package.world[data-package-id]"))
        .map(e => e.dataset.packageId)};
  }
  return {phase: path, loading: document.readyState !== "complete"};
})()`;

/* ── Run ──────────────────────────────────────────────────────────────────── */

const t0 = Date.now();
let tab;
/** Guards the one-shot actions, so a slow page is not clicked at twice. */
const done = { toSetup: false, launched: false, joined: false };

/** @param {string} why */
function fail(why) {
  console.error(`\nFGT | SMOKE FAILED — ${why}`);
  if (exceptions.length) {
    console.error(`\n  Uncaught exception${exceptions.length > 1 ? "s" : ""}:`);
    for (const e of exceptions) console.error(`\n${e.split("\n").map((l) => `    ${l}`).join("\n")}`);
  }
  if (consoleErrors.length) {
    console.error(`\n  console.error output:`);
    for (const e of consoleErrors.slice(0, 20)) console.error(`    ${e.split("\n")[0]}`);
  }
  process.exitCode = 1;
}

try {
  tab = await attachToNewTab();
  await tab.send("Runtime.enable");
  await tab.send("Page.enable");

  // Straight to /join. Foundry redirects to /setup when the world is not
  // running, which the state machine below then handles — so one entry point
  // covers both a cold server and a world that is already up.
  await tab.send("Page.navigate", { url: `${origin}/join` });

  let state = { phase: "?" };

  while (Date.now() - t0 < timeoutMs) {
    if (exceptions.length) {
      fail(`the client threw while at "${state.phase}". The world never finished loading.`);
      break;
    }

    const { result } = await tab.send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
    state = result.value ?? { phase: "?" };

    if (state.phase === "join" && state.noSession && !done.toSetup) {
      // Cold server: nothing is running, so go and start it.
      done.toSetup = true;
      await tab.send("Page.navigate", { url: `${origin}/setup` });
    } else if (state.phase === "setup" && !done.launched) {
      if (!state.found) {
        fail(`Foundry has no world with id "${args.world}". It knows: ${state.worlds?.join(", ") || "(none listed)"}`);
        break;
      }
      console.log(`FGT | Launching world "${args.world}"...`);
      done.launched = true;
      await tab.send("Runtime.evaluate", {
        expression: `document.querySelector('[data-package-id="${args.world}"] [data-action="worldLaunch"]').click()`,
      });
    } else if (state.phase === "join" && !state.loading && !done.joined) {
      const open = (state.users ?? []).filter((u) => !u.disabled);
      const user = args.user
        ? (state.users ?? []).find((u) => u.name === args.user)
        : open[0];

      if (!user) {
        fail(args.user
          ? `no user named "${args.user}" in this world. It has: ${(state.users ?? []).map((u) => u.name).join(", ")}`
          : "this world has no users to join as.");
        break;
      }
      if (user.disabled) {
        // Foundry disables a user that is already connected. Worth naming,
        // because the obvious reading -- "the world is broken" -- is wrong.
        fail(`user "${user.name}" is already connected, so this run cannot join as them. `
          + `Close that session, or pass a different --user.`);
        break;
      }

      console.log(`FGT | Joining as "${user.name}"...`);
      done.joined = true;
      await tab.send("Runtime.evaluate", {
        expression: `(() => {
          const form = document.querySelector("#join-game-form");
          const select = form.querySelector("select[name=userid]");
          select.value = ${JSON.stringify(user.id)};
          select.dispatchEvent(new Event("change", {bubbles: true}));
          const pw = form.querySelector("input[name=password]");
          if ( pw ) pw.value = ${JSON.stringify(args.password ?? "")};
          form.querySelector("button[name=join]").click();
        })()`,
      });
    } else if (state.phase === "game" && state.ready) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`FGT | World "${args.world}" is ready on system ${state.system} (${secs}s).`);

      const systemErrors = consoleErrors.filter((e) => e.includes("FGT |"));
      if (systemErrors.length) {
        console.warn(`\nFGT | ${systemErrors.length} console error(s) from the system:`);
        for (const e of systemErrors) console.warn(`    ${e.split("\n")[0]}`);
        if (args.strict) {
          console.error("\nFGT | SMOKE FAILED — --strict, and the system logged errors.");
          process.exitCode = 1;
        }
      }
      break;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  if (process.exitCode !== 1 && !(state.phase === "game" && state.ready)) {
    fail(`timed out after ${timeoutMs / 1000}s, stuck at "${state.phase}".`);
  }
} catch (err) {
  console.error(`\nFGT | SMOKE FAILED — ${err.message}`);
  process.exitCode = 1;
} finally {
  await tab?.close();
}
