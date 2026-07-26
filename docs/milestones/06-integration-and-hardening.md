# 06 Integration and hardening

## Objective

Verify the production deployment boundary.

## Scope and required changes

Serve web output from Express, validate startup configuration, add graceful shutdown, logging, non-root image, health check, and complete documentation.

## Acceptance criteria

All checks pass; Compose resolves; health responds after startup; security limitations are documented.

## Verification

`pnpm lint && pnpm typecheck && pnpm test && pnpm build && docker compose config && docker compose up --build -d`

## Exclusions

HTTPS, reverse proxies, certificates, public deployment, users, and OAuth.
