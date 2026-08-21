#!/usr/bin/env node
/**
 * @file Rebuild the compendium packs against a running world, and bring it back.
 *
 * LevelDB is held open by the Foundry server for as long as the world is
 * loaded, so `npm run build:packs` fails with `EBUSY` mid-session. The full
 * cycle is: shut the world down, build, relaunch, rejoin, wait for ready.
 *
 * Doing it by hand costs a minute and is easy to half-finish — a build that
 * failed on `EBUSY` leaves the packs as they were, and the next live test
 * reports the *old* content as though it were the new content.
 */

import { spawnSync } from "node:child_process";

const PORT = process.env.FGT_CDP_PORT ?? 9222;
const WORLD = process.argv[2] ?? "fgt2026";

/** @returns {Promise<string>} the Foundry page's debugger URL */
async function target() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pages = list.filter((t) => t.type === "page" && String(t.url).includes(":30000"));
  const page = pages.find((t) => String(t.url).includes("/game")) ?? pages[0];
  if (!page) throw new Error("No Foundry page found. Is Chrome running with --remote-debugging-port?");
  return page.webSocketDebuggerUrl;
}

/**
 * @param {object} message a CDP request
 * @returns {Promise<unknown>}
 */
async function send(message) {
  const ws = new WebSocket(await target());
  await new Promise((r, j) => {
    ws.addEventListener("open", r, { once: true });
    ws.addEventListener("error", j, { once: true });
  });
  const out = await new Promise((resolve) => {
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id === message.id) resolve(m.result?.result?.value ?? null);
    });
    ws.send(JSON.stringify(message));
    setTimeout(() => resolve(null), 8000);
  });
  ws.close();
  return out;
}

/**
 * @param {string} expression
 * @returns {Promise<unknown>}
 */
const run = (expression) => send({
  id: 1, method: "Runtime.evaluate",
  params: { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true },
});

const go = (url) => send({ id: 1, method: "Page.navigate", params: { url } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} what @returns {Promise<boolean>} */
async function until(what, attempts = 45) {
  for (let k = 0; k < attempts; k++) {
    await wait(1000);
    try {
      if (await run(`return ${what};`)) return true;
    } catch { /* mid-navigation */ }
  }
  return false;
}

console.log("FGT | Shutting the world down…");
await run("game.shutDown(); return true;");
await wait(3000);

console.log("FGT | Building packs…");
const built = spawnSync("node", ["tools/build-packs.mjs"], { stdio: "inherit" });
if (built.status !== 0) {
  console.error("FGT | Build failed; the world is still down. Relaunch it before testing.");
  process.exit(1);
}

console.log(`FGT | Relaunching ${WORLD}…`);
await run(`
  const res = await foundry.utils.fetchWithTimeout("/setup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "launchWorld", world: ${JSON.stringify(WORLD)} }),
  });
  return res.status === 200;
`);
await wait(3000);

await go("http://localhost:30000/join");
await wait(4000);
await run(`
  const gm = game.users.find((u) => u.isGM || u.role >= 4);
  await foundry.utils.fetchWithTimeout("/join", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "join", userid: gm.id, password: "" }),
  });
  return true;
`);
await wait(3000);
await go("http://localhost:30000/game");

if (await until("Boolean(globalThis.game?.ready)")) {
  console.log("FGT | World is back up.");
  process.exit(0);
}
console.error("FGT | World did not come back within 45s.");
process.exit(1);
