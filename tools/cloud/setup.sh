#!/usr/bin/env bash
# Setup script for the Claude Code cloud environment: the third workplace
# beside the PC and the VPS (docs/agents/cloud.md).
#
# Paste this whole file into the environment's settings (cloud environment
# menu in the session's title bar -> Edit -> Setup script). It runs before the
# session starts and cannot read the environment's variables, so it only
# installs: Node 24 at /opt/node24, and the commands fvtt-up and fvtt-down in
# /usr/local/bin. The licence key is read later, by fvtt-up, from the
# environment variable foundry_license.
#
# Safe to run twice.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-v24.22.2}"

# Foundry 14.364 declares node >=24.13.1 <25; the image ships Node 22.
if [ "$(/opt/node24/bin/node --version 2>/dev/null)" != "$NODE_VERSION" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/node.tar.xz" "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"
  rm -rf /opt/node24 && mkdir -p /opt/node24
  tar -xJf "$tmp/node.tar.xz" -C /opt/node24 --strip-components=1
  rm -rf "$tmp"
fi

mkdir -p /opt/fvtt/data/Data/systems

cat > /usr/local/bin/fvtt-up <<'FVTT_UP'
#!/usr/bin/env bash
# Build the FGT system, link it into /opt/fvtt/data, start Foundry on :30000
# and activate the licence from $foundry_license. Never prints the key.
# Exit 2: foundry_license is not set. Exit 3: activation failed.
set -euo pipefail
export PATH="/opt/node24/bin:$PATH"

REPO="${FGT_REPO:-/home/user/FGT_FVTT_v2}"
APP="${FOUNDRY_APP:-/home/user/foundryVTT_copy/app}"
DATA=/opt/fvtt/data
LOG=/opt/fvtt/foundry.log
PIDFILE=/opt/fvtt/foundry.pid
URL=http://localhost:30000

landing() { curl -s -o /dev/null -w '%{redirect_url}' "$URL/"; }

# Foundry's own packages. No lockfile: the copy does not track one.
if [ ! -d "$APP/node_modules" ]; then
  (cd "$APP" && npm install --omit=dev --no-package-lock --no-audit --no-fund)
fi
if [ ! -d "$REPO/node_modules" ]; then
  (cd "$REPO" && npm ci --no-audit --no-fund)
fi
(cd "$REPO" && npm run build)

mkdir -p "$DATA/Data/systems"
ln -sfn "$REPO" "$DATA/Data/systems/fgt"

if ! curl -s -o /dev/null "$URL/"; then
  # Node itself in the background, every stream off the caller's: a backgrounded
  # `cd && node` list leaves a shell holding the caller's stdout open.
  cd "$APP"
  nohup node main.js --dataPath="$DATA" --port=30000 --noupnp < /dev/null > "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  cd - > /dev/null
  for _ in $(seq 1 60); do curl -s -o /dev/null "$URL/" && break; sleep 1; done
fi

if [[ "$(landing)" == */license ]]; then
  if [ -z "${foundry_license:-}" ]; then
    echo "fvtt-up: foundry_license is not set" >&2
    exit 2
  fi
  # Two POSTs on one session (dist/server/views/license.mjs): the key, then
  # the EULA signature, which calls Foundry's licence server.
  jar="$(mktemp)"
  printf '%s' "$foundry_license" | curl -s -o /dev/null -c "$jar" -b "$jar" --data-urlencode 'licenseKey@-' "$URL/license"
  curl -s -o /dev/null -c "$jar" -b "$jar" --data 'agree=on' "$URL/license"
  rm -f "$jar"
fi

where="$(landing)"
case "$where" in
  */setup|*/auth|*/join|*/game) echo "fvtt-up: Foundry is up at ${where:-$URL}" ;;
  *) echo "fvtt-up: licence not active, Foundry redirects to ${where:-nothing}; see $LOG" >&2; exit 3 ;;
esac
FVTT_UP

cat > /usr/local/bin/fvtt-down <<'FVTT_DOWN'
#!/usr/bin/env bash
# Stop the Foundry that fvtt-up started.
# A bracketed pattern, so the search does not find this shell (docs/agents/vps.md).
pids="$(ps -eo pid,args | grep '[m]ain.js --dataPath=/opt/fvtt/data' | awk '{print $1}')"
[ -n "$pids" ] && kill $pids 2>/dev/null
rm -f /opt/fvtt/foundry.pid
# Foundry closes its databases before it lets go of the port; wait for that,
# or an fvtt-up straight after finds the old server still answering.
for _ in $(seq 1 30); do curl -s -o /dev/null http://localhost:30000/ || { echo "fvtt-down: stopped"; exit 0; }; sleep 1; done
echo "fvtt-down: Foundry still answers on :30000" >&2
exit 1
FVTT_DOWN

chmod +x /usr/local/bin/fvtt-up /usr/local/bin/fvtt-down
