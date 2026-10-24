#!/usr/bin/env node
/**
 * @file Reload the running Foundry tab and wait for `game.ready`.
 *
 * Module sources are loaded once, at page load. Every edit to `module/` is
 * invisible to the live world until the page comes back, and a test run
 * against a stale page reports the *old* behaviour — which is worse than not
 * testing, because it looks like evidence.
 *
 * Pack changes need more than this: LevelDB is held open by the server, so the
 * world has to be shut down before `npm run build:packs` and relaunched after.
 */

import { foundryTarget } from "./lib/cdp.mjs";

// The GM's page, as `fgt-eval` picks it. This had its own pick, the first
// `/game` tab, and with Player1's tab listed first it reloaded Player1 and left
// the GM -- who runs every write -- on the old code (#330, found pressing).
const target = foundryTarget;

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
ws.send(JSON.stringify({ id: 1, method: "Page.reload", params: { ignoreCache: true } }));
await new Promise((r) => setTimeout(r, 1500));
ws.close();

// Poll rather than sleep a fixed amount: world load time varies with the
// number of documents, and a fixed wait is either slow or flaky.
for (let attempt = 0; attempt < 60; attempt++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    const socket = new WebSocket(await target());
    await new Promise((r, j) => {
      socket.addEventListener("open", r, { once: true });
      socket.addEventListener("error", j, { once: true });
    });
    const ready = await new Promise((resolve) => {
      socket.addEventListener("message", (e) => {
        const m = JSON.parse(e.data);
        if (m.id === 2) resolve(m.result?.result?.value === true);
      });
      socket.send(JSON.stringify({
        id: 2, method: "Runtime.evaluate",
        params: { expression: "Boolean(globalThis.game?.ready)", returnByValue: true },
      }));
      setTimeout(() => resolve(false), 3000);
    });
    socket.close();
    if (ready) {
      console.log(`FGT | World ready after ${attempt + 1}s.`);
      process.exit(0);
    }
  } catch {
    // The page is mid-navigation; try again.
  }
}

console.error("FGT | World did not become ready within 60s.");
process.exit(1);
