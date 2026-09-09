#!/usr/bin/env node
/**
 * @file Drive the Foundry application and its world from the command line.
 *
 * The pack build needs the LevelDB released, and only shutting the WORLD down
 * releases it — closing the browser tab does nothing, and the application keeps
 * the files open until the world returns to setup. That turned every content
 * change into a request to a human: close Foundry, wait, rebuild, relaunch,
 * rejoin. This does the whole cycle.
 *
 * Two APIs, read off Foundry's own source rather than guessed:
 *
 *   - **Shutdown** is `POST /setup` with `{shutdown: true}`
 *     (`Game#shutDown`). It needs the session, so it is issued from inside the
 *     page rather than with a bare fetch from here.
 *   - **Launch** goes over a socket, not a POST: `#launchWorld` builds a
 *     `ProgressReceiver(world, "launchWorld")` (`CONST.SETUP_PACKAGE_PROGRESS
 *     .ACTIONS.LAUNCH_WORLD`). Reaching that private path from outside is
 *     fragile, so this clicks the world tile's play control — the same thing a
 *     person does, and the only route that stays supported.
 *
 * Usage:
 *   node tools/fgt-world.mjs status
 *   node tools/fgt-world.mjs shutdown            # world -> setup, unlocks packs
 *   node tools/fgt-world.mjs launch [worldId]    # setup -> game
 *   node tools/fgt-world.mjs rebuild [worldId]   # shutdown, build:packs, launch
 *   node tools/fgt-world.mjs app:start | app:stop | app:restart
 *   node tools/fgt-world.mjs chrome:start        # the CDP-enabled browser
 *   node tools/fgt-world.mjs up [worldId]        # chrome + app + launch
 */

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PORT = process.env.FGT_CDP_PORT ?? 9222;
const WORLD = process.env.FGT_WORLD ?? "fgt2026";
const FOUNDRY_EXE = process.env.FGT_FOUNDRY_EXE
  ?? "C:\\Program Files\\Foundry Virtual Tabletop\\Foundry Virtual Tabletop.exe";
const CHROME_EXE = process.env.FGT_CHROME_EXE
  ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME_PROFILE = process.env.FGT_CHROME_PROFILE
  ?? `${process.env.TEMP}\\chrome-foundry-debug`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/*  CDP                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every Foundry page the debug browser has open.
 * @returns {Promise<object[]>}
 */
async function foundryPages() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await res.json();
    return targets.filter((t) => t.type === "page" && String(t.url).includes(":30000"));
  } catch {
    return [];   // no debug browser at all
  }
}

/**
 * The page to talk to: the game if there is one, else whatever is on :30000.
 * @returns {Promise<object|null>}
 */
async function foundryPage() {
  const pages = await foundryPages();
  return pages.find((t) => String(t.url).includes("/game")) ?? pages[0] ?? null;
}

/**
 * Evaluate an expression in a page and return its value.
 *
 * The same wrapper `tools/fgt-eval.mjs` uses, kept separate rather than
 * imported so that either tool can be run when the other is mid-edit.
 *
 * @param {object} page a CDP target
 * @param {string} expression
 * @param {number} [timeoutMs]
 * @returns {Promise<unknown>}
 */
