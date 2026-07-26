# Fedora and iPhone/iPad setup

This guide starts with Docker, Docker Compose, and Tailscale already installed
and connected. Run the Fedora commands from the Passthrough repository.

## 1. Configure Passthrough on Fedora

Create the environment file:

```sh
cp .env.example .env
```

Generate a token:

```sh
openssl rand -hex 32
```

Edit `.env` and replace `replace-with-a-long-random-token` with that token.
Keep it available for the Apple Shortcut and the web dashboard.

The defaults save received files in `/tmp/passthrough`. To use a permanent
location, change `UPLOAD_HOST_DIR` in `.env` before continuing.

Prepare the host directories:

```sh
scripts/prepare-docker-dirs.sh
```

Build and start Passthrough:

```sh
docker compose up --build -d
```

Verify that the container is running and the API is healthy:

```sh
docker compose ps
curl http://localhost:8787/api/health
```

The health response should contain `"status":"ok"`. A clipboard-agent status
of `unavailable` is expected until the optional clipboard setup below is
complete.

## 2. Set up clipboard support on Fedora (optional)

Skip this section if the Shortcut will only use the `save` action.

Clipboard support requires Fedora GNOME Wayland, Node 22 at `/usr/bin/node`,
and `wl-copy`. Check Node and install `wl-copy` if needed:

```sh
/usr/bin/node --version
sudo dnf install wl-clipboard
```

Run the installer from your active GNOME Wayland desktop session:

```sh
scripts/install-clipboard-agent.sh
```

The installer can also be rerun after an update; it replaces and restarts the
agent so the running service uses the current repository version.

Verify the user service and check the API again:

```sh
systemctl --user status passthrough-clipboard.service
curl http://localhost:8787/api/health
```

The health response should now report the clipboard agent as `running`.

The actions behave as follows:

- `save` stores shared files on Fedora.
- `clipboard` copies the final compatible image, text, or URL to the Fedora
  clipboard without retaining uploaded files or staged image payloads.
- `both` saves files and copies the final compatible item.

To paste that Fedora clipboard into Codex through SSH or tmux, launch Codex
from this repository with:

```sh
scripts/codex-with-clipboard.sh
```

Pass Codex options normally, for example
`scripts/codex-with-clipboard.sh --no-alt-screen`. The wrapper configures the
active Fedora Wayland socket and GNOME's XWayland fallback, then fails clearly
if either is unavailable.

If multiple accounts use `CODEX_HOME`, alias the base command to the wrapper
before defining the account aliases:

```sh
alias codex="$HOME/Developments/pwa/passthrough/scripts/codex-with-clipboard.sh"
alias codex-tech='CODEX_HOME=$HOME/.codex-tech codex'
alias codex-ops='CODEX_HOME=$HOME/.codex-ops codex'
alias codex-su='CODEX_HOME=$HOME/.codex-su codex'
```

The wrapper preserves `CODEX_HOME`, so each alias continues using its own
authentication, configuration, and session data.

## 3. Find the Fedora address

On Fedora, get its Tailscale IPv4 address:

```sh
tailscale ip -4
```

The service URL for the iPhone or iPad is:

```text
http://FEDORA_TAILSCALE_IP:8787
```

While the Apple device is connected to the same tailnet, open that URL in
Safari. Enter the token from `.env` when prompted. This verifies connectivity
and opens the read-only dashboard.

## 4. Create the iPhone/iPad Shortcut

1. In Shortcuts, create a shortcut named **Send to Passthrough**.
2. Tap **•••** to open the shortcut. Open the shortcut-name menu, tap
   **Details** (**ⓘ** on older iOS versions), and enable **Show in Share
   Sheet**.
3. In the new **Receive Any Input from Share Sheet** action, tap **Any** and
   select **Images**, **Files**, **URLs**, and **Text**.
4. Add **Choose from Menu** with **Save**, **Clipboard**, and **Both**. Set a
   Text value in each branch to `save`, `clipboard`, or `both`, respectively,
   and store the result in an `action` variable.
5. Add **Get Contents of URL** after the menu. Use
   `http://FEDORA_TAILSCALE_IP:8787/api/share`, method **POST**, and request
   body **Form**.
6. Add an `action` form field using the `action` variable.
7. For images or files, add a `files` form field using **Shortcut Input**.
   Allow multiple items.
8. For shared text, use a `text` form field. For a shared URL, use a `url`
   form field. Use the corresponding Shortcut Input value.
9. Add an `Authorization` header with this value, replacing the placeholder
   with the token from `.env`:

   ```text
   Bearer YOUR_LONG_TOKEN
   ```

10. Add **Show Result** after the request so the response displays `success`,
    `transferId`, and `clipboardStatus`.

## 5. Test end to end

From the Share Sheet on the iPhone or iPad:

1. Share a small file and select **Save**.
2. Confirm the Shortcut reports success.
3. Confirm the file appears in `UPLOAD_HOST_DIR` on Fedora and the transfer
   appears in the web dashboard.
4. If clipboard support is enabled, share text with **Clipboard**, then paste
   it into an application on Fedora.

## Troubleshooting

Check the container and API:

```sh
docker compose ps
docker compose logs
curl http://localhost:8787/api/health
```

Check the clipboard agent:

```sh
systemctl --user status passthrough-clipboard.service
journalctl --user -u passthrough-clipboard.service
```

- `401` means the Shortcut token does not exactly match `AUTH_TOKEN` in
  `.env`.
- A connection failure usually means the Apple device cannot reach the Fedora
  Tailscale address or port 8787.
- `unable to open database file` or upload failures commonly mean
  `scripts/prepare-docker-dirs.sh` was skipped or could not prepare writable
  directories. Run it again and resolve any reported ownership error before
  restarting Compose.
- Clipboard jobs that remain queued usually mean the agent is not running
  inside the active Wayland session, or the Compose and agent clipboard
  directories do not match.
- `Wayland socket not found` from the Codex wrapper means the Fedora desktop
  session is not active or uses a different socket. Check
  `ls "$XDG_RUNTIME_DIR"/wayland-*` and set `WAYLAND_DISPLAY` to the socket
  name before rerunning the wrapper.
