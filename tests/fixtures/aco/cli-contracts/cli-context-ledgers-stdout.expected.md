# ACO CLI Command Catalog

schemaVersion: aco.cli-command-catalog.v1
commands: 12

<!-- prettier-ignore -->
| Command | Surface | Status | Safety | Owner |
| --- | --- | --- | --- | --- |
| `archon aco bootstrap-codex --event <event> --format markdown\|json [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-codex |
| `archon aco status --cwd <repo> [--json]` | cli | supported | read-only | aco-cli |
| `archon context approval-capsule <prompt> [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-context |
| `archon context approval-capsule-verify [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-context |
| `archon context compile <prompt> [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-context |
| `archon context graph-waivers [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-research |
| `archon context ledgers [prompt] [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-ledgers |
| `archon context route <prompt> [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-bmad |
| `archon context status [prompt] [--no-write-artifact]` | cli | supported | read-only, writes-artifacts | aco-context |
| `archon context validate` | cli | supported | read-only | aco-gates |
| `bun run aco:role-contracts` | script | deferred | read-only | aco-gates |
| `bun run research:graph` | script | approval-required | network, writes-graph-cache | aco-research |
