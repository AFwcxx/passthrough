# 03 Storage and history
## Objective
Persist transfer records and operational settings.
## Scope and required changes
Create SQLite tables, parameterized writes, paginated history, and validated settings endpoints.
## Acceptance criteria
Transfers persist per item; settings round-trip; destination remains environment-only.
## Verification
`pnpm test && pnpm typecheck`
## Exclusions
Downloads, deletion, previews, retention, and browsing.
