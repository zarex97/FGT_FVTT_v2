# 43 — Tooling: Builds, Checks, and Driving a Live World

## What it is

The system has no graphical build. Content is authored as YAML, compiled to LevelDB packs, and validated at build time. Code changes are tested against a real Foundry instance over the Chrome DevTools Protocol — a browser-driven simulator that shuts the world down, verifies Foundry starts correctly, and proves the packs load. Everything runs on the command line.

This chapter covers two halves. The first half is the **build pipeline**: YAML source → validation → pack compilation → release stamping. The second, which gets the most space, is the **live-world drivers**: a set of scripts that drive a real Foundry application from the command line to launch worlds, reload code, rebuild packs, and prove the system comes up correctly.

## Where it lives

| File | Role |
|---|---|
| `tools/validate-content.mjs` | Standalone content validation; runs in CI and before every pack build (`package.json:10`) |
| `tools/build-packs.mjs` | YAML source to LevelDB compendium packs; validation is a prerequisite (`tools/build-packs.mjs:19`) |
| `tools/stage-to-yaml.mjs` | Turns authored export JSON into pack source YAML (`tools/stage-to-yaml.mjs:1-3`) |
| `tools/check-manifest.mjs` | Manifest sanity checks: declared paths must exist; `socket` must be true (`tools/check-manifest.mjs:3-8`) |
| `tools/check-templates.mjs` | Template syntax checks over `templates/` (`tools/check-templates.mjs:1-4`) |
| `tools/check-layers.mjs` | Enforces the layer boundary; runs as part of `npm run lint` (`tools/check-layers.mjs:1-21`) |
| `tools/check-doc-refs.mjs` | Enforces that every `docs/…` reference in the source resolves, and that none point into `docs/plan-archive/`; also in `npm run lint` (`tools/check-doc-refs.mjs:26-33`) |
| `tools/check-release.mjs` | Pre-tag checks: version format, manifest version match, changelog section (`tools/check-release.mjs:1-13`) |
| `tools/release.mjs` | Stamps version and release URLs into `system.json` (`tools/release.mjs:1-9`) |
| `tools/release-notes.mjs` | Writes release notes for a version from changelog, commit log, or a placeholder (`tools/release-notes.mjs:1-20`) |
| `tools/fgt-world.mjs` | Drive Foundry app and world from command line: status, shutdown, launch, join, rebuild, app lifecycle, and browser control (`tools/fgt-world.mjs:1-30`) |
| `tools/fgt-eval.mjs` | Evaluate an expression inside the running Foundry tab over CDP (`tools/fgt-eval.mjs:1-16`) |
| `tools/fgt-reload.mjs` | Reload the Foundry tab and wait for `game.ready`; for code changes only (`tools/fgt-reload.mjs:1-12`) |
| `tools/fgt-rebuild.mjs` | Rebuild packs with the world running; older pattern, superseded by `fgt-world.mjs rebuild` (`tools/fgt-rebuild.mjs:1-12`) |
| `tools/smoke-world.mjs` | Load a world in real Foundry, join, and fail if it does not come up; local gate, not CI (`tools/smoke-world.mjs:22-43`) |

## How it works

### The build pipeline

**Validation** reads YAML under `packs/_source/` and assets under `assets/`, reports errors and warnings, and aborts the build on any error (`tools/validate-content.mjs:1-32`). It is a prerequisite to every build.

**Pack compilation** is a three-step process (`tools/build-packs.mjs:26-79`):

1. **Load.** Validation runs first and fails the build if there are problems (`tools/build-packs.mjs:28`).
2. **Compile.** Each source file is compiled to a JSON document, embedded abilities are resolved through the actor, and every reference marker in descriptions is resolved against a single reference index so links cannot point at documents outside the build (`tools/build-packs.mjs:38-60`).
3. **Write.** Compiled documents are grouped by destination pack, written to a staging directory as JSON, and compiled to LevelDB using the Foundry CLI (`tools/build-packs.mjs:63-75`).

