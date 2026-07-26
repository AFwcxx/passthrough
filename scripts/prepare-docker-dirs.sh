#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $(id -u) == 1000 ]] || {
  echo "This script must run as the desktop user with UID 1000 (the container's node user)." >&2
  exit 1
}

if [[ -f "$root/.env" ]]; then
  source "$root/.env"
fi
upload="${UPLOAD_HOST_DIR:-/tmp/passthrough}"
[[ $upload == /* ]] || upload="$root/$upload"
database="$root/data/database"
clipboard="${XDG_DATA_HOME:-$HOME/.local/share}/passthrough/clipboard"
uid="$(id -u)"
gid="$(id -g)"

sudo_run() {
  command -v sudo >/dev/null || {
    echo "sudo is required to repair a directory not owned by UID $uid." >&2
    exit 1
  }
  sudo "$@"
}

make_dir() {
  mkdir -p -- "$1" 2>/dev/null || sudo_run mkdir -p -- "$1"
}

own_dir() {
  local path=$1 recursive=$2
  if [[ $recursive == yes ]]; then
    if find "$path" \( ! -uid "$uid" -o ! -gid "$gid" \) -print -quit | grep -q .; then
      sudo_run chown -R "$uid:$gid" -- "$path"
    fi
    chmod -R u+rwX,go-rwx -- "$path"
  else
    if [[ $(stat -c '%u:%g' -- "$path") != "$uid:$gid" ]]; then
      sudo_run chown "$uid:$gid" -- "$path"
    fi
    chmod 700 -- "$path"
  fi
}

for path in "$upload" "$database" "$clipboard"; do
  make_dir "$path"
done

own_dir "$upload" no
own_dir "$database" yes
own_dir "$clipboard" yes

for path in "$upload" "$database" "$clipboard"; do
  [[ -w $path ]] || {
    echo "Directory is not writable: $path" >&2
    exit 1
  }
done

printf 'Docker directories are ready:\n  %s\n  %s\n  %s\n' \
  "$upload" "$database" "$clipboard"
