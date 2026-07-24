Build a production-quality monorepo named passthrough.

Objective

Create a self-hosted service that receives content shared from an iPad Shortcut over a Tailscale network, saves it on a Fedora workstation, optionally places supported content into the GNOME Wayland clipboard, and provides a minimal PWA for configuration and transfer history.

Keep the implementation simple. Do not add features outside this specification.

Stack

* Node.js 22
* TypeScript
* Express
* Vue 3
* Vite
* PrimeVue using its default theme
* SQLite
* pnpm workspaces
* Docker Compose
* Vitest
* Fedora GNOME Wayland
* wl-copy for clipboard integration

Repository structure

passthrough/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   └── shared/
├── scripts/
├── docs/
│   ├── specification.md
│   ├── architecture.md
│   ├── ipad-shortcut.md
│   ├── clipboard-agent.md
│   └── milestones/
│       ├── 01-project-foundation.md
│       ├── 02-upload-api.md
│       ├── 03-storage-and-history.md
│       ├── 04-clipboard-agent.md
│       ├── 05-pwa-dashboard.md
│       └── 06-integration-and-hardening.md
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── README.md

Deployment

Build the Vue application and serve its static output from Express.

Run the main application as one Docker Compose service.

Expose the application directly over HTTP. Do not configure HTTPS, a reverse proxy, certificates, or public internet deployment.

Default configuration:

PORT=8787
UPLOAD_HOST_DIR=/tmp/passthrough
UPLOAD_CONTAINER_DIR=/data/uploads
DATABASE_PATH=/data/database/passthrough.sqlite
AUTH_TOKEN=replace-with-a-long-random-token
MAX_UPLOAD_BYTES=52428800

Bind Express to 0.0.0.0.

Use host bind mounts for:

* ${UPLOAD_HOST_DIR} to /data/uploads
* a persistent local directory to /data/database
* a clipboard-request directory shared with the host clipboard agent

The upload directory is intentionally temporary and may be cleared by the operating system.

Authentication

Require this header for all API endpoints except health checks and static PWA assets:

Authorization: Bearer <AUTH_TOKEN>

Use constant-time token comparison.

Do not implement users, sessions, login pages, token rotation, or OAuth.

Upload API

Implement:

POST /api/share
Content-Type: multipart/form-data
Authorization: Bearer <token>

Accepted fields:

* files: one or more uploaded files
* text: optional plain text
* url: optional URL
* action: save, clipboard, or both

Support multiple files immediately.

Rules:

* At least one file, text value, or URL is required.
* Generate safe server-side filenames.
* Preserve a sanitized original filename where practical.
* Prevent path traversal.
* Enforce the configured maximum request size.
* Do not execute or interpret uploaded content.
* Save all uploaded files for save and both.
* For clipboard, files that cannot be copied to the clipboard may still be saved temporarily when required for processing.

Clipboard behavior:

* Images: copy as image content.
* Plain text: copy as text.
* URLs: copy as text.
* Other file types: save only and report that clipboard handling was skipped.
* When multiple clipboard-compatible items are submitted, copy only the final compatible item and document this behavior.

Return structured JSON containing:

* success status
* transfer ID
* action
* processed items
* saved paths relative to the upload root
* clipboard status
* validation errors

Add:

GET /api/health
GET /api/history
GET /api/settings
PUT /api/settings

The fixed destination directory is configured through Docker Compose and must not be editable from the PWA.

Settings may only contain simple operational preferences such as the default share action. Store settings in SQLite.

Transfer history

Persist minimal history in SQLite:

* transfer ID
* timestamp
* original filename or content label
* saved filename
* MIME type
* byte size
* requested action
* save result
* clipboard result
* error message

The PWA must not provide file downloads, file previews, file deletion, retention controls, or filesystem browsing.

Clipboard agent

Do not expose the Wayland socket to Docker.

Implement a small host-side clipboard agent that:

