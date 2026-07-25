# 04 Clipboard agent
## Objective
Bridge validated jobs to the Wayland clipboard outside Docker.
## Scope and required changes
Create final-compatible-item jobs, polling agent, result files, systemd user installer, and documentation.
## Acceptance criteria
Jobs contain validated image/text data; `wl-copy` uses argument arrays; installer is idempotent.
## Verification
`pnpm test && bash -n scripts/install-clipboard-agent.sh && node --check scripts/clipboard-agent.mjs`
## Exclusions
Wayland socket mounts and unsupported file clipboard formats.
