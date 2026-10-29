# The third workplace: Claude Code cloud sessions

Beside the PC and the VPS (`docs/agents/vps.md`), a Claude Code cloud session can run Foundry live. Each
session is a fresh, throwaway container: both repos are cloned into `/home/user`, and nothing outside git
survives the session.

| | Cloud session (Linux container) |
|---|---|
| Repo | `/home/user/FGT_FVTT_v2`, symlinked as `/opt/fvtt/data/Data/systems/fgt` |
| Foundry | the Node build in `/home/user/foundryVTT_copy/app`, 14.364, on Node 24 (`/opt/node24`), port 30000, no Docker |
| Data | `/opt/fvtt/data`, log in `/opt/fvtt/foundry.log` |
| Foundry source for tests | `../foundryVTT_copy` (the default) |
| Browser | Playwright's headless Chromium, WebGL2 in SwiftShader |

## Setting it up

The environment's setup script is `tools/cloud/setup.sh`. Paste the whole file into the environment's
settings (cloud environment menu in the session's title bar -> Edit -> Setup script); new sessions run it.
It installs Node 24 at `/opt/node24` and three commands:

- `fvtt-up` installs packages if needed, runs `npm run build`, links the system, starts Foundry and
  activates the licence from the environment variable `foundry_license`. It never prints the key.
  Exit 2: the variable is missing. Exit 3: Foundry still asks for a licence after activation.
- `fvtt-down` stops Foundry and waits until the port is free.
- `fvtt-world pull|push [world]` moves a world (default `fgt2026`) through the private repo
  `zarex97/fgt-worlds`. See *Moving the world* below.

The setup script cannot read the environment's variables, so the licence is read by `fvtt-up`, in the
session. Set `foundry_license` among the environment's variables.

## Moving the world

A session cannot be reached from outside and the PC cannot be attached to one, so a world travels through
the private repo `zarex97/fgt-worlds`: one `<world>.tgz` per world, packed relative to Foundry's `Data`
folder, holding `worlds/<world>` and the modules it needs (`restored-keep-levels`). The world does not
merge, as on the VPS: decide which side is authoritative, close the world on **both** sides, then copy.

In a session, `zarex97/fgt-worlds` must be among the session's repositories:

- `fvtt-world pull` clones or updates `/home/user/fgt-worlds`, replaces `Data/worlds/fgt2026` with the
  archive's, and restarts Foundry if it is up, since setup lists a newly copied world only after a restart.
- `fvtt-world push` packs the world and its modules, commits and pushes. It refuses an archive over 95 MB
  (GitHub's file limit is 100 MB; past it the repo needs Git LFS).

Both refuse while the world is running (`/api/status` names it): return it to setup, or `fvtt-down`.
`FGT_WORLDS`, `FGT_WORLDS_URL` and `FGT_WORLD_MODULES` override the clone, its remote and the modules.

On the PC, from Git Bash in a clone of `fgt-worlds`, with Foundry closed:

```bash
# PC -> session
tar -czf fgt2026.tgz -C "$LOCALAPPDATA/FoundryVTT/Data" worlds/fgt2026 modules/restored-keep-levels
git add fgt2026.tgz && git commit -m "fgt2026 from the PC" && git push

# session -> PC
git pull && rm -rf "$LOCALAPPDATA/FoundryVTT/Data/worlds/fgt2026" \
  && tar -xzf fgt2026.tgz -C "$LOCALAPPDATA/FoundryVTT/Data"
```

## One licence

The key runs one instance. Stop the PC's desktop app and the VPS's `foundry` unit before `fvtt-up`, and run
`fvtt-down` before you go back to either.

## Things that bite

- **Activation is two POSTs on one session** (`dist/server/views/license.mjs`): `licenseKey`, then the EULA
  signature, which calls Foundry's licence server. The key alone leaves the server on `/license`.
  The signature lands in `/opt/fvtt/data/Config/license.json` and lasts the session.
- **v14 creates a world at `POST /create`** with `{action: "createWorld", id, title, system}`. `/setup`
  refuses `createWorld`. Launch is still `POST /setup` with `{action: "launchWorld", world}`.
- **The container has no world `fgt2026`** until `fvtt-world pull` brings one, or create a throwaway world
  on `fgt`.
- **Playwright runs on Node 22.** Run scripts with `NODE_PATH=$(/opt/node22/bin/npm root -g)
  /opt/node22/bin/node`, and launch Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist`. Core shows its "hardware acceleration" warning on every load; the canvas still
  renders.
- **About 1,600 console lines per load are hook calls**: `module/fgt.mjs` sets `CONFIG.debug.hooks`. Filter
  a capture to `error` and `pageerror`.
- **`tools/fgt-world.mjs` takes Linux for the VPS** (`systemctl`, `/usr/bin/google-chrome`); use
  `fvtt-up` / `fvtt-down` here instead of its `app:*` commands.