async function evaluate(page, expression, timeoutMs = 60_000) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  try {
    return await new Promise((resolve, reject) => {
      const id = 1;
      const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms.`)), timeoutMs);
      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id !== id) return;
        clearTimeout(timer);
        if (msg.error) return reject(new Error(msg.error.message));
        if (msg.result?.exceptionDetails) {
          return reject(new Error(msg.result.result?.description ?? msg.result.exceptionDetails.text));
        }
        resolve(msg.result?.result?.value ?? null);
      });
      ws.send(JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: {
          expression: `(async () => { ${expression} })().then((v) => JSON.stringify(v ?? null))`,
          awaitPromise: true, returnByValue: true, userGesture: true,
        },
      }));
    });
  } finally {
    ws.close();
  }
}

/**
 * Point a page at a URL.
 *
 * @param {object} page a CDP target
 * @param {string} url
 * @returns {Promise<void>}
 */
async function navigate(page, url) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.send(JSON.stringify({ id: 1, method: "Page.navigate", params: { url } }));
  await sleep(1500);
  ws.close();
}

/**
 * Wait until a Foundry page's URL contains `fragment`.
 *
 * @param {string} fragment
 * @param {number} [seconds]
 * @returns {Promise<boolean>}
 */
async function waitForUrl(fragment, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    const pages = await foundryPages();
    if (pages.some((p) => String(p.url).includes(fragment))) return true;
    await sleep(500);
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Commands                                                                  */
/* -------------------------------------------------------------------------- */

/** @returns {Promise<object>} */
async function status() {
  const pages = await foundryPages();
  const running = await appRunning();
  const page = pages.find((p) => String(p.url).includes("/game")) ?? null;
  let ready = null;
  if (page) {
    try {
      ready = JSON.parse(await evaluate(page, "return { world: game?.world?.id ?? null, ready: !!game?.ready };"));
    } catch { ready = null; }
  }
  return {
    foundryApp: running ? "running" : "stopped",
    debugChrome: pages.length > 0 || (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false))
      ? "reachable" : "not reachable",
    pages: pages.map((p) => p.url),
    world: ready?.world ?? null,
    ready: ready?.ready ?? false,
  };
}

/**
 * Send the world back to setup, which is what releases the pack LevelDB.
 * @returns {Promise<boolean>}
 */
async function shutdown() {
  const page = await foundryPage();
  if (!page) return false;
  if (!String(page.url).includes("/game")) return true;   // already at setup/join

  // `Game#shutDown` verbatim, minus its "other users are connected" dialog --
  // this is a scripted teardown and there is nobody to ask.
  await evaluate(page, `
    await foundry.utils.fetchWithTimeout(foundry.utils.getRoute("setup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shutdown: true }),
      redirect: "manual",
    });
    return true;
  `).catch(() => null);

  const left = await waitForUrl("/setup", 60) || await waitForUrl("/join", 10);
  // The files are released a moment after the page moves.
  await sleep(2000);
  return left;
}

/**
 * Launch a world from the setup screen by clicking its play control.
 *
 * @param {string} worldId
 * @returns {Promise<boolean>}
 */
async function launch(worldId = WORLD) {
  let page = await foundryPage();
  if (!page) return false;
  if (String(page.url).includes("/game")) return true;    // already up

  // A page sitting on /join belongs to a world that is already launched.
  if (String(page.url).includes("/join")) return true;

  // Anything else -- `/no` after a shutdown, or a tab left on an old route --
  // has no world list to click. Send it to the root, which redirects to
  // /setup, and wait for the list to render.
  if (!String(page.url).includes("/setup")) {
    await navigate(page, "http://localhost:30000/setup");
    if (!await waitForUrl("/setup", 30)) return false;
    page = await foundryPage();
    if (!page) return false;
    await sleep(2500);   // the world tiles render after the page settles
  }

  const clicked = await evaluate(page, `
    const tile = document.querySelector('.world[data-package-id="${worldId}"]')
      ?? [...document.querySelectorAll("[data-package-id]")]
        .find((el) => el.dataset.packageId === "${worldId}");
    if (!tile) return { ok: false, reason: "noTile" };
    const play = tile.querySelector('.control.play, a[data-action="worldLaunch"], .play');
    if (!play) return { ok: false, reason: "noPlayControl" };
    play.click();
    return { ok: true };
  `).then((v) => JSON.parse(v)).catch((e) => ({ ok: false, reason: e.message }));

  if (!clicked.ok) {
    console.error(`FGT | Could not launch "${worldId}": ${clicked.reason}`);
    return false;
  }

  // Launching navigates to /join (or straight to /game for a single-user
  // session); either way the world is up and the packs are locked again.
  const up = await waitForUrl("/join", 90) || await waitForUrl("/game", 10);
  await sleep(1500);
  return up;
}

/**
 * Join the launched world as a user, which is what turns `/join` into `/game`.
 *
 * Defaults to the Gamemaster: every tool here drives the world with GM
 * authority, and `Game#shutDown` refuses anyone else.
 *
 * @param {string} [userName]
 * @returns {Promise<boolean>}
 */
async function join(userName = process.env.FGT_USER ?? "Gamemaster") {
  const page = await foundryPage();
  if (!page) return false;
  if (String(page.url).includes("/game")) return true;
  if (!String(page.url).includes("/join")) return false;

  const picked = await evaluate(page, `
    const select = document.querySelector('select[name="userid"]');
    const form = document.getElementById("join-game-form");
    if (!select || !form) return { ok: false, reason: "noJoinForm" };
    const option = [...select.options].find((o) => o.textContent.trim() === ${JSON.stringify(userName)});
    if (!option) {
      return { ok: false, reason: "noSuchUser", users: [...select.options].map((o) => o.textContent.trim()) };
    }
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    // Submit the form rather than clicking: the button is inside it and the
    // submit handler is what Foundry listens on.
    form.requestSubmit(form.querySelector('button[name="join"]'));
    return { ok: true };
  `).then((v) => JSON.parse(v)).catch((e) => ({ ok: false, reason: e.message }));

  if (!picked.ok) {
    console.error(`FGT | Could not join as "${userName}": ${picked.reason}`
      + (picked.users ? ` (users: ${picked.users.join(", ")})` : ""));
    return false;
  }

  if (!await waitForUrl("/game", 90)) return false;
  // `game.ready` lags the navigation; every caller wants a usable world.
  for (let i = 0; i < 60; i++) {
    const p = await foundryPage();
    if (p) {
      const ready = await evaluate(p, "return !!game?.ready;").catch(() => "false");
      if (ready === "true") return true;
    }
    await sleep(1000);
  }
  return false;
}

/** @returns {Promise<boolean>} */
async function appRunning() {
  try {
    // `/FO CSV`, because the default table output TRUNCATES the image name to
    // the column width -- "Foundry Virtual Tabletop.exe" comes back as
    // "Foundry Virtual Tabletop." and an `.exe` test never matches, so a
    // running application reported as stopped.
    const { stdout } = await execFileAsync("tasklist",
      ["/FI", "IMAGENAME eq Foundry Virtual Tabletop.exe", "/FO", "CSV", "/NH"]);
    return /Foundry Virtual Tabletop/i.test(stdout);
  } catch {
    return false;
  }
}

/** @returns {Promise<void>} */
async function appStart() {
  if (await appRunning()) return;
  // Detached: the server has to outlive this process.
  spawn(FOUNDRY_EXE, [], { detached: true, stdio: "ignore" }).unref();
  // The HTTP server takes a few seconds to bind :30000.
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://localhost:30000", { redirect: "manual" });
      return;
    } catch { await sleep(1000); }
  }
}

