# Architecture

```mermaid
flowchart LR
  I[iPad Shortcut] -->|multipart HTTP| A[Express API]
  W[Vue PWA] --> A
  A --> D[(SQLite)]
  A --> U[Upload directory]
  A --> J[Clipboard job directory]
  J --> C[Host user agent]
  C -->|wl-copy| G[GNOME Wayland clipboard]
```

Express validates authentication/input, persists upload metadata and preferences, and serves the built PWA. Uploads, SQLite, and clipboard jobs are bind-mounted. The unprivileged host agent is the only component with Wayland clipboard access.
