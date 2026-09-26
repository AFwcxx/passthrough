#!/usr/bin/env bash
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  wayland_sockets=()
  for candidate in "$XDG_RUNTIME_DIR"/wayland-*; do
    [[ -S "$candidate" ]] && wayland_sockets+=("$candidate")
  done

  case ${#wayland_sockets[@]} in
    0)
      echo "No Wayland socket found in $XDG_RUNTIME_DIR; use pi directly for headless sessions." >&2
      exit 1
      ;;
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
  exit 1
fi

exec pi "$@"