/** @returns {Promise<void>} */
async function appStop() {
  await execFileAsync("taskkill", ["/IM", "Foundry Virtual Tabletop.exe", "/F"]).catch(() => {});
  await sleep(2000);
}

/** @returns {Promise<void>} */
async function chromeStart() {
  const reachable = await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false);
  if (reachable) return;
  spawn(CHROME_EXE, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${CHROME_PROFILE}`,
    "http://localhost:30000",
  ], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 40; i++) {
    if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false)) return;
    await sleep(500);
  }
}

/* -------------------------------------------------------------------------- */

const [command, arg] = process.argv.slice(2);

try {
  switch (command) {
    case "status":
      console.log(JSON.stringify(await status(), null, 2));
      break;

    case "shutdown":
      console.log(await shutdown() ? "FGT | World shut down; packs are unlocked." : "FGT | No world to shut down.");
      break;

    case "launch":
      console.log(await launch(arg) ? `FGT | Launched "${arg ?? WORLD}".` : "FGT | Launch failed.");
      break;

    case "join":
      console.log(await join(arg) ? "FGT | Joined; the world is ready." : "FGT | Join failed.");
      break;

    case "rebuild": {
      // The whole reason this file exists.
      await shutdown();
      const { stdout } = await execFileAsync("npm", ["run", "build:packs"], { shell: true, maxBuffer: 1 << 24 });
      console.log(stdout.split("\n").filter((l) => /packed|Built|error/i.test(l)).join("\n"));
      await launch(arg);
      console.log(await join()
        ? `FGT | Relaunched and joined "${arg ?? WORLD}".`
        : "FGT | Rebuilt, but the world did not come back up.");
      break;
    }

    case "app:start": await appStart(); console.log("FGT | Foundry started."); break;
    case "app:stop": await appStop(); console.log("FGT | Foundry stopped."); break;
    case "app:restart": await appStop(); await appStart(); console.log("FGT | Foundry restarted."); break;
    case "chrome:start": await chromeStart(); console.log("FGT | Debug Chrome started."); break;

    case "up":
      await appStart();
      await chromeStart();
      await launch(arg);
      console.log(await join()
        ? `FGT | Up: "${arg ?? WORLD}" is ready.`
        : "FGT | Up, but the world did not become ready.");
      break;

    default:
      console.log("Usage: node tools/fgt-world.mjs "
        + "status|shutdown|launch|join|rebuild|app:start|app:stop|app:restart|chrome:start|up [worldId]");
      process.exit(1);
  }
} catch (err) {
  console.error(`FGT | ${err.message}`);
  process.exit(1);
}
