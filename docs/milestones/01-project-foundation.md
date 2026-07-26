# 01 Project foundation

## Objective

Create the Node 22 pnpm workspace and build pipeline.

## Scope and required changes

Add root configuration, shared types, Express/Vue packages, Dockerfile, Compose, and environment template.

## Acceptance criteria

Dependencies install; strict type checking and empty application builds succeed.

## Verification

`pnpm install && pnpm typecheck && pnpm build`

## Exclusions

Upload behavior, persistence, clipboard integration, and UI features.
