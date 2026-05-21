# ACO Baseline

Date: 2026-05-17
Repository: current checkout root
Branch: recorded by `git branch --show-current` during each stabilization run

## Purpose

Record the known Archon state before ACO production behavior is implemented.

## Bootstrap Evidence

- Research scripts exist under `scripts/research/`.
- Research workspace exists under `research/`.
- Upstream manifest exists at `docs/context-orchestrator/research/upstream-manifest.json`.
- Research cache paths are gitignored: `research/upstreams/`, `research/graphs/`, `research/merged/`, `graphify-out/`.
- Research corpus validation passed with no warnings or errors.
- SDD scaffold validation passed.

## Command Baseline

Commands were run with the local CLI entrypoint, `bun run cli`, because this checkout does not require a globally installed `archon` binary.

| Check | Result | Notes |
| --- | --- | --- |
| `bun run cli doctor` | passed | SQLite reachable, workspace writable, bundled defaults loaded. GitHub, Pi, Slack, Telegram skipped because not configured. |
| `bun run cli workflow list --cwd .` | passed | 39 workflows discovered: 20 app defaults, 2 home workflows, plus repo workflows. |
| `bun run cli validate commands --cwd .` | passed | 59 commands and scripts valid. |
| `bun run cli validate workflows --cwd .` | failed | 38 workflows valid, 1 error. `archon-smart-pr-review` references optional `.archon/mcp/ntfy.json`, which is absent. |

## Build And Test Baseline

| Check | Result | Notes |
| --- | --- | --- |
| `bun run test` | passed | Per-package isolated test command completed after test isolation fix for user-level command leakage. |
| `bun run type-check` | passed | Package type-check plus `scripts/tsconfig.json`. |
| `bun run build` | passed | Vite emitted existing large chunk warning only. |
| `bun run lint` | passed | Local `.agents/` and research caches are ignored as non-source artifacts. |
| `bun run format:check` | passed | `AGENTS.md` is treated as user-managed documentation like `CLAUDE.md`. |
| `bun run research:validate-corpus` | passed | Manifest and graph waiver state valid. |
| `bun run research:validate-sdd` | passed | Required ACO SDD spec files present and sectioned. |

## Known Baseline Blockers

- All-workflow validation is not clean because `archon-smart-pr-review` contains an optional ntfy MCP node whose config file is intentionally absent until a user opts in. This is pre-existing Archon workflow behavior and is not an ACO architecture blocker.

## Baseline Decisions

- ACO implementation may proceed through SDD, ATDD, ADRs, and MVP selection.
- Do not claim global workflow validation passes until the optional ntfy validation issue is resolved or explicitly waived.
- New ACO workflows, if added, must validate independently by name.
