#!/usr/bin/env bash
set -euo pipefail

dir="${PASSTHROUGH_CLIPBOARD_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/passthrough/clipboard}"
service=passthrough-clipboard.service

[[ -d "$dir" ]] || {
  echo "Clipboard directory does not exist: $dir" >&2
  exit 1
}

state=""
if ! state="$(systemctl --user is-active "$service" 2>/dev/null)"; then
  case "$state" in
    inactive|dead|exited|failed|unknown) ;;
    *)
      echo "Could not determine clipboard service state: ${state:-unavailable}" >&2
      exit 1
      ;;
  esac
fi

was_active=0
restart() {
  if ((was_active)); then
    systemctl --user start "$service"
  fi
}
trap restart EXIT

if [[ $state == active ]]; then
  was_active=1
  systemctl --user stop "$service"
fi

shopt -s nullglob
jobs=("$dir"/*.json.working)
if ((${#jobs[@]} == 0)); then
  echo "No stranded clipboard jobs found in $dir"
  exit 0
fi

for working in "${jobs[@]}"; do
  job="${working%.working}"
  [[ ! -e "$job" ]] || {
    echo "Refusing to overwrite existing job: $job" >&2
    exit 1
  }
  mv -- "$working" "$job"
  echo "Requeued: $(basename "$job")"
done
