#!/usr/bin/env bash
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"

socket="$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY"
if [[ ! -S "$socket" ]]; then
  echo "Wayland socket not found: $socket" >&2
  echo "Start a Fedora Wayland session or set WAYLAND_DISPLAY explicitly." >&2
  exit 1
fi

export DISPLAY="${PASSTHROUGH_DISPLAY:-:0}"
xauthority="${PASSTHROUGH_XAUTHORITY:-}"
if [[ -z "$xauthority" ]]; then
  for candidate in "$XDG_RUNTIME_DIR"/.mutter-Xwaylandauth.*; do
    if [[ -f "$candidate" && ( -z "$xauthority" || "$candidate" -nt "$xauthority" ) ]]; then
      xauthority="$candidate"
    fi
  done
fi
if [[ ! -f "$xauthority" ]]; then
  echo "GNOME XWayland authority not found in $XDG_RUNTIME_DIR." >&2
  exit 1
fi
export XAUTHORITY="$xauthority"

exec codex "$@"
