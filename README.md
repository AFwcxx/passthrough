# Passthrough

Self-hosted iPad Share Sheet receiver for a Fedora workstation over Tailscale. Express serves the Vue PWA and API; SQLite stores settings/history; files and clipboard jobs use bind mounts; a user service performs Wayland clipboard writes.

For complete Fedora and iPhone/iPad instructions, start with the
[end-to-end setup guide](docs/setup.md).

## Prerequisites and development

Node 22, pnpm, and (for clipboard use) Fedora GNOME Wayland with `wl-copy`.

```sh
cp .env.example .env
pnpm install
set -a; . ./.env; set +a
pnpm dev
```

Build with `pnpm build`. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Docker Compose

Replace `AUTH_TOKEN` in `.env` with a long random secret. Create the bind directories as your desktop user with `mkdir -p "${UPLOAD_HOST_DIR:-/tmp/passthrough}" data/database "${XDG_DATA_HOME:-$HOME/.local/share}/passthrough/clipboard"`, then run `docker compose up --build -d`. The service listens on HTTP port 8787. Configure `UPLOAD_HOST_DIR`, `MAX_UPLOAD_BYTES`, and other paths from `.env.example`; the destination is intentionally not editable in the PWA.

On each trusted browser, open the PWA and enter the token when prompted. The PWA verifies it and stores it in that browser for future visits.

Install the host agent with `scripts/install-clipboard-agent.sh`, ensuring its clipboard directory matches the Compose mount. Focused references are available for the [clipboard agent](docs/clipboard-agent.md), [Apple Shortcut](docs/ipad-shortcut.md), and [architecture](docs/architecture.md).

When running Codex through SSH or tmux, use
`scripts/codex-with-clipboard.sh` so Codex can read the active Fedora Wayland
clipboard. The wrapper accepts the same arguments and preserves `CODEX_HOME`,
so account-specific Codex aliases can call it without sharing account state.

## Security and troubleshooting

This is for a trusted Tailscale network: traffic is HTTP, bearer tokens are visible to endpoints/network peers, and there are no users or public-internet protections. Keep bind-mounted directories private. Health is public at `/api/health`; every other API route requires the bearer header. If uploads fail, check directory ownership and `docker compose logs`; if clipboard jobs stall, check `journalctl --user -u passthrough-clipboard.service`, Wayland session variables, and the shared mount.
