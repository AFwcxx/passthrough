# Architecture

```text
+---------------+  multipart HTTP  +-------------+  +--------+
| iPad Shortcut | ---------------->|             |->| SQLite |
+---------------+                  |             |  +--------+
                                   |             |
+---------+                        | Express API |  +------------------+
| Vue PWA | ---------------------->|             |->| Upload directory |
+---------+                        |             |  +------------------+
                                   |             |
                                   |             |  +-------------------------+
                                   +-------------+->| Clipboard job directory |
                                                    +-------------------------+
                                                                 |
                                                                 v
                                                        +-----------------+
                                                        | Host user agent |
                                                        +-----------------+
                                                                 |
                                                              wl-copy
                                                                 |
                                                                 v
                                                  +-------------------------+
                                                  | GNOME Wayland clipboard |
                                                  +-------------------------+
```

Express validates authentication/input, persists upload metadata and preferences, and serves the built PWA. Uploads, SQLite, and clipboard jobs are bind-mounted. Images selected for clipboard use are staged beside their job so the host agent never depends on a container-only upload path. The unprivileged host agent is the only component that writes to the Wayland clipboard.

An SSH or tmux process can read that same clipboard when it uses the active
Fedora Wayland socket. `scripts/codex-with-clipboard.sh` supplies that
environment plus GNOME's local XWayland fallback, which Codex uses when
Wayland data-control is unavailable.
