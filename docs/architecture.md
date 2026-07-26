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

Express validates authentication/input, persists upload metadata and preferences, and serves the built PWA. Uploads, SQLite, and clipboard jobs are bind-mounted. The unprivileged host agent is the only component with Wayland clipboard access.
