# 05 PWA dashboard

## Objective

Provide an installable operational dashboard.

## Scope and required changes

Build responsive Dashboard, History, and Settings views with PrimeVue, manifest, service worker, and smoke test.

## Acceptance criteria

App builds, shell installs/caches, requested fields render, and operational views contain no token-management or file-management UI.

## Verification

`pnpm --filter @passthrough/web test && pnpm --filter @passthrough/web build`

## Exclusions

User accounts, login/session flows, token display or management, uploads, share targets, previews, downloads, notifications, charts, and themes.