**Manifest and template checks** run as part of `npm run lint` but are not show-stoppers: template errors are reported, manifest errors are reported, and both are fatal (`tools/check-templates.mjs:34-35`, `tools/check-manifest.mjs:46-48`). The layer boundary check is a hard gate — a new violation fails the build.

**Release stamping** is a two-step gate (`tools/check-release.mjs:1-13`, `tools/release.mjs:1-9`):

1. **`npm run check:release -- VERSION`** runs *before* the tag is made, while the commit can still be changed. It verifies the version is semver, the changelog has a section or falls back gracefully, and the manifest matches (`tools/check-release.mjs:17-76`).
2. **`npm run release:stamp -- VERSION owner/repo`** (run in CI after the tag) stamps the version and release URLs into `system.json`, so Foundry installs the exact build not the latest (`tools/release.mjs:1-36`).

### Live-world drivers

These scripts drive a real Foundry application over the Chrome DevTools Protocol. They exist because *the document-touching layers have no unit tests* — they need a live world — and the only way to test them is by proving the world comes up (`tools/smoke-world.mjs:1-21`).

**Browser and application control** (`tools/fgt-world.mjs:52-353`) opens a CDP-enabled Chrome instance and manages the Foundry process:

- `chrome:start` launches Chrome with `--remote-debugging-port` and a profile directory, waits for the debugger to answer.
- `app:start`, `app:stop`, `app:restart` spawn/kill the Foundry executable and poll `:30000` until it answers.

**World control** (`tools/fgt-world.mjs:160-302`) communicates with the running page via CDP:

