#!/usr/bin/env bash
set -euo pipefail
command -v wl-copy >/dev/null || { echo "wl-copy is required (Fedora: sudo dnf install wl-clipboard)"; exit 1; }
command -v magick >/dev/null || { echo "magick is required (Fedora: sudo dnf install ImageMagick)"; exit 1; }
data="${XDG_DATA_HOME:-$HOME/.local/share}/passthrough"
unit="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$data/clipboard" "$unit"
install -m 755 "$(dirname "$0")/clipboard-agent.mjs" "$data/clipboard-agent.mjs"
sed "s|__AGENT__|$data/clipboard-agent.mjs|;s|__DIR__|$data/clipboard|" >"$unit/passthrough-clipboard.service" <<'UNIT'
[Unit]
Description=Passthrough clipboard agent
[Service]
ExecStart=/usr/bin/node __AGENT__
Environment=PASSTHROUGH_CLIPBOARD_DIR=__DIR__
Restart=on-failure
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable passthrough-clipboard.service
systemctl --user restart passthrough-clipboard.service
echo "Verify: systemctl --user status passthrough-clipboard.service"
echo "Logs: journalctl --user -u passthrough-clipboard.service"
echo "Remove: systemctl --user disable --now passthrough-clipboard.service; rm '$unit/passthrough-clipboard.service' '$data/clipboard-agent.mjs'"
