# Clipboard agent

Run `scripts/install-clipboard-agent.sh` from a Fedora GNOME Wayland session. It verifies `wl-copy`, creates user-owned directories, installs the polling Node agent and systemd user unit, reloads systemd, then enables and starts it. No root is needed unless installing `wl-clipboard`.

Rerun the installer after updating Passthrough. It replaces the installed
agent and restarts the service so the running process loads the new version.

The Compose clipboard bind mount must point at `$XDG_DATA_HOME/passthrough/clipboard` (or `~/.local/share/passthrough/clipboard`). Image payloads are staged in this directory, resolved relative to it by the agent, and removed after the copy attempt. Clipboard-only uploads are not retained in the upload directory.

Check `systemctl --user status passthrough-clipboard.service` and logs with `journalctl --user -u passthrough-clipboard.service`. Failures commonly mean the service lacks the active Wayland environment or the mount paths differ. Removal commands are printed by the installer; after removing files, run `systemctl --user daemon-reload`.

For Codex running through SSH or tmux, launch it from the repository with:

```sh
scripts/codex-with-clipboard.sh
```

The wrapper checks the Wayland socket, discovers GNOME's current Mutter
XWayland authority, and passes every argument to Codex. Codex needs XWayland
because GNOME does not expose the Wayland data-control protocol used by its
clipboard library. `PASSTHROUGH_DISPLAY` and `PASSTHROUGH_XAUTHORITY` override
the detected XWayland values when necessary.
