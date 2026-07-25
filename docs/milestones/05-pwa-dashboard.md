# 05 PWA dashboard
## Objective
Provide an installable operational dashboard.
## Scope and required changes
Build responsive Dashboard, History, and Settings views with PrimeVue, manifest, service worker, and smoke test.
## Acceptance criteria
App builds, shell installs/caches, requested fields render, and no token or file-management UI appears.
## Verification
`pnpm --filter @passthrough/web test && pnpm --filter @passthrough/web build`
## Exclusions
Authentication screens, uploads, share targets, previews, downloads, notifications, charts, and themes.
