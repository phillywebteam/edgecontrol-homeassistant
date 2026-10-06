#!/bin/sh
# Installs HomeAssistant.ecplugin into EdgeControl's Plugins folder and restarts EdgeControl.
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
bundle="HomeAssistant.ecplugin"
dest="$HOME/Library/Application Support/EdgeControl/Plugins/$bundle"
mkdir -p "$(dirname "$dest")"
rm -rf "$dest"
ditto "$root/$bundle" "$dest"
echo "Installed $bundle"

if pgrep -x EdgeControl >/dev/null; then
  osascript -e 'quit app "EdgeControl"' >/dev/null 2>&1 || true
  i=0
  while pgrep -x EdgeControl >/dev/null && [ "$i" -lt 30 ]; do
    sleep 0.3
    i=$((i + 1))
  done
fi
# EdgeControl can still be shutting down or starting up; retry the launch.
i=0
until open -a EdgeControl 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -ge 5 ] && { echo "Couldn't reopen EdgeControl; open it yourself." >&2; exit 1; }
  sleep 1
done
echo "Restarted EdgeControl"
