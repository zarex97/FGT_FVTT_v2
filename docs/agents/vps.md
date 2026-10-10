# Two workplaces: this PC and the VPS

The system is developed in two places, each with its own clone, its own Foundry and its own copy of
world `fgt2026`.

| | PC (Windows) | VPS (Ubuntu 24.04, `ssh foundry-dev`) |
|---|---|---|
| Repo | `~/OneDrive/Documentos/GitHub/FGT_FVTT_v2`, junctioned as `Data/systems/fgt` | a real clone **at** `~/foundrydata/Data/systems/fgt` |
| Foundry | desktop app, 14.364 | Node build 14.364 in `~/foundry`, systemd unit `foundry`, behind Caddy on HTTPS |
| Data | `%LOCALAPPDATA%/FoundryVTT/Data` | `~/foundrydata/Data` |
| Foundry source for tests | `../foundryVTT_copy` (the default) | `~/foundryVTT_copy`, sparse like CI (`app/common`, `app/client/canvas/perception`); `FOUNDRY_PATH` is exported in `~/.profile` and `~/.bashrc` |
| Debug Chrome | windowed, `chrome.exe` | headless, `/usr/bin/google-chrome`, WebGL in SwiftShader |

`tools/fgt-world.mjs` picks the right column by `process.platform`. On Linux, `app:start` / `app:stop`
are `sudo systemctl start|stop foundry` -- the server **every** world on the VPS shares, the PF2e world
`pf` too.

## One licence

One Foundry key runs one instance. While the VPS Foundry is up, the desktop app on the PC stays closed,
and the VPS launches one world at a time: `fgt2026` and the PF2e session's `pf` take turns. Check
`curl -s localhost:30000/api/status` on the VPS before launching; it names the active world.

## Keeping the two in step

- **Code** moves through git only. Commit and push from whichever side you worked on, pull on the other.
  Packs are built output (`packs/*/` is ignored): run `npm run build` after a pull that touches
  `packs/_source`, with the world shut down (the LevelDB lock).
- **The world** does not merge. After a copy the two diverge, so decide which side is authoritative,
  close the world on **both** sides, and copy that way:

  ```bash
  # PC -> VPS, from Git Bash on the PC
  cd "$LOCALAPPDATA/FoundryVTT/Data/worlds"
  tar -cf - fgt2026 | ssh foundry-dev 'rm -rf ~/foundrydata/Data/worlds/fgt2026 && tar -xf - -C ~/foundrydata/Data/worlds'

  # VPS -> PC
  ssh foundry-dev 'tar -cf - -C ~/foundrydata/Data/worlds fgt2026' | tar -xf - -C "$LOCALAPPDATA/FoundryVTT/Data/worlds"
  ```

- **Modules**: the world enables one, `restored-keep-levels` 1.4.0. It was copied to the VPS from the PC.
  A newly copied system, world or module may need a Foundry restart before setup lists it.

## Passwords

The VPS is on a public hostname, so its setup screen has an administrator password and world `fgt2026`'s
Gamemaster needs one too. `tools/fgt-world.mjs` reads them from files the user writes on the VPS, and
never prints them:

| File | Used by | Override |
|---|---|---|
| `~/.foundry-admin-password` | `launch`, at `/auth` | `FGT_ADMIN_PASSWORD_FILE` |
| `~/.fgt-gm-password` | `join` | `FGT_GM_PASSWORD_FILE` |

The user writes each one, so no password passes through a command line or a transcript:

```bash
umask 077; read -rsp "password: " p; printf %s "$p" > ~/.fgt-gm-password; unset p
```

Without the files, both are blank -- the PC's behaviour.

## Remote Control

A general Claude Code session runs on the VPS under the systemd unit `claude-rc`: `claude remote-control
--name vps --permission-mode auto` inside tmux session `claude-rc`, in `~/workspace`. It starts at boot and
restarts 30 s after a crash. Open it as `vps` from claude.ai/code or the Claude app, then `cd` to
`~/foundrydata/Data/systems/fgt`. To look at its screen: `ssh foundry-dev -t tmux attach -t claude-rc`,
then `Ctrl-b d`. Keep `remain-on-exit` off in tmux, or a dead pane holds the unit up and it never restarts.

## Things that bite

- One GM client per world: close the user's GM tab before a headless `join`.
- Lightsail CPUs are burstable. Close the headless Chrome when done; a long render drains credits.
- Norton on the PC re-signs HTTPS, so `curl` on the PC fails certificate checks against the VPS. Check
  from the VPS itself.
- A folder without a manifest inside `Data/systems` or `Data/modules` is scanned as a broken package.
  Reference source, like `~/foundryVTT_copy`, lives outside `Data`.
- Each repo needs one interactive `claude` run on the VPS so the user can accept folder trust.

## Driving the board headless

Lessons from driving Nemo's audit over CDP (`docs/surprises/patterns/vps-drive-kit.md`):

- **Drags move no token** over CDP's `Input.dispatchMouseEvent`, though clicks work. Cause not found. Move
  with `TokenDocument#move`, the call a drag ends in, and record the Clause as `Pressed (engine)`.
- **The full suite outruns a 600 s tool call** on the VPS's 2 CPUs, and a pipe to `grep` hides even partial
  output. Run it in the background to a log and read the log. Run single files in the foreground.
- **`pkill -f <pattern>` kills its own shell**, since the shell's command line holds the pattern (exit 144).
  Kill by PID with a bracketed pattern: `ps -eo pid,args | grep "[r]emote-debugging-port=9222" | awk '{print $1}' | xargs -r kill`.

