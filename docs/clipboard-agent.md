# Clipboard agent

Run `scripts/install-clipboard-agent.sh` from a Fedora GNOME Wayland session. It verifies `wl-copy`, creates user-owned directories, installs the polling Node agent and systemd user unit, reloads systemd, then enables and starts it. No root is needed unless installing `wl-clipboard`.

The Compose clipboard bind mount must point at `$XDG_DATA_HOME/passthrough/clipboard` (or `~/.local/share/passthrough/clipboard`). Check `systemctl --user status passthrough-clipboard.service` and logs with `journalctl --user -u passthrough-clipboard.service`. Failures commonly mean the service lacks the active Wayland environment or the mount paths differ. Removal commands are printed by the installer; after removing files, run `systemctl --user daemon-reload`.
