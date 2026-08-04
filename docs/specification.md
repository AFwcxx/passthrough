# Specification

## Requirements

Accept authenticated multipart shares containing one or more files, optional text/URL, and `save`, `clipboard`, or `both`. Use server-generated safe names, enforce the configured file limit, persist item history, and queue only the final clipboard-compatible item (image, text, or URL). Other files are save-only. Provide public health plus authenticated history/settings APIs and an installable dashboard with a separate SQLite-backed file library.

Operational requirements: Node 22, strict TypeScript, SQLite parameter binding, structured logs, graceful shutdown, non-root container, bind mounts, direct HTTP on `0.0.0.0:8787`, and no Wayland socket in Docker.

`POST /api/share` returns `{success, transferId, action, processedItems, savedPaths, clipboardStatus, validationErrors}`. Invalid input is 400, authentication failure 401, oversized files 413, and unexpected errors 500. `GET /api/history` accepts `page`; settings accepts only `defaultAction` and `historyPageSize` (5–100).

The authenticated library API accepts up to 20 files per atomic multipart upload under the configured aggregate upload limit. It stores original filename, MIME type, size, timestamp, and contents in SQLite. Library metadata is listed newest-first in fixed pages of 20; individual files can be downloaded or permanently deleted. Library actions do not alter transfer history or the Shortcut upload directory.

Excluded: users, sessions, OAuth, HTTPS/proxy setup, editable destinations, share-target registration, previews, search, sorting controls, retention, quotas, bulk/ZIP downloads, notifications, charts, themes, and administration.
