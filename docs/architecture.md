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
                                                  |    Wayland clipboard    |
                                                  +-------------------------+
```

Express validates authentication/input, persists transfer metadata, library files, and preferences, and serves the built PWA. Shortcut uploads, SQLite, and clipboard jobs are bind-mounted. PWA library uploads are staged temporarily inside the container and stored as SQLite BLOBs, independently of Shortcut uploads and history. Images selected for clipboard use are staged beside their job so the host agent never depends on a container-only upload path. The unprivileged host agent is the only component that writes to the Wayland clipboard.

An SSH or tmux process can read that same clipboard when it uses the active
Fedora Wayland socket. `scripts/codex-with-clipboard.sh` supplies that
environment, uses native data-control when available, and adds GNOME's local
XWayland fallback when Mutter authority is present.