- `status` reports the app, browser, pages, current world, and whether the game is ready.
- `shutdown` sends a POST to `/setup` with `{shutdown: true}` (the route is read from `Game#shutDown` in Foundry's own source), waits for the page to navigate to `/setup` or `/join`, then sleeps 2s for the LevelDB files to be released (`tools/fgt-world.mjs:184-205`).
- `launch WORLD` navigates to `/setup`, finds the world tile, clicks its play control (the same action a person would take), and waits for the page to reach `/join` or `/game` (`tools/fgt-world.mjs:213-253`). It is clicking the UI rather than using a private socket API because the UI route is the only one that stays supported.
- `join USER` fills the join form on `/join`, submits it, waits for `/game`, then polls `game.ready` for 60s (`tools/fgt-world.mjs:264-302`).
- `rebuild WORLD` chains `shutdown` → `npm run build:packs` → `launch` → `join`, printing only lines matching `packed|Built|error` (`tools/fgt-world.mjs:377-387`).

**Expression evaluation** (`tools/fgt-eval.mjs:1-97`) attaches to the running page, evaluates an expression over CDP, and prints the result as JSON. It detects piped input (a multi-statement script) and treats it as a body rather than an expression (`tools/fgt-eval.mjs:71-73`). Useful for exercising the document-touching layers without clicking the UI.

**Page reload** (`tools/fgt-reload.mjs:1-64`) reloads the page with cache bypass and polls `game.ready` for up to 60s. Module sources are loaded once at page load, so every edit to `module/` is invisible to the live world until the page comes back (`tools/fgt-reload.mjs:5-12`).

**Smoke test** (`tools/smoke-world.mjs:1-43`) is a local gate that proves the world actually comes up. It opens its own tab (to avoid yanking a world out from under someone reading it), launches the world, joins as a user, and fails if `game.ready` never becomes true or if an uncaught exception fires during the sequence (`tools/smoke-world.mjs:85-305`). The `--strict` flag also fails on `console.error` output from the system (`tools/smoke-world.mjs:64`, `tools/smoke-world.mjs:286-289`). It is *not* part of CI — GitHub's runners have no Foundry to point it at — but must be run locally before tagging.

## Invariants & edge cases

1. **LevelDB is held open for the lifetime of the world.** Closing the browser tab does nothing; the Foundry server holds the file handles open. `shutdown` is the only route to release them, and it must wait 2s after the page navigates for the release to complete (`tools/fgt-world.mjs:202-204`).

2. **The world shutdowns requires GM authority.** `Game#shutDown` refuses anyone else, so every driver script joins as the Gamemaster user by default (`tools/fgt-world.mjs:256-261`). A player cannot shut the world down.

3. **`game.ready` lags the navigation.** Every caller of `join` needs a usable world, so it polls `game.ready` rather than returning as soon as `/game` loads (`tools/fgt-world.mjs:293-301`, `tools/fgt-reload.mjs:33-60`).

4. **A page stuck on `/join` with no form is a cold server.** If `/join` loads but the form is missing and `document.readyState === "complete"`, Foundry served the "There is currently no active game session" page, not a session it cannot join. The probe detects this and navigates to `/setup` to start the world (`tools/smoke-world.mjs:172-175`).

5. **A disabled user in the join form is already connected.** Foundry disables a user that is already connected elsewhere in the network. The smoke test names this clearly rather than reporting "the world is broken" (`tools/smoke-world.mjs:257-263`).

## Traps and anti-patterns

**Building packs while the world is running.** `npm run build:packs` fails with `EBUSY: resource busy` when the LevelDB is open. Every content change asks the author to close Foundry, wait, rebuild, relaunch, rejoin, which is tedious and easy to half-finish — a build that failed mid-session leaves the packs as they were, and the next test reports the *old* content as the new content. `fgt-world.mjs rebuild` automates the whole cycle: it shuts the world down (releasing the LevelDB), runs the build, launches the world again, and joins. Nothing else can do this, because a rebuild from the repl would need to fork a process and manage its output. **Shut the world down before `npm run build:packs` and use `fgt-world.mjs rebuild` to do it atomically** (`tools/fgt-world.mjs:377-387`).

**Using `fgt-reload.mjs` for pack changes.** `fgt-reload.mjs` reloads the page with cache bypass. Module sources are cached at page load and reload picks them up, but packs are in LevelDB and a page reload sees the same stale version unless the server lets them go. Only a world shutdown releases the files (`tools/fgt-reload.mjs:5-12`). **Use `fgt-world.mjs rebuild` for pack changes, `fgt-reload.mjs` only for code changes** (`tools/fgt-world.mjs:26`).

**Cross-linking code to documentation without checking the links.** The codebase cites chapters
heavily — 552 `docs/…` references across `module/`, `tools/` and `test/` — which is how a reader
gets from a function to the chapter explaining its shape. Nothing verified them, so when the
chapter set was renumbered every one went stale at once, and four had been dangling for far
longer, naming chapters that never existed in either set. Exactly four were caught, by a unit
test that happens to assert authoring descriptors resolve. **A reference that nothing checks is a
reference that will rot** — `tools/check-doc-refs.mjs` now fails the build on a dangling link or
one pointing into the archive.

## Open questions

- **Shutdown with other users connected.** `Game#shutDown` has a check for other users and opens a confirmation dialog. The script replaces the dialog with an automatic yes. Has this been tested on a multi-user server, where a shutdown might disconnect other players unexpectedly? (`tools/fgt-world.mjs:189-200`.)
- **Partly confirmed: the lock itself is real and observable.** With the world running, every pack
  directory holds a `LOCK` that cannot be opened read-write from another process -- verified live, and
  the reason a rebuild must wait. What the 2-second figure asserts is the *release latency* after
  navigating away, and that is a timing claim about Windows LevelDB which only a
  shutdown-and-immediately-rebuild cycle can measure. The safe half is settled; the number is not.
- **Still open, and it is a tuning question rather than a correctness one.** The 500 ms interval and
  60 s ceiling are read off the source. Whether 60 s is generous or tight depends on world size and
  machine, and the only way to know is to run the smoke test against the largest world available and
  watch where `game.ready` actually lands.