1. Runs as a systemd user service.
2. Watches or polls a shared clipboard-request directory.
3. Reads validated job files created by the API.
4. Invokes wl-copy directly without shell interpolation.
5. Supports image, text, and URL clipboard jobs.
6. Records completion or failure so the API can update history.
7. Removes completed job files safely.

Provide an idempotent Bash installer in:

scripts/install-clipboard-agent.sh

The installer must:

* verify that wl-copy is available
* create required user directories
* install the agent files
* install a systemd user unit
* run systemctl --user daemon-reload
* enable and start the service
* print verification and uninstall commands

Document installation, troubleshooting, logs, Wayland requirements, and removal in docs/clipboard-agent.md.

Do not require root privileges unless installing a missing operating-system package.

PWA

Create a responsive installable Vue PWA using PrimeVue default styling.

Pages:

Dashboard

Show:

* API health
* clipboard-agent status
* upload directory
* recent transfer summary

History

Show a simple paginated table containing:

* timestamp
* item
* type
* size
* action
* save result
* clipboard result

Settings

Allow configuration of:

* default action: save, clipboard, or both
* history page size

Do not expose the authentication token in the PWA UI.

Do not add authentication screens, uploads from the PWA, file management, downloads, previews, notifications, charts, themes, or administrative features.

Include a valid web app manifest and service worker sufficient for installation and basic application-shell caching. Do not attempt to register the PWA as an iPadOS share target.

iPad Shortcut documentation

Create docs/ipad-shortcut.md with precise steps to build an Apple Shortcut named Send to Passthrough.

The Shortcut must:

* appear in the iPadOS Share Sheet
* accept images, files, URLs, and text
* accept multiple shared files
* send a multipart HTTP POST to /api/share
* include the bearer token
* include the selected action
* display a concise success or error result

Document how to configure:

* the Fedora Tailscale hostname or IP
* port 8787
* bearer token
* default action
* accepted Share Sheet content types

Do not claim that the PWA itself can receive iPadOS Share Sheet content.

Shared package

Use packages/shared only for genuinely shared TypeScript types, schemas, and constants.

Use a schema-validation library for API inputs and shared response contracts.

Do not create unnecessary abstractions, generic frameworks, dependency-injection containers, event buses, plugin systems, or repository layers.

Testing

Implement:

* API unit tests
* upload integration tests
* bearer-token authentication tests
* multiple-file upload tests
* path-traversal tests
* request-size tests
* input-validation tests
* SQLite history tests
* clipboard-job creation tests
* Vue component smoke tests

Clipboard tests must mock process execution and must not modify the developer’s real clipboard.

Provide linting, type checking, testing, build, and development commands at the repository root.

Documentation

README.md must include:

* purpose
* architecture summary
* prerequisites
* local development
* Docker Compose deployment
* configuration
* clipboard-agent installation
* iPad Shortcut setup
* test commands
* security limitations
* troubleshooting

docs/specification.md must define functional requirements, non-functional requirements, API behavior, validation rules, and explicit exclusions.

docs/architecture.md must contain a concise Mermaid component diagram and explain the API, SQLite database, upload directory, clipboard job directory, host agent, PWA, and iPad Shortcut.

Each milestone document must include:

* objective
* scope
* required changes
* acceptance criteria
* verification commands
* explicit exclusions

Each milestone must be independently executable in one Codex CLI development session.

Quality requirements

* Enable strict TypeScript.
* Validate environment variables at startup.
* Use structured logging.
* Handle graceful shutdown.
* Use parameterized SQLite queries.
* Never construct shell commands from user-controlled input.
* Never allow clients to choose filesystem paths.
* Return consistent API errors.
* Include .gitignore, .dockerignore, and .env.example.
* Ensure Docker containers run as a non-root user.
* Add health checks to Docker Compose.
* Ensure pnpm install, linting, type checking, tests, production build, and Docker Compose startup succeed.

Implement the repository completely. After implementation, run all verification commands and fix every failure. End with a concise summary of completed work, commands executed, and any remaining limitations.
