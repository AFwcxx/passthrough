# 02 Upload API
## Objective
Accept authenticated multipart shares safely.
## Scope and required changes
Implement bearer authentication, validation, multiple uploads, safe generated names, maximum size, and consistent responses.
## Acceptance criteria
Empty/invalid requests fail; multiple files save without traversal; oversized uploads return 413.
## Verification
`pnpm --filter @passthrough/api test`
## Exclusions
History UI and direct clipboard access.
