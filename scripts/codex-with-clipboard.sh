#!/usr/bin/env bash
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  wayland_sockets=()
  for candidate in "$XDG_RUNTIME_DIR"/wayland-*; do
    [[ -S "$candidate" ]] && wayland_sockets+=("$candidate")
  done

  case ${#wayland_sockets[@]} in
    0) exec codex "$@" ;;
    1) export WAYLAND_DISPLAY="${wayland_sockets[0]##*/}" ;;
    *)
      echo "Multiple Wayland sockets found; set WAYLAND_DISPLAY explicitly." >&2
      printf '  %s\n' "${wayland_sockets[@]##*/}" >&2
      exit 1
      ;;
  esac
fi

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
if [[ -n "$xauthority" ]]; then
  if [[ ! -f "$xauthority" ]]; then
    echo "XWayland authority not found: $xauthority" >&2
    exit 1
  fi
  export XAUTHORITY="$xauthority"
else
  unset XAUTHORITY
fi

exec codex "$@"
