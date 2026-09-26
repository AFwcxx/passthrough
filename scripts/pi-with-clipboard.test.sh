#!/usr/bin/env bash
set -euo pipefail

test_dir=$(mktemp -d)
socket_pids=()
trap 'for pid in "${socket_pids[@]}"; do kill "$pid" 2>/dev/null || true; done; rm -r -- "$test_dir"' EXIT

mkdir -p "$test_dir/bin" "$test_dir/runtime" "$test_dir/headless"
printf '#!/usr/bin/env bash\nprintf "%%s|%%s|%%s\\n" "${WAYLAND_DISPLAY-unset}" "${PI_CODING_AGENT_DIR-unset}" "$*"\n' > "$test_dir/bin/pi"
chmod +x "$test_dir/bin/pi"

start_socket() {
  python3 -c 'import socket,sys,time; s=socket.socket(socket.AF_UNIX); s.bind(sys.argv[1]); time.sleep(30)' "$1" &
  socket_pids+=("$!")
  for _ in {1..50}; do
    [[ -S "$1" ]] && return
    sleep 0.02
  done
  echo "Test socket was not created: $1" >&2
  exit 1
}

wrapper="$(dirname "$0")/pi-with-clipboard.sh"
path="$test_dir/bin:$PATH"

if env -u WAYLAND_DISPLAY XDG_RUNTIME_DIR="$test_dir/headless" PATH="$path" "$wrapper" 2>"$test_dir/error"; then
  echo 'Headless launch unexpectedly succeeded.' >&2
  exit 1
fi
grep -q 'No Wayland socket found' "$test_dir/error"

start_socket "$test_dir/runtime/wayland-1"
actual=$(env -u WAYLAND_DISPLAY XDG_RUNTIME_DIR="$test_dir/runtime" PI_CODING_AGENT_DIR=/tmp/profile PATH="$path" "$wrapper" --provider openai-codex)
[[ "$actual" == 'wayland-1|/tmp/profile|--provider openai-codex' ]]

actual=$(env -u PI_CODING_AGENT_DIR XDG_RUNTIME_DIR="$test_dir/runtime" WAYLAND_DISPLAY=wayland-1 PATH="$path" "$wrapper" --help)
[[ "$actual" == 'wayland-1|unset|--help' ]]

if XDG_RUNTIME_DIR="$test_dir/runtime" WAYLAND_DISPLAY=wayland-9 PATH="$path" "$wrapper" 2>"$test_dir/error"; then
  echo 'Invalid explicit WAYLAND_DISPLAY unexpectedly succeeded.' >&2
  exit 1
fi
grep -q 'Wayland socket not found: .*/wayland-9' "$test_dir/error"

start_socket "$test_dir/runtime/wayland-2"
if env -u WAYLAND_DISPLAY XDG_RUNTIME_DIR="$test_dir/runtime" PATH="$path" "$wrapper" 2>"$test_dir/error"; then
  echo 'Ambiguous Wayland sockets unexpectedly succeeded.' >&2
  exit 1
fi
grep -q 'Multiple Wayland sockets found' "$test_dir/error"

echo 'pi-with-clipboard tests: OK'
